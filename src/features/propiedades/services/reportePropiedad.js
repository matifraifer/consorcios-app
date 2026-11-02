import jsPDF from 'jspdf'

// Tokens del "Consorcios Design System v1.0" (consorcios-landing/src/theme/tokens.js):
// naranja protagonista (precio, CTA, acentos) + verde bosque de estructura.
// Los tonos con alpha del sistema están pre-mezclados sobre blanco (jsPDF no usa alpha).
const ORANGE         = [251, 60, 0]     // #fb3c00
const ORANGE_SUBTLE  = [255, 242, 237]  // #fff2ed
const GREEN_900      = [20, 43, 33]     // #142B21 — estructura y texto
const TEXT_ON_DARK   = [226, 240, 232]  // #E2F0E8
const TEXT_ON_DARK_MUTED = [144, 155, 150] // rgba(226,240,232,0.6) sobre #142B21
const TEXT_MUTED     = [133, 145, 140]  // rgba(20,43,33,0.52)
const TEXT_BODY      = [70, 86, 79]     // rgba(20,43,33,0.80)
const BG             = [247, 250, 249]  // #f7faf9
const BORDER         = [232, 234, 233]  // rgba(20,43,33,0.10)
const PLACEHOLDER_BG = [246, 247, 246]  // rgba(20,43,33,0.04)

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
    doc.setTextColor(...TEXT_MUTED)
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

function fmtNumero(value, sufijo = '') {
  if (value == null || value === '' || Number(value) === 0) return '—'
  return `${Number(value).toLocaleString('es-AR')}${sufijo}`
}

function mapsUrl(propiedad) {
  if (propiedad.latitud != null && propiedad.longitud != null) {
    return `https://www.google.com/maps/search/?api=1&query=${propiedad.latitud},${propiedad.longitud}`
  }
  const direccion = [propiedad.direccion, propiedad.localidad, propiedad.provincia].filter(Boolean).join(', ')
  return direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}` : null
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
  propiedad, clienteConfig, fotoUrl,
}) {
  const [logo, foto, logoGranito] = await Promise.all([
    tryLoadImage(clienteConfig?.logo_url),
    tryLoadImage(fotoUrl),
    tryLoadImage('/logo-email.png'), // PNG: jsPDF no soporta el logo.svg
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 14
  const contentW = pageW - marginX * 2
  const bottomLimit = pageH - 20

  const nombreCliente = clienteConfig?.nombre || 'Inmobiliaria'

  // ── Header ──
  doc.setFillColor(...GREEN_900)
  doc.rect(0, 0, pageW, 26, 'F')
  doc.setFillColor(...ORANGE)
  doc.rect(0, 26, pageW, 1.2, 'F')

  let textX = marginX
  if (logo) {
    const logoH = 14
    const logoW = Math.min((logo.width / logo.height) * logoH, 30)
    doc.addImage(logo.dataUrl, logo.format, marginX, 6, logoW, logoH)
    textX = marginX + logoW + 5
  }
  doc.setTextColor(...TEXT_ON_DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(nombreCliente, textX, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...TEXT_ON_DARK_MUTED)
  doc.text('Reporte de propiedad', textX, 19.5)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-AR')}`, pageW - marginX, 14, { align: 'right' })

  // Header reducido para las páginas siguientes
  function drawHeaderContinuacion() {
    doc.setFillColor(...GREEN_900)
    doc.rect(0, 0, pageW, 12, 'F')
    doc.setFillColor(...ORANGE)
    doc.rect(0, 12, pageW, 0.8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_ON_DARK)
    doc.text(nombreCliente, marginX, 7.8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TEXT_ON_DARK_MUTED)
    const tituloCorto = doc.splitTextToSize(propiedad.titulo || 'Reporte de propiedad', contentW * 0.6)[0]
    doc.text(tituloCorto, pageW - marginX, 7.8, { align: 'right' })
  }

  let y = 0
  function ensureSpace(h) {
    if (y + h <= bottomLimit) return
    doc.addPage()
    drawHeaderContinuacion()
    y = 22
  }

  function sectionTitle(text) {
    ensureSpace(14)
    doc.setFillColor(...ORANGE)
    doc.roundedRect(marginX, y - 3.6, 1.2, 4.6, 0.6, 0.6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...GREEN_900)
    doc.text(text, marginX + 4, y)
    y += 6
  }

  // ── Foto principal ──
  const photoY = 34
  const photoH = 80
  drawImageContain(doc, foto, marginX, photoY, contentW, photoH)

  // ── Título + precio ──
  y = photoY + photoH + 10
  doc.setTextColor(...GREEN_900)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  const tituloLines = doc.splitTextToSize(propiedad.titulo || 'Sin título', contentW * 0.62)
  doc.text(tituloLines, marginX, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...ORANGE)
  doc.text(fmtMoneda(propiedad.precio_publicacion, propiedad.moneda), pageW - marginX, y, { align: 'right' })

  y += tituloLines.length * 7 + 4
  const subtitulo = [propiedad.tipo_propiedad, propiedad.tipo_operacion, propiedad.estado].filter(Boolean).join('  ·  ')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT_MUTED)
  doc.text(
    [subtitulo, `Fecha de creación: ${fmtFecha(propiedad.created_at)}`].filter(Boolean).join('     |     '),
    marginX, y,
  )

  y += 6
  doc.setDrawColor(...BORDER)
  doc.line(marginX, y, pageW - marginX, y)
  y += 8

  // Métricas (visualizaciones web, visitas, conversión, contactos) ocultas de momento
  const gap = 6

  // ── Descripción ──
  if (propiedad.descripcion?.trim()) {
    sectionTitle('Descripción')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...TEXT_BODY)
    const lineH = 4.8
    const lines = doc.splitTextToSize(propiedad.descripcion.trim(), contentW)
    lines.forEach(line => {
      if (y + lineH > bottomLimit) {
        ensureSpace(lineH)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        doc.setTextColor(...TEXT_BODY)
      }
      doc.text(line, marginX, y)
      y += lineH
    })
    y += 7
  }

  // ── Características ──
  sectionTitle('Características')
  const caracteristicas = [
    { label: 'Tipo de propiedad', value: propiedad.tipo_propiedad || '—' },
    { label: 'Tipo de operación', value: propiedad.tipo_operacion || '—' },
    { label: 'Ambientes',         value: fmtNumero(propiedad.ambientes) },
    { label: 'Dormitorios',       value: fmtNumero(propiedad.dormitorios) },
    { label: 'Baños',             value: fmtNumero(propiedad.banios) },
    { label: 'Cochera',           value: propiedad.cochera ? 'Sí' : 'No' },
    { label: 'Metros cubiertos',  value: fmtNumero(propiedad.metros_cubiertos, ' m²') },
    { label: 'Metros totales',    value: fmtNumero(propiedad.metros_totales, ' m²') },
  ]
  const cols = 4
  const tileW = (contentW - gap * (cols - 1)) / cols
  const tileH = 16
  for (let i = 0; i < caracteristicas.length; i += cols) {
    ensureSpace(tileH + gap)
    caracteristicas.slice(i, i + cols).forEach((c, j) => {
      const x = marginX + j * (tileW + gap)
      doc.setDrawColor(...BORDER)
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(x, y, tileW, tileH, 4, 4, 'FD')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.3)
      doc.setTextColor(...TEXT_MUTED)
      doc.text(c.label, x + 4, y + 6)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10.5)
      doc.setTextColor(...GREEN_900)
      doc.text(doc.splitTextToSize(c.value, tileW - 8)[0], x + 4, y + 12)
    })
    y += tileH + gap * 0.6
  }
  y += 7

  // ── Ubicación ──
  sectionTitle('Ubicación')
  const ubicacion = [
    { label: 'Provincia', value: propiedad.provincia || '—' },
    { label: 'Localidad', value: propiedad.localidad || '—' },
    { label: 'Dirección', value: propiedad.direccion || '—' },
  ]
  const linkMaps = mapsUrl(propiedad)
  const ubicColW = (contentW - 8 - gap * 2) / 3
  const ubicH = linkMaps ? 30 : 18
  ensureSpace(ubicH)
  doc.setDrawColor(...BORDER)
  doc.setFillColor(...BG)
  doc.roundedRect(marginX, y, contentW, ubicH, 4, 4, 'FD')
  ubicacion.forEach((u, i) => {
    const x = marginX + 4 + i * (ubicColW + gap)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.3)
    doc.setTextColor(...TEXT_MUTED)
    doc.text(u.label, x, y + 7)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...GREEN_900)
    doc.text(doc.splitTextToSize(u.value, ubicColW)[0], x, y + 13)
  })
  if (linkMaps) {
    const btnLabel = 'Ver ubicación en Google Maps'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    const btnW = doc.getTextWidth(btnLabel) + 10
    const btnH = 7.5
    const btnX = marginX + 4
    const btnY = y + ubicH - btnH - 4
    doc.setFillColor(...ORANGE)
    doc.roundedRect(btnX, btnY, btnW, btnH, 2.5, 2.5, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(btnLabel, btnX + btnW / 2, btnY + 5, { align: 'center' })
    doc.link(btnX, btnY, btnW, btnH, { url: linkMaps })
  }
  y += ubicH + 11



  // ── Footer en todas las páginas ──
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...BORDER)
    doc.line(marginX, pageH - 15, pageW - marginX, pageH - 15)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_MUTED)
    let footerX = marginX
    if (logoGranito) {
      const logoH = 3.6
      const logoW = (logoGranito.width / logoGranito.height) * logoH
      doc.addImage(logoGranito.dataUrl, logoGranito.format, marginX, pageH - 10 - logoH + 0.8, logoW, logoH)
      footerX = marginX + logoW + 2
    }
    doc.text('Reporte generado automáticamente por Granito', footerX, pageH - 10)
    doc.text(`Página ${p} de ${totalPages}`, pageW - marginX, pageH - 10, { align: 'right' })
  }

  doc.save(`reporte-${slug(propiedad.titulo)}.pdf`)
}
