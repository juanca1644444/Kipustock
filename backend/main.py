import sys
import asyncio
if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        import uvicorn.loops.asyncio
        uvicorn.loops.asyncio.asyncio_loop_factory = lambda use_subprocess=False: asyncio.SelectorEventLoop
    except Exception:
        pass

from contextlib import asynccontextmanager
import os
import subprocess
import threading
import time
import shutil
import uuid
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from dotenv import load_dotenv

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("kipustock.backend")

# Cargar automáticamente variables de entorno desde .env
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from backend.database import (
    Base,
    engine,
    get_db,
    SessionLocal,
    UPLOADS_DIR,
    PRODUCT_IMAGES_DIR,
    BASE_DIR,
    QUOTES_DIR,
    get_db_status,
    is_cloud_db,
    active_db_type
)
from backend.models import (
    ProductoPropio,
    ItemLote,
    Venta,
    AlertaProducto,
    ConfiguracionTienda,
    PedidoWeb,
    ProductoCreate,
    ProductoUpdateStock,
    ProductoResponse,
    ItemLoteCreate,
    ItemLoteUpdate,
    ItemLoteResponse,
    ResumenFinancieroLote,
    BusquedaFiltros,
    GenerarImagenRequest,
    GenerarImagenResponse,
    VentaCreate,
    VentaResponse,
    VentasResumen,
    VentasListResponse,
    ConfirmarVentasLoteRequest,
    AlertaProductoCreate,
    AlertaProductoResponse,
    AlertaResultadoItem,
    ProductoTiendaPublico,
    ConfiguracionTiendaResponse,
    ConfiguracionTiendaUpdate,
    PedidoWebCreate,
    PedidoWebResponse,
    CampaignGenerateRequest,
    CampaignGenerateResponse,
    TiendaPersonalizada,
    TiendaPersonalizadaCreate,
    TiendaPersonalizadaUpdate,
    TiendaPersonalizadaResponse,
    Cliente,
    ClienteCreate,
    ClienteUpdate,
    ClienteResponse,
    TarifaEnvio,
    TarifaEnvioCreate,
    TarifaEnvioUpdate,
    TarifaEnvioResponse,
    QuoteItem,
    QuoteGenerateRequest,
    QuoteGenerateResponse,
    PublishOnDemandRequest,
    CompleteOrderCashOnDeliveryRequest,
    TunnelConfigRequest
)
from scraper.search_engine import SearchEngine
from backend.campaign_generator import run_full_campaign_generation, create_campaign_zip, CAMPAIGNS_DIR
from backend.pdf_generator import generate_quote_pdf
from backend.tunnel_manager import tunnel_manager

# Crear tablas en SQLite automáticamente y asegurar columnas nuevas
Base.metadata.create_all(bind=engine)

def run_db_migrations():
    """Migración transparente para añadir columnas si no existen, compatible con SQLite y PostgreSQL."""
    from sqlalchemy import text
    for col, col_type in [
        ("url_compra", "VARCHAR(500)"),
        ("proveedor", "VARCHAR(100) DEFAULT 'Inventario Propio'"),
        ("tiempo_entrega", "VARCHAR(100) DEFAULT 'Inmediata'"),
    ]:
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE productos_propios ADD COLUMN {col} {col_type}"))
        except Exception:
            pass
    for col, col_type in [
        ("url_compra", "VARCHAR(500)"),
        ("tiempo_entrega", "VARCHAR(100) DEFAULT '24 a 48 hrs'"),
    ]:
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE items_lote ADD COLUMN {col} {col_type}"))
        except Exception:
            pass

run_db_migrations()

def seed_demo_inventory(db: Session):
    """Inserta datos de demostración si la tabla está vacía para validar el flujo inmediatamente."""
    count = db.query(ProductoPropio).count()
    if count == 0:
        demo_items = [
            ProductoPropio(
                nombre="Taladro Percutor Inalámbrico 20V Brushless",
                modelo="TP-20V-PRO",
                sku="HERR-001",
                foto_url="/product_images/taladro_percutor.png",
                stock=14,
                costo_unitario=175.00,
                precio_venta=329.00,
                estado="Nuevo",
                notas="Adquirido en lote por liquidación ferretera."
            ),
            ProductoPropio(
                nombre="Audífonos Inalámbricos Bluetooth ANC",
                modelo="WH-1000XM-DEMO",
                sku="AUD-002",
                foto_url="/product_images/audifonos_anc.png",
                stock=8,
                costo_unitario=78.00,
                precio_venta=169.90,
                estado="Saldo",
                notas="Caja abierta / verificación de aduana intacta."
            ),
            ProductoPropio(
                nombre="Smartwatch Deportivo Resistente al Agua IP68",
                modelo="SW-FIT-8",
                sku="TECH-003",
                foto_url="/product_images/smartwatch_ip68.png",
                stock=22,
                costo_unitario=48.00,
                precio_venta=129.00,
                estado="Nuevo",
                notas="Importación directa lote previo."
            )
        ]
        db.add_all(demo_items)
        db.commit()

    # Si no hay ventas, registrar ventas de ejemplo para mostrar KPIs
    ventas_count = db.query(Venta).count()
    if ventas_count == 0:
        audifonos = db.query(ProductoPropio).filter(ProductoPropio.sku == "AUD-002").first()
        prod_id = audifonos.id if audifonos else None
        demo_sales = [
            Venta(
                producto_propio_id=prod_id,
                nombre_producto="Audífonos Inalámbricos Bluetooth ANC",
                cantidad_vendida=2,
                precio_venta_unitario=169.90,
                costo_unitario=78.00,
                comision_envio_monto=15.00,
                ganancia_neta_real=round((169.90 - 78.00) * 2 - 15.00, 2),  # 168.80
                canal_venta="WhatsApp",
                notas="Envío a Miraflores por motorizado Olva."
            ),
            Venta(
                producto_propio_id=None,
                nombre_producto="Funda Protectora Resistente Golpes",
                cantidad_vendida=3,
                precio_venta_unitario=35.00,
                costo_unitario=12.00,
                comision_envio_monto=0.0,
                ganancia_neta_real=round((35.00 - 12.00) * 3, 2),  # 69.00
                canal_venta="Marketplace",
                notas="Venta directa presencial en estación metropolitano."
            )
        ]
        db.add_all(demo_sales)
        db.commit()

    # Si no hay alertas de búsqueda configuradas, sembrar ejemplos útiles
    alertas_count = db.query(AlertaProducto).count()
    if alertas_count == 0:
        demo_alertas = [
            AlertaProducto(
                termino_busqueda="Taladro Percutor 20V",
                precio_maximo=220.0,
                margen_minimo_pct=25.0,
                tiendas_objetivo="Falabella,Ripley,Sodimac",
                activo=1
            ),
            AlertaProducto(
                termino_busqueda="Audífonos Bluetooth ANC",
                precio_maximo=120.0,
                margen_minimo_pct=30.0,
                tiendas_objetivo="Falabella,Ripley",
                activo=1
            )
        ]
        db.add_all(demo_alertas)
        db.commit()

    # Si no hay configuración de tienda web, sembrar la configuración predeterminada
    cfg = db.query(ConfiguracionTienda).first()
    if not cfg:
        cfg = ConfiguracionTienda(
            nombre_tienda="KipuStock Store",
            whatsapp_ventas="51944830586",
            mensaje_bienvenida="¡Bienvenido a KipuStock Store! Productos de alta rotación con entrega inmediata y garantía.",
            instrucciones_pago="Realiza tu pago vía Yape o Plin al número oficial (51944830586) y envía la constancia por WhatsApp para validar y despachar tu pedido de inmediato."
        )
        db.add(cfg)
        db.commit()

    # Si no hay tarifas de envío configuradas, sembrar las opciones estándar de Perú
    rates_count = db.query(TarifaEnvio).count()
    if rates_count == 0:
        default_rates = [
            TarifaEnvio(
                nombre="Lima Metropolitana (Motorizado / Courier local)",
                tipo="Local",
                costo=10.0,
                tiempo_entrega="Mismo día o 24 hrs",
                activo=1,
                notas="Para envíos directos dentro de Lima Urbana."
            ),
            TarifaEnvio(
                nombre="Lima Periferia / Huarochirí / Chosica",
                tipo="Periferia",
                costo=12.0,
                tiempo_entrega="24 a 48 hrs",
                activo=1,
                notas="Zonas alejadas y conos de Lima Metropolitana."
            ),
            TarifaEnvio(
                nombre="Provincias - Agencia Shalom (Recojo en agencia)",
                tipo="Provincia Shalom",
                costo=15.0,
                tiempo_entrega="24 a 72 hrs",
                activo=1,
                notas="Despacho con pago/recojo en agencia Shalom a nivel nacional."
            ),
            TarifaEnvio(
                nombre="Provincias - Olva Courier (Domicilio)",
                tipo="Provincia Olva",
                costo=22.0,
                tiempo_entrega="48 a 72 hrs",
                activo=1,
                notas="Entrega certificada a la puerta del cliente en provincias."
            ),
            TarifaEnvio(
                nombre="Recojo en Tienda / Punto de entrega",
                tipo="Punto de entrega",
                costo=0.0,
                tiempo_entrega="Inmediato / Coordinar",
                activo=1,
                notas="Recojo personal sin costo de envío."
            )
        ]
        db.add_all(default_rates)
        db.commit()

    # Sembrar clientes demo iniciales si no existen
    clients_count = db.query(Cliente).count()
    if clients_count == 0:
        demo_clients = [
            Cliente(
                nombre="Juan Pérez Castillo",
                telefono_whatsapp="51987654321",
                distrito_ciudad="Miraflores, Lima",
                direccion="Av. Larco 456, Dpto 302",
                notas="Cliente recurrente de herramientas y tecnología.",
                total_compras=658.00,
                fecha_registro=datetime.utcnow(),
                ultima_compra=datetime.utcnow()
            ),
            Cliente(
                nombre="María Elena Gómez",
                telefono_whatsapp="51976543210",
                distrito_ciudad="Arequipa",
                direccion="Calle Mercaderes 210, Yanahuara",
                notas="Envío preferido por Shalom con pago contraentrega.",
                total_compras=329.00,
                fecha_registro=datetime.utcnow(),
                ultima_compra=datetime.utcnow()
            ),
            Cliente(
                nombre="Carlos Alberto Mendoza",
                telefono_whatsapp="51965432109",
                distrito_ciudad="Los Olivos, Lima",
                direccion="Av. Antúnez de Mayolo 1240",
                notas="Interesado en audífonos y smartwatches.",
                total_compras=298.90,
                fecha_registro=datetime.utcnow(),
                ultima_compra=datetime.utcnow()
            )
        ]
        db.add_all(demo_clients)
        db.commit()


def upsert_cliente_from_transaction(
    db: Session,
    nombre: Optional[str] = None,
    telefono: Optional[str] = None,
    distrito: Optional[str] = None,
    direccion: Optional[str] = None,
    monto_compra: float = 0.0,
    notas: Optional[str] = None
) -> Optional[Cliente]:
    """
    Busca o crea automáticamente la ficha del cliente en el CRM sin duplicar por teléfono o nombre.
    Acumula el monto de compras y actualiza la última fecha de transacción.
    """
    tel_clean = telefono.strip() if telefono else None
    nom_clean = nombre.strip() if nombre else None

    if not tel_clean and not nom_clean:
        return None

    cliente = None
    if tel_clean:
        cliente = db.query(Cliente).filter(Cliente.telefono_whatsapp == tel_clean).first()
    if not cliente and nom_clean:
        cliente = db.query(Cliente).filter(Cliente.nombre == nom_clean).first()

    now = datetime.utcnow()
    if cliente:
        if nom_clean and (not cliente.nombre or cliente.nombre == "Cliente General"):
            cliente.nombre = nom_clean
        if tel_clean and not cliente.telefono_whatsapp:
            cliente.telefono_whatsapp = tel_clean
        if distrito and not cliente.distrito_ciudad:
            cliente.distrito_ciudad = distrito.strip()
        if direccion and not cliente.direccion:
            cliente.direccion = direccion.strip()
        if monto_compra > 0:
            cliente.total_compras = round(float(cliente.total_compras or 0.0) + monto_compra, 2)
            cliente.ultima_compra = now
        if notas and not cliente.notas:
            cliente.notas = notas.strip()
    else:
        cliente = Cliente(
            nombre=nom_clean or "Cliente General",
            telefono_whatsapp=tel_clean,
            distrito_ciudad=distrito.strip() if distrito else None,
            direccion=direccion.strip() if direccion else None,
            notas=notas.strip() if notas else None,
            total_compras=round(monto_compra, 2) if monto_compra > 0 else 0.0,
            fecha_registro=now,
            ultima_compra=now if monto_compra > 0 else None
        )
        db.add(cliente)

    try:
        db.commit()
        db.refresh(cliente)
        return cliente
    except Exception as e:
        db.rollback()
        logger.warning(f"Error upserting cliente: {e}")
        return None

# Ejecutar seed inicial seguro
try:
    with SessionLocal() as init_session:
        seed_demo_inventory(init_session)
except Exception as e_seed:
    logger.debug(f"Aviso seed inicial: {e_seed}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicialización de inventario demo en SQLite
    db = next(get_db())
    try:
        seed_demo_inventory(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title="Kipustock - Sistema de Arbitraje Comercial & Inventario",
    version="1.0.0",
    description="Backend modular para arbitraje, control de mercadería propia y lotes de compra",
    lifespan=lifespan
)

# Configurar CORS para permitir flexibilidad en desarrollo local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Asegurar existencia de carpetas de medios y estáticos
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
PRODUCT_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
QUOTES_DIR.mkdir(parents=True, exist_ok=True)

# Rutas de carpetas frontend y uploads
FRONTEND_DIR = BASE_DIR / "frontend"

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/product_images", StaticFiles(directory=str(PRODUCT_IMAGES_DIR)), name="product_images")
app.mount("/quotes", StaticFiles(directory=str(QUOTES_DIR)), name="quotes")
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
def serve_index():
    """Sirve la interfaz web principal."""
    index_file = FRONTEND_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="index.html no encontrado")
    return FileResponse(
        str(index_file),
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
    )


@app.get("/catalogo")
def serve_catalogo():
    """Sirve la vista pública del catálogo de productos para clientes."""
    cat_file = FRONTEND_DIR / "catalogo.html"
    if not cat_file.exists():
        raise HTTPException(status_code=404, detail="catalogo.html no encontrado")
    return FileResponse(
        str(cat_file),
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
    )


@app.get("/api/catalogo", response_model=List[ProductoResponse])
def get_public_catalog(db: Session = Depends(get_db)):
    """
    Retorna el catálogo público de mercadería propia con stock disponible (> 0)
    o productos publicados bajo pedido / por encargo para contraentrega.
    """
    productos = db.query(ProductoPropio).filter(
        (ProductoPropio.stock > 0) | (ProductoPropio.estado.in_(["Bajo Pedido", "Por Encargo"]))
    ).order_by(ProductoPropio.nombre.asc()).all()
    return productos


# ==========================================
# ENDPOINTS: CONFIGURACIÓN Y ESTADO IA
# ==========================================

@app.get("/api/system/db-status")
def get_db_status_endpoint():
    """Retorna el estado de conexión de la base de datos (Cloud Postgres vs Local SQLite)."""
    return get_db_status()


@app.get("/api/config/status")
def get_config_status():
    """Verifica si la API Key de Gemini, la base de datos y el entorno están listos."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    has_gemini = bool(api_key and api_key != "tu_api_key_gratuita_de_google_ai_studio")
    default_comm = float(os.getenv("DEFAULT_COMMISSION_PERCENT", "12.0"))
    db_stat = get_db_status()
    return {
        "gemini_configured": has_gemini,
        "gemini_model": "gemini-3.8-flash",
        "default_commission": default_comm,
        "playwright_ready": True,
        "version": "2.5.0",
        "modo": "Gemini 3.8 Flash Online" if has_gemini else "Modo Fallback Heurístico Local",
        "db_status": db_stat
    }


# ==========================================
# ENDPOINTS: RECONOCIMIENTO VISUAL IA (GEMINI VISION)
# ==========================================

@app.post("/api/vision/analyze")
async def analyze_vision_endpoint(
    file: Optional[UploadFile] = File(None),
    filename: Optional[str] = Form(None)
):
    """
    Analiza una imagen o documento PDF con Gemini Vision (o fallback seguro).
    Soporta fotos de productos, capturas de pantalla y archivos PDF de artículos (fichas técnicas, facturas).
    """
    from scraper.vision_ai import analyze_product_image

    if file:
        file_extension = Path(file.filename).suffix.lower() or ".jpg"
        unique_filename = f"{uuid.uuid4().hex}{file_extension}"
        target_path = UPLOADS_DIR / unique_filename

        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Soporte para documentos PDF de artículos (convierte página a imagen para Gemini Vision)
        if file_extension == ".pdf":
            image_filename = f"{Path(unique_filename).stem}.png"
            image_target = UPLOADS_DIR / image_filename
            pdf_text = ""
            try:
                import fitz
                doc = fitz.open(str(target_path))
                if len(doc) > 0:
                    page = doc[0]
                    pix = page.get_pixmap(dpi=150)
                    pix.save(str(image_target))
                    pdf_text = page.get_text().strip()[:2000]
            except Exception as e_pdf:
                logger.warning(f"Error procesando PDF en vision analyze: {e_pdf}")

            if image_target.exists():
                analysis = analyze_product_image(str(image_target), original_filename=file.filename, text_context=pdf_text)
                analysis["url"] = f"/uploads/{image_filename}"
                analysis["filename"] = image_filename
                analysis["document_type"] = "pdf"
                return analysis

        analysis = analyze_product_image(str(target_path), original_filename=file.filename)
        analysis["url"] = f"/uploads/{unique_filename}"
        analysis["filename"] = unique_filename
        return analysis

    elif filename:
        target_path = UPLOADS_DIR / filename
        if not target_path.exists():
            raise HTTPException(status_code=404, detail=f"Imagen {filename} no encontrada en uploads")

        analysis = analyze_product_image(str(target_path), original_filename=filename)
        analysis["url"] = f"/uploads/{filename}"
        analysis["filename"] = filename
        return analysis

    raise HTTPException(status_code=400, detail="Debe adjuntar un archivo de imagen o especificar 'filename'")


# ==========================================
# ENDPOINTS: GENERACIÓN DE IMÁGENES Y COPY IA
# ==========================================

@app.post("/api/images/generate", response_model=GenerarImagenResponse)
def generate_image_endpoint(payload: GenerarImagenRequest, db: Session = Depends(get_db)):
    """
    Genera una imagen publicitaria de producto (estudio, lifestyle o marketing)
    y opcionalmente redacta copy persuasivo para redes sociales con Gemini 2.5 Flash.
    Si se proporciona 'producto_propio_id', actualiza automáticamente su foto_url en SQLite.
    """
    from backend.image_generator import generate_product_image, generate_marketing_copy

    nombre = payload.nombre_producto.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre del producto es requerido.")

    # 1. Generar imagen
    image_result = generate_product_image(
        nombre_producto=nombre,
        descripcion=payload.descripcion,
        estilo=payload.estilo
    )

    # 2. Generar copy si fue solicitado
    copy_text = None
    if payload.generar_copy:
        copy_text = generate_marketing_copy(
            nombre_producto=nombre,
            descripcion=payload.descripcion,
            estilo=payload.estilo
        )

    # 3. Si se vinculó a un producto propio existente, actualizar foto_url en la BD
    actualizado = False
    if payload.producto_propio_id:
        producto = db.query(ProductoPropio).filter(ProductoPropio.id == payload.producto_propio_id).first()
        if producto:
            producto.foto_url = image_result["url"]
            db.commit()
            db.refresh(producto)
            actualizado = True

    return GenerarImagenResponse(
        status=image_result.get("status", "success"),
        url=image_result["url"],
        filename=image_result["filename"],
        estilo=image_result["estilo"],
        copy_redes=copy_text,
        mensaje=image_result.get("mensaje", "Imagen procesada exitosamente."),
        producto_propio_actualizado=actualizado
    )


# ==========================================
# ENDPOINTS: SUBIDA DE IMÁGENES
# ==========================================

@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    """Sube una imagen al servidor y devuelve su URL estática."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo subido debe ser una imagen válida.")

    file_extension = Path(file.filename).suffix or ".jpg"
    unique_filename = f"{uuid.uuid4().hex}{file_extension}"
    target_path = UPLOADS_DIR / unique_filename

    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"url": f"/uploads/{unique_filename}", "filename": unique_filename}


# ==========================================
# ENDPOINTS: MERCADERÍA PROPIA (INVENTARIO)
# ==========================================

@app.get("/api/inventory", response_model=List[ProductoResponse])
def get_inventory(db: Session = Depends(get_db)):
    """Obtiene el listado completo de productos en mercadería propia."""
    productos = db.query(ProductoPropio).order_by(ProductoPropio.fecha_creacion.desc()).all()
    return productos


@app.post("/api/inventory", response_model=ProductoResponse, status_code=status.HTTP_201_CREATED)
def create_product(producto: ProductoCreate, db: Session = Depends(get_db)):
    """Registra un nuevo producto propio en inventario."""
    db_producto = ProductoPropio(
        nombre=producto.nombre,
        modelo=producto.modelo,
        sku=producto.sku,
        foto_url=producto.foto_url,
        stock=producto.stock,
        costo_unitario=producto.costo_unitario,
        precio_venta=producto.precio_venta,
        estado=producto.estado,
        notas=producto.notas
    )
    db.add(db_producto)
    db.commit()
    db.refresh(db_producto)
    return db_producto


@app.put("/api/inventory/{product_id}/stock", response_model=ProductoResponse)
def update_product_stock(product_id: int, payload: ProductoUpdateStock, db: Session = Depends(get_db)):
    """Modifica el stock disponible de un producto propio."""
    producto = db.query(ProductoPropio).filter(ProductoPropio.id == product_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    producto.stock = payload.stock
    db.commit()
    db.refresh(producto)
    return producto


@app.delete("/api/inventory/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """Elimina un producto del inventario propio."""
    producto = db.query(ProductoPropio).filter(ProductoPropio.id == product_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    db.delete(producto)
    db.commit()
    return {"message": "Producto eliminado exitosamente", "id": product_id}


# ==========================================
# ENDPOINTS: BUSCADOR DE ARBITRAJE
# ==========================================

@app.post("/api/search")
async def search_merchandise(filtros: BusquedaFiltros, db: Session = Depends(get_db)):
    """
    Ejecuta el rastreo de mercaderías con scraping concurrente Playwright,
    filtros cruzados, margen neto descontando comisiones y análisis por lotes con Gemini.
    """
    try:
        engine_scraper = SearchEngine(db=db)
        resultados = await engine_scraper.search_async(
            query=filtros.query,
            target_sites=filtros.target_sites,
            max_price=filtros.max_price,
            min_margin_percent=filtros.min_margin_percent,
            commission_percent=filtros.commission_percent,
            image_filename=filtros.image_filename
        )
        if isinstance(resultados, dict):
            return resultados
        return {
            "query": filtros.query or "",
            "query_usada": filtros.query or "",
            "total_resultados": 0,
            "resultados": [],
            "estado_tiendas": [],
            "tiendas_estado": [],
            "ai_status": "error",
            "ai_message": "Respuesta no estructurada del motor de búsqueda.",
            "error_detail": "Formato de respuesta inesperado",
            "alerta_inventario": None
        }
    except Exception as e:
        logger.error(f"Error procesando /api/search: {e}", exc_info=True)
        return {
            "query": filtros.query or "",
            "query_usada": filtros.query or "",
            "total_resultados": 0,
            "resultados": [],
            "estado_tiendas": [
                {"tienda": s, "items_encontrados": 0, "status": "error", "mensaje": f"Error: {str(e)}"}
                for s in (filtros.target_sites or ["Mercado Libre", "Temu", "Falabella"])
            ],
            "tiendas_estado": [],
            "ai_status": "error",
            "ai_message": f"Aviso al consultar portales: {str(e)}",
            "error_detail": str(e),
            "alerta_inventario": None
        }


@app.post("/api/unlock")
@app.post("/api/browser-session/unlock")
async def unlock_store_browser_session(
    tienda: str = "Temu",
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    """
    Lanza la ventana visible de Chromium/Chrome para resolver captchas o iniciar sesión.
    Invalida el caché de la tienda seleccionada y verifica si el lanzamiento fue exitoso
    o si ocurrió un fallo al iniciar, devolviendo el detalle real del error al frontend.
    """
    try:
        tienda_clean = (tienda or "Temu").strip()
        logger.info(f"[DESBLOQUEO] Solicitud para tienda: '{tienda_clean}'")

        # 1. Limpiar caché previo de esta tienda para que la próxima búsqueda consulte en vivo
        try:
            from scraper.search_engine import search_cache
            search_cache.invalidate_store(tienda_clean)
        except Exception as e_c:
            logger.debug(f"Aviso invalidando caché de {tienda_clean}: {e_c}")

        # 2. Rutas y preparación de archivos
        script_path = os.path.abspath(str(BASE_DIR / "scraper" / "unlock_browser.py"))
        profile_path = os.path.abspath(str(BASE_DIR / "data" / "browser_profile"))
        status_file = BASE_DIR / "data" / "unlock_status.json"
        console_log_path = BASE_DIR / "data" / "unlock_console.log"

        # Eliminar archivo de estado previo
        try:
            if status_file.exists():
                status_file.unlink(missing_ok=True)
        except Exception:
            pass

        # Registrar la solicitud en unlock_console.log
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        try:
            with open(console_log_path, "a", encoding="utf-8") as cf:
                cf.write(f"\n{'='*60}\n[{timestamp}] [API /unlock] Solicitud interactiva recibida para: '{tienda_clean}'\n{'='*60}\n")
                cf.flush()
        except Exception:
            pass

        # 3. Lanzar unlock_browser.py como proceso desvinculado independiente en Windows
        # (DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP) para que abra en el escritorio interactivo
        # sin heredar restricciones de la consola del servidor Uvicorn ni morir con el endpoint.
        creation_flags = 0
        if sys.platform == "win32":
            creation_flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP

        cmd = [
            sys.executable,
            script_path,
            tienda_clean,
            "--profile-dir",
            profile_path
        ]
        logger.info(f"[DESBLOQUEO] Lanzando subproceso desvinculado: {' '.join(cmd)}")

        console_log_file = open(console_log_path, "a", encoding="utf-8")
        proc = subprocess.Popen(
            cmd,
            stdout=console_log_file,
            stderr=console_log_file,
            creationflags=creation_flags,
            cwd=str(BASE_DIR)
        )

        # 4. Esperar confirmación de arranque (hasta 6s) para verificar que el navegador abrió
        launch_error = None
        started_ok = False
        start_wait = time.time()

        while time.time() - start_wait < 6.0:
            # Comprobar si el script confirmó arranque exitoso en unlock_status.json
            if status_file.exists():
                try:
                    with open(status_file, "r", encoding="utf-8") as sf:
                        st_data = json.load(sf)
                    if st_data.get("status") == "running":
                        started_ok = True
                        break
                    elif st_data.get("status") == "error":
                        launch_error = st_data.get("error", "Error al iniciar navegador")
                        break
                except Exception:
                    pass

            # Si el proceso terminó prematuramente
            if proc.poll() is not None:
                err_text = None
                try:
                    if status_file.exists():
                        with open(status_file, "r", encoding="utf-8") as sf:
                            st_data = json.load(sf)
                            if st_data.get("status") == "error":
                                err_text = st_data.get("error")

                    if not err_text and console_log_path.exists():
                        with open(console_log_path, "r", encoding="utf-8", errors="ignore") as cf:
                            lines = [l.strip() for l in cf.readlines() if l.strip()]
                        # Buscar específicamente errores reales, NUNCA líneas informativas o de limpieza
                        for l in reversed(lines):
                            l_lower = l.lower()
                            if any(k in l_lower for k in ["error", "traceback", "exception", "falló", "failed"]):
                                if "[limpieza]" not in l_lower and "huérfano" not in l_lower:
                                    err_text = l
                                    break
                except Exception:
                    pass

                launch_error = err_text or f"El navegador se cerró inesperadamente (código {proc.returncode})"
                break

            await asyncio.sleep(0.2)

        if launch_error:
            err_msg = f"No se pudo abrir la ventana para {tienda_clean}: {launch_error}"
            logger.error(f"[DESBLOQUEO ERROR] {err_msg}")
            return JSONResponse(
                status_code=500,
                content={
                    "ok": False,
                    "status": "error",
                    "tienda": tienda_clean,
                    "error": launch_error,
                    "mensaje": err_msg
                }
            )

        mensaje_ok = f"Ventana de desbloqueo para {tienda_clean} abierta en pantalla. Inicia sesión o resuelve el captcha y ciérrala al terminar."
        logger.info(f"[DESBLOQUEO OK] {mensaje_ok}")
        return JSONResponse(
            status_code=200,
            content={
                "ok": True,
                "status": "ok",
                "tienda": tienda_clean,
                "mensaje": mensaje_ok
            }
        )
    except Exception as e:
        err_msg = f"Error al procesar solicitud de desbloqueo para {tienda}: {str(e)}"
        logger.error(err_msg, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": str(e),
                "status": "error",
                "mensaje": err_msg
            }
        )


# ==========================================
# ENDPOINTS: TIENDAS Y PROVEEDORES PERSONALIZADOS
# ==========================================

@app.get("/api/custom-stores", response_model=List[TiendaPersonalizadaResponse])
def get_custom_stores(db: Session = Depends(get_db)):
    """Lista todas las tiendas o proveedores personalizados registrados."""
    return db.query(TiendaPersonalizada).order_by(TiendaPersonalizada.id.desc()).all()


@app.post("/api/custom-stores", response_model=TiendaPersonalizadaResponse)
def create_custom_store(store_in: TiendaPersonalizadaCreate, db: Session = Depends(get_db)):
    """Registra una nueva tienda web o proveedor personalizado."""
    url_web = store_in.url_web.strip()
    if not url_web.startswith("http://") and not url_web.startswith("https://"):
        url_web = f"https://{url_web}"

    url_busqueda = store_in.url_busqueda.strip() if store_in.url_busqueda else None
    if url_busqueda and not url_busqueda.startswith("http://") and not url_busqueda.startswith("https://"):
        url_busqueda = f"https://{url_busqueda}"

    db_store = TiendaPersonalizada(
        nombre=store_in.nombre.strip(),
        url_web=url_web,
        url_busqueda=url_busqueda,
        categoria=store_in.categoria.strip() if store_in.categoria else "General",
        contacto_whatsapp=store_in.contacto_whatsapp.strip() if store_in.contacto_whatsapp else None,
        comision_estimada=store_in.comision_estimada,
        activo=1 if store_in.activo else 0,
        notas=store_in.notas.strip() if store_in.notas else None,
        fecha_registro=datetime.utcnow()
    )
    db.add(db_store)
    db.commit()
    db.refresh(db_store)
    return db_store


@app.put("/api/custom-stores/{store_id}", response_model=TiendaPersonalizadaResponse)
def update_custom_store(store_id: int, store_update: TiendaPersonalizadaUpdate, db: Session = Depends(get_db)):
    """Actualiza una tienda personalizada registrada."""
    db_store = db.query(TiendaPersonalizada).filter(TiendaPersonalizada.id == store_id).first()
    if not db_store:
        raise HTTPException(status_code=404, detail="Tienda personalizada no encontrada")

    if store_update.nombre is not None:
        db_store.nombre = store_update.nombre.strip()
    if store_update.url_web is not None:
        u = store_update.url_web.strip()
        if not u.startswith("http://") and not u.startswith("https://"):
            u = f"https://{u}"
        db_store.url_web = u
    if store_update.url_busqueda is not None:
        ub = store_update.url_busqueda.strip() if store_update.url_busqueda else None
        if ub and not ub.startswith("http://") and not ub.startswith("https://"):
            ub = f"https://{ub}"
        db_store.url_busqueda = ub
    if store_update.categoria is not None:
        db_store.categoria = store_update.categoria.strip()
    if store_update.contacto_whatsapp is not None:
        db_store.contacto_whatsapp = store_update.contacto_whatsapp.strip() if store_update.contacto_whatsapp else None
    if store_update.comision_estimada is not None:
        db_store.comision_estimada = store_update.comision_estimada
    if store_update.activo is not None:
        db_store.activo = 1 if store_update.activo else 0
    if store_update.notas is not None:
        db_store.notas = store_update.notas.strip() if store_update.notas else None

    db.commit()
    db.refresh(db_store)
    return db_store


@app.delete("/api/custom-stores/{store_id}")
def delete_custom_store(store_id: int, db: Session = Depends(get_db)):
    """Elimina una tienda personalizada registrada."""
    db_store = db.query(TiendaPersonalizada).filter(TiendaPersonalizada.id == store_id).first()
    if not db_store:
        raise HTTPException(status_code=404, detail="Tienda personalizada no encontrada")
    nombre = db_store.nombre
    db.delete(db_store)
    db.commit()
    return {"status": "ok", "message": f"Tienda '{nombre}' eliminada con éxito."}


# ==========================================
# ENDPOINTS: LISTA SUMATORIA (LOTE DE OPERACIÓN)
# ==========================================

def calcular_resumen_lote(items: List[ItemLote]) -> ResumenFinancieroLote:
    """Calcula las métricas financieras clave del lote de operación en tiempo real."""
    inversion_nueva = 0.0
    stock_propio_valor = 0.0
    ingreso_bruto = 0.0
    total_unidades = 0

    for item in items:
        unidades = item.cantidad
        total_unidades += unidades
        ingreso_bruto += (item.precio_venta * unidades)

        if item.origen.upper() == "EXTERNO":
            inversion_nueva += (item.costo_compra * unidades)
        else:
            stock_propio_valor += (item.costo_compra * unidades)

    costo_total_operacion = inversion_nueva + stock_propio_valor
    ganancia_neta = ingreso_bruto - costo_total_operacion
    margen_promedio = round((ganancia_neta / costo_total_operacion) * 100, 1) if costo_total_operacion > 0 else 0.0

    return ResumenFinancieroLote(
        inversion_nueva=round(inversion_nueva, 2),
        stock_propio_valor=round(stock_propio_valor, 2),
        ingreso_bruto_proyectado=round(ingreso_bruto, 2),
        ganancia_neta_total=round(ganancia_neta, 2),
        margen_promedio_porcentaje=margen_promedio,
        total_unidades=total_unidades,
        total_items=len(items)
    )


@app.get("/api/lot")
def get_lot(db: Session = Depends(get_db)):
    """Devuelve los ítems en el lote activo y el balance financiero consolidado."""
    items = db.query(ItemLote).order_by(ItemLote.id.asc()).all()
    resumen = calcular_resumen_lote(items)
    return {
        "items": [ItemLoteResponse.from_orm(it) for it in items],
        "resumen": resumen
    }


@app.post("/api/lot", response_model=ItemLoteResponse, status_code=status.HTTP_201_CREATED)
def add_to_lot(item_data: ItemLoteCreate, db: Session = Depends(get_db)):
    """Agrega un producto (externo o propio) a la lista sumatoria."""
    # Si ya existe el mismo ítem (por nombre y origen), incrementa la cantidad
    existente = db.query(ItemLote).filter(
        ItemLote.nombre == item_data.nombre,
        ItemLote.origen == item_data.origen,
        ItemLote.tienda == item_data.tienda
    ).first()

    if existente:
        existente.cantidad += item_data.cantidad
        db.commit()
        db.refresh(existente)
        return existente

    nuevo_item = ItemLote(
        origen=item_data.origen.upper(),
        referencia_id=item_data.referencia_id,
        nombre=item_data.nombre,
        tienda=item_data.tienda,
        foto_url=item_data.foto_url,
        cantidad=item_data.cantidad,
        costo_compra=item_data.costo_compra,
        precio_venta=item_data.precio_venta,
        notas=item_data.notas
    )
    db.add(nuevo_item)
    db.commit()
    db.refresh(nuevo_item)
    return nuevo_item


@app.put("/api/lot/{item_id}", response_model=ItemLoteResponse)
def update_lot_item_quantity(item_id: int, payload: ItemLoteUpdate, db: Session = Depends(get_db)):
    """Actualiza la cantidad de unidades de un ítem en el lote."""
    item = db.query(ItemLote).filter(ItemLote.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem del lote no encontrado")

    item.cantidad = payload.cantidad
    db.commit()
    db.refresh(item)
    return item


@app.delete("/api/lot/{item_id}")
def remove_lot_item(item_id: int, db: Session = Depends(get_db)):
    """Elimina un ítem específico del lote de operación."""
    item = db.query(ItemLote).filter(ItemLote.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado en el lote")

    db.delete(item)
    db.commit()
    return {"message": "Ítem eliminado del lote", "id": item_id}


@app.delete("/api/lot")
def clear_lot(db: Session = Depends(get_db)):
    """Limpia todos los ítems del lote de operación."""
    db.query(ItemLote).delete()
    db.commit()
    return {"message": "Lote vaciado completamente"}


# ==========================================
# ENDPOINTS: REGISTRO DE VENTAS & CONTROL DE STOCK
# ==========================================

@app.post("/api/sales", response_model=VentaResponse, status_code=status.HTTP_201_CREATED)
def create_sale(payload: VentaCreate, db: Session = Depends(get_db)):
    """
    Registra una venta y descuenta automáticamente el stock en SQLite si pertenece a mercadería propia.
    Calcula la ganancia neta real descontando costo de compra y comisiones/envíos.
    """
    producto = None
    if payload.producto_propio_id:
        producto = db.query(ProductoPropio).filter(ProductoPropio.id == payload.producto_propio_id).first()
        if not producto:
            raise HTTPException(
                status_code=404,
                detail=f"Producto con ID {payload.producto_propio_id} no encontrado en Mercadería Propia."
            )

        if producto.stock < payload.cantidad_vendida:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para '{producto.nombre}'. Stock disponible en almacén: {producto.stock}, unidades solicitadas: {payload.cantidad_vendida}."
            )

        # Descontar stock automáticamente
        producto.stock -= payload.cantidad_vendida

    # Si se seleccionó tarifa de envío y comision_envio_monto viene en 0, tomar costo de tarifa
    comision_envio = round(payload.comision_envio_monto, 2)
    if payload.tarifa_envio_id and comision_envio == 0:
        tarifa_db = db.query(TarifaEnvio).filter(TarifaEnvio.id == payload.tarifa_envio_id).first()
        if tarifa_db:
            comision_envio = round(tarifa_db.costo, 2)

    # Cálculo estricto de ganancia neta real
    costo_total = round(payload.costo_unitario * payload.cantidad_vendida, 2)
    ingreso_bruto = round(payload.precio_venta_unitario * payload.cantidad_vendida, 2)
    ganancia_neta_real = round(ingreso_bruto - costo_total - comision_envio, 2)

    nueva_venta = Venta(
        producto_propio_id=payload.producto_propio_id,
        nombre_producto=payload.nombre_producto.strip(),
        cantidad_vendida=payload.cantidad_vendida,
        precio_venta_unitario=round(payload.precio_venta_unitario, 2),
        costo_unitario=round(payload.costo_unitario, 2),
        comision_envio_monto=comision_envio,
        ganancia_neta_real=ganancia_neta_real,
        canal_venta=payload.canal_venta or "Venta Directa",
        telefono_cliente=payload.telefono_cliente.strip() if payload.telefono_cliente else None,
        notas=payload.notas.strip() if payload.notas else None
    )

    db.add(nueva_venta)
    db.commit()
    db.refresh(nueva_venta)

    # Sincronizar automáticamente ficha del cliente en el CRM
    upsert_cliente_from_transaction(
        db=db,
        nombre=payload.cliente_nombre or (f"Cliente {payload.telefono_cliente}" if payload.telefono_cliente else "Cliente Venta Directa"),
        telefono=payload.telefono_cliente,
        distrito=payload.distrito_cliente,
        monto_compra=ingreso_bruto,
        notas=f"Venta: {payload.nombre_producto} (x{payload.cantidad_vendida})"
    )

    if producto:
        db.refresh(producto)

    return nueva_venta


@app.get("/api/sales", response_model=VentasListResponse)
def get_sales(db: Session = Depends(get_db)):
    """
    Lista las ventas registradas en orden cronológico inverso y retorna un consolidado
    financiero con totales de ingresos, costos, comisiones, ganancia neta y operaciones.
    """
    ventas = db.query(Venta).order_by(Venta.fecha_venta.desc(), Venta.id.desc()).all()

    total_ingresos = sum(v.precio_venta_unitario * v.cantidad_vendida for v in ventas)
    total_costos = sum(v.costo_unitario * v.cantidad_vendida for v in ventas)
    total_comisiones = sum(v.comision_envio_monto for v in ventas)
    ganancia_acumulada = sum(v.ganancia_neta_real for v in ventas)
    total_unidades = sum(v.cantidad_vendida for v in ventas)
    total_ops = len(ventas)
    margen_promedio = round((ganancia_acumulada / total_costos) * 100, 1) if total_costos > 0 else 0.0

    resumen = VentasResumen(
        total_ventas_monto=round(total_ingresos, 2),
        total_costos_monto=round(total_costos, 2),
        total_comisiones_envio=round(total_comisiones, 2),
        ganancia_neta_acumulada=round(ganancia_acumulada, 2),
        total_unidades_vendidas=total_unidades,
        total_operaciones=total_ops,
        margen_promedio_porcentaje=margen_promedio
    )

    return {
        "ventas": ventas,
        "resumen": resumen
    }


@app.post("/api/sales/from-lot/{item_id}", response_model=VentaResponse, status_code=status.HTTP_201_CREATED)
def convert_lot_item_to_sale(
    item_id: int,
    canal_venta: str = "Venta Directa",
    comision_monto: float = 0.0,
    db: Session = Depends(get_db)
):
    """
    Convierte o registra una venta directa a partir de un ítem existente en el lote sumatorio.
    Si el ítem está vinculado a mercadería propia, descuenta su stock.
    Luego remueve el ítem del lote.
    """
    item = db.query(ItemLote).filter(ItemLote.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem del lote no encontrado")

    producto_propio_id = item.referencia_id if item.origen.upper() == "PROPIO" else None
    producto = None
    if producto_propio_id:
        producto = db.query(ProductoPropio).filter(ProductoPropio.id == producto_propio_id).first()
        if producto:
            if producto.stock < item.cantidad:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente en almacén para '{producto.nombre}'. Stock disponible: {producto.stock}, unidades en lote: {item.cantidad}."
                )
            producto.stock -= item.cantidad

    costo_total = round(item.costo_compra * item.cantidad, 2)
    ingreso_bruto = round(item.precio_venta * item.cantidad, 2)
    ganancia_neta = round(ingreso_bruto - costo_total - comision_monto, 2)

    venta = Venta(
        producto_propio_id=producto_propio_id,
        nombre_producto=item.nombre,
        cantidad_vendida=item.cantidad,
        precio_venta_unitario=item.precio_venta,
        costo_unitario=item.costo_compra,
        comision_envio_monto=comision_monto,
        ganancia_neta_real=ganancia_neta,
        canal_venta=canal_venta,
        notas=f"Venta cerrada desde Lote de Operación. {item.notas or ''}".strip()
    )

    db.add(venta)
    db.delete(item)
    db.commit()
    db.refresh(venta)

    return venta


@app.delete("/api/sales/{sale_id}")
def cancel_sale(sale_id: int, revert_stock: bool = True, db: Session = Depends(get_db)):
    """
    Anula o elimina un registro de venta.
    Si revert_stock es True y la venta pertenecía a mercadería propia, repone el stock.
    """
    venta = db.query(Venta).filter(Venta.id == sale_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    if revert_stock and venta.producto_propio_id:
        producto = db.query(ProductoPropio).filter(ProductoPropio.id == venta.producto_propio_id).first()
        if producto:
            producto.stock += venta.cantidad_vendida

    db.delete(venta)
    db.commit()
    return {"message": "Venta anulada correctamente", "id": sale_id, "stock_revertido": revert_stock}


@app.post("/api/sales/from-lot")
def convert_entire_lot_to_sales(
    payload: ConfirmarVentasLoteRequest,
    db: Session = Depends(get_db)
):
    """
    Convierte todos los ítems actuales del lote en registros de venta individuales.
    - Descuenta stock en ProductoPropio si proviene de mercadería propia.
    - Distribuye la comisión global proporcionalmente entre los ítems.
    - Si limpiar_lote es True, vacía el lote activo.
    """
    items = db.query(ItemLote).all()
    if not items:
        raise HTTPException(status_code=400, detail="El lote de operación está vacío.")

    # 1. Validar disponibilidad de stock primero para todos los ítems propios
    errores_stock = []
    for item in items:
        if item.origen.upper() == "PROPIO" and item.referencia_id:
            prod = db.query(ProductoPropio).filter(ProductoPropio.id == item.referencia_id).first()
            if prod and prod.stock < item.cantidad:
                errores_stock.append(
                    f"'{prod.nombre}': se requieren {item.cantidad} unidades pero solo quedan {prod.stock} en almacén."
                )

    if errores_stock:
        raise HTTPException(
            status_code=400,
            detail="Stock insuficiente para ejecutar el lote completo:\n" + "\n".join(errores_stock)
        )

    # 2. Calcular distribución de comisión
    total_items_count = len(items)
    comision_por_item = round(payload.comision_global_monto / total_items_count, 2) if total_items_count > 0 else 0.0

    ventas_creadas = []
    for item in items:
        producto_propio_id = item.referencia_id if item.origen.upper() == "PROPIO" else None
        if producto_propio_id:
            prod = db.query(ProductoPropio).filter(ProductoPropio.id == producto_propio_id).first()
            if prod:
                prod.stock -= item.cantidad

        costo_total = round(item.costo_compra * item.cantidad, 2)
        ingreso_bruto = round(item.precio_venta * item.cantidad, 2)
        ganancia_neta = round(ingreso_bruto - costo_total - comision_por_item, 2)

        venta = Venta(
            producto_propio_id=producto_propio_id,
            nombre_producto=item.nombre,
            cantidad_vendida=item.cantidad,
            precio_venta_unitario=item.precio_venta,
            costo_unitario=item.costo_compra,
            comision_envio_monto=comision_por_item,
            ganancia_neta_real=ganancia_neta,
            canal_venta=payload.canal_venta or "Venta Directa",
            notas=f"Ejecutado desde Lote de Operación. {item.notas or ''}".strip()
        )
        db.add(venta)
        ventas_creadas.append(venta)

    # 3. Limpiar lote si fue solicitado
    if payload.limpiar_lote:
        db.query(ItemLote).delete()

    db.commit()

    return {
        "message": f"Se registraron exitosamente {len(ventas_creadas)} ventas a partir del lote.",
        "ventas_registradas": len(ventas_creadas),
        "lote_vaciado": payload.limpiar_lote
    }


# ==========================================
# ENDPOINTS: MONITOR DE OPORTUNIDADES / WATCHLIST
# ==========================================

@app.get("/api/alerts", response_model=List[AlertaProductoResponse])
def get_alerts(db: Session = Depends(get_db)):
    """Retorna la lista de búsquedas y alertas guardadas."""
    return db.query(AlertaProducto).order_by(AlertaProducto.fecha_creacion.desc()).all()


@app.post("/api/alerts", response_model=AlertaProductoResponse, status_code=status.HTTP_201_CREATED)
def create_alert(payload: AlertaProductoCreate, db: Session = Depends(get_db)):
    """Crea una nueva alerta de seguimiento / watchlist."""
    alerta = AlertaProducto(
        termino_busqueda=payload.termino_busqueda.strip(),
        precio_maximo=payload.precio_maximo,
        margen_minimo_pct=payload.margen_minimo_pct,
        tiendas_objetivo=payload.tiendas_objetivo or "Falabella,Ripley,Sodimac",
        activo=1
    )
    db.add(alerta)
    db.commit()
    db.refresh(alerta)
    return alerta


@app.delete("/api/alerts/{alert_id}")
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    """Elimina una alerta guardada."""
    alerta = db.query(AlertaProducto).filter(AlertaProducto.id == alert_id).first()
    if not alerta:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    db.delete(alerta)
    db.commit()
    return {"message": "Alerta eliminada", "id": alert_id}


@app.put("/api/alerts/{alert_id}/toggle", response_model=AlertaProductoResponse)
def toggle_alert_active(alert_id: int, db: Session = Depends(get_db)):
    """Activa o desactiva una alerta."""
    alerta = db.query(AlertaProducto).filter(AlertaProducto.id == alert_id).first()
    if not alerta:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    alerta.activo = 0 if alerta.activo == 1 else 1
    db.commit()
    db.refresh(alerta)
    return alerta


@app.post("/api/alerts/run")
async def run_alerts_scan(db: Session = Depends(get_db)):
    """
    Recorre las alertas activas con el motor SearchEngine real y
    devuelve las oportunidades detectadas que cumplen con los márgenes y precios objetivos.
    """
    alertas = db.query(AlertaProducto).filter(AlertaProducto.activo == 1).all()
    if not alertas:
        return {
            "message": "No hay alertas activas para rastrear.",
            "total_alertas": 0,
            "total_oportunidades": 0,
            "resultados": []
        }

    engine = SearchEngine(db=db)
    resultados_alertas = []
    total_oportunidades = 0

    for alerta in alertas:
        tiendas = [t.strip() for t in alerta.tiendas_objetivo.split(",") if t.strip()]
        if not tiendas:
            tiendas = ["Falabella", "Ripley"]

        try:
            res = await engine.search_async(
                query=alerta.termino_busqueda,
                target_sites=tiendas,
                max_price=alerta.precio_maximo,
                min_margin_percent=alerta.margen_minimo_pct,
                commission_percent=12.0
            )

            matches = res.get("resultados", [])
            total_oportunidades += len(matches)

            resultados_alertas.append({
                "alerta_id": alerta.id,
                "termino_busqueda": alerta.termino_busqueda,
                "precio_maximo": alerta.precio_maximo,
                "margen_minimo_pct": alerta.margen_minimo_pct,
                "tiendas_consultadas": tiendas,
                "total_encontradas": len(matches),
                "oportunidades": matches,
                "estado_tiendas": res.get("estado_tiendas", [])
            })
        except Exception as e:
            resultados_alertas.append({
                "alerta_id": alerta.id,
                "termino_busqueda": alerta.termino_busqueda,
                "error": str(e),
                "total_encontradas": 0,
                "oportunidades": []
            })

    return {
        "message": f"Rastreo completado: {total_oportunidades} oportunidades encontradas en {len(alertas)} alertas activas.",
        "total_alertas": len(alertas),
        "total_oportunidades": total_oportunidades,
        "resultados": resultados_alertas
    }





# ==========================================
# ENDPOINTS: TIENDA WEB PÚBLICA Y PEDIDOS CLIENTE
# ==========================================

@app.api_route("/tienda", methods=["GET", "HEAD"])
@app.api_route("/tienda/", methods=["GET", "HEAD"])
def serve_tienda():
    """Sirve la Tienda Web Pública completa para clientes finales."""
    tienda_file = FRONTEND_DIR / "tienda.html"
    if not tienda_file.exists():
        raise HTTPException(status_code=404, detail="tienda.html no encontrado")
    return FileResponse(
        str(tienda_file),
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
    )


# ==========================================
# GESTOR DE TÚNEL CLOUDFLARE (TIENDA PÚBLICA GRATUITA $0)
# ==========================================

@app.post("/api/tienda/publish")
def publish_store_tunnel():
    """
    Inicia el túnel seguro de Cloudflare hacia http://127.0.0.1:8000
    y retorna la URL pública generada (ej. https://xxxx.trycloudflare.com/tienda).
    """
    try:
        status = tunnel_manager.start_tunnel(local_port=8000)
        return {
            "ok": True,
            "status": "active",
            "public_url": status["public_url"],
            "store_url": status["store_url"],
            "mensaje": f"Tienda publicada exitosamente en {status['store_url']}"
        }
    except Exception as e:
        logger.error(f"Error publicando tienda con Cloudflare: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo iniciar el túnel de Cloudflare: {str(e)}"
        )


@app.post("/api/tienda/unpublish")
def unpublish_store_tunnel():
    """Detiene el túnel de Cloudflare y desactiva la publicación externa."""
    try:
        status = tunnel_manager.stop_tunnel()
        return {
            "ok": True,
            "status": "inactive",
            "store_url": None,
            "mensaje": "Tienda despublicada exitosamente."
        }
    except Exception as e:
        logger.error(f"Error deteniendo túnel de Cloudflare: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo detener el túnel de Cloudflare: {str(e)}"
        )


@app.get("/api/tienda/public-status")
def get_store_public_status():
    """Devuelve el estado actual de publicación del túnel de Cloudflare."""
    return tunnel_manager.get_status()


@app.get("/api/tienda/tunnel-config")
def get_store_tunnel_config():
    """Devuelve la configuración actual de Cloudflare Named Tunnel (token y dominio fijo)."""
    cfg = tunnel_manager.get_tunnel_config()
    return {
        "ok": True,
        "token": cfg.get("token", ""),
        "fixed_domain": cfg.get("fixed_domain", ""),
        "has_token": cfg.get("has_token", False)
    }


@app.post("/api/tienda/tunnel-config")
def save_store_tunnel_config(payload: TunnelConfigRequest):
    """Guarda o actualiza la configuración de Cloudflare Named Tunnel."""
    try:
        updated = tunnel_manager.save_tunnel_config(
            token=payload.token,
            fixed_domain=payload.fixed_domain
        )
        return {
            "ok": True,
            "mensaje": "Configuración de subdominio fijo guardada correctamente.",
            "config": {
                "has_token": updated.get("has_token", False),
                "fixed_domain": updated.get("fixed_domain", "")
            }
        }
    except Exception as e:
        logger.error(f"Error guardando configuración del túnel: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo guardar la configuración: {str(e)}"
        )


@app.delete("/api/tienda/tunnel-config")
def delete_store_tunnel_config():
    """Elimina la configuración de token/dominio fijo para volver al modo rápido gratuito."""
    try:
        updated = tunnel_manager.delete_tunnel_config()
        return {
            "ok": True,
            "mensaje": "Configuración eliminada. Se usará el modo rápido gratuito.",
            "config": updated
        }
    except Exception as e:
        logger.error(f"Error eliminando configuración del túnel: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo eliminar la configuración: {str(e)}"
        )


@app.get("/api/store/products", response_model=List[ProductoTiendaPublico])
def get_store_products(db: Session = Depends(get_db)):
    """
    Retorna el catálogo público de productos con stock disponible (> 0) o productos
    publicados bajo pedido / por encargo para compra contraentrega.
    Exclusivamente campos comerciales públicos (NUNCA expone costos internos ni márgenes).
    """
    prods = db.query(ProductoPropio).filter(
        (ProductoPropio.stock > 0) | (ProductoPropio.estado.in_(["Bajo Pedido", "Por Encargo"]))
    ).order_by(ProductoPropio.nombre.asc()).all()
    return prods


@app.post("/api/store/publish-on-demand")
def publish_on_demand_product(payload: PublishOnDemandRequest, db: Session = Depends(get_db)):
    """
    Publica un producto hallado en el buscador o lote directamente en el mostrador / catálogo
    con código especial 'ENC-XXX' y estado 'Bajo Pedido' sin requerir compra previa (costo $0 de inversión inicial).
    """
    count_enc = db.query(ProductoPropio).filter(ProductoPropio.sku.like("ENC-%")).count() + 1
    new_sku = f"ENC-{count_enc:03d}"

    existente = db.query(ProductoPropio).filter(
        (ProductoPropio.nombre == payload.nombre.strip()) |
        ((ProductoPropio.url_compra == payload.url_compra) & (ProductoPropio.url_compra != None))
    ).first()

    if existente:
        existente.precio_venta = payload.precio_venta
        existente.costo_unitario = payload.precio_compra
        existente.estado = "Bajo Pedido"
        if payload.url_compra:
            existente.url_compra = payload.url_compra
        if payload.foto_url and (not existente.foto_url or "placeholder" in existente.foto_url):
            existente.foto_url = payload.foto_url
        existente.proveedor = payload.tienda
        existente.tiempo_entrega = payload.tiempo_entrega or "24 a 48 hrs"
        prod = existente
    else:
        prod = ProductoPropio(
            nombre=payload.nombre.strip(),
            modelo=payload.modelo or f"Proveedor: {payload.tienda}",
            sku=new_sku,
            foto_url=payload.foto_url,
            stock=0,
            costo_unitario=payload.precio_compra,
            precio_venta=payload.precio_venta,
            estado="Bajo Pedido",
            url_compra=payload.url_compra,
            proveedor=payload.tienda,
            tiempo_entrega=payload.tiempo_entrega or "24 a 48 hrs",
            notas=payload.notas or f"Publicado en mostrador bajo pedido desde {payload.tienda}. Comprar en proveedor al confirmar pedido del cliente."
        )
        db.add(prod)

    db.commit()
    db.refresh(prod)

    if payload.agregar_a_lote:
        en_lote = db.query(ItemLote).filter(
            (ItemLote.referencia_id == prod.id) | (ItemLote.nombre == prod.nombre)
        ).first()
        if not en_lote:
            lote_item = ItemLote(
                origen="EXTERNO",
                referencia_id=prod.id,
                nombre=prod.nombre,
                tienda=payload.tienda,
                foto_url=prod.foto_url,
                cantidad=1,
                costo_compra=payload.precio_compra,
                precio_venta=payload.precio_venta,
                url_compra=payload.url_compra,
                tiempo_entrega=prod.tiempo_entrega,
                notas=f"[{prod.sku} - En Mostrador] Pendiente de pedido de cliente. Comprar contraentrega."
            )
            db.add(lote_item)
            db.commit()

    return {
        "status": "success",
        "message": f"Producto publicado en mostrador/catálogo con código {prod.sku} (Bajo Pedido).",
        "sku": prod.sku,
        "id": prod.id,
        "nombre": prod.nombre,
        "precio_venta": prod.precio_venta,
        "costo_compra": prod.costo_unitario,
        "proveedor": prod.proveedor,
        "tiempo_entrega": prod.tiempo_entrega,
        "url_compra": prod.url_compra,
        "estado": prod.estado
    }


@app.post("/api/lot/{item_id}/publish-to-store")
def publish_lot_item_to_store(item_id: int, db: Session = Depends(get_db)):
    """Toma un ítem del lote de operación y lo publica en la tienda/mostrador como producto bajo pedido."""
    item = db.query(ItemLote).filter(ItemLote.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem de lote no encontrado")

    req = PublishOnDemandRequest(
        nombre=item.nombre,
        tienda=item.tienda,
        precio_compra=item.costo_compra,
        precio_venta=item.precio_venta,
        foto_url=item.foto_url,
        url_compra=item.url_compra,
        tiempo_entrega=item.tiempo_entrega or "24 a 48 hrs",
        notas=item.notas,
        agregar_a_lote=False
    )
    res = publish_on_demand_product(req, db)
    item.referencia_id = res["id"]
    item.notas = f"[{res['sku']} - En Mostrador] {item.notas or ''}"
    db.commit()
    return res


@app.get("/api/store/config", response_model=ConfiguracionTiendaResponse)
def get_store_config(db: Session = Depends(get_db)):
    """Obtiene la configuración visual y comercial de la tienda pública."""
    cfg = db.query(ConfiguracionTienda).first()
    if not cfg:
        cfg = ConfiguracionTienda(
            nombre_tienda="KipuStock Store",
            whatsapp_ventas="51944830586",
            mensaje_bienvenida="¡Bienvenido a KipuStock Store! Productos de alta rotación con entrega inmediata y garantía.",
            instrucciones_pago="Realiza tu pago vía Yape o Plin al número oficial (51944830586) y envía la constancia por WhatsApp para validar y despachar tu pedido de inmediato."
        )
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


@app.put("/api/store/config", response_model=ConfiguracionTiendaResponse)
def update_store_config(payload: ConfiguracionTiendaUpdate, db: Session = Depends(get_db)):
    """Actualiza la configuración comercial de la tienda web."""
    cfg = db.query(ConfiguracionTienda).first()
    if not cfg:
        cfg = ConfiguracionTienda()
        db.add(cfg)

    if payload.nombre_tienda is not None:
        cfg.nombre_tienda = payload.nombre_tienda.strip()
    if payload.whatsapp_ventas is not None:
        cfg.whatsapp_ventas = payload.whatsapp_ventas.strip()
    if payload.mensaje_bienvenida is not None:
        cfg.mensaje_bienvenida = payload.mensaje_bienvenida.strip()
    if payload.qr_yape_url is not None:
        cfg.qr_yape_url = payload.qr_yape_url.strip() or None
    if payload.qr_plin_url is not None:
        cfg.qr_plin_url = payload.qr_plin_url.strip() or None
    if payload.instrucciones_pago is not None:
        cfg.instrucciones_pago = payload.instrucciones_pago.strip()

    db.commit()
    db.refresh(cfg)
    return cfg


@app.post("/api/store/upload-qr")
async def upload_store_qr(tipo: str = Form(...), file: UploadFile = File(...)):
    """Sube una imagen QR de pago (Yape o Plin) y devuelve su URL estática."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Archivo no válido")

    ext = Path(file.filename).suffix.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        raise HTTPException(status_code=400, detail="Formato no soportado. Usa JPG, PNG o WEBP")

    clean_tipo = "yape" if "yape" in tipo.lower() else "plin"
    filename = f"qr_{clean_tipo}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = PRODUCT_IMAGES_DIR / filename

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "status": "success",
        "tipo": clean_tipo,
        "url": f"/product_images/{filename}",
        "filename": filename
    }


@app.post("/api/store/upload-comprobante")
async def upload_order_proof(file: UploadFile = File(...)):
    """Sube la captura de pantalla de comprobante de pago de un pedido web."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Archivo no válido")

    ext = Path(file.filename).suffix.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".pdf"]:
        raise HTTPException(status_code=400, detail="Formato no soportado. Usa JPG, PNG, WEBP o PDF")

    filename = f"comp_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = PRODUCT_IMAGES_DIR / filename

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "status": "success",
        "url": f"/product_images/{filename}",
        "filename": filename
    }


@app.post("/api/store/orders", response_model=PedidoWebResponse, status_code=status.HTTP_201_CREATED)
def create_store_order(payload: PedidoWebCreate, db: Session = Depends(get_db)):
    """
    Registra un pedido entrante desde la tienda web pública.
    Soporta tanto productos en stock en mano como productos bajo pedido / por encargo para entrega contraentrega.
    """
    if not payload.items:
        raise HTTPException(status_code=400, detail="El pedido no contiene ítems.")

    items_serializados = []
    total_calculado = 0.0
    tiene_bajo_pedido = False

    for item in payload.items:
        prod = db.query(ProductoPropio).filter(ProductoPropio.id == item.producto_id).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Producto #{item.producto_id} no encontrado en catálogo.")

        es_on_demand = (prod.estado or "").strip().lower() in ["bajo pedido", "por encargo"]
        if es_on_demand:
            tiene_bajo_pedido = True
        elif prod.stock < item.cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para '{prod.nombre}'. Disponibles: {prod.stock}, solicitadas: {item.cantidad}."
            )

        subtotal = round(item.precio_unitario * item.cantidad, 2)
        total_calculado += subtotal
        items_serializados.append({
            "producto_id": prod.id,
            "nombre": prod.nombre,
            "sku": prod.sku,
            "modelo": prod.modelo,
            "foto_url": prod.foto_url,
            "cantidad": item.cantidad,
            "precio_unitario": item.precio_unitario,
            "costo_unitario": prod.costo_unitario,
            "subtotal": subtotal,
            "es_bajo_pedido": es_on_demand,
            "url_compra": prod.url_compra,
            "proveedor": prod.proveedor or "Proveedor Externo",
            "tiempo_entrega": prod.tiempo_entrega or "24 a 48 hrs"
        })

    codigo = f"KIPU-{uuid.uuid4().hex[:6].upper()}"
    estado_inicial = "Por Comprar en Proveedor" if tiene_bajo_pedido else "Pendiente"
    nota_extra = " [⚠️ CONTIENE ÍTEMS BAJO PEDIDO: Comprar en proveedor antes de entregar]" if tiene_bajo_pedido else ""

    pedido = PedidoWeb(
        codigo_pedido=codigo,
        nombre_cliente=payload.nombre_cliente.strip(),
        telefono_cliente=payload.telefono_cliente.strip(),
        direccion_distrito=payload.direccion_distrito.strip(),
        metodo_pago=payload.metodo_pago or ("Contraentrega" if tiene_bajo_pedido else "WhatsApp"),
        estado=estado_inicial,
        comprobante_url=payload.comprobante_url.strip() if payload.comprobante_url else None,
        items_json=json.dumps(items_serializados, ensure_ascii=False),
        total_monto=round(payload.total_monto or total_calculado, 2),
        notas=(payload.notas.strip() if payload.notas else "") + nota_extra
    )

    db.add(pedido)
    db.commit()
    db.refresh(pedido)
    return pedido


@app.get("/api/store/orders", response_model=List[PedidoWebResponse])
def get_store_orders(db: Session = Depends(get_db)):
    """Retorna el listado de pedidos web recibidos para el panel administrativo."""
    return db.query(PedidoWeb).order_by(PedidoWeb.fecha_pedido.desc()).all()


@app.post("/api/store/orders/{order_id}/mark-purchased")
def mark_store_order_purchased(order_id: int, db: Session = Depends(get_db)):
    """Marca que el producto por encargo ya fue comprado al proveedor en la web externa y viene en camino."""
    order = db.query(PedidoWeb).filter(PedidoWeb.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido web no encontrado.")

    order.estado = "Comprado en Proveedor"
    db.commit()
    return {
        "status": "ok",
        "message": f"Pedido #{order.codigo_pedido} marcado como 'Comprado en Proveedor' (esperando arribo de mercadería).",
        "codigo_pedido": order.codigo_pedido,
        "estado": order.estado
    }


@app.post("/api/store/orders/{order_id}/mark-in-delivery")
def mark_store_order_in_delivery(order_id: int, db: Session = Depends(get_db)):
    """Marca que el pedido ya fue recibido del proveedor y está en ruta de reparto al cliente final."""
    order = db.query(PedidoWeb).filter(PedidoWeb.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido web no encontrado.")

    order.estado = "En Reparto al Cliente"
    db.commit()
    return {
        "status": "ok",
        "message": f"Pedido #{order.codigo_pedido} marcado como 'En Reparto al Cliente' para cobro contraentrega.",
        "codigo_pedido": order.codigo_pedido,
        "estado": order.estado
    }


@app.post("/api/store/orders/{order_id}/complete-delivery")
def complete_store_order_delivery(order_id: int, payload: CompleteOrderCashOnDeliveryRequest, db: Session = Depends(get_db)):
    """
    Finaliza la venta contraentrega:
    - Valida el cobro realizado al cliente en Efectivo, Yape o Plin al momento de recibir.
    - Asienta la ganancia neta real en el Libro de Ventas.
    - Sincroniza al cliente en el CRM y pasa el pedido a 'Aprobado'.
    """
    order = db.query(PedidoWeb).filter(PedidoWeb.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido web no encontrado.")

    if order.estado == "Aprobado":
        raise HTTPException(status_code=400, detail="Este pedido ya fue completado previamente.")

    items = json.loads(order.items_json) if order.items_json else []
    ventas_creadas = []

    for item in items:
        prod = db.query(ProductoPropio).filter(ProductoPropio.id == item["producto_id"]).first()
        es_on_demand = item.get("es_bajo_pedido") or (prod and prod.es_bajo_pedido)

        # Si era stock en mano, descontar si aún queda
        if prod and not es_on_demand and prod.stock >= item["cantidad"]:
            prod.stock -= item["cantidad"]

        costo_unit = payload.costo_real_compra if payload.costo_real_compra is not None else float(item.get("costo_unitario") or (prod.costo_unitario if prod else 0.0))
        costo_total = round(costo_unit * item["cantidad"], 2)
        ingreso_total = round(float(item["precio_unitario"]) * item["cantidad"], 2)
        ganancia_neta = round(ingreso_total - costo_total, 2)

        venta = Venta(
            producto_propio_id=prod.id if prod else None,
            nombre_producto=item["nombre"],
            cantidad_vendida=item["cantidad"],
            precio_venta_unitario=item["precio_unitario"],
            costo_unitario=costo_unit,
            comision_envio_monto=0.0,
            ganancia_neta_real=ganancia_neta,
            canal_venta=f"Contraentrega ({payload.metodo_cobro})",
            telefono_cliente=order.telefono_cliente,
            notas=f"Pedido #{order.codigo_pedido} - Contraentrega a {order.nombre_cliente} ({order.direccion_distrito}). {payload.notas_entrega or ''}"
        )
        db.add(venta)
        ventas_creadas.append(venta)

    order.estado = "Aprobado"
    db.commit()

    # Sincronizar CRM
    upsert_cliente_from_transaction(
        db=db,
        nombre=order.nombre_cliente,
        telefono=order.telefono_cliente,
        distrito=order.direccion_distrito,
        direccion=order.direccion_distrito,
        monto_compra=order.total_monto,
        notas=f"Pedido #{order.codigo_pedido} Contraentrega ({payload.metodo_cobro})"
    )

    return {
        "status": "success",
        "message": f"Pedido #{order.codigo_pedido} entregado y cobrado vía {payload.metodo_cobro}. Ganancia neta registrada.",
        "codigo_pedido": order.codigo_pedido,
        "estado": order.estado
    }


@app.post("/api/store/orders/{order_id}/approve")
def approve_store_order(order_id: int, db: Session = Depends(get_db)):
    """
    Aprueba un pedido web tradicional o por encargo:
    - Descuenta stock si es producto físico en almacén.
    - Si es producto bajo pedido, procede sin requerir stock previo.
    - Crea automáticamente los registros en la tabla Venta calculando la ganancia real.
    - Cambia el estado del pedido a 'Aprobado'.
    """
    order = db.query(PedidoWeb).filter(PedidoWeb.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido web no encontrado.")

    if order.estado == "Aprobado":
        raise HTTPException(status_code=400, detail="Este pedido ya fue aprobado previamente.")

    items = json.loads(order.items_json) if order.items_json else []
    if not items:
        raise HTTPException(status_code=400, detail="El pedido no tiene ítems registrados.")

    # 1. Verificar stock si son productos en almacén físico
    for item in items:
        prod = db.query(ProductoPropio).filter(ProductoPropio.id == item["producto_id"]).first()
        if prod and not prod.es_bajo_pedido and prod.stock < item["cantidad"]:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para '{prod.nombre}'. Quedan {prod.stock} unidades y el pedido requiere {item['cantidad']}."
            )

    # 2. Descontar stock (si aplica) y registrar ventas
    ventas_creadas = []
    for item in items:
        prod = db.query(ProductoPropio).filter(ProductoPropio.id == item["producto_id"]).first()
        es_on_demand = item.get("es_bajo_pedido") or (prod and prod.es_bajo_pedido)
        if prod and not es_on_demand and prod.stock >= item["cantidad"]:
            prod.stock -= item["cantidad"]

        costo_unit = float(item.get("costo_unitario") or (prod.costo_unitario if prod else 0.0))
        costo_total = round(costo_unit * item["cantidad"], 2)
        ingreso_total = round(item["precio_unitario"] * item["cantidad"], 2)
        ganancia_neta = round(ingreso_total - costo_total, 2)

        venta = Venta(
            producto_propio_id=prod.id if prod else None,
            nombre_producto=item["nombre"],
            cantidad_vendida=item["cantidad"],
            precio_venta_unitario=item["precio_unitario"],
            costo_unitario=costo_unit,
            comision_envio_monto=0.0,
            ganancia_neta_real=ganancia_neta,
            canal_venta="Contraentrega" if order.metodo_pago == "Contraentrega" else "Tienda Web",
            telefono_cliente=order.telefono_cliente,
            notas=f"Pedido Web #{order.codigo_pedido} - Cliente: {order.nombre_cliente} ({order.direccion_distrito})"
        )
        db.add(venta)
        ventas_creadas.append(venta)

    order.estado = "Aprobado"
    db.commit()

    # Sincronizar automáticamente ficha del cliente en el CRM
    upsert_cliente_from_transaction(
        db=db,
        nombre=order.nombre_cliente,
        telefono=order.telefono_cliente,
        distrito=order.direccion_distrito,
        monto_compra=order.total_monto,
        notas=f"Aprobación Pedido Web #{order.codigo_pedido}"
    )

    return {
        "message": f"Pedido #{order.codigo_pedido} aprobado exitosamente. Ganancia real registrada.",
        "codigo_pedido": order.codigo_pedido,
        "estado": order.estado
    }

    order.estado = "Aprobado"
    db.commit()

    # Sincronizar automáticamente ficha del cliente en el CRM
    upsert_cliente_from_transaction(
        db=db,
        nombre=order.nombre_cliente,
        telefono=order.telefono_cliente,
        distrito=order.direccion_distrito,
        monto_compra=order.total_monto,
        notas=f"Aprobación Pedido Web #{order.codigo_pedido}"
    )

    return {
        "message": f"Pedido #{order.codigo_pedido} aprobado exitosamente. Se descontó el stock y se registraron {len(ventas_creadas)} ventas.",
        "codigo_pedido": order.codigo_pedido,
        "estado": order.estado
    }


@app.post("/api/store/orders/{order_id}/reject")
def reject_store_order(order_id: int, db: Session = Depends(get_db)):
    """Rechaza o cancela un pedido web recibido."""
    order = db.query(PedidoWeb).filter(PedidoWeb.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido web no encontrado.")

    order.estado = "Rechazado"
    db.commit()

    return {
        "message": f"Pedido #{order.codigo_pedido} marcado como rechazado.",
        "codigo_pedido": order.codigo_pedido,
        "estado": order.estado
    }


# ============================================================================
# MÓDULO DE CAMPAÑAS PUBLICITARIAS PARA REDES SOCIALES
# ============================================================================

@app.post("/api/campaigns/generate", response_model=CampaignGenerateResponse)
def generate_social_campaign(payload: CampaignGenerateRequest, db: Session = Depends(get_db)):
    """
    Genera un paquete publicitario multicanal completo (imágenes 1:1, 9:16 y copys multicanal)
    utilizando Pillow y Gemini 2.5 Flash / Fallback estructurado con costo $0.
    Permite seleccionar productos de inventario propio o de arbitraje (lote).
    """
    product_data = {}
    if payload.item_lote_id:
        item = db.query(ItemLote).filter(ItemLote.id == payload.item_lote_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Ítem de lote/arbitraje no encontrado.")
        
        # Calcular margen si no fue provisto
        margen_calc = None
        if item.precio_venta > 0 and item.costo_compra > 0:
            margen_calc = round(((item.precio_venta - item.costo_compra) / item.precio_venta) * 100, 1)

        product_data = {
            "nombre": item.nombre,
            "modelo": payload.modelo or item.tienda or "",
            "estado": payload.estado or ("Nuevo" if item.origen != "PROPIO" else "En Stock"),
            "precio_venta": item.precio_venta,
            "precio_oferta": payload.precio_oferta if payload.precio_oferta else None,
            "margen_beneficio": payload.margen_beneficio if payload.margen_beneficio is not None else margen_calc,
            "stock": payload.stock if payload.stock is not None else item.cantidad,
            "enlace": payload.enlace or item.url_compra,
            "notas": payload.descripcion or item.notas or f"Producto verificado de arbitraje ({item.tienda}). Calidad y entrega rápida.",
            "foto_url": item.foto_url or payload.foto_url
        }
    elif payload.producto_propio_id:
        prod = db.query(ProductoPropio).filter(ProductoPropio.id == payload.producto_propio_id).first()
        if not prod:
            raise HTTPException(status_code=404, detail="Producto propio no encontrado.")
        
        margen_calc = None
        if prod.precio_venta > 0 and prod.costo_unitario > 0:
            margen_calc = round(((prod.precio_venta - prod.costo_unitario) / prod.precio_venta) * 100, 1)

        product_data = {
            "nombre": prod.nombre,
            "modelo": prod.modelo or "",
            "estado": prod.estado or "Nuevo",
            "precio_venta": prod.precio_venta,
            "precio_oferta": payload.precio_oferta if payload.precio_oferta else None,
            "margen_beneficio": payload.margen_beneficio if payload.margen_beneficio is not None else margen_calc,
            "stock": payload.stock if payload.stock is not None else prod.stock,
            "enlace": payload.enlace or prod.url_compra,
            "notas": payload.descripcion or prod.notas or "Stock en mano y entrega rápida.",
            "foto_url": prod.foto_url or payload.foto_url
        }
    else:
        if not payload.nombre or not payload.precio_venta:
            raise HTTPException(status_code=400, detail="Debe indicar al menos el nombre y precio de venta del producto.")
        product_data = {
            "nombre": payload.nombre,
            "modelo": payload.modelo or "",
            "estado": payload.estado or "Nuevo",
            "precio_venta": payload.precio_venta,
            "precio_oferta": payload.precio_oferta,
            "margen_beneficio": payload.margen_beneficio,
            "stock": payload.stock,
            "enlace": payload.enlace,
            "notas": payload.descripcion or "Excelente calidad y garantía oficial.",
            "foto_url": payload.foto_url
        }

    # Leer configuración de tienda si no se suministraron WhatsApp o URL
    store_config = db.query(ConfiguracionTienda).first()
    whatsapp_contacto = payload.whatsapp_contacto or (store_config.whatsapp_ventas if store_config else "51944830586")
    active_store_url = tunnel_manager.get_status().get("store_url")
    url_publica = payload.enlace or payload.url_publica_tienda
    if not url_publica or "localhost" in url_publica or "127.0.0.1" in url_publica:
        if active_store_url:
            url_publica = active_store_url
        elif not url_publica:
            url_publica = "http://localhost:8000/tienda"

    try:
        campaign_result = run_full_campaign_generation(
            product_data=product_data,
            tone=payload.tono,
            store_url=url_publica,
            whatsapp_num=whatsapp_contacto,
            moneda=payload.moneda,
            formatos=payload.formatos,
            canales=payload.canales
        )
        return campaign_result
    except Exception as e:
        logger.error(f"Error generando campaña publicitaria: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al generar piezas de campaña: {str(e)}")


@app.get("/api/campaigns/download-pack/{campaign_id}")
def download_campaign_pack(campaign_id: str):
    """
    Descarga el paquete completo de la campaña (.ZIP con imágenes y copys_redes.txt).
    Si el ZIP fue borrado pero el directorio existe, lo reempaqueta dinámicamente.
    """
    camp_dir = CAMPAIGNS_DIR / campaign_id
    if not camp_dir.exists():
        raise HTTPException(status_code=404, detail="Paquete de campaña no encontrado o expirado.")

    zip_path = camp_dir / f"pack_campana_{campaign_id}.zip"
    if not zip_path.exists():
        zip_path = create_campaign_zip(camp_dir, campaign_id)

    return FileResponse(
        path=str(zip_path),
        filename=f"pack_campana_{campaign_id}.zip",
        media_type="application/zip"
    )


# ======================================================================
# CRM CLIENTES
# ======================================================================

@app.get("/api/clients", response_model=List[ClienteResponse])
def get_clients(q: Optional[str] = None, limit: int = 100, db: Session = Depends(get_db)):
    """
    Lista el directorio de clientes del CRM, ordenados por compras y última actividad.
    Permite filtrar por nombre, teléfono o distrito.
    """
    query = db.query(Cliente)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            (Cliente.nombre.ilike(term)) |
            (Cliente.telefono_whatsapp.ilike(term)) |
            (Cliente.distrito_ciudad.ilike(term))
        )
    return query.order_by(Cliente.ultima_compra.desc().nullslast(), Cliente.total_compras.desc()).limit(limit).all()


@app.post("/api/clients", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
def create_client(payload: ClienteCreate, db: Session = Depends(get_db)):
    """Registra manualmente un nuevo cliente en el CRM."""
    nom = payload.nombre.strip()
    tel = payload.telefono_whatsapp.strip() if payload.telefono_whatsapp else None

    # Verificar si ya existe por teléfono para evitar duplicidad
    if tel:
        existente = db.query(Cliente).filter(Cliente.telefono_whatsapp == tel).first()
        if existente:
            existente.nombre = nom
            if payload.distrito_ciudad:
                existente.distrito_ciudad = payload.distrito_ciudad.strip()
            if payload.direccion:
                existente.direccion = payload.direccion.strip()
            if payload.notas:
                existente.notas = payload.notas.strip()
            db.commit()
            db.refresh(existente)
            return existente

    nuevo = Cliente(
        nombre=nom,
        telefono_whatsapp=tel,
        distrito_ciudad=payload.distrito_ciudad.strip() if payload.distrito_ciudad else None,
        direccion=payload.direccion.strip() if payload.direccion else None,
        notas=payload.notas.strip() if payload.notas else None,
        total_compras=0.0,
        fecha_registro=datetime.utcnow()
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.put("/api/clients/{client_id}", response_model=ClienteResponse)
def update_client(client_id: int, payload: ClienteUpdate, db: Session = Depends(get_db)):
    """Actualiza los datos de contacto o dirección de un cliente."""
    cliente = db.query(Cliente).filter(Cliente.id == client_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if payload.nombre is not None:
        cliente.nombre = payload.nombre.strip()
    if payload.telefono_whatsapp is not None:
        cliente.telefono_whatsapp = payload.telefono_whatsapp.strip() if payload.telefono_whatsapp else None
    if payload.distrito_ciudad is not None:
        cliente.distrito_ciudad = payload.distrito_ciudad.strip() if payload.distrito_ciudad else None
    if payload.direccion is not None:
        cliente.direccion = payload.direccion.strip() if payload.direccion else None
    if payload.notas is not None:
        cliente.notas = payload.notas.strip() if payload.notas else None

    db.commit()
    db.refresh(cliente)
    return cliente


@app.delete("/api/clients/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db)):
    """Elimina la ficha de un cliente."""
    cliente = db.query(Cliente).filter(Cliente.id == client_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    db.delete(cliente)
    db.commit()
    return {"status": "ok", "message": f"Cliente '{cliente.nombre}' eliminado correctamente."}


# ======================================================================
# TARIFAS DE ENVÍO
# ======================================================================

@app.get("/api/shipping-rates", response_model=List[TarifaEnvioResponse])
def get_shipping_rates(db: Session = Depends(get_db)):
    """Lista las tarifas de envío configuradas en el sistema."""
    return db.query(TarifaEnvio).order_by(TarifaEnvio.costo.asc()).all()


@app.post("/api/shipping-rates", response_model=TarifaEnvioResponse, status_code=status.HTTP_201_CREATED)
def create_shipping_rate(payload: TarifaEnvioCreate, db: Session = Depends(get_db)):
    """Crea una nueva tarifa de despacho/envío."""
    tarifa = TarifaEnvio(
        nombre=payload.nombre.strip(),
        tipo=payload.tipo.strip() if payload.tipo else "Local",
        costo=round(payload.costo, 2),
        tiempo_entrega=payload.tiempo_entrega.strip() if payload.tiempo_entrega else "24 a 48 hrs",
        activo=1 if payload.activo else 0,
        notas=payload.notas.strip() if payload.notas else None
    )
    db.add(tarifa)
    db.commit()
    db.refresh(tarifa)
    return tarifa


@app.put("/api/shipping-rates/{rate_id}", response_model=TarifaEnvioResponse)
def update_shipping_rate(rate_id: int, payload: TarifaEnvioUpdate, db: Session = Depends(get_db)):
    """Edita una tarifa de despacho existente."""
    tarifa = db.query(TarifaEnvio).filter(TarifaEnvio.id == rate_id).first()
    if not tarifa:
        raise HTTPException(status_code=404, detail="Tarifa de envío no encontrada")

    if payload.nombre is not None:
        tarifa.nombre = payload.nombre.strip()
    if payload.tipo is not None:
        tarifa.tipo = payload.tipo.strip()
    if payload.costo is not None:
        tarifa.costo = round(payload.costo, 2)
    if payload.tiempo_entrega is not None:
        tarifa.tiempo_entrega = payload.tiempo_entrega.strip()
    if payload.activo is not None:
        tarifa.activo = 1 if payload.activo else 0
    if payload.notas is not None:
        tarifa.notas = payload.notas.strip() if payload.notas else None

    db.commit()
    db.refresh(tarifa)
    return tarifa


@app.delete("/api/shipping-rates/{rate_id}")
def delete_shipping_rate(rate_id: int, db: Session = Depends(get_db)):
    """Elimina una tarifa de despacho."""
    tarifa = db.query(TarifaEnvio).filter(TarifaEnvio.id == rate_id).first()
    if not tarifa:
        raise HTTPException(status_code=404, detail="Tarifa de envío no encontrada")
    db.delete(tarifa)
    db.commit()
    return {"status": "ok", "message": f"Tarifa '{tarifa.nombre}' eliminada."}


# ======================================================================
# GENERADOR DE COTIZACIONES Y NOTAS EN PDF
# ======================================================================

@app.post("/api/quotes/pdf", response_model=QuoteGenerateResponse)
def create_quote_pdf(payload: QuoteGenerateRequest, db: Session = Depends(get_db)):
    """
    Genera un archivo PDF profesional con cotización formal o nota de venta.
    Calcula envíos, productos y genera el mensaje formateado para WhatsApp.
    """
    if not payload.items:
        raise HTTPException(status_code=400, detail="Debe incluir al menos un producto en la cotización.")

    # 1. Resolver datos del cliente
    cliente_data = {
        "nombre": payload.cliente_nombre or "Cliente Particular",
        "telefono_whatsapp": payload.cliente_telefono or "",
        "distrito_ciudad": payload.cliente_distrito or "Lima",
        "direccion": payload.cliente_direccion or "Entrega a coordinar"
    }

    if payload.cliente_id:
        cli_db = db.query(Cliente).filter(Cliente.id == payload.cliente_id).first()
        if cli_db:
            cliente_data["nombre"] = cli_db.nombre
            cliente_data["telefono_whatsapp"] = cli_db.telefono_whatsapp or cliente_data["telefono_whatsapp"]
            cliente_data["distrito_ciudad"] = cli_db.distrito_ciudad or cliente_data["distrito_ciudad"]
            cliente_data["direccion"] = cli_db.direccion or cliente_data["direccion"]

    # Sincronizar o crear ficha en CRM si hay datos de contacto
    if payload.cliente_nombre or payload.cliente_telefono:
        upsert_cliente_from_transaction(
            db=db,
            nombre=cliente_data["nombre"],
            telefono=cliente_data["telefono_whatsapp"],
            distrito=cliente_data["distrito_ciudad"],
            direccion=cliente_data["direccion"],
            monto_compra=0.0,
            notas="Cotización generada"
        )

    # 2. Resolver tarifa de envío
    costo_envio = round(float(payload.costo_envio or 0.0), 2)
    metodo_envio = payload.metodo_envio or "Entrega por Coordinar"
    tiempo_envio = "24 a 48 hrs"

    if payload.tarifa_envio_id:
        tarifa_db = db.query(TarifaEnvio).filter(TarifaEnvio.id == payload.tarifa_envio_id).first()
        if tarifa_db:
            costo_envio = round(tarifa_db.costo, 2)
            metodo_envio = tarifa_db.nombre
            tiempo_envio = tarifa_db.tiempo_entrega

    shipping_info = {
        "nombre": metodo_envio,
        "costo": costo_envio,
        "tiempo_entrega": tiempo_envio
    }

    # 3. Leer configuración de tienda
    cfg = db.query(ConfiguracionTienda).first()
    store_config = {
        "nombre_tienda": cfg.nombre_tienda if cfg else "KipuStock Store",
        "whatsapp_ventas": cfg.whatsapp_ventas if cfg else "51944830586",
        "instrucciones_pago": cfg.instrucciones_pago if cfg else "Pagos vía Yape, Plin o transferencias bancarias."
    }

    # 4. Formatear items
    items_clean = []
    for it in payload.items:
        items_clean.append({
            "producto_id": it.producto_id,
            "nombre": it.nombre.strip(),
            "cantidad": it.cantidad,
            "precio_unitario": round(it.precio_unitario, 2)
        })

    # 5. Generar correlativo único
    now_str = datetime.now().strftime("%Y%m%d")
    corr_code = uuid.uuid4().hex[:4].upper()
    correlativo = f"COT-{now_str}-{corr_code}"

    try:
        pdf_result = generate_quote_pdf(
            correlativo=correlativo,
            cliente_data=cliente_data,
            items=items_clean,
            shipping_info=shipping_info,
            store_config=store_config,
            moneda=payload.moneda,
            validez_dias=payload.validez_dias,
            notas=payload.notas
        )

        return QuoteGenerateResponse(
            status="ok",
            correlativo=correlativo,
            pdf_url=pdf_result["pdf_url"],
            download_filename=pdf_result["filename"],
            subtotal_productos=pdf_result["subtotal_productos"],
            costo_envio=pdf_result["costo_envio"],
            total=pdf_result["total"],
            moneda=payload.moneda,
            whatsapp_message=pdf_result["whatsapp_message"],
            mensaje=f"Cotización {correlativo} generada exitosamente en PDF."
        )
    except Exception as ex:
        logger.error(f"Error generando PDF de cotización: {ex}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al generar cotización en PDF: {str(ex)}")


if __name__ == "__main__":
    import sys
    import uvicorn
    loop_opt = "asyncio.windows_events:ProactorEventLoop" if sys.platform == "win32" else "auto"
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True, loop=loop_opt)



