import { useEffect, useState } from 'react'
import {
  Box, Typography, Drawer, IconButton, Divider, Button, CircularProgress,
  Alert, TextField, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import {
  createReclamo, getConsorcios, getPropietariosByConsorcio, getDepartamentosByConsorcio,
} from '../../services/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ESTADOS_RECLAMO, ESTADO_RECLAMO_STYLES } from './EstadoReclamoBadge'

const ACCENT = '#065F46'

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

const emptyForm = {
  consorcio_id: '',
  propietario_id: '',
  departamento_id: '',
  descripcion: '',
  estado: 'pendiente',
  fecha: todayDate(),
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}

export default function ReclamoFormDrawer({ open, onClose, onCreated }) {
  const { clienteId } = useAuth()

  const [consorcios, setConsorcios] = useState([])
  const [propietarios, setPropietarios] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [loadingConsorcios, setLoadingConsorcios] = useState(true)
  const [loadingDeps, setLoadingDeps] = useState(false)

  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setForm(emptyForm)
    setError(null)
    setPropietarios([])
    setDepartamentos([])
    setLoadingConsorcios(true)
    getConsorcios(clienteId)
      .then(setConsorcios)
      .catch(err => setError(err.message))
      .finally(() => setLoadingConsorcios(false))
  }, [open, clienteId])

  async function handleChange(e) {
    const { name, value } = e.target
    if (name === 'consorcio_id') {
      setForm(prev => ({ ...prev, consorcio_id: value, propietario_id: '', departamento_id: '' }))
      if (value) {
        setLoadingDeps(true)
        try {
          const [props, deps] = await Promise.all([
            getPropietariosByConsorcio(value),
            getDepartamentosByConsorcio(value),
          ])
          setPropietarios(props)
          setDepartamentos(deps)
        } catch (err) {
          setError(err.message)
        } finally {
          setLoadingDeps(false)
        }
      } else {
        setPropietarios([])
        setDepartamentos([])
      }
    } else {
      setForm(prev => ({ ...prev, [name]: value }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.consorcio_id || !form.propietario_id || !form.departamento_id || !form.descripcion.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createReclamo({ ...form, cliente_id: clienteId })
      onCreated()
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
      slotProps={{ paper: { sx: { width: 420, p: 3, bgcolor: 'white' } } }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Nuevo reclamo</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>Registrá un reclamo para hacerle seguimiento</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSubmit}>
        <FormControl fullWidth margin="normal" required size="small" disabled={loadingConsorcios} sx={fieldSx}>
          <InputLabel>Consorcio</InputLabel>
          <Select name="consorcio_id" value={form.consorcio_id} label="Consorcio" onChange={handleChange}>
            {consorcios.map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal" required size="small" disabled={!form.consorcio_id || loadingDeps} sx={fieldSx}>
          <InputLabel>Propietario</InputLabel>
          <Select name="propietario_id" value={form.propietario_id} label="Propietario" onChange={handleChange}>
            {propietarios.map(p => <MenuItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal" required size="small" disabled={!form.consorcio_id || loadingDeps} sx={fieldSx}>
          <InputLabel>Unidad</InputLabel>
          <Select name="departamento_id" value={form.departamento_id} label="Unidad" onChange={handleChange}>
            {departamentos.map(d => <MenuItem key={d.id} value={d.id}>{d.numeracion}</MenuItem>)}
          </Select>
        </FormControl>

        <TextField
          label="Descripción"
          name="descripcion"
          fullWidth
          margin="normal"
          multiline
          rows={4}
          size="small"
          value={form.descripcion}
          onChange={handleChange}
          required
          placeholder="Describí el reclamo con el mayor detalle posible"
          sx={fieldSx}
        />

        <Box display="flex" gap={1.5}>
          <FormControl fullWidth margin="normal" required size="small" sx={fieldSx}>
            <InputLabel>Estado</InputLabel>
            <Select name="estado" value={form.estado} label="Estado" onChange={handleChange}>
              {ESTADOS_RECLAMO.map(est => (
                <MenuItem key={est} value={est}>{ESTADO_RECLAMO_STYLES[est].label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Fecha"
            name="fecha"
            type="date"
            fullWidth
            margin="normal"
            size="small"
            value={form.fecha}
            onChange={handleChange}
            required
            InputLabelProps={{ shrink: true }}
            sx={fieldSx}
          />
        </Box>

        <Box mt={3} display="flex" gap={1.5}>
          <Button
            type="submit"
            variant="contained"
            disabled={saving || loadingConsorcios}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{
              bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
              fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none',
              '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
            }}
          >
            {saving ? 'Guardando...' : 'Crear reclamo'}
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
      </Box>
    </Drawer>
  )
}
