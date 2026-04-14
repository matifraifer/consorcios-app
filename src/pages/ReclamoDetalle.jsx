import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import {
  getReclamoById,
  updateReclamo,
  getConsorcios,
  getPropietariosByConsorcio,
  getDepartamentosByConsorcio,
} from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

const ESTADOS = ['pendiente', 'resuelto', 'descartado']

const estadoColor = {
  pendiente:  'warning',
  resuelto:   'success',
  descartado: 'default',
}

export default function ReclamoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { clienteId } = useAuth()

  const [consorcios, setConsorcios] = useState([])
  const [propietarios, setPropietarios] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [loadingDeps, setLoadingDeps] = useState(false)
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
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
      .catch((err) => setError(err.message))
      .finally(() => setLoadingData(false))
  }, [id, user.id])

  async function handleChange(e) {
    const { name, value } = e.target
    if (name === 'consorcio_id') {
      setForm((prev) => ({ ...prev, consorcio_id: value, propietario_id: '', departamento_id: '' }))
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
      setForm((prev) => ({ ...prev, [name]: value }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.consorcio_id || !form.propietario_id || !form.departamento_id || !form.descripcion.trim()) return

    setLoading(true)
    setError(null)
    try {
      await updateReclamo(id, form)
      setSuccess(true)
      setTimeout(() => navigate('/reclamos'), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>
  if (!form) return <Alert severity="error">{error ?? 'Reclamo no encontrado'}</Alert>

  return (
    <Box maxWidth={600}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/reclamos')}
        sx={{ mb: 2 }}
      >
        Volver a Reclamos
      </Button>

      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Reclamo #{id}
        </Typography>
        <Chip
          label={form.estado}
          color={estadoColor[form.estado] ?? 'default'}
          size="small"
        />
      </Box>

      <Paper sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Consorcio</InputLabel>
            <Select name="consorcio_id" value={form.consorcio_id} label="Consorcio" onChange={handleChange}>
              {consorcios.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" required disabled={!form.consorcio_id || loadingDeps}>
            <InputLabel>Propietario</InputLabel>
            <Select name="propietario_id" value={form.propietario_id ?? ''} label="Propietario" onChange={handleChange}>
              {propietarios.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" required disabled={!form.consorcio_id || loadingDeps}>
            <InputLabel>Departamento</InputLabel>
            <Select name="departamento_id" value={form.departamento_id ?? ''} label="Departamento" onChange={handleChange}>
              {departamentos.map((d) => (
                <MenuItem key={d.id} value={d.id}>{d.numeracion}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Descripcion"
            name="descripcion"
            fullWidth
            margin="normal"
            multiline
            rows={4}
            value={form.descripcion}
            onChange={handleChange}
            required
          />

          <FormControl fullWidth margin="normal" required>
            <InputLabel>Estado</InputLabel>
            <Select name="estado" value={form.estado} label="Estado" onChange={handleChange}>
              {ESTADOS.map((est) => (
                <MenuItem key={est} value={est} sx={{ textTransform: 'capitalize' }}>{est}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Fecha"
            name="fecha"
            type="date"
            fullWidth
            margin="normal"
            value={form.fecha}
            onChange={handleChange}
            required
            InputLabelProps={{ shrink: true }}
          />

          <Box mt={3} display="flex" gap={2}>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
            <Button variant="outlined" onClick={() => navigate('/reclamos')}>
              Volver
            </Button>
          </Box>
        </form>
      </Paper>

      <Snackbar
        open={success}
        message="Reclamo actualizado exitosamente"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
