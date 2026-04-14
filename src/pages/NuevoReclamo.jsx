import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
} from '@mui/material'
import {
  createReclamo,
  getConsorcios,
  getPropietariosByConsorcio,
  getDepartamentosByConsorcio,
} from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

const ESTADOS = ['pendiente', 'resuelto', 'descartado']

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

export default function NuevoReclamo() {
  const navigate = useNavigate()
  const { clienteId } = useAuth()

  const [consorcios, setConsorcios] = useState([])
  const [propietarios, setPropietarios] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [loadingConsorcios, setLoadingConsorcios] = useState(true)
  const [loadingDeps, setLoadingDeps] = useState(false)

  const [form, setForm] = useState({
    consorcio_id: '',
    propietario_id: '',
    departamento_id: '',
    descripcion: '',
    estado: 'pendiente',
    fecha: todayDate(),
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    getConsorcios(clienteId)
      .then(setConsorcios)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingConsorcios(false))
  }, [clienteId])

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
      await createReclamo({ ...form, cliente_id: clienteId })
      setSuccess(true)
      setTimeout(() => navigate('/reclamos'), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box maxWidth={600}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        Nuevo Reclamo
      </Typography>

      <Paper sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <FormControl fullWidth margin="normal" required disabled={loadingConsorcios}>
            <InputLabel>Consorcio</InputLabel>
            <Select name="consorcio_id" value={form.consorcio_id} label="Consorcio" onChange={handleChange}>
              {consorcios.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" required disabled={!form.consorcio_id || loadingDeps}>
            <InputLabel>Propietario</InputLabel>
            <Select name="propietario_id" value={form.propietario_id} label="Propietario" onChange={handleChange}>
              {propietarios.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.apellido}, {p.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal" required disabled={!form.consorcio_id || loadingDeps}>
            <InputLabel>Departamento</InputLabel>
            <Select name="departamento_id" value={form.departamento_id} label="Departamento" onChange={handleChange}>
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
            placeholder="Describi el reclamo con el mayor detalle posible"
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
            label="Fecha del reclamo"
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
              disabled={loading || loadingConsorcios}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {loading ? 'Guardando...' : 'Crear Reclamo'}
            </Button>
            <Button variant="outlined" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
          </Box>
        </form>
      </Paper>

      <Snackbar
        open={success}
        message="Reclamo creado exitosamente"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
