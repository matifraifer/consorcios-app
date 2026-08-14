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
  FormHelperText,
} from '@mui/material'
import { createDepartamento, getConsorcios } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function NuevoDepartamentoGlobal() {
  const navigate = useNavigate()
  const { clienteId } = useAuth()

  const [consorcios, setConsorcios] = useState([])
  const [form, setForm] = useState({ numeracion: '', id_consorcio: '', propietario_nombre: '', propietario_apellido: '', propietario_dni: '', inquilino: '', coeficiente: '' })
  const [loading, setLoading] = useState(false)
  const [loadingConsorcios, setLoadingConsorcios] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

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
    if (!form.numeracion.trim() || !form.id_consorcio) return

    setLoading(true)
    setError(null)
    try {
      await createDepartamento({
        numeracion: form.numeracion,
        inquilino: form.inquilino,
        propietario_nombre: form.propietario_nombre,
        propietario_apellido: form.propietario_apellido,
        propietario_dni: form.propietario_dni,
        id_consorcio: form.id_consorcio,
        coeficiente: form.coeficiente || null,
      })
      setSuccess(true)
      setTimeout(() => navigate('/departamentos'), 1500)
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
            {loadingConsorcios && <FormHelperText>Cargando consorcios...</FormHelperText>}
          </FormControl>

          <TextField
            label="Numeracion"
            name="numeracion"
            fullWidth
            margin="normal"
            value={form.numeracion}
            onChange={handleChange}
            required
            placeholder="Ej: 1A, 2B, PB, 3C..."
            helperText="Identificador unico del departamento en el edificio"
          />

          <TextField
            label="Nombre del propietario"
            name="propietario_nombre"
            fullWidth
            margin="normal"
            value={form.propietario_nombre}
            onChange={handleChange}
            placeholder="Ej: Juan"
          />

          <TextField
            label="Apellido del propietario"
            name="propietario_apellido"
            fullWidth
            margin="normal"
            value={form.propietario_apellido}
            onChange={handleChange}
            placeholder="Ej: García"
          />

          <TextField
            label="DNI del propietario (opcional)"
            name="propietario_dni"
            fullWidth
            margin="normal"
            value={form.propietario_dni}
            onChange={handleChange}
            placeholder="Ej: 30123456"
          />

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
            <Button variant="outlined" onClick={() => navigate('/departamentos')}>
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
