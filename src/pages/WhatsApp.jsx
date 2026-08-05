import { useEffect, useRef, useState } from 'react'
import {
  Box, Typography, TextField, Button, CircularProgress, Alert,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { useAuth } from '../contexts/AuthContext'
import { getWhatsappMensajes, sendWhatsappMensaje } from '../services/supabase'

const ACCENT = '#065F46'
const POLL_MS = 5000

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}

function fmtHora(date) {
  return new Date(date).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function WhatsApp() {
  const { clienteId } = useAuth()
  const [mensajes, setMensajes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [telefono, setTelefono] = useState('')
  const [texto, setTexto]       = useState('')
  const [sending, setSending]   = useState(false)
  const [error, setError]       = useState(null)
  const pollRef = useRef(null)

  useEffect(() => {
    if (!clienteId) return
    refresh()
    pollRef.current = setInterval(refresh, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [clienteId])

  async function refresh() {
    try {
      setMensajes(await getWhatsappMensajes(clienteId))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    if (!telefono.trim() || !texto.trim()) return
    setSending(true)
    setError(null)
    try {
      await sendWhatsappMensaje(clienteId, telefono.trim(), texto.trim())
      setTexto('')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Box sx={{ pb: 6, maxWidth: 720 }}>
      <Box mb={4}>
        <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          WhatsApp
        </Typography>
        <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF', mt: 0.5 }}>
          Mensajes enviados y recibidos por el número conectado en Configuración.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

      <Box sx={{ bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', p: 2.5, mb: 2.5 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 1 }}>Enviar mensaje</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '160px 1fr auto' }, gap: 1.5 }}>
          <TextField
            size="small" placeholder="Teléfono"
            value={telefono} onChange={e => setTelefono(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            size="small" placeholder="Escribí un mensaje..."
            value={texto} onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
            sx={fieldSx}
          />
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={sending || !telefono.trim() || !texto.trim()}
            startIcon={sending ? <CircularProgress size={14} color="inherit" /> : <SendIcon sx={{ fontSize: 16 }} />}
            sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
          >
            Enviar
          </Button>
        </Box>
      </Box>

      <Box sx={{ bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', p: 2.5 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={24} sx={{ color: ACCENT }} />
          </Box>
        ) : mensajes.length === 0 ? (
          <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF', textAlign: 'center', py: 3 }}>
            Todavía no hay mensajes.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {mensajes.map(m => (
              <Box
                key={m.id}
                sx={{
                  alignSelf: m.direction === 'saliente' ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  bgcolor: m.direction === 'saliente' ? '#ECFDF5' : '#F9FAFB',
                  border: `1px solid ${m.direction === 'saliente' ? '#A7F3D0' : '#E5E7EB'}`,
                  borderRadius: '10px', px: 1.5, py: 1,
                }}
              >
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#6B7280', mb: 0.25 }}>
                  {m.telefono}
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', color: '#111827', whiteSpace: 'pre-wrap' }}>
                  {m.body}
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: '#9CA3AF', mt: 0.25, textAlign: 'right' }}>
                  {fmtHora(m.created_at)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
