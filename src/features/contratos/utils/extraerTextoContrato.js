import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

async function extraerTextoPdf(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const paginas = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    paginas.push(content.items.map(item => item.str).join(' '))
  }
  return paginas.join('\n')
}

async function extraerTextoDocx(file) {
  const buffer = await file.arrayBuffer()
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer })
  return value
}

export async function extraerTexto(file) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return extraerTextoPdf(file)
  if (ext === 'docx') return extraerTextoDocx(file)
  throw new Error('Formato no soportado. Solo se aceptan archivos .pdf o .docx.')
}
