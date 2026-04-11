import { useEffect, useState } from 'react'
import {
  Box, Typography, Drawer, Divider, IconButton, TextField, Button,
  Alert, CircularProgress, Select, MenuItem, FormControl, Grid,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import GroupIcon from '@mui/icons-material/Group'
import { createProspecto } from '../../services/supabase'

const ACCENT = '#065F46'

const LOCALIDADES = [
  'Albardón','Angaco','Calingasta','Capital','Caucete','Chimbas','Iglesia','Jáchal',
  'Nueve de Julio','Pocito','Rawson','Rivadavia','San Martín','Santa Lucía','Sarmiento',
  'Ullum','Valle Fértil','Veinticinco de Mayo','Zonda',
]
const TIPOS_INMUEBLE = ['Casa','Departamento','Terreno','Local','Oficina','Indiferente']

const FORM_VENTA = {
  nombre: '', apellido: '', telefono: '', email: '',
  presupuesto: '', zona: '', tipo_inmueble: '', credito_hipotecario: '',
  propiedad_id: '',
}
const FORM_ALQUILER = { nombre: '', apellido: '', telefono: '', email: '' }

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

function Label({ children }) {
  return <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>{children}</Typography>
}

export default function ProspectoFormDrawer({ open, onClose, defaultEtapaId, propiedades = [], onSaved }) {
  const [tipoOp, setTipoOp] = useState('venta')
  const [form, setForm] = useState(FORM_VENTA)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setTipoOp('venta')
    setForm(FORM_VENTA)
    setError(null)
  }, [open])

  function handleTipoChange(val) {
    setTipoOp(val)
    setForm(val === 'alquiler' ? FORM_ALQUILER : FORM_VENTA)
    setError(null)
  }

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function validate() {
    if (!form.nombre.trim()) return 'El nombre es obligatorio.'
    if (!form.apellido.trim()) return 'El apellido es obligatorio.'
    if (!form.telefono.trim()) return 'El teléfono es obligatorio.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim() || null,
        tipo_operacion: tipoOp,
        etapa_id: defaultEtapaId,
        ...(tipoOp === 'venta' && {
          presupuesto: form.presupuesto ? Number(form.presupuesto) : null,
          zona: form.zona || null,
          tipo_inmueble: form.tipo_inmueble || null,
          credito_hipotecario: form.credito_hipotecario === 'si' ? true : form.credito_hipotecario === 'no' ? false : null,
          propiedad_id: form.propiedad_id || null,
        }),
      }
      const result = await createProspecto(payload)
      onSaved(result)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const propDisponibles = propiedades.filter(p => p.estado !== 'Baja')

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 480, bgcolor: 'white', display: 'flex', flexDirection: 'column' } } }}
    >
      {/* Header */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center" gap={1.25}>
          <Box sx={{ width: 28, height: 28, borderRadius: '7px', bgcolor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GroupIcon sx={{ fontSize: 15, color: ACCENT }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>Nuevo prospecto</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF' }}>Registrá el contacto entrante</Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 3 }}>
        {error && <Alert severity="error" sx={{ mt: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

        <form id="prospecto-form" onSubmit={handleSubmit}>

          {/* Tipo de operación */}
          <Box mt={3} mb={3}>
            <Label>Tipo de operación *</Label>
            <Box display="flex" gap={1}>
              {['venta', 'alquiler'].map(op => (
                <Box
                  key={op}
                  onClick={() => handleTipoChange(op)}
                  sx={{
                    flex: 1, py: 1.25, textAlign: 'center', borderRadius: '8px', cursor: 'pointer',
                    border: `1px solid ${tipoOp === op ? ACCENT : '#E5E7EB'}`,
                    bgcolor: tipoOp === op ? '#ECFDF5' : 'white',
                    transition: 'all 0.15s',
                  }}
                >
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: tipoOp === op ? ACCENT : '#6B7280', textTransform: 'capitalize' }}>
                    {op === 'venta' ? 'Venta / Compra' : 'Alquiler'}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Datos de contacto */}
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9CA3AF', mb: 2 }}>
            Datos de contacto
          </Typography>

          <Grid container spacing={1.5} mb={2}>
            <Grid item xs={6}>
              <Label>Nombre *</Label>
              <TextField fullWidth size="small" value={form.nombre} onChange={e => set('nombre', e.target.value)} sx={fieldSx} />
            </Grid>
            <Grid item xs={6}>
              <Label>Apellido *</Label>
              <TextField fullWidth size="small" value={form.apellido} onChange={e => set('apellido', e.target.value)} sx={fieldSx} />
            </Grid>
          </Grid>

          <Grid container spacing={1.5} mb={3}>
            <Grid item xs={6}>
              <Label>Teléfono *</Label>
              <TextField fullWidth size="small" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="Ej: 2645123456" sx={fieldSx} />
            </Grid>
            <Grid item xs={6}>
              <Label>Email</Label>
              <TextField fullWidth size="small" type="email" value={form.email} onChange={e => set('email', e.target.value)} sx={fieldSx} />
            </Grid>
          </Grid>

          {/* Campos adicionales para venta */}
          {tipoOp === 'venta' && (
            <>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9CA3AF', mb: 2 }}>
                Preferencias de búsqueda
              </Typography>

              <Grid container spacing={1.5} mb={2}>
                <Grid item xs={6}>
                  <Label>Presupuesto</Label>
                  <TextField fullWidth size="small" type="number" value={form.presupuesto} onChange={e => set('presupuesto', e.target.value)} placeholder="USD" sx={fieldSx} />
                </Grid>
                <Grid item xs={6}>
                  <Label>Zona de interés</Label>
                  <FormControl fullWidth size="small">
                    <Select value={form.zona} displayEmpty onChange={e => set('zona', e.target.value)} sx={selectSx}>
                      <MenuItem value="" sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Seleccionar</MenuItem>
                      {LOCALIDADES.map(l => <MenuItem key={l} value={l} sx={{ fontSize: '0.875rem' }}>{l}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Grid container spacing={1.5} mb={3}>
                <Grid item xs={6}>
                  <Label>Tipo de inmueble</Label>
                  <FormControl fullWidth size="small">
                    <Select value={form.tipo_inmueble} displayEmpty onChange={e => set('tipo_inmueble', e.target.value)} sx={selectSx}>
                      <MenuItem value="" sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Seleccionar</MenuItem>
                      {TIPOS_INMUEBLE.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '0.875rem' }}>{t}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <Label>Crédito hipotecario</Label>
                  <FormControl fullWidth size="small">
                    <Select value={form.credito_hipotecario} displayEmpty onChange={e => set('credito_hipotecario', e.target.value)} sx={selectSx}>
                      <MenuItem value="" sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Seleccionar</MenuItem>
                      <MenuItem value="si" sx={{ fontSize: '0.875rem' }}>Sí</MenuItem>
                      <MenuItem value="no" sx={{ fontSize: '0.875rem' }}>No</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9CA3AF', mb: 2 }}>
                Propiedad específica (opcional)
              </Typography>
              <Box mb={2}>
                <Label>¿Sabe qué propiedad quiere?</Label>
                <FormControl fullWidth size="small">
                  <Select value={form.propiedad_id} displayEmpty onChange={e => set('propiedad_id', e.target.value)} sx={selectSx}>
                    <MenuItem value="" sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>No sabe / Sin definir</MenuItem>
                    {propDisponibles.map(p => (
                      <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.875rem' }}>
                        {p.titulo} — {p.moneda} {Number(p.precio_publicacion).toLocaleString('es-AR')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF', mt: 0.5 }}>
                  Si seleccionás una propiedad, se vincula al prospecto automáticamente.
                </Typography>
              </Box>
            </>
          )}
        </form>
      </Box>

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, borderTop: '1px solid #E5E7EB', display: 'flex', gap: 1.5, flexShrink: 0 }}>
        <Button
          type="submit" form="prospecto-form" variant="contained" disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
        >
          {saving ? 'Guardando...' : 'Crear prospecto'}
        </Button>
        <Button variant="outlined" onClick={onClose}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280', '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' } }}>
          Cancelar
        </Button>
      </Box>
    </Drawer>
  )
}
