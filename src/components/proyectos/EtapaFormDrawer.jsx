import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Button,
  Drawer,
  Divider,
  TextField,
  IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { createEtapa, updateEtapa } from '../../services/supabase'

const ACCENT = '#065F46'

const labelSx = { fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }
const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}

const COLORES_PRESET = [
  '#065F46', '#1D4ED8', '#6D28D9', '#C2410C',
  '#B45309', '#9D174D', '#0891B2', '#475569',
]

function ColorPicker({ value, onChange }) {
  const inputRef = useRef(null)
  const safeHex = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : ACCENT

  function handleHexInput(e) {
    let v = e.target.value
    if (v && !v.startsWith('#')) v = '#' + v
    onChange(v)
  }

  return (
    <Box>
      <Typography sx={labelSx}>Color</Typography>
      <Box display="flex" alignItems="center" gap={1.25} mb={1.25}>
        <Box
          onClick={() => inputRef.current?.click()}
          sx={{
            width: 36, height: 36, borderRadius: '8px', flexShrink: 0,
            bgcolor: safeHex, border: '1px solid #E5E7EB', cursor: 'pointer',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
            transition: 'transform 0.1s', '&:hover': { transform: 'scale(1.08)' },
          }}
        />
        <Box
          component="input"
          ref={inputRef}
          type="color"
          value={safeHex}
          onChange={e => onChange(e.target.value)}
          sx={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        />
        <TextField
          size="small"
          value={value}
          onChange={handleHexInput}
          placeholder="#065F46"
          inputProps={{ maxLength: 7, style: { fontFamily: 'monospace', fontSize: '0.82rem' } }}
          sx={{ ...fieldSx, width: 120 }}
        />
      </Box>
      <Box display="flex" gap={1}>
        {COLORES_PRESET.map(c => (
          <Box
            key={c}
            onClick={() => onChange(c)}
            sx={{
              width: 22, height: 22, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
              border: c.toLowerCase() === safeHex.toLowerCase() ? `2px solid ${c}` : '2px solid transparent',
              outline: c.toLowerCase() === safeHex.toLowerCase() ? `1px solid ${c}` : 'none',
              outlineOffset: 2,
              transition: 'transform 0.1s', '&:hover': { transform: 'scale(1.15)' },
            }}
          />
        ))}
      </Box>
    </Box>
  )
}

// proyectoId: requerido para crear una etapa nueva
// etapa: etapa existente para editar (solo nombre/color), o null para alta
export default function EtapaFormDrawer({ open, proyectoId, etapa, onClose, onSaved }) {
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(ACCENT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (etapa) {
      setNombre(etapa.nombre)
      setColor(etapa.color || ACCENT)
    } else {
      setNombre('')
      setColor(ACCENT)
    }
  }, [open, etapa])

  async function handleSubmit() {
    if (!nombre.trim()) return
    setSaving(true)
    setError(null)
    try {
      const savedEtapa = etapa
        ? await updateEtapa(etapa.id, { nombre: nombre.trim(), color })
        : await createEtapa({ proyecto_id: proyectoId, nombre: nombre.trim(), color })
      onSaved(etapa ? { ...etapa, ...savedEtapa } : { ...savedEtapa, tareas_etapa: [] })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 400, p: 3, bgcolor: 'white' } } }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
            {etapa ? 'Editar etapa' : 'Nueva etapa'}
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
            Nombre y color de la etapa
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

      <Box mb={2.5}>
        <Typography sx={labelSx}>Nombre de la etapa</Typography>
        <TextField
          fullWidth
          size="small"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          required
          autoFocus
          placeholder="Ej: Fundaciones"
          sx={fieldSx}
        />
      </Box>

      <ColorPicker value={color} onChange={setColor} />

      <Box mt={3} display="flex" gap={1.5}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || !nombre.trim()}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{
            bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
            fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none',
            '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
          }}
        >
          {saving ? 'Guardando...' : etapa ? 'Guardar cambios' : 'Crear etapa'}
        </Button>
        <Button
          variant="outlined"
          onClick={onClose}
          sx={{
            borderRadius: '8px', textTransform: 'none', fontWeight: 500,
            fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280',
            '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' },
          }}
        >
          Cancelar
        </Button>
      </Box>
    </Drawer>
  )
}
