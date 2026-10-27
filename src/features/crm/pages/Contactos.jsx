import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  Box, Typography, Button, Paper, TextField, Select, MenuItem,
  FormControl, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, CircularProgress, Tooltip, Chip, InputAdornment, Collapse, TablePagination, LinearProgress, useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EmailIcon from '@mui/icons-material/Email'
import PhoneIcon from '@mui/icons-material/Phone'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import PermContactCalendarIcon from '@mui/icons-material/PermContactCalendar'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import SearchIcon from '@mui/icons-material/Search'
import TuneIcon from '@mui/icons-material/Tune'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import { useAuth } from '../../auth/AuthContext.jsx'
import { CONTACTOS_SIN_DATO, deleteContacto, getContactosPaginados, getContactosResumen } from '../services/crm'
import ContactoFormDrawer from '../components/contactos/ContactoFormDrawer.jsx'
import ImportarContactosDrawer from '../components/contactos/ImportarContactosDrawer.jsx'
import { EMBUDO_CONTACTO, ORIGENES_CONTACTO, TIPOS_CONTACTO, tipoContactoMeta } from '../constants/contactos'

const ACCENT = '#065F46'

// '' = sin filtro. SIN_DATO filtra los contactos que no tienen ese campo cargado.
const SIN_DATO = CONTACTOS_SIN_DATO

const FILTROS_VACIOS = {
  tipo: '', origen_contacto: '', embudo: '', operacion: '',
  creado_por: '', propiedades: '',
}

function FiltroSelect({ label, value, onChange, options, sinDato, selectSx }) {
  const activo = !!value
  return (
    <Box minWidth={0}>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: activo ? ACCENT : '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
        {label}
      </Typography>
      <FormControl size="small" fullWidth>
        <Select
          value={value}
          onChange={e => onChange(e.target.value)}
          displayEmpty
          sx={{
            ...selectSx,
            bgcolor: activo ? '#ECFDF5' : 'white',
            ...(activo && { '& .MuiOutlinedInput-notchedOutline': { borderColor: '#A7F3D0' } }),
          }}
          renderValue={v => {
            if (!v) return <Typography component="span" sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Todos</Typography>
            if (v === SIN_DATO) return 'Sin especificar'
            return options.find(o => (o.value ?? o) === v)?.label ?? v
          }}
        >
          <MenuItem value="" sx={{ fontSize: '0.875rem', color: '#6B7280' }}>Todos</MenuItem>
          {options.map(o => {
            const val = o.value ?? o
            return <MenuItem key={val} value={val} sx={{ fontSize: '0.875rem' }}>{o.label ?? o}</MenuItem>
          })}
          {sinDato && <MenuItem value={SIN_DATO} sx={{ fontSize: '0.875rem', fontStyle: 'italic', color: '#6B7280' }}>Sin especificar</MenuItem>}
        </Select>
      </FormControl>
    </Box>
  )
}

const ORIGEN_STYLES = {
  WEB: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  APP: { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' },
  IMPORTADO: { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  IA: { bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
}

function TipoBadge({ tipo }) {
  const s = tipoContactoMeta(tipo)
  return (
    <Box component="span" sx={{ display: 'inline-block', px: 1, py: 0.2, borderRadius: '6px', bgcolor: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: '0.68rem', fontWeight: 600 }}>
      {tipo}
    </Box>
  )
}

function OrigenBadge({ origen }) {
  const s = ORIGEN_STYLES[origen] ?? ORIGEN_STYLES.APP
  return (
    <Box component="span" sx={{ display: 'inline-block', px: 1, py: 0.2, borderRadius: '6px', bgcolor: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em' }}>
      {origen ?? 'APP'}
    </Box>
  )
}

function TiposBadges({ tipos, tipo }) {
  const list = tipos?.length ? tipos : (tipo ? [tipo] : [])
  if (!list.length) return <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>—</Typography>
  return (
    <Box display="flex" gap={0.5} flexWrap="wrap">
      {list.map(t => <TipoBadge key={t} tipo={t} />)}
    </Box>
  )
}

export default function Contactos() {
  const { user } = useAuth()
  const isAdmin = user?.rol?.toLowerCase() === 'admin'
  const isOperador = user?.rol?.toLowerCase() === 'operador'
  const isInmo = user?.rol?.toLowerCase() === 'inmo'
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [contactos, setContactos] = useState([])
  const [totalFiltrados, setTotalFiltrados] = useState(0)
  const [resumen, setResumen] = useState({ total: 0, creadoPorOptions: [] })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const [sortBy, setSortBy] = useState('apellido')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' })

  // Contactos que el usuario puede ver según su rol (se aplica en la consulta)
  const restriccion = useMemo(() => {
    // El operador solo ve los contactos que cargó él mismo
    if (isOperador) return { soloCreadoPor: user?.nombre_usuario ?? '' }
    // Admin e inmo ven todos los contactos
    if (isAdmin || isInmo) return null
    return { creadoOAsignado: user?.nombre_usuario ?? '' }
  }, [isAdmin, isOperador, isInmo, user?.nombre_usuario])

  // Espera a que el usuario deje de tipear antes de consultar
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Cualquier cambio de búsqueda, filtros u orden vuelve a la primera página
  useEffect(() => { setPage(0) }, [searchDebounced, filtros, sortBy, sortDir, rowsPerPage])

  const loadResumen = useCallback(async () => {
    try {
      setResumen(await getContactosResumen({ clienteId: user.cliente_id, restriccion }))
    } catch { /* el resumen es informativo: si falla, la grilla sigue funcionando */ }
  }, [user.cliente_id, restriccion])

  const requestId = useRef(0)
  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    try {
      const { data, count } = await getContactosPaginados({
        clienteId: user.cliente_id, page, pageSize: rowsPerPage,
        search: searchDebounced, filtros, sortBy, sortDir, restriccion,
      })
      if (id !== requestId.current) return // llegó una respuesta más nueva
      // Si la página quedó vacía (ej. se eliminó el último contacto), retrocede una
      if (data.length === 0 && page > 0 && count > 0) { setPage(Math.max(0, Math.ceil(count / rowsPerPage) - 1)); return }
      setContactos(data)
      setTotalFiltrados(count)
    } catch {
      if (id === requestId.current) showSnack('Error al cargar los contactos.', 'error')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [user.cliente_id, page, rowsPerPage, searchDebounced, filtros, sortBy, sortDir, restriccion])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadResumen() }, [loadResumen])

  function recargar() { load(); loadResumen() }

  function showSnack(msg, severity = 'success') {
    setSnack({ open: true, msg, severity })
  }

  const creadoPorOptions = resumen.creadoPorOptions

  const filtrosActivos = Object.values(filtros).filter(Boolean).length
  const hayFiltros = filtrosActivos > 0 || !!search.trim()

  function setFiltro(key, value) { setFiltros(prev => ({ ...prev, [key]: value })) }
  function limpiarFiltros() { setFiltros(FILTROS_VACIOS); setSearch('') }

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

  function handleRowClick(c) { setSelected(c); setDrawerOpen(true) }
  function handleNew()       { setSelected(null); setDrawerOpen(true) }

  function handleSaved() {
    // Se recarga la página actual desde la base: el orden, los filtros y el total pueden cambiar
    recargar()
    showSnack(selected ? 'Contacto actualizado.' : 'Contacto creado.')
  }

  async function handleDelete() {
    if (!deleteDialog) return
    setDeleting(true)
    try {
      await deleteContacto(deleteDialog.id)
      recargar()
      showSnack('Contacto eliminado.')
    } catch {
      showSnack('Error al eliminar el contacto.', 'error')
    } finally {
      setDeleting(false)
      setDeleteDialog(null)
    }
  }

  async function copyToClipboard(text, label) {
    try {
      await navigator.clipboard.writeText(text)
      showSnack(`${label} copiado al portapapeles.`)
    } catch {
      showSnack('No se pudo copiar.', 'error')
    }
  }

  const HEADER_SX = {
    fontSize: '0.68rem', fontWeight: 700, color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: '1px solid #E5E7EB', py: 1.5, userSelect: 'none',
  }

  const cols = isMobile ? [
    { label: 'Nombre y Apellido', col: 'apellido' },
    { label: 'Tipo',              col: null },
    { label: '',                  col: null },
  ] : [
    { label: 'Nombre y Apellido', col: 'apellido' },
    { label: 'Tipo',              col: null },
    { label: 'DNI',               col: 'dni' },
    { label: 'Teléfono',          col: 'telefono' },
    { label: 'Origen',            col: 'origen' },
    { label: 'Propiedades',       col: 'propiedades_count' },
    { label: 'Asignado',          col: 'asignado_nombre' },
    { label: 'Creado por',        col: 'creado_por' },
    { label: '',                  col: null },
  ]

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

  return (
    <Box sx={{ pb: 6 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PermContactCalendarIcon sx={{ fontSize: 18, color: ACCENT }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>Contactos</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>Gestión comercial</Typography>
          </Box>
        </Box>
        <Box display="flex" gap={1.25}>
          {!isMobile && (
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
              onClick={() => setImportOpen(true)}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#374151', '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: '#ECFDF5' } }}
            >
              Importar
            </Button>
          )}
          {isMobile ? (
            <IconButton
              onClick={handleNew}
              sx={{ bgcolor: ACCENT, color: 'white', width: 40, height: 40, '&:hover': { bgcolor: '#047857' } }}
            >
              <AddIcon />
            </IconButton>
          ) : (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNew}
              sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
            >
              Nuevo contacto
            </Button>
          )}
        </Box>
      </Box>

      {/* Filtros */}
      <Paper variant="outlined" sx={{ mb: 2.5, borderRadius: '10px', borderColor: '#E5E7EB', overflow: 'hidden' }}>
        {/* Búsqueda + resumen */}
        <Box display="flex" gap={1.5} alignItems="center" sx={{ p: 2, pb: isMobile && !filtrosOpen ? 2 : 1.5 }}>
          <TextField
            size="small"
            placeholder={isMobile ? 'Buscar contacto...' : 'Buscar por nombre, apellido, DNI, teléfono o email...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ ...fieldSx, flex: 1, minWidth: 0 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: '#9CA3AF' }} />
                </InputAdornment>
              ),
            }}
          />
          {isMobile && (
            <Button
              onClick={() => setFiltrosOpen(o => !o)}
              startIcon={<TuneIcon sx={{ fontSize: 16 }} />}
              sx={{
                flexShrink: 0, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem',
                border: `1px solid ${filtrosActivos ? '#A7F3D0' : '#E5E7EB'}`,
                bgcolor: filtrosActivos ? '#ECFDF5' : 'white', color: filtrosActivos ? ACCENT : '#374151',
              }}
            >
              Filtros{filtrosActivos ? ` (${filtrosActivos})` : ''}
            </Button>
          )}
          {isMobile ? (
            <Tooltip title="Limpiar filtros">
              <span>
                <IconButton
                  onClick={limpiarFiltros}
                  disabled={!hayFiltros}
                  sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', color: '#6B7280', '&:hover': { color: '#DC2626', bgcolor: '#FEF2F2', borderColor: '#FECACA' } }}
                >
                  <FilterAltOffIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <Button
              onClick={limpiarFiltros}
              disabled={!hayFiltros}
              startIcon={<FilterAltOffIcon sx={{ fontSize: 16 }} />}
              sx={{
                flexShrink: 0, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem',
                border: '1px solid #E5E7EB', color: '#374151', px: 1.75,
                '&:hover': { color: '#DC2626', bgcolor: '#FEF2F2', borderColor: '#FECACA' },
                '&.Mui-disabled': { color: '#D1D5DB', borderColor: '#F3F4F6' },
              }}
            >
              Limpiar filtros{filtrosActivos ? ` (${filtrosActivos})` : ''}
            </Button>
          )}
          {!isMobile && (
            <Typography sx={{ fontSize: '0.78rem', color: '#6B7280', flexShrink: 0 }}>
              {totalFiltrados} de {resumen.total} {resumen.total === 1 ? "contacto" : "contactos"}
            </Typography>
          )}
        </Box>

        {/* Filtros */}
        <Collapse in={!isMobile || filtrosOpen}>
          <Box sx={{ px: 2, pb: 2 }}>
            <Box
              display="grid"
              gap={1.5}
              sx={{ gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)', lg: `repeat(${isOperador ? 5 : 6}, 1fr)` } }}
            >
              <FiltroSelect label="Tipo de contacto" value={filtros.tipo} onChange={v => setFiltro('tipo', v)} options={TIPOS_CONTACTO} selectSx={selectSx} />
              <FiltroSelect label="Origen del contacto" value={filtros.origen_contacto} onChange={v => setFiltro('origen_contacto', v)} options={ORIGENES_CONTACTO} sinDato selectSx={selectSx} />
              <FiltroSelect label="Embudo de ventas" value={filtros.embudo} onChange={v => setFiltro('embudo', v)} options={EMBUDO_CONTACTO} sinDato selectSx={selectSx} />
              <FiltroSelect label="Operación" value={filtros.operacion} onChange={v => setFiltro('operacion', v)} options={['Alquiler', 'Compraventa']} sinDato selectSx={selectSx} />
              <FiltroSelect
                label="Propiedades"
                value={filtros.propiedades}
                onChange={v => setFiltro('propiedades', v)}
                options={[{ value: 'con', label: 'Con propiedades' }, { value: 'sin', label: 'Sin propiedades' }]}
                selectSx={selectSx}
              />
              {/* El operador solo ve sus propios contactos: el filtro no aporta */}
              {!isOperador && (
                <FiltroSelect label="Creado por" value={filtros.creado_por} onChange={v => setFiltro('creado_por', v)} options={creadoPorOptions} sinDato selectSx={selectSx} />
              )}
            </Box>

            {isMobile && (
              <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', mt: 1.5 }}>
                {filtrosActivos > 0 ? `${filtrosActivos} ${filtrosActivos === 1 ? 'filtro activo' : 'filtros activos'} · ` : ''}
                {totalFiltrados} de {resumen.total} contactos
              </Typography>
            )}
          </Box>
        </Collapse>
      </Paper>

      {/* Tabla */}
      <Paper variant="outlined" sx={{ borderRadius: '10px', borderColor: '#E5E7EB', overflow: 'hidden', position: 'relative' }}>
        {/* Al cambiar de página se mantiene la grilla visible con una barra de carga */}
        {loading && contactos.length > 0 && (
          <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 1, bgcolor: '#ECFDF5', '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />
        )}
        {loading && contactos.length === 0 ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress size={28} sx={{ color: ACCENT }} />
          </Box>
        ) : contactos.length === 0 ? (
          <Box display="flex" flexDirection="column" alignItems="center" py={7}>
            <PermContactCalendarIcon sx={{ fontSize: 36, color: '#D1D5DB', mb: 1 }} />
            <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>
              {resumen.total === 0 ? 'No hay contactos registrados.' : 'Sin resultados para la búsqueda.'}
            </Typography>
            {hayFiltros && (
              <Button
                size="small"
                onClick={limpiarFiltros}
                startIcon={<FilterAltOffIcon sx={{ fontSize: 15 }} />}
                sx={{ mt: 1.5, textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', color: ACCENT, '&:hover': { bgcolor: '#ECFDF5' } }}
              >
                Limpiar filtros
              </Button>
            )}
          </Box>
        ) : (
          <Table size="small" sx={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
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
              {contactos.map(c => (
                <TableRow
                  key={c.id}
                  hover={!isMobile}
                  onClick={isMobile ? undefined : () => handleRowClick(c)}
                  sx={{
                    cursor: isMobile ? 'default' : 'pointer',
                    borderLeft: c.origen === 'IA' ? '3px solid #7C3AED' : '3px solid transparent',
                    '& td': { borderBottom: '1px solid #F3F4F6' },
                    '&:last-child td': { borderBottom: 0 },
                    '&:hover .row-actions': { opacity: 1 },
                  }}
                >
                  {/* Nombre */}
                  <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                    {c.apellido}, {c.nombre}
                  </TableCell>

                  {/* Tipos */}
                  <TableCell><TiposBadges tipos={c.tipos} tipo={c.tipo} /></TableCell>

                  {/* DNI */}
                  {!isMobile && <TableCell sx={{ fontSize: '0.82rem', color: '#6B7280' }}>{c.dni ?? '—'}</TableCell>}

                  {/* Teléfono */}
                  {!isMobile && <TableCell sx={{ fontSize: '0.82rem', color: '#374151' }}>{c.telefono ?? '—'}</TableCell>}

                  {/* Origen */}
                  {!isMobile && <TableCell><OrigenBadge origen={c.origen} /></TableCell>}

                  {/* Propiedades */}
                  {!isMobile && (
                    <TableCell>
                      {c.propiedades_count > 0 ? (
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', bgcolor: '#ECFDF5', color: ACCENT, fontSize: '0.72rem', fontWeight: 800, border: '1px solid #A7F3D0' }}>
                          {c.propiedades_count}
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: '0.78rem', color: '#D1D5DB' }}>—</Typography>
                      )}
                    </TableCell>
                  )}

                  {/* Asignado */}
                  {!isMobile && (
                    <TableCell sx={{ fontSize: '0.82rem', color: '#374151' }}>
                      {c.asignado_nombre ?? <Typography component="span" sx={{ fontSize: '0.78rem', color: '#D1D5DB' }}>—</Typography>}
                    </TableCell>
                  )}

                  {/* Creado por */}
                  {!isMobile && (
                    <TableCell sx={{ fontSize: '0.82rem', color: '#374151' }}>
                      {c.creado_por ?? <Typography component="span" sx={{ fontSize: '0.78rem', color: '#D1D5DB' }}>—</Typography>}
                    </TableCell>
                  )}

                  {/* WhatsApp (mobile) */}
                  {isMobile && (
                    <TableCell align="right">
                      {c.telefono ? (
                        <IconButton
                          size="small"
                          component="a"
                          href={`https://wa.me/${c.telefono.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          sx={{ color: '#25D366' }}
                        >
                          <WhatsAppIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                      ) : (
                        <Typography sx={{ fontSize: '0.78rem', color: '#D1D5DB' }}>—</Typography>
                      )}
                    </TableCell>
                  )}

                  {/* Acciones */}
                  {!isMobile && (
                    <TableCell align="right">
                      <Box className="row-actions" display="flex" gap={0.5} justifyContent="flex-end" onClick={e => e.stopPropagation()}>
                        {c.email && (
                          <Tooltip title="Copiar correo">
                            <IconButton size="small" onClick={() => copyToClipboard(c.email, 'Correo')} sx={{ color: '#9CA3AF', '&:hover': { color: '#1D4ED8' } }}>
                              <EmailIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {c.telefono && (
                          <Tooltip title="Copiar teléfono">
                            <IconButton size="small" onClick={() => copyToClipboard(c.telefono, 'Teléfono')} sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
                              <PhoneIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => handleRowClick(c)} sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
                            <EditIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                          <IconButton size="small" onClick={() => setDeleteDialog(c)} sx={{ color: '#9CA3AF', '&:hover': { color: '#EF4444' } }}>
                            <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {totalFiltrados > 0 && (
          <TablePagination
            component="div"
            count={totalFiltrados}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => setRowsPerPage(parseInt(e.target.value, 10))}
            rowsPerPageOptions={[25, 50, 100]}
            labelRowsPerPage={isMobile ? 'Filas' : 'Filas por página'}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            sx={{ borderTop: '1px solid #E5E7EB', '.MuiTablePagination-toolbar': { fontSize: '0.8rem' } }}
          />
        )}
      </Paper>

      <ContactoFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        contacto={selected}
        clienteId={user.cliente_id}
        onSaved={handleSaved}
      />

      <ImportarContactosDrawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        clienteId={user.cliente_id}
        onImported={() => { recargar(); showSnack('Contactos importados correctamente.') }}
      />

      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Eliminar contacto</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.875rem', color: '#374151' }}>
            ¿Estás seguro que deseas eliminar a <strong>{deleteDialog?.apellido}, {deleteDialog?.nombre}</strong>? Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialog(null)} sx={{ textTransform: 'none', borderRadius: '8px', color: '#6B7280' }}>
            Cancelar
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ bgcolor: '#EF4444', textTransform: 'none', borderRadius: '8px', boxShadow: 'none', fontWeight: 600, '&:hover': { bgcolor: '#DC2626', boxShadow: 'none' } }}
          >
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

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
