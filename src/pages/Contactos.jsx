import { useEffect, useState, useMemo } from 'react'
import {
  Box, Typography, Button, Paper, TextField, Select, MenuItem,
  FormControl, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, CircularProgress, Tooltip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PermContactCalendarIcon from '@mui/icons-material/PermContactCalendar'
import { useAuth } from '../contexts/AuthContext'
import { getContactos, deleteContacto } from '../services/supabase'
import ContactoFormDrawer from '../components/contactos/ContactoFormDrawer'

const ACCENT = '#065F46'

const TIPOS = ['Todos', 'Propietario', 'Inquilino', 'Vendedor', 'Comprador']

const TIPO_COLORS = {
  Propietario: { bg: '#ECFDF5', color: '#065F46' },
  Inquilino:   { bg: '#EFF6FF', color: '#1D4ED8' },
  Vendedor:    { bg: '#FFFBEB', color: '#92400E' },
  Comprador:   { bg: '#F5F3FF', color: '#6D28D9' },
}

function TipoBadge({ tipo }) {
  const style = TIPO_COLORS[tipo] ?? { bg: '#F3F4F6', color: '#374151' }
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        px: 1,
        py: 0.25,
        borderRadius: '6px',
        bgcolor: style.bg,
        color: style.color,
        fontSize: '0.72rem',
        fontWeight: 600,
      }}
    >
      {tipo}
    </Box>
  )
}

export default function Contactos() {
  const { user } = useAuth()
  const [contactos, setContactos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('Todos')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await getContactos(user.cliente_id)
      setContactos(data)
    } catch {
      showSnack('Error al cargar los contactos.', 'error')
    } finally {
      setLoading(false)
    }
  }

  function showSnack(msg, severity = 'success') {
    setSnack({ open: true, msg, severity })
  }

  const filtrados = useMemo(() => {
    const q = search.toLowerCase().trim()
    return contactos.filter(c => {
      if (tipoFiltro !== 'Todos' && c.tipo !== tipoFiltro) return false
      if (!q) return true
      return (
        (c.nombre ?? '').toLowerCase().includes(q) ||
        (c.apellido ?? '').toLowerCase().includes(q) ||
        (c.dni ?? '').toLowerCase().includes(q) ||
        (c.telefono ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
      )
    })
  }, [contactos, search, tipoFiltro])

  function handleRowClick(c) {
    setSelected(c)
    setDrawerOpen(true)
  }

  function handleNew() {
    setSelected(null)
    setDrawerOpen(true)
  }

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
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNew}
          sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
        >
          Nuevo contacto
        </Button>
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
              {TIPOS.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '0.875rem' }}>{t}</MenuItem>)}
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
                <TableCell sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E5E7EB' }}>Nombre</TableCell>
                <TableCell sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E5E7EB' }}>Tipo</TableCell>
                <TableCell sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E5E7EB' }}>Contacto</TableCell>
                <TableCell sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E5E7EB' }}>DNI</TableCell>
                <TableCell sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E5E7EB' }}>Fecha alta</TableCell>
                <TableCell sx={{ borderBottom: '1px solid #E5E7EB' }} align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtrados.map(c => (
                <TableRow
                  key={c.id}
                  hover
                  onClick={() => handleRowClick(c)}
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F9FAFB' } }}
                >
                  <TableCell sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', borderBottom: '1px solid #F3F4F6' }}>
                    {c.apellido}, {c.nombre}
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #F3F4F6' }}>
                    <TipoBadge tipo={c.tipo} />
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #F3F4F6' }}>
                    <Typography sx={{ fontSize: '0.8rem', color: '#374151' }}>{c.telefono ?? '—'}</Typography>
                    {c.email && <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{c.email}</Typography>}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.82rem', color: '#6B7280', borderBottom: '1px solid #F3F4F6' }}>
                    {c.dni ?? '—'}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', color: '#9CA3AF', borderBottom: '1px solid #F3F4F6' }}>
                    {c.created_at ? new Date(c.created_at).toLocaleDateString('es-AR') : '—'}
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #F3F4F6' }} align="right">
                    <Box display="flex" gap={0.5} justifyContent="flex-end" onClick={e => e.stopPropagation()}>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleRowClick(c)} sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton size="small" onClick={() => setDeleteDialog(c)} sx={{ color: '#9CA3AF', '&:hover': { color: '#EF4444' } }}>
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
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

      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Eliminar contacto</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.875rem', color: '#374151' }}>
            ¿Confirmas la eliminación de <strong>{deleteDialog?.apellido}, {deleteDialog?.nombre}</strong>? Esta acción no se puede deshacer.
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
