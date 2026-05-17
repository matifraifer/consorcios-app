import { useEffect, useRef, useState } from 'react'
import {
  Box, Typography, Drawer, IconButton, TextField,
  Button, Alert, CircularProgress, Select, MenuItem,
  FormControl, Grid, LinearProgress,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SellIcon from '@mui/icons-material/Sell'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import PersonSearchIcon from '@mui/icons-material/PersonSearch'
import ContactoPicker from './ContactoPicker'
import imageCompression from 'browser-image-compression'
import {
  createPropiedad, updatePropiedad,
  uploadPropiedadImagen, insertPropiedadImagenes,
  getPropiedadImagenes, deletePropiedadImagen, getPublicImageUrl,
  createPropietarioCRM, updatePropietarioCRM, getPropietarioCRM,
} from '../services/supabase'

const MAX_SIZE_MB = 15
const COMPRESS_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
}

const ACCENT = '#065F46'

const TIPOS = ['Casa', 'Departamento', 'Terreno', 'Local', 'Oficina']
const TIPOS_OPERACION = ['Venta', 'Alquiler']
const LOCALIDADES = [
  'Albardón', 'Angaco', 'Calingasta', 'Capital', 'Caucete', 'Chimbas',
  'Iglesia', 'Jáchal', 'Nueve de Julio', 'Pocito', 'Rawson', 'Rivadavia',
  'San Martín', 'Santa Lucía', 'Sarmiento', 'Ullum', 'Valle Fértil',
  'Veinticinco de Mayo', 'Zonda',
]
const ESTADOS = ['Disponible', 'Reservada', 'Vendida']
const MONEDAS = ['USD', 'ARS']

const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán',
]

const FORM_EMPTY = {
  titulo: '', direccion: '', localidad: '', provincia: '',
  tipo_propiedad: '', tipo_operacion: 'Venta', precio_publicacion: '', moneda: 'USD',
  metros_cubiertos: '', metros_totales: '',
  ambientes: '', dormitorios: '', banios: '', cochera: false,
  descripcion: '', estado: 'Disponible', observaciones_internas: '',
  propietario_id: '',        // ID en tabla propietarios (gestionado internamente)
  propietario_nombre: '',
  propietario_apellido: '',
  propietario_dni: '',
  comprador_nombre: '', comprador_dni: '', comprador_telefono: '',
  fecha_venta: '', precio_final_venta: '',
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

function Label({ children }) {
  return (
    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>
      {children}
    </Typography>
  )
}

function SectionTitle({ children }) {
  return (
    <Typography sx={{
      fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: '#9CA3AF', mb: 2, mt: 3,
    }}>
      {children}
    </Typography>
  )
}

export default function PropiedadFormDrawer({ open, onClose, mode, propiedad, onSaved, clienteId }) {
  const [form, setForm] = useState(FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null) // null | { current, total }
  const [error, setError] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Imágenes
  const fileInputRef = useRef(null)
  const [newFiles, setNewFiles] = useState([])          // { file, preview }[]
  const [existingImages, setExistingImages] = useState([]) // { id, storage_path, publicUrl }[]
  const [toDelete, setToDelete] = useState([])          // { id, storage_path }[]
  const [loadingImages, setLoadingImages] = useState(false)

  useEffect(() => {
    if (!open) {
      newFiles.forEach(f => URL.revokeObjectURL(f.preview))
      setNewFiles([])
      setExistingImages([])
      setToDelete([])
      return
    }
    if (mode === 'edit' && propiedad) {
      setForm({
        titulo: propiedad.titulo ?? '',
        direccion: propiedad.direccion ?? '',
        localidad: propiedad.localidad ?? '',
        provincia: propiedad.provincia ?? '',
        tipo_propiedad: propiedad.tipo_propiedad ?? '',
        tipo_operacion: propiedad.tipo_operacion ?? 'Venta',
        precio_publicacion: propiedad.precio_publicacion ?? '',
        moneda: propiedad.moneda ?? 'USD',
        metros_cubiertos: propiedad.metros_cubiertos ?? '',
        metros_totales: propiedad.metros_totales ?? '',
        ambientes: propiedad.ambientes ?? '',
        dormitorios: propiedad.dormitorios ?? '',
        banios: propiedad.banios ?? '',
        cochera: propiedad.cochera ?? false,
        descripcion: propiedad.descripcion ?? '',
        estado: propiedad.estado ?? 'Disponible',
        observaciones_internas: propiedad.observaciones_internas ?? '',
        propietario_id: propiedad.propietario_id ?? '',
        propietario_nombre: '',
        propietario_apellido: '',
        propietario_dni: '',
        comprador_nombre: propiedad.comprador_nombre ?? '',
        comprador_dni: propiedad.comprador_dni ?? '',
        comprador_telefono: propiedad.comprador_telefono ?? '',
        fecha_venta: propiedad.fecha_venta ?? '',
        precio_final_venta: propiedad.precio_final_venta ?? '',
      })
      setLoadingImages(true)
      getPropiedadImagenes(propiedad.id)
        .then(rows => setExistingImages(rows.map(r => ({
          id: r.id,
          storage_path: r.storage_path,
          publicUrl: getPublicImageUrl(r.storage_path),
        }))))
        .catch(() => {})
        .finally(() => setLoadingImages(false))

      // Cargar datos del propietario si existe
      if (propiedad.propietario_id) {
        getPropietarioCRM(propiedad.propietario_id).then(p => {
          if (p) setForm(prev => ({
            ...prev,
            propietario_nombre: p.nombre ?? '',
            propietario_apellido: p.apellido ?? '',
            propietario_dni: p.dni ?? '',
          }))
        })
      }
    } else {
      setForm(FORM_EMPTY)
    }
    setError(null)
  }, [open, mode, propiedad])

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleContactoSelect(contacto) {
    setForm(prev => ({
      ...prev,
      propietario_nombre:   contacto.nombre,
      propietario_apellido: contacto.apellido,
      propietario_dni:      contacto.dni || prev.propietario_dni,
    }))
  }

  async function handleFilesSelected(e) {
    const raw = Array.from(e.target.files)
    e.target.value = ''

    // Opción B: rechazar archivos que superen el límite
    const oversized = raw.filter(f => f.size > MAX_SIZE_MB * 1024 * 1024)
    if (oversized.length > 0) {
      setError(`${oversized.map(f => `"${f.name}"`).join(', ')} supera${oversized.length > 1 ? 'n' : ''} los ${MAX_SIZE_MB} MB permitidos.`)
      return
    }

    // Opción A: comprimir cada imagen antes de generar la preview
    const entries = await Promise.all(
      raw.map(async file => {
        const compressed = await imageCompression(file, COMPRESS_OPTIONS)
        return { file: compressed, preview: URL.createObjectURL(compressed) }
      })
    )
    setNewFiles(prev => [...prev, ...entries])
  }

  function removeNewFile(index) {
    setNewFiles(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  function removeExistingImage(img) {
    setExistingImages(prev => prev.filter(i => i.id !== img.id))
    setToDelete(prev => [...prev, img])
  }

  function validate() {
    const required = ['titulo', 'direccion', 'localidad', 'provincia', 'tipo_propiedad', 'precio_publicacion', 'moneda', 'metros_cubiertos', 'metros_totales', 'ambientes', 'dormitorios', 'banios']
    for (const f of required) {
      if (!String(form[f]).trim()) return `El campo "${f.replace(/_/g, ' ')}" es obligatorio.`
    }
    if (Number(form.precio_publicacion) <= 0) return 'El precio de publicación debe ser mayor a 0.'
    if (form.estado === 'Vendida') {
      if (!form.fecha_venta) return 'La fecha de venta es obligatoria para propiedades vendidas.'
      if (!form.precio_final_venta || Number(form.precio_final_venta) <= 0)
        return 'El precio final de venta es obligatorio y debe ser mayor a 0.'
    }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    setSaving(true)
    setError(null)

    // Crear o actualizar propietario si se ingresaron datos
    let propietarioId = form.propietario_id || null
    if (form.propietario_nombre.trim() && form.propietario_apellido.trim()) {
      try {
        if (propietarioId) {
          await updatePropietarioCRM(propietarioId, {
            nombre: form.propietario_nombre.trim(),
            apellido: form.propietario_apellido.trim(),
            dni: form.propietario_dni.trim() || null,
          })
        } else {
          const p = await createPropietarioCRM({
            nombre: form.propietario_nombre.trim(),
            apellido: form.propietario_apellido.trim(),
            dni: form.propietario_dni.trim() || null,
            cliente_id: clienteId,
          })
          propietarioId = p.id
        }
      } catch (err) {
        setError(`Error al guardar propietario: ${err.message}`)
        setSaving(false)
        return
      }
    }

    const payload = {
      ...form,
      precio_publicacion: Number(form.precio_publicacion),
      metros_cubiertos:   Number(form.metros_cubiertos),
      metros_totales:     Number(form.metros_totales),
      ambientes:          Number(form.ambientes),
      dormitorios:        Number(form.dormitorios),
      banios:             Number(form.banios),
      precio_final_venta: form.precio_final_venta ? Number(form.precio_final_venta) : null,
      fecha_venta:        form.fecha_venta || null,
      propietario_id:     propietarioId,
      // Limpiar campos venta si no es Vendida
      ...(form.estado !== 'Vendida' && {
        comprador_nombre: null, comprador_dni: null, comprador_telefono: null,
        fecha_venta: null, precio_final_venta: null,
      }),
    }
    // Quitar campos que no existen en la tabla propiedades
    delete payload.propietario_nombre
    delete payload.propietario_apellido
    delete payload.propietario_dni

    try {
      let result
      if (mode === 'edit') {
        result = await updatePropiedad(propiedad.id, payload)
      } else {
        result = await createPropiedad({ ...payload, cliente_id: clienteId })
      }

      // Eliminar imágenes marcadas para borrar
      for (const img of toDelete) {
        await deletePropiedadImagen(img.id, img.storage_path)
      }

      // Subir imágenes nuevas
      if (newFiles.length > 0) {
        const paths = []
        for (let i = 0; i < newFiles.length; i++) {
          setUploadProgress({ current: i + 1, total: newFiles.length })
          const path = await uploadPropiedadImagen(clienteId, result.id, newFiles[i].file)
          paths.push(path)
        }
        await insertPropiedadImagenes(result.id, paths)
        setUploadProgress(null)
      }

      onSaved(result)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const isVendida = form.estado === 'Vendida'

  return (
    <>
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 580, bgcolor: 'white', display: 'flex', flexDirection: 'column' } } }}
    >
      {/* Header fijo */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center" gap={1.25}>
          <Box sx={{ width: 28, height: 28, borderRadius: '7px', bgcolor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SellIcon sx={{ fontSize: 15, color: ACCENT }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
              {mode === 'edit' ? 'Editar propiedad' : 'Nueva propiedad'}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF' }}>
              {mode === 'edit' ? propiedad?.titulo : 'Completá los datos de la propiedad'}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      {/* Contenido scrollable */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 3 }}>
        {error && <Alert severity="error" sx={{ mt: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

        <form id="prop-form" onSubmit={handleSubmit}>

          {/* ── Información general ── */}
          <SectionTitle>Información general</SectionTitle>

          <Box mb={2}>
            <Label>Título *</Label>
            <TextField fullWidth size="small" value={form.titulo}
              onChange={e => set('titulo', e.target.value)} placeholder="Ej: Casa en Palermo con jardín" sx={fieldSx} />
          </Box>

          <Box mb={2}>
            <Label>Dirección *</Label>
            <TextField fullWidth size="small" value={form.direccion}
              onChange={e => set('direccion', e.target.value)} placeholder="Calle y número" sx={fieldSx} />
          </Box>

          <Grid container spacing={1.5} mb={2}>
            <Grid item xs={6}>
              <Label>Provincia *</Label>
              <FormControl fullWidth size="small">
                <Select value={form.provincia} displayEmpty onChange={e => set('provincia', e.target.value)} sx={selectSx}>
                  <MenuItem value="" disabled sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Seleccionar</MenuItem>
                  {PROVINCIAS.map(p => <MenuItem key={p} value={p} sx={{ fontSize: '0.875rem' }}>{p}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <Label>Localidad *</Label>
              <FormControl fullWidth size="small">
                <Select value={form.localidad} displayEmpty onChange={e => set('localidad', e.target.value)} sx={selectSx}>
                  <MenuItem value="" disabled sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Seleccionar</MenuItem>
                  {LOCALIDADES.map(l => <MenuItem key={l} value={l} sx={{ fontSize: '0.875rem' }}>{l}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Grid container spacing={1.5} mb={2}>
            <Grid item xs={6}>
              <Label>Tipo de propiedad *</Label>
              <FormControl fullWidth size="small">
                <Select value={form.tipo_propiedad} displayEmpty onChange={e => set('tipo_propiedad', e.target.value)} sx={selectSx}>
                  <MenuItem value="" disabled sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Seleccionar</MenuItem>
                  {TIPOS.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '0.875rem' }}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <Label>Tipo de operación *</Label>
              <FormControl fullWidth size="small">
                <Select value={form.tipo_operacion} onChange={e => set('tipo_operacion', e.target.value)} sx={selectSx}>
                  {TIPOS_OPERACION.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '0.875rem' }}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* ── Características ── */}
          <SectionTitle>Características</SectionTitle>

          <Grid container spacing={1.5} mb={2}>
            <Grid item xs={4}>
              <Label>Metros cubiertos *</Label>
              <TextField fullWidth size="small" type="number" value={form.metros_cubiertos}
                onChange={e => set('metros_cubiertos', e.target.value)} inputProps={{ min: 0 }} sx={fieldSx} />
            </Grid>
            <Grid item xs={4}>
              <Label>Metros totales *</Label>
              <TextField fullWidth size="small" type="number" value={form.metros_totales}
                onChange={e => set('metros_totales', e.target.value)} inputProps={{ min: 0 }} sx={fieldSx} />
            </Grid>
            <Grid item xs={4}>
              <Label>Ambientes *</Label>
              <TextField fullWidth size="small" type="number" value={form.ambientes}
                onChange={e => set('ambientes', e.target.value)} inputProps={{ min: 0 }} sx={fieldSx} />
            </Grid>
          </Grid>

          <Grid container spacing={1.5} mb={2}>
            <Grid item xs={4}>
              <Label>Dormitorios *</Label>
              <TextField fullWidth size="small" type="number" value={form.dormitorios}
                onChange={e => set('dormitorios', e.target.value)} inputProps={{ min: 0 }} sx={fieldSx} />
            </Grid>
            <Grid item xs={4}>
              <Label>Baños *</Label>
              <TextField fullWidth size="small" type="number" value={form.banios}
                onChange={e => set('banios', e.target.value)} inputProps={{ min: 0 }} sx={fieldSx} />
            </Grid>
            <Grid item xs={4}>
              <Label>Cochera</Label>
              <FormControl fullWidth size="small">
                <Select value={form.cochera ? 'si' : 'no'} onChange={e => set('cochera', e.target.value === 'si')} sx={selectSx}>
                  <MenuItem value="no" sx={{ fontSize: '0.875rem' }}>No</MenuItem>
                  <MenuItem value="si" sx={{ fontSize: '0.875rem' }}>Sí</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* ── Precio y estado ── */}
          <SectionTitle>Precio y estado</SectionTitle>

          <Grid container spacing={1.5} mb={2}>
            <Grid item xs={6}>
              <Label>Precio de publicación *</Label>
              <TextField fullWidth size="small" type="number" value={form.precio_publicacion}
                onChange={e => set('precio_publicacion', e.target.value)} inputProps={{ min: 0 }} sx={fieldSx} />
            </Grid>
            <Grid item xs={3}>
              <Label>Moneda *</Label>
              <FormControl fullWidth size="small">
                <Select value={form.moneda} onChange={e => set('moneda', e.target.value)} sx={selectSx}>
                  {MONEDAS.map(m => <MenuItem key={m} value={m} sx={{ fontSize: '0.875rem' }}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={3}>
              <Label>Estado</Label>
              <FormControl fullWidth size="small">
                <Select value={form.estado} onChange={e => set('estado', e.target.value)} sx={selectSx}>
                  {ESTADOS.map(s => <MenuItem key={s} value={s} sx={{ fontSize: '0.875rem' }}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* ── Descripción ── */}
          <SectionTitle>Descripción</SectionTitle>

          <Box mb={2}>
            <Label>Descripción de la propiedad</Label>
            <TextField fullWidth multiline rows={3} size="small" value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              placeholder="Describí las características destacadas de la propiedad..." sx={fieldSx} />
          </Box>

          <Box mb={2}>
            <Label>Observaciones internas</Label>
            <TextField fullWidth multiline rows={2} size="small" value={form.observaciones_internas}
              onChange={e => set('observaciones_internas', e.target.value)}
              placeholder="Notas internas del equipo (no visibles al cliente)..." sx={fieldSx} />
          </Box>

          {/* ── Propietario ── */}
          <SectionTitle>Propietario asociado</SectionTitle>

          <Box mb={2}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PersonSearchIcon sx={{ fontSize: 15 }} />}
              onClick={() => setPickerOpen(true)}
              sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.78rem', fontWeight: 600, borderColor: '#E5E7EB', color: '#374151', '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: '#ECFDF5' } }}
            >
              Buscar contacto
            </Button>
          </Box>

          <Grid container spacing={1.5} mb={2}>
            <Grid item xs={6}>
              <Label>Nombre</Label>
              <TextField fullWidth size="small" value={form.propietario_nombre}
                onChange={e => set('propietario_nombre', e.target.value)} placeholder="Opcional" sx={fieldSx} />
            </Grid>
            <Grid item xs={6}>
              <Label>Apellido</Label>
              <TextField fullWidth size="small" value={form.propietario_apellido}
                onChange={e => set('propietario_apellido', e.target.value)} placeholder="Opcional" sx={fieldSx} />
            </Grid>
          </Grid>
          <Box mb={2}>
            <Label>DNI</Label>
            <TextField fullWidth size="small" value={form.propietario_dni}
              onChange={e => set('propietario_dni', e.target.value)} placeholder="Opcional" sx={fieldSx} />
          </Box>

          {/* ── Fotos ── */}
          <SectionTitle>Fotos</SectionTitle>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFilesSelected}
          />

          {/* Imágenes existentes (modo editar) */}
          {loadingImages && (
            <Box display="flex" alignItems="center" gap={1} mb={1.5}>
              <CircularProgress size={14} sx={{ color: '#9CA3AF' }} />
              <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Cargando fotos...</Typography>
            </Box>
          )}

          {(existingImages.length > 0 || newFiles.length > 0) && (
            <Box display="flex" flexWrap="wrap" gap={1.5} mb={1.5}>
              {existingImages.map(img => (
                <Box
                  key={img.id}
                  sx={{ position: 'relative', width: 96, height: 72, borderRadius: '8px', overflow: 'hidden', border: '1px solid #E5E7EB', flexShrink: 0 }}
                >
                  <Box
                    component="img"
                    src={img.publicUrl}
                    alt=""
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => removeExistingImage(img)}
                    sx={{
                      position: 'absolute', top: 2, right: 2,
                      bgcolor: 'rgba(0,0,0,0.55)', color: '#fff', p: 0.25,
                      '&:hover': { bgcolor: 'rgba(239,68,68,0.85)' },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                </Box>
              ))}

              {newFiles.map((f, i) => (
                <Box
                  key={i}
                  sx={{ position: 'relative', width: 96, height: 72, borderRadius: '8px', overflow: 'hidden', border: '1px dashed #10B981', flexShrink: 0 }}
                >
                  <Box
                    component="img"
                    src={f.preview}
                    alt=""
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => removeNewFile(i)}
                    sx={{
                      position: 'absolute', top: 2, right: 2,
                      bgcolor: 'rgba(0,0,0,0.55)', color: '#fff', p: 0.25,
                      '&:hover': { bgcolor: 'rgba(239,68,68,0.85)' },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}

          <Button
            variant="outlined"
            startIcon={<AddPhotoAlternateIcon sx={{ fontSize: 16 }} />}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              mb: 3,
              borderColor: '#E5E7EB', color: '#6B7280', borderRadius: '8px',
              textTransform: 'none', fontSize: '0.8rem', fontWeight: 500,
              '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: '#F0FDF4' },
            }}
          >
            Agregar fotos
          </Button>

          {/* ── Datos de venta (solo si Vendida) ── */}
          {isVendida && (
            <>
              <Box sx={{ bgcolor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', p: 2, mb: 2, mt: 1 }}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#92400E', mb: 2 }}>
                  Datos de la venta
                </Typography>

                <Grid container spacing={1.5} mb={1.5}>
                  <Grid item xs={8}>
                    <Label>Nombre del comprador</Label>
                    <TextField fullWidth size="small" value={form.comprador_nombre}
                      onChange={e => set('comprador_nombre', e.target.value)} sx={fieldSx} />
                  </Grid>
                  <Grid item xs={4}>
                    <Label>DNI comprador</Label>
                    <TextField fullWidth size="small" value={form.comprador_dni}
                      onChange={e => set('comprador_dni', e.target.value)} sx={fieldSx} />
                  </Grid>
                </Grid>

                <Grid container spacing={1.5} mb={1.5}>
                  <Grid item xs={6}>
                    <Label>Teléfono comprador</Label>
                    <TextField fullWidth size="small" value={form.comprador_telefono}
                      onChange={e => set('comprador_telefono', e.target.value)} sx={fieldSx} />
                  </Grid>
                  <Grid item xs={6}>
                    <Label>Fecha de venta *</Label>
                    <TextField fullWidth size="small" type="date" value={form.fecha_venta}
                      onChange={e => set('fecha_venta', e.target.value)} sx={fieldSx}
                      slotProps={{ input: { sx: { fontSize: '0.875rem' } } }} />
                  </Grid>
                </Grid>

                <Box>
                  <Label>Precio final de venta *</Label>
                  <TextField fullWidth size="small" type="number" value={form.precio_final_venta}
                    onChange={e => set('precio_final_venta', e.target.value)} inputProps={{ min: 0 }} sx={fieldSx} />
                </Box>
              </Box>
            </>
          )}
        </form>
      </Box>

      {/* Footer fijo */}
      <Box sx={{ borderTop: '1px solid #E5E7EB', flexShrink: 0 }}>
        {uploadProgress && (
          <Box sx={{ px: 3, pt: 1.5 }}>
            <Box display="flex" justifyContent="space-between" mb={0.5}>
              <Typography sx={{ fontSize: '0.7rem', color: '#6B7280' }}>
                Subiendo foto {uploadProgress.current} de {uploadProgress.total}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF' }}>
                {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={(uploadProgress.current / uploadProgress.total) * 100}
              sx={{
                borderRadius: 4, height: 4, bgcolor: '#E5E7EB',
                '& .MuiLinearProgress-bar': { bgcolor: '#065F46', borderRadius: 4 },
              }}
            />
          </Box>
        )}
        <Box sx={{ px: 3, py: 2, display: 'flex', gap: 1.5 }}>
        <Button
          type="submit"
          form="prop-form"
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{
            bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
            fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none',
            '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
          }}
        >
          {uploadProgress
        ? `Subiendo foto ${uploadProgress.current} de ${uploadProgress.total}...`
        : saving ? 'Guardando...' : mode === 'edit' ? 'Guardar cambios' : 'Crear propiedad'
      }
        </Button>
        <Button
          variant="outlined"
          onClick={onClose}
          sx={{
            borderRadius: '8px', textTransform: 'none', fontWeight: 500,
            fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280',
            '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' },
          }}
        >
          Cancelar
        </Button>
        </Box>
      </Box>
    </Drawer>

    <ContactoPicker
      open={pickerOpen}
      onClose={() => setPickerOpen(false)}
      onSelect={handleContactoSelect}
      clienteId={clienteId}
      tipoSugerido="Vendedor"
    />
  </>
  )
}
