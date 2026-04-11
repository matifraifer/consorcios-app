import { useEffect, useMemo, useState } from 'react'
import {
  Box, Typography, Drawer, Divider, IconButton, TextField, Button,
  Alert, CircularProgress, Select, MenuItem, FormControl, InputAdornment,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import SaveIcon from '@mui/icons-material/Save'
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckIcon from '@mui/icons-material/Check'
import {
  getPropiedadesInteresByProspecto,
  addPropiedadInteres,
  updatePropiedadInteres,
  deletePropiedadInteres,
} from '../../services/supabase'

const ACCENT = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'

const FORMAS_PAGO = ['Contado', 'Crédito hipotecario', 'Otro']

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.82rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}
const selectSx = {
  fontSize: '0.82rem', borderRadius: '8px',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
}

function fmt(val, moneda) {
  if (!val) return '—'
  return `${moneda ?? ''} ${Number(val).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`.trim()
}

export default function NegociacionDrawer({ open, onClose, prospecto, propiedades = [], onPassToNextEtapa }) {
  const [interes, setInteres] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [addingId, setAddingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState(null)
  // Per-row edit state: { [interes_id]: { monto_propuesto, forma_pago, dirty, saving } }
  const [editRows, setEditRows] = useState({})

  async function load() {
    if (!prospecto) return
    setLoading(true)
    try {
      const data = await getPropiedadesInteresByProspecto(prospecto.id)
      setInteres(data)
      const initial = {}
      for (const row of data) {
        initial[row.id] = { monto_propuesto: row.monto_propuesto ?? '', forma_pago: row.forma_pago ?? '', dirty: false, saving: false }
      }
      setEditRows(initial)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && prospecto) { load(); setSearch(''); setError(null) }
  }, [open, prospecto?.id])

  const interesIds = useMemo(() => new Set(interes.map(i => i.propiedad_id)), [interes])

  const propsFiltradas = useMemo(() => {
    const q = search.toLowerCase()
    return propiedades
      .filter(p =>
        p.estado !== 'Baja' &&
        (q === '' || p.titulo?.toLowerCase().includes(q) || p.localidad?.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const aInterest = interesIds.has(a.id) ? 0 : 1
        const bInterest = interesIds.has(b.id) ? 0 : 1
        return aInterest - bInterest
      })
  }, [propiedades, interesIds, search])

  async function handleAgregar(propiedad_id) {
    setAddingId(propiedad_id)
    setError(null)
    try {
      const row = await addPropiedadInteres({ prospecto_id: prospecto.id, propiedad_id })
      setInteres(prev => [...prev, row])
      setEditRows(prev => ({ ...prev, [row.id]: { monto_propuesto: '', forma_pago: '', dirty: false, saving: false } }))
    } catch (err) {
      setError(err.message)
    } finally {
      setAddingId(null)
    }
  }

  async function handleEliminar(id) {
    setDeletingId(id)
    try {
      await deletePropiedadInteres(id)
      setInteres(prev => prev.filter(r => r.id !== id))
      setEditRows(prev => { const n = { ...prev }; delete n[id]; return n })
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  function setRowField(id, field, val) {
    setEditRows(prev => ({ ...prev, [id]: { ...prev[id], [field]: val, dirty: true } }))
  }

  async function handleSaveRow(id) {
    setEditRows(prev => ({ ...prev, [id]: { ...prev[id], saving: true } }))
    try {
      const { monto_propuesto, forma_pago } = editRows[id]
      const updated = await updatePropiedadInteres(id, { monto_propuesto, forma_pago })
      setInteres(prev => prev.map(r => r.id === id ? updated : r))
      setEditRows(prev => ({ ...prev, [id]: { ...prev[id], dirty: false, saving: false } }))
    } catch (err) {
      setError(err.message)
      setEditRows(prev => ({ ...prev, [id]: { ...prev[id], saving: false } }))
    }
  }

  if (!prospecto) return null

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      slotProps={{ paper: { sx: { width: 580, bgcolor: 'white', display: 'flex', flexDirection: 'column' } } }}>

      {/* Header */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center" gap={1.25}>
          <Box sx={{ width: 28, height: 28, borderRadius: '7px', bgcolor: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MonetizationOnIcon sx={{ fontSize: 15, color: '#7C3AED' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Negociación</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>{prospecto.nombre} {prospecto.apellido}</Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

        {/* Buscar y agregar propiedades */}
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827', mb: 1.5 }}>
          Buscar propiedades
        </Typography>
        <TextField
          fullWidth size="small" placeholder="Filtrar por título o localidad..."
          value={search} onChange={e => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: '#9CA3AF' }} /></InputAdornment> } }}
          sx={{ mb: 2, ...fieldSx }}
        />

        <Box sx={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: '10px', mb: 3 }}>
          {propsFiltradas.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
                {search ? 'Sin resultados.' : 'Todas las propiedades ya fueron agregadas o no hay disponibles.'}
              </Typography>
            </Box>
          ) : (
            propsFiltradas.map((p, i) => {
              const yaAgregada = interesIds.has(p.id)
              return (
                <Box key={p.id} sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  px: 2, py: 1.25,
                  bgcolor: yaAgregada ? ACCENT_LIGHT : 'transparent',
                  borderBottom: i < propsFiltradas.length - 1 ? `1px solid ${yaAgregada ? '#A7F3D0' : '#F3F4F6'}` : 'none',
                }}>
                  <Box>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827' }}>{p.titulo}</Typography>
                      {yaAgregada && (
                        <Box sx={{ bgcolor: '#A7F3D0', borderRadius: '4px', px: 0.75, py: 0.125 }}>
                          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: ACCENT }}>Con interés</Typography>
                        </Box>
                      )}
                    </Box>
                    <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
                      {p.localidad} · {fmt(p.precio_publicacion, p.moneda)}
                    </Typography>
                  </Box>
                  {yaAgregada ? (
                    <CheckIcon sx={{ fontSize: 16, color: ACCENT, flexShrink: 0 }} />
                  ) : (
                    <Button size="small" onClick={() => handleAgregar(p.id)} disabled={addingId === p.id}
                      startIcon={addingId === p.id ? <CircularProgress size={12} /> : <AddIcon sx={{ fontSize: 14 }} />}
                      sx={{ fontSize: '0.75rem', textTransform: 'none', color: ACCENT, fontWeight: 600, borderRadius: '7px', px: 1.25, '&:hover': { bgcolor: ACCENT_LIGHT } }}>
                      Agregar
                    </Button>
                  )}
                </Box>
              )
            })
          )}
        </Box>

        <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />

        {/* Propiedades de interés */}
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827', mb: 1.5 }}>
          Propiedades de interés ({interes.length})
        </Typography>

        {loading ? (
          <Box display="flex" justifyContent="center" py={3}><CircularProgress size={24} sx={{ color: ACCENT }} /></Box>
        ) : interes.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center', bgcolor: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
            <Typography sx={{ fontSize: '0.8rem', color: '#9CA3AF' }}>Agregá propiedades desde el buscador de arriba.</Typography>
          </Box>
        ) : (
          interes.map(row => {
            const edit = editRows[row.id] ?? { monto_propuesto: '', forma_pago: '', dirty: false, saving: false }
            return (
              <Box key={row.id} sx={{ bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '10px', p: 2, mb: 1.5 }}>
                {/* Nombre y precio original */}
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                  <Box>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{row.propiedades?.titulo}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
                      Precio publicación: {fmt(row.propiedades?.precio_publicacion, row.propiedades?.moneda)}
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => handleEliminar(row.id)} disabled={deletingId === row.id}
                    sx={{ color: '#D1D5DB', '&:hover': { color: '#EF4444' } }}>
                    {deletingId === row.id ? <CircularProgress size={14} /> : <DeleteOutlineIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                </Box>

                {/* Edición inline */}
                <Box display="flex" gap={1.5} alignItems="flex-end">
                  <Box flex={1}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Monto propuesto</Typography>
                    <TextField
                      fullWidth size="small" type="number" placeholder="Ej: 80000"
                      value={edit.monto_propuesto}
                      onChange={e => setRowField(row.id, 'monto_propuesto', e.target.value)}
                      sx={fieldSx}
                    />
                  </Box>
                  <Box flex={1}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Forma de pago</Typography>
                    <FormControl fullWidth size="small">
                      <Select value={edit.forma_pago} displayEmpty onChange={e => setRowField(row.id, 'forma_pago', e.target.value)} sx={selectSx}>
                        <MenuItem value="" sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>Sin definir</MenuItem>
                        {FORMAS_PAGO.map(f => <MenuItem key={f} value={f} sx={{ fontSize: '0.82rem' }}>{f}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Box>
                  {edit.dirty && (
                    <Button size="small" onClick={() => handleSaveRow(row.id)} disabled={edit.saving}
                      startIcon={edit.saving ? <CircularProgress size={12} color="inherit" /> : <SaveIcon sx={{ fontSize: 14 }} />}
                      sx={{ bgcolor: ACCENT, color: 'white', borderRadius: '7px', textTransform: 'none', fontSize: '0.75rem', fontWeight: 600, px: 1.5, flexShrink: 0, boxShadow: 'none', minWidth: 80, '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}>
                      {edit.saving ? '...' : 'Guardar'}
                    </Button>
                  )}
                </Box>
              </Box>
            )
          })
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, borderTop: '1px solid #E5E7EB', display: 'flex', gap: 1.5, flexShrink: 0 }}>
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon sx={{ fontSize: 15 }} />}
          onClick={onPassToNextEtapa}
          sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
        >
          Pasar a Cierre
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
