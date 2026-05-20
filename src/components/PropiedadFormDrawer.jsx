import { useEffect, useRef, useState } from 'react'
import {
  Box, Typography, Drawer, IconButton, TextField,
  Button, Alert, CircularProgress, Select, MenuItem,
  FormControl, Grid, LinearProgress, Tooltip, Autocomplete,
} from '@mui/material'
import CloseIcon            from '@mui/icons-material/Close'
import SellIcon             from '@mui/icons-material/Sell'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import AddIcon              from '@mui/icons-material/Add'
import RoomIcon             from '@mui/icons-material/Room'
import CloseRoundedIcon     from '@mui/icons-material/CloseRounded'
import ContactoFormDrawer from './contactos/ContactoFormDrawer'
import imageCompression from 'browser-image-compression'
import {
  createPropiedad, updatePropiedad,
  uploadPropiedadImagen, insertPropiedadImagenes,
  getPropiedadImagenes, deletePropiedadImagen, getPublicImageUrl,
  buscarContactos, getPropiedadContactos, setPropiedadContactos,
} from '../services/supabase'

const MAX_SIZE_MB = 15
const COMPRESS_OPTIONS = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true }
const ACCENT = '#065F46'

const TIPO_META = {
  Comprador:    { color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
  Vendedor:     { color: '#B45309', bg: '#FFFBEB', border: '#FCD34D' },
  Arrendatario: { color: '#1D4ED8', bg: '#EFF6FF', border: '#93C5FD' },
  Locatario:    { color: ACCENT,    bg: '#ECFDF5', border: '#6EE7B7' },
}

const TIPOS          = ['Casa', 'Departamento', 'Terreno', 'Local', 'Oficina']
const TIPOS_OPERACION = ['Venta', 'Alquiler']
const ESTADOS        = ['Disponible', 'Reservada', 'Vendida']
const MONEDAS        = ['USD', 'ARS']

const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán',
]

const LOCALIDADES_SAN_JUAN = [
  'Albardón', 'Angaco', 'Calingasta', 'Capital', 'Caucete', 'Chimbas',
  'Iglesia', 'Jáchal', 'Nueve de Julio', 'Pocito', 'Rawson', 'Rivadavia',
  'San Martín', 'Santa Lucía', 'Sarmiento', 'Ullum', 'Valle Fértil',
  'Veinticinco de Mayo', 'Zonda',
]

const FORM_EMPTY = {
  titulo: '',
  provincia: '', localidad: '', direccion: '', latitud: '', longitud: '',
  tipo_propiedad: '', tipo_operacion: 'Venta',
  metros_cubiertos: '', metros_totales: '',
  ambientes: '', dormitorios: '', banios: '', cochera: false,
  descripcion: '',
  observaciones_internas: '',
  precio_publicacion: '', moneda: 'USD', estado: 'Disponible',
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

function Label({ children, required }) {
  return (
    <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151' }}>
        {children}
      </Typography>
      {required && (
        <Typography component="span" sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#EF4444', lineHeight: 1 }}>*</Typography>
      )}
    </Box>
  )
}

function SectionTitle({ children }) {
  return (
    <Typography sx={{
      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: ACCENT, mb: 1.5, mt: 3,
    }}>
      {children}
    </Typography>
  )
}

export default function PropiedadFormDrawer({ open, onClose, mode, propiedad, onSaved, clienteId }) {
  const [form, setForm]                         = useState(FORM_EMPTY)
  const [saving, setSaving]                     = useState(false)
  const [uploadProgress, setUploadProgress]     = useState(null)
  const [error, setError]                       = useState(null)
  const [contactoDrawerOpen, setContactoDrawerOpen] = useState(false)
  const [contactoOpciones, setContactoOpciones] = useState([])
  const [busquedaContacto, setBusquedaContacto] = useState('')
  const [loadingBusqueda, setLoadingBusqueda]   = useState(false)
  const [contactosVinculados, setContactosVinculados] = useState([])  // [{...contacto, tipo}]
  const [loadingContactos, setLoadingContactos] = useState(false)

  // Images — unified list: { type: 'existing'|'new', id?, storage_path?, publicUrl?, file?, preview? }
  const [images, setImages]       = useState([])
  const [dragOver, setDragOver]   = useState(null)
  const origExisting              = useRef([])
  const dragIndexRef              = useRef(null)
  const fileInputRef              = useRef(null)

  useEffect(() => {
    if (!busquedaContacto.trim() || busquedaContacto.length < 2) { setContactoOpciones([]); return }
    const timer = setTimeout(() => {
      setLoadingBusqueda(true)
      buscarContactos(clienteId, busquedaContacto)
        .then(setContactoOpciones)
        .catch(() => {})
        .finally(() => setLoadingBusqueda(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [busquedaContacto, clienteId])

  const isSanJuan = form.provincia === 'San Juan'
  const isVendida = form.estado === 'Vendida'

  useEffect(() => {
    if (!open) {
      images.filter(i => i.type === 'new').forEach(i => URL.revokeObjectURL(i.preview))
      setImages([])
      origExisting.current = []
      setContactosVinculados([])
      return
    }

    setError(null)

    if (mode === 'edit' && propiedad) {
      setForm({
        titulo:                 propiedad.titulo                 ?? '',
        provincia:              propiedad.provincia              ?? '',
        localidad:              propiedad.localidad              ?? '',
        direccion:              propiedad.direccion              ?? '',
        latitud:                propiedad.latitud                ?? '',
        longitud:               propiedad.longitud               ?? '',
        tipo_propiedad:         propiedad.tipo_propiedad         ?? '',
        tipo_operacion:         propiedad.tipo_operacion         ?? 'Venta',
        metros_cubiertos:       propiedad.metros_cubiertos       ?? '',
        metros_totales:         propiedad.metros_totales         ?? '',
        ambientes:              propiedad.ambientes              ?? '',
        dormitorios:            propiedad.dormitorios            ?? '',
        banios:                 propiedad.banios                 ?? '',
        cochera:                propiedad.cochera                ?? false,
        descripcion:            propiedad.descripcion            ?? '',
        observaciones_internas: propiedad.observaciones_internas ?? '',
        precio_publicacion:     propiedad.precio_publicacion     ?? '',
        moneda:                 propiedad.moneda                 ?? 'USD',
        estado:                 propiedad.estado                 ?? 'Disponible',
        comprador_nombre:       propiedad.comprador_nombre       ?? '',
        comprador_dni:          propiedad.comprador_dni          ?? '',
        comprador_telefono:     propiedad.comprador_telefono     ?? '',
        fecha_venta:            propiedad.fecha_venta            ?? '',
        precio_final_venta:     propiedad.precio_final_venta     ?? '',
      })

      getPropiedadImagenes(propiedad.id)
        .then(rows => {
          const existing = rows.map(r => ({
            type: 'existing', id: r.id,
            storage_path: r.storage_path,
            publicUrl: getPublicImageUrl(r.storage_path),
          }))
          setImages(existing)
          origExisting.current = existing
        })
        .catch(() => {})

      setLoadingContactos(true)
      getPropiedadContactos(propiedad.id)
        .then(setContactosVinculados)
        .catch(() => {})
        .finally(() => setLoadingContactos(false))
    } else {
      setForm(FORM_EMPTY)
      setImages([])
      origExisting.current = []
      setContactosVinculados([])
    }
  }, [open, mode, propiedad])

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleProvinciaChange(val) {
    setForm(prev => ({ ...prev, provincia: val, localidad: '' }))
  }

  function addContactoVinculado(contacto) {
    if (contactosVinculados.find(c => c.id === contacto.id)) return
    setContactosVinculados(prev => [...prev, contacto])
    setBusquedaContacto('')
    setContactoOpciones([])
  }

  function removeContactoVinculado(contactoId) {
    setContactosVinculados(prev => prev.filter(c => c.id !== contactoId))
  }

  function handleNewContactoSaved(contacto) {
    if (!contactosVinculados.find(c => c.id === contacto.id)) {
      setContactosVinculados(prev => [...prev, contacto])
    }
  }

  async function handleFilesSelected(e) {
    const raw = Array.from(e.target.files)
    e.target.value = ''
    const oversized = raw.filter(f => f.size > MAX_SIZE_MB * 1024 * 1024)
    if (oversized.length) {
      setError(`${oversized.map(f => `"${f.name}"`).join(', ')} supera${oversized.length > 1 ? 'n' : ''} los ${MAX_SIZE_MB} MB permitidos.`)
      return
    }
    const entries = await Promise.all(
      raw.map(async file => {
        const compressed = await imageCompression(file, COMPRESS_OPTIONS)
        return { type: 'new', file: compressed, preview: URL.createObjectURL(compressed) }
      })
    )
    setImages(prev => [...prev, ...entries])
  }

  function removeImage(index) {
    setImages(prev => {
      const item = prev[index]
      if (item.type === 'new') URL.revokeObjectURL(item.preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  // Drag & drop
  function handleDragStart(index) {
    dragIndexRef.current = index
  }
  function handleDragOver(e, index) {
    e.preventDefault()
    setDragOver(index)
  }
  function handleDrop(index) {
    const from = dragIndexRef.current
    if (from === null || from === index) { setDragOver(null); return }
    setImages(prev => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(index, 0, item)
      return next
    })
    dragIndexRef.current = null
    setDragOver(null)
  }

  function validate() {
    if (!form.tipo_propiedad) return 'El tipo de propiedad es obligatorio.'
    if (!form.tipo_operacion) return 'El tipo de operación es obligatorio.'
    if (!form.precio_publicacion || Number(form.precio_publicacion) <= 0)
      return 'El precio de publicación es obligatorio y debe ser mayor a 0.'
    if (isVendida) {
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

    const payload = {
      titulo:                 form.titulo.trim() || null,
      provincia:              form.provincia || null,
      localidad:              form.localidad || null,
      direccion:              form.direccion.trim() || null,
      latitud:                form.latitud !== '' ? parseFloat(form.latitud) : null,
      longitud:               form.longitud !== '' ? parseFloat(form.longitud) : null,
      tipo_propiedad:         form.tipo_propiedad,
      tipo_operacion:         form.tipo_operacion,
      metros_cubiertos:       form.metros_cubiertos ? Number(form.metros_cubiertos) : null,
      metros_totales:         form.metros_totales   ? Number(form.metros_totales)   : null,
      ambientes:              form.ambientes         ? Number(form.ambientes)         : null,
      dormitorios:            form.dormitorios       ? Number(form.dormitorios)       : null,
      banios:                 form.banios            ? Number(form.banios)            : null,
      cochera:                form.cochera,
      descripcion:            form.descripcion.trim() || null,
      observaciones_internas: form.observaciones_internas.trim() || null,
      precio_publicacion:     Number(form.precio_publicacion),
      moneda:                 form.moneda,
      estado:                 form.estado,
      ...(isVendida ? {
        comprador_nombre:   form.comprador_nombre.trim()  || null,
        comprador_dni:      form.comprador_dni.trim()     || null,
        comprador_telefono: form.comprador_telefono.trim()|| null,
        fecha_venta:        form.fecha_venta              || null,
        precio_final_venta: Number(form.precio_final_venta),
      } : {
        comprador_nombre: null, comprador_dni: null, comprador_telefono: null,
        fecha_venta: null, precio_final_venta: null,
      }),
    }

    try {
      let result
      if (mode === 'edit') {
        result = await updatePropiedad(propiedad.id, payload)
      } else {
        result = await createPropiedad({ ...payload, cliente_id: clienteId })
      }

      // Delete removed existing images
      const toDelete = origExisting.current.filter(
        orig => !images.find(img => img.type === 'existing' && img.id === orig.id)
      )
      for (const img of toDelete) {
        await deletePropiedadImagen(img.id, img.storage_path)
      }

      // Upload new images
      const newImages = images.filter(img => img.type === 'new')
      if (newImages.length > 0) {
        const paths = []
        for (let i = 0; i < newImages.length; i++) {
          setUploadProgress({ current: i + 1, total: newImages.length })
          const path = await uploadPropiedadImagen(clienteId, result.id, newImages[i].file)
          paths.push(path)
        }
        await insertPropiedadImagenes(result.id, paths)
        setUploadProgress(null)
      }

      await setPropiedadContactos(result.id, contactosVinculados.map(c => c.id))

      onSaved(result)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        slotProps={{ paper: { sx: { width: 580, bgcolor: 'white', display: 'flex', flexDirection: 'column' } } }}
      >
        {/* Header */}
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
                {mode === 'edit' ? propiedad?.titulo || 'Sin título' : 'Completá los datos de la propiedad'}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 4 }}>
          {error && <Alert severity="error" sx={{ mt: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

          <form id="prop-form" onSubmit={handleSubmit}>

            {/* ── 1. Título ── */}
            <SectionTitle>Título de la publicación</SectionTitle>
            <Box mb={2}>
              <Label>Título</Label>
              <TextField fullWidth size="small" value={form.titulo}
                onChange={e => set('titulo', e.target.value)}
                placeholder="Ej: Casa en Capital con jardín y cochera"
                sx={fieldSx} />
            </Box>

            {/* ── 2. Ubicación ── */}
            <SectionTitle>Ubicación</SectionTitle>

            <Grid container spacing={1.5} mb={2}>
              <Grid item xs={6}>
                <Label>Provincia</Label>
                <FormControl fullWidth size="small">
                  <Select value={form.provincia} displayEmpty onChange={e => handleProvinciaChange(e.target.value)} sx={selectSx}>
                    <MenuItem value="" disabled sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Seleccionar</MenuItem>
                    {PROVINCIAS.map(p => <MenuItem key={p} value={p} sx={{ fontSize: '0.875rem' }}>{p}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <Label>Localidad</Label>
                {isSanJuan ? (
                  <FormControl fullWidth size="small">
                    <Select
                      value={form.localidad}
                      displayEmpty
                      disabled={!form.provincia}
                      onChange={e => set('localidad', e.target.value)}
                      sx={selectSx}
                    >
                      <MenuItem value="" disabled sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Seleccionar</MenuItem>
                      {LOCALIDADES_SAN_JUAN.map(l => <MenuItem key={l} value={l} sx={{ fontSize: '0.875rem' }}>{l}</MenuItem>)}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    fullWidth size="small"
                    value={form.localidad}
                    disabled={!form.provincia}
                    onChange={e => set('localidad', e.target.value)}
                    placeholder={form.provincia ? 'Ingresá la localidad' : 'Seleccioná una provincia primero'}
                    sx={fieldSx}
                  />
                )}
              </Grid>
            </Grid>

            <Box mb={2}>
              <Label>Dirección</Label>
              <TextField fullWidth size="small" value={form.direccion}
                onChange={e => set('direccion', e.target.value)}
                placeholder="Calle y número"
                sx={fieldSx} />
            </Box>

            {/* Coordenadas */}
            <Box mb={2}>
              <Label>Coordenadas</Label>
              <TextField
                fullWidth size="small"
                value={[form.latitud, form.longitud].filter(Boolean).join(', ')}
                onChange={e => {
                  const raw = e.target.value
                  const commaIdx = raw.indexOf(',')
                  if (commaIdx !== -1) {
                    setForm(prev => ({ ...prev, latitud: raw.slice(0, commaIdx).trim(), longitud: raw.slice(commaIdx + 1).trim() }))
                  } else {
                    setForm(prev => ({ ...prev, latitud: raw.trim(), longitud: '' }))
                  }
                }}
                placeholder="Ej: -31.5375, -68.5364"
                helperText="Pegá las coordenadas de Google Maps directamente (clic derecho → copiar coordenadas)"
                sx={{ ...fieldSx, '& .MuiFormHelperText-root': { fontSize: '0.68rem', color: '#9CA3AF', mx: 0 } }}
              />
            </Box>

            {!isNaN(parseFloat(form.latitud)) && !isNaN(parseFloat(form.longitud)) ? (
              <Box mb={2} sx={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #E5E7EB', height: 200 }}>
                <Box
                  component="iframe"
                  title="Mapa"
                  src={`https://www.google.com/maps?q=${form.latitud},${form.longitud}&output=embed`}
                  sx={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </Box>
            ) : (
              <Box mb={2} sx={{ border: '1.5px dashed #E5E7EB', borderRadius: '10px', p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#F9FAFB' }}>
                <RoomIcon sx={{ fontSize: 22, color: '#D1D5DB', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
                  Ingresá latitud y longitud para ver la ubicación en el mapa. Podés obtenerlas haciendo clic derecho sobre cualquier punto en Google Maps.
                </Typography>
              </Box>
            )}

            {/* ── 3. Características ── */}
            <SectionTitle>Características</SectionTitle>

            <Grid container spacing={1.5} mb={2}>
              <Grid item xs={6}>
                <Label required>Tipo de propiedad</Label>
                <FormControl fullWidth size="small">
                  <Select value={form.tipo_propiedad} displayEmpty onChange={e => set('tipo_propiedad', e.target.value)} sx={selectSx}>
                    <MenuItem value="" disabled sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Seleccionar</MenuItem>
                    {TIPOS.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '0.875rem' }}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <Label required>Tipo de operación</Label>
                <FormControl fullWidth size="small">
                  <Select value={form.tipo_operacion} onChange={e => set('tipo_operacion', e.target.value)} sx={selectSx}>
                    {TIPOS_OPERACION.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '0.875rem' }}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Grid container spacing={1.5} mb={2}>
              <Grid item xs={4}>
                <Label>Ambientes</Label>
                <TextField fullWidth size="small" type="number" value={form.ambientes}
                  onChange={e => set('ambientes', e.target.value)} inputProps={{ min: 0 }} sx={fieldSx} />
              </Grid>
              <Grid item xs={4}>
                <Label>Dormitorios</Label>
                <TextField fullWidth size="small" type="number" value={form.dormitorios}
                  onChange={e => set('dormitorios', e.target.value)} inputProps={{ min: 0 }} sx={fieldSx} />
              </Grid>
              <Grid item xs={4}>
                <Label>Baños</Label>
                <TextField fullWidth size="small" type="number" value={form.banios}
                  onChange={e => set('banios', e.target.value)} inputProps={{ min: 0 }} sx={fieldSx} />
              </Grid>
            </Grid>

            <Grid container spacing={1.5} mb={2}>
              <Grid item xs={4}>
                <Label>Metros cubiertos</Label>
                <TextField fullWidth size="small" type="number" value={form.metros_cubiertos}
                  onChange={e => set('metros_cubiertos', e.target.value)} inputProps={{ min: 0 }} sx={fieldSx} />
              </Grid>
              <Grid item xs={4}>
                <Label>Metros totales</Label>
                <TextField fullWidth size="small" type="number" value={form.metros_totales}
                  onChange={e => set('metros_totales', e.target.value)} inputProps={{ min: 0 }} sx={fieldSx} />
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

            {/* ── 4. Precio y estado ── */}
            <SectionTitle>Precio y estado</SectionTitle>

            <Grid container spacing={1.5} mb={2}>
              <Grid item xs={6}>
                <Label required>Precio de publicación</Label>
                <TextField fullWidth size="small" type="number" value={form.precio_publicacion}
                  onChange={e => set('precio_publicacion', e.target.value)} inputProps={{ min: 0 }} sx={fieldSx} />
              </Grid>
              <Grid item xs={3}>
                <Label>Moneda</Label>
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

            {/* ── 5. Descripción ── */}
            <SectionTitle>Descripción de la publicación</SectionTitle>
            <Box mb={2}>
              <Label>Descripción</Label>
              <TextField fullWidth multiline rows={3} size="small" value={form.descripcion}
                onChange={e => set('descripcion', e.target.value)}
                placeholder="Describí las características destacadas de la propiedad..."
                sx={fieldSx} />
            </Box>

            {/* ── 6. Observaciones internas ── */}
            <SectionTitle>Observaciones internas</SectionTitle>
            <Box mb={2}>
              <Label>Observaciones</Label>
              <TextField fullWidth multiline rows={2} size="small" value={form.observaciones_internas}
                onChange={e => set('observaciones_internas', e.target.value)}
                placeholder="Notas internas del equipo (no visibles al cliente)..."
                sx={fieldSx} />
            </Box>

            {/* ── 7. Contactos vinculados ── */}
            <SectionTitle>Contactos vinculados</SectionTitle>

            {loadingContactos ? (
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <CircularProgress size={14} sx={{ color: ACCENT }} />
                <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Cargando contactos...</Typography>
              </Box>
            ) : (
              <>
                {contactosVinculados.length > 0 && (
                  <Box mb={1.5} sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                    {contactosVinculados.map((c, i) => (
                      <Box key={c.id} sx={{
                        display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
                        borderBottom: i < contactosVinculados.length - 1 ? '1px solid #F3F4F6' : 'none',
                      }}>
                        <Box flex={1} minWidth={0}>
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.apellido}, {c.nombre}
                          </Typography>
                          <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF' }}>
                            {[c.dni && `DNI: ${c.dni}`, c.telefono].filter(Boolean).join(' · ')}
                          </Typography>
                        </Box>
                        {(c.tipos?.length > 0 || c.tipo) && (
                          <Box display="flex" gap={0.5} flexShrink={0}>
                            {(c.tipos?.length ? c.tipos : [c.tipo]).map(t => {
                              const m = TIPO_META[t] ?? { color: '#374151', bg: '#F3F4F6', border: '#E5E7EB' }
                              return (
                                <Box key={t} sx={{ px: 0.75, py: 0.2, borderRadius: '5px', bgcolor: m.bg, border: `1px solid ${m.border}` }}>
                                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: m.color }}>{t}</Typography>
                                </Box>
                              )
                            })}
                          </Box>
                        )}
                        <IconButton size="small" onClick={() => removeContactoVinculado(c.id)}
                          sx={{ color: '#9CA3AF', '&:hover': { color: '#EF4444' }, flexShrink: 0 }}>
                          <CloseRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}

                <Box display="flex" gap={1} alignItems="flex-start" mb={2}>
                  <Autocomplete
                    sx={{ flex: 1 }}
                    size="small"
                    options={contactoOpciones.filter(o => !contactosVinculados.find(c => c.id === o.id))}
                    getOptionLabel={o => `${o.apellido ?? ''}, ${o.nombre ?? ''}`}
                    filterOptions={x => x}
                    loading={loadingBusqueda}
                    value={null}
                    inputValue={busquedaContacto}
                    onInputChange={(_, val) => setBusquedaContacto(val)}
                    onChange={(_, val) => { if (val) addContactoVinculado(val) }}
                    noOptionsText={busquedaContacto.length < 2 ? 'Escribí al menos 2 caracteres' : 'Sin resultados'}
                    renderOption={(props, o) => (
                      <Box component="li" {...props} key={o.id}>
                        <Box>
                          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827' }}>
                            {o.apellido}, {o.nombre}
                          </Typography>
                          <Typography sx={{ fontSize: '0.7rem', color: '#6B7280' }}>
                            {[o.dni && `DNI: ${o.dni}`, o.telefono].filter(Boolean).join(' · ')}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    renderInput={params => (
                      <TextField {...params} placeholder="Buscar por nombre, apellido o DNI..." sx={fieldSx}
                        slotProps={{ input: { ...params.InputProps, endAdornment: (<>{loadingBusqueda && <CircularProgress size={14} sx={{ color: ACCENT }} />}{params.InputProps.endAdornment}</>) } }}
                      />
                    )}
                  />
                  <Tooltip title="Crear nuevo contacto y vincularlo">
                    <IconButton size="small" onClick={() => setContactoDrawerOpen(true)}
                      sx={{ mt: 0.25, border: '1px solid #E5E7EB', borderRadius: '8px', color: '#374151', '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: '#ECFDF5' } }}>
                      <AddIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </>
            )}

            {/* ── 8. Fotos ── */}
            <SectionTitle>Fotos</SectionTitle>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleFilesSelected}
            />

            {images.length > 0 && (
              <Box display="flex" flexWrap="wrap" gap={1.5} mb={1.5}>
                {images.map((img, index) => (
                  <Box
                    key={index}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={e => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={() => setDragOver(null)}
                    sx={{
                      position: 'relative', width: 96, height: 72,
                      borderRadius: '8px', overflow: 'hidden', flexShrink: 0,
                      border: dragOver === index
                        ? `2px solid ${ACCENT}`
                        : img.type === 'new'
                          ? '1px dashed #10B981'
                          : '1px solid #E5E7EB',
                      cursor: 'grab',
                      opacity: dragIndexRef.current === index ? 0.5 : 1,
                      transition: 'border 0.1s, opacity 0.1s',
                    }}
                  >
                    <Box
                      component="img"
                      src={img.type === 'existing' ? img.publicUrl : img.preview}
                      alt=""
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                    />
                    {/* Principal badge */}
                    {index === 0 && (
                      <Box sx={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        bgcolor: 'rgba(6,95,70,0.85)', px: 0.75, py: 0.25,
                        display: 'flex', justifyContent: 'center',
                      }}>
                        <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'white', letterSpacing: '0.05em' }}>
                          PRINCIPAL
                        </Typography>
                      </Box>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => removeImage(index)}
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

            {images.length === 0 && (
              <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF', mb: 1.5 }}>
                La primera foto cargada será la imagen principal de la publicación. Podés reordenarlas arrastrando.
              </Typography>
            )}

            <Button
              variant="outlined"
              startIcon={<AddPhotoAlternateIcon sx={{ fontSize: 16 }} />}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                mb: 3, borderColor: '#E5E7EB', color: '#6B7280', borderRadius: '8px',
                textTransform: 'none', fontSize: '0.8rem', fontWeight: 500,
                '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: '#F0FDF4' },
              }}
            >
              Agregar fotos
            </Button>

            {/* Datos de venta */}
            {isVendida && (
              <Box sx={{ bgcolor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', p: 2, mb: 2 }}>
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
                    <Label required>Fecha de venta</Label>
                    <TextField fullWidth size="small" type="date" value={form.fecha_venta}
                      onChange={e => set('fecha_venta', e.target.value)} sx={fieldSx}
                      slotProps={{ input: { sx: { fontSize: '0.875rem' } } }} />
                  </Grid>
                </Grid>
                <Box>
                  <Label required>Precio final de venta</Label>
                  <TextField fullWidth size="small" type="number" value={form.precio_final_venta}
                    onChange={e => set('precio_final_venta', e.target.value)} inputProps={{ min: 0 }} sx={fieldSx} />
                </Box>
              </Box>
            )}
          </form>
        </Box>

        {/* Footer */}
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
                sx={{ borderRadius: 4, height: 4, bgcolor: '#E5E7EB', '& .MuiLinearProgress-bar': { bgcolor: ACCENT, borderRadius: 4 } }}
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
                : saving ? 'Guardando...' : mode === 'edit' ? 'Guardar cambios' : 'Crear propiedad'}
            </Button>
            <Button
              variant="outlined"
              onClick={onClose}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280', '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' } }}
            >
              Cancelar
            </Button>
          </Box>
        </Box>
      </Drawer>

      <ContactoFormDrawer
        open={contactoDrawerOpen}
        onClose={() => setContactoDrawerOpen(false)}
        contacto={null}
        clienteId={clienteId}
        onSaved={handleNewContactoSaved}
      />
    </>
  )
}
