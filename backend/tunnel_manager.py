import os
import sys
import re
import json
import time
import socket
import shutil
import logging
import threading
import subprocess
import urllib.request
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger("kipustock.tunnel")

BASE_DIR = Path(__file__).resolve().parent.parent
BIN_DIR = BASE_DIR / "bin"
CLOUDFLARED_PATH = BIN_DIR / "cloudflared.exe"
TUNNEL_LOG_PATH = BASE_DIR / "data" / "tunnel.log"
DEBUG_LOG_PATH = BASE_DIR / "data" / "tunnel_debug.log"
STATE_FILE_PATH = BASE_DIR / "data" / "tunnel_state.json"
CONFIG_FILE_PATH = BASE_DIR / "data" / "tunnel_config.json"
DOWNLOAD_URL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"


def is_pid_running_windows(pid: int) -> bool:
    """Verifica si un PID de proceso está activo y en ejecución en Windows usando Win32 API."""
    if not pid or pid <= 0:
        return False
    try:
        import ctypes
        from ctypes import wintypes
        kernel32 = ctypes.windll.kernel32
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if not handle:
            return False
        exit_code = wintypes.DWORD()
        success = kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code))
        kernel32.CloseHandle(handle)
        # STILL_ACTIVE en Windows es 259
        return bool(success and exit_code.value == 259)
    except Exception:
        try:
            res = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}", "/NH"],
                capture_output=True,
                text=True,
                creationflags=0x08000000 if sys.platform == "win32" else 0
            )
            return "cloudflared" in res.stdout.lower()
        except Exception:
            return False


def kill_pid_windows(pid: int) -> bool:
    """Termina limpiamente o por la fuerza un PID en Windows."""
    if not pid or pid <= 0:
        return False
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        PROCESS_TERMINATE = 0x0001
        handle = kernel32.OpenProcess(PROCESS_TERMINATE, False, pid)
        if handle:
            kernel32.TerminateProcess(handle, 0)
            kernel32.CloseHandle(handle)
            return True
    except Exception:
        pass
    try:
        subprocess.run(
            ["taskkill", "/F", "/PID", str(pid)],
            capture_output=True,
            creationflags=0x08000000 if sys.platform == "win32" else 0
        )
        return True
    except Exception:
        return False


class TunnelManager:
    """
    Gestiona la publicación automática y gratuita ($0) de la tienda pública de KipuStock
    mediante Cloudflare Tunnel (cloudflared).

    Características de resiliencia:
    1. Persiste el estado y el proceso a través de recargas de uvicorn (--reload).
    2. Detecta terminaciones de proceso y actualiza el estado a inactivo en public-status.
    3. Registra detalladamente toda la salida y códigos de salida en data/tunnel.log.
    4. Provee auto-reconexión opcional si el túnel cae inesperadamente.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(TunnelManager, cls).__new__(cls)
                cls._instance._init_state()
            return cls._instance

    def _init_state(self):
        self.process: Optional[subprocess.Popen] = None
        self.saved_pid: Optional[int] = None
        self.public_url: Optional[str] = None
        self.store_url: Optional[str] = None
        self.is_named_tunnel: bool = False
        self.started_at: Optional[float] = None
        self.is_starting: bool = False
        self.last_error: Optional[str] = None
        self.auto_restart: bool = True
        self._reader_thread: Optional[threading.Thread] = None
        self.recent_logs: deque = deque(maxlen=40)

        # Cargar logs previos si existen
        self._load_recent_logs_from_file()

        # Intentar recuperar un túnel existente sobreviviente a recargas de uvicorn (--reload)
        self._try_recover_existing_tunnel()

    def get_tunnel_config(self) -> Dict[str, Any]:
        """
        Obtiene la configuración de Cloudflare Named Tunnel (token y dominio fijo).
        Lee prioritariamente desde data/tunnel_config.json y recurre a variables de entorno (.env).
        """
        token = os.environ.get("CLOUDFLARE_TUNNEL_TOKEN", "").strip()
        fixed_domain = os.environ.get("CLOUDFLARE_FIXED_DOMAIN", "").strip()

        if CONFIG_FILE_PATH.exists():
            try:
                with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        f_token = data.get("token")
                        f_domain = data.get("fixed_domain")
                        if f_token is not None and str(f_token).strip():
                            token = str(f_token).strip()
                        if f_domain is not None and str(f_domain).strip():
                            fixed_domain = str(f_domain).strip()
            except Exception as e:
                logger.warning(f"Error al leer tunnel_config.json: {e}")

        # Normalizar fixed_domain asegurando protocolo https:// y sin barra final
        if fixed_domain:
            if not fixed_domain.startswith("http://") and not fixed_domain.startswith("https://"):
                fixed_domain = f"https://{fixed_domain}"
            fixed_domain = fixed_domain.rstrip("/")

        return {
            "token": token,
            "fixed_domain": fixed_domain,
            "has_token": bool(token)
        }

    def save_tunnel_config(self, token: Optional[str] = "", fixed_domain: Optional[str] = "") -> Dict[str, Any]:
        """Guarda la configuración del túnel en data/tunnel_config.json."""
        token_clean = (token or "").strip()
        domain_clean = (fixed_domain or "").strip()
        if domain_clean:
            if not domain_clean.startswith("http://") and not domain_clean.startswith("https://"):
                domain_clean = f"https://{domain_clean}"
            domain_clean = domain_clean.rstrip("/")

        CONFIG_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "token": token_clean,
            "fixed_domain": domain_clean,
            "updated_at": datetime.now().isoformat()
        }
        with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

        self._write_log(f"[CONFIG] Configuración de Named Tunnel guardada. Dominio fijo: {domain_clean or '(no especificado)'}, Token configurado: {'Sí' if token_clean else 'No'}")
        return self.get_tunnel_config()

    def delete_tunnel_config(self) -> Dict[str, Any]:
        """Elimina data/tunnel_config.json y restablece a modo rápido predeterminado."""
        try:
            if CONFIG_FILE_PATH.exists():
                CONFIG_FILE_PATH.unlink()
            self._write_log("[CONFIG] Configuración de Named Tunnel eliminada. Regresando a modo rápido.")
        except Exception as e:
            logger.warning(f"Error al eliminar tunnel_config.json: {e}")
        return self.get_tunnel_config()

    def _write_log(self, message: str):
        """Registra un mensaje con marca de tiempo en data/tunnel.log y data/tunnel_debug.log."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        formatted = f"[{timestamp}] {message}"
        self.recent_logs.append(message)

        for log_file in [TUNNEL_LOG_PATH, DEBUG_LOG_PATH]:
            try:
                log_file.parent.mkdir(parents=True, exist_ok=True)
                with open(log_file, "a", encoding="utf-8") as f:
                    f.write(formatted + "\n")
            except Exception:
                pass

    def _load_recent_logs_from_file(self):
        """Carga las últimas líneas de data/tunnel.log al buffer en memoria."""
        try:
            if TUNNEL_LOG_PATH.exists():
                with open(TUNNEL_LOG_PATH, "r", encoding="utf-8", errors="replace") as f:
                    lines = f.readlines()
                    for line in lines[-25:]:
                        cleaned = line.strip()
                        if cleaned:
                            self.recent_logs.append(cleaned)
        except Exception:
            pass

    def _save_state(self, active: bool = True):
        """Guarda el estado del túnel en data/tunnel_state.json para persistir tras reload."""
        try:
            STATE_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
            current_pid = self.process.pid if self.process else self.saved_pid
            state_data = {
                "active": active,
                "pid": current_pid,
                "public_url": self.public_url,
                "store_url": self.store_url,
                "is_named_tunnel": getattr(self, "is_named_tunnel", False),
                "started_at": self.started_at,
                "updated_at": time.time()
            }
            with open(STATE_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(state_data, f, indent=2)
        except Exception as e:
            logger.warning(f"No se pudo guardar tunnel_state.json: {e}")

    def _clear_state(self):
        """Limpia el archivo de estado persistente."""
        try:
            if STATE_FILE_PATH.exists():
                STATE_FILE_PATH.unlink()
        except Exception:
            pass

    def _try_recover_existing_tunnel(self):
        """
        Si uvicorn se recarga por cambios de código (--reload), recupera el proceso
        cloudflared que sigue vivo en Windows para mantener el mismo enlace público
        sin romper la tienda ni generar Error 1033.
        """
        try:
            if not STATE_FILE_PATH.exists():
                return

            with open(STATE_FILE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)

            pid = data.get("pid")
            public_url = data.get("public_url")
            store_url = data.get("store_url")
            is_active = data.get("active", False)
            is_named = data.get("is_named_tunnel", False)

            if is_active and pid and is_pid_running_windows(pid):
                self.saved_pid = pid
                self.public_url = public_url
                self.store_url = store_url
                self.is_named_tunnel = is_named
                self.started_at = data.get("started_at", time.time())
                mode_str = "Named Tunnel" if is_named else "Modo Rápido"
                msg = f"[RELOAD_RECOVER] Túnel ({mode_str}) recuperado con PID {pid}. URL activa: {self.store_url}"
                self._write_log(msg)
                logger.info(msg)
            else:
                self._clear_state()
        except Exception as e:
            logger.warning(f"Error al intentar recuperar túnel previo: {e}")

    def check_local_server(self, host: str = "127.0.0.1", port: int = 8000, timeout: float = 2.0) -> bool:
        """Verifica que el servidor local de Kipustock esté respondiendo en el puerto especificado."""
        try:
            with socket.create_connection((host, port), timeout=timeout):
                return True
        except Exception:
            return False

    def is_process_alive(self) -> bool:
        """
        Verifica si el subproceso cloudflared sigue activo.
        Si detecta que el proceso murió mientras el túnel estaba activo,
        registra la salida y actualiza el estado a inactivo para evitar falsos positivos.
        """
        # Caso 1: Instancia subprocess.Popen local
        if self.process is not None:
            ret = self.process.poll()
            if ret is not None:
                pid = getattr(self.process, 'pid', 'Desconocido')
                exit_msg = f"[EXIT] cloudflared.exe (PID {pid}) terminó inesperadamente con código de salida: {ret}"
                logger.warning(f"[TUNNEL] {exit_msg}")
                self._write_log(exit_msg)
                self.last_error = f"cloudflared.exe finalizó con código {ret}."
                self.process = None
                self.saved_pid = None
                self.public_url = None
                self.store_url = None
                self._clear_state()
                return False
            return True

        # Caso 2: Proceso recuperado tras recarga (saved_pid)
        if self.saved_pid is not None:
            if is_pid_running_windows(self.saved_pid):
                return True
            else:
                exit_msg = f"[EXIT] cloudflared.exe (PID {self.saved_pid}) ya no está en ejecución en Windows."
                logger.warning(f"[TUNNEL] {exit_msg}")
                self._write_log(exit_msg)
                self.last_error = f"cloudflared.exe (PID {self.saved_pid}) dejó de ejecutarse."
                self.saved_pid = None
                self.public_url = None
                self.store_url = None
                self._clear_state()
                return False

        return False

    def get_binary_path(self) -> Optional[str]:
        # 1. Comprobar si existe en el PATH del sistema
        in_path = shutil.which("cloudflared")
        if in_path:
            return in_path

        # 2. Comprobar si existe localmente en bin/cloudflared.exe
        if CLOUDFLARED_PATH.exists() and CLOUDFLARED_PATH.stat().st_size > 1000000:
            return str(CLOUDFLARED_PATH)

        return None

    def ensure_cloudflared_binary(self) -> str:
        """Verifica la existencia de cloudflared o lo descarga automáticamente de la fuente oficial."""
        bin_path = self.get_binary_path()
        if bin_path:
            return bin_path

        BIN_DIR.mkdir(parents=True, exist_ok=True)
        temp_bin = BIN_DIR / "cloudflared_temp.exe"
        logger.info(f"Descargando binario oficial de cloudflared desde {DOWNLOAD_URL}...")
        self._write_log(f"[DOWNLOAD] Iniciando descarga de cloudflared oficial desde {DOWNLOAD_URL}")
        print(f"[TUNNEL] Descargando cloudflared oficial hacia {CLOUDFLARED_PATH}...", flush=True)

        req = urllib.request.Request(
            DOWNLOAD_URL,
            headers={"User-Agent": "KipuStock-Tunnel/1.0 (Windows NT 10.0; Win64; x64)"}
        )
        with urllib.request.urlopen(req, timeout=90) as resp, open(temp_bin, "wb") as out_f:
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                out_f.write(chunk)

        if temp_bin.exists() and temp_bin.stat().st_size > 1000000:
            if CLOUDFLARED_PATH.exists():
                try:
                    CLOUDFLARED_PATH.unlink()
                except Exception:
                    pass
            temp_bin.rename(CLOUDFLARED_PATH)
            logger.info("Binario cloudflared descargado e instalado exitosamente.")
            self._write_log("[DOWNLOAD] cloudflared descargado e instalado exitosamente.")
            print("[TUNNEL] cloudflared descargado e instalado exitosamente.", flush=True)
            return str(CLOUDFLARED_PATH)
        else:
            raise RuntimeError("La descarga de cloudflared no completó correctamente el archivo binario.")

    def start_tunnel(self, local_port: int = 8000, timeout: int = 40) -> Dict[str, Any]:
        """
        Inicia el proceso cloudflared tunnel hacia http://127.0.0.1:{local_port}
        y extrae la URL pública asignada por Cloudflare (*.trycloudflare.com).
        """
        with self._lock:
            if self.is_active():
                self._write_log(f"[START_REUSE] Túnel ya activo en {self.store_url}. Reutilizando conexión.")
                return self.get_status()

            self.last_error = None
            self.is_starting = True

            # Limpiar cualquier proceso zombie residual previo
            if self.saved_pid:
                kill_pid_windows(self.saved_pid)
                self.saved_pid = None

            # 1. Verificar si el servidor local está respondiendo
            is_listening = self.check_local_server(host="127.0.0.1", port=local_port, timeout=2.0)
            if not is_listening:
                msg_listen = f"[WARN] El servidor local en 127.0.0.1:{local_port} no respondió al ping previo. Iniciando túnel de todos modos."
                logger.warning(msg_listen)
                self._write_log(msg_listen)
            else:
                self._write_log(f"[CHECK] Servidor local verificado escuchando en 127.0.0.1:{local_port}")

            try:
                bin_path = self.ensure_cloudflared_binary()
                cfg = self.get_tunnel_config()
                token = cfg.get("token")
                fixed_domain = cfg.get("fixed_domain")
                is_named = bool(token)
                self.is_named_tunnel = is_named

                if is_named:
                    # Modo 1: Cloudflare Named Tunnel con Token y Dominio Fijo
                    cmd = [bin_path, "tunnel", "run", "--token", token]
                    domain = fixed_domain or "https://tienda.tudominio.com"
                    self.public_url = domain
                    self.store_url = f"{domain}/tienda"
                    self.started_at = time.time()
                else:
                    # Modo 2: Túnel Rápido Gratuito de Respaldo (*.trycloudflare.com)
                    local_url = f"http://127.0.0.1:{local_port}"
                    cmd = [bin_path, "tunnel", "--url", local_url]
                    self.public_url = None
                    self.store_url = None

                # En Windows, CREATE_NEW_PROCESS_GROUP permite que el proceso no muera por señales del reloader
                creation_flags = 0
                if sys.platform == "win32":
                    creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW

                cmd_display = f"{bin_path} tunnel run --token [PROTEGIDO]" if is_named else ' '.join(cmd)
                logger.info(f"Iniciando túnel Cloudflare: {cmd_display}")
                self._write_log(f"[START] Ejecutando: {cmd_display}")
                if is_named:
                    print(f"[TUNNEL] Arrancando túnel Cloudflare (Named Tunnel) hacia subdominio fijo: {self.public_url}...", flush=True)
                else:
                    print(f"[TUNNEL] Arrancando túnel Cloudflare rápido hacia {local_url}...", flush=True)

                self.process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    creationflags=creation_flags,
                    cwd=str(BASE_DIR)
                )

                found_url_event = threading.Event()

                def _log_reader():
                    url_regex = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
                    url_detected_time = time.time() if is_named else None
                    try:
                        for line in iter(self.process.stdout.readline, ''):
                            clean_line = line.strip()
                            if clean_line:
                                self._write_log(f"[cloudflared stdout] {clean_line}")
                                logger.debug(f"[cloudflared] {clean_line}")

                            if not is_named:
                                if not self.public_url:
                                    m = url_regex.search(clean_line)
                                    if m:
                                        raw_url = m.group(0).strip().rstrip("/")
                                        self.public_url = raw_url
                                        self.store_url = f"{self.public_url}/tienda"
                                        self.started_at = time.time()
                                        url_detected_time = time.time()

                                        log_ok = f"[TUNNEL ASIGNADO] URL Base: {self.public_url} | Tienda: {self.store_url}"
                                        logger.info(log_ok)
                                        self._write_log(log_ok)
                                        print(log_ok, flush=True)

                            # Sincronización Anycast: esperar registro en la red Cloudflare
                            if self.public_url and not found_url_event.is_set():
                                is_registered = any(term in clean_line.lower() for term in [
                                    "registered tunnel connection",
                                    "connindex=",
                                    "protocol=quic",
                                    "http/2 connection successful",
                                    "connection registered",
                                    "updated to new configuration",
                                    "starting metrics server"
                                ])
                                elapsed = (time.time() - url_detected_time) if url_detected_time else 0
                                if is_registered or (is_named and elapsed >= 3.0) or (not is_named and elapsed >= 5.0):
                                    mode_lbl = "Subdominio Fijo" if is_named else "Modo Rápido"
                                    reg_log = f"[TUNNEL LISTO ({mode_lbl})] Conexión establecida con red Cloudflare Anycast: {self.store_url}"
                                    logger.info(reg_log)
                                    self._write_log(reg_log)
                                    # Guardar estado persistente
                                    self._save_state(active=True)
                                    found_url_event.set()

                    except Exception as e:
                        err_reader = f"[READER_ERROR] Error en lector de salida de cloudflared: {e}"
                        logger.error(err_reader)
                        self._write_log(err_reader)
                    finally:
                        # Si cloudflared termina su stream, capturar código de salida
                        if self.process:
                            ret = self.process.poll()
                            if ret is not None:
                                self._write_log(f"[EXIT] cloudflared.exe terminó en el lector con código: {ret}")
                        found_url_event.set()

                self._reader_thread = threading.Thread(target=_log_reader, daemon=True)
                self._reader_thread.start()

                # Esperar a que la URL pública sea emitida y confirmada en la red
                success = found_url_event.wait(timeout=timeout)

                if not success or not self.public_url:
                    if self.process and self.process.poll() is not None:
                        ret = self.process.poll()
                        raise RuntimeError(f"El proceso cloudflared terminó con código {ret}. Revisa data/tunnel.log")
                    raise TimeoutError("Tiempo de espera agotado esperando la asignación de URL por Cloudflare.")

                # Re-verificar que el proceso sigue vivo antes de devolver
                if not self.is_process_alive():
                    raise RuntimeError("El túnel de Cloudflare se cerró antes de poder completar la inicialización.")

                # Breve estabilización (1.0 seg) para permitir propagación de registros DNS Anycast
                time.sleep(1.0)

                self.is_starting = False
                self._save_state(active=True)
                mode_info = "Subdominio Fijo" if is_named else "Modo Rápido"
                self._write_log(f"[VERIFIED] Túnel listo ({mode_info}). PID: {self.process.pid}, Store URL: {self.store_url}")
                return self.get_status()

            except Exception as e:
                self.is_starting = False
                self.last_error = str(e)
                logger.error(f"Error al iniciar túnel de Cloudflare: {e}", exc_info=True)
                self._write_log(f"[ERROR] Error al iniciar túnel: {e}")
                self.stop_tunnel()
                raise e

    def stop_tunnel(self) -> Dict[str, Any]:
        """Detiene el túnel voluntariamente y limpia los recursos del proceso."""
        with self._lock:
            pid_to_kill = None
            if self.process:
                pid_to_kill = self.process.pid
                try:
                    logger.info("Deteniendo túnel Cloudflare...")
                    self._write_log(f"[STOP] Deteniendo proceso cloudflared con PID {pid_to_kill}...")
                    self.process.terminate()
                    try:
                        self.process.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        self.process.kill()
                except Exception as e:
                    self._write_log(f"[STOP_WARN] Error al detener proceso: {e}")

            if self.saved_pid and self.saved_pid != pid_to_kill:
                self._write_log(f"[STOP] Deteniendo proceso guardado previo (PID {self.saved_pid})...")
                kill_pid_windows(self.saved_pid)

            self.process = None
            self.saved_pid = None
            self.public_url = None
            self.store_url = None
            self.is_named_tunnel = False
            self.started_at = None
            self.is_starting = False
            self._clear_state()

            self._write_log("[STOP] Túnel Cloudflare detenido y estado reseteado exitosamente.")
            print("[TUNNEL] Túnel Cloudflare detenido limpiamente.", flush=True)
            return self.get_status()

    def is_active(self) -> bool:
        """Indica si el proceso sigue en ejecución y tiene URL asignada."""
        if self.is_process_alive() and bool(self.public_url):
            return True
        return False

    def get_status(self) -> Dict[str, Any]:
        """Devuelve el estado en tiempo real del túnel o del despliegue en la nube (Render)."""
        # Si corre en Render u otro hosting con URL pública predefinida
        render_url = os.getenv("RENDER_EXTERNAL_URL", "").strip().rstrip("/")
        if render_url:
            return {
                "active": True,
                "process_alive": True,
                "is_starting": False,
                "public_url": render_url,
                "store_url": f"{render_url}/tienda",
                "is_named_tunnel": True,
                "pid": None,
                "started_at": datetime.utcnow().isoformat(),
                "last_error": None,
                "recent_logs": [f"Despliegue activo en la nube ($0): {render_url}"],
                "config": {
                    "has_token": False,
                    "fixed_domain": render_url
                }
            }

        alive = self.is_process_alive()
        active = alive and bool(self.public_url)
        current_pid = self.process.pid if (self.process and alive) else (self.saved_pid if alive else None)
        cfg = self.get_tunnel_config()

        return {
            "active": active,
            "process_alive": alive,
            "is_starting": self.is_starting,
            "public_url": self.public_url if active else None,
            "store_url": self.store_url if active else None,
            "is_named_tunnel": getattr(self, "is_named_tunnel", False),
            "pid": current_pid,
            "started_at": self.started_at if active else None,
            "last_error": self.last_error,
            "recent_logs": list(self.recent_logs)[-20:],
            "config": {
                "has_token": cfg.get("has_token", False),
                "fixed_domain": cfg.get("fixed_domain", "")
            }
        }


# Instancia única global
tunnel_manager = TunnelManager()
