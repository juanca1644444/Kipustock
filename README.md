# 📦 Kipustock - Sistema de Arbitraje Comercial, Rastreo de Mercaderías & Gestión de Inventario

Sistema modular de arbitraje comercial y gestión de inventario con **costo $0** (usando la capa gratuita de Google Gemini API y herramientas locales open-source).

---

## 🚀 Inicio Rápido (Comandos Exactos)

### 1. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 2. Instalar el navegador headless de Playwright
```bash
playwright install chromium
```
*(Alternativa recomendada en Windows: `python -m playwright install chromium`)*

### 3. Configurar API Key gratuita de Google Gemini (Opcional pero recomendado)
Copia el archivo `.env.example` como `.env` y coloca tu API Key de Google AI Studio:
```bash
copy .env.example .env
```
Edita `.env` con tu clave:
```env
GEMINI_API_KEY="tu_api_key_gratuita_de_google_ai_studio"
DEFAULT_COMMISSION_PERCENT=12.0
```
> [!NOTE]
> Puedes obtener tu clave gratis en [Google AI Studio](https://aistudio.google.com/). Si no configuras la clave, **Kipustock activará automáticamente su modo de fallback heurístico seguro** sin caídas ni bloqueos.

### 4. Levantar la aplicación local
```bash
uvicorn backend.main:app --reload
```
*(Alternativa en Windows: `python -m uvicorn backend.main:app --reload`)*

Abre tu navegador en:
👉 **http://127.0.0.1:8000**

---

## 🏗️ Estructura del Proyecto (Fase 2)

```
Kipustock/
├── backend/
│   ├── database.py       # Configuración SQLite local (data/sistema.db) y sessionmaker
│   ├── models.py         # Modelos SQLAlchemy y esquemas Pydantic (con comisiones y URLs de compra)
│   ├── image_generator.py # Generador de fotografías de productos (Imagen 3 / Canvas) y copy publicitario
│   └── main.py           # Servidor FastAPI, endpoints de arbitraje, vision AI, generación de imágenes y status
├── scraper/
│   ├── __init__.py
│   ├── vision_ai.py      # Reconocimiento multimodal con Gemini Vision (google-genai)
│   └── search_engine.py  # Conectores modulares Playwright (Mercado Libre, Falabella, Ripley, Sodimac, AliExpress) + análisis por lote Gemini
├── frontend/
│   ├── index.html        # Dashboard comercial con soporte IA, carga animada, visual cards y modal redes
│   ├── styles.css        # Estilos modernos con paleta oscura/clara, badges de estado y spinners
│   └── app.js            # Lógica interactiva completa, sincronización REST y generación de fotos/posts
├── data/
│   ├── sistema.db        # Base de datos SQLite persistente
│   ├── uploads/          # Almacén local de imágenes analizadas y fotografías de inventario
│   └── product_images/   # Almacén de imágenes generadas por IA (estudio, lifestyle, marketing)
├── .env.example          # Plantilla de variables de entorno (GEMINI_API_KEY)
├── .env                  # Configuración local de entorno
├── requirements.txt      # fastapi, playwright, google-genai, pillow, python-dotenv, etc.
└── README.md
```

---

## 🌟 Funcionalidades Implementadas

### A) Reconocimiento Visual con Gemini Vision (`scraper/vision_ai.py`)
- **Análisis Multimodal**: Procesa fotos subidas en el buscador o en el inventario con `gemini-2.5-flash`.
- **Extracción Estructurada**:
  * `producto_identificado`: Nombre comercial claro.
  * `marca_modelo`: Marca y modelo exacto detectado en la foto.
  * `categoria`: Rubro comercial.
  * `consultas_busqueda`: 3 términos de búsqueda optimizados para Perú como pills clicables.
  * `precio_referencia_sugerido`: Estimación en Soles peruanos (PEN).
- **Fallback Seguro**: Si no se dispone de API Key o hay problemas de red, el sistema extrae metadatos locales y continúa operando de forma transparente.

### B) Motor de Rastreo Web en Vivo (`scraper/search_engine.py`)
- **Scraping Asíncrono Modular**:
  * **Mercado Libre Perú**
  * **Falabella Perú**
  * **Ripley Perú**
  * **Sodimac Perú**
  * **AliExpress (Importación Directa / Fabricantes OEM)**
- **Análisis por Lote con Gemini 2.5 Flash**: En una sola llamada optimizada por búsqueda:
  * Filtra accesorios menores o repuestos que no correspondan al producto principal.
  * Estima el precio de venta competitivo en el mercado peruano (`precio_referencia_venta`).
  * Descuenta el costo configurable de comisiones y envíos (`Comisión venta / Envío %`, ej. 12% por defecto) para calcular la **ganancia neta real**.
- **Acceso Directo**: Cada tarjeta de resultado incluye el botón **"Ver en tienda ↗"** que abre el enlace real de compra y **"+ Sumar a la lista"**.

### C) Mercadería Propia con Autocompletado IA
- Formulario con botón **"✨ Autocompletar con IA desde Foto"** que rellena automáticamente el nombre, modelo, notas y precio de venta sugerido analizando la imagen del producto con Gemini Vision.
- Persistencia total en SQLite local (`data/sistema.db`).
- Cálculo en tiempo real de márgenes unitarios y ganancia proyectada total del stock.

### D) Lote de Operación & Dashboard Financiero
- Muestra en tiempo real: Inversión nueva requerida, stock propio comprometido, ingreso bruto y ganancia neta consolidada con margen promedio (%).
- Exportación formal en formato texto `.TXT` y copia rápida al portapapeles.
- Selector multimoneda instantáneo: Soles peruanos (**S/**) y Dólares (**$**) con tipo de cambio de referencia.


### E) Generación de Imágenes de Productos y Copy Promocional con IA (`backend/image_generator.py`)
- **3 Estilos Disponibles**:
  * 📸 **Estudio (`estudio`)**: Fotografía profesional de catálogo con fondo blanco puro e iluminación limpia.
  * 🏡 **Lifestyle (`lifestyle`)**: Producto contextualizado en un ambiente moderno de uso cotidiano con iluminación natural.
  * 🚀 **Marketing (`marketing`)**: Imagen publicitaria llamativa lista para Instagram, Facebook o WhatsApp Stories.
- **Acciones Directas en el Dashboard**:
  * Botón **"🎨 Generar Foto Catálogo IA"**: Crea la foto de producto directamente desde el nombre y la previsualiza al instante.
  * Botón **"🎨 Foto IA"**: En la tabla de mercadería propia registrada, regenera y actualiza la foto de cualquier producto en SQLite con 1 solo clic.
  * Botón **"📢 Crear Post Redes IA"**: Abre un modal completo para seleccionar el producto del inventario/lote, elegir el estilo visual, generar la imagen `.png` descargable y redactar un copy persuasivo (gancho, beneficios, llamada a la acción y hashtags) listo para copiar al portapapeles.
