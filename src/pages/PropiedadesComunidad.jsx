import { useEffect, useState, useMemo, useRef } from 'react'
import {
  Box, Typography, TextField, InputAdornment, Checkbox, FormControlLabel,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton, Tooltip,
  Drawer, CircularProgress, Divider, Avatar, Button, Pagination,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import PersonIcon from '@mui/icons-material/Person'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import TravelExploreIcon from '@mui/icons-material/TravelExplore'
import { useAuth } from '../contexts/AuthContext'
import { getPropiedadesExt, vincularContactosExt, getContactos } from '../services/supabase'

const ACCENT = '#065F46'
const PAGE_SIZE = 50

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    fontSize: '0.82rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: '#D1D5DB' },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}

function parsePrecio(texto) {
  if (!texto || texto.trim() === 'N/D' || texto.trim() === '') return { display: '—' }
  const esUSD = /USD|u\$s|dolar/i.test(texto)
  const num = Number(texto.replace(/[^\d]/g, '')) || null
  const display = num
    ? `${esUSD ? 'USD' : 'ARS'} ${num.toLocaleString('es-AR')}`
    : texto.trim()
  return { display }
}

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function ContactosBadge({ count }) {
  if (!count) return <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>—</Typography>
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.3, bgcolor: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '6px' }}>
      <PersonIcon sx={{ fontSize: 12, color: ACCENT }} />
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: ACCENT }}>
        {count} {count === 1 ? 'contacto' : 'contactos'}
      </Typography>
    </Box>
  )
}

export default function PropiedadesComunidad() {
  const { user } = useAuth()
  const clienteId = user?.cliente_id

  const [propiedades, setPropiedades] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  // Filtros (UI inmediata)
  const [busqueda, setBusqueda] = useState('')
  const [zonaFiltro, setZonaFiltro] = useState('')
  const [ocultarSinPrecio, setOcultarSinPrecio] = useState(false)

  // Filtros debounceados (disparan el fetch)
  const [dBusqueda, setDBusqueda] = useState('')
  const [dZona, setDZona] = useState('')
  const timerBusqueda = useRef(null)
  const timerZona = useRef(null)

  function handleBusqueda(val) {
    setBusqueda(val)
    clearTimeout(timerBusqueda.current)
    timerBusqueda.current = setTimeout(() => { setDBusqueda(val); setPage(0) }, 400)
  }

  function handleZona(val) {
    setZonaFiltro(val)
    clearTimeout(timerZona.current)
    timerZona.current = setTimeout(() => { setDZona(val); setPage(0) }, 400)
  }

  // Fetch paginado con filtros
  useEffect(() => {
    if (!clienteId) return
    setLoading(true)
    getPropiedadesExt({ titulo: dBusqueda, zona: dZona, ocultarSinPrecio, page, pageSize: PAGE_SIZE, clienteId })
      .then(({ data, count }) => { setPropiedades(data); setTotal(count) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clienteId, dBusqueda, dZona, ocultarSinPrecio, page])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Contactos — carga lazy al primer abrir del drawer
  const [contactos, setContactos] = useState([])
  const [loadingContactos, setLoadingContactos] = useState(false)
  const contactosCargados = useRef(false)

  const contactosMap = useMemo(() => {
    const m = {}
    contactos.forEach(c => { m[c.id] = c })
    return m
  }, [contactos])

  // Drawer vincular contactos
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerProp, setDrawerProp] = useState(null)
  const [contactoBusqueda, setContactoBusqueda] = useState('')
  const [vinculando, setVinculando] = useState(false)
  const [seleccionados, setSeleccionados] = useState(new Set())

  const contactosFiltrados = useMemo(() => {
    const q = contactoBusqueda.toLowerCase()
    if (!q) return contactos
    return contactos.filter(c =>
      `${c.nombre} ${c.apellido}`.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.telefono?.includes(q)
    )
  }, [contactos, contactoBusqueda])

  function abrirDrawer(prop) {
    const ids = (prop.contactos_propiedades_ext ?? []).map(r => r.contacto_id)
    setDrawerProp(prop)
    setSeleccionados(new Set(ids))
    setContactoBusqueda('')
    setDrawerOpen(true)
    if (!contactosCargados.current && clienteId) {
      setLoadingContactos(true)
      getContactos(clienteId)
        .then(data => { setContactos(data); contactosCargados.current = true })
        .catch(console.error)
        .finally(() => setLoadingContactos(false))
    }
  }

  function toggleContacto(id) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleGuardar() {
    if (!drawerProp) return
    setVinculando(true)
    try {
      const ids = [...seleccionados]
      await vincularContactosExt(drawerProp.id, ids, clienteId)
      setPropiedades(prev => prev.map(p =>
        p.id === drawerProp.id
          ? { ...p, contactos_propiedades_ext: ids.map(id => ({ contacto_id: id })) }
          : p
      ))
      setDrawerOpen(false)
    } catch (e) {
      console.error(e)
    } finally {
      setVinculando(false)
    }
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>

      {/* Header */}
      <Box display="flex" alignItems="center" gap={1.5} mb={3}>
        <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <TravelExploreIcon sx={{ fontSize: 19, color: ACCENT }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
            Propiedades externas
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
            Propiedades relevadas del mercado externo
          </Typography>
        </Box>
      </Box>

      {/* Filtros */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '2fr 1.4fr auto' },
        gap: 1.5,
        alignItems: 'center',
        mb: 2,
        p: 2,
        bgcolor: '#F9FAFB',
        borderRadius: '12px',
        border: '1px solid #E5E7EB',
      }}>
        <TextField
          size="small"
          placeholder="Buscar por título..."
          value={busqueda}
          onChange={e => handleBusqueda(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: '#9CA3AF' }} /></InputAdornment> }}
          sx={fieldSx}
        />
        <TextField
          size="small"
          placeholder="Filtrar por zona..."
          value={zonaFiltro}
          onChange={e => handleZona(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: '#9CA3AF' }} /></InputAdornment> }}
          sx={fieldSx}
        />
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={ocultarSinPrecio}
              onChange={e => { setOcultarSinPrecio(e.target.checked); setPage(0) }}
              sx={{ color: '#D1D5DB', '&.Mui-checked': { color: ACCENT }, p: 0.5 }}
            />
          }
          label={<Typography sx={{ fontSize: '0.78rem', color: '#6B7280', whiteSpace: 'nowrap' }}>Ocultar sin precio</Typography>}
          sx={{ m: 0 }}
        />
      </Box>

      {/* Contador + paginación superior */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1} px={0.5}>
        <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
          {loading
            ? 'Cargando...'
            : `${total.toLocaleString('es-AR')} resultado${total !== 1 ? 's' : ''} · página ${page + 1} de ${totalPages || 1}`
          }
        </Typography>
        {totalPages > 1 && (
          <Pagination
            count={totalPages}
            page={page + 1}
            onChange={(_, v) => setPage(v - 1)}
            size="small"
            disabled={loading}
            sx={{
              '& .MuiPaginationItem-root': { borderRadius: '6px', fontSize: '0.75rem' },
              '& .Mui-selected': { bgcolor: `${ACCENT} !important`, color: 'white' },
            }}
          />
        )}
      </Box>

      {/* Tabla */}
      <Box sx={{ border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden', bgcolor: 'white' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#F9FAFB' }}>
              {['Título', 'Zona', 'Precio', 'Contactos vinculados', 'Publicado', ''].map(col => (
                <TableCell key={col} sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', borderBottom: '1px solid #E5E7EB', py: 1.25, px: 2 }}>
                  {col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6, border: 'none' }}>
                  <CircularProgress size={22} sx={{ color: ACCENT }} />
                </TableCell>
              </TableRow>
            ) : propiedades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6, border: 'none' }}>
                  <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
                    No hay propiedades que coincidan con los filtros
                  </Typography>
                </TableCell>
              </TableRow>
            ) : propiedades.map((prop, i) => {
              const { display: precioDisplay } = parsePrecio(prop.precio)
              const count = prop.contactos_propiedades_ext?.length ?? 0
              return (
                <TableRow
                  key={prop.id}
                  sx={{ bgcolor: i % 2 === 0 ? 'white' : '#FAFAFA', '&:hover': { bgcolor: '#F0FDF4' }, transition: 'background 0.1s' }}
                >
                  <TableCell sx={{ py: 1.5, px: 2, borderBottom: '1px solid #F3F4F6', maxWidth: 320 }}>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {prop.titulo || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, borderBottom: '1px solid #F3F4F6', maxWidth: 160 }}>
                    <Typography sx={{ fontSize: '0.78rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {prop.zona || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: precioDisplay !== '—' ? 600 : 400, color: precioDisplay !== '—' ? '#111827' : '#9CA3AF' }}>
                      {precioDisplay}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, borderBottom: '1px solid #F3F4F6' }}>
                    <ContactosBadge count={count} />
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>
                    <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{fmtFecha(prop.scrapeado_en)}</Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 1.5, borderBottom: '1px solid #F3F4F6', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {prop.url && (
                      <Tooltip title="Ver en sitio web">
                        <IconButton
                          size="small"
                          onClick={() => window.open(prop.url, '_blank', 'noopener,noreferrer')}
                          sx={{ color: '#9CA3AF', '&:hover': { color: '#1D4ED8', bgcolor: '#EFF6FF' }, borderRadius: '6px', p: 0.75 }}
                        >
                          <OpenInNewIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Vincular contactos">
                      <IconButton
                        size="small"
                        onClick={() => abrirDrawer(prop)}
                        sx={{ color: count > 0 ? ACCENT : '#9CA3AF', '&:hover': { color: ACCENT, bgcolor: '#ECFDF5' }, borderRadius: '6px', p: 0.75, ml: 0.5 }}
                      >
                        <PersonAddIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Box>

      {/* Paginación inferior */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={2.5}>
          <Pagination
            count={totalPages}
            page={page + 1}
            onChange={(_, v) => { setPage(v - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            size="small"
            disabled={loading}
            sx={{
              '& .MuiPaginationItem-root': { borderRadius: '6px', fontSize: '0.75rem' },
              '& .Mui-selected': { bgcolor: `${ACCENT} !important`, color: 'white' },
            }}
          />
        </Box>
      )}

      {/* Drawer vincular contactos */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: 400, display: 'flex', flexDirection: 'column', bgcolor: 'white' } } }}
      >
        {/* Header */}
        <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box display="flex" alignItems="center" gap={1.25}>
            <Box sx={{ width: 28, height: 28, borderRadius: '7px', bgcolor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PersonIcon sx={{ fontSize: 15, color: ACCENT }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Vincular contactos</Typography>
              {drawerProp && (
                <Typography sx={{ fontSize: '0.72rem', color: '#6B7280', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {drawerProp.titulo}
                </Typography>
              )}
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setDrawerOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Seleccionados */}
        {seleccionados.size > 0 && (
          <Box sx={{ px: 3, py: 1.5, bgcolor: '#F0FDF4', borderBottom: '1px solid #D1FAE5', flexShrink: 0 }}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: ACCENT, mb: 1 }}>
              {seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''}
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={0.75}>
              {[...seleccionados].map(id => {
                const c = contactosMap[id]
                if (!c) return null
                return (
                  <Box key={id} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, bgcolor: 'white', border: '1px solid #A7F3D0', borderRadius: '20px' }}>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#111827' }}>
                      {c.nombre} {c.apellido}
                    </Typography>
                    <Box component="span" onClick={() => toggleContacto(id)} sx={{ display: 'flex', cursor: 'pointer', color: '#9CA3AF', '&:hover': { color: '#EF4444' } }}>
                      <CloseIcon sx={{ fontSize: 11 }} />
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Box>
        )}

        {/* Buscador */}
        <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Buscar por nombre, email o teléfono..."
            value={contactoBusqueda}
            onChange={e => setContactoBusqueda(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: '#9CA3AF' }} /></InputAdornment> }}
            sx={fieldSx}
          />
        </Box>

        {/* Lista */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1 }}>
          {loadingContactos ? (
            <Box display="flex" justifyContent="center" pt={4}>
              <CircularProgress size={20} sx={{ color: ACCENT }} />
            </Box>
          ) : contactosFiltrados.length === 0 ? (
            <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF', textAlign: 'center', py: 4 }}>
              No se encontraron contactos
            </Typography>
          ) : contactosFiltrados.map(c => {
            const isSelected = seleccionados.has(c.id)
            return (
              <Box
                key={c.id}
                onClick={() => toggleContacto(c.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.25,
                  borderRadius: '8px', cursor: 'pointer', mb: 0.25,
                  bgcolor: isSelected ? '#ECFDF5' : 'transparent',
                  border: `1px solid ${isSelected ? '#A7F3D0' : 'transparent'}`,
                  '&:hover': { bgcolor: isSelected ? '#ECFDF5' : '#F9FAFB' },
                  transition: 'all 0.1s',
                }}
              >
                <Avatar sx={{ width: 30, height: 30, bgcolor: isSelected ? '#A7F3D0' : '#F3F4F6', fontSize: '0.62rem', fontWeight: 700, color: isSelected ? ACCENT : '#6B7280', flexShrink: 0 }}>
                  {(c.nombre?.[0] ?? '') + (c.apellido?.[0] ?? '')}
                </Avatar>
                <Box flex={1} overflow="hidden">
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: isSelected ? 600 : 400, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.nombre} {c.apellido}
                  </Typography>
                  {(c.telefono || c.email) && (
                    <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.telefono || c.email}
                    </Typography>
                  )}
                </Box>
                {isSelected && <CheckIcon sx={{ fontSize: 16, color: ACCENT, flexShrink: 0 }} />}
              </Box>
            )
          })}
        </Box>

        {/* Footer */}
        <Divider />
        <Box sx={{ px: 3, py: 2, display: 'flex', gap: 1.5, flexShrink: 0 }}>
          <Button
            variant="contained"
            disabled={vinculando}
            onClick={handleGuardar}
            sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none', flex: 1, '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
          >
            {vinculando ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'Guardar'}
          </Button>
          <Button
            variant="outlined"
            onClick={() => setDrawerOpen(false)}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#374151', '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' } }}
          >
            Cancelar
          </Button>
        </Box>
      </Drawer>
    </Box>
  )
}
