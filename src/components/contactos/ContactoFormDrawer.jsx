import { useEffect, useState } from 'react'
import {
  Box, Typography, Drawer, IconButton, TextField, Button,
  Alert, CircularProgress, Select, MenuItem, FormControl,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import PermContactCalendarIcon from '@mui/icons-material/PermContactCalendar'
import { createContacto, updateContacto } from '../../services/supabase'

const ACCENT = '#065F46'

const TIPOS = ['Propietario', 'Inquilino', 'Vendedor', 'Comprador']

const FORM_EMPTY = {
  tipo: '',
  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  email: '',
  notas: '',
}

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

function Label({ children, required }) {
  return (
    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>
      {children}{required && <Box component="span" sx={{ color: '#EF4444', ml: 0.3 }}>*</Box>}
    </Typography>
  )
}

function SectionTitle({ children }) {
  return (
    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: ACCENT, mt: 3, mb: 1.5 }}>
      {children}
    </Typography>
  )
}

export default function ContactoFormDrawer({ open, onClose, contacto, clienteId, onSaved }) {
  const isEdit = !!contacto
  const [form, setForm] = useState(FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (isEdit && contacto) {
      setForm({
        tipo:     contacto.tipo     ?? '',
        nombre:   contacto.nombre   ?? '',
        apellido: contacto.apellido ?? '',
        dni:      contacto.dni      ?? '',
        telefono: contacto.telefono ?? '',
        email:    contacto.email    ?? '',
        notas:    contacto.notas    ?? '',
      })
    } else {
      setForm(FORM_EMPTY)
    }
  }, [open])

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function validate() {
    if (!form.tipo) return 'El tipo es obligatorio.'
    if (!form.nombre.trim()) return 'El nombre es obligatorio.'
    if (!form.apellido.trim()) return 'El apellido es obligatorio.'
    return null
  }

  async function handleSubmit() {
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        tipo:     form.tipo,
        nombre:   form.nombre.trim(),
        apellido: form.apellido.trim(),
        dni:      form.dni.trim() || null,
        telefono: form.telefono.trim() || null,
        email:    form.email.trim() || null,
        notas:    form.notas.trim() || null,
        cliente_id: clienteId,
      }
      let result
      if (isEdit) {
        result = await updateContacto(contacto.id, payload)
      } else {
        result = await createContacto(payload)
      }
      onSaved(result)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 480, bgcolor: 'white', display: 'flex', flexDirection: 'column' } } }}
    >
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center" gap={1.25}>
          <Box sx={{ width: 28, height: 28, borderRadius: '7px', bgcolor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PermContactCalendarIcon sx={{ fontSize: 15, color: ACCENT }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
              {isEdit ? 'Editar contacto' : 'Nuevo contacto'}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF' }}>Gestión comercial</Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 3 }}>
        {error && <Alert severity="error" sx={{ mt: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

        <SectionTitle>Datos del contacto</SectionTitle>

        <Box mb={2}>
          <Label required>Tipo</Label>
          <FormControl fullWidth size="small">
            <Select value={form.tipo} displayEmpty onChange={e => set('tipo', e.target.value)} sx={selectSx}>
              <MenuItem value="" sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Seleccionar</MenuItem>
              {TIPOS.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '0.875rem' }}>{t}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5} mb={2}>
          <Box>
            <Label required>Nombre</Label>
            <TextField fullWidth size="small" value={form.nombre} onChange={e => set('nombre', e.target.value)} sx={fieldSx} />
          </Box>
          <Box>
            <Label required>Apellido</Label>
            <TextField fullWidth size="small" value={form.apellido} onChange={e => set('apellido', e.target.value)} sx={fieldSx} />
          </Box>
        </Box>

        <Box mb={2}>
          <Label>DNI</Label>
          <TextField fullWidth size="small" value={form.dni} onChange={e => set('dni', e.target.value)} placeholder="Opcional" sx={fieldSx} />
        </Box>

        <SectionTitle>Datos de contacto</SectionTitle>

        <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5} mb={2}>
          <Box>
            <Label>Teléfono</Label>
            <TextField fullWidth size="small" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="Opcional" sx={fieldSx} />
          </Box>
          <Box>
            <Label>Email</Label>
            <TextField fullWidth size="small" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="Opcional" sx={fieldSx} />
          </Box>
        </Box>

        <Box mb={2}>
          <Label>Notas</Label>
          <TextField fullWidth multiline rows={2} size="small" value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Opcional" sx={fieldSx} />
        </Box>
      </Box>

      <Box sx={{ px: 3, py: 2, borderTop: '1px solid #E5E7EB', display: 'flex', gap: 1.5, flexShrink: 0 }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
        >
          {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear contacto'}
        </Button>
        <Button
          variant="outlined"
          onClick={onClose}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280', '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' } }}
        >
          Cancelar
        </Button>
      </Box>
    </Drawer>
  )
}
