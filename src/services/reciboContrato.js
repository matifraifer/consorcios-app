import jsPDF from 'jspdf'
import { montoEnLetras } from '../shared/utils/numeroALetras'

const ACCENT  = [6, 95, 70]
const DARK    = [15, 23, 42]
const GRAY    = [107, 114, 128]
const BORDER  = [209, 213, 219]

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

async function urlToDataUrl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('No se pudo cargar la imagen')
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function getImageMeta(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = reject
    img.src = dataUrl
  })
}

function formatoDesdeDataUrl(dataUrl) {
  const m = dataUrl.match(/^data:image\/(\w+);/)
  const ext = (m?.[1] || 'png').toLowerCase()
  return ext === 'jpg' ? 'JPEG' : ext.toUpperCase()
}

async function tryLoadImage(url) {
  if (!url) return null
  try {
    const dataUrl = await urlToDataUrl(url)
    const meta = await getImageMeta(dataUrl)
    return { dataUrl, format: formatoDesdeDataUrl(dataUrl), ...meta }
  } catch {
    return null
  }
}

function fmtNumeroRecibo(serie, numero) {
  return `${String(serie).padStart(4, '0')}-${String(numero).padStart(8, '0')}`
}

function fmtFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function fmtMonto(v) {
  return Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function mesDelPeriodo(periodoInicio) {
  const [y, m] = periodoInicio.split('-').map(Number)
  return `${MESES[m - 1]} de ${y}`
}

export async function generarReciboContrato({ recibo, contrato, pago, cargosExtra = [], clienteConfig }) {
  const logo = await tryLoadImage(clienteConfig?.logo_url)

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const marginX = 16
  const contentW = pageW - marginX * 2
  let y = 8

  // ── Encabezado ──
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text('Recibo generado por Granito', pageW / 2, y, { align: 'center' })
  y += 6

  // ── Sección 1: logo+datos del cliente / "X - documento no válido como factura" / N° y fecha ──
  const col1W = contentW * 0.3
  const col2W = contentW * 0.38
  const col3W = contentW - col1W - col2W
  const sec1H = 40

  doc.setDrawColor(...BORDER)
  doc.roundedRect(marginX, y, contentW, sec1H, 2, 2)
  doc.line(marginX + col1W, y, marginX + col1W, y + sec1H)
  doc.line(marginX + col1W + col2W, y, marginX + col1W + col2W, y + sec1H)

  // Columna 1: logo (90% del espacio de su banda) + teléfono/dirección del cliente.
  // El logo suele estar limitado por la altura disponible (no por el ancho), asi que
  // para agrandarlo hay que darle mas alto a esta banda, no mas ancho.
  const logoBandH = 33
  if (logo) {
    const maxW = col1W * 0.9
    const maxH = logoBandH * 0.9
    const ratio = Math.min(maxW / logo.width, maxH / logo.height)
    const w = logo.width * ratio
    const h = logo.height * ratio
    doc.addImage(logo.dataUrl, logo.format, marginX + (col1W - w) / 2, y + 1 + (logoBandH - h) / 2, w, h)
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...DARK)
    doc.text(clienteConfig?.nombre ?? '', marginX + col1W / 2, y + 1 + logoBandH / 2, { align: 'center', maxWidth: col1W - 6 })
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...GRAY)
  let clienteInfoY = y + logoBandH + 3
  if (clienteConfig?.telefono) {
    doc.text(clienteConfig.telefono, marginX + col1W / 2, clienteInfoY, { align: 'center', maxWidth: col1W - 6 })
    clienteInfoY += 3
  }
  if (clienteConfig?.direccion) {
    doc.text(clienteConfig.direccion, marginX + col1W / 2, clienteInfoY, { align: 'center', maxWidth: col1W - 6 })
  }

  // Columna 2: X + leyendas
  const col2CenterX = marginX + col1W + col2W / 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...ACCENT)
  doc.text('X', col2CenterX, y + 18, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text('Documento no válido como factura', col2CenterX, y + 27, { align: 'center', maxWidth: col2W - 6 })
  doc.setFont('helvetica', 'bold')
  doc.text('Recibo para el inquilino', col2CenterX, y + 32, { align: 'center', maxWidth: col2W - 6 })

  // Columna 3: N° y fecha
  const col3X = marginX + col1W + col2W + 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...DARK)
  doc.text('Recibo N°', col3X, y + 17)
  doc.setFontSize(12)
  doc.text(fmtNumeroRecibo(recibo.serie, recibo.numero), col3X, y + 23)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Fecha: ${fmtFecha(recibo.fecha_pago)}`, col3X, y + 30)

  y += sec1H + 4

  // ── Sección 2: nombre y apellido del locatario ──
  const sec2H = 13
  doc.setDrawColor(...BORDER)
  doc.roundedRect(marginX, y, contentW, sec2H, 2, 2)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text('NOMBRE Y APELLIDO', marginX + 5, y + 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...DARK)
  doc.text(`${contrato.inquilino_apellido}, ${contrato.inquilino_nombre}`, marginX + 5, y + 10.5)

  y += sec2H + 4

  // ── Sección 3: detalle ──
  const direccion = contrato.propiedades?.direccion || contrato.propiedades?.titulo || 'sin especificar'
  const conceptoTexto = contrato.es_compraventa
    ? `Cuota del mes de ${mesDelPeriodo(pago.periodo_inicio)}`
    : `Alquiler del mes de ${mesDelPeriodo(pago.periodo_inicio)} (${pago.es_periodo_actualizacion ? 'con actualización' : 'sin actualización'})`
  const montoConcepto = recibo.monto - cargosExtra.reduce((s, c) => s + Number(c.monto), 0)

  const rowH = 6
  const padTop = 9
  const padBottomExtra = 3
  const rowsCount = 2 + cargosExtra.length // Inmueble + Concepto + cargos extra
  const sec3H = padTop + rowsCount * rowH + rowH + padBottomExtra // + fila de Total

  doc.setDrawColor(...BORDER)
  doc.roundedRect(marginX, y, contentW, sec3H, 2, 2)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('DETALLE', marginX + 5, y + 5.5)

  let itemY = y + padTop
  doc.setFontSize(9.5)

  function labelValor(label, valor, montoRow) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(label, marginX + 5, itemY)
    const labelW = doc.getTextWidth(`${label} `)
    doc.setFont('helvetica', 'normal')
    doc.text(valor, marginX + 5 + labelW, itemY, { maxWidth: contentW - labelW - (montoRow ? 45 : 10) })
    if (montoRow !== undefined) {
      doc.text(`$ ${fmtMonto(montoRow)}`, marginX + contentW - 5, itemY, { align: 'right' })
    }
    itemY += rowH
  }

  labelValor('Inmueble:', direccion)
  labelValor('Concepto:', conceptoTexto, montoConcepto)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...DARK)
  cargosExtra.forEach(c => {
    doc.text(`+ ${c.descripcion}`, marginX + 5, itemY, { maxWidth: contentW - 45 })
    doc.text(`$ ${fmtMonto(c.monto)}`, marginX + contentW - 5, itemY, { align: 'right' })
    itemY += rowH
  })

  doc.setDrawColor(...BORDER)
  doc.line(marginX + 5, itemY - rowH / 2 + 1, marginX + contentW - 5, itemY - rowH / 2 + 1)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...DARK)
  doc.text('Total', marginX + 5, itemY + 4)
  doc.text(`$ ${fmtMonto(recibo.monto)}`, marginX + contentW - 5, itemY + 4, { align: 'right' })

  y += sec3H + 5

  // ── Sección 4: leyenda del recibo ──
  const conceptoLeyenda = contrato.es_compraventa ? 'compraventa' : 'alquiler'
  const leyenda = `Por cuenta y orden del Propietario, recibimos de ${contrato.inquilino_nombre} ${contrato.inquilino_apellido} la suma de ${montoEnLetras(recibo.monto)} ($ ${fmtMonto(recibo.monto)}) en concepto de pago de ${conceptoLeyenda} del inmueble ${direccion} correspondiente al mes de ${mesDelPeriodo(pago.periodo_inicio)}.`

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...DARK)
  const leyendaLines = doc.splitTextToSize(leyenda, contentW)
  doc.text(leyendaLines, marginX, y, { lineHeightFactor: 1.3 })
  y += leyendaLines.length * 4.8 + 8

  // ── Sección 5: firmas ──
  const firmaY = y + 8
  doc.setDrawColor(...DARK)
  doc.line(marginX, firmaY, marginX + contentW / 2 - 10, firmaY)
  doc.line(marginX + contentW / 2 + 10, firmaY, marginX + contentW, firmaY)

  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  doc.text('Firma y aclaración inquilino', marginX + (contentW / 2 - 10) / 2, firmaY + 4.5, { align: 'center' })
  doc.text('Firma y aclaración propietario', marginX + contentW / 2 + 10 + (contentW / 2 - 10) / 2, firmaY + 4.5, { align: 'center' })

  doc.save(`recibo-${fmtNumeroRecibo(recibo.serie, recibo.numero)}.pdf`)
}
