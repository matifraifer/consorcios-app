import {
  EXT_IMAGEN, MAX_PAGINAS_PDF, MAX_PDF_BYTES, MIN_CARACTERES_TEXTO,
  aBase64, comprimirFoto, extension, extraerTextoDocx, leerPdf,
} from '../../contratos/utils/extraerTextoContrato.js'

// Mismo esquema mixto que la carga de contratos con IA, pero acepta varios archivos de
// distinto tipo a la vez (escritura en PDF + plano escaneado + fotos del inmueble):
// - PDF con texto y Word: se extrae el texto acá y solo se envía el texto.
// - PDF escaneado y fotos: se envía el archivo (las fotos achicadas).
// Cada archivo va con su nombre para que la IA indique de dónde sacó cada dato.

export const MAX_ARCHIVOS_PROPIEDAD = 8
export const ACCEPT_DOCUMENTOS_PROPIEDAD = '.pdf,.docx,.jpg,.jpeg,.png,.webp'
const EXT_COMPATIBLES = ['pdf', 'docx', ...EXT_IMAGEN]
const MAX_BASE64_TOTAL = 24 * 1024 * 1024 // margen bajo el límite de 32 MB por pedido de la API
const FORMATOS_TEXTO = 'Se aceptan PDF, Word (.docx) y fotos JPG, PNG o WEBP.'

export function esImagen(file) {
  return EXT_IMAGEN.includes(extension(file))
}

// Devuelve [{ nombre, texto } | { nombre, media_type, data(base64) }] para extraerDatosPropiedad.
export async function prepararDocumentosPropiedad(files) {
  if (!files.length) throw new Error('No se seleccionó ningún archivo.')
  if (files.length > MAX_ARCHIVOS_PROPIEDAD) {
    throw new Error(`Podés cargar hasta ${MAX_ARCHIVOS_PROPIEDAD} archivos por vez.`)
  }

  const incompatibles = files.filter(f => !EXT_COMPATIBLES.includes(extension(f)))
  if (incompatibles.length) {
    const nombres = incompatibles.map(f => `"${f.name}"`).join(', ')
    throw new Error(incompatibles.length > 1
      ? `El formato de los archivos ${nombres} no es compatible. ${FORMATOS_TEXTO}`
      : `El formato del archivo ${nombres} no es compatible. ${FORMATOS_TEXTO}`)
  }

  const documentos = []
  for (const file of files) {
    const ext = extension(file)
    const nombre = file.name

    if (ext === 'docx') {
      const texto = await extraerTextoDocx(file)
      if (!texto.trim()) throw new Error(`El archivo Word "${nombre}" no tiene texto.`)
      documentos.push({ nombre, texto })
      continue
    }

    if (ext === 'pdf') {
      const { texto, numPaginas } = await leerPdf(file)
      if (texto.replace(/\s/g, '').length >= MIN_CARACTERES_TEXTO) {
        documentos.push({ nombre, texto })
        continue
      }
      if (numPaginas > MAX_PAGINAS_PDF) throw new Error(`El PDF escaneado "${nombre}" tiene ${numPaginas} páginas; el máximo es ${MAX_PAGINAS_PDF}.`)
      if (file.size > MAX_PDF_BYTES) throw new Error(`El PDF escaneado "${nombre}" es demasiado pesado (máximo 15 MB).`)
      documentos.push({ nombre, media_type: 'application/pdf', data: await aBase64(file) })
      continue
    }

    documentos.push({ nombre, ...(await comprimirFoto(file)) })
  }

  const total = documentos.reduce((acc, d) => acc + (d.data?.length ?? 0), 0)
  if (total > MAX_BASE64_TOTAL) {
    throw new Error('Los archivos escaneados o fotos son demasiado pesados en conjunto. Probá cargar menos archivos o escanearlos con menor resolución.')
  }

  return documentos
}
