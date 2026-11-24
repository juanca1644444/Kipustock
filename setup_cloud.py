#!/usr/bin/env python3
"""
==============================================================================
KIPUSTOCK - ASISTENTE RÁPIDO DE CONFIGURACIÓN A LA NUBE ($0)
Automatiza la vinculación con GitHub, la configuración de Supabase/Neon
y la migración automática de datos sin necesidad de recordar comandos.
==============================================================================
"""

import os
import sys
import re
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
MIGRATOR_SCRIPT = BASE_DIR / "migrate_to_cloud.py"


def print_banner():
    print("\n" + "=" * 65)
    print(" 🚀 KIPUSTOCK - ASISTENTE DE DESPLIEGUE A LA NUBE (COSTO $0)")
    print("=" * 65)
    print(" Este asistente te guiará para:")
    print("  1. Vincular y subir tu código a GitHub.")
    print("  2. Conectar tu base de datos gratuita (Supabase o Neon) y migrar datos.")
    print(" Si no deseas configurar un paso ahora, solo presiona [Enter] para omitirlo.")
    print("=" * 65 + "\n")


def clean_input(val: str) -> str:
    """Limpia comillas y espacios accidentales al pegar URLs."""
    if not val:
        return ""
    val = val.strip()
    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
        val = val[1:-1].strip()
    return val


def setup_github():
    print("📦 [PASO 1] VINCULACIÓN CON GITHUB")
    print("-" * 65)
    print("Ingresa la URL de tu repositorio de GitHub")
    print("Ejemplo: https://github.com/tu_usuario/Kipustock.git")
    repo_url = clean_input(input("\n👉 URL de GitHub (o presiona Enter para omitir): "))

    if not repo_url:
        print("⏩ Paso de GitHub omitido.\n")
        return

    try:
        # Verificar si el remoto 'origin' ya existe
        remotes = subprocess.run(
            ["git", "remote"],
            capture_output=True,
            text=True,
            check=True
        ).stdout.split()

        if "origin" in remotes:
            print("🔄 Actualizando remoto 'origin' existente...")
            subprocess.run(["git", "remote", "set-url", "origin", repo_url], check=True)
        else:
            print("🔗 Agregando remoto 'origin'...")
            subprocess.run(["git", "remote", "add", "origin", repo_url], check=True)

        print("⬆️ Subiendo código a la rama 'main' en GitHub...")
        push_res = subprocess.run(["git", "push", "-u", "origin", "main"])

        if push_res.returncode == 0:
            print("\n✅ ¡Código subido exitosamente a GitHub en la rama 'main'!\n")
        else:
            print("\n⚠️ Aviso al hacer push. Verifica tus credenciales o permisos de GitHub.\n")

    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error ejecutando comando de Git: {e}\n")
    except Exception as ex:
        print(f"\n❌ Error inesperado: {ex}\n")


def update_env_database_url(new_url: str):
    """Guarda o actualiza la variable DATABASE_URL en el archivo .env."""
    if not ENV_FILE.exists():
        content = f'DATABASE_URL="{new_url}"\n'
        with open(ENV_FILE, "w", encoding="utf-8") as f:
            f.write(content)
        return

    with open(ENV_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()

    updated = False
    new_lines = []
    for line in lines:
        # Reemplazar línea existente comentada o activa de DATABASE_URL
        if re.match(r'^\s*#?\s*DATABASE_URL\s*=', line):
            new_lines.append(f'DATABASE_URL="{new_url}"\n')
            updated = True
        else:
            new_lines.append(line)

    if not updated:
        new_lines.insert(0, f'DATABASE_URL="{new_url}"\n')

    with open(ENV_FILE, "w", encoding="utf-8") as f:
        writelines = "".join(new_lines)
        f.write(writelines)


def setup_database():
    print("☁️ [PASO 2] BASE DE DATOS EN LA NUBE (SUPABASE O NEON)")
    print("-" * 65)
    print("Ingresa tu Connection String URI de PostgreSQL ($0 en Supabase o Neon)")
    print("Ejemplo: postgresql://postgres:clave@db.xxx.supabase.co:5432/postgres")
    db_url = clean_input(input("\n👉 DATABASE_URL (o presiona Enter para omitir): "))

    if not db_url:
        print("⏩ Paso de base de datos en la nube omitido. Kipustock seguirá usando SQLite local.\n")
        return

    # Normalizar prefijo postgres:// a postgresql:// para SQLAlchemy
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    try:
        print("\n💾 Guardando DATABASE_URL en tu archivo .env local...")
        update_env_database_url(db_url)
        print("✅ Archivo .env actualizado.")

        if MIGRATOR_SCRIPT.exists():
            print("\n🔄 Iniciando migración de datos locales hacia la base de datos en la nube...")
            mig_res = subprocess.run([sys.executable, str(MIGRATOR_SCRIPT), "--url", db_url])
            if mig_res.returncode == 0:
                print("\n✅ ¡Todos tus datos locales fueron migrados exitosamente a la nube!\n")
            else:
                print("\n⚠️ La migración reportó un aviso. Verifica tu conexión a internet o credenciales.\n")
        else:
            print("⚠️ No se encontró migrate_to_cloud.py para ejecutar la migración automática.")

    except Exception as e:
        print(f"\n❌ Error configurando la base de datos: {e}\n")


def print_summary():
    print("=" * 65)
    print(" 🏁 CONFIGURACIÓN COMPLETADA")
    print("=" * 65)
    print(" Próximos pasos recomendados:")
    print("  1. Para desplegar en la nube las 24 horas a costo $0:")
    print("     • Ve a https://render.com -> New + -> Blueprint.")
    print("     • Selecciona tu repositorio de GitHub.")
    print("     • Render detectará 'render.yaml' y desplegará tu tienda automáticamente.")
    print("=" * 65 + "\n")


def main():
    print_banner()
    setup_github()
    setup_database()
    print_summary()


if __name__ == "__main__":
    main()
