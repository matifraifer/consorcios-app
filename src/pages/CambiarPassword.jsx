import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Box, TextField, Button, Typography, Alert, CircularProgress, Paper } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'

const ACCENT = '#065F46'

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}

export default function CambiarPassword() {
  const { user, initializing, changePassword, logout, mustChangePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (initializing) return null
  if (!user) return <Navigate to="/login" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      await changePassword(password)
      navigate('/dashboard', { replace: true })
    } catch {
      setError('No se pudo cambiar la contraseña. Intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelar() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#F7F7F4',
        fontFamily: "'Poppins', sans-serif",
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          p: 5,
          borderRadius: '12px',
          border: '1px solid #E5E5E0',
        }}
      >
        <Typography sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 22, color: '#111110', mb: 0.5 }}>
          Cambiar contraseña
        </Typography>
        <Typography sx={{ fontFamily: "'Poppins', sans-serif", fontSize: 13.5, color: '#9CA3AF', mb: 4 }}>
          {mustChangePassword
            ? 'Por seguridad, tenés que definir una contraseña nueva antes de continuar.'
            : 'Definí tu nueva contraseña.'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: '8px', fontSize: 13 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Box sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6B7280', mb: 0.8 }}>
              Nueva contraseña
            </Typography>
            <TextField
              type="password"
              fullWidth
              size="small"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              autoComplete="new-password"
              helperText="Debe contener al menos 8 caracteres"
              sx={fieldSx}
            />
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6B7280', mb: 0.8 }}>
              Confirmar contraseña
            </Typography>
            <TextField
              type="password"
              fullWidth
              size="small"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              required
              autoComplete="new-password"
              sx={fieldSx}
            />
          </Box>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600,
              fontSize: 13, letterSpacing: '0.02em', height: 46, boxShadow: 'none',
              '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
            }}
          >
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </Button>

          <Button
            fullWidth
            disabled={loading}
            onClick={handleCancelar}
            sx={{
              mt: 1.5, borderRadius: '8px', textTransform: 'none', fontWeight: 600,
              fontSize: 13, color: '#6B7280', '&:hover': { bgcolor: '#F3F4F6' },
            }}
          >
            Cancelar
          </Button>
        </form>
      </Paper>
    </Box>
  )
}
