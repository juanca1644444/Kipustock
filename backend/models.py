from datetime import datetime
from typing import Optional, List, Dict
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field
from backend.database import Base

# ==========================================
# MODELOS SQLALCHEMY (Base de datos SQLite)
# ==========================================

class ProductoPropio(Base):
    __tablename__ = "productos_propios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False, index=True)
    modelo = Column(String(100), nullable=True)
    sku = Column(String(50), nullable=True, unique=True)
    foto_url = Column(String(500), nullable=True)
    stock = Column(Integer, default=0, nullable=False)
    costo_unitario = Column(Float, default=0.0, nullable=False)
    precio_venta = Column(Float, default=0.0, nullable=False)
    estado = Column(String(50), default="Nuevo", nullable=False)  # "Nuevo", "Saldo", "Liquidación", "Bajo Pedido"
    url_compra = Column(String(500), nullable=True)
    proveedor = Column(String(100), default="Inventario Propio", nullable=True)
    tiempo_entrega = Column(String(100), default="Inmediata", nullable=True)
    notas = Column(Text, nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    @property
    def es_bajo_pedido(self) -> bool:
        return (self.estado or "").strip().lower() in ["bajo pedido", "por encargo"]

    @property
    def margen_unitario(self) -> float:
        return round(self.precio_venta - self.costo_unitario, 2)

    @property
    def margen_porcentaje(self) -> float:
        if self.costo_unitario > 0:
            return round(((self.precio_venta - self.costo_unitario) / self.costo_unitario) * 100, 1)
        return 0.0

    @property
    def ganancia_total_potencial(self) -> float:
        return round(self.margen_unitario * self.stock, 2)


class ItemLote(Base):
    __tablename__ = "items_lote"

    id = Column(Integer, primary_key=True, index=True)
    origen = Column(String(20), nullable=False)  # "PROPIO" o "EXTERNO"
    referencia_id = Column(Integer, nullable=True)  # ID si es producto propio
    nombre = Column(String(255), nullable=False)
    tienda = Column(String(100), default="Inventario Propio")
    foto_url = Column(String(500), nullable=True)
    cantidad = Column(Integer, default=1, nullable=False)
    costo_compra = Column(Float, default=0.0, nullable=False)  # Inversión por unidad
    precio_venta = Column(Float, default=0.0, nullable=False)  # Precio de venta esperado
    url_compra = Column(String(500), nullable=True)
    tiempo_entrega = Column(String(100), default="24 a 48 hrs", nullable=True)
    notas = Column(Text, nullable=True)
    fecha_agregado = Column(DateTime, default=datetime.utcnow)

    @property
    def subtotal_costo(self) -> float:
        return round(self.costo_compra * self.cantidad, 2)

    @property
    def subtotal_venta(self) -> float:
        return round(self.precio_venta * self.cantidad, 2)

    @property
    def ganancia_estimada(self) -> float:
        return round(self.subtotal_venta - self.subtotal_costo, 2)


class Venta(Base):
    __tablename__ = "ventas"

    id = Column(Integer, primary_key=True, index=True)
    producto_propio_id = Column(Integer, ForeignKey("productos_propios.id", ondelete="SET NULL"), nullable=True)
    nombre_producto = Column(String(255), nullable=False, index=True)
    cantidad_vendida = Column(Integer, default=1, nullable=False)
    precio_venta_unitario = Column(Float, nullable=False)
    costo_unitario = Column(Float, default=0.0, nullable=False)
    comision_envio_monto = Column(Float, default=0.0)
    ganancia_neta_real = Column(Float, nullable=False)
    canal_venta = Column(String(100), default="Venta Directa", nullable=False)
    telefono_cliente = Column(String(50), nullable=True)
    fecha_venta = Column(DateTime, default=datetime.utcnow, nullable=False)
    notas = Column(Text, nullable=True)

    @property
    def total_ingreso(self) -> float:
        return round(self.precio_venta_unitario * self.cantidad_vendida, 2)

    @property
    def total_costo(self) -> float:
        return round(self.costo_unitario * self.cantidad_vendida, 2)

    @property
    def margen_porcentaje(self) -> float:
        costo_total = self.costo_unitario * self.cantidad_vendida
        if costo_total > 0:
            return round((self.ganancia_neta_real / costo_total) * 100, 1)
        return 0.0


class AlertaProducto(Base):
    __tablename__ = "alertas_productos"

    id = Column(Integer, primary_key=True, index=True)
    termino_busqueda = Column(String(200), nullable=False, index=True)
    precio_maximo = Column(Float, nullable=True)
    margen_minimo_pct = Column(Float, default=20.0, nullable=False)
    tiendas_objetivo = Column(String(500), default="Falabella,Ripley,Sodimac", nullable=False)
    activo = Column(Integer, default=1, nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)


class ConfiguracionTienda(Base):
    __tablename__ = "configuracion_tienda"

    id = Column(Integer, primary_key=True, index=True)
    nombre_tienda = Column(String(100), default="KipuStock Store", nullable=False)
    whatsapp_ventas = Column(String(50), default="51944830586", nullable=False)
    mensaje_bienvenida = Column(Text, default="¡Bienvenido a KipuStock Store! Productos de alta rotación con entrega inmediata y garantía.", nullable=False)
    qr_yape_url = Column(String(500), nullable=True)
    qr_plin_url = Column(String(500), nullable=True)
    instrucciones_pago = Column(Text, default="Realiza tu pago vía Yape o Plin al número oficial y envía la constancia por WhatsApp para validar y despachar tu pedido.", nullable=False)


class PedidoWeb(Base):
    __tablename__ = "pedidos_web"

    id = Column(Integer, primary_key=True, index=True)
    codigo_pedido = Column(String(30), unique=True, index=True, nullable=False)
    nombre_cliente = Column(String(150), nullable=False)
    telefono_cliente = Column(String(50), nullable=False)
    direccion_distrito = Column(String(255), nullable=False)
    metodo_pago = Column(String(50), default="WhatsApp", nullable=False)  # "WhatsApp", "Yape", "Plin", "Contraentrega"
    estado = Column(String(50), default="Pendiente", nullable=False)      # "Pendiente", "Aprobado", "Rechazado"
    comprobante_url = Column(String(500), nullable=True)
    items_json = Column(Text, nullable=False)                             # Lista JSON de ítems
    total_monto = Column(Float, default=0.0, nullable=False)
    notas = Column(Text, nullable=True)
    fecha_pedido = Column(DateTime, default=datetime.utcnow, nullable=False)


class TiendaPersonalizada(Base):
    __tablename__ = "tiendas_personalizadas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    url_web = Column(String(500), nullable=False)
    url_busqueda = Column(String(500), nullable=True)
    categoria = Column(String(100), default="General", nullable=False)
    contacto_whatsapp = Column(String(50), nullable=True)
    comision_estimada = Column(Float, default=10.0, nullable=False)
    activo = Column(Integer, default=1, nullable=False)
    notas = Column(Text, nullable=True)
    fecha_registro = Column(DateTime, default=datetime.utcnow, nullable=False)


class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False, index=True)
    telefono_whatsapp = Column(String(50), nullable=True, index=True)
    distrito_ciudad = Column(String(150), nullable=True)
    direccion = Column(String(255), nullable=True)
    notas = Column(Text, nullable=True)
    total_compras = Column(Float, default=0.0, nullable=False)
    fecha_registro = Column(DateTime, default=datetime.utcnow, nullable=False)
    ultima_compra = Column(DateTime, nullable=True)


class TarifaEnvio(Base):
    __tablename__ = "tarifas_envio"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    tipo = Column(String(100), default="Local", nullable=False)  # Local, Periferia, Shalom, Olva, Tienda
    costo = Column(Float, default=0.0, nullable=False)
    tiempo_entrega = Column(String(100), default="24 a 48 hrs", nullable=False)
    activo = Column(Integer, default=1, nullable=False)
    notas = Column(Text, nullable=True)


# ==========================================
# ESQUEMAS PYDANTIC (Validación y Serialización)
# ==========================================

class ProductoBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=255)
    modelo: Optional[str] = None
    sku: Optional[str] = None
    foto_url: Optional[str] = None
    stock: int = Field(default=0, ge=0)
    costo_unitario: float = Field(default=0.0, ge=0)
    precio_venta: float = Field(default=0.0, ge=0)
    estado: str = Field(default="Nuevo")  # "Nuevo", "Saldo", "Liquidación", "Bajo Pedido"
    url_compra: Optional[str] = None
    proveedor: Optional[str] = "Inventario Propio"
    tiempo_entrega: Optional[str] = "Inmediata"
    notas: Optional[str] = None

class ProductoCreate(ProductoBase):
    pass

class ProductoUpdateStock(BaseModel):
    stock: int = Field(..., ge=0)

class ProductoResponse(ProductoBase):
    id: int
    fecha_creacion: datetime
    margen_unitario: float
    margen_porcentaje: float
    ganancia_total_potencial: float
    es_bajo_pedido: bool = False

    class Config:
        from_attributes = True


class ItemLoteCreate(BaseModel):
    origen: str = Field(..., description="'PROPIO' o 'EXTERNO'")
    referencia_id: Optional[int] = None
    nombre: str
    tienda: str = "Inventario Propio"
    foto_url: Optional[str] = None
    cantidad: int = Field(default=1, ge=1)
    costo_compra: float = Field(default=0.0, ge=0)
    precio_venta: float = Field(default=0.0, ge=0)
    url_compra: Optional[str] = None
    tiempo_entrega: Optional[str] = "24 a 48 hrs"
    notas: Optional[str] = None

class ItemLoteUpdate(BaseModel):
    cantidad: int = Field(..., ge=1)

class ItemLoteResponse(BaseModel):
    id: int
    origen: str
    referencia_id: Optional[int] = None
    nombre: str
    tienda: str
    foto_url: Optional[str] = None
    cantidad: int
    costo_compra: float
    precio_venta: float
    url_compra: Optional[str] = None
    tiempo_entrega: Optional[str] = "24 a 48 hrs"
    notas: Optional[str] = None
    subtotal_costo: float
    subtotal_venta: float
    ganancia_estimada: float

    class Config:
        from_attributes = True


class ResumenFinancieroLote(BaseModel):
    inversion_nueva: float = 0.0      # Solo ítems externos
    stock_propio_valor: float = 0.0   # Valor de costo del stock propio comprometido
    ingreso_bruto_proyectado: float = 0.0
    ganancia_neta_total: float = 0.0
    margen_promedio_porcentaje: float = 0.0
    total_unidades: int = 0
    total_items: int = 0


class BusquedaFiltros(BaseModel):
    query: str = ""
    target_sites: List[str] = Field(default_factory=lambda: ["Mercado Libre", "Falabella", "Ripley", "Sodimac", "AliExpress"])
    max_price: Optional[float] = None
    min_margin_percent: Optional[float] = None
    commission_percent: float = Field(default=12.0, ge=0, le=100)
    image_filename: Optional[str] = None

class CoincidenciaInventario(BaseModel):
    encontrado: bool
    producto_id: Optional[int] = None
    nombre: Optional[str] = None
    stock_actual: Optional[int] = None
    costo_unitario: Optional[float] = None
    precio_venta: Optional[float] = None
    mensaje: Optional[str] = None

class ResultadoArbitrajeItem(BaseModel):
    id: str
    nombre: str
    sitio: str
    sitio_url: str
    url_compra: Optional[str] = None
    foto_url: str
    precio_compra: float
    precio_referencia_venta: float
    costo_comision: Optional[float] = None
    comision_percent: Optional[float] = 12.0
    margen_neto: float
    margen_porcentaje: float
    disponibilidad: str
    calificacion: float
    envio: str
    es_relevante_ia: bool = True
    coincidencia_inventario: Optional[CoincidenciaInventario] = None


class GenerarImagenRequest(BaseModel):
    nombre_producto: str
    descripcion: Optional[str] = None
    estilo: str = Field(default="estudio")  # estudio, lifestyle, marketing
    generar_copy: bool = False
    producto_propio_id: Optional[int] = None

class GenerarImagenResponse(BaseModel):
    status: str
    url: str
    filename: str
    estilo: str
    copy_redes: Optional[str] = None
    mensaje: str
    producto_propio_actualizado: bool = False


# ==========================================
# ESQUEMAS PYDANTIC PARA REGISTRO DE VENTAS
# ==========================================

class VentaCreate(BaseModel):
    producto_propio_id: Optional[int] = None
    nombre_producto: str = Field(..., min_length=1, max_length=255)
    cantidad_vendida: int = Field(default=1, ge=1)
    precio_venta_unitario: float = Field(..., ge=0)
    costo_unitario: float = Field(default=0.0, ge=0)
    comision_envio_monto: float = Field(default=0.0, ge=0)
    canal_venta: str = Field(default="Venta Directa")
    telefono_cliente: Optional[str] = None
    cliente_nombre: Optional[str] = None
    distrito_cliente: Optional[str] = None
    tarifa_envio_id: Optional[int] = None
    notas: Optional[str] = None

class VentaResponse(BaseModel):
    id: int
    producto_propio_id: Optional[int] = None
    nombre_producto: str
    cantidad_vendida: int
    precio_venta_unitario: float
    costo_unitario: float
    comision_envio_monto: float
    ganancia_neta_real: float
    canal_venta: str
    telefono_cliente: Optional[str] = None
    fecha_venta: datetime
    notas: Optional[str] = None
    total_ingreso: float
    total_costo: float
    margen_porcentaje: float

    class Config:
        from_attributes = True


class VentasResumen(BaseModel):
    total_ventas_monto: float = 0.0          # Ingresos brutos recaudados
    total_costos_monto: float = 0.0          # Costo de la mercadería vendida
    total_comisiones_envio: float = 0.0      # Comisiones y envíos pagados
    ganancia_neta_acumulada: float = 0.0     # Beneficio neto de bolsillo
    total_unidades_vendidas: int = 0
    total_operaciones: int = 0
    margen_promedio_porcentaje: float = 0.0

class VentasListResponse(BaseModel):
    ventas: List[VentaResponse]
    resumen: VentasResumen


class ConfirmarVentasLoteRequest(BaseModel):
    canal_venta: str = Field(default="Venta Directa")
    limpiar_lote: bool = Field(default=True)
    comision_global_monto: float = Field(default=0.0, ge=0)


# ==========================================
# ESQUEMAS PYDANTIC PARA MONITOR DE ALERTAS
# ==========================================

class AlertaProductoCreate(BaseModel):
    termino_busqueda: str = Field(..., min_length=2, max_length=200)
    precio_maximo: Optional[float] = None
    margen_minimo_pct: float = Field(default=20.0, ge=0)
    tiendas_objetivo: Optional[str] = "Falabella,Ripley,Sodimac"

class AlertaProductoResponse(BaseModel):
    id: int
    termino_busqueda: str
    precio_maximo: Optional[float] = None
    margen_minimo_pct: float
    tiendas_objetivo: str
    activo: int
    fecha_creacion: datetime

    class Config:
        from_attributes = True


class AlertaResultadoItem(BaseModel):
    alerta_id: int
    termino_busqueda: str
    oportunidades: List[ResultadoArbitrajeItem]
    total_encontradas: int




# ==========================================
# ESQUEMAS PYDANTIC: TIENDA PÚBLICA Y PEDIDOS
# ==========================================

class ProductoTiendaPublico(BaseModel):
    id: int
    nombre: str
    modelo: Optional[str] = None
    sku: Optional[str] = None
    foto_url: Optional[str] = None
    precio_venta: float
    stock: int
    estado: str
    tiempo_entrega: Optional[str] = "Inmediata"
    es_bajo_pedido: bool = False
    proveedor: Optional[str] = None
    notas: Optional[str] = None

    class Config:
        from_attributes = True


class PublishOnDemandRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=255)
    tienda: str = Field(default="Proveedor Externo")
    precio_compra: float = Field(default=0.0, ge=0)
    precio_venta: float = Field(..., ge=0)
    foto_url: Optional[str] = None
    url_compra: Optional[str] = None
    modelo: Optional[str] = None
    tiempo_entrega: Optional[str] = "24 a 48 hrs"
    notas: Optional[str] = None
    agregar_a_lote: bool = Field(default=True)


class CompleteOrderCashOnDeliveryRequest(BaseModel):
    metodo_cobro: str = Field(default="Contraentrega", description="Efectivo, Yape, Plin o Contraentrega")
    costo_real_compra: Optional[float] = None
    notas_entrega: Optional[str] = None


class ConfiguracionTiendaBase(BaseModel):
    nombre_tienda: str = "KipuStock Store"
    whatsapp_ventas: str = "51944830586"
    mensaje_bienvenida: str = "¡Bienvenido a KipuStock Store! Productos de alta rotación con entrega inmediata y garantía."
    qr_yape_url: Optional[str] = None
    qr_plin_url: Optional[str] = None
    instrucciones_pago: str = "Realiza tu pago vía Yape o Plin al número oficial y envía la constancia por WhatsApp para validar y despachar tu pedido."


class ConfiguracionTiendaResponse(ConfiguracionTiendaBase):
    id: int

    class Config:
        from_attributes = True


class ConfiguracionTiendaUpdate(BaseModel):
    nombre_tienda: Optional[str] = None
    whatsapp_ventas: Optional[str] = None
    mensaje_bienvenida: Optional[str] = None
    qr_yape_url: Optional[str] = None
    qr_plin_url: Optional[str] = None
    instrucciones_pago: Optional[str] = None


class TunnelConfigRequest(BaseModel):
    token: Optional[str] = Field(default="", description="Token de Cloudflare Named Tunnel")
    fixed_domain: Optional[str] = Field(default="", description="Dominio o subdominio asignado en Cloudflare")


class PedidoWebItem(BaseModel):
    producto_id: int
    nombre: str
    cantidad: int = Field(default=1, ge=1)
    precio_unitario: float = Field(..., ge=0)
    subtotal: Optional[float] = None


class PedidoWebCreate(BaseModel):
    nombre_cliente: str = Field(..., min_length=2, max_length=150)
    telefono_cliente: str = Field(..., min_length=6, max_length=50)
    direccion_distrito: str = Field(..., min_length=3, max_length=255)
    metodo_pago: str = Field(default="WhatsApp")  # "WhatsApp", "Yape", "Plin", "Contraentrega"
    items: List[PedidoWebItem]
    total_monto: float = Field(..., ge=0)
    comprobante_url: Optional[str] = None
    notas: Optional[str] = None


class PedidoWebResponse(BaseModel):
    id: int
    codigo_pedido: str
    nombre_cliente: str
    telefono_cliente: str
    direccion_distrito: str
    metodo_pago: str
    estado: str
    comprobante_url: Optional[str] = None
    items_json: str
    total_monto: float
    notas: Optional[str] = None
    fecha_pedido: datetime

    class Config:
        from_attributes = True

class CampaignGenerateRequest(BaseModel):
    producto_propio_id: Optional[int] = None
    item_lote_id: Optional[int] = None
    nombre: Optional[str] = None
    modelo: Optional[str] = None
    estado: Optional[str] = "Nuevo"
    precio_venta: Optional[float] = None
    precio_oferta: Optional[float] = None
    margen_beneficio: Optional[float] = None
    stock: Optional[int] = None
    enlace: Optional[str] = None
    descripcion: Optional[str] = None
    foto_url: Optional[str] = None
    tono: str = Field(default="Urgencia / Oferta Flash")
    formatos: Optional[List[str]] = Field(default=["1:1", "9:16"])
    canales: Optional[List[str]] = Field(default=["marketplace", "stories_reels", "whatsapp_broadcast", "email_promo"])
    url_publica_tienda: Optional[str] = None
    whatsapp_contacto: Optional[str] = None
    moneda: str = Field(default="PEN")


class CampaignGenerateResponse(BaseModel):
    status: str
    campaign_id: str
    producto_nombre: str
    feed_1x1_url: Optional[str] = None
    story_9x16_url: Optional[str] = None
    download_pack_url: str
    copys: Dict[str, str]
    mensaje: str


class TiendaPersonalizadaBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=150)
    url_web: str = Field(..., min_length=4, max_length=500)
    url_busqueda: Optional[str] = None
    categoria: str = Field(default="General")
    contacto_whatsapp: Optional[str] = None
    comision_estimada: float = Field(default=10.0, ge=0.0, le=100.0)
    activo: bool = Field(default=True)
    notas: Optional[str] = None


class TiendaPersonalizadaCreate(TiendaPersonalizadaBase):
    pass


class TiendaPersonalizadaUpdate(BaseModel):
    nombre: Optional[str] = None
    url_web: Optional[str] = None
    url_busqueda: Optional[str] = None
    categoria: Optional[str] = None
    contacto_whatsapp: Optional[str] = None
    comision_estimada: Optional[float] = None
    activo: Optional[bool] = None
    notas: Optional[str] = None


class TiendaPersonalizadaResponse(TiendaPersonalizadaBase):
    id: int
    fecha_registro: datetime

    class Config:
        from_attributes = True


# ==========================================
# ESQUEMAS PARA CRM CLIENTES Y TARIFAS DE ENVÍO
# ==========================================

class ClienteBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=150)
    telefono_whatsapp: Optional[str] = None
    distrito_ciudad: Optional[str] = None
    direccion: Optional[str] = None
    notas: Optional[str] = None


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    telefono_whatsapp: Optional[str] = None
    distrito_ciudad: Optional[str] = None
    direccion: Optional[str] = None
    notas: Optional[str] = None


class ClienteResponse(ClienteBase):
    id: int
    total_compras: float
    fecha_registro: datetime
    ultima_compra: Optional[datetime] = None

    class Config:
        from_attributes = True


class TarifaEnvioBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=150)
    tipo: str = Field(default="Local", max_length=100)
    costo: float = Field(default=0.0, ge=0.0)
    tiempo_entrega: str = Field(default="24 a 48 hrs", max_length=100)
    activo: bool = Field(default=True)
    notas: Optional[str] = None


class TarifaEnvioCreate(TarifaEnvioBase):
    pass


class TarifaEnvioUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    costo: Optional[float] = None
    tiempo_entrega: Optional[str] = None
    activo: Optional[bool] = None
    notas: Optional[str] = None


class TarifaEnvioResponse(TarifaEnvioBase):
    id: int

    class Config:
        from_attributes = True


class QuoteItem(BaseModel):
    producto_id: Optional[int] = None
    nombre: str = Field(..., min_length=1)
    cantidad: int = Field(default=1, ge=1)
    precio_unitario: float = Field(..., ge=0.0)
    subtotal: Optional[float] = None


class QuoteGenerateRequest(BaseModel):
    cliente_id: Optional[int] = None
    cliente_nombre: Optional[str] = "Cliente General"
    cliente_telefono: Optional[str] = None
    cliente_distrito: Optional[str] = None
    cliente_direccion: Optional[str] = None
    items: List[QuoteItem]
    tarifa_envio_id: Optional[int] = None
    costo_envio: Optional[float] = 0.0
    metodo_envio: Optional[str] = "Entrega por Coordinar"
    moneda: str = Field(default="PEN")
    tipo_cambio: Optional[float] = 3.75
    validez_dias: int = Field(default=2, ge=1, le=30)
    notas: Optional[str] = None


class QuoteGenerateResponse(BaseModel):
    status: str
    correlativo: str
    pdf_url: str
    download_filename: str
    subtotal_productos: float
    costo_envio: float
    total: float
    moneda: str
    whatsapp_message: str
    mensaje: str

