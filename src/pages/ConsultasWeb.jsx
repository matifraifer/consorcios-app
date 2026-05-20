import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Box, Typography, Paper, TextField, Select, MenuItem,
  FormControl, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Snackbar, Alert, CircularProgress, Tooltip,
} from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import BlockIcon              from '@mui/icons-material/Block'
import LanguageIcon           from '@mui/icons-material/Language'
import ArrowUpwardIcon        from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon      from '@mui/icons-material/ArrowDownward'
import PersonIcon             from '@mui/icons-material/Person'
import {
  getConsultasWeb, inactivarConsultaWeb,
  marcarConsultaConvertida, getContactos, linkContactoPropiedad,
} from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'
import ContactoFormDrawer from '../components/contactos/ContactoFormDrawer'

const ACCENT = '#065F46'

const ESTADO_META = {
  pendiente:  { label: 'Pendiente',  bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' },
  validada:   { label: 'Validada',   bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7' },
  inactiva:   { label: 'Inactiva',   bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' },
  convertida: { label: 'Convertida', bg: '#EFF6FF', color: '#1D4ED8', border: '#93C5FD' },
}

const ESTADOS_FILTRO = ['Todos', 'pendiente', 'validada', 'convertida', 'inactiva']

const HEADER_SX = {
  fontSize: '0.68rem', fontWeight: 700, color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  borderBottom: '1px solid #E5E7EB', py: 1.5, userSelect: 'none',
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}

const selectSx = {
  fontSize: '0.875rem', borderRadius: '8px',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
}

function EstadoBadge({ estado }) {
  const s = ESTADO_META[estado] ?? ESTADO_META.pendiente
  return (
    <Box component="span" sx={{ display: 'inline-block', px: 1, py: 0.2, borderRadius: '6px', bgcolor: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: '0.68rem', fontWeight: 600 }}>
      {s.label}
    </Box>
  )
}

function fmt(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function ConsultasWeb() {
  const { user } = useAuth()
  const [consultas, setConsultas]           = useState([])
  const [contactosPorDni, setContactosPorDni] = useState(new Map()) // dni → contacto
  const [loading, setLoading]               = useState(true)
  const [search, setSearch]                 = useState('')
  const [estadoFiltro, setEstadoFiltro]     = useState('Todos')
  const [sortBy, setSortBy]                 = useState('created_at')
  const [sortDir, setSortDir]               = useState('desc')
  const [loadingId, setLoadingId]           = useState(null)
  const [drawerOpen, setDrawerOpen]         = useState(false)
  const [consultaActiva, setConsultaActiva] = useState(null)
  const [snack, setSnack]                   = useState({ open: false, msg: '', severity: 'success' })

  function showSnack(msg, severity = 'success') {
    setSnack({ open: true, msg, severity })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, contactos] = await Promise.all([
        getConsultasWeb(user.cliente_id),
        getContactos(user.cliente_id),
      ])
      setConsultas(data)
      const map = new Map()
      contactos.forEach(c => { if (c.dni?.trim()) map.set(c.dni.trim(), c) })
      setContactosPorDni(map)
    } catch {
      showSnack('Error al cargar las consultas.', 'error')
    } finally {
      setLoading(false)
    }
  }, [user.cliente_id])

  useEffect(() => { load() }, [load])

  async function handleValidar(consulta, e) {
    e.stopPropagation()
    const existente = contactosPorDni.get(consulta.dni?.trim())
    if (existente) {
      setLoadingId(consulta.id)
      try {
        if (consulta.propiedad_id) {
          await linkContactoPropiedad(existente.id, consulta.propiedad_id)
        }
        const updated = await marcarConsultaConvertida(consulta.id, existente.id)
        setConsultas(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
        showSnack(`Propiedad vinculada al contacto ${existente.apellido}, ${existente.nombre}.`)
      } catch {
        showSnack('Error al vincular el contacto.', 'error')
      } finally {
        setLoadingId(null)
      }
    } else {
      setConsultaActiva(consulta)
      setDrawerOpen(true)
    }
  }

  async function handleInactivar(consulta, e) {
    e.stopPropagation()
    setLoadingId(consulta.id)
    try {
      const updated = await inactivarConsultaWeb(consulta.id)
      setConsultas(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
      showSnack('Consulta inactivada.')
    } catch {
      showSnack('Error al inactivar.', 'error')
    } finally {
      setLoadingId(null)
    }
  }

  async function handleContactoSaved(contacto) {
    if (consultaActiva) {
      try {
        const updated = await marcarConsultaConvertida(consultaActiva.id, contacto.id)
        setConsultas(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
      } catch {}
    }
    if (contacto.dni) {
      setContactosPorDni(prev => new Map([...prev, [contacto.dni.trim(), contacto]]))
    }
    setDrawerOpen(false)
    setConsultaActiva(null)
    showSnack('Contacto creado y consulta convertida.')
  }

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  function SortIcon({ col }) {
    if (sortBy !== col) return null
    return sortDir === 'asc'
      ? <ArrowUpwardIcon sx={{ fontSize: 11, ml: 0.4 }} />
      : <ArrowDownwardIcon sx={{ fontSize: 11, ml: 0.4 }} />
  }

  const filtrados = useMemo(() => {
    const q = search.toLowerCase().trim()
    let list = consultas.filter(c => {
      if (estadoFiltro !== 'Todos' && c.estado !== estadoFiltro) return false
      if (!q) return true
      return (
        (c.nombre   ?? '').toLowerCase().includes(q) ||
        (c.apellido ?? '').toLowerCase().includes(q) ||
        (c.dni      ?? '').toLowerCase().includes(q) ||
        (c.telefono ?? '').toLowerCase().includes(q) ||
        (c.email    ?? '').toLowerCase().includes(q)
      )
    })

    list.sort((a, b) => {
      if (sortBy === 'created_at') {
        const va = a.created_at ?? '', vb = b.created_at ?? ''
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      let va = '', vb = ''
      if (sortBy === 'apellido') { va = `${a.apellido} ${a.nombre}`.toLowerCase(); vb = `${b.apellido} ${b.nombre}`.toLowerCase() }
      if (sortBy === 'estado')   { va = a.estado ?? ''; vb = b.estado ?? '' }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })

    return list
  }, [consultas, search, estadoFiltro, sortBy, sortDir])

  const cols = [
    { label: 'Fecha',           col: 'created_at' },
    { label: 'Nombre y Apellido', col: 'apellido' },
    { label: 'DNI',             col: null },
    { label: 'Teléfono / Email', col: null },
    { label: 'Propiedad',       col: null },
    { label: 'Provincia / Zona', col: null },
    { label: 'Presupuesto',     col: null },
    { label: 'Estado',          col: 'estado' },
    { label: '',                col: null },
  ]

  return (
    <Box sx={{ pb: 6 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LanguageIcon sx={{ fontSize: 18, color: '#1D4ED8' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>Consultas Web</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>Solicitudes desde la web pública</Typography>
          </Box>
        </Box>
      </Box>

      {/* Filtros */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: '10px', borderColor: '#E5E7EB' }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Buscar por nombre, apellido, DNI, teléfono o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ ...fieldSx, minWidth: 280, flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)} sx={selectSx}>
              {ESTADOS_FILTRO.map(e => (
                <MenuItem key={e} value={e} sx={{ fontSize: '0.875rem' }}>
                  {e === 'Todos' ? 'Todos los estados' : (ESTADO_META[e]?.label ?? e)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography sx={{ fontSize: '0.78rem', color: '#6B7280', ml: 'auto' }}>
            {filtrados.length} {filtrados.length === 1 ? 'resultado' : 'resultados'}
          </Typography>
        </Box>
      </Paper>

      {/* Tabla */}
      <Paper variant="outlined" sx={{ borderRadius: '10px', borderColor: '#E5E7EB', overflow: 'hidden' }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress size={28} sx={{ color: ACCENT }} />
          </Box>
        ) : filtrados.length === 0 ? (
          <Box display="flex" flexDirection="column" alignItems="center" py={7}>
            <LanguageIcon sx={{ fontSize: 36, color: '#D1D5DB', mb: 1 }} />
            <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>
              {consultas.length === 0 ? 'Todavía no hay consultas web.' : 'Sin resultados para la búsqueda.'}
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                {cols.map(({ label, col }, i) => (
                  <TableCell
                    key={i}
                    onClick={col ? () => toggleSort(col) : undefined}
                    sx={{ ...HEADER_SX, cursor: col ? 'pointer' : 'default', '&:hover': col ? { color: ACCENT } : {} }}
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
              {filtrados.map(c => (
                <TableRow
                  key={c.id}
                  hover
                  sx={{ cursor: 'default', '& td': { borderBottom: '1px solid #F3F4F6' }, '&:last-child td': { borderBottom: 0 }, '&:hover .row-actions': { opacity: 1 } }}
                >
                  {/* Fecha */}
                  <TableCell sx={{ fontSize: '0.78rem', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                    {fmt(c.created_at)}
                  </TableCell>

                  {/* Nombre */}
                  <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                    {c.apellido}, {c.nombre}
                  </TableCell>

                  {/* DNI */}
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={0.75}>
                      <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>
                        {c.dni ?? '—'}
                      </Typography>
                      {c.dni && contactosPorDni.has(c.dni.trim()) && (
                        <Tooltip title="Ya existe un contacto registrado con este DNI">
                          <PersonIcon sx={{ fontSize: 14, color: '#1D4ED8' }} />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>

                  {/* Teléfono / Email */}
                  <TableCell>
                    <Typography sx={{ fontSize: '0.82rem', color: '#374151' }}>{c.telefono}</Typography>
                    {c.email && (
                      <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{c.email}</Typography>
                    )}
                  </TableCell>

                  {/* Propiedad */}
                  <TableCell sx={{ fontSize: '0.82rem', color: '#374151', maxWidth: 160 }}>
                    {c.propiedades
                      ? <Typography sx={{ fontSize: '0.82rem', color: '#374151', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{c.propiedades.titulo}</Typography>
                      : <Typography sx={{ fontSize: '0.78rem', color: '#D1D5DB' }}>—</Typography>
                    }
                  </TableCell>

                  {/* Provincia / Zona */}
                  <TableCell>
                    {c.provincia && (
                      <Typography sx={{ fontSize: '0.82rem', color: '#374151' }}>{c.provincia}</Typography>
                    )}
                    {c.zona_interes && (
                      <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{c.zona_interes}</Typography>
                    )}
                    {!c.provincia && !c.zona_interes && (
                      <Typography sx={{ fontSize: '0.78rem', color: '#D1D5DB' }}>—</Typography>
                    )}
                  </TableCell>

                  {/* Presupuesto */}
                  <TableCell sx={{ fontSize: '0.82rem', color: '#374151' }}>
                    {c.presupuesto
                      ? Number(c.presupuesto).toLocaleString('es-AR')
                      : <Typography sx={{ fontSize: '0.78rem', color: '#D1D5DB' }}>—</Typography>
                    }
                  </TableCell>

                  {/* Estado */}
                  <TableCell><EstadoBadge estado={c.estado} /></TableCell>

                  {/* Acciones */}
                  <TableCell align="right">
                    <Box className="row-actions" display="flex" gap={0.5} justifyContent="flex-end">
                      {c.estado === 'pendiente' && (
                        <>
                          <Tooltip title={contactosPorDni.has(c.dni?.trim()) ? 'Vincular propiedad al contacto existente' : 'Crear contacto y convertir'}>
                            <IconButton
                              size="small"
                              disabled={loadingId === c.id}
                              onClick={e => handleValidar(c, e)}
                              sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}
                            >
                              <CheckCircleOutlineIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Inactivar">
                            <IconButton
                              size="small"
                              disabled={loadingId === c.id}
                              onClick={e => handleInactivar(c, e)}
                              sx={{ color: '#9CA3AF', '&:hover': { color: '#EF4444' } }}
                            >
                              <BlockIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <ContactoFormDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setConsultaActiva(null) }}
        contacto={null}
        clienteId={user.cliente_id}
        onSaved={handleContactoSaved}
        prefill={consultaActiva ? {
          nombre:       consultaActiva.nombre,
          apellido:     consultaActiva.apellido,
          dni:          consultaActiva.dni,
          telefono:     consultaActiva.telefono,
          email:        consultaActiva.email ?? '',
          presupuesto:  consultaActiva.presupuesto ? String(consultaActiva.presupuesto) : '',
          zona_interes: consultaActiva.zona_interes ?? '',
        } : null}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} sx={{ borderRadius: '8px', fontSize: '0.82rem' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
