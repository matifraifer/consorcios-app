import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Drawer,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  IconButton,
  Snackbar,
  Chip,
  LinearProgress,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import { getPropietarios, createPropietario, getConsorcios, importarPropietarios } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

const DRAWER_WIDTH = 420
const IMPORT_DRAWER_WIDTH = 620
const FORM_INICIAL = { dni: '', nombre: '', apellido: '', id_consorcio: '' }

export default function Propietarios() {
  const { clienteId } = useAuth()
  const fileInputRef = useRef(null)

  const [propietarios, setPropietarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Drawer nuevo propietario
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [consorcios, setConsorcios] = useState([])
  const [loadingConsorcios, setLoadingConsorcios] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Drawer importación
  const [importOpen, setImportOpen] = useState(false)
  const [importConsorcio, setImportConsorcio] = useState('')
  const [loadingImportConsorcios, setLoadingImportConsorcios] = useState(false)
  const [importConsorcios, setImportConsorcios] = useState([])
  const [preview, setPreview] = useState([]) // filas parseadas del excel
  const [resultados, setResultados] = useState([]) // resultados tras importar
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)

  useEffect(() => {
    getPropietarios(clienteId)
      .then(setPropietarios)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [clienteId])

  // ── Drawer nuevo propietario ──────────────────────────────────────────────

  function openDrawer() {
    setForm(FORM_INICIAL)
    setFormError(null)
    setDrawerOpen(true)
    setLoadingConsorcios(true)
    getConsorcios(clienteId)
      .then(setConsorcios)
      .catch((err) => setFormError(err.message))
      .finally(() => setLoadingConsorcios(false))
  }

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.dni.trim() || !form.nombre.trim() || !form.apellido.trim() || !form.id_consorcio) return
    setSaving(true)
    setFormError(null)
    try {
      await createPropietario(form)
      setSuccess(true)
      setDrawerOpen(false)
      setLoading(true)
      const data = await getPropietarios(clienteId)
      setPropietarios(data)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  // ── Drawer importación ───────────────────────────────────────────────────

  function openImport() {
    setImportConsorcio('')
    setPreview([])
    setResultados([])
    setImportError(null)
    setImportOpen(true)
    setLoadingImportConsorcios(true)
    getConsorcios(clienteId)
      .then(setImportConsorcios)
      .catch((err) => setImportError(err.message))
      .finally(() => setLoadingImportConsorcios(false))
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
        // Ignorar encabezado y filas vacías
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
    if (!importConsorcio || preview.length === 0) return
    setImporting(true)
    setImportError(null)
    setResultados([])
    try {
      const res = await importarPropietarios(preview, importConsorcio)
      setResultados(res)
      // Recargar lista si al menos uno fue exitoso
      if (res.some(r => r.ok)) {
        const data = await getPropietarios(user.id)
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

  if (loading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">Propietarios</Typography>
        <Box display="flex" gap={1}>
          <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={openImport}>
            Importar desde Excel
          </Button>
          <Button variant="contained" onClick={openDrawer}>
            + Nuevo Propietario
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Propietario</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>DNI</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Complejo</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Departamento</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {propietarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No hay propietarios registrados.
                </TableCell>
              </TableRow>
            ) : (
              propietarios.map((p) => {
                const deptos = p.departamentos ?? []
                const numeraciones = deptos.map((d) => d.numeracion).join(', ')
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.apellido}, {p.nombre}</TableCell>
                    <TableCell>{p.dni}</TableCell>
                    <TableCell>{p.consorcios?.nombre ?? '-'}</TableCell>
                    <TableCell>{numeraciones || '-'}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Drawer Nuevo Propietario ── */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: DRAWER_WIDTH, p: 3 } } }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">Nuevo Propietario</Typography>
          <IconButton onClick={() => setDrawerOpen(false)}><CloseIcon /></IconButton>
        </Box>
        <Divider sx={{ mb: 3 }} />

        {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

        <form onSubmit={handleSubmit}>
          <TextField label="DNI" name="dni" fullWidth margin="normal" value={form.dni}
            onChange={handleChange} required autoFocus placeholder="Ej: 30123456" />
          <TextField label="Nombre" name="nombre" fullWidth margin="normal" value={form.nombre}
            onChange={handleChange} required />
          <TextField label="Apellido" name="apellido" fullWidth margin="normal" value={form.apellido}
            onChange={handleChange} required />
          <FormControl fullWidth margin="normal" required disabled={loadingConsorcios}>
            <InputLabel>Consorcio</InputLabel>
            <Select name="id_consorcio" value={form.id_consorcio} label="Consorcio" onChange={handleChange}>
              {consorcios.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
              ))}
            </Select>
            {loadingConsorcios && <FormHelperText>Cargando consorcios...</FormHelperText>}
          </FormControl>
          <Box mt={3} display="flex" gap={2}>
            <Button type="submit" variant="contained" disabled={saving || loadingConsorcios}
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}>
              {saving ? 'Guardando...' : 'Crear Propietario'}
            </Button>
            <Button variant="outlined" onClick={() => setDrawerOpen(false)}>Cancelar</Button>
          </Box>
        </form>
      </Drawer>

      {/* ── Drawer Importación desde Excel ── */}
      <Drawer
        anchor="right"
        open={importOpen}
        onClose={closeImport}
        slotProps={{ paper: { sx: { width: IMPORT_DRAWER_WIDTH, p: 3, overflowY: 'auto' } } }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">Importar Propietarios desde Excel</Typography>
          <IconButton onClick={closeImport}><CloseIcon /></IconButton>
        </Box>
        <Divider sx={{ mb: 3 }} />

        {importError && <Alert severity="error" sx={{ mb: 2 }}>{importError}</Alert>}

        {/* Paso 1: Consorcio */}
        <Typography variant="subtitle2" fontWeight="bold" mb={1}>1. Seleccioná el consorcio</Typography>
        <FormControl fullWidth disabled={loadingImportConsorcios} sx={{ mb: 3 }}>
          <InputLabel>Consorcio</InputLabel>
          <Select
            value={importConsorcio}
            label="Consorcio"
            onChange={(e) => { setImportConsorcio(e.target.value); setPreview([]); setResultados([]) }}
          >
            {importConsorcios.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
            ))}
          </Select>
          {loadingImportConsorcios && <FormHelperText>Cargando consorcios...</FormHelperText>}
        </FormControl>

        {/* Paso 2: Descargar plantilla + subir archivo */}
        <Typography variant="subtitle2" fontWeight="bold" mb={1}>2. Descargá la plantilla y completá los datos</Typography>
        <Box display="flex" alignItems="center" gap={2} mb={1}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={downloadEjemplo}
            size="small"
          >
            Descargar archivo de ejemplo
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" mb={3}>
          Columnas requeridas: <strong>Unidad</strong>, <strong>Propietario</strong> (Apellido Nombre), <strong>DNI</strong>
        </Typography>

        {/* Paso 3: Subir archivo */}
        <Typography variant="subtitle2" fontWeight="bold" mb={1}>3. Subí el archivo completado</Typography>
        <Button
          variant="outlined"
          component="label"
          startIcon={<UploadFileIcon />}
          disabled={!importConsorcio}
          size="small"
          sx={{ mb: 3 }}
        >
          Seleccionar archivo Excel
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={handleFileChange}
          />
        </Button>

        {/* Preview de filas */}
        {preview.length > 0 && resultados.length === 0 && (
          <>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="subtitle2" fontWeight="bold">
                Vista previa — {preview.length} {preview.length === 1 ? 'registro' : 'registros'}
              </Typography>
            </Box>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, maxHeight: 320 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Unidad</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Propietario</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>DNI</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell><Chip label={f.unidad || '-'} size="small" variant="outlined" /></TableCell>
                      <TableCell>{f.propietario || '-'}</TableCell>
                      <TableCell>{f.dni || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {importing && <LinearProgress sx={{ mb: 2 }} />}

            <Button
              variant="contained"
              onClick={handleImportar}
              disabled={importing}
              startIcon={importing ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {importing ? 'Importando...' : `Confirmar importación (${preview.length} registros)`}
            </Button>
          </>
        )}

        {/* Resultados */}
        {resultados.length > 0 && (
          <>
            <Box display="flex" gap={2} mb={2}>
              <Chip icon={<CheckCircleIcon />} label={`${exitosos} importados`} color="success" />
              {fallidos > 0 && <Chip icon={<ErrorIcon />} label={`${fallidos} con error`} color="error" />}
            </Box>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Unidad</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Propietario</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>DNI</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="center">Estado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {resultados.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><Chip label={r.unidad || '-'} size="small" variant="outlined" /></TableCell>
                      <TableCell>{r.propietario}</TableCell>
                      <TableCell>{r.dni}</TableCell>
                      <TableCell align="center">
                        {r.ok
                          ? <Chip
                              label={r.deptoCreado ? 'Importado (depto creado)' : r.vinculado ? 'Importado y vinculado' : 'Importado'}
                              size="small"
                              color="success"
                            />
                          : <Chip label="Error" size="small" color="error" title={r.error} />
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Button variant="outlined" sx={{ mt: 2 }} onClick={closeImport}>Cerrar</Button>
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
