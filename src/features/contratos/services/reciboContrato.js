import jsPDF from 'jspdf'
import { montoEnLetras } from '../../../shared/utils/numeroALetras'

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

function mesAnioCapitalizado(fechaConMes) {
  const [y, m] = fechaConMes.split('-').map(Number)
  const mes = MESES[m - 1]
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${y}`
}

// Arma el PDF de recibo (mismo layout para el recibo del inquilino y el de rendición
// al propietario, solo cambian los datos que se le pasan) y lo descarga.
async function construirYDescargarRecibo({
  recibo, clienteConfig,
  rolLeyenda, nombreCampoLabel, destinatarioNombre, destinatarioApellido,
  cuotaNumero, mesPeriodo, vencimientoFecha, direccion,
  conceptoTexto, montoConcepto, cargos, leyenda,
  firmaIzqLabel, firmaDerLabel,
}) {
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
  doc.text(rolLeyenda, col2CenterX, y + 32, { align: 'center', maxWidth: col2W - 6 })

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

  // ── Sección 2: datos del destinatario y del pago (2 columnas x 2 filas) ──
  const sec2H = 26
  const sec2Row1Y = y + 6
  const sec2Row2Y = y + 18
  const sec2ColA = marginX + 5
  const sec2ColB = marginX + contentW / 2 + 5

  doc.setDrawColor(...BORDER)
  doc.roundedRect(marginX, y, contentW, sec2H, 2, 2)
  doc.line(marginX + contentW / 2, y, marginX + contentW / 2, y + sec2H)
  doc.line(marginX, y + sec2H / 2, marginX + contentW, y + sec2H / 2)

  function campoSec2(label, valor, colX, rowY) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text(label, colX, rowY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.text(valor, colX, rowY + 5.5, { maxWidth: contentW / 2 - 10 })
  }

  campoSec2(nombreCampoLabel, `${destinatarioApellido}, ${destinatarioNombre}`, sec2ColA, sec2Row1Y)
  campoSec2('CUOTA', `${cuotaNumero}`, sec2ColB, sec2Row1Y)
  campoSec2('MES', mesAnioCapitalizado(mesPeriodo), sec2ColA, sec2Row2Y)
  campoSec2('VENCIMIENTO DEL PAGO', fmtFecha(vencimientoFecha), sec2ColB, sec2Row2Y)

  y += sec2H + 4

  // ── Sección 3: detalle ──
  const rowH = 7
  const padTop = 10
  const padBottomExtra = 4
  doc.setFontSize(9.5)

  // Se calculan de antemano los renglones que ocupa cada línea (algunos conceptos
  // envuelven a 2 líneas) para poder dimensionar el recuadro sin que el texto quede
  // pegado al total o al borde inferior.
  function lineasDe(label, valor, montoRow) {
    const labelW = doc.getTextWidth(`${label} `)
    const maxWidth = contentW - labelW - (montoRow !== undefined ? 45 : 10)
    return doc.splitTextToSize(valor, maxWidth)
  }

  const inmuebleLineas = lineasDe('Inmueble:', direccion)
  const conceptoLineas = lineasDe('Concepto:', conceptoTexto, montoConcepto)
  const rowsCount = inmuebleLineas.length + conceptoLineas.length + cargos.length
  const sec3H = padTop + rowsCount * rowH + rowH + padBottomExtra // + fila de Total

  doc.setDrawColor(...BORDER)
  doc.roundedRect(marginX, y, contentW, sec3H, 2, 2)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('DETALLE', marginX + 5, y + 5.5)

  let itemY = y + padTop
  doc.setFontSize(9.5)

  function labelValor(label, lineas, montoRow) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(label, marginX + 5, itemY)
    const labelW = doc.getTextWidth(`${label} `)
    doc.setFont('helvetica', 'normal')
    doc.text(lineas, marginX + 5 + labelW, itemY)
    if (montoRow !== undefined) {
      doc.text(`$ ${fmtMonto(montoRow)}`, marginX + contentW - 5, itemY, { align: 'right' })
    }
    itemY += rowH * lineas.length
  }

  labelValor('Inmueble:', inmuebleLineas)
  labelValor('Concepto:', conceptoLineas, montoConcepto)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...DARK)
  cargos.forEach(c => {
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
  doc.text(firmaIzqLabel, marginX + (contentW / 2 - 10) / 2, firmaY + 4.5, { align: 'center' })
  doc.text(firmaDerLabel, marginX + contentW / 2 + 10 + (contentW / 2 - 10) / 2, firmaY + 4.5, { align: 'center' })

  doc.save(`recibo-${fmtNumeroRecibo(recibo.serie, recibo.numero)}.pdf`)
}

export async function generarReciboContrato({ recibo, contrato, pago, cargosExtra = [], clienteConfig }) {
  // Recibos generados a partir de la migración 0043 traen su propio snapshot (no se
  // recalcula con los datos actuales de contrato/pago, que pueden haber cambiado desde
  // el pago). Los recibos viejos, sin snapshot, siguen derivando esos datos en vivo.
  const inquilinoNombre = recibo.inquilino_nombre ?? contrato.inquilino_nombre
  const inquilinoApellido = recibo.inquilino_apellido ?? contrato.inquilino_apellido
  const direccion = recibo.direccion_inmueble ?? (contrato.propiedades?.direccion || contrato.propiedades?.titulo || 'sin especificar')
  const esCompraventa = recibo.es_compraventa ?? contrato.es_compraventa
  const cuotaNumero = recibo.cuota_numero ?? pago.periodo_numero
  const mesPeriodo = recibo.periodo_mes ?? pago.periodo_inicio
  const vencimientoFecha = recibo.vencimiento_fecha ?? contrato.fecha_fin
  const cargos = recibo.cargos_extra?.length ? recibo.cargos_extra : cargosExtra

  const conceptoTexto = esCompraventa
    ? `Cuota del mes de ${mesDelPeriodo(mesPeriodo)}`
    : `Alquiler del mes de ${mesDelPeriodo(mesPeriodo)} (${pago.es_periodo_actualizacion ? 'con actualización' : 'sin actualización'})`
  const montoConcepto = recibo.monto - cargos.reduce((s, c) => s + Number(c.monto), 0)

  const conceptoLeyenda = esCompraventa ? 'compraventa' : 'alquiler'
  const leyenda = `Por cuenta y orden del Propietario, recibimos de ${inquilinoNombre} ${inquilinoApellido} la suma de ${montoEnLetras(recibo.monto)} ($ ${fmtMonto(recibo.monto)}) en concepto de pago de ${conceptoLeyenda} del inmueble ${direccion} correspondiente al mes de ${mesDelPeriodo(mesPeriodo)}.`

  await construirYDescargarRecibo({
    recibo, clienteConfig,
    rolLeyenda: 'Recibo para el inquilino',
    nombreCampoLabel: 'NOMBRE Y APELLIDO DEL INQUILINO',
    destinatarioNombre: inquilinoNombre,
    destinatarioApellido: inquilinoApellido,
    cuotaNumero, mesPeriodo, vencimientoFecha, direccion,
    conceptoTexto, montoConcepto, cargos, leyenda,
    firmaIzqLabel: 'Firma y aclaración inquilino',
    firmaDerLabel: 'Firma y aclaración propietario',
  })
}

// Recibo de rendición: lo que la inmobiliaria le cobra al propietario por la gestión
// del alquiler (comisión de gestión % del monto de alquiler cobrado ese período).
export async function generarReciboPropietario({ recibo, contrato, pago, clienteConfig }) {
  const propietarioNombre = recibo.propietario_nombre ?? contrato.propietario_nombre
  const propietarioApellido = recibo.propietario_apellido ?? contrato.propietario_apellido
  const direccion = recibo.direccion_inmueble ?? (contrato.propiedades?.direccion || contrato.propiedades?.titulo || 'sin especificar')
  const cuotaNumero = recibo.cuota_numero ?? pago.periodo_numero
  const mesPeriodo = recibo.periodo_mes ?? pago.periodo_inicio
  const vencimientoFecha = recibo.vencimiento_fecha ?? contrato.fecha_fin

  const conceptoTexto = `Comisión de gestión del mes de ${mesDelPeriodo(mesPeriodo)} (${fmtMonto(recibo.comision_pct)}% sobre $ ${fmtMonto(recibo.monto_alquiler)})`
  const leyenda = `En concepto de comisión por la gestión y administración del alquiler del inmueble ${direccion}, correspondiente al mes de ${mesDelPeriodo(mesPeriodo)}, se rinde al Propietario ${propietarioNombre} ${propietarioApellido} la suma de ${montoEnLetras(recibo.monto)} ($ ${fmtMonto(recibo.monto)}).`

  await construirYDescargarRecibo({
    recibo, clienteConfig,
    rolLeyenda: 'Recibo para el propietario',
    nombreCampoLabel: 'NOMBRE Y APELLIDO DEL PROPIETARIO',
    destinatarioNombre: propietarioNombre,
    destinatarioApellido: propietarioApellido,
    cuotaNumero, mesPeriodo, vencimientoFecha, direccion,
    conceptoTexto, montoConcepto: recibo.monto, cargos: [], leyenda,
    firmaIzqLabel: 'Firma y aclaración propietario',
    firmaDerLabel: 'Firma y aclaración inmobiliaria',
  })
}
