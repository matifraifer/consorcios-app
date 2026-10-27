import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Box, Typography, Drawer, IconButton, Button, Alert, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Divider, LinearProgress,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DownloadIcon from '@mui/icons-material/Download'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import GroupAddIcon from '@mui/icons-material/GroupAdd'
import { importarContactos } from '../../services/crm'
import { useAuth } from '../../../auth/AuthContext.jsx'
import { EMBUDO_CONTACTO, ORIGENES_CONTACTO, TIPOS_CONTACTO } from '../../constants/contactos'

const ACCENT = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'

// Columnas de la plantilla, en orden. Las indicaciones se usan en el drawer,
// en la hoja "Instrucciones" y en el comentario de cada encabezado del Excel.
const COLUMNAS_PLANTILLA = [
  { nombre: 'Nombre', obligatorio: true, indicaciones: ['Nombre de pila del contacto.'] },
  { nombre: 'Apellido', obligatorio: true, indicaciones: ['Apellido del contacto.'] },
  {
    nombre: 'Tipo', obligatorio: true, indicaciones: [
      `Valores admitidos: ${TIPOS_CONTACTO.join(', ')}.`,
      'Se pueden cargar varios separados por coma (ej. PROPIETARIO, INVERSOR).',
      'No distingue mayúsculas de minúsculas.',
    ],
  },
  { nombre: 'Teléfono', obligatorio: true, indicaciones: ['Celular con código de área, sin 0 ni 15 (ej. 2641234567).'] },
  {
    nombre: 'DNI', obligatorio: false, indicaciones: [
      'Solo números, sin puntos (ej. 30123456).',
      'Si ya existe un contacto con ese DNI, la fila se marca como duplicada.',
    ],
  },
  {
    nombre: 'Correo electrónico', obligatorio: false, indicaciones: [
      'Ej. juan.garcia@email.com.',
      'Si ya existe un contacto con ese correo, la fila se marca como duplicada.',
    ],
  },
  {
    nombre: 'Origen del contacto', obligatorio: false, indicaciones: [
      `Valores admitidos: ${ORIGENES_CONTACTO.join(', ')}.`,
      'Un solo valor por fila.',
    ],
  },
  {
    nombre: 'Embudo de ventas', obligatorio: false, indicaciones: [
      `Valores admitidos: ${EMBUDO_CONTACTO.join(', ')}.`,
      'Un solo valor por fila.',
    ],
  },
]

function tituloColumna(col) {
  return `${col.nombre} (${col.obligatorio ? 'obligatorio' : 'opcional'})`
}

function SectionLabel({ children }) {
  return (
    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9CA3AF', mt: 3, mb: 1.5 }}>
      {children}
    </Typography>
  )
}

function CountBox({ icon, value, label, color, bg, border }) {
  return (
    <Box sx={{ flex: 1, textAlign: 'center', bgcolor: bg, border: `1px solid ${border}`, borderRadius: '10px', py: 1.5 }}>
      {icon}
      <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, color, lineHeight: 1.2, mt: 0.5 }}>{value}</Typography>
      <Typography sx={{ fontSize: '0.68rem', color: '#6B7280', mt: 0.25 }}>{label}</Typography>
    </Box>
  )
}

export default function ImportarContactosDrawer({ open, onClose, clienteId, onImported }) {
  const { user } = useAuth()
  const fileInputRef = useRef(null)
  const [preview, setPreview] = useState([])
  const [resultados, setResultados] = useState([])
  const [importing, setImporting] = useState(false)
  const [fileError, setFileError] = useState(null)

  function reset() {
    setPreview([])
    setResultados([])
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    const hayImportados = resultados.some(r => r.estado === 'importado')
    reset()
    onClose()
    if (hayImportados) onImported?.()
  }

  function descargarPlantilla() {
    const ws = XLSX.utils.aoa_to_sheet([
      COLUMNAS_PLANTILLA.map(c => c.nombre),
      ['Juan', 'García', 'COMPRADOR', '2641234567', '30123456', 'juan.garcia@email.com', 'REDES SOCIALES', 'PROSPECTO'],
      ['María', 'López', 'PROPIETARIO, INVERSOR', '2647654321', '28765432', '', 'AMIGO', '1er contacto'],
    ])
    ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 26 }, { wch: 20 }, { wch: 18 }]

    // Comentario en cada encabezado con las indicaciones de la columna (se ve al pasar el mouse)
    COLUMNAS_PLANTILLA.forEach((col, i) => {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })]
      cell.c = [{ a: 'Granito', t: [tituloColumna(col), ...col.indicaciones.map(b => `• ${b}`)].join('\n') }]
      cell.c.hidden = true
    })

    // Hoja de instrucciones: una sección por columna con sus indicaciones en viñetas
    const instrucciones = XLSX.utils.aoa_to_sheet([
      ['Cómo completar la plantilla de contactos'],
      ['• Completá los datos en la hoja "Contactos", una fila por contacto, sin cambiar el orden de las columnas.'],
      ['• Las filas de ejemplo (Juan García y María López) se pueden borrar o reemplazar.'],
      ['• Los contactos con un DNI o correo que ya existe en el sistema se informan como duplicados y no se importan.'],
      [''],
      ...COLUMNAS_PLANTILLA.flatMap((col, i) => [
        [`${String.fromCharCode(65 + i)}. ${tituloColumna(col)}`],
        ...col.indicaciones.map(b => [`   • ${b}`]),
        [''],
      ]),
    ])
    instrucciones['!cols'] = [{ wch: 110 }]

    // Hoja de referencia con los valores admitidos en cada columna de clasificación
    const maxLen = Math.max(TIPOS_CONTACTO.length, ORIGENES_CONTACTO.length, EMBUDO_CONTACTO.length)
    const valores = XLSX.utils.aoa_to_sheet([
      ['Tipo', 'Origen del contacto', 'Embudo de ventas'],
      ...Array.from({ length: maxLen }, (_, i) => [TIPOS_CONTACTO[i] ?? '', ORIGENES_CONTACTO[i] ?? '', EMBUDO_CONTACTO[i] ?? '']),
    ])
    valores['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 18 }]

    const wb = XLSX.utils.book_new()
    // "Contactos" tiene que quedar primera: la importación lee la primera hoja
    XLSX.utils.book_append_sheet(wb, ws, 'Contactos')
    XLSX.utils.book_append_sheet(wb, instrucciones, 'Instrucciones')
    XLSX.utils.book_append_sheet(wb, valores, 'Valores admitidos')
    XLSX.writeFile(wb, 'plantilla_contactos.xlsx')
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls'].includes(ext)) {
      setFileError(`Formato no permitido (.${ext}). Solo se aceptan archivos .xlsx o .xls.`)
      e.target.value = ''
      return
    }
    setFileError(null)
    setPreview([])
    setResultados([])

    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
        const filas = rows
          .slice(1)
          .map((r, i) => ({
            _fila: i + 2,
            nombre: String(r[0] ?? '').trim(),
            apellido: String(r[1] ?? '').trim(),
            tipo: String(r[2] ?? '').trim(),
            telefono: String(r[3] ?? '').trim(),
            dni: String(r[4] ?? '').trim(),
            email: String(r[5] ?? '').trim(),
            origen_contacto: String(r[6] ?? '').trim(),
            embudo_contacto: String(r[7] ?? '').trim(),
          }))
          .filter(f => f.nombre || f.apellido || f.tipo || f.telefono || f.dni || f.email || f.origen_contacto || f.embudo_contacto)
        if (filas.length === 0) {
          setFileError('El archivo no contiene filas con datos.')
          return
        }
        setPreview(filas)
      } catch {
        setFileError('No se pudo leer el archivo. Asegurate de que sea un .xlsx o .xls válido.')
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  async function handleImportar() {
    if (preview.length === 0) return
    setImporting(true)
    setFileError(null)
    try {
      const res = await importarContactos(preview, clienteId, user?.nombre_usuario ?? null)
      setResultados(res)
    } catch (err) {
      setFileError(err.message)
    } finally {
      setImporting(false)
    }
  }

  const importados  = resultados.filter(r => r.estado === 'importado')
  const errores      = resultados.filter(r => r.estado === 'error')
  const duplicados   = resultados.filter(r => r.estado === 'duplicado')

  return (
    <Drawer anchor="right" open={open} onClose={handleClose}
      slotProps={{ paper: { sx: { width: 560, bgcolor: 'white', display: 'flex', flexDirection: 'column' } } }}>

      {/* Header */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center" gap={1.25}>
          <Box sx={{ width: 28, height: 28, borderRadius: '7px', bgcolor: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GroupAddIcon sx={{ fontSize: 15, color: ACCENT }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>Importar contactos</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF' }}>Carga masiva desde un archivo Excel</Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={handleClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2 }}>
        {fileError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }} onClose={() => setFileError(null)}>{fileError}</Alert>}

        {resultados.length === 0 && (
          <>
            {/* Paso 1: plantilla */}
            <SectionLabel>1. Descargá la plantilla</SectionLabel>
            <Typography sx={{ fontSize: '0.8rem', color: '#6B7280', mb: 1.5 }}>
              Completá la hoja "Contactos" respetando el orden de las columnas. La plantilla incluye estas mismas indicaciones en la hoja "Instrucciones".
            </Typography>
            <Box sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', mb: 2, overflow: 'hidden' }}>
              {COLUMNAS_PLANTILLA.map((col, i) => (
                <Box key={col.nombre} sx={{ px: 1.75, py: 1.1, borderBottom: i < COLUMNAS_PLANTILLA.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <Box display="flex" alignItems="center" gap={1} mb={0.25}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#111827' }}>{col.nombre}</Typography>
                    <Box component="span" sx={{
                      px: 0.75, py: 0.1, borderRadius: '5px', fontSize: '0.62rem', fontWeight: 700,
                      ...(col.obligatorio
                        ? { color: '#B91C1C', bgcolor: '#FEF2F2', border: '1px solid #FECACA' }
                        : { color: '#6B7280', bgcolor: '#F3F4F6', border: '1px solid #E5E7EB' }),
                    }}>
                      {col.obligatorio ? 'Obligatorio' : 'Opcional'}
                    </Box>
                  </Box>
                  <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
                    {col.indicaciones.map(b => (
                      <Typography key={b} component="li" sx={{ fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.55 }}>{b}</Typography>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
              onClick={descargarPlantilla}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', borderColor: '#E5E7EB', color: '#374151', '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: ACCENT_LIGHT } }}
            >
              Descargar plantilla de ejemplo
            </Button>

            {/* Paso 2: subir archivo */}
            <SectionLabel>2. Subí el archivo completado</SectionLabel>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleFileChange} />
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', borderColor: '#E5E7EB', color: '#374151', '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: ACCENT_LIGHT } }}
            >
              Seleccionar archivo Excel
            </Button>

            {/* Vista previa */}
            {preview.length > 0 && (
              <>
                <SectionLabel>3. Confirmá la importación</SectionLabel>
                <Typography sx={{ fontSize: '0.78rem', color: '#6B7280', mb: 1.5 }}>
                  Vista previa — {preview.length} fila{preview.length !== 1 ? 's' : ''} detectada{preview.length !== 1 ? 's' : ''}
                </Typography>
                <Box sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', maxHeight: 280, overflowY: 'auto', mb: 2 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Fila', 'Nombre', 'Apellido', 'Tipo', 'Teléfono', 'DNI', 'Email', 'Origen', 'Embudo'].map(h => (
                          <TableCell key={h} sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#9CA3AF', bgcolor: '#F9FAFB' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {preview.map(f => (
                        <TableRow key={f._fila}>
                          <TableCell sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>{f._fila}</TableCell>
                          <TableCell sx={{ fontSize: '0.78rem' }}>{f.nombre || '—'}</TableCell>
                          <TableCell sx={{ fontSize: '0.78rem' }}>{f.apellido || '—'}</TableCell>
                          <TableCell sx={{ fontSize: '0.78rem' }}>{f.tipo || '—'}</TableCell>
                          <TableCell sx={{ fontSize: '0.78rem' }}>{f.telefono || '—'}</TableCell>
                          <TableCell sx={{ fontSize: '0.78rem' }}>{f.dni || '—'}</TableCell>
                          <TableCell sx={{ fontSize: '0.78rem' }}>{f.email || '—'}</TableCell>
                          <TableCell sx={{ fontSize: '0.78rem' }}>{f.origen_contacto || '—'}</TableCell>
                          <TableCell sx={{ fontSize: '0.78rem' }}>{f.embudo_contacto || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>

                {importing && <LinearProgress sx={{ mb: 2, borderRadius: 4 }} />}

                <Button
                  variant="contained"
                  onClick={handleImportar}
                  disabled={importing}
                  startIcon={importing ? <CircularProgress size={14} color="inherit" /> : null}
                  sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
                >
                  {importing ? 'Importando...' : `Confirmar importación (${preview.length} registros)`}
                </Button>
              </>
            )}
          </>
        )}

        {/* Resumen de resultados */}
        {resultados.length > 0 && (
          <>
            <SectionLabel>Resumen de la importación</SectionLabel>
            <Box display="flex" gap={1.25} mb={3}>
              <CountBox
                icon={<CheckCircleIcon sx={{ fontSize: 18, color: ACCENT }} />}
                value={importados.length} label="Importados"
                color={ACCENT} bg={ACCENT_LIGHT} border="#A7F3D0"
              />
              <CountBox
                icon={<ErrorOutlineIcon sx={{ fontSize: 18, color: '#EF4444' }} />}
                value={errores.length} label="Con errores"
                color="#EF4444" bg="#FEF2F2" border="#FECACA"
              />
              <CountBox
                icon={<ContentCopyIcon sx={{ fontSize: 18, color: '#B45309' }} />}
                value={duplicados.length} label="Duplicados"
                color="#B45309" bg="#FFFBEB" border="#FDE68A"
              />
            </Box>

            {(errores.length > 0 || duplicados.length > 0) && (
              <>
                <Divider sx={{ mb: 2, borderColor: '#F3F4F6' }} />
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', mb: 1 }}>
                  Detalle de filas no importadas
                </Typography>
                <Box sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', maxHeight: 300, overflowY: 'auto' }}>
                  {[...errores, ...duplicados].sort((a, b) => a.fila - b.fila).map((r, i) => (
                    <Box key={i} sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 1, px: 1.5, py: 1.1,
                      bgcolor: r.estado === 'error' ? '#FEF2F2' : '#FFFBEB',
                      borderBottom: '1px solid #F3F4F6',
                    }}>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: r.estado === 'error' ? '#B91C1C' : '#92400E', flexShrink: 0, minWidth: 50 }}>
                        Fila {r.fila}
                      </Typography>
                      <Typography sx={{ fontSize: '0.78rem', color: '#374151' }}>{r.motivo}</Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, borderTop: '1px solid #E5E7EB', display: 'flex', gap: 1.5, flexShrink: 0 }}>
        <Button
          variant="outlined"
          onClick={handleClose}
          fullWidth
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280', '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' } }}
        >
          Cerrar
        </Button>
      </Box>
    </Drawer>
  )
}
