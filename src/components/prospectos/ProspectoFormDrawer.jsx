import { useEffect, useState } from 'react'
import {
  Box, Typography, Drawer, IconButton, TextField, Button,
  Alert, CircularProgress, Grid, Autocomplete,
} from '@mui/material'
import CloseIcon  from '@mui/icons-material/Close'
import GroupIcon  from '@mui/icons-material/Group'
import AddIcon    from '@mui/icons-material/Add'
import { createProspecto, getContactos, getContactoPropiedades } from '../../services/supabase'
import ContactoFormDrawer from '../contactos/ContactoFormDrawer'

const ACCENT = '#065F46'

const FORM_EMPTY = { nombre: '', apellido: '', telefono: '', email: '', dni: '' }

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}

function Label({ children, required }) {
  return (
    <Box display="flex" gap={0.5} mb={0.5}>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151' }}>{children}</Typography>
      {required && <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#EF4444', lineHeight: 1 }}>*</Typography>}
    </Box>
  )
}

function SectionLabel({ children }) {
  return (
    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9CA3AF', mt: 3, mb: 1.5 }}>
      {children}
    </Typography>
  )
}

export default function ProspectoFormDrawer({ open, onClose, defaultEtapaId, propiedades = [], onSaved, asignadoNombre, clienteId }) {
  const [form, setForm]                   = useState(FORM_EMPTY)
  const [contactos, setContactos]         = useState([])
  const [contactoSel, setContactoSel]     = useState(null)
  const [propVinculadas, setPropVinculadas] = useState([])
  const [loadingContactos, setLoadingContactos] = useState(false)
  const [loadingProps, setLoadingProps]   = useState(false)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState(null)
  const [nuevoContactoOpen, setNuevoContactoOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(FORM_EMPTY)
    setContactoSel(null)
    setPropVinculadas([])
    setError(null)
    setLoadingContactos(true)
    getContactos(clienteId)
      .then(data => setContactos(data ?? []))
      .catch(() => {})
      .finally(() => setLoadingContactos(false))
  }, [open])

  async function handleContactoSelect(contacto) {
    if (!contacto) {
      setContactoSel(null)
      setForm(FORM_EMPTY)
      setPropVinculadas([])
      return
    }
    setContactoSel(contacto)
    setForm({
      nombre:   contacto.nombre   ?? '',
      apellido: contacto.apellido ?? '',
      telefono: contacto.telefono ?? '',
      email:    contacto.email    ?? '',
      dni:      contacto.dni      ?? '',
    })
    setLoadingProps(true)
    try {
      const props = await getContactoPropiedades(contacto.id)
      setPropVinculadas(props ?? [])
    } catch {}
    finally { setLoadingProps(false) }
  }

  function handleNuevoContactoSaved(contacto) {
    setContactos(prev => [contacto, ...prev])
    handleContactoSelect(contacto)
    setNuevoContactoOpen(false)
  }

  function set(field, value) { setForm(prev => ({ ...prev, [field]: value })) }

  function validate() {
    if (!form.nombre.trim())   return 'El nombre es obligatorio.'
    if (!form.apellido.trim()) return 'El apellido es obligatorio.'
    if (!form.telefono.trim()) return 'El teléfono es obligatorio.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true); setError(null)
    try {
      const tipoOp = contactoSel?.tipo_operacion?.toLowerCase() === 'alquiler' ? 'alquiler' : 'venta'
      const payload = {
        nombre:          form.nombre.trim(),
        apellido:        form.apellido.trim(),
        telefono:        form.telefono.trim(),
        email:           form.email.trim() || null,
        tipo_operacion:  tipoOp,
        etapa_id:        defaultEtapaId,
        asignado_nombre: asignadoNombre || null,
        cliente_id:      clienteId,
        propiedad_id:    propVinculadas[0]?.id || null,
        contacto_id:     contactoSel?.id || null,
      }
      const result = await createProspecto(payload)
      onSaved(result)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const propOptions = propiedades.filter(
    p => !propVinculadas.find(v => v.id === p.id)
  )

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        slotProps={{ paper: { sx: { width: 480, bgcolor: 'white', display: 'flex', flexDirection: 'column' } } }}
      >
        {/* Header */}
        <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box display="flex" alignItems="center" gap={1.25}>
            <Box sx={{ width: 28, height: 28, borderRadius: '7px', bgcolor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GroupIcon sx={{ fontSize: 15, color: ACCENT }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>Nuevo seguimiento</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF' }}>Seleccioná un contacto para comenzar con el seguimiento</Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 3 }}>
          {error && <Alert severity="error" sx={{ mt: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

          <form id="prospecto-form" onSubmit={handleSubmit}>

            {/* Buscar contacto */}
            <SectionLabel>Contacto</SectionLabel>

            <Box display="flex" gap={1} mb={0.5}>
              <Autocomplete
                fullWidth
                options={contactos}
                loading={loadingContactos}
                value={contactoSel}
                onChange={(_, val) => handleContactoSelect(val)}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                getOptionLabel={c => `${c.apellido ?? ''}, ${c.nombre ?? ''}`}
                filterOptions={(opts, { inputValue }) => {
                  const q = inputValue.toLowerCase().trim()
                  if (!q) return opts.slice(0, 30)
                  return opts.filter(c =>
                    (c.nombre   ?? '').toLowerCase().includes(q) ||
                    (c.apellido ?? '').toLowerCase().includes(q) ||
                    (c.dni      ?? '').toLowerCase().includes(q) ||
                    (c.telefono ?? '').toLowerCase().includes(q)
                  )
                }}
                noOptionsText="Sin resultados"
                renderOption={(props, c) => (
                  <Box component="li" {...props} key={c.id} sx={{ ...props.sx, display: 'flex', flexDirection: 'column', alignItems: 'flex-start !important', py: '8px !important' }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                      {c.apellido}, {c.nombre}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
                      {[c.dni && `DNI: ${c.dni}`, c.telefono].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                )}
                renderInput={params => (
                  <TextField
                    {...params}
                    size="small"
                    placeholder="Buscar por nombre, DNI o teléfono..."
                    sx={fieldSx}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingContactos ? <CircularProgress size={13} sx={{ color: ACCENT }} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              <Button
                onClick={() => setNuevoContactoOpen(true)}
                variant="outlined"
                title="Nuevo contacto"
                sx={{
                  minWidth: 40, width: 40, height: 40, p: 0, flexShrink: 0,
                  borderRadius: '8px', borderColor: '#E5E7EB', color: '#6B7280',
                  '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: '#ECFDF5' },
                }}
              >
                <AddIcon sx={{ fontSize: 18 }} />
              </Button>
            </Box>
            <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF', mb: 2 }}>
              Usá "+" para crear un nuevo contacto
            </Typography>

            {/* Datos del contacto */}
            <SectionLabel>Datos del contacto</SectionLabel>

            <Grid container spacing={1.5} mb={2}>
              <Grid item xs={6}>
                <Label required>Nombre</Label>
                <TextField fullWidth size="small" value={form.nombre} onChange={e => set('nombre', e.target.value)} sx={fieldSx} />
              </Grid>
              <Grid item xs={6}>
                <Label required>Apellido</Label>
                <TextField fullWidth size="small" value={form.apellido} onChange={e => set('apellido', e.target.value)} sx={fieldSx} />
              </Grid>
            </Grid>

            <Grid container spacing={1.5} mb={2}>
              <Grid item xs={6}>
                <Label required>Teléfono</Label>
                <TextField fullWidth size="small" value={form.telefono} onChange={e => set('telefono', e.target.value)} sx={fieldSx} />
              </Grid>
              <Grid item xs={6}>
                <Label>Email</Label>
                <TextField fullWidth size="small" type="email" value={form.email} onChange={e => set('email', e.target.value)} sx={fieldSx} />
              </Grid>
            </Grid>

            <Grid container spacing={1.5} mb={1}>
              <Grid item xs={6}>
                <Label>DNI</Label>
                <TextField fullWidth size="small" value={form.dni} onChange={e => set('dni', e.target.value)} sx={fieldSx} />
              </Grid>
            </Grid>

            {/* Propiedades */}
            <SectionLabel>Propiedades vinculadas</SectionLabel>

            {loadingProps ? (
              <Box display="flex" alignItems="center" gap={1} py={1} mb={2}>
                <CircularProgress size={13} sx={{ color: ACCENT }} />
                <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>Cargando propiedades del contacto...</Typography>
              </Box>
            ) : (
              <>
                {propVinculadas.length > 0 && (
                  <Box mb={1.5} sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                    {propVinculadas.map((p, i) => (
                      <Box key={p.id} sx={{
                        display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
                        borderBottom: i < propVinculadas.length - 1 ? '1px solid #F3F4F6' : 'none',
                      }}>
                        <Box flex={1} minWidth={0}>
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.titulo}
                          </Typography>
                          {p.localidad && (
                            <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF' }}>{p.localidad}</Typography>
                          )}
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => setPropVinculadas(prev => prev.filter(x => x.id !== p.id))}
                          sx={{ color: '#9CA3AF', flexShrink: 0, '&:hover': { color: '#EF4444' } }}
                        >
                          <CloseIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}

                <Autocomplete
                  options={propOptions}
                  getOptionLabel={p => `${p.titulo}${p.localidad ? ` — ${p.localidad}` : ''}`}
                  value={null}
                  onChange={(_, val) => { if (val) setPropVinculadas(prev => [...prev, val]) }}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  noOptionsText="Sin propiedades disponibles"
                  renderInput={params => (
                    <TextField {...params} size="small" placeholder="Buscar y agregar propiedad..." sx={fieldSx} />
                  )}
                />
              </>
            )}

          </form>
        </Box>

        {/* Footer */}
        <Box sx={{ px: 3, py: 2, borderTop: '1px solid #E5E7EB', display: 'flex', gap: 1.5, flexShrink: 0 }}>
          <Button
            type="submit" form="prospecto-form" variant="contained" disabled={saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
          >
            {saving ? 'Guardando...' : 'Crear seguimiento'}
          </Button>
          <Button variant="outlined" onClick={onClose}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280', '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' } }}>
            Cancelar
          </Button>
        </Box>
      </Drawer>

      <ContactoFormDrawer
        open={nuevoContactoOpen}
        onClose={() => setNuevoContactoOpen(false)}
        contacto={null}
        clienteId={clienteId}
        onSaved={handleNuevoContactoSaved}
      />
    </>
  )
}
