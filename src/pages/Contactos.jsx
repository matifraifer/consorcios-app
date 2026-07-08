import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Box, Typography, Button, Paper, TextField, Select, MenuItem,
  FormControl, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, CircularProgress, Tooltip, Chip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EmailIcon from '@mui/icons-material/Email'
import PhoneIcon from '@mui/icons-material/Phone'
import PermContactCalendarIcon from '@mui/icons-material/PermContactCalendar'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { useAuth } from '../contexts/AuthContext'
import { getContactos, deleteContacto } from '../services/supabase'
import ContactoFormDrawer from '../components/contactos/ContactoFormDrawer'
import ImportarContactosDrawer from '../components/contactos/ImportarContactosDrawer'

const ACCENT = '#065F46'

const TIPOS_FILTRO   = ['Todos', 'Comprador', 'Vendedor', 'Arrendatario', 'Locatario']
const ORIGENES_FILTRO = ['Todos', 'APP', 'WEB', 'IMPORTADO']

const TIPO_COLORS = {
  Comprador:    { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
  Vendedor:     { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  Arrendatario: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  Locatario:    { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
}

const ORIGEN_STYLES = {
  WEB: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  APP: { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' },
  IMPORTADO: { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
}

function TipoBadge({ tipo }) {
  const s = TIPO_COLORS[tipo] ?? { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' }
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

function getContactTipos(c) {
  if (c.tipos?.length) return c.tipos
  if (!c.tipo) return []
  const LEGACY = { Inquilino: 'Arrendatario', Propietario: 'Locatario', Vendedor: 'Vendedor', Comprador: 'Comprador' }
  return [LEGACY[c.tipo] ?? c.tipo]
}

export default function Contactos() {
  const { user } = useAuth()
  const isAdmin = user?.rol?.toLowerCase() === 'admin'
  const [contactos, setContactos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('Todos')
  const [origenFiltro, setOrigenFiltro] = useState('Todos')
  const [sortBy, setSortBy] = useState('apellido')
  const [sortDir, setSortDir] = useState('asc')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getContactos(user.cliente_id)
      setContactos(data)
    } catch {
      showSnack('Error al cargar los contactos.', 'error')
    } finally {
      setLoading(false)
    }
  }, [user.cliente_id])

  useEffect(() => { load() }, [load])

  function showSnack(msg, severity = 'success') {
    setSnack({ open: true, msg, severity })
  }

  const filtrados = useMemo(() => {
    const q = search.toLowerCase().trim()
    let list = contactos.filter(c => {
      if (!isAdmin && c.creado_por !== user?.nombre_usuario && c.asignado_nombre !== user?.nombre_usuario) return false
      if (tipoFiltro !== 'Todos') {
        if (!getContactTipos(c).includes(tipoFiltro)) return false
      }
      if (origenFiltro !== 'Todos' && (c.origen ?? 'APP') !== origenFiltro) return false
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
      if (sortBy === 'propiedades_count') {
        const va = a.propiedades_count ?? 0, vb = b.propiedades_count ?? 0
        return sortDir === 'asc' ? va - vb : vb - va
      }
      let va = '', vb = ''
      if (sortBy === 'apellido')        { va = `${a.apellido} ${a.nombre}`.toLowerCase(); vb = `${b.apellido} ${b.nombre}`.toLowerCase() }
      if (sortBy === 'dni')             { va = a.dni ?? ''; vb = b.dni ?? '' }
      if (sortBy === 'telefono')        { va = a.telefono ?? ''; vb = b.telefono ?? '' }
      if (sortBy === 'origen')          { va = a.origen ?? 'APP'; vb = b.origen ?? 'APP' }
      if (sortBy === 'asignado_nombre') { va = a.asignado_nombre ?? ''; vb = b.asignado_nombre ?? '' }
      if (sortBy === 'creado_por')      { va = a.creado_por ?? ''; vb = b.creado_por ?? '' }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })

    return list
  }, [contactos, search, tipoFiltro, origenFiltro, sortBy, sortDir, isAdmin, user?.nombre_usuario])

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

  function handleSaved(result) {
    setContactos(prev => {
      const exists = prev.find(c => c.id === result.id)
      if (exists) return prev.map(c => c.id === result.id ? result : c)
      return [result, ...prev]
    })
    showSnack(selected ? 'Contacto actualizado.' : 'Contacto creado.')
  }

  async function handleDelete() {
    if (!deleteDialog) return
    setDeleting(true)
    try {
      await deleteContacto(deleteDialog.id)
      setContactos(prev => prev.filter(c => c.id !== deleteDialog.id))
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

  const cols = [
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
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
            onClick={() => setImportOpen(true)}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#374151', '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: '#ECFDF5' } }}
          >
            Importar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleNew}
            sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
          >
            Nuevo contacto
          </Button>
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
            <Select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)} sx={selectSx}>
              {TIPOS_FILTRO.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '0.875rem' }}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select value={origenFiltro} onChange={e => setOrigenFiltro(e.target.value)} sx={selectSx}>
              {ORIGENES_FILTRO.map(o => <MenuItem key={o} value={o} sx={{ fontSize: '0.875rem' }}>{o}</MenuItem>)}
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
            <PermContactCalendarIcon sx={{ fontSize: 36, color: '#D1D5DB', mb: 1 }} />
            <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>
              {contactos.length === 0 ? 'No hay contactos registrados.' : 'Sin resultados para la búsqueda.'}
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
                  onClick={() => handleRowClick(c)}
                  sx={{ cursor: 'pointer', '& td': { borderBottom: '1px solid #F3F4F6' }, '&:last-child td': { borderBottom: 0 }, '&:hover .row-actions': { opacity: 1 } }}
                >
                  {/* Nombre */}
                  <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                    {c.apellido}, {c.nombre}
                  </TableCell>

                  {/* Tipos */}
                  <TableCell><TiposBadges tipos={c.tipos} tipo={c.tipo} /></TableCell>

                  {/* DNI */}
                  <TableCell sx={{ fontSize: '0.82rem', color: '#6B7280' }}>{c.dni ?? '—'}</TableCell>

                  {/* Teléfono */}
                  <TableCell sx={{ fontSize: '0.82rem', color: '#374151' }}>{c.telefono ?? '—'}</TableCell>

                  {/* Origen */}
                  <TableCell><OrigenBadge origen={c.origen} /></TableCell>

                  {/* Propiedades */}
                  <TableCell>
                    {c.propiedades_count > 0 ? (
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', bgcolor: '#ECFDF5', color: ACCENT, fontSize: '0.72rem', fontWeight: 800, border: '1px solid #A7F3D0' }}>
                        {c.propiedades_count}
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: '0.78rem', color: '#D1D5DB' }}>—</Typography>
                    )}
                  </TableCell>

                  {/* Asignado */}
                  <TableCell sx={{ fontSize: '0.82rem', color: '#374151' }}>
                    {c.asignado_nombre ?? <Typography component="span" sx={{ fontSize: '0.78rem', color: '#D1D5DB' }}>—</Typography>}
                  </TableCell>

                  {/* Creado por */}
                  <TableCell sx={{ fontSize: '0.82rem', color: '#374151' }}>
                    {c.creado_por ?? <Typography component="span" sx={{ fontSize: '0.78rem', color: '#D1D5DB' }}>—</Typography>}
                  </TableCell>

                  {/* Acciones */}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
        onImported={() => { load(); showSnack('Contactos importados correctamente.') }}
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
