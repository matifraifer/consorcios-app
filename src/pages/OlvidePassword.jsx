import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, TextField, Button, Typography, Alert, CircularProgress, Paper, Link } from '@mui/material'
import { requestPasswordReset } from '../services/supabase'

const ACCENT = '#065F46'

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}

export default function OlvidePassword() {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await requestPasswordReset(username.trim())
    } catch {
      // no distinguimos el error al usuario para no revelar si el usuario existe
    } finally {
      setLoading(false)
      setEnviado(true)
    }
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
          Olvidé mi contraseña
        </Typography>

        {enviado ? (
          <>
            <Typography sx={{ fontFamily: "'Poppins', sans-serif", fontSize: 13.5, color: '#6B7280', mb: 4, mt: 2 }}>
              Si el usuario existe, te enviamos un correo con instrucciones para restablecer la contraseña.
            </Typography>
            <Link component={RouterLink} to="/login" sx={{ fontSize: 13, color: ACCENT, fontWeight: 600, textDecoration: 'none' }}>
              Volver a inicio de sesión
            </Link>
          </>
        ) : (
          <>
            <Typography sx={{ fontFamily: "'Poppins', sans-serif", fontSize: 13.5, color: '#9CA3AF', mb: 4 }}>
              Ingresá tu usuario y te enviaremos un correo para restablecer tu contraseña.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: '8px', fontSize: 13 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Box sx={{ mb: 4 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6B7280', mb: 0.8 }}>
                  Usuario
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  sx={fieldSx}
                />
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading || !username.trim()}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
                sx={{
                  bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600,
                  fontSize: 13, letterSpacing: '0.02em', height: 46, boxShadow: 'none',
                  '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
                }}
              >
                {loading ? 'Enviando...' : 'Enviar instrucciones'}
              </Button>

              <Link component={RouterLink} to="/login" sx={{ display: 'block', textAlign: 'center', mt: 2, fontSize: 13, color: '#6B7280', textDecoration: 'none', fontWeight: 600 }}>
                Volver a inicio de sesión
              </Link>
            </form>
          </>
        )}
      </Paper>
    </Box>
  )
}
