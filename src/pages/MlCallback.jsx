import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, Typography, CircularProgress, Alert, Button } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'

const REDIRECT_URI = 'https://consorcios-app.vercel.app/ml-callback'

export default function MlCallback() {
  const [searchParams]        = useSearchParams()
  const navigate              = useNavigate()
  const { clienteId }         = useAuth()
  const [status, setStatus]   = useState('loading')
  const [errorMsg, setError]  = useState('')

  useEffect(() => {
    const code  = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      setError('La autorización fue cancelada.')
      setStatus('error')
      return
    }
    if (!code) {
      setError('No se recibió el código de autorización.')
      setStatus('error')
      return
    }
    if (!clienteId) {
      setError('No hay sesión activa. Iniciá sesión primero.')
      setStatus('error')
      return
    }

    supabase.functions
      .invoke('ml-auth', { body: { code, redirect_uri: REDIRECT_URI, cliente_id: clienteId } })
      .then(({ data, error: fnError }) => {
        if (fnError) throw fnError
        if (data?.error) throw new Error(JSON.stringify(data.error))
        setStatus('success')
        setTimeout(() => navigate('/propiedades'), 2500)
      })
      .catch(err => {
        setError(err.message ?? 'Error al conectar con MercadoLibre.')
        setStatus('error')
      })
  }, [])

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: '#F9FAFB',
    }}>
      <Box sx={{
        textAlign: 'center', maxWidth: 400, p: 4,
        bgcolor: 'white', borderRadius: '16px', border: '1px solid #E5E7EB',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 3 }}>
          <Box component="img" src="/logo.svg" sx={{ height: 28 }} />
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#065F46' }}>Hábita</Typography>
        </Box>

        {status === 'loading' && (
          <>
            <CircularProgress sx={{ color: '#065F46', mb: 2 }} size={36} />
            <Typography sx={{ fontWeight: 600, color: '#111827', mb: 0.5 }}>Conectando con MercadoLibre...</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>Esto puede tardar unos segundos.</Typography>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircleIcon sx={{ fontSize: 48, color: '#065F46', mb: 2 }} />
            <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#111827', mb: 0.5 }}>
              ¡Cuenta conectada exitosamente!
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>
              Redirigiendo a propiedades...
            </Typography>
          </>
        )}

        {status === 'error' && (
          <>
            <ErrorOutlineIcon sx={{ fontSize: 48, color: '#EF4444', mb: 2 }} />
            <Alert severity="error" sx={{ mb: 2, textAlign: 'left', borderRadius: '8px', fontSize: '0.82rem' }}>
              {errorMsg}
            </Alert>
            <Button
              variant="outlined"
              onClick={() => navigate('/propiedades')}
              sx={{ textTransform: 'none', borderRadius: '8px', borderColor: '#E5E7EB', color: '#374151' }}
            >
              Volver a propiedades
            </Button>
          </>
        )}
      </Box>
    </Box>
  )
}
