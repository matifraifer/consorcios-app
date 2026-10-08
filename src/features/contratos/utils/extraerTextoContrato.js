import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

// Esquema mixto para la carga con IA:
// - PDF con texto y Word: se extrae el texto acá y solo se envía el texto (como siempre).
// - PDF escaneado (sin capa de texto) y fotos: se envía el archivo y Claude lo lee como
//   documento/imagen. Las fotos se achican antes de enviar (la API acepta hasta 5 MB por
//   imagen y una foto de celular puede superarlo).

const MIN_CARACTERES_TEXTO = 200          // menos que esto en un PDF = escaneado
const MAX_PDF_BYTES = 15 * 1024 * 1024    // margen bajo el límite de 32 MB por pedido (base64 suma ~33%)
const MAX_PAGINAS_PDF = 100               // límite de páginas de Claude Haiku 4.5
const MAX_FOTOS = 20
const MAX_LADO_FOTO = 2000                // px; Claude reduce igual las imágenes más grandes
const EXT_IMAGEN = ['jpg', 'jpeg', 'png', 'webp']

export const ACCEPT_CONTRATO = '.pdf,.docx,.jpg,.jpeg,.png,.webp'

function extension(file) {
  return file.name.split('.').pop()?.toLowerCase()
}

function aBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function leerPdf(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const paginas = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    paginas.push(content.items.map(item => item.str).join(' '))
  }
  return { texto: paginas.join('\n'), numPaginas: pdf.numPages }
}

async function extraerTextoDocx(file) {
  const buffer = await file.arrayBuffer()
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer })
  return value
}

async function comprimirFoto(file) {
  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, MAX_LADO_FOTO / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error(`No se pudo procesar la foto ${file.name}.`)
  return { media_type: 'image/jpeg', data: await aBase64(blob) }
}

// Devuelve { texto } o { archivos: [{ media_type, data(base64) }] } para extraerDatosContrato.
export async function prepararContrato(files) {
  if (!files.length) throw new Error('No se seleccionó ningún archivo.')

  if (files.every(f => EXT_IMAGEN.includes(extension(f)))) {
    if (files.length > MAX_FOTOS) throw new Error(`Podés cargar hasta ${MAX_FOTOS} fotos por contrato.`)
    return { archivos: await Promise.all(files.map(comprimirFoto)) }
  }

  if (files.length > 1) {
    throw new Error('Para cargar varias páginas seleccioná solo fotos (JPG o PNG). Los PDF y Word se cargan de a un archivo.')
  }

  const [file] = files
  const ext = extension(file)

  if (ext === 'docx') {
    const texto = await extraerTextoDocx(file)
    if (!texto.trim()) throw new Error('El archivo Word no tiene texto.')
    return { texto }
  }

  if (ext === 'pdf') {
    const { texto, numPaginas } = await leerPdf(file)
    if (texto.replace(/\s/g, '').length >= MIN_CARACTERES_TEXTO) return { texto }

    // PDF escaneado: se envía el archivo
    if (numPaginas > MAX_PAGINAS_PDF) throw new Error(`El PDF escaneado tiene ${numPaginas} páginas; el máximo es ${MAX_PAGINAS_PDF}.`)
    if (file.size > MAX_PDF_BYTES) throw new Error('El PDF escaneado es demasiado pesado (máximo 15 MB). Probá escanearlo con menor resolución o cargar fotos de las páginas.')
    return { archivos: [{ media_type: 'application/pdf', data: await aBase64(file) }] }
  }

  throw new Error('Formato no soportado. Se aceptan PDF, Word (.docx) o fotos (JPG, PNG, WEBP).')
}
