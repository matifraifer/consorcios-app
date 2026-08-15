import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  IconButton,
  TextField,
  Snackbar,
  InputAdornment,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import ConstructionIcon from '@mui/icons-material/Construction'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import SearchIcon from '@mui/icons-material/Search'
import { getProyectos, createProyecto } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

const ACCENT = '#065F46'

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}

const FORM_INICIAL = { nombre: '', costo_presupuestado: '', fecha_inicio: '', fecha_fin_prevista: '' }

function fmtMonto(value) {
  if (value === null || value === undefined) return '—'
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtFecha(fecha) {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

function ProyectoAvatar() {
  return (
    <Box
      sx={{
        width: 32,
        height: 32,
        borderRadius: '8px',
        bgcolor: '#ECFDF5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <ConstructionIcon sx={{ fontSize: 16, color: ACCENT }} />
    </Box>
  )
}

export default function Proyectos() {
  const { clienteId } = useAuth()
  const navigate = useNavigate()

  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  // Drawer nuevo
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    getProyectos(clienteId)
      .then(setProyectos)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [clienteId])

  function openNuevo() {
    setForm(FORM_INICIAL)
    setFormError(null)
    setNuevoOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setSaving(true)
    setFormError(null)
    try {
      await createProyecto({
        nombre: form.nombre.trim(),
        cliente_id: clienteId,
        costo_presupuestado: form.costo_presupuestado ? Number(form.costo_presupuestado) : null,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin_prevista: form.fecha_fin_prevista || null,
      })
      setSuccess(true)
      setNuevoOpen(false)
      setLoading(true)
      const data = await getProyectos(clienteId)
      setProyectos(data)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  const filtrados = proyectos.filter(p =>
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  )

  if (loading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress sx={{ color: ACCENT }} /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box pb={6}>
      {/* Header */}
      <Box display="flex" alignItems="flex-end" justifyContent="space-between" mb={4}>
        <Box>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: ACCENT, mb: 0.5 }}>
            Gestión de proyectos
          </Typography>
          <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Proyectos
          </Typography>
        </Box>
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
          Nuevo proyecto
        </Button>
      </Box>

      {/* Toolbar: buscador + contador */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <TextField
          size="small"
          placeholder="Buscar proyecto..."
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
            width: 260,
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px', fontSize: '0.82rem', bgcolor: 'white',
              '& fieldset': { borderColor: '#E5E7EB' },
              '&:hover fieldset': { borderColor: ACCENT },
              '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
            },
          }}
        />
        <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
          {filtrados.length} de {proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* Tabla */}
      <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                  Nombre
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                  Costo presupuestado
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                  Costo real
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                  Fin. prevista
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                  Fin. real
                </TableCell>
                <TableCell sx={{ borderBottom: '1px solid #E5E7EB' }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 8, textAlign: 'center', border: 0 }}>
                    <ConstructionIcon sx={{ fontSize: 32, color: '#E5E7EB', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
                      {busqueda ? 'No se encontraron proyectos.' : 'No hay proyectos registrados.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map(p => (
                  <TableRow
                    key={p.id}
                    onClick={() => navigate(`/proyectos/${p.id}`)}
                    sx={{
                      cursor: 'pointer',
                      '&:last-child td': { border: 0 },
                      '& td': { borderBottom: '1px solid #F3F4F6' },
                      '&:hover': {
                        bgcolor: '#F9FAFB',
                        '& .row-arrow': { opacity: 1 },
                      },
                    }}
                  >
                    <TableCell sx={{ py: 1.5 }}>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <ProyectoAvatar />
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                          {p.nombre}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>
                        {fmtMonto(p.costo_presupuestado)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>
                        {fmtMonto(p.costo_real)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>
                        {fmtFecha(p.fecha_fin_prevista)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>
                        {fmtFecha(p.fecha_fin_real)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5, pr: 2.5 }}>
                      <ArrowForwardIosIcon
                        className="row-arrow"
                        sx={{ fontSize: 12, color: ACCENT, opacity: 0, transition: 'opacity 0.15s' }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Drawer Nuevo Proyecto */}
      <Drawer
        anchor="right"
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        slotProps={{ paper: { sx: { width: 400, p: 3, bgcolor: 'white' } } }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Nuevo Proyecto</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>Completa los datos iniciales del proyecto</Typography>
          </Box>
          <IconButton size="small" onClick={() => setNuevoOpen(false)}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />

        {formError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{formError}</Alert>}

        <form onSubmit={handleSubmit}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>
            Nombre del proyecto
          </Typography>
          <TextField
            fullWidth
            value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            required
            autoFocus
            placeholder="Ej: Edificio Torre Norte"
            size="small"
            sx={{ ...fieldSx, mb: 2.5 }}
          />

          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>
            Costo presupuestado
          </Typography>
          <TextField
            fullWidth
            type="number"
            value={form.costo_presupuestado}
            onChange={e => setForm(f => ({ ...f, costo_presupuestado: e.target.value }))}
            placeholder="0.00"
            size="small"
            slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
            sx={{ ...fieldSx, mb: 2.5 }}
          />

          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>
            Fecha de inicio
          </Typography>
          <TextField
            fullWidth
            type="date"
            value={form.fecha_inicio}
            onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
            size="small"
            sx={{ ...fieldSx, mb: 2.5 }}
          />

          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>
            Fecha de finalización prevista
          </Typography>
          <TextField
            fullWidth
            type="date"
            value={form.fecha_fin_prevista}
            onChange={e => setForm(f => ({ ...f, fecha_fin_prevista: e.target.value }))}
            size="small"
            sx={fieldSx}
          />

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
              {saving ? 'Guardando...' : 'Crear proyecto'}
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

      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={() => setSuccess(false)}
        message="Proyecto creado exitosamente"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
