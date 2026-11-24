"""
Módulo de Desbloqueo Interactivo de Sesiones de Navegador (Temu, Mercado Libre, etc.)
Lanza una ventana visible de Chromium con el perfil persistente 'data/browser_profile'
para permitir al usuario iniciar sesión o resolver captchas/antibot manualmente.
"""

import sys
import os
import time
import json
import argparse
import logging
from pathlib import Path

# Configurar logging en consola
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("kipustock.session_unlocker")

BASE_DIR = Path(__file__).resolve().parent.parent
BROWSER_PROFILE_DIR = BASE_DIR / "data" / "browser_profile"


def clean_browser_profile_locks(profile_dir: Path):
    """
    Libera bloqueos sobre el perfil persistente de Chromium / Google Chrome.
    1. En Windows, busca y cierra procesos previos de chrome.exe que utilicen este perfil usando psutil.
    2. Elimina archivos residuales de bloqueo (SingletonLock, SingletonCookie, SingletonSocket, lockfile, etc.).
    """
    profile_path = Path(profile_dir).resolve()
    if not profile_path.exists():
        profile_path.mkdir(parents=True, exist_ok=True)
        return

    # 1. En Windows, buscar y terminar procesos chrome.exe huérfanos asociados a este perfil
    try:
        import psutil
        folder_str = str(profile_path).lower()
        folder_name = profile_path.name.lower()
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                name = (proc.info['name'] or '').lower()
                if 'chrome' in name or 'chromium' in name:
                    cmdline = ' '.join(proc.info['cmdline'] or []).lower()
                    if folder_str in cmdline or folder_name in cmdline:
                        logger.info(f"Cerrando proceso previo huérfano de navegador: PID {proc.pid}")
                        proc.kill()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    except Exception as ex:
        logger.warning(f"Aviso al cerrar procesos huérfanos con psutil: {ex}")

    # Breve pausa para liberar handles de archivos en el sistema operativo
    time.sleep(0.5)

    # 2. Eliminar archivos de bloqueo conocidos (en raíz de perfil y en subcarpeta Default)
    lock_files = [
        "lockfile",
        "SingletonLock",
        "SingletonCookie",
        "SingletonSocket",
        "DevToolsActivePort"
    ]
    for base_dir in [profile_path, profile_path / "Default"]:
        if not base_dir.exists():
            continue
        for lf in lock_files:
            target_file = base_dir / lf
            try:
                if target_file.exists() or target_file.is_symlink():
                    target_file.unlink(missing_ok=True)
                    logger.info(f"Archivo de bloqueo eliminado: {target_file.name}")
            except Exception as e:
                logger.warning(f"No se pudo eliminar archivo de bloqueo {target_file.name}: {e}")


def bring_window_to_front():
    """Fuerza a la ventana de Chrome/Chromium a posicionarse en primer plano en Windows."""
    if sys.platform == "win32":
        try:
            import ctypes
            user32 = ctypes.windll.user32
            user32.AllowSetForegroundWindow(-1)

            def enum_handler(hwnd, extra):
                if user32.IsWindowVisible(hwnd):
                    length = user32.GetWindowTextLengthW(hwnd)
                    if length > 0:
                        buff = ctypes.create_unicode_buffer(length + 1)
                        user32.GetWindowTextW(hwnd, buff, length + 1)
                        title = buff.value.lower()
                        if any(k in title for k in ["temu", "mercado libre", "chrome", "google chrome"]):
                            user32.ShowWindow(hwnd, 3)  # SW_MAXIMIZE
                            user32.SetForegroundWindow(hwnd)
                return True

            EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
            user32.EnumWindows(EnumWindowsProc(enum_handler), 0)
        except Exception as e:
            logger.debug(f"Aviso al forzar primer plano en Windows: {e}")


def run_unlock_session(tienda: str, target_url: str = None, timeout_seconds: int = 300, headless: bool = False) -> dict:
    """
    Ejecuta la sesión interactiva con Google Chrome real de Windows (channel="chrome")
    con fallback a Chromium, maximizado y en primer plano.
    """
    # 1. Liberar cualquier bloqueo previo de procesos y SingletonLock
    clean_browser_profile_locks(BROWSER_PROFILE_DIR)

    # Determinar URL por defecto
    tienda_lower = tienda.lower()
    if "temu" in tienda_lower:
        default_url = "https://www.temu.com/pe"
    elif "mercado" in tienda_lower:
        default_url = "https://www.mercadolibre.com.pe"
    else:
        default_url = "https://www.google.com"

    nav_url = target_url or default_url

    print(f"[DESBLOQUEO] Iniciando ventana visible para {tienda} en: {nav_url}...", flush=True)
    logger.info(f"Iniciando sesión interactiva para '{tienda}' en: {nav_url}")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        err_msg = "Playwright no está instalado en el entorno de Python. Ejecuta: pip install playwright"
        logger.error(err_msg)
        return {"status": "error", "tienda": tienda, "mensaje": err_msg}

    try:
        with sync_playwright() as p:
            context = None
            launch_args = [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--start-maximized",
                "--new-window"
            ]

            # 1. Intentar abrir con el Google Chrome real instalado en Windows
            try:
                logger.info("Intentando abrir Google Chrome nativo de Windows (channel='chrome')...")
                context = p.chromium.launch_persistent_context(
                    user_data_dir=str(BROWSER_PROFILE_DIR),
                    channel="chrome",
                    headless=headless,
                    locale="es-PE",
                    timezone_id="America/Lima",
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/126.0.0.0 Safari/537.36"
                    ),
                    args=launch_args,
                    viewport=None
                )
                logger.info("Google Chrome nativo iniciado con éxito.")
            except Exception as chrome_ex:
                logger.warning(f"No se pudo iniciar Chrome con channel='chrome' ({chrome_ex}), intentando con Chromium de Playwright...")
                clean_browser_profile_locks(BROWSER_PROFILE_DIR)
                try:
                    context = p.chromium.launch_persistent_context(
                        user_data_dir=str(BROWSER_PROFILE_DIR),
                        headless=headless,
                        locale="es-PE",
                        timezone_id="America/Lima",
                        user_agent=(
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/126.0.0.0 Safari/537.36"
                        ),
                        args=launch_args,
                        viewport=None
                    )
                except Exception as fallback_ex:
                    err_str = str(fallback_ex)
                    err_msg = f"Error al iniciar navegador ({type(fallback_ex).__name__}): {err_str[:200]}"
                    logger.error(err_msg, exc_info=True)
                    print(f"[DESBLOQUEO ERROR] {err_msg}", flush=True)
                    return {"status": "error", "tienda": tienda, "mensaje": err_msg}

            page = context.pages[0] if context.pages else context.new_page()

            # Evitar detección básica
            try:
                page.add_init_script("delete Object.getPrototypeOf(navigator).webdriver")
            except Exception:
                pass

            logger.info(f"Navegando a {nav_url}...")
            try:
                page.goto(nav_url, wait_until="domcontentloaded", timeout=45000)
            except Exception as nav_ex:
                logger.warning(f"Aviso durante navegación inicial: {nav_ex}")

            # Traer al frente la pestaña y la ventana en Windows
            try:
                page.bring_to_front()
            except Exception:
                pass
            bring_window_to_front()

            msg_opened = f"[DESBLOQUEO] Ventana abierta para {tienda} en {nav_url}. Esperando a que el usuario complete la interacción y cierre la ventana..."
            print(msg_opened, flush=True)
            logger.info(msg_opened)

            # Bucle de espera hasta que el usuario cierre la ventana o expire el timeout
            start_t = time.time()
            end_t = start_t + timeout_seconds

            while time.time() < end_t:
                try:
                    # Si no quedan páginas o todas las páginas fueron cerradas por el usuario
                    if not context.pages or all(p.is_closed() for p in context.pages):
                        logger.info("Ventana cerrada por el usuario.")
                        break
                except Exception:
                    break
                time.sleep(0.5)

            # Cierre ordenado para asegurar que las cookies y estado se persistan en disco
            try:
                context.close()
            except Exception:
                pass

        clean_browser_profile_locks(BROWSER_PROFILE_DIR)
        logger.info(f"Sesión de {tienda} sincronizada con éxito en {BROWSER_PROFILE_DIR}.")
        return {
            "status": "ok",
            "tienda": tienda,
            "mensaje": f"Sesión de {tienda} sincronizada exitosamente en data/browser_profile. Ya puedes volver a realizar búsquedas."
        }

    except Exception as ex:
        ex_str = str(ex)
        logger.error(f"Error inesperado durante la sesión de {tienda}: {ex}", exc_info=True)
        return {
            "status": "error",
            "tienda": tienda,
            "mensaje": f"No se pudo completar la sesión interactiva: {ex_str[:180]}"
        }


def main():
    parser = argparse.ArgumentParser(description="Desbloqueo interactivo de sesiones de navegador en Kipustock")
    parser.add_argument("--tienda", type=str, default="Temu", help="Nombre de la tienda objetivo (Temu, Mercado Libre, etc.)")
    parser.add_argument("--url", type=str, default=None, help="URL específica de navegación opcional")
    parser.add_argument("--timeout", type=int, default=300, help="Tiempo máximo de espera en segundos")
    parser.add_argument("--headless", action="store_true", help="Ejecutar en modo headless (para pruebas internas)")

    args = parser.parse_args()

    result = run_unlock_session(
        tienda=args.tienda,
        target_url=args.url,
        timeout_seconds=args.timeout,
        headless=args.headless
    )

    # Imprimir resultado en JSON a stdout para consumo por procesos padres
    print(json.dumps(result, ensure_ascii=False))

    if result.get("status") == "ok":
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
