import jsPDF from 'jspdf'

const ACCENT        = [6, 95, 70]
const ACCENT_LIGHT  = [236, 253, 245]
const ACCENT_PALE   = [220, 252, 231]
const DARK          = [15, 23, 42]
const GRAY          = [107, 114, 128]
const BORDER        = [229, 231, 235]
const PLACEHOLDER_BG = [243, 244, 246]

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

function drawImageContain(doc, img, x, y, w, h) {
  doc.setFillColor(...PLACEHOLDER_BG)
  doc.roundedRect(x, y, w, h, 3, 3, 'F')
  if (!img) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY)
    doc.text('Sin foto disponible', x + w / 2, y + h / 2, { align: 'center' })
    return
  }
  const ratio = Math.min(w / img.width, h / img.height)
  const drawW = img.width * ratio
  const drawH = img.height * ratio
  doc.addImage(img.dataUrl, img.format, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH)
}

function fmtMoneda(value, moneda) {
  if (!value) return '—'
  const n = Number(value).toLocaleString('es-AR', { maximumFractionDigits: 0 })
  return moneda ? `${moneda} ${n}` : n
}

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function slug(text) {
  return (text || 'propiedad')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'propiedad'
}

export async function generarReportePropiedad({
  propiedad, clienteConfig, fotoUrl, visitasWeb, visitasFisicas, contactosCount,
}) {
  const [logo, foto] = await Promise.all([
    tryLoadImage(clienteConfig?.logo_url),
    tryLoadImage(fotoUrl),
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const marginX = 14
  const contentW = pageW - marginX * 2

  // ── Header ──
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, pageW, 26, 'F')

  let textX = marginX
  if (logo) {
    const logoH = 14
    const logoW = Math.min((logo.width / logo.height) * logoH, 30)
    doc.addImage(logo.dataUrl, logo.format, marginX, 6, logoW, logoH)
    textX = marginX + logoW + 5
  }
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(clienteConfig?.nombre || 'Inmobiliaria', textX, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...ACCENT_PALE)
  doc.text('Reporte de propiedad', textX, 19.5)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-AR')}`, pageW - marginX, 14, { align: 'right' })

  // ── Foto principal ──
  const photoY = 34
  const photoH = 88
  drawImageContain(doc, foto, marginX, photoY, contentW, photoH)

  // ── Título + precio ──
  let y = photoY + photoH + 10
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  const tituloLines = doc.splitTextToSize(propiedad.titulo || 'Sin título', contentW * 0.62)
  doc.text(tituloLines, marginX, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...ACCENT)
  doc.text(fmtMoneda(propiedad.precio_publicacion, propiedad.moneda), pageW - marginX, y, { align: 'right' })

  y += tituloLines.length * 7 + 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`Fecha de creación: ${fmtFecha(propiedad.created_at)}`, marginX, y)

  y += 7
  doc.setDrawColor(...BORDER)
  doc.line(marginX, y, pageW - marginX, y)
  y += 10

  // ── Métricas ──
  const tasa = visitasWeb > 0 ? `${((visitasFisicas / visitasWeb) * 100).toFixed(1)}%` : 'Sin datos'
  const stats = [
    { label: 'Visualizaciones web',     value: String(visitasWeb) },
    { label: 'Visitas a la propiedad',  value: String(visitasFisicas) },
    { label: 'Tasa de conversión',      value: tasa },
    { label: 'Contactos vinculados',    value: String(contactosCount) },
  ]
  const gap = 6
  const cardW = (contentW - gap * 3) / 4
  const cardH = 30
  stats.forEach((s, i) => {
    const x = marginX + i * (cardW + gap)
    doc.setFillColor(...ACCENT_LIGHT)
    doc.roundedRect(x, y, cardW, cardH, 3, 3, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...DARK)
    doc.text(s.value, x + cardW / 2, y + 14, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.3)
    doc.setTextColor(...GRAY)
    const labelLines = doc.splitTextToSize(s.label, cardW - 6)
    doc.text(labelLines, x + cardW / 2, y + 21, { align: 'center' })
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('Reporte generado automáticamente — uso interno.', pageW / 2, 285, { align: 'center' })

  doc.save(`reporte-${slug(propiedad.titulo)}.pdf`)
}
