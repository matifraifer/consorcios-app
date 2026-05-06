import { useEffect, useMemo, useState } from 'react'
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Alert, CircularProgress, Button, TextField,
  Select, MenuItem, FormControl, IconButton, Tooltip, Snackbar,
  InputAdornment,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import VisibilityIcon from '@mui/icons-material/Visibility'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import TuneIcon from '@mui/icons-material/Tune'
import DescriptionIcon from '@mui/icons-material/Description'
import { getContratos, getIndicesActualizacion } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'
import ContratoFormDrawer from '../components/contratos/ContratoFormDrawer'
import ContratoDetalleDrawer from '../components/contratos/ContratoDetalleDrawer'
import IndicesDialog from '../components/contratos/IndicesDialog'

const ACCENT = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function getEstado(contrato) {
  if (contrato.finalizado) return 'Finalizado'
  const today = new Date()
  const fin = new Date(contrato.fecha_fin + 'T23:59:59')
  return fin >= today ? 'Vigente' : 'Vencido'
}

const ESTADO_STYLES = {
  Vigente:    { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
  Vencido:    { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  Finalizado: { bg: '#F1F5F9', color: '#94A3B8', border: '#E2E8F0' },
}

function EstadoBadge({ estado }) {
  const s = ESTADO_STYLES[estado] ?? ESTADO_STYLES.Vigente
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, bgcolor: s.bg, border: `1px solid ${s.border}`, borderRadius: '20px', px: 1.25, py: 0.4 }}>
      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: s.color }} />
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: s.color, letterSpacing: '0.04em' }}>{estado}</Typography>
    </Box>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = (d.includes('T') ? d.split('T')[0] : d).split('-')
  return `${day}/${m}/${y}`
}

function fmt(value) {
  if (!value && value !== 0) return '—'
  return Number(value).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const selectSx = {
  fontSize: '0.82rem', borderRadius: '8px', bgcolor: 'white',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
}

export default function Contratos() {
  const { clienteId, user } = useAuth()
  const isAdmin = user?.rol?.toLowerCase() === 'admin'

  const [contratos, setContratos] = useState([])
  const [indices, setIndices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [snackMsg, setSnackMsg] = useState('')

  // Filtros
  const [busqInquilino, setBusqInquilino] = useState('')
  const [busqPropietario, setBusqPropietario] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')

  // Drawers / Dialogs
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [detalleTarget, setDetalleTarget] = useState(null)
  const [indicesOpen, setIndicesOpen] = useState(false)

  async function load() {
    try {
      const [data, idx] = await Promise.all([getContratos(clienteId), getIndicesActualizacion(clienteId)])
      setContratos(data)
      setIndices(idx)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return contratos.filter(c => {
      const estado = getEstado(c)
      const inquilino = `${c.inquilino_nombre} ${c.inquilino_apellido}`.toLowerCase()
      const propietario = `${c.propietario_nombre} ${c.propietario_apellido}`.toLowerCase()

      if (busqInquilino && !inquilino.includes(busqInquilino.toLowerCase())) return false
      if (busqPropietario && !propietario.includes(busqPropietario.toLowerCase())) return false
      if (filtroEstado && estado !== filtroEstado) return false
      if (filtroFechaDesde && c.fecha_fin < filtroFechaDesde) return false
      if (filtroFechaHasta && c.fecha_inicio > filtroFechaHasta) return false
      return true
    })
  }, [contratos, busqInquilino, busqPropietario, filtroEstado, filtroFechaDesde, filtroFechaHasta])

  function handleSaved(contrato) {
    setContratos(prev => [contrato, ...prev])
    setSnackMsg(`Contrato de "${contrato.inquilino_nombre} ${contrato.inquilino_apellido}" creado.`)
  }

  function handleUpdated(contrato) {
    setContratos(prev => prev.map(c => c.id === contrato.id ? { ...c, ...contrato } : c))
    setDetalleTarget(prev => prev?.id === contrato.id ? { ...prev, ...contrato } : prev)
    setEditTarget(null)
    setSnackMsg('Contrato actualizado.')
  }

  function handleEdit(contrato) {
    setEditTarget(contrato)
  }

  function handleFinalizado(updated) {
    setContratos(prev => prev.map(c => c.id === updated.id ? { ...c, finalizado: true } : c))
    setDetalleTarget(prev => prev ? { ...prev, finalizado: true } : null)
    setSnackMsg('Contrato finalizado.')
  }

  const activeFilters = [busqInquilino, busqPropietario, filtroEstado, filtroFechaDesde, filtroFechaHasta].filter(Boolean).length

  if (loading) return <Box display="flex" justifyContent="center" mt={6}><CircularProgress sx={{ color: ACCENT }} /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box pb={6}>
      {/* Header */}
      <Box display="flex" alignItems="flex-end" justifyContent="space-between" mb={4}>
        <Box>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: ACCENT, mb: 0.5 }}>
            Gestión de contratos
          </Typography>
          <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Contratos
          </Typography>
        </Box>
        <Box display="flex" gap={1.5}>
          {isAdmin && (
            <Tooltip title="Gestionar índices IPC / ICL">
              <Button
                variant="outlined"
                startIcon={<TuneIcon sx={{ fontSize: 16 }} />}
                onClick={() => setIndicesOpen(true)}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280', '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: ACCENT_LIGHT } }}
              >
                Índices
              </Button>
            </Tooltip>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setFormOpen(true)}
            sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', px: 2, py: 1, boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
          >
            Nuevo contrato
          </Button>
        </Box>
      </Box>

      {/* Filtros */}
      <Paper variant="outlined" sx={{ borderRadius: '12px', p: 2, mb: 2.5, border: '1px solid #E5E7EB', bgcolor: 'white' }}>
        <Box display="flex" gap={1.5} flexWrap="wrap" alignItems="center">
          <TextField
            size="small" placeholder="Buscar inquilino..."
            value={busqInquilino} onChange={e => setBusqInquilino(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 17, color: '#9CA3AF' }} /></InputAdornment> } }}
            sx={{ minWidth: 200, flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.82rem', bgcolor: 'white', '& fieldset': { borderColor: '#E5E7EB' }, '&:hover fieldset': { borderColor: ACCENT }, '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 } } }}
          />
          <TextField
            size="small" placeholder="Buscar propietario..."
            value={busqPropietario} onChange={e => setBusqPropietario(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 17, color: '#9CA3AF' }} /></InputAdornment> } }}
            sx={{ minWidth: 200, flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.82rem', bgcolor: 'white', '& fieldset': { borderColor: '#E5E7EB' }, '&:hover fieldset': { borderColor: ACCENT }, '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 } } }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select value={filtroEstado} displayEmpty onChange={e => setFiltroEstado(e.target.value)} sx={selectSx}>
              <MenuItem value="" sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>Estado</MenuItem>
              {['Vigente', 'Vencido', 'Finalizado'].map(e => <MenuItem key={e} value={e} sx={{ fontSize: '0.82rem' }}>{e}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            size="small" type="date" label="Vigencia desde"
            value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 160, '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.82rem', '& fieldset': { borderColor: '#E5E7EB' }, '&:hover fieldset': { borderColor: ACCENT } } }}
          />
          <TextField
            size="small" type="date" label="Vigencia hasta"
            value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 160, '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.82rem', '& fieldset': { borderColor: '#E5E7EB' }, '&:hover fieldset': { borderColor: ACCENT } } }}
          />
          {activeFilters > 0 && (
            <Button size="small"
              onClick={() => { setBusqInquilino(''); setBusqPropietario(''); setFiltroEstado(''); setFiltroFechaDesde(''); setFiltroFechaHasta('') }}
              sx={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'none', borderRadius: '7px', px: 1.5, '&:hover': { bgcolor: '#F3F4F6' } }}>
              Limpiar ({activeFilters})
            </Button>
          )}
        </Box>
        <Box display="flex" justifyContent="flex-end" mt={1}>
          <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
            {filtered.length} contrato{filtered.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Paper>

      {/* Tabla */}
      <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                {['Inquilino', 'Propietario', 'Propiedad', 'Inicio', 'Fin', 'Estado', 'Monto', ''].map((label, i) => (
                  <TableCell key={i} sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 8, textAlign: 'center', border: 0 }}>
                    <DescriptionIcon sx={{ fontSize: 32, color: '#E5E7EB', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
                      {activeFilters > 0 ? 'No se encontraron contratos con esos filtros.' : 'No hay contratos registrados.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filtered.map(c => {
                const estado = getEstado(c)
                return (
                  <TableRow
                    key={c.id}
                    onClick={() => setDetalleTarget(c)}
                    sx={{ cursor: 'pointer', '&:last-child td': { border: 0 }, '& td': { borderBottom: '1px solid #F3F4F6' }, '&:hover': { bgcolor: '#F9FAFB', '& .row-actions': { opacity: 1 } } }}
                  >
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                        {c.inquilino_apellido}, {c.inquilino_nombre}
                      </Typography>
                      {c.inquilino_dni && <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>DNI {c.inquilino_dni}</Typography>}
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.82rem', color: '#374151' }}>
                        {c.propietario_apellido}, {c.propietario_nombre}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5, maxWidth: 160 }}>
                      <Typography sx={{ fontSize: '0.82rem', color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.propiedades?.titulo ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.78rem', color: '#6B7280' }}>{fmtDate(c.fecha_inicio)}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.78rem', color: '#6B7280' }}>{fmtDate(c.fecha_fin)}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}><EstadoBadge estado={estado} /></TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                        $ {fmt(c.monto_base)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5, pr: 2 }}>
                      <Box className="row-actions" sx={{ opacity: 0, transition: 'opacity 0.15s', display: 'flex', justifyContent: 'flex-end' }}>
                        <Tooltip title="Ver detalle">
                          <IconButton size="small" onClick={e => { e.stopPropagation(); setDetalleTarget(c) }} sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
                            <VisibilityIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        {!c.finalizado && (
                          <Tooltip title="Editar contrato">
                            <IconButton size="small" onClick={e => { e.stopPropagation(); handleEdit(c) }} sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
                              <EditOutlinedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <ContratoFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        clienteId={clienteId}
        onSaved={handleSaved}
      />

      <ContratoFormDrawer
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        clienteId={clienteId}
        mode="edit"
        contrato={editTarget}
        onSaved={handleUpdated}
      />

      <ContratoDetalleDrawer
        open={!!detalleTarget}
        onClose={() => setDetalleTarget(null)}
        contrato={detalleTarget}
        indices={indices}
        userRole={user?.rol}
        onFinalizado={handleFinalizado}
      />

      <IndicesDialog
        open={indicesOpen}
        onClose={() => setIndicesOpen(false)}
        indices={indices}
        onIndicesChange={setIndices}
        clienteId={clienteId}
      />

      <Snackbar open={!!snackMsg} autoHideDuration={3500} onClose={() => setSnackMsg('')} message={snackMsg} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  )
}
