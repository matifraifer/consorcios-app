import { useEffect, useState, useMemo } from 'react'
import {
  Dialog, DialogTitle, DialogContent, IconButton, TextField,
  Tabs, Tab, Box, Typography, CircularProgress, List, ListItemButton,
  Divider,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { getContactos } from '../services/supabase'

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
        fontSize: '0.68rem',
        fontWeight: 600,
        ml: 1,
      }}
    >
      {tipo}
    </Box>
  )
}

export default function ContactoPicker({ open, onClose, onSelect, clienteId, tipoSugerido }) {
  const [contactos, setContactos] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [tabIndex, setTabIndex] = useState(0)

  useEffect(() => {
    if (!open) return
    setSearch('')
    const idx = tipoSugerido ? TIPOS.indexOf(tipoSugerido) : 0
    setTabIndex(idx >= 0 ? idx : 0)
    load()
  }, [open])

  async function load() {
    setLoading(true)
    try {
      const data = await getContactos(clienteId)
      setContactos(data)
    } catch {
      setContactos([])
    } finally {
      setLoading(false)
    }
  }

  const filtrados = useMemo(() => {
    const tipoFiltro = TIPOS[tabIndex]
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
  }, [contactos, tabIndex, search])

  function handleSelect(contacto) {
    onSelect(contacto)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Buscar contacto</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <Box sx={{ px: 3, pb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar por nombre, apellido, DNI, teléfono o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px', fontSize: '0.875rem',
              '& fieldset': { borderColor: '#E5E7EB' },
              '&:hover fieldset': { borderColor: ACCENT },
              '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
            },
          }}
        />
      </Box>

      <Box sx={{ px: 3 }}>
        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          variant="scrollable"
          scrollButtons={false}
          sx={{
            minHeight: 36,
            '& .MuiTab-root': { textTransform: 'none', fontSize: '0.78rem', fontWeight: 500, minHeight: 36, px: 1.5, py: 0 },
            '& .Mui-selected': { color: ACCENT, fontWeight: 700 },
            '& .MuiTabs-indicator': { bgcolor: ACCENT },
          }}
        >
          {TIPOS.map(t => <Tab key={t} label={t} />)}
        </Tabs>
      </Box>

      <Divider />

      <DialogContent sx={{ p: 0 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress size={24} sx={{ color: ACCENT }} />
          </Box>
        ) : filtrados.length === 0 ? (
          <Box display="flex" flexDirection="column" alignItems="center" py={5}>
            <Typography sx={{ fontSize: '0.85rem', color: '#9CA3AF' }}>
              {contactos.length === 0 ? 'No hay contactos registrados.' : 'Sin resultados para la búsqueda.'}
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ maxHeight: 380, overflowY: 'auto' }}>
            {filtrados.map((c, i) => (
              <Box key={c.id}>
                {i > 0 && <Divider />}
                <ListItemButton onClick={() => handleSelect(c)} sx={{ px: 3, py: 1.25, '&:hover': { bgcolor: '#F9FAFB' } }}>
                  <Box width="100%">
                    <Box display="flex" alignItems="center">
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>
                        {c.apellido}, {c.nombre}
                      </Typography>
                      <TipoBadge tipo={c.tipo} />
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', mt: 0.25 }}>
                      {[c.dni && `DNI: ${c.dni}`, c.telefono, c.email].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                </ListItemButton>
              </Box>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  )
}
