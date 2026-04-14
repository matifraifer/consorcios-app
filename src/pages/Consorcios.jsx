import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Drawer,
  Divider,
  IconButton,
  TextField,
  Snackbar,
  InputAdornment,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import ApartmentIcon from '@mui/icons-material/Apartment'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import SearchIcon from '@mui/icons-material/Search'
import { getConsorcios, createConsorcio } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

const ACCENT = '#065F46'

const AVATAR_COLORS = [
  { bg: '#ECFDF5', color: '#065F46' },
  { bg: '#EFF6FF', color: '#1D4ED8' },
  { bg: '#FFF7ED', color: '#C2410C' },
  { bg: '#F5F3FF', color: '#6D28D9' },
  { bg: '#FDF2F8', color: '#9D174D' },
  { bg: '#FFFBEB', color: '#92400E' },
]

function getAvatarColor(nombre) {
  return AVATAR_COLORS[(nombre?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]
}

function ConsorcioAvatar({ nombre }) {
  const { bg, color } = getAvatarColor(nombre)
  return (
    <Box
      sx={{
        width: 32,
        height: 32,
        borderRadius: '8px',
        bgcolor: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color }}>
        {(nombre ?? 'C')[0].toUpperCase()}
      </Typography>
    </Box>
  )
}

export default function Consorcios() {
  const { clienteId } = useAuth()
  const navigate = useNavigate()

  const [consorcios, setConsorcios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  // Drawer nuevo
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    getConsorcios(clienteId)
      .then(setConsorcios)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [clienteId])

  function openNuevo() {
    setNombre('')
    setFormError(null)
    setNuevoOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    setSaving(true)
    setFormError(null)
    try {
      await createConsorcio({ nombre: nombre.trim(), cliente_id: clienteId })
      setSuccess(true)
      setNuevoOpen(false)
      setLoading(true)
      const data = await getConsorcios(clienteId)
      setConsorcios(data)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  const filtrados = consorcios.filter(c =>
    c.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  )

  if (loading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress sx={{ color: ACCENT }} /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box pb={6}>
      {/* Header */}
      <Box display="flex" alignItems="flex-end" justifyContent="space-between" mb={4}>
        <Box>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: ACCENT, mb: 0.5 }}>
            Administracion
          </Typography>
          <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Consorcios
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openNuevo}
          sx={{
            bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
            fontWeight: 600, fontSize: '0.82rem', px: 2, py: 1,
            boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
          }}
        >
          Nuevo consorcio
        </Button>
      </Box>

      {/* Toolbar: buscador + contador */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <TextField
          size="small"
          placeholder="Buscar consorcio..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 17, color: '#9CA3AF' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            width: 260,
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px', fontSize: '0.82rem', bgcolor: 'white',
              '& fieldset': { borderColor: '#E5E7EB' },
              '&:hover fieldset': { borderColor: ACCENT },
              '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
            },
          }}
        />
        <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
          {filtrados.length} de {consorcios.length} consorcio{consorcios.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* Tabla */}
      <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                  Consorcio
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                  Administrador
                </TableCell>
                <TableCell sx={{ borderBottom: '1px solid #E5E7EB' }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} sx={{ py: 8, textAlign: 'center', border: 0 }}>
                    <ApartmentIcon sx={{ fontSize: 32, color: '#E5E7EB', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
                      {busqueda ? 'No se encontraron consorcios.' : 'No hay consorcios registrados.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map(c => (
                  <TableRow
                    key={c.id}
                    onClick={() => navigate(`/consorcios/${c.id}`)}
                    sx={{
                      cursor: 'pointer',
                      '&:last-child td': { border: 0 },
                      '& td': { borderBottom: '1px solid #F3F4F6' },
                      '&:hover': {
                        bgcolor: '#F9FAFB',
                        '& .row-arrow': { opacity: 1 },
                      },
                    }}
                  >
                    <TableCell sx={{ py: 1.5 }}>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <ConsorcioAvatar nombre={c.nombre} />
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                          {c.nombre}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>
                        {c.usuarios?.nombre_usuario ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5, pr: 2.5 }}>
                      <ArrowForwardIosIcon
                        className="row-arrow"
                        sx={{ fontSize: 12, color: ACCENT, opacity: 0, transition: 'opacity 0.15s' }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Drawer Nuevo Consorcio */}
      <Drawer
        anchor="right"
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        slotProps={{ paper: { sx: { width: 400, p: 3, bgcolor: 'white' } } }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Nuevo Consorcio</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>Completa el nombre del edificio</Typography>
          </Box>
          <IconButton size="small" onClick={() => setNuevoOpen(false)}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />

        {formError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{formError}</Alert>}

        <form onSubmit={handleSubmit}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 0.75 }}>
            Nombre del consorcio
          </Typography>
          <TextField
            fullWidth
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
            autoFocus
            placeholder="Ej: Edificio San Martin"
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px', fontSize: '0.875rem',
                '& fieldset': { borderColor: '#E5E7EB' },
                '&:hover fieldset': { borderColor: ACCENT },
                '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
              },
            }}
          />
          <Box mt={3} display="flex" gap={1.5}>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
              sx={{
                bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none',
                '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
              }}
            >
              {saving ? 'Guardando...' : 'Crear consorcio'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => setNuevoOpen(false)}
              sx={{
                borderRadius: '8px', textTransform: 'none', fontWeight: 500,
                fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280',
                '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' },
              }}
            >
              Cancelar
            </Button>
          </Box>
        </form>
      </Drawer>

      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={() => setSuccess(false)}
        message="Consorcio creado exitosamente"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
