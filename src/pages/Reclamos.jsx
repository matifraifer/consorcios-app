import { useEffect, useMemo, useState } from 'react'
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Alert, CircularProgress,
  TextField, InputAdornment, Snackbar,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import { getReclamos } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'
import EstadoReclamoBadge, { ESTADOS_RECLAMO, ESTADO_RECLAMO_STYLES } from '../components/reclamos/EstadoReclamoBadge'
import ReclamoFormDrawer from '../components/reclamos/ReclamoFormDrawer'
import ReclamoDetalleDrawer from '../components/reclamos/ReclamoDetalleDrawer'

const ACCENT = '#065F46'

const FILTROS = [
  { value: '', label: 'Todos', color: ACCENT, bg: '#ECFDF5' },
  ...ESTADOS_RECLAMO.map(e => ({ value: e, label: ESTADO_RECLAMO_STYLES[e].label, color: ESTADO_RECLAMO_STYLES[e].color, bg: ESTADO_RECLAMO_STYLES[e].bg })),
]

function formatFecha(fecha) {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

function ReclamoIcon({ estado }) {
  const s = ESTADO_RECLAMO_STYLES[estado] ?? ESTADO_RECLAMO_STYLES.pendiente
  return (
    <Box
      sx={{
        width: 32, height: 32, borderRadius: '8px', bgcolor: s.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
    >
      <ReportProblemIcon sx={{ fontSize: 16, color: s.color }} />
    </Box>
  )
}

export default function Reclamos() {
  const [reclamos, setReclamos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { clienteId } = useAuth()

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [detalleId, setDetalleId] = useState(null)
  const [snackMsg, setSnackMsg] = useState('')

  function reload() {
    setLoading(true)
    return getReclamos(clienteId)
      .then(setReclamos)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [clienteId])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return reclamos.filter(r => {
      if (filtroEstado && r.estado !== filtroEstado) return false
      if (!q) return true
      const texto = [
        r.descripcion,
        r.propietarios ? `${r.propietarios.apellido} ${r.propietarios.nombre}` : '',
        r.consorcios?.nombre,
        r.departamentos?.numeracion,
      ].filter(Boolean).join(' ').toLowerCase()
      return texto.includes(q)
    })
  }, [reclamos, busqueda, filtroEstado])

  function handleCreated() {
    setNuevoOpen(false)
    setSnackMsg('Reclamo creado exitosamente')
    reload()
  }

  function handleUpdated() {
    setSnackMsg('Reclamo actualizado exitosamente')
    reload()
  }

  if (loading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress sx={{ color: ACCENT }} /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box pb={6}>
      {/* Header */}
      <Box display="flex" alignItems="flex-end" justifyContent="space-between" mb={4}>
        <Box>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: ACCENT, mb: 0.5 }}>
            Soporte
          </Typography>
          <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Reclamos
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setNuevoOpen(true)}
          sx={{
            bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
            fontWeight: 600, fontSize: '0.82rem', px: 2, py: 1,
            boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
          }}
        >
          Nuevo reclamo
        </Button>
      </Box>

      {/* Toolbar: buscador + filtros por estado + contador */}
      <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} mb={2}>
        <Box display="flex" alignItems="center" flexWrap="wrap" gap={1.25}>
          <TextField
            size="small"
            placeholder="Buscar reclamo..."
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

          <Box display="flex" gap={0.75}>
            {FILTROS.map(f => {
              const active = filtroEstado === f.value
              return (
                <Box
                  key={f.value || 'todos'}
                  onClick={() => setFiltroEstado(f.value)}
                  sx={{
                    px: 1.5, py: 0.6, borderRadius: '20px', cursor: 'pointer',
                    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em',
                    border: `1px solid ${active ? f.color : '#E5E7EB'}`,
                    bgcolor: active ? f.bg : 'white',
                    color: active ? f.color : '#6B7280',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: f.color, color: f.color },
                  }}
                >
                  {f.label}
                </Box>
              )
            })}
          </Box>
        </Box>

        <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
          {filtrados.length} de {reclamos.length} reclamo{reclamos.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* Tabla */}
      <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                  Reclamo
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                  Consorcio
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                  Unidad
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                  Estado
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                  Fecha
                </TableCell>
                <TableCell sx={{ borderBottom: '1px solid #E5E7EB' }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 8, textAlign: 'center', border: 0 }}>
                    <ReportProblemIcon sx={{ fontSize: 32, color: '#E5E7EB', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
                      {busqueda || filtroEstado ? 'No se encontraron reclamos.' : 'No hay reclamos registrados.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map(r => (
                  <TableRow
                    key={r.id}
                    onClick={() => setDetalleId(r.id)}
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
                    <TableCell sx={{ py: 1.5, maxWidth: 300 }}>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <ReclamoIcon estado={r.estado} />
                        <Box minWidth={0}>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                            {r.propietarios ? `${r.propietarios.apellido}, ${r.propietarios.nombre}` : 'Sin propietario'}
                          </Typography>
                          <Typography noWrap sx={{ fontSize: '0.75rem', color: '#9CA3AF', maxWidth: 230 }}>
                            {r.descripcion}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.82rem', color: '#374151' }}>{r.consorcios?.nombre ?? '—'}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>{r.departamentos?.numeracion ?? '—'}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <EstadoReclamoBadge estado={r.estado} />
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>{formatFecha(r.fecha)}</Typography>
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

      <ReclamoFormDrawer
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        onCreated={handleCreated}
      />

      <ReclamoDetalleDrawer
        id={detalleId}
        open={detalleId != null}
        onClose={() => setDetalleId(null)}
        onUpdated={handleUpdated}
      />

      <Snackbar
        open={!!snackMsg}
        autoHideDuration={3000}
        onClose={() => setSnackMsg('')}
        message={snackMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
