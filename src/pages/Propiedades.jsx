import { useEffect, useMemo, useState } from 'react'
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Alert, CircularProgress, Button,
  TextField, Select, MenuItem, FormControl, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Pagination,
  InputAdornment, Switch, FormControlLabel, Snackbar,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import VisibilityIcon from '@mui/icons-material/Visibility'
import EditIcon from '@mui/icons-material/Edit'
import BlockIcon from '@mui/icons-material/Block'
import SellIcon from '@mui/icons-material/Sell'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import PropiedadFormDrawer from '../components/PropiedadFormDrawer'
import PropiedadDetalleDrawer from '../components/PropiedadDetalleDrawer'
import { getPropiedades, darDeBajaPropiedad, reactivarPropiedad } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

const ACCENT       = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'

const TIPOS   = ['Casa', 'Departamento', 'Terreno', 'Local', 'Oficina']
const ESTADOS = ['Disponible', 'Reservada', 'Vendida', 'Baja']

const ESTADO_STYLES = {
  Disponible: { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
  Reservada:  { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  Vendida:    { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  Baja:       { bg: '#F1F5F9', color: '#94A3B8', border: '#E2E8F0' },
}

const TIPO_STYLES = {
  Casa:         { bg: '#ECFDF5', color: '#065F46' },
  Departamento: { bg: '#EFF6FF', color: '#1D4ED8' },
  Terreno:      { bg: '#FFFBEB', color: '#92400E' },
  Local:        { bg: '#F5F3FF', color: '#6D28D9' },
  Oficina:      { bg: '#FDF2F8', color: '#9D174D' },
}

const ROWS_PER_PAGE = 15

function fmt(value, moneda) {
  if (!value && value !== 0) return '—'
  const n = Number(value).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return moneda ? `${moneda} ${n}` : n
}

function fmtDate(d) {
  if (!d) return '—'
  const s = d.includes('T') ? d.split('T')[0] : d
  const [y, m, day] = s.split('-')
  return `${day}/${m}/${y}`
}

function EstadoBadge({ estado }) {
  const s = ESTADO_STYLES[estado] ?? ESTADO_STYLES.Disponible
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.6,
      bgcolor: s.bg, border: `1px solid ${s.border}`, borderRadius: '20px', px: 1.25, py: 0.4,
    }}>
      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: s.color }} />
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: s.color, letterSpacing: '0.04em' }}>
        {estado}
      </Typography>
    </Box>
  )
}

function TipoBadge({ tipo }) {
  const s = TIPO_STYLES[tipo] ?? { bg: '#F1F5F9', color: '#6B7280' }
  return (
    <Box sx={{
      display: 'inline-block', bgcolor: s.bg, borderRadius: '6px',
      px: 1, py: 0.25,
    }}>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: s.color }}>
        {tipo}
      </Typography>
    </Box>
  )
}

const selectSx = {
  fontSize: '0.82rem', borderRadius: '8px', bgcolor: 'white',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
}

export default function Propiedades() {
  const { user, clienteId } = useAuth()
  const isAdmin = user?.rol?.toLowerCase() === 'admin'

  const [propiedades, setPropiedades] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [snackMsg, setSnackMsg]       = useState('')

  // Filtros
  const [search, setSearch]               = useState('')
  const [filtroTipo, setFiltroTipo]       = useState('')
  const [filtroEstado, setFiltroEstado]   = useState('')
  const [filtroProv, setFiltroProv]       = useState('')
  const [precioMin, setPrecioMin]         = useState('')
  const [precioMax, setPrecioMax]         = useState('')
  const [includeBaja, setIncludeBaja]     = useState(false)

  // Ordenamiento
  const [sortBy, setSortBy]   = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  // Paginación
  const [page, setPage] = useState(1)

  // Drawers
  const [formOpen, setFormOpen]           = useState(false)
  const [formMode, setFormMode]           = useState('create')
  const [editTarget, setEditTarget]       = useState(null)
  const [detalleOpen, setDetalleOpen]     = useState(false)
  const [detalleTarget, setDetalleTarget] = useState(null)

  // Baja dialog
  const [bajaOpen, setBajaOpen]     = useState(false)
  const [bajaTarget, setBajaTarget] = useState(null)
  const [bajaLoading, setBajaLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await getPropiedades({ includeBaja, cliente_id: clienteId })
      setPropiedades(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [includeBaja])

  // ── Filtrado + ordenamiento ────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let list = propiedades.filter(p => {
      if (q && !`${p.titulo} ${p.direccion} ${p.localidad} ${p.id}`.toLowerCase().includes(q)) return false
      if (filtroTipo  && p.tipo_propiedad !== filtroTipo)  return false
      if (filtroEstado && p.estado !== filtroEstado)        return false
      if (filtroProv  && p.provincia !== filtroProv)        return false
      if (precioMin   && Number(p.precio_publicacion) < Number(precioMin)) return false
      if (precioMax   && Number(p.precio_publicacion) > Number(precioMax)) return false
      return true
    })

    list.sort((a, b) => {
      const va = sortBy === 'precio_publicacion' ? Number(a[sortBy]) : new Date(a[sortBy]).getTime()
      const vb = sortBy === 'precio_publicacion' ? Number(b[sortBy]) : new Date(b[sortBy]).getTime()
      return sortDir === 'asc' ? va - vb : vb - va
    })

    return list
  }, [propiedades, search, filtroTipo, filtroEstado, filtroProv, precioMin, precioMax, sortBy, sortDir])

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE)
  const pageData = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
    setPage(1)
  }

  function SortIcon({ col }) {
    if (sortBy !== col) return null
    return sortDir === 'asc'
      ? <ArrowUpwardIcon sx={{ fontSize: 12, ml: 0.5 }} />
      : <ArrowDownwardIcon sx={{ fontSize: 12, ml: 0.5 }} />
  }

  // ── Acciones ──────────────────────────────────────────────────────────────

  function openCreate() { setFormMode('create'); setEditTarget(null); setFormOpen(true) }

  function openEdit(p, e) {
    e?.stopPropagation()
    setFormMode('edit'); setEditTarget(p); setFormOpen(true)
    setDetalleOpen(false)
  }

  function openDetalle(p) { setDetalleTarget(p); setDetalleOpen(true) }

  function openBaja(p, e) {
    e?.stopPropagation()
    setBajaTarget(p); setBajaOpen(true)
    setDetalleOpen(false)
  }

  async function confirmBaja() {
    if (!bajaTarget) return
    setBajaLoading(true)
    try {
      await darDeBajaPropiedad(bajaTarget.id)
      setSnackMsg(`"${bajaTarget.titulo}" fue dada de baja.`)
      setBajaOpen(false)
      setBajaTarget(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBajaLoading(false)
    }
  }

  async function handleReactivar() {
    if (!detalleTarget) return
    try {
      await reactivarPropiedad(detalleTarget.id)
      setSnackMsg(`"${detalleTarget.titulo}" fue reactivada.`)
      setDetalleOpen(false)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  function handleSaved(saved) {
    setSnackMsg(`Propiedad "${saved.titulo}" guardada correctamente.`)
    load()
  }

  // Provincias únicas de los datos
  const provincias = useMemo(() => [...new Set(propiedades.map(p => p.provincia).filter(Boolean))].sort(), [propiedades])

  const activeFilters = [search, filtroTipo, filtroEstado, filtroProv, precioMin, precioMax].filter(Boolean).length

  function clearFilters() {
    setSearch(''); setFiltroTipo(''); setFiltroEstado(''); setFiltroProv('')
    setPrecioMin(''); setPrecioMax(''); setPage(1)
  }

  if (loading && propiedades.length === 0) return (
    <Box display="flex" justifyContent="center" mt={6}><CircularProgress sx={{ color: ACCENT }} /></Box>
  )
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box pb={6}>
      {/* ── Header ── */}
      <Box display="flex" alignItems="flex-end" justifyContent="space-between" mb={4}>
        <Box>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: ACCENT, mb: 0.5 }}>
            CRM Inmobiliaria
          </Typography>
          <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Propiedades
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          sx={{
            bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
            fontWeight: 600, fontSize: '0.82rem', px: 2, py: 1,
            boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
          }}
        >
          Nueva propiedad
        </Button>
      </Box>

      {/* ── Filtros ── */}
      <Paper variant="outlined" sx={{ borderRadius: '12px', p: 2, mb: 2.5, border: '1px solid #E5E7EB', bgcolor: 'white' }}>
        <Box display="flex" gap={1.5} flexWrap="wrap" alignItems="center">
          {/* Búsqueda */}
          <TextField
            size="small"
            placeholder="Buscar por título, dirección, localidad..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 17, color: '#9CA3AF' }} /></InputAdornment>,
              },
            }}
            sx={{
              minWidth: 280, flex: 1,
              '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.82rem', bgcolor: 'white', '& fieldset': { borderColor: '#E5E7EB' }, '&:hover fieldset': { borderColor: ACCENT }, '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 } },
            }}
          />

          {/* Tipo */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select value={filtroTipo} displayEmpty onChange={e => { setFiltroTipo(e.target.value); setPage(1) }} sx={selectSx}>
              <MenuItem value="" sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>Tipo</MenuItem>
              {TIPOS.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '0.82rem' }}>{t}</MenuItem>)}
            </Select>
          </FormControl>

          {/* Estado */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select value={filtroEstado} displayEmpty onChange={e => { setFiltroEstado(e.target.value); setPage(1) }} sx={selectSx}>
              <MenuItem value="" sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>Estado</MenuItem>
              {ESTADOS.filter(e => includeBaja || e !== 'Baja').map(s => (
                <MenuItem key={s} value={s} sx={{ fontSize: '0.82rem' }}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Provincia */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select value={filtroProv} displayEmpty onChange={e => { setFiltroProv(e.target.value); setPage(1) }} sx={selectSx}>
              <MenuItem value="" sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>Provincia</MenuItem>
              {provincias.map(p => <MenuItem key={p} value={p} sx={{ fontSize: '0.82rem' }}>{p}</MenuItem>)}
            </Select>
          </FormControl>

          {/* Precio rango */}
          <TextField
            size="small" type="number" placeholder="Precio mín"
            value={precioMin} onChange={e => { setPrecioMin(e.target.value); setPage(1) }}
            sx={{ width: 110, '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.82rem', bgcolor: 'white', '& fieldset': { borderColor: '#E5E7EB' }, '&:hover fieldset': { borderColor: ACCENT } } }}
          />
          <TextField
            size="small" type="number" placeholder="Precio máx"
            value={precioMax} onChange={e => { setPrecioMax(e.target.value); setPage(1) }}
            sx={{ width: 110, '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.82rem', bgcolor: 'white', '& fieldset': { borderColor: '#E5E7EB' }, '&:hover fieldset': { borderColor: ACCENT } } }}
          />

          {activeFilters > 0 && (
            <Button size="small" onClick={clearFilters}
              sx={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'none', borderRadius: '7px', px: 1.5, '&:hover': { bgcolor: '#F3F4F6' } }}>
              Limpiar ({activeFilters})
            </Button>
          )}
        </Box>

        {/* Segunda fila */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mt={1.5}>
          {isAdmin && (
            <FormControlLabel
              control={
                <Switch
                  checked={includeBaja}
                  onChange={e => { setIncludeBaja(e.target.checked); setPage(1) }}
                  size="small"
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }}
                />
              }
              label={<Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>Incluir dadas de baja</Typography>}
            />
          )}
          <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', ml: 'auto' }}>
            {filtered.length} propiedad{filtered.length !== 1 ? 'es' : ''}
          </Typography>
        </Box>
      </Paper>

      {/* ── Tabla ── */}
      <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                {[
                  { label: 'Título',   col: null },
                  { label: 'Dirección',col: null },
                  { label: 'Tipo',     col: null },
                  { label: 'Precio',   col: 'precio_publicacion' },
                  { label: 'Estado',   col: null },
                  { label: 'Alta',     col: 'created_at' },
                  { label: '',         col: null },
                ].map(({ label, col }, i) => (
                  <TableCell
                    key={i}
                    onClick={col ? () => toggleSort(col) : undefined}
                    sx={{
                      fontWeight: 700, fontSize: '0.72rem', color: '#6B7280',
                      letterSpacing: '0.05em', textTransform: 'uppercase',
                      py: 1.5, borderBottom: '1px solid #E5E7EB',
                      cursor: col ? 'pointer' : 'default',
                      userSelect: 'none',
                      '&:hover': col ? { color: ACCENT } : {},
                    }}
                  >
                    <Box display="flex" alignItems="center">
                      {label}
                      {col && <SortIcon col={col} />}
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {pageData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 8, textAlign: 'center', border: 0 }}>
                    <SellIcon sx={{ fontSize: 32, color: '#E5E7EB', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
                      {search || activeFilters > 0 ? 'No se encontraron propiedades con esos filtros.' : 'No hay propiedades registradas.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                pageData.map(p => {
                  const isBaja = p.estado === 'Baja'
                  return (
                    <TableRow
                      key={p.id}
                      onClick={() => openDetalle(p)}
                      sx={{
                        cursor: 'pointer',
                        opacity: isBaja ? 0.6 : 1,
                        '&:last-child td': { border: 0 },
                        '& td': { borderBottom: '1px solid #F3F4F6' },
                        '&:hover': { bgcolor: '#F9FAFB', '& .row-actions': { opacity: 1 } },
                      }}
                    >
                      {/* Título */}
                      <TableCell sx={{ py: 1.5, maxWidth: 200 }}>
                        <Typography sx={{
                          fontSize: '0.875rem', fontWeight: 600, color: '#111827',
                          textDecoration: isBaja ? 'line-through' : 'none',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {p.titulo}
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
                          {p.localidad}, {p.provincia}
                        </Typography>
                      </TableCell>

                      {/* Dirección */}
                      <TableCell sx={{ py: 1.5, maxWidth: 160 }}>
                        <Typography sx={{ fontSize: '0.82rem', color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.direccion}
                        </Typography>
                      </TableCell>

                      {/* Tipo */}
                      <TableCell sx={{ py: 1.5 }}>
                        <TipoBadge tipo={p.tipo_propiedad} />
                      </TableCell>

                      {/* Precio */}
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(p.precio_publicacion, p.moneda)}
                        </Typography>
                      </TableCell>

                      {/* Estado */}
                      <TableCell sx={{ py: 1.5 }}>
                        <EstadoBadge estado={p.estado} />
                      </TableCell>

                      {/* Fecha alta */}
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>
                          {fmtDate(p.created_at)}
                        </Typography>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell align="right" sx={{ py: 1.5, pr: 2 }}>
                        <Box className="row-actions" sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          <Tooltip title="Ver detalle">
                            <IconButton size="small" onClick={e => { e.stopPropagation(); openDetalle(p) }}
                              sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
                              <VisibilityIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          {!isBaja && (
                            <Tooltip title="Editar">
                              <IconButton size="small" onClick={e => openEdit(p, e)}
                                sx={{ color: '#9CA3AF', '&:hover': { color: '#1D4ED8' } }}>
                                <EditIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          {isAdmin && !isBaja && (
                            <Tooltip title="Dar de baja">
                              <IconButton size="small" onClick={e => openBaja(p, e)}
                                sx={{ color: '#9CA3AF', '&:hover': { color: '#EF4444' } }}>
                                <BlockIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Paginación */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, v) => setPage(v)}
            size="small"
            sx={{
              '& .MuiPaginationItem-root': { fontSize: '0.8rem', borderRadius: '6px' },
              '& .Mui-selected': { bgcolor: ACCENT_LIGHT, color: ACCENT, fontWeight: 700, border: `1px solid #A7F3D0` },
            }}
          />
        </Box>
      )}

      {/* ── Drawers ── */}
      <PropiedadFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        mode={formMode}
        propiedad={editTarget}
        onSaved={handleSaved}
        clienteId={clienteId}
      />

      <PropiedadDetalleDrawer
        open={detalleOpen}
        onClose={() => setDetalleOpen(false)}
        propiedad={detalleTarget}
        onEdit={() => openEdit(detalleTarget)}
        onBaja={() => openBaja(detalleTarget)}
        onReactivar={handleReactivar}
        userRole={user?.rol}
      />

      {/* ── Dialog Baja ── */}
      <Dialog
        open={bajaOpen}
        onClose={() => !bajaLoading && setBajaOpen(false)}
        PaperProps={{ sx: { borderRadius: '12px', p: 1, maxWidth: 420 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>
          Confirmar baja
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.875rem', color: '#6B7280' }}>
            ¿Dar de baja la propiedad <strong style={{ color: '#111827' }}>"{bajaTarget?.titulo}"</strong>?
            Esta acción puede revertirse editando su estado.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setBajaOpen(false)}
            disabled={bajaLoading}
            sx={{ textTransform: 'none', fontWeight: 500, fontSize: '0.82rem', color: '#6B7280', borderRadius: '8px', '&:hover': { bgcolor: '#F9FAFB' } }}
          >
            Cancelar
          </Button>
          <Button
            onClick={confirmBaja}
            disabled={bajaLoading}
            startIcon={bajaLoading ? <CircularProgress size={14} color="inherit" /> : <BlockIcon sx={{ fontSize: 15 }} />}
            sx={{
              bgcolor: '#EF4444', color: 'white', textTransform: 'none', fontWeight: 600,
              fontSize: '0.82rem', borderRadius: '8px', boxShadow: 'none',
              '&:hover': { bgcolor: '#DC2626', boxShadow: 'none' },
            }}
          >
            {bajaLoading ? 'Procesando...' : 'Confirmar baja'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackMsg}
        autoHideDuration={3500}
        onClose={() => setSnackMsg('')}
        message={snackMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
