import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  FormHelperText,
} from '@mui/material'
import { createPropietario, getConsorcios } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function NuevoPropietario() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const consorcioParam = searchParams.get('consorcio') || ''
  const { user } = useAuth()

  const [consorcios, setConsorcios] = useState([])
  const [form, setForm] = useState({
    dni: '',
    nombre: '',
    apellido: '',
    id_consorcio: consorcioParam,
  })
  const [loading, setLoading] = useState(false)
  const [loadingConsorcios, setLoadingConsorcios] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    getConsorcios(user.id)
      .then(setConsorcios)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingConsorcios(false))
  }, [user.id])

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.dni.trim() || !form.nombre.trim() || !form.apellido.trim() || !form.id_consorcio) return

    setLoading(true)
    setError(null)
    try {
      await createPropietario(form)
      setSuccess(true)
      setTimeout(() => navigate('/propietarios'), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box maxWidth={500}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        Nuevo Propietario
      </Typography>

      <Paper sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            label="DNI"
            name="dni"
            fullWidth
            margin="normal"
            value={form.dni}
            onChange={handleChange}
            required
            autoFocus
            placeholder="Ej: 30123456"
          />
          <TextField
            label="Nombre"
            name="nombre"
            fullWidth
            margin="normal"
            value={form.nombre}
            onChange={handleChange}
            required
          />
          <TextField
            label="Apellido"
            name="apellido"
            fullWidth
            margin="normal"
            value={form.apellido}
            onChange={handleChange}
            required
          />

          <FormControl fullWidth margin="normal" required disabled={loadingConsorcios}>
            <InputLabel>Consorcio</InputLabel>
            <Select
              name="id_consorcio"
              value={form.id_consorcio}
              label="Consorcio"
              onChange={handleChange}
            >
              {consorcios.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.nombre}
                </MenuItem>
              ))}
            </Select>
            {loadingConsorcios && (
              <FormHelperText>Cargando consorcios...</FormHelperText>
            )}
          </FormControl>

          <Box mt={3} display="flex" gap={2}>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || loadingConsorcios}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {loading ? 'Guardando...' : 'Crear Propietario'}
            </Button>
            <Button variant="outlined" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
          </Box>
        </form>
      </Paper>

      <Snackbar
        open={success}
        message="Propietario creado exitosamente"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
