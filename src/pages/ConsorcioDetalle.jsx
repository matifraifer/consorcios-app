import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Drawer,
  Divider,
  TextField,
  IconButton,
  Snackbar,
  Chip,
  LinearProgress,
  InputAdornment,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DownloadIcon from '@mui/icons-material/Download'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import PersonIcon from '@mui/icons-material/Person'
import {
  getConsorcioById,
  getPropietariosConDetalle,
  createPropietario,
  importarPropietarios,
} from '../services/supabase'

const ACCENT = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'

const FORM_INICIAL = { dni: '', nombre: '', apellido: '' }

export default function ConsorcioDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [consorcio, setConsorcio] = useState(null)
  const [propietarios, setPropietarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  // Drawer nuevo propietario
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Drawer importación
  const [importOpen, setImportOpen] = useState(false)
  const [preview, setPreview] = useState([])
  const [resultados, setResultados] = useState([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)

  async function cargarDatos() {
    try {
      const [cons, props] = await Promise.all([
        getConsorcioById(id),
        getPropietariosConDetalle(id),
      ])
      setConsorcio(cons)
      setPropietarios(props)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarDatos() }, [id])

  // ── Nuevo propietario ────────────────────────────────────────────────────

  function openNuevo() {
    setForm(FORM_INICIAL)
    setFormError(null)
    setNuevoOpen(true)
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.dni.trim() || !form.nombre.trim() || !form.apellido.trim()) return
    setSaving(true)
    setFormError(null)
    try {
      await createPropietario({ ...form, id_consorcio: id })
      setSuccess(true)
      setNuevoOpen(false)
      const data = await getPropietariosConDetalle(id)
      setPropietarios(data)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Importación Excel ─────────────────────────────────────────────────────

  function openImport() {
    setPreview([])
    setResultados([])
    setImportError(null)
    setImportOpen(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function closeImport() {
    setImportOpen(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function downloadEjemplo() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Unidad', 'Propietario', 'DNI'],
      ['1A', 'García Juan', '30123456'],
      ['2B', 'López, María', '28654321'],
      ['3C', 'Martínez Carlos', '25987654'],
    ])
    ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Propietarios')
    XLSX.writeFile(wb, 'plantilla_propietarios.xlsx')
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setPreview([])
    setResultados([])
    setImportError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
        const filas = rows
          .slice(1)
          .filter(r => r.some(Boolean))
          .map(r => ({
            unidad: String(r[0] ?? '').trim(),
            propietario: String(r[1] ?? '').trim(),
            dni: String(r[2] ?? '').trim(),
          }))
          .filter(f => f.unidad || f.propietario || f.dni)
        if (filas.length === 0) {
          setImportError('El archivo no contiene filas con datos.')
          return
        }
        setPreview(filas)
      } catch {
        setImportError('No se pudo leer el archivo. Asegurate de que sea un .xlsx o .xls válido.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImportar() {
    if (preview.length === 0) return
    setImporting(true)
    setImportError(null)
    setResultados([])
    try {
      const res = await importarPropietarios(preview, id)
      setResultados(res)
      if (res.some(r => r.ok)) {
        const data = await getPropietariosConDetalle(id)
        setPropietarios(data)
      }
    } catch (err) {
      setImportError(err.message)
    } finally {
      setImporting(false)
    }
  }

  const exitosos = resultados.filter(r => r.ok).length
  const fallidos = resultados.filter(r => !r.ok).length

  // ─────────────────────────────────────────────────────────────────────────

  const filtrados = propietarios.filter(p =>
    `${p.apellido} ${p.nombre}`.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.dni?.includes(busqueda)
  )

  if (loading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress sx={{ color: ACCENT }} /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box pb={6}>
      {/* Breadcrumb / back */}
      <Box
        display="flex"
        alignItems="center"
        gap={0.5}
        mb={3}
        sx={{ cursor: 'pointer', width: 'fit-content' }}
        onClick={() => navigate('/consorcios')}
      >
        <ArrowBackIcon sx={{ fontSize: 15, color: '#9CA3AF' }} />
        <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
          Consorcios
        </Typography>
      </Box>

      {/* Header */}
      <Box display="flex" alignItems="flex-end" justifyContent="space-between" mb={4}>
        <Box>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: ACCENT, mb: 0.5 }}>
            {consorcio?.usuarios?.nombre_usuario ?? ''}
          </Typography>
          <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {consorcio?.nombre}
          </Typography>
        </Box>
        <Box display="flex" gap={1.5}>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
            onClick={openImport}
            sx={{
              borderRadius: '8px', textTransform: 'none', fontWeight: 600,
              fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#374151',
              '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: ACCENT_LIGHT },
            }}
          >
            Importar desde Excel
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openNuevo}
            sx={{
              bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
              fontWeight: 600, fontSize: '0.82rem', px: 2, py: 1,
              boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
            }}
          >
            Nuevo propietario
          </Button>
        </Box>
      </Box>

      {/* Toolbar: buscador + contador */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <TextField
          size="small"
          placeholder="Buscar por nombre o DNI..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 17, color: '#9CA3AF' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            width: 280,
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px', fontSize: '0.82rem', bgcolor: 'white',
              '& fieldset': { borderColor: '#E5E7EB' },
              '&:hover fieldset': { borderColor: ACCENT },
              '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
            },
          }}
        />
        <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
          {filtrados.length} de {propietarios.length} propietario{propietarios.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* Tabla propietarios */}
      <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                {['Propietario', 'DNI', 'Departamentos'].map(h => (
                  <TableCell
                    key={h}
                    sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}
                  >
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} sx={{ py: 8, textAlign: 'center', border: 0 }}>
                    <PersonIcon sx={{ fontSize: 32, color: '#E5E7EB', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
                      {busqueda ? 'No se encontraron propietarios.' : 'No hay propietarios registrados.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map(p => (
                  <TableRow
                    key={p.id}
                    sx={{
                      '&:last-child td': { border: 0 },
                      '& td': { borderBottom: '1px solid #F3F4F6' },
                    }}
                  >
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                        {p.apellido}, {p.nombre}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>
                        {p.dni || <span style={{ color: '#D1D5DB' }}>—</span>}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {(p.departamentos ?? []).length === 0 ? (
                          <span style={{ fontSize: '0.82rem', color: '#D1D5DB' }}>—</span>
                        ) : (
                          (p.departamentos ?? []).map((dep, i) => (
                            <Chip
                              key={i}
                              label={dep.numeracion}
                              size="small"
                              sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: ACCENT_LIGHT, color: ACCENT, border: 'none' }}
                            />
                          ))
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── Drawer Nuevo Propietario ── */}
      <Drawer
        anchor="right"
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        slotProps={{ paper: { sx: { width: 400, p: 3, bgcolor: 'white' } } }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Nuevo Propietario</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{consorcio?.nombre}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setNuevoOpen(false)}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />

        {formError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{formError}</Alert>}

        <form onSubmit={handleSubmit}>
          {[
            { label: 'DNI', name: 'dni', placeholder: 'Ej: 30123456' },
            { label: 'Nombre', name: 'nombre', placeholder: 'Ej: Juan' },
            { label: 'Apellido', name: 'apellido', placeholder: 'Ej: García' },
          ].map(({ label, name, placeholder }) => (
            <Box key={name} mb={2}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>{label}</Typography>
              <TextField
                fullWidth
                name={name}
                value={form[name]}
                onChange={handleChange}
                required
                autoFocus={name === 'dni'}
                placeholder={placeholder}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px', fontSize: '0.875rem',
                    '& fieldset': { borderColor: '#E5E7EB' },
                    '&:hover fieldset': { borderColor: ACCENT },
                    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
                  },
                }}
              />
            </Box>
          ))}
          <Box mt={3} display="flex" gap={1.5}>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
              sx={{
                bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none',
                '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
              }}
            >
              {saving ? 'Guardando...' : 'Crear propietario'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => setNuevoOpen(false)}
              sx={{
                borderRadius: '8px', textTransform: 'none', fontWeight: 500,
                fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280',
                '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' },
              }}
            >
              Cancelar
            </Button>
          </Box>
        </form>
      </Drawer>

      {/* ── Drawer Importación Excel ── */}
      <Drawer
        anchor="right"
        open={importOpen}
        onClose={closeImport}
        slotProps={{ paper: { sx: { width: 620, p: 3, bgcolor: 'white', overflowY: 'auto' } } }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Importar desde Excel</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{consorcio?.nombre}</Typography>
          </Box>
          <IconButton size="small" onClick={closeImport}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />

        {importError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{importError}</Alert>}

        {/* Paso 1 */}
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', mb: 1 }}>
          1. Descargá la plantilla y completá los datos
        </Typography>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
          onClick={downloadEjemplo}
          size="small"
          sx={{
            borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.78rem',
            borderColor: '#E5E7EB', color: '#374151', mb: 0.75,
            '&:hover': { borderColor: ACCENT, color: ACCENT },
          }}
        >
          Descargar archivo de ejemplo
        </Button>
        <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF', mb: 3 }}>
          Columnas requeridas: <strong>Unidad</strong>, <strong>Propietario</strong> (Apellido Nombre), <strong>DNI</strong>
        </Typography>

        {/* Paso 2 */}
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', mb: 1 }}>
          2. Subí el archivo completado
        </Typography>
        <Button
          variant="outlined"
          component="label"
          startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
          size="small"
          sx={{
            borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.78rem',
            borderColor: '#E5E7EB', color: '#374151', mb: 3,
            '&:hover': { borderColor: ACCENT, color: ACCENT },
          }}
        >
          Seleccionar archivo Excel
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleFileChange} />
        </Button>

        {/* Preview */}
        {preview.length > 0 && resultados.length === 0 && (
          <>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', mb: 1 }}>
              Vista previa — {preview.length} {preview.length === 1 ? 'registro' : 'registros'}
            </Typography>
            <Paper variant="outlined" sx={{ borderRadius: '10px', overflow: 'hidden', mb: 3 }}>
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                      {['Unidad', 'Propietario', 'DNI'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', bgcolor: '#F9FAFB' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.map((f, i) => (
                      <TableRow key={i} sx={{ '& td': { borderBottom: '1px solid #F3F4F6' } }}>
                        <TableCell>
                          <Chip label={f.unidad || '—'} size="small" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, bgcolor: ACCENT_LIGHT, color: ACCENT, border: 'none' }} />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{f.propietario || '—'}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{f.dni || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {importing && <LinearProgress sx={{ mb: 2, borderRadius: 4 }} />}

            <Button
              variant="contained"
              onClick={handleImportar}
              disabled={importing}
              startIcon={importing ? <CircularProgress size={14} color="inherit" /> : null}
              sx={{
                bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none',
                '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
              }}
            >
              {importing ? 'Importando...' : `Confirmar importación (${preview.length} registros)`}
            </Button>
          </>
        )}

        {/* Resultados */}
        {resultados.length > 0 && (
          <>
            <Box display="flex" gap={1.5} mb={2}>
              <Chip icon={<CheckCircleIcon />} label={`${exitosos} importados`} color="success" size="small" />
              {fallidos > 0 && <Chip icon={<ErrorIcon />} label={`${fallidos} con error`} color="error" size="small" />}
            </Box>
            <Paper variant="outlined" sx={{ borderRadius: '10px', overflow: 'hidden' }}>
              <TableContainer sx={{ maxHeight: 360 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {['Unidad', 'Propietario', 'DNI', 'Estado'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', bgcolor: '#F9FAFB' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {resultados.map((r, i) => (
                      <TableRow key={i} sx={{ '& td': { borderBottom: '1px solid #F3F4F6' } }}>
                        <TableCell><Chip label={r.unidad || '—'} size="small" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, bgcolor: ACCENT_LIGHT, color: ACCENT, border: 'none' }} /></TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{r.propietario}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{r.dni}</TableCell>
                        <TableCell align="center">
                          {r.ok
                            ? <Chip label={r.deptoCreado ? 'Importado (depto creado)' : r.vinculado ? 'Importado y vinculado' : 'Importado'} size="small" color="success" />
                            : <Chip label="Error" size="small" color="error" title={r.error} />
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
            <Button
              variant="outlined"
              onClick={closeImport}
              sx={{
                mt: 2, borderRadius: '8px', textTransform: 'none', fontWeight: 500,
                fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280',
              }}
            >
              Cerrar
            </Button>
          </>
        )}
      </Drawer>

      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={() => setSuccess(false)}
        message="Propietario creado exitosamente"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
