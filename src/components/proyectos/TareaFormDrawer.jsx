import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Button,
  Select,
  MenuItem,
  FormControl,
  Drawer,
  Divider,
  TextField,
  IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { createTarea, updateTarea } from '../../services/supabase'

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
const selectSx = {
  fontSize: '0.875rem', borderRadius: '8px',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
}

const ESTADOS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_curso', label: 'En curso' },
  { value: 'bloqueado', label: 'Bloqueado' },
  { value: 'finalizado', label: 'Finalizado' },
]

const TAREA_VACIA = {
  nombre: '', descripcion: '', responsable: '', estado: 'pendiente',
  costo_presupuestado: '', costo_real: '', fecha_inicio: '', fecha_fin: '', fecha_fin_real: '',
}

// etapa: etapa a la que pertenece la tarea (id + nombre + color)
// tarea: tarea existente para editar, o null para alta
export default function TareaFormDrawer({ open, etapa, tarea, onClose, onSaved }) {
  const [form, setForm] = useState(TAREA_VACIA)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (tarea) {
      setForm({
        nombre: tarea.nombre || '',
        descripcion: tarea.descripcion || '',
        responsable: tarea.responsable || '',
        estado: tarea.estado || 'pendiente',
        costo_presupuestado: tarea.costo_presupuestado ?? '',
        costo_real: tarea.costo_real ?? '',
        fecha_inicio: tarea.fecha_inicio || '',
        fecha_fin: tarea.fecha_fin || '',
        fecha_fin_real: tarea.fecha_fin_real || '',
      })
    } else {
      setForm(TAREA_VACIA)
    }
  }, [open, etapa, tarea])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit() {
    if (!form.nombre.trim() || !etapa) return
    setSaving(true)
    setError(null)
    try {
      const saved = tarea
        ? await updateTarea(tarea.id, {
            nombre: form.nombre,
            descripcion: form.descripcion || null,
            responsable: form.responsable || null,
            estado: form.estado,
            costo_presupuestado: form.costo_presupuestado !== '' && form.costo_presupuestado !== null ? Number(form.costo_presupuestado) : null,
            costo_real: form.costo_real !== '' && form.costo_real !== null ? Number(form.costo_real) : null,
            fecha_inicio: form.fecha_inicio || null,
            fecha_fin: form.fecha_fin || null,
            fecha_fin_real: form.fecha_fin_real || null,
          })
        : await createTarea({ etapa_id: etapa.id, ...form })
      onSaved(etapa.id, saved)
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
      slotProps={{ paper: { sx: { width: 460, p: 3, bgcolor: 'white' } } }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
            {tarea ? 'Editar tarea' : 'Nueva tarea'}
          </Typography>
          {etapa && (
            <Box display="flex" alignItems="center" gap={0.75} mt={0.25}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: etapa.color || ACCENT }} />
              <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{etapa.nombre}</Typography>
            </Box>
          )}
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

      <Box mb={1.5}>
        <Typography sx={labelSx}>Nombre de la tarea</Typography>
        <TextField
          fullWidth
          size="small"
          name="nombre"
          value={form.nombre}
          onChange={handleChange}
          required
          autoFocus
          placeholder="Ej: Excavación de pozos"
          sx={fieldSx}
        />
      </Box>

      <Box mb={1.5}>
        <Typography sx={labelSx}>Descripción</Typography>
        <TextField
          fullWidth
          size="small"
          multiline
          minRows={2}
          name="descripcion"
          value={form.descripcion}
          onChange={handleChange}
          placeholder="Opcional"
          sx={fieldSx}
        />
      </Box>

      <Box display="flex" gap={1.5} mb={1.5}>
        <Box flex={1}>
          <Typography sx={labelSx}>Responsable</Typography>
          <TextField
            fullWidth
            size="small"
            name="responsable"
            value={form.responsable}
            onChange={handleChange}
            placeholder="Opcional"
            sx={fieldSx}
          />
        </Box>
        <Box flex={1}>
          <Typography sx={labelSx}>Estado</Typography>
          <FormControl fullWidth size="small">
            <Select name="estado" value={form.estado} onChange={handleChange} sx={selectSx}>
              {ESTADOS.map(e => (
                <MenuItem key={e.value} value={e.value} sx={{ fontSize: '0.875rem' }}>{e.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      <Box display="flex" gap={1.5} mb={1.5}>
        <Box flex={1}>
          <Typography sx={labelSx}>Costo presupuestado</Typography>
          <TextField
            fullWidth
            size="small"
            type="number"
            name="costo_presupuestado"
            value={form.costo_presupuestado}
            onChange={handleChange}
            placeholder="0.00"
            sx={fieldSx}
          />
        </Box>
        <Box flex={1}>
          <Typography sx={labelSx}>Costo real</Typography>
          <TextField
            fullWidth
            size="small"
            type="number"
            name="costo_real"
            value={form.costo_real}
            onChange={handleChange}
            placeholder="0.00"
            sx={fieldSx}
          />
        </Box>
      </Box>

      <Box display="flex" gap={1.5} mb={3}>
        <Box flex={1}>
          <Typography sx={labelSx}>Fecha de inicio</Typography>
          <TextField
            fullWidth
            size="small"
            type="date"
            name="fecha_inicio"
            value={form.fecha_inicio}
            onChange={handleChange}
            sx={fieldSx}
          />
        </Box>
        <Box flex={1}>
          <Typography sx={labelSx}>Fecha de fin prevista</Typography>
          <TextField
            fullWidth
            size="small"
            type="date"
            name="fecha_fin"
            value={form.fecha_fin}
            onChange={handleChange}
            sx={fieldSx}
          />
        </Box>
      </Box>

      <Box mb={3}>
        <Typography sx={labelSx}>Fecha de fin real</Typography>
        <TextField
          fullWidth
          size="small"
          type="date"
          name="fecha_fin_real"
          value={form.fecha_fin_real}
          onChange={handleChange}
          sx={fieldSx}
        />
      </Box>

      <Box display="flex" gap={1.5}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving || !form.nombre.trim()}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{
            bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
            fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none',
            '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
          }}
        >
          {saving ? 'Guardando...' : tarea ? 'Guardar cambios' : 'Crear tarea'}
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
