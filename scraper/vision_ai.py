"""
Módulo de Reconocimiento Visual de Productos con Gemini Vision (Fase 2)
Usa el modelo gratuito 'gemini-2.5-flash' mediante el SDK oficial 'google-genai'.
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from PIL import Image

logger = logging.getLogger("kipustock.vision_ai")

PROMPT_ANALISIS_VISUAL = """
Analiza minuciosamente la fotografía de este producto para un sistema de arbitraje comercial y gestión de inventario en Perú.
Devuelve EXCLUSIVAMENTE un objeto JSON válido (sin formato Markdown adicional ni bloques de texto) con esta estructura exacta:
{
  "producto_identificado": "Nombre comercial claro y descriptivo del producto",
  "marca_modelo": "Marca y modelo o número de parte exacto visible (o 'Genérico / No visible')",
  "categoria": "Categoría comercial (ej. Herramientas, Tecnología, Hogar, Calzado, etc.)",
  "consultas_busqueda": [
    "Consulta óptima 1 (ej. Marca + Modelo exacto)",
    "Consulta óptima 2 (ej. Nombre comercial + características principales)",
    "Consulta óptima 3 (ej. Término clave para encontrarlo en Mercado Libre o Falabella)"
  ],
  "precio_referencia_sugerido": 120.00,
  "notas_visuales": "Detalles relevantes detectados como estado físico, accesorios visibles o versión"
}
Nota: El precio de referencia debe ser un número flotante estimado en Soles peruanos (PEN / S/).
"""

def get_gemini_client():
    """Obtiene el cliente oficial de Gemini si la API Key está presente."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "tu_api_key_gratuita_de_google_ai_studio":
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception as e:
        logger.warning(f"No se pudo inicializar el cliente de Gemini: {e}")
        return None

def analyze_product_image(image_path: str, original_filename: Optional[str] = None, text_context: Optional[str] = None) -> Dict[str, Any]:
    """
    Analiza una imagen con los modelos de visión de Google Gemini (SDK google-genai).
    Usa cascada inteligente de modelos para garantizar respuesta ante límites de cuota diaria.
    Soporta contexto textual complementario (ej. texto extraído de PDFs, facturas o fichas técnicas).
    """
    path_obj = Path(image_path)
    if not path_obj.exists():
        return {
            "ai_status": "error",
            "mensaje": f"Archivo de imagen no encontrado: {image_path}",
            "producto_identificado": "",
            "marca_modelo": "",
            "categoria": "",
            "consultas_busqueda": [],
            "precio_referencia_sugerido": 0.0
        }

    # Obtener nombre legible para caso de fallback
    raw_name = Path(original_filename).stem if original_filename else path_obj.stem
    is_hash = len(raw_name) == 32 and all(c in '0123456789abcdefABCDEF' for c in raw_name)
    clean_name = "Producto analizado por foto" if is_hash else raw_name.replace("_", " ").replace("-", " ").title()

    client = get_gemini_client()

    if not client:
        # Fallback Heurístico Seguro cuando no hay API Key configurada
        return {
            "ai_status": "no_key",
            "mensaje": "Gemini API Key no configurada en .env. Puedes obtener una gratuita en aistudio.google.com.",
            "producto_identificado": clean_name,
            "marca_modelo": "Pendiente de análisis IA",
            "categoria": "General",
            "consultas_busqueda": [clean_name],
            "precio_referencia_sugerido": 80.00
        }

    try:
        from google.genai import types

        # Cargar imagen con PIL para enviar al SDK
        pil_image = Image.open(path_obj)

        prompt_final = PROMPT_ANALISIS_VISUAL
        if text_context and text_context.strip():
            prompt_final = f"{PROMPT_ANALISIS_VISUAL}\n\nINFORMACIÓN/TEXTO ADICIONAL DEL DOCUMENTO DEL ARTÍCULO:\n{text_context.strip()[:1500]}"

        response = None
        # Cascada inteligente de modelos Gemini Flash con capacidades de visión
        model_cascade = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-2.0-flash-lite",
            "gemini-3.8-flash",
            "gemini-3.7-flash"
        ]

        last_error = None
        for model_name in model_cascade:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[pil_image, prompt_final],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.2
                    )
                )
                if response and response.text:
                    logger.info(f"Reconocimiento visual exitoso con modelo: {model_name}")
                    break
            except Exception as ex_m:
                last_error = ex_m
                logger.info(f"Modelo {model_name} en Vision AI no respondió: {str(ex_m)[:80]}")

        if not response or not response.text:
            raise last_error or RuntimeError("No se obtuvo respuesta de modelos Gemini Vision.")

        response_text = response.text.strip()
        data = json.loads(response_text)
        data["ai_status"] = "success"
        data["mensaje"] = "Producto identificado exitosamente con Gemini Vision."
        return data

    except Exception as e:
        logger.error(f"Error llamando a Gemini Vision: {e}")
        # Retorno seguro sin romper la ejecución
        return {
            "ai_status": "error",
            "mensaje": f"Aviso de Gemini Vision: {str(e)[:120]}. Se continuará con modo heurístico.",
            "producto_identificado": clean_name,
            "marca_modelo": "Detección manual",
            "categoria": "General",
            "consultas_busqueda": [clean_name],
            "precio_referencia_sugerido": 80.00
        }
