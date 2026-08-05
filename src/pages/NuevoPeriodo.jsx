import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material'
import { createPeriodo, getConsorcios } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

const MESES = [
  { value: 1,  label: 'Enero' },
  { value: 2,  label: 'Febrero' },
  { value: 3,  label: 'Marzo' },
  { value: 4,  label: 'Abril' },
  { value: 5,  label: 'Mayo' },
  { value: 6,  label: 'Junio' },
  { value: 7,  label: 'Julio' },
  { value: 8,  label: 'Agosto' },
  { value: 9,  label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
]

export default function NuevoPeriodo() {
  const navigate = useNavigate()
  const { clienteId, user } = useAuth()

  const [consorcios, setConsorcios] = useState([])
  const [loadingConsorcios, setLoadingConsorcios] = useState(true)
  const [form, setForm] = useState({
    consorcio_id: '',
    mes: new Date().getMonth() + 1,
    anio: new Date().getFullYear(),
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getConsorcios(clienteId)
      .then(setConsorcios)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingConsorcios(false))
  }, [clienteId])

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.consorcio_id || !form.mes || !form.anio) return

    setLoading(true)
    setError(null)
    try {
      const periodo = await createPeriodo({ ...form, cliente_id: clienteId, usuario_id: user.id })
      navigate(`/expensas/${periodo.id}`)
    } catch (err) {
      if (err.message?.includes('duplicate') || err.message?.includes('unique') || err.code === '23505') {
        setError('Ya existe un período para este consorcio en ese mes y año.')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box maxWidth={500}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        Nuevo Período
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

          <FormControl fullWidth margin="normal" required>
            <InputLabel>Mes</InputLabel>
            <Select name="mes" value={form.mes} label="Mes" onChange={handleChange}>
              {MESES.map((m) => (
                <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Año"
            name="anio"
            type="number"
            fullWidth
            margin="normal"
            value={form.anio}
            onChange={handleChange}
            required
            inputProps={{ min: 2020, max: 2099 }}
          />

          <Box mt={3} display="flex" gap={2}>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || loadingConsorcios}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {loading ? 'Creando...' : 'Crear Período'}
            </Button>
            <Button variant="outlined" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  )
}
