import { useEffect, useState } from 'react'
import {
  Box, Typography, Drawer, IconButton, Divider, Button, CircularProgress,
  Alert, TextField, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import {
  getReclamoById, updateReclamo, getConsorcios, getPropietariosByConsorcio, getDepartamentosByConsorcio,
} from '../../services/supabase'
import { useAuth } from '../../contexts/AuthContext'
import EstadoReclamoBadge, { ESTADOS_RECLAMO, ESTADO_RECLAMO_STYLES } from './EstadoReclamoBadge'

const ACCENT = '#065F46'

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}

export default function ReclamoDetalleDrawer({ id, open, onClose, onUpdated }) {
  const { clienteId } = useAuth()

  const [consorcios, setConsorcios] = useState([])
  const [propietarios, setPropietarios] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [loadingDeps, setLoadingDeps] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || id == null) return
    setLoadingData(true)
    setError(null)
    setForm(null)
    Promise.all([getReclamoById(id), getConsorcios(clienteId)])
      .then(([reclamo, cons]) =>
        Promise.all([
          getPropietariosByConsorcio(reclamo.consorcio_id),
          getDepartamentosByConsorcio(reclamo.consorcio_id),
        ]).then(([props, deps]) => ({ reclamo, cons, props, deps }))
      )
      .then(({ reclamo, cons, props, deps }) => {
        setForm({
          consorcio_id:    reclamo.consorcio_id,
          propietario_id:  reclamo.propietario_id,
          departamento_id: reclamo.departamento_id,
          descripcion:     reclamo.descripcion,
          estado:          reclamo.estado,
          fecha:           reclamo.fecha,
        })
        setConsorcios(cons)
        setPropietarios(props)
        setDepartamentos(deps)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoadingData(false))
  }, [id, open, clienteId])

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
      await updateReclamo(id, form)
      onUpdated()
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
      slotProps={{ paper: { sx: { width: 420, p: 3, bgcolor: 'white' } } }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
              Reclamo #{id}
            </Typography>
            {form && <EstadoReclamoBadge estado={form.estado} size="small" />}
          </Box>
          <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>Detalle y seguimiento</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />

      {loadingData ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress size={28} sx={{ color: ACCENT }} />
        </Box>
      ) : !form ? (
        <Alert severity="error" sx={{ borderRadius: '8px' }}>{error ?? 'Reclamo no encontrado'}</Alert>
      ) : (
        <Box component="form" onSubmit={handleSubmit}>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

          <FormControl fullWidth margin="normal" required size="small" sx={fieldSx}>
            <InputLabel>Consorcio</InputLabel>
            <Select name="consorcio_id" value={form.consorcio_id} label="Consorcio" onChange={handleChange}>
              {consorcios.map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" required size="small" disabled={!form.consorcio_id || loadingDeps} sx={fieldSx}>
            <InputLabel>Propietario</InputLabel>
            <Select name="propietario_id" value={form.propietario_id ?? ''} label="Propietario" onChange={handleChange}>
              {propietarios.map(p => <MenuItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" required size="small" disabled={!form.consorcio_id || loadingDeps} sx={fieldSx}>
            <InputLabel>Unidad</InputLabel>
            <Select name="departamento_id" value={form.departamento_id ?? ''} label="Unidad" onChange={handleChange}>
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
              disabled={saving}
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
              sx={{
                bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none',
                '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
              }}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
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
              Cerrar
            </Button>
          </Box>
        </Box>
      )}
    </Drawer>
  )
}
