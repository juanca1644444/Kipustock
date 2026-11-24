import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)

from backend.database import QUOTES_DIR


def generate_quote_pdf(
    correlativo: str,
    cliente_data: Dict[str, Any],
    items: List[Dict[str, Any]],
    shipping_info: Dict[str, Any],
    store_config: Dict[str, Any],
    moneda: str = "PEN",
    validez_dias: int = 2,
    notas: Optional[str] = None
) -> Dict[str, Any]:
    """
    Genera un documento PDF profesional para Cotizaciones / Notas de Venta
    usando ReportLab a costo $0.
    """
    QUOTES_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{correlativo}.pdf"
    filepath = QUOTES_DIR / filename

    currency_sym = "S/" if moneda.upper() == "PEN" else "$"

    # Cálculo de montos
    subtotal_prods = 0.0
    for it in items:
        qty = int(it.get("cantidad", 1))
        unit_p = float(it.get("precio_unitario", 0.0))
        sub = round(qty * unit_p, 2)
        it["subtotal"] = sub
        subtotal_prods += sub

    costo_envio = float(shipping_info.get("costo", 0.0))
    total_general = round(subtotal_prods + costo_envio, 2)

    # Fechas
    ahora = datetime.now()
    fecha_emision = ahora.strftime("%d/%m/%Y %I:%M %p")
    fecha_vencimiento = (ahora + timedelta(days=validez_dias)).strftime("%d/%m/%Y")

    # Documento
    doc = SimpleDocTemplate(
        str(filepath),
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Estilos tipográficos personalizados
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=22,
        textColor=colors.HexColor('#0f172a')
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748b')
    )

    badge_style = ParagraphStyle(
        'DocBadge',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=14,
        textColor=colors.HexColor('#1d4ed8'),
        alignment=2
    )

    meta_label = ParagraphStyle(
        'MetaLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#475569')
    )

    meta_val = ParagraphStyle(
        'MetaVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#0f172a')
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white,
        alignment=1
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1e293b')
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1e293b')
    )

    table_cell_center = ParagraphStyle(
        'TableCellCenter',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1e293b'),
        alignment=1
    )

    table_cell_right = ParagraphStyle(
        'TableCellRight',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1e293b'),
        alignment=2
    )

    story = []

    # 1. ENCABEZADO PRINCIPAL (Marca + Correlativo)
    nombre_tienda = store_config.get("nombre_tienda", "KipuStock Store")
    whatsapp_tienda = store_config.get("whatsapp_ventas", "51944830586")

    header_left = [
        Paragraph(f"<b>{nombre_tienda}</b>", title_style),
        Spacer(1, 3),
        Paragraph("Arbitraje Comercial, Ventas y Envíos a Nivel Nacional", subtitle_style),
        Paragraph(f"WhatsApp Oficial: +{whatsapp_tienda}", subtitle_style)
    ]

    header_right = [
        Paragraph("COTIZACIÓN FORMAL", badge_style),
        Spacer(1, 4),
        Paragraph(f"<b>N° Control:</b> {correlativo}", ParagraphStyle('CR', parent=meta_label, alignment=2)),
        Paragraph(f"<b>Fecha:</b> {fecha_emision}", ParagraphStyle('CR2', parent=meta_val, alignment=2)),
        Paragraph(f"<b>Válido hasta:</b> {fecha_vencimiento}", ParagraphStyle('CR3', parent=meta_val, alignment=2, textColor=colors.HexColor('#dc2626')))
    ]

    header_table = Table(
        [[header_left, header_right]],
        colWidths=[330, 210]
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(header_table)

    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2563eb'), spaceBefore=2, spaceAfter=8))

    # 2. CAJA DE DATOS DEL CLIENTE Y DESPACHO
    cliente_nombre = cliente_data.get("nombre", "Cliente Particular")
    cliente_tel = cliente_data.get("telefono_whatsapp", "No especificado")
    cliente_dist = cliente_data.get("distrito_ciudad", "Lima")
    cliente_dir = cliente_data.get("direccion", "Entrega a coordinar")

    metodo_envio = shipping_info.get("nombre", "Entrega por Coordinar")
    tiempo_envio = shipping_info.get("tiempo_entrega", "24 a 48 hrs")

    client_box_data = [
        [
            Paragraph("<b>DATOS DEL CLIENTE</b>", ParagraphStyle('B1', parent=meta_label, textColor=colors.HexColor('#1d4ed8'))),
            Paragraph("<b>DETALLES DE DESPACHO Y ENTREGA</b>", ParagraphStyle('B2', parent=meta_label, textColor=colors.HexColor('#1d4ed8')))
        ],
        [
            Paragraph(f"<b>Nombre:</b> {cliente_nombre}", meta_val),
            Paragraph(f"<b>Modalidad:</b> {metodo_envio}", meta_val)
        ],
        [
            Paragraph(f"<b>WhatsApp / Tel:</b> {cliente_tel}", meta_val),
            Paragraph(f"<b>Tiempo Estimado:</b> {tiempo_envio}", meta_val)
        ],
        [
            Paragraph(f"<b>Destino / Ciudad:</b> {cliente_dist}", meta_val),
            Paragraph(f"<b>Dirección:</b> {cliente_dir}", meta_val)
        ]
    ]

    client_table = Table(client_box_data, colWidths=[270, 270])
    client_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 0.8, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#e2e8f0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(client_table)

    story.append(Spacer(1, 12))

    # 3. TABLA DE PRODUCTOS
    items_table_data = [
        [
            Paragraph("<b>#</b>", table_header),
            Paragraph("<b>DESCRIPCIÓN DEL PRODUCTO</b>", table_header),
            Paragraph("<b>CANT.</b>", table_header),
            Paragraph(f"<b>P. UNIT ({currency_sym})</b>", table_header),
            Paragraph(f"<b>SUBTOTAL ({currency_sym})</b>", table_header)
        ]
    ]

    for idx, it in enumerate(items, 1):
        nombre_p = it.get("nombre", "Producto")
        cant_p = it.get("cantidad", 1)
        unit_p = it.get("precio_unitario", 0.0)
        sub_p = it.get("subtotal", 0.0)

        items_table_data.append([
            Paragraph(str(idx), table_cell_center),
            Paragraph(nombre_p, table_cell_bold),
            Paragraph(str(cant_p), table_cell_center),
            Paragraph(f"{currency_sym} {unit_p:,.2f}", table_cell_right),
            Paragraph(f"{currency_sym} {sub_p:,.2f}", table_cell_right)
        ])

    items_table = Table(
        items_table_data,
        colWidths=[25, 275, 45, 95, 100]
    )
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
    ]))
    story.append(items_table)

    story.append(Spacer(1, 8))

    # 4. CUADRO DE RESUMEN FINANCIERO Y FORMAS DE PAGO (Lado a Lado)
    instrucciones = store_config.get(
        "instrucciones_pago",
        "Aceptamos transferencias BCP, BBVA, Interbank y pagos vía Yape o Plin. Envía constancia al WhatsApp oficial para programar despacho inmediato."
    )

    payment_p = [
        Paragraph("<b>MEDIOS DE PAGO HABILITADOS:</b>", ParagraphStyle('PayH', parent=meta_label, textColor=colors.HexColor('#1e293b'))),
        Spacer(1, 2),
        Paragraph(instrucciones, ParagraphStyle('PayT', parent=styles['Normal'], fontSize=8, leading=10, textColor=colors.HexColor('#334155'))),
        Spacer(1, 4),
        Paragraph(f"<i>* Cotización válida por {validez_dias} días naturales o hasta agotar stock disponible.</i>", ParagraphStyle('ValT', parent=styles['Normal'], fontSize=7.5, textColor=colors.HexColor('#64748b'))),
    ]

    if notas:
        payment_p.append(Spacer(1, 3))
        payment_p.append(Paragraph(f"<b>Nota especial:</b> {notas}", ParagraphStyle('NotT', parent=styles['Normal'], fontSize=7.5, textColor=colors.HexColor('#0369a1'))))

    summary_table_data = [
        [Paragraph("Subtotal Productos:", table_cell_right), Paragraph(f"<b>{currency_sym} {subtotal_prods:,.2f}</b>", table_cell_right)],
        [Paragraph(f"Despacho ({metodo_envio}):", table_cell_right), Paragraph(f"<b>{currency_sym} {costo_envio:,.2f}</b>", table_cell_right)],
        [Paragraph("<b>TOTAL A PAGAR:</b>", ParagraphStyle('TotL', parent=table_cell_right, fontSize=11, textColor=colors.HexColor('#0f172a'))),
         Paragraph(f"<b>{currency_sym} {total_general:,.2f}</b>", ParagraphStyle('TotV', parent=table_cell_right, fontSize=12, textColor=colors.HexColor('#16a34a')))]
    ]

    summary_table = Table(summary_table_data, colWidths=[130, 90])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -2), colors.HexColor('#f8fafc')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f0fdf4')),
        ('BOX', (0, 0), (-1, -1), 0.8, colors.HexColor('#94a3b8')),
        ('BOX', (0, -1), (-1, -1), 1.2, colors.HexColor('#16a34a')),
        ('INNERGRID', (0, 0), (-1, -2), 0.3, colors.HexColor('#e2e8f0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))

    bottom_table = Table(
        [[payment_p, summary_table]],
        colWidths=[310, 230]
    )
    bottom_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))

    story.append(bottom_table)

    story.append(Spacer(1, 14))
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor('#cbd5e1'), spaceBefore=2, spaceAfter=4))
    story.append(Paragraph(
        "KipuStock Store • Sistema de Gestión Comercial y Arbitraje Inteligente • ¡Gracias por su preferencia!",
        ParagraphStyle('Footer', parent=styles['Normal'], fontSize=7.5, leading=9, textColor=colors.HexColor('#94a3b8'), alignment=1)
    ))

    # Construir documento PDF
    doc.build(story)

    # Preparar texto para WhatsApp
    items_text_list = []
    for it in items:
        items_text_list.append(f"• {it['cantidad']}x {it['nombre']} - {currency_sym} {it['subtotal']:,.2f}")
    items_summary = "\n".join(items_text_list)

    whatsapp_msg = (
        f"👋 ¡Hola {cliente_nombre}! Aquí tienes la cotización solicitada de *{nombre_tienda}*:\n\n"
        f"📄 *N° Cotización:* `{correlativo}`\n\n"
        f"🛍️ *Productos:*\n{items_summary}\n\n"
        f"📦 *Envío:* {metodo_envio} ({currency_sym} {costo_envio:,.2f})\n"
        f"💰 *TOTAL A PAGAR:* *{currency_sym} {total_general:,.2f}*\n\n"
        f"💳 *Medios de Pago:* Yape / Plin / Transferencias bancarias.\n"
        f"⏰ Válido por {validez_dias} días.\n\n"
        f"Quedamos atentos a tu confirmación para preparar y despachar tu pedido. ¡Muchas gracias!"
    )

    return {
        "status": "ok",
        "correlativo": correlativo,
        "filename": filename,
        "filepath": str(filepath),
        "pdf_url": f"/quotes/{filename}",
        "subtotal_productos": subtotal_prods,
        "costo_envio": costo_envio,
        "total": total_general,
        "moneda": moneda,
        "whatsapp_message": whatsapp_msg
    }
