-- ==============================================================================
-- KIPUSTOCK - ESQUEMA DE BASE DE DATOS UNIFICADO ($0 CLOUD / POSTGRESQL / SQLITE)
-- Compatible con Supabase, Neon, Render PostgreSQL y SQLite local
-- ==============================================================================

-- 1. TABLA: PRODUCTOS PROPIOS (INVENTARIO FÍSICO Y PRODUCTOS BAJO PEDIDO)
CREATE TABLE IF NOT EXISTS productos_propios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    modelo VARCHAR(100),
    sku VARCHAR(50) UNIQUE,
    foto_url VARCHAR(500),
    stock INTEGER DEFAULT 0 NOT NULL,
    costo_unitario NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    precio_venta NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    estado VARCHAR(50) DEFAULT 'Nuevo' NOT NULL, -- 'Nuevo', 'Saldo', 'Liquidación', 'Bajo Pedido'
    url_compra VARCHAR(500),
    proveedor VARCHAR(100) DEFAULT 'Inventario Propio',
    tiempo_entrega VARCHAR(100) DEFAULT 'Inmediata',
    notas TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prod_nombre ON productos_propios(nombre);
CREATE INDEX IF NOT EXISTS idx_prod_sku ON productos_propios(sku);


-- 2. TABLA: ITEMS DEL LOTE DE OPERACIÓN (ARBITRAJE Y SEGUIMIENTO)
CREATE TABLE IF NOT EXISTS items_lote (
    id SERIAL PRIMARY KEY,
    origen VARCHAR(20) NOT NULL, -- 'PROPIO' o 'EXTERNO'
    referencia_id INTEGER,
    nombre VARCHAR(255) NOT NULL,
    tienda VARCHAR(100) DEFAULT 'Inventario Propio',
    foto_url VARCHAR(500),
    cantidad INTEGER DEFAULT 1 NOT NULL,
    costo_compra NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    precio_venta NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    url_compra VARCHAR(500),
    tiempo_entrega VARCHAR(100) DEFAULT '24 a 48 hrs',
    notas TEXT,
    fecha_agregado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 3. TABLA: HISTORIAL DE VENTAS Y GANANCIAS REALES
CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    producto_propio_id INTEGER REFERENCES productos_propios(id) ON DELETE SET NULL,
    nombre_producto VARCHAR(255) NOT NULL,
    cantidad_vendida INTEGER DEFAULT 1 NOT NULL,
    precio_venta_unitario NUMERIC(10, 2) NOT NULL,
    costo_unitario NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    comision_envio_monto NUMERIC(10, 2) DEFAULT 0.00,
    ganancia_neta_real NUMERIC(10, 2) NOT NULL,
    canal_venta VARCHAR(100) DEFAULT 'Venta Directa' NOT NULL,
    telefono_cliente VARCHAR(50),
    notas TEXT,
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ventas_producto ON ventas(nombre_producto);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha_venta);


-- 4. TABLA: MONITOR DE ALERTAS Y WATCHLIST DE OPORTUNIDADES
CREATE TABLE IF NOT EXISTS alertas_productos (
    id SERIAL PRIMARY KEY,
    termino_busqueda VARCHAR(200) NOT NULL,
    precio_maximo NUMERIC(10, 2),
    margen_minimo_pct NUMERIC(5, 2) DEFAULT 20.00 NOT NULL,
    tiendas_objetivo VARCHAR(500) DEFAULT 'Falabella,Ripley,Sodimac' NOT NULL,
    activo INTEGER DEFAULT 1 NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alertas_termino ON alertas_productos(termino_busqueda);


-- 5. TABLA: CONFIGURACIÓN DE TIENDA WEB Y MEDIOS DE PAGO
CREATE TABLE IF NOT EXISTS configuracion_tienda (
    id SERIAL PRIMARY KEY,
    nombre_tienda VARCHAR(100) DEFAULT 'KipuStock Store' NOT NULL,
    whatsapp_ventas VARCHAR(50) DEFAULT '51944830586' NOT NULL,
    mensaje_bienvenida TEXT DEFAULT '¡Bienvenido a KipuStock Store! Productos con entrega inmediata y garantía.' NOT NULL,
    qr_yape_url VARCHAR(500),
    qr_plin_url VARCHAR(500),
    instrucciones_pago TEXT DEFAULT 'Realiza tu pago vía Yape o Plin al número oficial y envía la constancia por WhatsApp para despachar tu pedido.' NOT NULL
);


-- 6. TABLA: PEDIDOS WEB DE CLIENTES (MOSTRADOR Y CATÁLOGO ONLINE)
CREATE TABLE IF NOT EXISTS pedidos_web (
    id SERIAL PRIMARY KEY,
    codigo_pedido VARCHAR(30) UNIQUE NOT NULL,
    nombre_cliente VARCHAR(150) NOT NULL,
    telefono_cliente VARCHAR(50) NOT NULL,
    direccion_distrito VARCHAR(255) NOT NULL,
    metodo_pago VARCHAR(50) DEFAULT 'WhatsApp' NOT NULL,
    estado VARCHAR(50) DEFAULT 'Pendiente' NOT NULL, -- 'Pendiente', 'Aprobado', 'Rechazado', 'Comprado'
    comprobante_url VARCHAR(500),
    items_json TEXT NOT NULL,
    total_monto NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    notas TEXT,
    fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pedidos_codigo ON pedidos_web(codigo_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_telefono ON pedidos_web(telefono_cliente);


-- 7. TABLA: PROVEEDORES Y TIENDAS PERSONALIZADAS
CREATE TABLE IF NOT EXISTS tiendas_personalizadas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    url_web VARCHAR(500) NOT NULL,
    url_busqueda VARCHAR(500),
    categoria VARCHAR(100) DEFAULT 'General' NOT NULL,
    contacto_whatsapp VARCHAR(50),
    comision_estimada NUMERIC(5, 2) DEFAULT 10.00 NOT NULL,
    activo INTEGER DEFAULT 1 NOT NULL,
    notas TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);


-- 8. TABLA: CLIENTES Y CRM DE VENTAS
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    telefono_whatsapp VARCHAR(50),
    distrito_ciudad VARCHAR(150),
    direccion VARCHAR(255),
    notas TEXT,
    total_compras NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ultima_compra TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_tel ON clientes(telefono_whatsapp);


-- 9. TABLA: TARIFAS DE ENVÍO Y DESPACHO
CREATE TABLE IF NOT EXISTS tarifas_envio (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(100) DEFAULT 'Local' NOT NULL, -- 'Local', 'Periferia', 'Shalom', 'Olva', 'Punto de entrega'
    costo NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    tiempo_entrega VARCHAR(100) DEFAULT '24 a 48 hrs' NOT NULL,
    activo INTEGER DEFAULT 1 NOT NULL,
    notas TEXT
);
