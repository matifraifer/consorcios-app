import { useEffect, useRef, useState } from 'react'
import {
  Box, Typography, Drawer, IconButton, TextField, Button,
  Alert, CircularProgress, Select, MenuItem, FormControl,
  Divider, Chip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PersonSearchIcon from '@mui/icons-material/PersonSearch'
import { createContrato, updateContrato, getPropiedades, getPropietarioCRM } from '../../services/supabase'
import PropiedadFormDrawer from '../PropiedadFormDrawer'
import ContactoPicker from '../ContactoPicker'

const ACCENT = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'

const TIPOS_ACTUALIZACION = ['IPC', 'ICL', 'Otro']
const PLAZOS_ACTUALIZACION = ['Mensual', 'Trimestral', 'Cuatrimestral', 'Semestral', 'Anual', 'Otro']

const FORM_EMPTY = {
  inquilino_nombre: '',
  inquilino_apellido: '',
  inquilino_dni: '',
  propietario_nombre: '',
  propietario_apellido: '',
  propietario_dni: '',
  propiedad_id: '',
  fecha_inicio: '',
  fecha_fin: '',
  dia_vencimiento: '',
  monto_base: '',
  tipo_actualizacion: '',
  plazo_actualizacion: '',
  observaciones: '',
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
}

const selectSx = {
  fontSize: '0.875rem', borderRadius: '8px',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
}

function Label({ children, required }) {
  return (
    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>
      {children}{required && <Box component="span" sx={{ color: '#EF4444', ml: 0.3 }}>*</Box>}
    </Typography>
  )
}

function SectionTitle({ children }) {
  return (
    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: ACCENT, mt: 3, mb: 1.5 }}>
      {children}
    </Typography>
  )
}

export default function ContratoFormDrawer({ open, onClose, clienteId, onSaved, mode = 'new', contrato = null }) {
  const isEdit = mode === 'edit'

  const [form, setForm] = useState(FORM_EMPTY)
  const [files, setFiles] = useState([])
  const [propiedades, setPropiedades] = useState([])
  const [loadingProps, setLoadingProps] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [propFormOpen, setPropFormOpen] = useState(false)
  const [propietarioLocked, setPropietarioLocked] = useState(false)
  const [pickerInquilinoOpen, setPickerInquilinoOpen] = useState(false)
  const [pickerPropietarioOpen, setPickerPropietarioOpen] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setFiles([])
    setError(null)
    setPropietarioLocked(false)
    loadPropiedades()

    if (isEdit && contrato) {
      setForm({
        inquilino_nombre:     contrato.inquilino_nombre ?? '',
        inquilino_apellido:   contrato.inquilino_apellido ?? '',
        inquilino_dni:        contrato.inquilino_dni ?? '',
        propietario_nombre:   contrato.propietario_nombre ?? '',
        propietario_apellido: contrato.propietario_apellido ?? '',
        propietario_dni:      contrato.propietario_dni ?? '',
        propiedad_id:         contrato.propiedad_id ?? '',
        fecha_inicio:         contrato.fecha_inicio ?? '',
        fecha_fin:            contrato.fecha_fin ?? '',
        dia_vencimiento:      contrato.dia_vencimiento ?? '',
        monto_base:           contrato.monto_base ?? '',
        tipo_actualizacion:   contrato.tipo_actualizacion ?? '',
        plazo_actualizacion:  contrato.plazo_actualizacion ?? '',
        observaciones:        contrato.observaciones ?? '',
      })
    } else {
      setForm(FORM_EMPTY)
    }
  }, [open])

  async function loadPropiedades() {
    setLoadingProps(true)
    try {
      const data = await getPropiedades({ cliente_id: clienteId })
      setPropiedades(data.filter(p => p.tipo_operacion === 'Alquiler'))
    } catch {
      // non-critical
    } finally {
      setLoadingProps(false)
    }
  }

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handlePropiedadChange(propiedadId) {
    set('propiedad_id', propiedadId)
    const prop = propiedades.find(p => p.id === propiedadId)
    if (prop?.propietario_id) {
      const propietario = await getPropietarioCRM(prop.propietario_id)
      if (propietario) {
        setForm(prev => ({
          ...prev,
          propiedad_id: propiedadId,
          propietario_nombre:   propietario.nombre   || '',
          propietario_apellido: propietario.apellido || '',
          propietario_dni:      propietario.dni      || '',
        }))
        setPropietarioLocked(true)
        return
      }
    }
    setPropietarioLocked(false)
    setForm(prev => ({ ...prev, propiedad_id: propiedadId, propietario_nombre: '', propietario_apellido: '', propietario_dni: '' }))
  }

  function handleFilesSelected(e) {
    const selected = Array.from(e.target.files)
    setFiles(prev => [...prev, ...selected])
    e.target.value = ''
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function handlePropiedadSaved(nueva) {
    setPropiedades(prev => [nueva, ...prev])
    setForm(prev => ({ ...prev, propiedad_id: nueva.id }))
    // Autocompletar propietario si la nueva propiedad tiene uno
    if (nueva.propietario_id) {
      const propietario = await getPropietarioCRM(nueva.propietario_id)
      if (propietario) {
        setForm(prev => ({
          ...prev,
          propietario_nombre:   propietario.nombre   || '',
          propietario_apellido: propietario.apellido || '',
          propietario_dni:      propietario.dni      || '',
        }))
        setPropietarioLocked(true)
      }
    }
    setPropFormOpen(false)
  }

  function validate() {
    const required = [
      ['inquilino_nombre', 'Nombre del inquilino'],
      ['inquilino_apellido', 'Apellido del inquilino'],
      ['propietario_nombre', 'Nombre del propietario'],
      ['propietario_apellido', 'Apellido del propietario'],
      ['fecha_inicio', 'Fecha de inicio'],
      ['fecha_fin', 'Fecha de fin'],
      ['propiedad_id', 'Propiedad'],
      ['monto_base', 'Monto base'],
      ['tipo_actualizacion', 'Tipo de actualización'],
      ['plazo_actualizacion', 'Plazo de actualización'],
    ]
    for (const [field, label] of required) {
      if (!form[field]) return `${label} es requerido.`
    }
    if (new Date(form.fecha_fin) <= new Date(form.fecha_inicio)) {
      return 'La fecha de fin debe ser posterior a la de inicio.'
    }
    if (Number(form.monto_base) <= 0) return 'El monto base debe ser mayor a 0.'
    return null
  }

  async function handleSubmit() {
    const err = validate()
    if (err) { setError(err); return }
    setError(null)
    setSaving(true)
    try {
      const payload = {
        inquilino_nombre:     form.inquilino_nombre.trim(),
        inquilino_apellido:   form.inquilino_apellido.trim(),
        inquilino_dni:        form.inquilino_dni.trim() || null,
        propietario_nombre:   form.propietario_nombre.trim(),
        propietario_apellido: form.propietario_apellido.trim(),
        propietario_dni:      form.propietario_dni.trim() || null,
        propiedad_id:         form.propiedad_id,
        fecha_inicio:         form.fecha_inicio,
        fecha_fin:            form.fecha_fin,
        dia_vencimiento:      form.dia_vencimiento || null,
        monto_base:           Number(form.monto_base),
        tipo_actualizacion:   form.tipo_actualizacion,
        plazo_actualizacion:  form.plazo_actualizacion,
        observaciones:        form.observaciones.trim() || null,
      }
      let result
      if (isEdit) {
        result = await updateContrato(contrato.id, payload)
      } else {
        result = await createContrato(payload, files, clienteId)
      }
      onSaved(result)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Drawer
        anchor="right"
        open={open && !propFormOpen}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: '100%', sm: 520 }, display: 'flex', flexDirection: 'column' } }}
      >
        {/* Header */}
        <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <Box>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ACCENT, mb: 0.3 }}>
              Gestión de contratos
            </Typography>
            <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A' }}>
              {isEdit ? 'Editar contrato' : 'Nuevo contrato'}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: '#9CA3AF' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }} onClose={() => setError(null)}>{error}</Alert>}

          {/* Datos inquilino */}
          <SectionTitle>Datos del inquilino</SectionTitle>
          <Box mb={1.5}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PersonSearchIcon sx={{ fontSize: 15 }} />}
              onClick={() => setPickerInquilinoOpen(true)}
              sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.78rem', fontWeight: 600, borderColor: '#E5E7EB', color: '#374151', '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: ACCENT_LIGHT } }}
            >
              Buscar contacto
            </Button>
          </Box>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5} mb={1.5}>
            <Box>
              <Label required>Nombre</Label>
              <TextField fullWidth size="small" value={form.inquilino_nombre} onChange={e => set('inquilino_nombre', e.target.value)} sx={fieldSx} />
            </Box>
            <Box>
              <Label required>Apellido</Label>
              <TextField fullWidth size="small" value={form.inquilino_apellido} onChange={e => set('inquilino_apellido', e.target.value)} sx={fieldSx} />
            </Box>
          </Box>
          <Box>
            <Label>DNI</Label>
            <TextField fullWidth size="small" value={form.inquilino_dni} onChange={e => set('inquilino_dni', e.target.value)} placeholder="Opcional" sx={fieldSx} />
          </Box>

          {/* Datos propietario */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mt={3} mb={1.5}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: ACCENT }}>
              Datos del propietario
            </Typography>
            {propietarioLocked && (
              <Typography sx={{ fontSize: '0.68rem', color: '#6B7280', fontStyle: 'italic' }}>
                Completado desde la propiedad seleccionada
              </Typography>
            )}
          </Box>
          {!propietarioLocked && (
            <Box mb={1.5}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PersonSearchIcon sx={{ fontSize: 15 }} />}
                onClick={() => setPickerPropietarioOpen(true)}
                sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.78rem', fontWeight: 600, borderColor: '#E5E7EB', color: '#374151', '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: ACCENT_LIGHT } }}
              >
                Buscar contacto
              </Button>
            </Box>
          )}
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5} mb={1.5}>
            <Box>
              <Label required>Nombre</Label>
              <TextField fullWidth size="small" value={form.propietario_nombre} onChange={e => set('propietario_nombre', e.target.value)} disabled={propietarioLocked} sx={fieldSx} />
            </Box>
            <Box>
              <Label required>Apellido</Label>
              <TextField fullWidth size="small" value={form.propietario_apellido} onChange={e => set('propietario_apellido', e.target.value)} disabled={propietarioLocked} sx={fieldSx} />
            </Box>
          </Box>
          <Box>
            <Label>DNI</Label>
            <TextField fullWidth size="small" value={form.propietario_dni} onChange={e => set('propietario_dni', e.target.value)} placeholder="Opcional" disabled={propietarioLocked} sx={fieldSx} />
          </Box>

          {/* Datos contrato */}
          <SectionTitle>Datos del contrato</SectionTitle>
          <Box mb={1.5}>
            <Label required>Propiedad</Label>
            <Box display="flex" gap={1} alignItems="center">
              <FormControl fullWidth size="small">
                <Select
                  value={form.propiedad_id}
                  onChange={e => handlePropiedadChange(e.target.value)}
                  displayEmpty
                  sx={selectSx}
                  disabled={loadingProps}
                  renderValue={v => {
                    if (!v) return <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Seleccionar propiedad</Typography>
                    const p = propiedades.find(x => x.id === v)
                    return p ? `${p.titulo} — ${p.localidad ?? ''}` : v
                  }}
                >
                  {propiedades.map(p => (
                    <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.875rem' }}>
                      {p.titulo} <Box component="span" sx={{ ml: 1, fontSize: '0.75rem', color: '#9CA3AF' }}>{p.localidad}</Box>
                    </MenuItem>
                  ))}
                  {propiedades.length === 0 && !loadingProps && (
                    <MenuItem disabled sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>Sin propiedades de alquiler</MenuItem>
                  )}
                </Select>
              </FormControl>
              <IconButton
                onClick={() => setPropFormOpen(true)}
                size="small"
                sx={{ border: `1px solid ${ACCENT}`, borderRadius: '8px', color: ACCENT, p: 0.8, flexShrink: 0, '&:hover': { bgcolor: ACCENT_LIGHT } }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5} mb={1.5}>
            <Box>
              <Label required>Fecha inicio</Label>
              <TextField fullWidth size="small" type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={fieldSx} />
            </Box>
            <Box>
              <Label required>Fecha fin</Label>
              <TextField fullWidth size="small" type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={fieldSx} />
            </Box>
          </Box>

          <Box mb={1.5}>
            <Label>Vencimiento del pago</Label>
            <FormControl fullWidth size="small">
              <Select
                value={form.dia_vencimiento}
                onChange={e => set('dia_vencimiento', e.target.value)}
                displayEmpty
                sx={selectSx}
                renderValue={v => v
                  ? <Typography sx={{ fontSize: '0.875rem' }}>Día {v} de cada mes</Typography>
                  : <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Seleccionar día (opcional)</Typography>
                }
              >
                <MenuItem value="" sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Sin especificar</MenuItem>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <MenuItem key={d} value={d} sx={{ fontSize: '0.875rem' }}>Día {d}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Datos económicos */}
          <SectionTitle>Datos económicos</SectionTitle>
          <Box mb={1.5}>
            <Label required>Monto base (ARS)</Label>
            <TextField
              fullWidth size="small" type="number" value={form.monto_base}
              onChange={e => set('monto_base', e.target.value)}
              slotProps={{ input: { inputProps: { min: 0 } } }}
              sx={fieldSx}
            />
          </Box>

          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5} mb={1.5}>
            <Box>
              <Label required>Tipo de actualización</Label>
              <FormControl fullWidth size="small">
                <Select value={form.tipo_actualizacion} onChange={e => set('tipo_actualizacion', e.target.value)} displayEmpty sx={selectSx}>
                  <MenuItem value="" sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Seleccionar</MenuItem>
                  {TIPOS_ACTUALIZACION.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '0.875rem' }}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <Box>
              <Label required>Plazo de actualización</Label>
              <FormControl fullWidth size="small">
                <Select value={form.plazo_actualizacion} onChange={e => set('plazo_actualizacion', e.target.value)} displayEmpty sx={selectSx}>
                  <MenuItem value="" sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Seleccionar</MenuItem>
                  {PLAZOS_ACTUALIZACION.map(p => <MenuItem key={p} value={p} sx={{ fontSize: '0.875rem' }}>{p}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
          </Box>

          {/* Adjuntos — solo en creación */}
          {!isEdit && <SectionTitle>Documentos adjuntos</SectionTitle>}
          {isEdit && <Box height={8} />}
          {!isEdit && <>
          <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesSelected} />
          <Button
            variant="outlined"
            startIcon={<AttachFileIcon sx={{ fontSize: 16 }} />}
            onClick={() => fileInputRef.current?.click()}
            sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.82rem', fontWeight: 600, borderColor: '#E5E7EB', color: '#374151', '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: ACCENT_LIGHT } }}
          >
            Adjuntar archivos
          </Button>

          {files.length > 0 && (
            <Box mt={1.5} display="flex" flexDirection="column" gap={0.75}>
              {files.map((f, i) => (
                <Box key={i} display="flex" alignItems="center" justifyContent="space-between" sx={{ bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', px: 1.5, py: 0.75 }}>
                  <Box display="flex" alignItems="center" gap={1} minWidth={0}>
                    <AttachFileIcon sx={{ fontSize: 15, color: '#9CA3AF', flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.78rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF', flexShrink: 0 }}>({(f.size / 1024).toFixed(0)} KB)</Typography>
                  </Box>
                  <IconButton size="small" onClick={() => removeFile(i)} sx={{ color: '#9CA3AF', '&:hover': { color: '#EF4444' } }}>
                    <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
          </>}

          {/* Observaciones */}
          <SectionTitle>Observaciones</SectionTitle>
          <TextField
            fullWidth multiline rows={3} size="small"
            placeholder="Notas internas sobre el contrato..."
            value={form.observaciones}
            onChange={e => set('observaciones', e.target.value)}
            sx={fieldSx}
          />

          <Box height={24} />
        </Box>

        {/* Footer */}
        <Divider />
        <Box sx={{ px: 3, py: 2, display: 'flex', gap: 1.5, flexShrink: 0 }}>
          <Button onClick={onClose} disabled={saving} fullWidth variant="outlined" sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, borderColor: '#E5E7EB', color: '#374151', '&:hover': { borderColor: '#9CA3AF' } }}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            fullWidth variant="contained"
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
          >
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear contrato'}
          </Button>
        </Box>
      </Drawer>

      {/* Nested PropiedadFormDrawer */}
      <PropiedadFormDrawer
        open={propFormOpen}
        onClose={() => setPropFormOpen(false)}
        mode="new"
        clienteId={clienteId}
        onSaved={handlePropiedadSaved}
      />

      <ContactoPicker
        open={pickerInquilinoOpen}
        onClose={() => setPickerInquilinoOpen(false)}
        onSelect={contacto => setForm(prev => ({
          ...prev,
          inquilino_nombre:   contacto.nombre,
          inquilino_apellido: contacto.apellido,
          inquilino_dni:      contacto.dni || prev.inquilino_dni,
        }))}
        clienteId={clienteId}
        tipoSugerido="Inquilino"
      />

      <ContactoPicker
        open={pickerPropietarioOpen}
        onClose={() => setPickerPropietarioOpen(false)}
        onSelect={contacto => setForm(prev => ({
          ...prev,
          propietario_nombre:   contacto.nombre,
          propietario_apellido: contacto.apellido,
          propietario_dni:      contacto.dni || prev.propietario_dni,
        }))}
        clienteId={clienteId}
        tipoSugerido="Propietario"
      />
    </>
  )
}
