"""
Script independiente para desbloqueo visible de sesiones de navegador en Windows.
Abre Chromium/Chrome/Edge en modo visible (headless=False) con ventana normal (1280x800 en 100,100)
para resolver captchas, verificar región o iniciar sesión en tiendas como Mercado Libre o Temu.
Registra el progreso en data/unlock_debug.log y data/unlock_status.json.
"""

import sys
import os
import time
import json
import argparse
import traceback
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_BROWSER_PROFILE_DIR = BASE_DIR / "data" / "browser_profile"
LOG_FILE = BASE_DIR / "data" / "unlock_debug.log"
CONSOLE_LOG_FILE = BASE_DIR / "data" / "unlock_console.log"
STATUS_FILE = BASE_DIR / "data" / "unlock_status.json"


def log_debug(msg: str):
    """Escribe un mensaje con marca de tiempo en consola, unlock_debug.log y unlock_console.log."""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"[{timestamp}] {msg}"
    print(formatted, flush=True)
    for log_path in [LOG_FILE, CONSOLE_LOG_FILE]:
        try:
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(formatted + "\n")
                f.flush()
        except Exception:
            pass


def update_status(status: str, tienda: str, error: str = None, pid: int = None, executable: str = None):
    """Actualiza el archivo de estado atómico para que backend/main.py pueda consultar el resultado."""
    try:
        STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
        temp_file = STATUS_FILE.with_suffix(".tmp")
        payload = {
            "status": status,
            "tienda": tienda,
            "error": error,
            "executable": executable,
            "pid": pid or os.getpid(),
            "timestamp": time.time()
        }
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        if temp_file.exists():
            temp_file.replace(STATUS_FILE)
    except Exception as e:
        log_debug(f"[AVISO ESTADO] Error guardando status: {e}")


def clean_singleton_locks(profile_dir: Path):
    """
    Elimina procesos huérfanos y archivos residuales de bloqueo (SingletonLock, lockfile, LOCK, etc.)
    que puedan impedir el lanzamiento interactivo de Chromium/Chrome/Edge en Windows.
    """
    profile_path = Path(profile_dir).resolve()
    log_debug(f"[LIMPIEZA] Verificando perfil en: {profile_path}")
    if not profile_path.exists():
        profile_path.mkdir(parents=True, exist_ok=True)
        return

    # 1. Terminar procesos previos huérfanos que tengan tomado este perfil
    try:
        import psutil
        current_pid = os.getpid()
        folder_str = str(profile_path).lower()
        folder_name = profile_path.name.lower()

        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if proc.pid == current_pid:
                    continue
                name = (proc.info['name'] or '').lower()
                cmdline_list = proc.info.get('cmdline') or []
                cmdline = ' '.join(cmdline_list).lower()

                # Cerrar scripts anteriores de unlock_browser colgados (más de 2s de antigüedad)
                if 'unlock_browser' in cmdline and 'python' in name:
                    try:
                        if time.time() - proc.create_time() < 2.0:
                            continue
                    except Exception:
                        pass
                    log_debug(f"[LIMPIEZA] Terminando script unlock_browser previo huérfano: PID {proc.pid}")
                    try:
                        proc.kill()
                    except Exception:
                        pass
                    continue

                # Cerrar procesos de navegadores que usen este perfil (con gracia de 3s para no matar arranques inmediatos)
                is_browser = any(b in name for b in ['chrome', 'chromium', 'msedge', 'edge'])
                if is_browser and (folder_str in cmdline or folder_name in cmdline):
                    try:
                        if time.time() - proc.create_time() < 3.0:
                            continue
                    except Exception:
                        pass
                    log_debug(f"[LIMPIEZA] Terminando proceso de navegador huérfano: PID {proc.pid} ({name})")
                    try:
                        proc.kill()
                    except Exception:
                        pass
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    except Exception as ex:
        log_debug(f"[AVISO LIMPIEZA] Error al revisar procesos: {ex}")

    time.sleep(0.4)

    # 2. Eliminar archivos de bloqueo conocidos en la raíz del perfil y en Default/
    lock_filenames = [
        "lockfile",
        "SingletonLock",
        "SingletonCookie",
        "SingletonSocket",
        "DevToolsActivePort",
        "LOCK",
        "Preferences.lock"
    ]
    for target_dir in [profile_path, profile_path / "Default"]:
        if not target_dir.exists():
            continue
        for lf in lock_filenames:
            target_file = target_dir / lf
            try:
                if target_file.exists() or target_file.is_symlink():
                    target_file.unlink(missing_ok=True)
                    log_debug(f"[LIMPIEZA] Archivo de bloqueo eliminado: {target_file.name}")
            except Exception as e:
                log_debug(f"[AVISO LIMPIEZA] No se pudo eliminar archivo de bloqueo {target_file.name}: {e}")

        # Limpieza amplia de cualquier archivo con patrón singleton o lockfile
        try:
            for item in target_dir.iterdir():
                item_lower = item.name.lower()
                if item.is_file() and any(k in item_lower for k in ["singleton", "lockfile"]):
                    try:
                        item.unlink(missing_ok=True)
                        log_debug(f"[LIMPIEZA] Archivo residual eliminado: {item.name}")
                    except Exception:
                        pass
        except Exception:
            pass


def find_available_browser_executables():
    r"""
    Detecta los binarios ejecutables de navegador existentes en Windows sin invocar
    playwright.sync_api directamente dentro de bucles de eventos asyncio.
    Prioriza Chromium (chrome-win64\chrome.exe) como candidato #1 para evitar
    que Microsoft Edge o Google Chrome se queden atrapados en modos background o Startup Boost de Windows.
    """
    candidates = []
    localappdata = os.environ.get("LOCALAPPDATA", "")
    prog_files = os.environ.get("ProgramFiles", "C:\\Program Files")
    prog_files_x86 = os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")

    # 1. Chromium integrado empaquetado (chrome-win64\chrome.exe - Prioridad #1)
    # Binario 100% puro y aislado, sin background mode ni interferencias de perfiles de usuario
    pw_dir = Path(localappdata) / "ms-playwright"
    if pw_dir.exists():
        for ch_dir in sorted(pw_dir.glob("chromium-*"), reverse=True):
            cand = ch_dir / "chrome-win64" / "chrome.exe"
            if cand.exists() and not any(c[1] == str(cand) for c in candidates):
                candidates.append(("Playwright Chromium (chrome-win64)", str(cand), None))

    # 2. Microsoft Edge (Chromium nativo en Windows)
    edge_candidates = [
        ("Microsoft Edge (x86)", Path(prog_files_x86) / "Microsoft" / "Edge" / "Application" / "msedge.exe", "msedge"),
        ("Microsoft Edge (64-bit)", Path(prog_files) / "Microsoft" / "Edge" / "Application" / "msedge.exe", "msedge"),
        ("Microsoft Edge (User)", Path(localappdata) / "Microsoft" / "Edge" / "Application" / "msedge.exe", "msedge"),
    ]
    for label, path_obj, channel in edge_candidates:
        if path_obj.exists() and not any(c[1] == str(path_obj) for c in candidates):
            candidates.append((label, str(path_obj), channel))

    # 3. Google Chrome instalado en el sistema
    chrome_candidates = [
        ("Google Chrome (x86)", Path(prog_files_x86) / "Google" / "Chrome" / "Application" / "chrome.exe", "chrome"),
        ("Google Chrome (64-bit)", Path(prog_files) / "Google" / "Chrome" / "Application" / "chrome.exe", "chrome"),
        ("Google Chrome (User)", Path(localappdata) / "Google" / "Chrome" / "Application" / "chrome.exe", "chrome"),
    ]
    for label, path_obj, channel in chrome_candidates:
        if path_obj.exists() and not any(c[1] == str(path_obj) for c in candidates):
            candidates.append((label, str(path_obj), channel))

    log_debug(f"[DETECCIÓN NAVEGADORES] Candidatos encontrados en el sistema: {[c[0] for c in candidates]}")
    return candidates


def get_profile_browser_pids(profile_path: Path) -> set:
    """Obtiene los PIDs de los procesos de navegador asociados específicamente a este perfil."""
    pids = set()
    try:
        import psutil
        folder_str = str(profile_path).lower().rstrip("/\\")
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                name = (proc.info['name'] or '').lower()
                if any(b in name for b in ['chrome', 'chromium', 'msedge']):
                    cmdline = ' '.join(proc.info['cmdline'] or []).lower()
                    if folder_str in cmdline:
                        pids.add(proc.pid)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    except Exception:
        pass
    return pids


def bring_to_absolute_foreground(target_pids: set = None, titles: list = None) -> int:
    """
    Fuerza a la ventana a saltar al frente absoluto de la pantalla en Windows,
    superando la restricción de foco (foreground lock) mediante HWND_TOPMOST y AttachThreadInput.
    Retorna el número de ventanas visibles encontradas y posicionadas al frente.
    """
    if sys.platform != "win32":
        return 0

    found_windows = []
    try:
        import ctypes
        from ctypes import wintypes
        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32

        HWND_TOPMOST = -1
        HWND_NOTOPMOST = -2
        SWP_NOMOVE = 0x0002
        SWP_NOSIZE = 0x0001
        SWP_SHOWWINDOW = 0x0040
        SW_RESTORE = 9

        user32.AllowSetForegroundWindow(-1)

        fg_hwnd = user32.GetForegroundWindow()
        fg_thread_id = user32.GetWindowThreadProcessId(fg_hwnd, None) if fg_hwnd else 0
        curr_thread_id = kernel32.GetCurrentThreadId()

        attached = False
        if fg_thread_id and fg_thread_id != curr_thread_id:
            attached = bool(user32.AttachThreadInput(curr_thread_id, fg_thread_id, True))

        def enum_handler(hwnd, extra):
            if user32.IsWindowVisible(hwnd):
                length = user32.GetWindowTextLengthW(hwnd)
                # Solo considerar ventanas principales que tengan un título real visible
                if length > 0:
                    buff = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(hwnd, buff, length + 1)
                    t_lower = buff.value.lower()

                    win_pid = wintypes.DWORD()
                    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(win_pid))

                    match = False
                    if target_pids and win_pid.value in target_pids:
                        match = True
                    elif titles and any(k.lower() in t_lower for k in titles):
                        match = True

                    if match:
                        found_windows.append(hwnd)
            return True

        EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
        user32.EnumWindows(EnumWindowsProc(enum_handler), 0)

        for hwnd in found_windows:
            try:
                user32.ShowWindow(hwnd, SW_RESTORE)
                user32.SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
                user32.BringWindowToTop(hwnd)
                if hasattr(user32, "SwitchToThisWindow"):
                    user32.SwitchToThisWindow(hwnd, True)
                user32.SetForegroundWindow(hwnd)
                user32.SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
            except Exception:
                pass

        if attached:
            user32.AttachThreadInput(curr_thread_id, fg_thread_id, False)

        log_debug(f"[FOREGROUND] Ventanas posicionadas en primer plano: {len(found_windows)}")
    except Exception as ex:
        log_debug(f"[AVISO FOREGROUND] Error: {ex}")

    return len(found_windows)


def launch_interactive_shell_browser(target_url: str, profile_path: Path, store_display: str, timeout_seconds: int = 300) -> bool:
    """
    Intenta abrir una ventana visible en el escritorio interactivo del usuario en Windows.
    Prueba en orden: Playwright Chromium (chrome-win64), Microsoft Edge y Google Chrome.
    Verifica que las rutas y argumentos se entrecomillen correctamente y usa:
    creationflags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
    Registra detalladamente en data/unlock_console.log la ruta exacta, los argumentos pasados y si el proceso quedó vivo.
    """
    if sys.platform != "win32":
        return False

    candidates = find_available_browser_executables()
    if not candidates:
        log_debug("[ERROR DETECCIÓN] No se encontraron candidatos de navegador en el sistema.")
        return False

    clean_singleton_locks(profile_path)

    for label, exec_path, channel in candidates:
        if not exec_path or not Path(exec_path).exists():
            continue

        log_debug("=" * 60)
        log_debug(f"[LANZAMIENTO ESCRITORIO] Probando candidato: '{label}'")
        log_debug(f"[LANZAMIENTO RUTA] {exec_path}")

        creation_flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP

        # 1. Intento principal con subprocess.Popen directo y proceso desvinculado (DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
        # Rutas y argumentos entrecomillados y formateados adecuadamente
        cmd_direct = [
            str(exec_path),
            f"--user-data-dir={str(profile_path)}",
            "--new-window",
            "--window-position=100,100",
            "--window-size=1280,800",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-networking",
            "--disable-features=msEdgeStartupBoost,CalculateNativeWinOcclusion",
            target_url
        ]
        cmd_str_logged = subprocess.list2cmdline(cmd_direct)
        log_debug(f"[LANZAMIENTO ARGS] {cmd_str_logged}")

        try:
            clean_singleton_locks(profile_path)
            proc = subprocess.Popen(
                cmd_direct,
                creationflags=creation_flags,
                shell=False
            )
            time.sleep(2.0)
            pids = get_profile_browser_pids(profile_path)
            poll_res = proc.poll()

            # Verificar si el proceso sigue vivo o si se detectaron PIDs corriendo con este perfil
            if poll_res is None or pids:
                log_debug(f"[PROCESO VIVO OK] '{label}' iniciado en escritorio interactivo. PID spawned: {proc.pid}, PIDs perfil: {pids}")
                update_status("running", store_display, pid=proc.pid, executable=f"{label} (Desktop)")

                win_count = bring_to_absolute_foreground(target_pids=pids or {proc.pid}, titles=[store_display, "temu", "mercado libre", "chrome", "edge", "chromium"])
                time.sleep(1.0)
                win_count = bring_to_absolute_foreground(target_pids=pids or {proc.pid}, titles=[store_display, "temu", "mercado libre", "chrome", "edge", "chromium"])

                # Si no se detectaron ventanas visibles de Edge, puede ser Edge background broker
                if win_count == 0 and "edge" in label.lower():
                    log_debug(f"[AVISO VISIBILIDAD] '{label}' fue capturado en modo background service sin ventana visible. Probando siguiente candidato...")
                    try:
                        proc.kill()
                    except Exception:
                        pass
                    clean_singleton_locks(profile_path)
                    continue

                log_debug("=" * 60)
                log_debug(f"VENTANA VISIBLE EN PANTALLA ({label}). Esperando a que el usuario complete la interacción...")
                log_debug("Al terminar, cierra la ventana del navegador para guardar tus cookies.")
                log_debug("=" * 60)

                # Monitorear hasta que el usuario cierre la ventana del navegador
                start_time = time.time()
                while time.time() - start_time < timeout_seconds:
                    active_pids = get_profile_browser_pids(profile_path)
                    if proc.poll() is not None and not active_pids:
                        log_debug("[CIERRE] Ventana cerrada por el usuario en el escritorio (proceso finalizado).")
                        break
                    time.sleep(1.0)

                clean_singleton_locks(profile_path)
                update_status("closed", store_display)
                log_debug("[FIN] Sesión guardada y sincronizada exitosamente en data/browser_profile.")
                return True
            else:
                log_debug(f"[AVISO INSTANCIA] '{label}' terminó inmediatamente (código: {poll_res}) sin procesos activos en {profile_path}. (Posible conflicto con otra instancia ya abierta del navegador).")

        except Exception as direct_err:
            log_debug(f"[ERROR LANZAMIENTO DIRECTO] Falló Popen directo con '{label}': {direct_err}")

        # 2. Intento con Windows Shell (cmd /c start) entrecomillando adecuadamente las rutas
        try:
            cmd_start_str = f'cmd /c start "" "{exec_path}" "--user-data-dir={profile_path}" --new-window "{target_url}"'
            log_debug(f"[LANZAMIENTO START CMD] {cmd_start_str}")
            proc_start = subprocess.Popen(cmd_start_str, creationflags=creation_flags, shell=False)
            time.sleep(2.0)
            pids = get_profile_browser_pids(profile_path)

            if pids:
                log_debug(f"[PROCESO VIVO OK (START)] '{label}' iniciado vía Windows Shell. PIDs perfil: {pids}")
                update_status("running", store_display, pid=list(pids)[0], executable=f"{label} (Windows Shell)")

                bring_to_absolute_foreground(target_pids=pids, titles=[store_display, "temu", "mercado libre", "chrome", "edge", "chromium"])
                time.sleep(1.0)
                bring_to_absolute_foreground(target_pids=pids, titles=[store_display, "temu", "mercado libre", "chrome", "edge", "chromium"])

                start_time = time.time()
                while time.time() - start_time < timeout_seconds:
                    active_pids = get_profile_browser_pids(profile_path)
                    if not active_pids:
                        log_debug("[CIERRE] Ventana cerrada por el usuario en el escritorio.")
                        break
                    time.sleep(1.0)

                clean_singleton_locks(profile_path)
                update_status("closed", store_display)
                log_debug("[FIN] Sesión guardada y sincronizada exitosamente en data/browser_profile.")
                return True
            else:
                log_debug(f"[AVISO START] '{label}' no generó procesos activos en el perfil mediante start.")

        except Exception as start_err:
            log_debug(f"[ERROR START] Falló start con '{label}': {start_err}")

    log_debug("[AVISO] Ningún navegador del sistema pudo abrirse en el escritorio. Pasando al respaldo de Playwright...")
    return False


def unlock_store(tienda: str = "temu", profile_dir: str = None, timeout_seconds: int = 300, monitor_only: bool = False):
    """Lanza la ventana visible con el perfil persistente de navegador."""
    tienda_clean = (tienda or "temu").strip().lower()

    if "temu" in tienda_clean:
        target_url = "https://www.temu.com/pe"
        store_display = "Temu Perú"
    elif "mercado" in tienda_clean:
        target_url = "https://www.mercadolibre.com.pe"
        store_display = "Mercado Libre Perú"
    else:
        target_url = "https://www.google.com"
        store_display = tienda

    profile_path = Path(profile_dir).resolve() if profile_dir else DEFAULT_BROWSER_PROFILE_DIR.resolve()

    log_debug("=" * 60)
    log_debug(f"KIPUSTOCK - DESBLOQUEO DE SESIÓN: {store_display}")
    log_debug(f"URL Objetivo: {target_url}")
    log_debug(f"Ruta de Perfil: {profile_path}")
    log_debug("=" * 60)

    if monitor_only:
        log_debug("[MONITOR ONLY] Modo de solo monitor activo. Esperando a que el usuario cierre el navegador...")
        start_time = time.time()
        while time.time() - start_time < timeout_seconds:
            active_pids = get_profile_browser_pids(profile_path)
            if not active_pids:
                log_debug("[CIERRE] Ventana cerrada por el usuario (procesos finalizados).")
                break
            time.sleep(1.0)
        clean_singleton_locks(profile_path)
        update_status("closed", store_display)
        log_debug("[FIN] Sesión guardada y sincronizada exitosamente en data/browser_profile.")
        return

    update_status("starting", store_display)

    # 1. Limpieza rigurosa de bloqueos y procesos previos
    clean_singleton_locks(profile_path)

    # 2. MÉTODO PRINCIPAL: Lanzar en el escritorio interactivo de Windows mediante cmd /c start
    if sys.platform == "win32":
        shell_ok = launch_interactive_shell_browser(target_url, profile_path, store_display, timeout_seconds)
        if shell_ok:
            return

    # 3. RESPALDO PLAYWRIGHT: Si falla cmd /c start o no está en Windows
    log_debug("[RESPALDO] Iniciando respaldo de contexto persistente con Playwright...")

    # 2. Detectar binarios disponibles en el sistema
    candidates = find_available_browser_executables()
    if not candidates:
        err = "No se encontró ningún binario ejecutable de Chromium, Chrome o Edge en el sistema."
        log_debug(f"[ERROR CRÍTICO] {err}")
        update_status("error", store_display, error=err)
        sys.exit(1)

    try:
        log_debug("[PLAYWRIGHT] Importando playwright.sync_api...")
        from playwright.sync_api import sync_playwright
    except Exception as imp_ex:
        err = f"No se pudo importar Playwright: {imp_ex}"
        log_debug(f"[ERROR CRÍTICO] {err}\n{traceback.format_exc()}")
        update_status("error", store_display, error=err)
        sys.exit(1)

    try:
        log_debug("[PLAYWRIGHT] Iniciando gestor de contexto Playwright...")
        with sync_playwright() as p:
            context = None
            used_candidate_name = None
            launch_errors = []

            # Argumentos de ventana normal visible en posición explícita (1280x800 en 100,100)
            launch_args = [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--new-window",
                "--window-position=100,100",
                "--window-size=1280,800",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-infobars",
                "--disable-sync"
            ]

            # 3. Intentar lanzamiento con cada binario disponible hasta que uno abra con éxito
            for label, exec_path, channel in candidates:
                log_debug(f"[LANZAMIENTO] Probando con '{label}' ({exec_path}) [headless=False, pos=100,100, size=1280,800]...")
                try:
                    clean_singleton_locks(profile_path)
                    kwargs = {
                        "user_data_dir": str(profile_path),
                        "headless": False,
                        "locale": "es-PE",
                        "timezone_id": "America/Lima",
                        "user_agent": (
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/126.0.0.0 Safari/537.36"
                        ),
                        "args": launch_args,
                        "timeout": 30000
                    }
                    if exec_path:
                        kwargs["executable_path"] = exec_path
                    elif channel:
                        kwargs["channel"] = channel

                    context = p.chromium.launch_persistent_context(**kwargs)
                    used_candidate_name = label
                    log_debug(f"[LANZAMIENTO OK] '{label}' iniciado con éxito.")
                    break
                except Exception as cand_ex:
                    cand_trace = traceback.format_exc()
                    log_debug(f"[AVISO LANZAMIENTO] Falló con '{label}': {cand_ex}\n{cand_trace}")
                    launch_errors.append(f"{label}: {str(cand_ex)}")

            if context is None:
                all_err = "; ".join(launch_errors) or "No se pudo iniciar ningún navegador compatible."
                log_debug(f"[ERROR CRÍTICO AL INICIAR NAVEGADOR]: {all_err}")
                update_status("error", store_display, error=all_err)
                sys.exit(1)

            page = context.pages[0] if context.pages else context.new_page()

            # Evitar marcas básicas de automatización
            try:
                page.add_init_script("delete Object.getPrototypeOf(navigator).webdriver")
            except Exception:
                pass

            # Verificar que el navegador permanezca vivo y no haya crasheado de inmediato
            time.sleep(2.0)
            if not context.pages or all(p.is_closed() for p in context.pages):
                err_close = "El navegador se cerró inmediatamente después del lanzamiento."
                log_debug(f"[ERROR PREMATURO] {err_close}")
                update_status("error", store_display, error=err_close)
                sys.exit(1)

            # Reportar arranque exitoso para que el backend devuelva 200 inmediatamente
            browser_pids = get_profile_browser_pids(profile_path)
            log_debug(f"[PROCESOS] PIDs identificados del navegador activo ({used_candidate_name}): {browser_pids}")
            update_status("running", store_display, pid=os.getpid(), executable=used_candidate_name)

            log_debug(f"[NAVEGACIÓN] Navegando a {target_url}...")
            try:
                page.goto(target_url, wait_until="domcontentloaded", timeout=45000)
                log_debug("[NAVEGACIÓN OK] Página cargada exitosamente.")
            except Exception as nav_ex:
                log_debug(f"[AVISO NAVEGACIÓN] Advertencia durante navegación inicial: {nav_ex}")

            # Traer al frente la pestaña en Playwright
            try:
                page.bring_to_front()
                log_debug("[FOREGROUND] page.bring_to_front() ejecutado.")
            except Exception as b_ex:
                log_debug(f"[AVISO FOREGROUND] bring_to_front error: {b_ex}")

            # Forzar primer plano en el sistema operativo Windows
            bring_to_absolute_foreground(target_pids=browser_pids, titles=[store_display, "temu", "mercado libre", "chrome", "chromium"])

            # Segundo intento tras 1 segundo para asegurar renderizado completo en Windows
            time.sleep(1.0)
            bring_to_absolute_foreground(target_pids=browser_pids, titles=[store_display, "temu", "mercado libre", "chrome", "chromium"])

            log_debug("=" * 60)
            log_debug("VENTANA VISIBLE EN PANTALLA. Esperando a que el usuario complete la interacción...")
            log_debug("Al terminar, cierra la ventana del navegador para guardar tus cookies.")
            log_debug("=" * 60)

            # Esperar a que el usuario cierre la ventana del navegador
            start_time = time.time()
            while time.time() - start_time < timeout_seconds:
                try:
                    if not context.pages or all(p.is_closed() for p in context.pages):
                        log_debug("[CIERRE] Ventana cerrada por el usuario.")
                        break
                except Exception:
                    break
                time.sleep(0.5)

            try:
                context.close()
                log_debug("[CIERRE] Contexto de navegador cerrado correctamente.")
            except Exception as c_ex:
                log_debug(f"[AVISO CIERRE] Error cerrando contexto: {c_ex}")

        clean_singleton_locks(profile_path)
        update_status("closed", store_display)
        log_debug("[FIN] Sesión guardada y sincronizada exitosamente en data/browser_profile.")

    except Exception as ex:
        err = f"Fallo no controlado en unlock_browser: {ex}"
        log_debug(f"[ERROR NO CONTROLADO]:\n{traceback.format_exc()}")
        update_status("error", store_display, error=err)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Desbloqueo interactivo de sesiones de navegador en Kipustock")
    parser.add_argument("tienda", nargs="?", default="temu", help="Nombre de la tienda objetivo (temu, mercadolibre, etc.)")
    parser.add_argument("--profile-dir", type=str, default=None, help="Ruta absoluta al directorio de perfil")
    parser.add_argument("--timeout", type=int, default=300, help="Tiempo máximo de espera en segundos")
    parser.add_argument("--monitor-only", action="store_true", help="Solo monitorea el navegador interactivo hasta que el usuario lo cierre")
    args = parser.parse_args()

    unlock_store(tienda=args.tienda, profile_dir=args.profile_dir, timeout_seconds=args.timeout, monitor_only=args.monitor_only)


if __name__ == "__main__":
    main()
