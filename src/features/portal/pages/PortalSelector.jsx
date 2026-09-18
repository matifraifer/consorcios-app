import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, TextField, CircularProgress, Alert } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { buscarClientesPortal, logPortalError } from '../services/portal'
import PortalErrorBoundary from '../../../shared/components/PortalErrorBoundary'

// Mismos tokens de color que PortalVecino.jsx (design system "Consorcios
// Design System v1.0"): naranja protagonista + verde bosque de estructura.
const ORANGE = '#fb3c00'
const GREEN_900 = '#142B21'
const GREEN_BG = '#f7faf9'
const BORDER = 'rgba(20,43,33,0.10)'
const BORDER_STRONG = 'rgba(20,43,33,0.16)'
const TEXT_MUTED = 'rgba(20,43,33,0.52)'
const SURFACE_SUNKEN = 'rgba(20,43,33,0.04)'
const RING_ACCENT = '0 0 0 3px rgba(251,60,0,0.10)'
const SHADOW_MD = '0 4px 16px rgba(20,43,33,0.09), 0 2px 4px rgba(20,43,33,0.05)'

const MIN_CHARS = 2

function Header() {
  return (
    <Box sx={{
      bgcolor: GREEN_900, position: 'sticky', top: 0, zIndex: 100,
      borderBottom: `2px solid ${ORANGE}`, overflow: 'hidden',
    }}>
      <Box sx={{
        position: 'absolute', top: -70, right: -40, width: 260, height: 260, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(251,60,0,0.18) 0%, transparent 65%)', pointerEvents: 'none',
      }} />
      <Box sx={{ position: 'relative', px: { xs: 2, md: 4 }, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box component="img" src="/logo.svg" alt="Granito" sx={{ height: 26, width: 26, objectFit: 'contain', flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#E2F0E8', letterSpacing: '-0.01em' }}>
          granito
        </Typography>
      </Box>
    </Box>
  )
}

export default function PortalSelector() {
  return (
    <PortalErrorBoundary ruta="portal_selector">
      <PortalSelectorInner />
    </PortalErrorBoundary>
  )
}

function PortalSelectorInner() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [buscado, setBuscado] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < MIN_CHARS) return
    const timer = setTimeout(() => {
      buscarClientesPortal(q)
        .then(data => {
          setResultados(data ?? [])
          setBuscado(true)
        })
        .catch(err => {
          logPortalError('portal_selector', 'buscar_clientes', err, { query: q })
          setError('Ocurrió un error al buscar. Intentá de nuevo.')
        })
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  function handleChange(e) {
    const value = e.target.value
    setQuery(value)
    const q = value.trim()
    if (q.length < MIN_CHARS) {
      setResultados([])
      setBuscado(false)
      setError(null)
      setLoading(false)
    } else {
      setLoading(true)
      setError(null)
    }
  }

  function irAlPortal(cliente) {
    navigate(`/portal/${cliente.extension || cliente.id}`)
  }

  return (
    <Box minHeight="100vh" bgcolor={GREEN_BG}>
      <Header />

      <Box display="flex" justifyContent="center" px={2} py={{ xs: 4, md: 8 }}>
        <Box sx={{ width: '100%', maxWidth: 480 }}>
          <Box textAlign="center" mb={3}>
            <Typography sx={{
              fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.25,
              background: `linear-gradient(90deg, ${ORANGE} 0%, ${ORANGE} 35%, #ffffff 100%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              ¡Bienvenido<br />al portal del vecino!
            </Typography>
          </Box>

          <Box sx={{
            bgcolor: 'white', borderRadius: '16px', border: `1px solid ${BORDER}`,
            boxShadow: SHADOW_MD, p: { xs: 3, sm: 4 },
          }}>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: GREEN_900, mb: 0.25 }}>
              Buscá tu consorcio o inmobiliaria
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: TEXT_MUTED, mb: 3 }}>
              Escribí el nombre para encontrarlo y continuar.
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px', fontSize: '0.82rem' }}>{error}</Alert>}

            <TextField
              fullWidth size="small" autoComplete="off" placeholder="Ej: Consorcio Palermo Norte"
              value={query} onChange={handleChange}
              InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: 18, color: TEXT_MUTED, mr: 1 }} /> }}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px', fontSize: '0.875rem',
                  '& fieldset': { borderColor: BORDER_STRONG, borderWidth: '1.5px' },
                  '&:hover fieldset': { borderColor: BORDER_STRONG },
                  '&.Mui-focused fieldset': { borderColor: ORANGE, borderWidth: '1.5px' },
                  '&.Mui-focused': { boxShadow: RING_ACCENT, borderRadius: '12px' },
                },
              }}
            />

            {loading && (
              <Box display="flex" justifyContent="center" py={3}>
                <CircularProgress size={22} sx={{ color: ORANGE }} />
              </Box>
            )}

            {!loading && buscado && resultados.length === 0 && (
              <Typography sx={{ fontSize: '0.82rem', color: TEXT_MUTED, textAlign: 'center', py: 2 }}>
                No encontramos ningún consorcio o inmobiliaria con ese nombre.
              </Typography>
            )}

            {!loading && resultados.map((cliente, i) => (
              <Box
                key={cliente.id}
                onClick={() => irAlPortal(cliente)}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  py: 1.25, cursor: 'pointer',
                  borderBottom: i === resultados.length - 1 ? 'none' : `1px solid ${BORDER}`,
                  '&:hover': { bgcolor: SURFACE_SUNKEN },
                }}
              >
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: GREEN_900 }}>
                  {cliente.nombre}
                </Typography>
                <ChevronRightIcon sx={{ fontSize: 18, color: TEXT_MUTED }} />
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box display="flex" flexDirection="column" alignItems="center" pb={4}>
        <Box component="img" src="/logo.svg" alt="Granito" sx={{ height: 26, width: 26, objectFit: 'contain', mb: 0.5 }} />
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: GREEN_900, letterSpacing: '-0.01em' }}>
          granito
        </Typography>
      </Box>
    </Box>
  )
}
