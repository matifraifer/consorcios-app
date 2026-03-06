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
  FormHelperText,
} from '@mui/material'
import { createDepartamento, getPropietariosByConsorcio } from '../services/supabase'

export default function NuevoDepartamento() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({ numeracion: '', id_propietario: '', inquilino: '', coeficiente: '' })
  const [propietarios, setPropietarios] = useState([])
  const [loadingPropietarios, setLoadingPropietarios] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    getPropietariosByConsorcio(id)
      .then(setPropietarios)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingPropietarios(false))
  }, [id])

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.numeracion.trim()) return

    setLoading(true)
    setError(null)
    try {
      await createDepartamento({ ...form, id_consorcio: id })
      setSuccess(true)
      setTimeout(() => navigate(`/consorcios/${id}`), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box maxWidth={500}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        Nuevo Departamento
      </Typography>

      <Paper sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            label="Numeracion"
            name="numeracion"
            fullWidth
            margin="normal"
            value={form.numeracion}
            onChange={handleChange}
            required
            autoFocus
            placeholder="Ej: 1A, 2B, PB, 3C..."
            helperText="Identificador unico del departamento en el edificio"
          />

          <FormControl fullWidth margin="normal" disabled={loadingPropietarios}>
            <InputLabel>Propietario</InputLabel>
            <Select
              name="id_propietario"
              value={form.id_propietario}
              label="Propietario"
              onChange={handleChange}
            >
              <MenuItem value="">
                <em>Sin propietario</em>
              </MenuItem>
              {propietarios.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.apellido}, {p.nombre}
                </MenuItem>
              ))}
            </Select>
            {loadingPropietarios && (
              <FormHelperText>Cargando propietarios...</FormHelperText>
            )}
            {!loadingPropietarios && propietarios.length === 0 && (
              <FormHelperText>
                No hay propietarios en este consorcio. Crea uno primero.
              </FormHelperText>
            )}
          </FormControl>

          <TextField
            label="Inquilino"
            name="inquilino"
            fullWidth
            margin="normal"
            value={form.inquilino}
            onChange={handleChange}
            placeholder="Nombre y apellido del inquilino (opcional)"
          />

          <TextField
            label="Coeficiente (%)"
            name="coeficiente"
            type="number"
            fullWidth
            margin="normal"
            value={form.coeficiente}
            onChange={handleChange}
            inputProps={{ min: 0, max: 100, step: '0.0001' }}
            placeholder="Ej: 3.1250"
            helperText="Porcentaje de participacion en gastos comunes (opcional)"
          />

          <Box mt={3} display="flex" gap={2}>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {loading ? 'Guardando...' : 'Crear Departamento'}
            </Button>
            <Button variant="outlined" onClick={() => navigate(`/consorcios/${id}`)}>
              Cancelar
            </Button>
          </Box>
        </form>
      </Paper>

      <Snackbar
        open={success}
        message="Departamento creado exitosamente"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
