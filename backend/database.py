import os
import logging
from pathlib import Path
from typing import Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger("kipustock.database")

# Directorios de datos, uploads y product_images generadas por IA
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
PRODUCT_IMAGES_DIR = DATA_DIR / "product_images"
BROWSER_PROFILE_DIR = DATA_DIR / "browser_profile"
QUOTES_DIR = DATA_DIR / "quotes"
BIN_DIR = DATA_DIR / "bin"

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
PRODUCT_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
BROWSER_PROFILE_DIR.mkdir(parents=True, exist_ok=True)
QUOTES_DIR.mkdir(parents=True, exist_ok=True)
BIN_DIR.mkdir(parents=True, exist_ok=True)

# Ruta de base de datos SQLite local predeterminada
DB_PATH = DATA_DIR / "sistema.db"
LOCAL_SQLITE_URL = f"sqlite:///{DB_PATH}"

# Detectar URL de base de datos desde entorno (PostgreSQL / Supabase / Neon / etc.)
raw_db_url = os.getenv("DATABASE_URL", "").strip()

# Normalizar prefijo postgres:// para compatibilidad con SQLAlchemy 2.0+
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

engine = None
SessionLocal = None
is_cloud_db = False
active_db_type = "sqlite"
db_status_cache = {}

def init_database_engine():
    global engine, SessionLocal, is_cloud_db, active_db_type, db_status_cache

    # 1. Intentar conectar a PostgreSQL en la nube si hay DATABASE_URL configurada
    if raw_db_url and (raw_db_url.startswith("postgresql://") or raw_db_url.startswith("postgres://")):
        try:
            logger.info("Detectada DATABASE_URL en la nube. Conectando con PostgreSQL (Supabase / Neon)...")
            cloud_engine = create_engine(
                raw_db_url,
                pool_pre_ping=True,      # Verifica que la conexión siga viva antes de usarla
                pool_recycle=300,        # Recicla conexiones cada 5 min para serverless
                pool_size=5,
                max_overflow=10
            )
            # Prueba de fuego de conectividad inmediata
            with cloud_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            engine = cloud_engine
            SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
            is_cloud_db = True
            active_db_type = "postgresql"
            logger.info("Conectado exitosamente a PostgreSQL en la nube ($0).")
            return
        except Exception as e_cloud:
            logger.warning(
                f"No se pudo conectar a la base de datos en la nube ({e_cloud}). "
                f"Activando automáticamente respaldo seguro en SQLite local: {DB_PATH}"
            )

    # 2. Respaldo o modo local: SQLite
    engine = create_engine(
        LOCAL_SQLITE_URL,
        connect_args={"check_same_thread": False}
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    is_cloud_db = False
    active_db_type = "sqlite"
    logger.info(f"Base de datos SQLite local activa: {DB_PATH}")

init_database_engine()

Base = declarative_base()

def get_db():
    """Generador de sesiones para inyección de dependencias en FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_db_status() -> Dict[str, Any]:
    """Retorna el estado de salud y tipo de conexión para el frontend y monitoreo."""
    global is_cloud_db, active_db_type
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            connected = True
    except Exception as e:
        connected = False

    masked_url = ""
    if is_cloud_db and raw_db_url:
        try:
            parts = raw_db_url.split("@")
            if len(parts) > 1:
                masked_url = f"postgresql://***:***@{parts[1]}"
            else:
                masked_url = "postgresql://cloud-db"
        except Exception:
            masked_url = "postgresql://cloud-db"
    else:
        masked_url = f"sqlite:///{DB_PATH.name}"

    return {
        "connected": connected,
        "mode": "cloud" if is_cloud_db else "local",
        "dialect": active_db_type,
        "is_cloud": is_cloud_db,
        "database_display": "PostgreSQL Nube (Supabase/Neon)" if is_cloud_db else "SQLite Local",
        "url_masked": masked_url
    }
