"""
Módulo de Campañas Publicitarias para Redes Sociales con IA (Costo $0)
Genera piezas gráficas multiformato (1:1 Feed/Catálogo y 9:16 Stories/Reels) con Pillow
apoyándose en backend/image_generator.py, y redacta copys comerciales persuasivos
para Marketplace, Historias/Reels, Difusión de WhatsApp y Correo Promocional con Gemini / Fallback $0.
"""

import os
import io
import json
import uuid
import zipfile
import logging
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, List
import urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter

from backend.database import PRODUCT_IMAGES_DIR, UPLOADS_DIR, BASE_DIR
from backend.image_generator import get_genai_client

logger = logging.getLogger("kipustock.campaign_generator")

CAMPAIGNS_DIR = PRODUCT_IMAGES_DIR / "campaigns"
CAMPAIGNS_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================================
# 1. HELPERS DE FUENTES Y DIBUJO
# ============================================================================

def _get_font(size: int, bold: bool = False):
    """Carga fuente TrueType del sistema Windows o fuente por defecto de Pillow."""
    font_paths = [
        "C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\segoeuib.ttf" if bold else "C:\\Windows\\Fonts\\segoeui.ttf",
        "C:\\Windows\\Fonts\\calibrib.ttf" if bold else "C:\\Windows\\Fonts\\calibri.ttf",
        "C:\\Windows\\Fonts\\tahomabd.ttf" if bold else "C:\\Windows\\Fonts\\tahoma.ttf",
    ]
    for p in font_paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _draw_gradient_v(base_img: Image.Image, color_top: Tuple[int, int, int], color_bot: Tuple[int, int, int]):
    """Dibuja un degradado vertical suave."""
    draw = ImageDraw.Draw(base_img)
    w, h = base_img.size
    for y in range(h):
        r = y / h
        col = (
            int(color_top[0] * (1 - r) + color_bot[0] * r),
            int(color_top[1] * (1 - r) + color_bot[1] * r),
            int(color_top[2] * (1 - r) + color_bot[2] * r)
        )
        draw.line([(0, y), (w, y)], fill=col)


def _load_product_photo(foto_url: Optional[str], product_data: Optional[Dict[str, Any]] = None) -> Optional[Image.Image]:
    """Carga la imagen de producto si existe en disco o web, o genera un arte de producto con IA."""
    if foto_url and not foto_url.startswith("data:image/svg") and "placeholder" not in foto_url:
        try:
            # 1. Ruta local en product_images
            if foto_url.startswith("/product_images/"):
                rel_name = foto_url.replace("/product_images/", "")
                local_path = PRODUCT_IMAGES_DIR / rel_name
                if local_path.exists():
                    return Image.open(local_path).convert("RGBA")

            # 2. Ruta local en uploads
            if foto_url.startswith("/uploads/"):
                rel_name = foto_url.replace("/uploads/", "")
                local_path = UPLOADS_DIR / rel_name
                if local_path.exists():
                    return Image.open(local_path).convert("RGBA")

            # 3. Archivo directo en disco
            p = Path(foto_url)
            if p.exists() and p.is_file():
                return Image.open(p).convert("RGBA")

            # 4. URL HTTP externa (si es válida)
            if foto_url.startswith("http://") or foto_url.startswith("https://"):
                req = urllib.request.Request(foto_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=3) as resp:
                    data = resp.read()
                    return Image.open(io.BytesIO(data)).convert("RGBA")
        except Exception as e:
            logger.warning(f"No se pudo cargar foto de producto '{foto_url}': {e}")

    # Si no hay foto en disco o web, generar imagen publicitaria con backend/image_generator.py
    if product_data and product_data.get("nombre"):
        try:
            from backend.image_generator import generate_product_image
            res = generate_product_image(
                nombre_producto=product_data.get("nombre", ""),
                descripcion=product_data.get("notas") or product_data.get("modelo") or "",
                estilo="marketing"
            )
            if res and res.get("url"):
                return _load_product_photo(res["url"])
        except Exception as gen_err:
            logger.info(f"Aviso al intentar generar imagen base con IA: {gen_err}")

    return None


def _wrap_text(text: str, font: ImageFont.ImageFont, max_width: int, draw: ImageDraw.ImageDraw) -> list:
    """Envuelve texto en varias líneas sin sobrepasar max_width."""
    words = text.split()
    lines = []
    curr = []
    for word in words:
        test_line = " ".join(curr + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        w = bbox[2] - bbox[0]
        if w <= max_width:
            curr.append(word)
        else:
            if curr:
                lines.append(" ".join(curr))
                curr = [word]
            else:
                lines.append(word)
                curr = []
    if curr:
        lines.append(" ".join(curr))
    return lines


# ============================================================================
# 2. GENERADOR DE PIEZAS VISUALES (1:1 FEED Y 9:16 STORIES)
# ============================================================================

def _get_palette(tone: str) -> Dict[str, Any]:
    """Retorna colores según el tono de la campaña."""
    tone_lower = (tone or "").lower()
    if "flash" in tone_lower or "urgenc" in tone_lower:
        return {
            "bg_top": (15, 23, 42),       # Slate muy oscuro
            "bg_bot": (30, 27, 75),       # Deep indigo
            "accent": (245, 158, 11),     # Ámbar / Oro
            "badge_bg": (239, 68, 68),    # Rojo flash
            "badge_txt": (255, 255, 255),
            "tag": "⚡ OFERTA FLASH • STOCK LIMITADO",
            "price_badge": (16, 185, 129), # Verde esmeralda
            "glow": (245, 158, 11, 40)
        }
    elif "novedad" in tone_lower or "tendenc" in tone_lower:
        return {
            "bg_top": (17, 24, 39),
            "bg_bot": (88, 28, 135),      # Morado púrpura vibrante
            "accent": (56, 189, 248),     # Cyan
            "badge_bg": (147, 51, 234),   # Violeta
            "badge_txt": (255, 255, 255),
            "tag": "🔥 TENDENCIA • NUEVO INGRESO",
            "price_badge": (6, 182, 212),
            "glow": (147, 51, 234, 45)
        }
    else: # Profesional / Confianza
        return {
            "bg_top": (11, 19, 43),
            "bg_bot": (19, 34, 64),
            "accent": (96, 165, 250),     # Azul cielo
            "badge_bg": (37, 99, 235),    # Azul royal
            "badge_txt": (255, 255, 255),
            "tag": "⭐ CALIDAD GARANTIZADA • ENVÍO HOY",
            "price_badge": (16, 185, 129),
            "glow": (37, 99, 235, 40)
        }


def generate_feed_1x1_image(
    product_data: Dict[str, Any],
    output_path: Path,
    tone: str = "Urgencia / Oferta Flash",
    moneda: str = "PEN"
):
    """
    Crea pieza cuadrada (1080x1080 px) para Feed de Instagram, Facebook y Catálogo Marketplace.
    """
    width, height = 1080, 1080
    base = Image.new("RGB", (width, height), (15, 23, 42))
    palette = _get_palette(tone)

    _draw_gradient_v(base, palette["bg_top"], palette["bg_bot"])
    draw = ImageDraw.Draw(base, "RGBA")

    # Resplandor central sutil
    draw.ellipse([width//2 - 350, 180, width//2 + 350, 880], fill=palette["glow"])

    # Marco exterior estilizado
    margin = 48
    draw.rounded_rectangle(
        [margin, margin, width - margin, height - margin],
        radius=28,
        outline=(51, 65, 85, 180),
        width=2
    )

    # 1. Cabecera superior
    font_badge = _get_font(22, bold=True)
    badge_w = 390
    draw.rounded_rectangle([margin + 28, margin + 26, margin + 28 + badge_w, margin + 74], radius=16, fill=palette["badge_bg"])
    draw.text((margin + 46, margin + 37), palette["tag"], fill=palette["badge_txt"], font=font_badge)

    font_brand = _get_font(20, bold=True)
    brand_str = "KIPUSTOCK OFICIAL"
    bbox_br = draw.textbbox((0, 0), brand_str, font=font_brand)
    draw.text((width - margin - 32 - (bbox_br[2] - bbox_br[0]), margin + 37), brand_str, fill=(148, 163, 184), font=font_brand)

    # 2. Pedestal / Contenedor central del producto
    pedestal_x1 = width // 2 - 310
    pedestal_y1 = 150
    pedestal_x2 = width // 2 + 310
    pedestal_y2 = 680

    draw.rounded_rectangle(
        [pedestal_x1, pedestal_y1, pedestal_x2, pedestal_y2],
        radius=24,
        fill=(255, 255, 255, 245),
        outline=(226, 232, 240, 255),
        width=2
    )

    # Sombra del pedestal
    draw.ellipse([pedestal_x1 + 60, pedestal_y2 - 25, pedestal_x2 - 60, pedestal_y2 + 25], fill=(0, 0, 0, 80))

    # Cargar y colocar foto del producto
    raw_photo = _load_product_photo(product_data.get("foto_url"), product_data)
    if raw_photo:
        box_w = pedestal_x2 - pedestal_x1 - 40
        box_h = pedestal_y2 - pedestal_y1 - 40
        raw_photo.thumbnail((box_w, box_h), Image.Resampling.LANCZOS)
        offset_x = pedestal_x1 + 20 + (box_w - raw_photo.width) // 2
        offset_y = pedestal_y1 + 20 + (box_h - raw_photo.height) // 2
        base.paste(raw_photo, (offset_x, offset_y), raw_photo)
    else:
        # Fallback gráfico limpio si no hay foto
        font_icon = _get_font(90, bold=True)
        draw.text((width // 2 - 45, pedestal_y1 + 170), "📦", font=font_icon)
        font_subcard = _get_font(24, bold=True)
        fallback_lbl = (product_data.get("estado") or "PRODUCTO VERIFICADO").upper()
        bbox_fb = draw.textbbox((0, 0), fallback_lbl, font=font_subcard)
        draw.text((width // 2 - (bbox_fb[2] - bbox_fb[0]) // 2, pedestal_y1 + 320), fallback_lbl, fill=(100, 116, 139), font=font_subcard)

    # 3. Datos del producto
    font_title = _get_font(38, bold=True)
    nombre = product_data.get("nombre") or "Producto Exclusivo KipuStock"
    lines = _wrap_text(nombre, font_title, width - (margin * 2) - 80, draw)
    title_y = 715
    for line in lines[:2]:
        bbox_l = draw.textbbox((0, 0), line, font=font_title)
        draw.text(((width - (bbox_l[2] - bbox_l[0])) // 2, title_y), line, fill=(255, 255, 255), font=font_title)
        title_y += 46

    # 4. Fila de Precio y Descuento
    precio_venta = float(product_data.get("precio_venta") or 0.0)
    precio_oferta = float(product_data.get("precio_oferta") or 0.0) if product_data.get("precio_oferta") else None
    simbolo = "S/" if moneda == "PEN" else "$"

    price_box_y = max(title_y + 10, 830)
    font_price = _get_font(42, bold=True)
    font_old = _get_font(24, bold=False)

    if precio_oferta and precio_oferta < precio_venta:
        txt_old = f"Antes: {simbolo} {precio_venta:.2f}"
        txt_offer = f"HOY: {simbolo} {precio_oferta:.2f}"
        
        box_w = 480
        box_h = 70
        bx1 = (width - box_w) // 2
        draw.rounded_rectangle([bx1, price_box_y, bx1 + box_w, price_box_y + box_h], radius=18, fill=palette["price_badge"])
        
        draw.text((bx1 + 25, price_box_y + 18), txt_old, fill=(226, 232, 240), font=font_old)
        bbox_o = draw.textbbox((bx1 + 25, price_box_y + 18), txt_old, font=font_old)
        draw.line([(bbox_o[0], bbox_o[1] + 16), (bbox_o[2], bbox_o[1] + 16)], fill=(239, 68, 68), width=3)
        draw.text((bx1 + 230, price_box_y + 10), txt_offer, fill=(255, 255, 255), font=font_price)
    else:
        txt_price = f"PRECIO: {simbolo} {precio_venta:.2f}"
        bbox_p = draw.textbbox((0, 0), txt_price, font=font_price)
        pw = bbox_p[2] - bbox_p[0]
        box_w = pw + 80
        box_h = 66
        bx1 = (width - box_w) // 2
        draw.rounded_rectangle([bx1, price_box_y, bx1 + box_w, price_box_y + box_h], radius=18, fill=palette["price_badge"])
        draw.text((bx1 + 40, price_box_y + 8), txt_price, fill=(255, 255, 255), font=font_price)

    # 5. Barra inferior de confianza
    font_trust = _get_font(20, bold=True)
    trust_str = "🚚 Envíos a Domicilio   •   💳 Yape / Plin   •   ⚡ Stock Verificado"
    bbox_tr = draw.textbbox((0, 0), trust_str, font=font_trust)
    draw.text(((width - (bbox_tr[2] - bbox_tr[0])) // 2, height - margin - 50), trust_str, fill=(148, 163, 184), font=font_trust)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    base.save(output_path, format="PNG")
    return output_path


def generate_story_9x16_image(
    product_data: Dict[str, Any],
    output_path: Path,
    tone: str = "Urgencia / Oferta Flash",
    moneda: str = "PEN"
):
    """
    Crea pieza vertical (1080x1920 px) para Historias de Instagram/Facebook, WhatsApp Status y TikTok.
    Respeta zonas seguras arriba (240px) y abajo (280px).
    """
    width, height = 1080, 1920
    base = Image.new("RGB", (width, height), (15, 23, 42))
    palette = _get_palette(tone)

    _draw_gradient_v(base, palette["bg_top"], palette["bg_bot"])
    draw = ImageDraw.Draw(base, "RGBA")

    # Resplandores ambientales verticales
    draw.ellipse([width//2 - 420, 480, width//2 + 420, 1340], fill=palette["glow"])

    # Marco interno discreto dentro de la zona segura
    draw.rounded_rectangle([40, 220, width - 40, height - 260], radius=32, outline=(51, 65, 85, 140), width=2)

    # 1. Cabecera
    font_top_badge = _get_font(26, bold=True)
    draw.rounded_rectangle([width//2 - 260, 260, width//2 + 260, 320], radius=16, fill=palette["badge_bg"])
    bbox_t = draw.textbbox((0, 0), palette["tag"], font=font_top_badge)
    draw.text((width//2 - (bbox_t[2] - bbox_t[0])//2, 274), palette["tag"], fill=palette["badge_txt"], font=font_top_badge)

    font_brand = _get_font(22, bold=True)
    draw.text((width//2 - 110, 345), "KIPUSTOCK STORE", fill=(148, 163, 184), font=font_brand)

    # 2. Hero Producto
    pedestal_x1 = width // 2 - 380
    pedestal_y1 = 400
    pedestal_x2 = width // 2 + 380
    pedestal_y2 = 1080

    draw.rounded_rectangle(
        [pedestal_x1, pedestal_y1, pedestal_x2, pedestal_y2],
        radius=28,
        fill=(255, 255, 255, 245),
        outline=(226, 232, 240, 255),
        width=3
    )

    # Sombra del pedestal
    draw.ellipse([pedestal_x1 + 60, pedestal_y2 - 30, pedestal_x2 - 60, pedestal_y2 + 30], fill=(0, 0, 0, 90))

    raw_photo = _load_product_photo(product_data.get("foto_url"), product_data)
    if raw_photo:
        box_w = pedestal_x2 - pedestal_x1 - 50
        box_h = pedestal_y2 - pedestal_y1 - 50
        raw_photo.thumbnail((box_w, box_h), Image.Resampling.LANCZOS)
        offset_x = pedestal_x1 + 25 + (box_w - raw_photo.width) // 2
        offset_y = pedestal_y1 + 25 + (box_h - raw_photo.height) // 2
        base.paste(raw_photo, (offset_x, offset_y), raw_photo)
    else:
        font_icon = _get_font(120, bold=True)
        draw.text((width // 2 - 60, pedestal_y1 + 260), "📦", font=font_icon)

    # 3. Título del producto
    font_title = _get_font(44, bold=True)
    nombre = product_data.get("nombre") or "Producto Exclusivo KipuStock"
    lines = _wrap_text(nombre, font_title, width - 140, draw)
    title_y = 1130
    for line in lines[:2]:
        bbox_l = draw.textbbox((0, 0), line, font=font_title)
        draw.text(((width - (bbox_l[2] - bbox_l[0])) // 2, title_y), line, fill=(255, 255, 255), font=font_title)
        title_y += 54

    # 4. Estado y Garantía
    font_tags = _get_font(24, bold=True)
    estado_lbl = f"ESTADO: {(product_data.get('estado') or 'NUEVO').upper()}  •  GARANTÍA OFICIAL"
    bbox_est = draw.textbbox((0, 0), estado_lbl, font=font_tags)
    draw.text(((width - (bbox_est[2] - bbox_est[0])) // 2, title_y + 8), estado_lbl, fill=palette["accent"], font=font_tags)

    # 5. Precio
    precio_venta = float(product_data.get("precio_venta") or 0.0)
    precio_oferta = float(product_data.get("precio_oferta") or 0.0) if product_data.get("precio_oferta") else None
    simbolo = "S/" if moneda == "PEN" else "$"

    font_mega = _get_font(56, bold=True)
    font_sub_price = _get_font(26, bold=False)

    price_box_y = title_y + 55
    if precio_oferta and precio_oferta < precio_venta:
        txt_offer = f"HOY {simbolo} {precio_oferta:.2f}"
        txt_prev = f"Precio regular: {simbolo} {precio_venta:.2f}"
        box_w = 540
        box_h = 110
        bx1 = (width - box_w) // 2
        draw.rounded_rectangle([bx1, price_box_y, bx1 + box_w, price_box_y + box_h], radius=22, fill=palette["price_badge"])
        
        draw.text((bx1 + (box_w - draw.textbbox((0,0), txt_offer, font=font_mega)[2])//2, price_box_y + 12), txt_offer, fill=(255, 255, 255), font=font_mega)
        draw.text((bx1 + (box_w - draw.textbbox((0,0), txt_prev, font=font_sub_price)[2])//2, price_box_y + 72), txt_prev, fill=(226, 232, 240), font=font_sub_price)
    else:
        txt_price = f"{simbolo} {precio_venta:.2f}"
        txt_sub = "¡OFERTA DISPONIBLE HOY!"
        box_w = 480
        box_h = 105
        bx1 = (width - box_w) // 2
        draw.rounded_rectangle([bx1, price_box_y, bx1 + box_w, price_box_y + box_h], radius=22, fill=palette["price_badge"])
        
        draw.text((bx1 + (box_w - draw.textbbox((0,0), txt_price, font=font_mega)[2])//2, price_box_y + 10), txt_price, fill=(255, 255, 255), font=font_mega)
        draw.text((bx1 + (box_w - draw.textbbox((0,0), txt_sub, font=font_sub_price)[2])//2, price_box_y + 70), txt_sub, fill=(241, 245, 249), font=font_sub_price)

    # 6. Botón CTA
    cta_y = price_box_y + 130
    font_cta = _get_font(28, bold=True)
    cta_txt = "📲 RESPONDE ESTE ESTADO O TOCA EL LINK"
    cta_w = 660
    cta_h = 68
    cx1 = (width - cta_w) // 2
    draw.rounded_rectangle([cx1, cta_y, cx1 + cta_w, cta_y + cta_h], radius=18, fill=(37, 211, 102))
    draw.text((cx1 + 35, cta_y + 18), cta_txt, fill=(4, 47, 26), font=font_cta)

    # 7. Confianza
    font_trust = _get_font(22, bold=True)
    trust_txt = "🚚 Envíos a todo el Perú   •   💳 Paga con Yape o Plin"
    bbox_tr = draw.textbbox((0, 0), trust_txt, font=font_trust)
    draw.text(((width - (bbox_tr[2] - bbox_tr[0])) // 2, cta_y + 90), trust_txt, fill=(148, 163, 184), font=font_trust)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    base.save(output_path, format="PNG")
    return output_path


# ============================================================================
# 3. GENERADOR DE COPYS MULTICANAL (GEMINI + FALLBACK $0)
# ============================================================================

def generate_channel_copys(
    product_data: Dict[str, Any],
    tone: str = "Urgencia / Oferta Flash",
    store_url: str = "http://localhost:8000/tienda",
    whatsapp_num: str = "51944830586",
    canales: Optional[List[str]] = None
) -> Dict[str, str]:
    """
    Genera 4 copys adaptados para:
    1. Facebook Marketplace (título directo, descripción clara y gancho comercial).
    2. Historias / Reels (Instagram, TikTok y WhatsApp Status: texto breve y directo).
    3. Difusión por WhatsApp (mensaje listo para reenviar con precio y llamada a la acción).
    4. Correo promocional (asunto y cuerpo breve).
    Usa Gemini 2.5 Flash si está disponible; de lo contrario utiliza motor generador estructurado costo $0.
    """
    nombre = product_data.get("nombre") or "Producto KipuStock"
    modelo = product_data.get("modelo") or ""
    estado = product_data.get("estado") or "Nuevo"
    precio_venta = float(product_data.get("precio_venta") or 0.0)
    precio_oferta = float(product_data.get("precio_oferta") or 0.0) if product_data.get("precio_oferta") else None
    margen = product_data.get("margen_beneficio") or product_data.get("margen")
    stock = product_data.get("stock")
    enlace = product_data.get("enlace") or store_url
    notas = product_data.get("notas") or "Excelente calidad y garantía oficial."
    
    clean_wa = "".join(filter(str.isdigit, whatsapp_num))
    if not clean_wa.startswith("51") and len(clean_wa) == 9:
        clean_wa = "51" + clean_wa

    client = get_genai_client()
    if client:
        try:
            extra_context = []
            if margen:
                extra_context.append(f"Margen/Beneficio estimado: {margen}%")
            if stock:
                extra_context.append(f"Stock disponible: {stock} unidades")
            if enlace:
                extra_context.append(f"Enlace de compra: {enlace}")

            prompt = f"""
Actúa como un copywriter publicitario de clase mundial especializado en ecommerce, arbitraje comercial y ventas en Perú.
Redacta 4 copys comerciales persuasivos y adaptados a cada canal para este producto:

DATOS DEL PRODUCTO:
- Producto: {nombre}
- Modelo/Especificación: {modelo}
- Condición/Estado: {estado}
- Precio Normal: S/ {precio_venta:.2f}
- Precio Oferta: {'S/ ' + str(precio_oferta) if precio_oferta else 'No aplica'}
- Tono de Campaña: {tone}
- Tienda / Enlace: {enlace}
- WhatsApp de Ventas: {whatsapp_num}
- Beneficios / Notas: {notas}
- Contexto adicional: {', '.join(extra_context) if extra_context else 'Entrega inmediata'}

ESTRUCTURA EXACTA REQUERIDA:
Devuelve ÚNICAMENTE un objeto JSON estrictamente válido (sin markdown ```json ni texto adicional) con exactamente estas 4 claves:
{{
  "marketplace": "Para Facebook Marketplace: Título directo optimizado para búsquedas (máx 60 caracteres) + Descripción clara con viñetas, especificaciones, estado ({estado}), formas de entrega (delivery/recojo), métodos de pago (Yape/Plin/Contraentrega) y gancho comercial.",
  "stories_reels": "Para Historias / Reels / TikTok / WhatsApp Status: Texto breve, directo y de alto impacto visual con gancho (hook), propuesta de valor, precio y llamado a la acción rápido (ej. 'Responde este estado o toca el link').",
  "whatsapp_broadcast": "Para Difusión por WhatsApp: Mensaje completo listo para reenviar a clientes con saludo cordial, oferta clara, precio/ahorro, llamada a la acción irresistible y enlace/WhatsApp directo.",
  "email_promo": "Para Correo Promocional: Asunto directo y llamativo ('Asunto: ...') + Cuerpo breve con gancho de bienvenida, beneficios clave, precio de ocasión y botón/link de compra."
}}
"""
            for model_name in ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
                try:
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=prompt
                    )
                    raw_text = resp.text.strip()
                    if raw_text.startswith("```json"):
                        raw_text = raw_text[7:]
                    if raw_text.startswith("```"):
                        raw_text = raw_text[3:]
                    if raw_text.endswith("```"):
                        raw_text = raw_text[:-3]
                    parsed = json.loads(raw_text.strip())
                    if all(k in parsed for k in ["marketplace", "stories_reels", "whatsapp_broadcast", "email_promo"]):
                        logger.info(f"Copys generados exitosamente con {model_name}")
                        parsed["facebook_instagram"] = parsed.get("marketplace", "")
                        parsed["whatsapp_status"] = parsed.get("whatsapp_broadcast", "")
                        parsed["tiktok_reels_script"] = parsed.get("stories_reels", "")
                        return parsed
                except Exception as inner_e:
                    logger.warning(f"Error con modelo {model_name}: {inner_e}")
                    continue
        except Exception as e:
            logger.warning(f"Error al llamar a Gemini: {e}. Usando generador de copy fallback.")

    # FALLBACK ESTRUCTURADO DE ALTA CONVERSIÓN ($0)
    simbolo = "S/"
    precio_str = f"{simbolo} {precio_oferta:.2f}" if (precio_oferta and precio_oferta < precio_venta) else f"{simbolo} {precio_venta:.2f}"
    ahorro_str = f" (Antes {simbolo} {precio_venta:.2f} - ¡Ahorras {simbolo} {precio_venta - precio_oferta:.2f}!)" if (precio_oferta and precio_oferta < precio_venta) else ""
    stock_str = f"⚡ Solo nos quedan {stock} unidades disponibles." if stock else "⚡ Stock limitado para entrega inmediata."

    marketplace = (
        f"{nombre} {modelo} [{estado.upper()}] - ¡Ocasión y Garantía!\n\n"
        f"💰 Precio especial: {precio_str}{ahorro_str}\n"
        f"🏷️ Condición: {estado} (100% verificado y garantizado)\n\n"
        f"DETALLES & ESPECIFICACIONES:\n"
        f"• Producto: {nombre}\n"
        f"• Modelo: {modelo or 'Estándar de fábrica'}\n"
        f"• {notas}\n"
        f"• {stock_str}\n\n"
        f"FORMAS DE ENTREGA:\n"
        f"🚚 Envíos express a domicilio en Lima y despacho a todo el Perú (Olva / Shalom).\n"
        f"📍 Contraentrega o recojo coordinado.\n\n"
        f"MÉTODOS DE PAGO:\n"
        f"💳 Yape, Plin, Transferencia o Efectivo.\n\n"
        f"📲 Escríbeme por chat o al WhatsApp {whatsapp_num} para coordinar tu pedido ahora mismo."
    )

    stories_reels = (
        f"🔥 ¡MIRA ESTO! {nombre}\n\n"
        f"✨ {estado} con Garantía Oficial\n"
        f"💰 Llévatelo hoy a solo: {precio_str}{ahorro_str}\n"
        f"{stock_str}\n\n"
        f"🚚 Envíos a todo el Perú\n"
        f"💳 Pagos con Yape / Plin\n\n"
        f"👉 ¡Responde a esta historia o toca el link para pedir el tuyo antes que se agote!"
    )

    whatsapp_broadcast = (
        f"👋 ¡Hola! Te compartimos una súper oportunidad disponible hoy en *KipuStock* 🚀\n\n"
        f"📦 *{nombre}*{(' - ' + modelo) if modelo else ''}\n"
        f"🏷️ *Condición:* {estado} con Garantía Oficial\n"
        f"💰 *Precio Exclusivo:* *{precio_str}*{ahorro_str}\n"
        f"{stock_str}\n\n"
        f"Beneficios clave:\n"
        f"✅ {notas}\n"
        f"✅ Despacho rápido a domicilio en Lima y provincias 🚚\n"
        f"✅ Pagos seguros y fáciles con Yape, Plin o transferencia 💳\n\n"
        f"👉 Pide directo en nuestra tienda web:\n{enlace}\n\n"
        f"📲 O responde a este mensaje para coordinar tu entrega hoy mismo."
    )

    email_promo = (
        f"Asunto: ⚡ ¡No te lo pierdas! Oferta especial en {nombre} [{precio_str}]\n\n"
        f"Hola,\n\n"
        f"Te traemos una oportunidad única que no podíamos dejar de compartirte:\n\n"
        f"Acaba de ingresar a catálogo: {nombre} ({estado})\n"
        f"Por tiempo limitado, llévatelo por solo {precio_str}{ahorro_str}.\n\n"
        f"• Rendimiento comprobado y garantía garantizada.\n"
        f"• {stock_str}\n"
        f"• Envíos rápidos a domicilio a nivel nacional.\n\n"
        f"Puedes ver todos los detalles y realizar tu pedido seguro aquí:\n"
        f"{enlace}\n\n"
        f"¿Tienes dudas? Escríbenos directamente por WhatsApp al {whatsapp_num}.\n\n"
        f"Saludos cordiales,\n"
        f"El equipo de KipuStock"
    )

    return {
        "marketplace": marketplace,
        "stories_reels": stories_reels,
        "whatsapp_broadcast": whatsapp_broadcast,
        "email_promo": email_promo,
        "facebook_instagram": marketplace,
        "whatsapp_status": whatsapp_broadcast,
        "tiktok_reels_script": stories_reels
    }


# ============================================================================
# 4. EMPAQUETADO EN ZIP Y GESTIÓN DE CAMPAÑA
# ============================================================================

def create_campaign_zip(campaign_dir: Path, campaign_id: str) -> Path:
    """Empaqueta imágenes generadas y el archivo de copys en un .ZIP."""
    zip_path = campaign_dir / f"pack_campana_{campaign_id}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        if (campaign_dir / "feed_1x1.png").exists():
            zf.write(campaign_dir / "feed_1x1.png", arcname="feed_1x1_1080x1080.png")
        if (campaign_dir / "story_9x16.png").exists():
            zf.write(campaign_dir / "story_9x16.png", arcname="story_9x16_1080x1920.png")
        if (campaign_dir / "copys_redes.txt").exists():
            zf.write(campaign_dir / "copys_redes.txt", arcname="copys_redes.txt")
    return zip_path


def run_full_campaign_generation(
    product_data: Dict[str, Any],
    tone: str = "Urgencia / Oferta Flash",
    store_url: Optional[str] = None,
    whatsapp_num: Optional[str] = None,
    moneda: str = "PEN",
    formatos: Optional[List[str]] = None,
    canales: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Ejecuta el pipeline completo de campaña:
    1. Genera artes visuales en formatos seleccionados (1:1 Feed y/o 9:16 Stories).
    2. Redacta copys multicanal (Marketplace, Stories/Reels, WhatsApp Difusión, Correo Promocional).
    3. Guarda archivo copys_redes.txt consolidado.
    4. Empaqueta todo en un archivo .ZIP descargable.
    """
    campaign_id = f"camp_{uuid.uuid4().hex[:8]}"
    campaign_dir = CAMPAIGNS_DIR / campaign_id
    campaign_dir.mkdir(parents=True, exist_ok=True)

    formatos_set = set(formatos) if formatos else {"1:1", "9:16"}
    feed_path = campaign_dir / "feed_1x1.png"
    story_path = campaign_dir / "story_9x16.png"
    copys_txt_path = campaign_dir / "copys_redes.txt"

    feed_1x1_url = None
    story_9x16_url = None

    # 1. Generación de imágenes según formatos seleccionados
    if "1:1" in formatos_set:
        generate_feed_1x1_image(product_data, feed_path, tone=tone, moneda=moneda)
        feed_1x1_url = f"/product_images/campaigns/{campaign_id}/feed_1x1.png"

    if "9:16" in formatos_set:
        generate_story_9x16_image(product_data, story_path, tone=tone, moneda=moneda)
        story_9x16_url = f"/product_images/campaigns/{campaign_id}/story_9x16.png"

    # 2. Generación de copys comerciales
    clean_store_url = store_url.strip() if store_url else "http://localhost:8000/tienda"
    clean_wa = whatsapp_num.strip() if whatsapp_num else "51944830586"
    copys = generate_channel_copys(
        product_data,
        tone=tone,
        store_url=clean_store_url,
        whatsapp_num=clean_wa,
        canales=canales
    )

    # 3. Guardar archivo de texto consolidado
    nombre = product_data.get("nombre", "Producto")
    with open(copys_txt_path, "w", encoding="utf-8") as f:
        f.write("=====================================================\n")
        f.write("PACK PUBLICITARIO MULTICANAL - KIPUSTOCK IA\n")
        f.write(f"Producto: {nombre}\n")
        f.write(f"Tono: {tone}\n")
        f.write(f"Tienda: {clean_store_url}\n")
        f.write(f"WhatsApp: {clean_wa}\n")
        f.write("=====================================================\n\n")

        f.write("-----------------------------------------------------\n")
        f.write("1. FACEBOOK MARKETPLACE (Título directo + Descripción)\n")
        f.write("-----------------------------------------------------\n")
        f.write(copys.get("marketplace", "") + "\n\n")

        f.write("-----------------------------------------------------\n")
        f.write("2. HISTORIAS / REELS (Instagram, TikTok & WhatsApp Status)\n")
        f.write("-----------------------------------------------------\n")
        f.write(copys.get("stories_reels", "") + "\n\n")

        f.write("-----------------------------------------------------\n")
        f.write("3. DIFUSIÓN POR WHATSAPP (Listo para reenviar con CTA)\n")
        f.write("-----------------------------------------------------\n")
        f.write(copys.get("whatsapp_broadcast", "") + "\n\n")

        f.write("-----------------------------------------------------\n")
        f.write("4. CORREO PROMOCIONAL (Asunto + Cuerpo breve)\n")
        f.write("-----------------------------------------------------\n")
        f.write(copys.get("email_promo", "") + "\n")

    # 4. Empaquetar archivo ZIP
    create_campaign_zip(campaign_dir, campaign_id)

    return {
        "status": "success",
        "campaign_id": campaign_id,
        "producto_nombre": nombre,
        "feed_1x1_url": feed_1x1_url or "",
        "story_9x16_url": story_9x16_url or "",
        "download_pack_url": f"/api/campaigns/download-pack/{campaign_id}",
        "copys": copys,
        "mensaje": f"Campaña '{tone}' generada exitosamente con piezas multicanal y pack descargable."
    }
