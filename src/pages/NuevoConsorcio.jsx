import { useState } from 'react'
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
} from '@mui/material'
import { createConsorcio } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function NuevoConsorcio() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) return

    setLoading(true)
    setError(null)
    try {
      await createConsorcio({ nombre: nombre.trim(), id_administrador: user.id })
      setSuccess(true)
      setTimeout(() => navigate('/consorcios'), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box maxWidth={500}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        Nuevo Consorcio
      </Typography>

      <Paper sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            label="Nombre del Consorcio"
            fullWidth
            margin="normal"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoFocus
            placeholder="Ej: Edificio San Martin"
          />
          <TextField
            label="ID Administrador"
            fullWidth
            margin="normal"
            value={user?.id || ''}
            InputProps={{ readOnly: true }}
            helperText="Asignado automaticamente al usuario actual"
            sx={{ '& input': { color: 'text.secondary', fontSize: '0.8rem' } }}
          />

          <Box mt={3} display="flex" gap={2}>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {loading ? 'Guardando...' : 'Crear Consorcio'}
            </Button>
            <Button variant="outlined" onClick={() => navigate('/consorcios')}>
              Cancelar
            </Button>
          </Box>
        </form>
      </Paper>

      <Snackbar
        open={success}
        message="Consorcio creado exitosamente"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
