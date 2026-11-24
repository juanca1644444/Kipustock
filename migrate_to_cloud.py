"""
==============================================================================
KIPUSTOCK - SCRIPT DE MIGRACIÓN AUTOMÁTICA A LA NUBE ($0)
Transfiere sin pérdida de datos el inventario, ventas, clientes, pedidos y
configuraciones desde SQLite local ('data/sistema.db') hacia PostgreSQL
(Supabase / Neon / Render) o genera un backup JSON integral.
==============================================================================
Uso:
  python migrate_to_cloud.py --url "postgresql://usuario:clave@host:5432/dbname"
  python migrate_to_cloud.py --dry-run
  python migrate_to_cloud.py --export-json
"""

import os
import sys
import json
import argparse
import logging
from pathlib import Path
from datetime import datetime

# Cargar variables de entorno
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker

# Configurar logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("kipustock.migrator")

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
LOCAL_DB_FILE = DATA_DIR / "sistema.db"

# Importar modelos de Kipustock
from backend.models import (
    Base,
    ProductoPropio,
    ItemLote,
    Venta,
    AlertaProducto,
    ConfiguracionTienda,
    PedidoWeb,
    TiendaPersonalizada,
    Cliente,
    TarifaEnvio
)


def serialize_row(obj):
    """Convierte una entidad SQLAlchemy a diccionario serializable."""
    res = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        res[col.name] = val
    return res


def export_to_json(source_session, output_file: Path) -> dict:
    """Exporta todas las tablas a un archivo JSON portátil de respaldo."""
    logger.info(f"Exportando base de datos a JSON: {output_file}...")
    backup_data = {
        "version": "2.5",
        "exported_at": datetime.utcnow().isoformat(),
        "tables": {
            "productos_propios": [serialize_row(r) for r in source_session.query(ProductoPropio).all()],
            "items_lote": [serialize_row(r) for r in source_session.query(ItemLote).all()],
            "ventas": [serialize_row(r) for r in source_session.query(Venta).all()],
            "alertas_productos": [serialize_row(r) for r in source_session.query(AlertaProducto).all()],
            "configuracion_tienda": [serialize_row(r) for r in source_session.query(ConfiguracionTienda).all()],
            "pedidos_web": [serialize_row(r) for r in source_session.query(PedidoWeb).all()],
            "tiendas_personalizadas": [serialize_row(r) for r in source_session.query(TiendaPersonalizada).all()],
            "clientes": [serialize_row(r) for r in source_session.query(Cliente).all()],
            "tarifas_envio": [serialize_row(r) for r in source_session.query(TarifaEnvio).all()]
        }
    }
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(backup_data, f, ensure_ascii=False, indent=2, default=str)
    
    total_records = sum(len(v) for v in backup_data["tables"].values())
    logger.info(f"Exportación completa: {total_records} registros guardados en {output_file.name}")
    return backup_data


def migrate_to_database(source_session, target_engine, dry_run: bool = False):
    """Transfiere datos de SQLite local a la base de datos de destino con deduplicación."""
    logger.info("Verificando / creando tablas en la base de datos de destino...")
    if not dry_run:
        Base.metadata.create_all(bind=target_engine)

    TargetSession = sessionmaker(bind=target_engine)
    target_session = TargetSession()

    stats = {
        "productos_propios": 0,
        "items_lote": 0,
        "ventas": 0,
        "alertas_productos": 0,
        "configuracion_tienda": 0,
        "pedidos_web": 0,
        "tiendas_personalizadas": 0,
        "clientes": 0,
        "tarifas_envio": 0,
    }

    try:
        # 1. Productos Propios (Deduplicación por SKU o Nombre)
        local_prods = source_session.query(ProductoPropio).all()
        for p in local_prods:
            existing = None
            if p.sku:
                existing = target_session.query(ProductoPropio).filter(ProductoPropio.sku == p.sku).first()
            if not existing:
                existing = target_session.query(ProductoPropio).filter(ProductoPropio.nombre == p.nombre).first()

            if not existing:
                if not dry_run:
                    target_session.add(ProductoPropio(
                        nombre=p.nombre,
                        modelo=p.modelo,
                        sku=p.sku,
                        foto_url=p.foto_url,
                        stock=p.stock,
                        costo_unitario=p.costo_unitario,
                        precio_venta=p.precio_venta,
                        estado=p.estado,
                        url_compra=p.url_compra,
                        proveedor=p.proveedor,
                        tiempo_entrega=p.tiempo_entrega,
                        notas=p.notas,
                        fecha_creacion=p.fecha_creacion or datetime.utcnow()
                    ))
                stats["productos_propios"] += 1

        # 2. Configuración de Tienda
        local_cfg = source_session.query(ConfiguracionTienda).first()
        if local_cfg:
            existing_cfg = target_session.query(ConfiguracionTienda).first()
            if not existing_cfg:
                if not dry_run:
                    target_session.add(ConfiguracionTienda(
                        nombre_tienda=local_cfg.nombre_tienda,
                        whatsapp_ventas=local_cfg.whatsapp_ventas,
                        mensaje_bienvenida=local_cfg.mensaje_bienvenida,
                        qr_yape_url=local_cfg.qr_yape_url,
                        qr_plin_url=local_cfg.qr_plin_url,
                        instrucciones_pago=local_cfg.instrucciones_pago
                    ))
                stats["configuracion_tienda"] += 1

        # 3. Tarifas de Envío
        local_rates = source_session.query(TarifaEnvio).all()
        for r in local_rates:
            existing_rate = target_session.query(TarifaEnvio).filter(TarifaEnvio.nombre == r.nombre).first()
            if not existing_rate:
                if not dry_run:
                    target_session.add(TarifaEnvio(
                        nombre=r.nombre,
                        tipo=r.tipo,
                        costo=r.costo,
                        tiempo_entrega=r.tiempo_entrega,
                        activo=r.activo,
                        notas=r.notas
                    ))
                stats["tarifas_envio"] += 1

        # 4. Clientes
        local_clients = source_session.query(Cliente).all()
        for c in local_clients:
            existing_c = target_session.query(Cliente).filter(
                (Cliente.nombre == c.nombre) | (Cliente.telefono_whatsapp == c.telefono_whatsapp)
            ).first() if (c.telefono_whatsapp or c.nombre) else None

            if not existing_c:
                if not dry_run:
                    target_session.add(Cliente(
                        nombre=c.nombre,
                        telefono_whatsapp=c.telefono_whatsapp,
                        distrito_ciudad=c.distrito_ciudad,
                        direccion=c.direccion,
                        notas=c.notas,
                        total_compras=c.total_compras,
                        fecha_registro=c.fecha_registro or datetime.utcnow(),
                        ultima_compra=c.ultima_compra
                    ))
                stats["clientes"] += 1

        # 5. Ventas
        local_ventas = source_session.query(Venta).all()
        for v in local_ventas:
            existing_v = target_session.query(Venta).filter(
                (Venta.nombre_producto == v.nombre_producto) & (Venta.fecha_venta == v.fecha_venta)
            ).first()

            if not existing_v:
                if not dry_run:
                    target_session.add(Venta(
                        producto_propio_id=None,
                        nombre_producto=v.nombre_producto,
                        cantidad_vendida=v.cantidad_vendida,
                        precio_venta_unitario=v.precio_venta_unitario,
                        costo_unitario=v.costo_unitario,
                        comision_envio_monto=v.comision_envio_monto,
                        ganancia_neta_real=v.ganancia_neta_real,
                        canal_venta=v.canal_venta,
                        telefono_cliente=v.telefono_cliente,
                        notas=v.notas,
                        fecha_venta=v.fecha_venta or datetime.utcnow()
                    ))
                stats["ventas"] += 1

        # 6. Alertas / Watchlist
        local_alertas = source_session.query(AlertaProducto).all()
        for a in local_alertas:
            existing_a = target_session.query(AlertaProducto).filter(AlertaProducto.termino_busqueda == a.termino_busqueda).first()
            if not existing_a:
                if not dry_run:
                    target_session.add(AlertaProducto(
                        termino_busqueda=a.termino_busqueda,
                        precio_maximo=a.precio_maximo,
                        margen_minimo_pct=a.margen_minimo_pct,
                        tiendas_objetivo=a.tiendas_objetivo,
                        activo=a.activo,
                        fecha_creacion=a.fecha_creacion or datetime.utcnow()
                    ))
                stats["alertas_productos"] += 1

        # 7. Tiendas Personalizadas
        local_stores = source_session.query(TiendaPersonalizada).all()
        for s in local_stores:
            existing_s = target_session.query(TiendaPersonalizada).filter(TiendaPersonalizada.nombre == s.nombre).first()
            if not existing_s:
                if not dry_run:
                    target_session.add(TiendaPersonalizada(
                        nombre=s.nombre,
                        url_web=s.url_web,
                        url_busqueda=s.url_busqueda,
                        categoria=s.categoria,
                        contacto_whatsapp=s.contacto_whatsapp,
                        comision_estimada=s.comision_estimada,
                        activo=s.activo,
                        notas=s.notas,
                        fecha_registro=s.fecha_registro or datetime.utcnow()
                    ))
                stats["tiendas_personalizadas"] += 1

        # 8. Pedidos Web
        local_orders = source_session.query(PedidoWeb).all()
        for o in local_orders:
            existing_o = target_session.query(PedidoWeb).filter(PedidoWeb.codigo_pedido == o.codigo_pedido).first()
            if not existing_o:
                if not dry_run:
                    target_session.add(PedidoWeb(
                        codigo_pedido=o.codigo_pedido,
                        nombre_cliente=o.nombre_cliente,
                        telefono_cliente=o.telefono_cliente,
                        direccion_distrito=o.direccion_distrito,
                        metodo_pago=o.metodo_pago,
                        estado=o.estado,
                        comprobante_url=o.comprobante_url,
                        items_json=o.items_json,
                        total_monto=o.total_monto,
                        notas=o.notas,
                        fecha_pedido=o.fecha_pedido or datetime.utcnow()
                    ))
                stats["pedidos_web"] += 1

        # 9. Items Lote
        local_lot = source_session.query(ItemLote).all()
        for li in local_lot:
            existing_li = target_session.query(ItemLote).filter(
                (ItemLote.nombre == li.nombre) & (ItemLote.tienda == li.tienda) & (ItemLote.costo_compra == li.costo_compra)
            ).first()
            if not existing_li:
                if not dry_run:
                    target_session.add(ItemLote(
                        origen=li.origen,
                        referencia_id=li.referencia_id,
                        nombre=li.nombre,
                        tienda=li.tienda,
                        foto_url=li.foto_url,
                        cantidad=li.cantidad,
                        costo_compra=li.costo_compra,
                        precio_venta=li.precio_venta,
                        url_compra=li.url_compra,
                        tiempo_entrega=li.tiempo_entrega,
                        notas=li.notas,
                        fecha_agregado=li.fecha_agregado or datetime.utcnow()
                    ))
                stats["items_lote"] += 1

        if not dry_run:
            target_session.commit()
            logger.info("Migración completada exitosamente y confirmada en destino.")
        else:
            logger.info("Modo [DRY-RUN]: Simulación completada sin cambios reales en destino.")

        print("\n" + "=" * 50)
        print(" RESUMEN DE MIGRACIÓN DE REGISTROS:")
        print("=" * 50)
        for tbl, count in stats.items():
            print(f"  • {tbl.ljust(25)}: {count} registros transferidos/validados")
        print("=" * 50 + "\n")

    finally:
        target_session.close()


def resolve_source_db() -> Path:
    """Detecta automáticamente el archivo de base de datos local con datos."""
    candidates = [
        DATA_DIR / "sistema.db",
        BASE_DIR / "kipustock.db",
        DATA_DIR / "kipustock.db"
    ]
    for c in candidates:
        if c.exists() and c.stat().st_size > 0:
            return c
    return DATA_DIR / "sistema.db"


def main():
    parser = argparse.ArgumentParser(description="Migrador de datos KipuStock a la nube ($0)")
    parser.add_argument("--url", type=str, help="DATABASE_URL de destino (PostgreSQL / Supabase / Neon)")
    parser.add_argument("--dry-run", action="store_true", help="Simula la migración sin escribir en destino")
    parser.add_argument("--export-json", action="store_true", help="Genera backup JSON de los datos actuales")
    args = parser.parse_args()

    source_db_file = resolve_source_db()
    if not source_db_file.exists():
        logger.error(f"Archivo de base de datos local no encontrado: {source_db_file}")
        sys.exit(1)

    logger.info(f"Origen de datos local detectado: {source_db_file.name} ({source_db_file.stat().st_size} bytes)")
    source_engine = create_engine(f"sqlite:///{source_db_file}", connect_args={"check_same_thread": False})
    SourceSession = sessionmaker(bind=source_engine)
    source_session = SourceSession()

    try:
        # Generar backup JSON si se solicita
        backup_file = DATA_DIR / f"backup_kipustock_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        if args.export_json:
            export_to_json(source_session, backup_file)
            return

        # Siempre exportar un backup antes de migrar por seguridad
        export_to_json(source_session, DATA_DIR / "backup_latest.json")

        dest_url = args.url or os.getenv("DATABASE_URL", "").strip()
        if dest_url.startswith("postgres://"):
            dest_url = dest_url.replace("postgres://", "postgresql://", 1)

        if not dest_url or dest_url.startswith("sqlite"):
            logger.warning("No se proporcionó DATABASE_URL remota. Usando modo de validación local.")
            dest_url = f"sqlite:///{LOCAL_DB_FILE}"

        target_engine = create_engine(dest_url, pool_pre_ping=True)
        migrate_to_database(source_session, target_engine, dry_run=args.dry_run)

    finally:
        source_session.close()


if __name__ == "__main__":
    main()
