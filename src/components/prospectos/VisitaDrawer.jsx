import { useEffect, useState } from 'react'
import {
  Box, Typography, Drawer, Divider, IconButton, TextField, Button,
  Alert, CircularProgress, Select, MenuItem, FormControl,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import AddIcon from '@mui/icons-material/Add'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { getVisitasByProspecto, createVisita, deleteVisita } from '../../services/supabase'

const ACCENT = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}
const selectSx = {
  fontSize: '0.875rem', borderRadius: '8px',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
}

function fmtDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const FORM_EMPTY = { propiedad_id: '', fecha: '', hora: '' }

export default function VisitaDrawer({ open, onClose, prospecto, propiedades = [], onPassToNextEtapa }) {
  const [visitas, setVisitas] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState(null)

  const propDisponibles = propiedades.filter(p => p.estado === 'Disponible')

  async function load() {
    if (!prospecto) return
    setLoading(true)
    try {
      const data = await getVisitasByProspecto(prospecto.id)
      setVisitas(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && prospecto) { load(); setForm(FORM_EMPTY); setError(null) }
  }, [open, prospecto?.id])

  function set(field, val) { setForm(prev => ({ ...prev, [field]: val })) }

  async function handleAgregar(e) {
    e.preventDefault()
    if (!form.propiedad_id || !form.fecha || !form.hora) {
      setError('Seleccioná la propiedad, fecha y hora.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const v = await createVisita({ prospecto_id: prospecto.id, propiedad_id: form.propiedad_id, fecha: form.fecha, hora: form.hora })
      setVisitas(prev => [...prev, v].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora)))
      setForm(FORM_EMPTY)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    setDeletingId(id)
    try {
      await deleteVisita(id)
      setVisitas(prev => prev.filter(v => v.id !== id))
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  if (!prospecto) return null

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      slotProps={{ paper: { sx: { width: 500, bgcolor: 'white', display: 'flex', flexDirection: 'column' } } }}>

      {/* Header */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <Box sx={{ width: 28, height: 28, borderRadius: '7px', bgcolor: '#FEF9C3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarMonthIcon sx={{ fontSize: 15, color: '#D97706' }} />
              </Box>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Visitas agendadas</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.78rem', color: '#6B7280' }}>
              {prospecto.nombre} {prospecto.apellido} · {visitas.length} visita{visitas.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

        {/* Lista de visitas */}
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24} sx={{ color: ACCENT }} /></Box>
        ) : visitas.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5, bgcolor: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB', mb: 3 }}>
            <EventBusyIcon sx={{ fontSize: 28, color: '#E5E7EB', display: 'block', mx: 'auto', mb: 1 }} />
            <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>Sin visitas agendadas aún.</Typography>
          </Box>
        ) : (
          <Box mb={3}>
            {visitas.map(v => (
              <Box key={v.id} sx={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                p: 1.75, bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '10px', mb: 1.5,
              }}>
                <Box display="flex" gap={1.5}>
                  <Box sx={{ bgcolor: ACCENT_LIGHT, border: '1px solid #A7F3D0', borderRadius: '8px', px: 1.25, py: 0.75, textAlign: 'center', flexShrink: 0 }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: ACCENT }}>{fmtDate(v.fecha)}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: ACCENT }}>{v.hora?.slice(0, 5)}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{v.propiedades?.titulo ?? '—'}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{v.propiedades?.direccion}, {v.propiedades?.localidad}</Typography>
                    {v.propiedades?.precio_publicacion && (
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mt: 0.25 }}>
                        {v.propiedades?.moneda ?? ''} {Number(v.propiedades.precio_publicacion).toLocaleString('es-AR')}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <IconButton size="small" onClick={() => handleDelete(v.id)} disabled={deletingId === v.id}
                  sx={{ color: '#D1D5DB', '&:hover': { color: '#EF4444' } }}>
                  {deletingId === v.id ? <CircularProgress size={14} /> : <DeleteOutlineIcon sx={{ fontSize: 17 }} />}
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />

        {/* Nueva visita */}
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827', mb: 2 }}>Nueva visita</Typography>
        <form onSubmit={handleAgregar}>
          <Box mb={2}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Propiedad *</Typography>
            <FormControl fullWidth size="small">
              <Select value={form.propiedad_id} displayEmpty onChange={e => set('propiedad_id', e.target.value)} sx={selectSx}>
                <MenuItem value="" disabled sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>
                  {propDisponibles.length === 0 ? 'No hay propiedades disponibles' : 'Seleccionar propiedad'}
                </MenuItem>
                {propDisponibles.map(p => (
                  <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{p.titulo}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: '#6B7280' }}>
                      {p.localidad && `${p.localidad} · `}
                      {p.precio_publicacion ? `${p.moneda ?? ''} ${Number(p.precio_publicacion).toLocaleString('es-AR')}`.trim() : 'Sin precio'}
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box display="flex" gap={1.5} mb={2.5}>
            <Box flex={1}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Fecha *</Typography>
              <TextField fullWidth size="small" type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} inputProps={{ min: new Date().toISOString().split('T')[0] }} sx={fieldSx} />
            </Box>
            <Box flex={1}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Hora *</Typography>
              <TextField fullWidth size="small" type="time" value={form.hora} onChange={e => set('hora', e.target.value)} sx={fieldSx} />
            </Box>
          </Box>
          <Button type="submit" variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <AddIcon sx={{ fontSize: 16 }} />}
            sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}>
            {saving ? 'Agendando...' : 'Agendar visita'}
          </Button>
        </form>
      </Box>

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, borderTop: '1px solid #E5E7EB', display: 'flex', gap: 1.5, flexShrink: 0 }}>
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon sx={{ fontSize: 15 }} />}
          onClick={onPassToNextEtapa}
          sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
        >
          Pasar a Negociación
        </Button>
        <Button variant="outlined" onClick={onClose}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#374151', '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' } }}>
          Guardar
        </Button>
        <Button variant="text" onClick={onClose}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.82rem', color: '#9CA3AF', '&:hover': { bgcolor: '#F9FAFB' } }}>
          Cerrar
        </Button>
      </Box>
    </Drawer>
  )
}
