import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Box, Typography, CircularProgress, Alert, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Grid,
  Select, MenuItem, FormControl, IconButton, Divider,
} from '@mui/material'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ApartmentIcon from '@mui/icons-material/Apartment'
import { getPropiedadPublica, getPropiedadImagenes, getPublicImageUrl, submitConsultaWeb } from '../services/supabase'

const ACCENT = '#065F46'

const ZONAS = [
  'Albardón','Angaco','Calingasta','Capital','Caucete','Chimbas',
  'Iglesia','Jáchal','9 de Julio','Pocito','Rawson','Rivadavia',
  'San Martín','Santa Lucía','Sarmiento','Ullum','Valle Fértil','25 de Mayo','Zonda',
]

const PROVINCIAS = [
  'Buenos Aires','Catamarca','Chaco','Chubut','Córdoba','Corrientes',
  'Entre Ríos','Formosa','Jujuy','La Pampa','La Rioja','Mendoza',
  'Misiones','Neuquén','Río Negro','Salta','San Juan','San Luis',
  'Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán',
  'Ciudad Autónoma de Buenos Aires',
]

function fmt(value, moneda) {
  if (!value) return null
  const n = Number(value).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return moneda ? `${moneda} ${n}` : n
}

// ── Galería ────────────────────────────────────────────────────────────────
function Gallery({ images }) {
  const [active, setActive] = useState(0)

  if (images.length === 0) {
    return (
      <Box sx={{
        width: '100%', height: { xs: 240, sm: 380, md: 480 },
        bgcolor: '#F3F4F6', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 1,
      }}>
        <ApartmentIcon sx={{ fontSize: 48, color: '#D1D5DB' }} />
        <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>Sin fotos disponibles</Typography>
      </Box>
    )
  }

  const prev = () => setActive(i => (i - 1 + images.length) % images.length)
  const next = () => setActive(i => (i + 1) % images.length)

  return (
    <Box>
      {/* Imagen principal */}
      <Box sx={{ position: 'relative', width: '100%', height: { xs: 260, sm: 400, md: 500 }, bgcolor: '#111' }}>
        <Box
          component="img"
          src={images[active]}
          alt=""
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {images.length > 1 && (
          <>
            <IconButton
              onClick={prev}
              sx={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                bgcolor: 'rgba(0,0,0,0.45)', color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
              }}
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              onClick={next}
              sx={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                bgcolor: 'rgba(0,0,0,0.45)', color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
              }}
            >
              <ChevronRightIcon />
            </IconButton>
            <Box sx={{
              position: 'absolute', bottom: 12, right: 16,
              bgcolor: 'rgba(0,0,0,0.5)', borderRadius: '20px', px: 1.5, py: 0.4,
            }}>
              <Typography sx={{ fontSize: '0.72rem', color: 'white', fontWeight: 600 }}>
                {active + 1} / {images.length}
              </Typography>
            </Box>
          </>
        )}
      </Box>

      {/* Miniaturas */}
      {images.length > 1 && (
        <Box display="flex" gap={1} p={1.5} sx={{ overflowX: 'auto', bgcolor: '#1A1A1A' }}>
          {images.map((url, i) => (
            <Box
              key={i}
              onClick={() => setActive(i)}
              sx={{
                width: 72, height: 52, borderRadius: '6px', overflow: 'hidden',
                flexShrink: 0, cursor: 'pointer',
                border: i === active ? `2px solid ${ACCENT}` : '2px solid transparent',
                opacity: i === active ? 1 : 0.55,
                transition: 'all 0.15s',
                '&:hover': { opacity: 1 },
              }}
            >
              <Box component="img" src={url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

// ── Chip de característica ─────────────────────────────────────────────────
function StatChip({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px',
      px: 2.5, py: 1.5, minWidth: 72,
    }}>
      <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: '0.65rem', color: '#9CA3AF', mt: 0.4, textAlign: 'center' }}>
        {label}
      </Typography>
    </Box>
  )
}

// ── Formulario de contacto ─────────────────────────────────────────────────
const FORM_EMPTY = {
  dni: '', nombre: '', apellido: '', telefono: '', email: '',
  presupuesto: '', provincia: '', zona_interes: '',
}

function ContactDialog({ open, onClose, propiedad }) {
  const [form, setForm] = useState(FORM_EMPTY)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function validate() {
    if (!form.dni.trim())       return 'El DNI es obligatorio.'
    if (!form.nombre.trim())    return 'El nombre es obligatorio.'
    if (!form.apellido.trim())  return 'El apellido es obligatorio.'
    if (!form.telefono.trim())  return 'El teléfono es obligatorio.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setSending(true)
    setError(null)
    try {
      await submitConsultaWeb({
        dni:          form.dni.trim(),
        nombre:       form.nombre.trim(),
        apellido:     form.apellido.trim(),
        telefono:     form.telefono.trim(),
        email:        form.email.trim() || null,
        presupuesto:  form.presupuesto.trim() || null,
        provincia:    form.provincia || null,
        zona_interes: form.zona_interes || null,
        propiedad_id: propiedad.id,
        cliente_id:   propiedad.cliente_id,
      })
      setSuccess(true)
    } catch {
      setError('Ocurrió un error al enviar tu solicitud. Intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  function handleClose() {
    if (sending) return
    setForm(FORM_EMPTY)
    setError(null)
    setSuccess(false)
    onClose()
  }

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px', fontSize: '0.875rem',
      '& fieldset': { borderColor: '#E5E7EB' },
      '&:hover fieldset': { borderColor: ACCENT },
      '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
    },
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: '16px', p: 0.5 } }}
    >
      {success ? (
        <Box sx={{ px: 4, py: 6, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 52, color: ACCENT, mb: 2 }} />
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', mb: 1 }}>
            ¡Solicitud enviada!
          </Typography>
          <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.7 }}>
            Recibimos tus datos. Un asesor se va a comunicar con vos a la brevedad.
          </Typography>
          <Button
            onClick={handleClose}
            variant="contained"
            sx={{
              mt: 3, bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
              fontWeight: 600, boxShadow: 'none',
              '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
            }}
          >
            Cerrar
          </Button>
        </Box>
      ) : (
        <>
          <DialogTitle sx={{ pb: 0, pt: 2.5, px: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                  Quiero más información
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', mt: 0.25 }}>
                  {propiedad?.titulo}
                </Typography>
              </Box>
              <IconButton size="small" onClick={handleClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ px: 3, py: 2 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>
                {error}
              </Alert>
            )}

            <form id="contact-form" onSubmit={handleSubmit}>
              <Grid container spacing={1.5}>
                <Grid item xs={12}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>DNI *</Typography>
                  <TextField fullWidth size="small" value={form.dni}
                    onChange={e => set('dni', e.target.value)}
                    placeholder="Número de documento" sx={fieldSx} />
                </Grid>
                <Grid item xs={6}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Nombre *</Typography>
                  <TextField fullWidth size="small" value={form.nombre}
                    onChange={e => set('nombre', e.target.value)} sx={fieldSx} />
                </Grid>
                <Grid item xs={6}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Apellido *</Typography>
                  <TextField fullWidth size="small" value={form.apellido}
                    onChange={e => set('apellido', e.target.value)} sx={fieldSx} />
                </Grid>
                <Grid item xs={6}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Teléfono *</Typography>
                  <TextField fullWidth size="small" value={form.telefono}
                    onChange={e => set('telefono', e.target.value)}
                    placeholder="Ej: 264 1234567" sx={fieldSx} />
                </Grid>
                <Grid item xs={6}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Email</Typography>
                  <TextField fullWidth size="small" type="email" value={form.email}
                    onChange={e => set('email', e.target.value)} sx={fieldSx} />
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 0.5, borderColor: '#F3F4F6' }} />
                </Grid>
                <Grid item xs={12}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Presupuesto</Typography>
                  <TextField fullWidth size="small" value={form.presupuesto}
                    onChange={e => set('presupuesto', e.target.value)}
                    placeholder="Ej: USD 80,000" sx={fieldSx} />
                </Grid>
                <Grid item xs={6}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Provincia</Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={form.provincia}
                      displayEmpty
                      onChange={e => set('provincia', e.target.value)}
                      sx={{
                        fontSize: '0.875rem', borderRadius: '8px',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
                      }}
                    >
                      <MenuItem value="" sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Seleccionar</MenuItem>
                      {PROVINCIAS.map(p => <MenuItem key={p} value={p} sx={{ fontSize: '0.875rem' }}>{p}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Zona de interés</Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={form.zona_interes}
                      displayEmpty
                      onChange={e => set('zona_interes', e.target.value)}
                      sx={{
                        fontSize: '0.875rem', borderRadius: '8px',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
                      }}
                    >
                      <MenuItem value="" sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Seleccionar</MenuItem>
                      {ZONAS.map(z => <MenuItem key={z} value={z} sx={{ fontSize: '0.875rem' }}>{z}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </form>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button
              onClick={handleClose}
              sx={{ textTransform: 'none', fontWeight: 500, fontSize: '0.82rem', color: '#6B7280', borderRadius: '8px' }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="contact-form"
              variant="contained"
              disabled={sending}
              startIcon={sending ? <CircularProgress size={14} color="inherit" /> : null}
              sx={{
                bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                fontWeight: 600, fontSize: '0.82rem', px: 2.5,
                boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
              }}
            >
              {sending ? 'Enviando...' : 'Enviar solicitud'}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function PropiedadPublica() {
  const { id } = useParams()
  const [propiedad, setPropiedad] = useState(null)
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [contactOpen, setContactOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      getPropiedadPublica(id),
      getPropiedadImagenes(id).then(rows => rows.map(r => getPublicImageUrl(r.storage_path))),
    ])
      .then(([prop, imgs]) => {
        setPropiedad(prop)
        setImages(imgs)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor="#F9FAFB">
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    )
  }

  if (error || !propiedad) {
    return (
      <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor="#F9FAFB">
        <Box textAlign="center" px={3}>
          <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', mb: 1 }}>
            Propiedad no disponible
          </Typography>
          <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>
            Esta propiedad no existe o ya no está disponible.
          </Typography>
        </Box>
      </Box>
    )
  }

  const p = propiedad
  const esAlquiler = p.tipo_operacion?.toLowerCase() === 'alquiler'
  const labelPrecio = esAlquiler ? 'Alquiler mensual' : 'Precio de venta'
  const labelCTA = esAlquiler ? 'Quiero alquilar' : 'Quiero comprar'

  return (
    <Box minHeight="100vh" bgcolor="#F8FAFC">
      {/* Header mínimo */}
      <Box sx={{
        bgcolor: 'white', borderBottom: '1px solid #E5E7EB',
        px: { xs: 2, md: 4 }, py: 1.5,
        display: 'flex', alignItems: 'center', gap: 1.25,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Box sx={{
          width: 28, height: 28, borderRadius: '7px', bgcolor: ACCENT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ApartmentIcon sx={{ fontSize: 15, color: 'white' }} />
        </Box>
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>
          Propiedades
        </Typography>
      </Box>

      {/* Galería */}
      <Gallery images={images} />

      {/* Contenido */}
      <Box sx={{ maxWidth: 860, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: 4 }}>

        {/* Tipo + Operación */}
        <Box display="flex" gap={1} mb={1.5} flexWrap="wrap">
          {p.tipo_propiedad && (
            <Box sx={{ bgcolor: '#EFF6FF', borderRadius: '20px', px: 1.5, py: 0.4 }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#1D4ED8' }}>
                {p.tipo_propiedad}
              </Typography>
            </Box>
          )}
          {p.tipo_operacion && (
            <Box sx={{ bgcolor: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '20px', px: 1.5, py: 0.4 }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: ACCENT }}>
                {p.tipo_operacion}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Título */}
        <Typography sx={{
          fontSize: { xs: '1.4rem', sm: '1.8rem' }, fontWeight: 800,
          color: '#0F172A', lineHeight: 1.2, letterSpacing: '-0.02em', mb: 0.75,
        }}>
          {p.titulo}
        </Typography>

        {/* Dirección */}
        <Box display="flex" alignItems="center" gap={0.5} mb={3}>
          <LocationOnIcon sx={{ fontSize: 16, color: '#9CA3AF', flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.875rem', color: '#6B7280' }}>
            {p.direccion}{p.localidad ? ` — ${p.localidad}` : ''}{p.provincia ? `, ${p.provincia}` : ''}
          </Typography>
        </Box>

        {/* Precio + CTA */}
        <Box
          display="flex"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          flexDirection={{ xs: 'column', sm: 'row' }}
          gap={2}
          mb={4}
          sx={{
            bgcolor: 'white', border: '1px solid #E5E7EB',
            borderRadius: '14px', p: 2.5,
          }}
        >
          <Box flex={1}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', mb: 0.25 }}>
              {labelPrecio}
            </Typography>
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(p.precio_publicacion, p.moneda)}
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={() => setContactOpen(true)}
            size="large"
            sx={{
              bgcolor: ACCENT, borderRadius: '10px', textTransform: 'none',
              fontWeight: 700, fontSize: '0.95rem', px: 3.5, py: 1.25,
              boxShadow: '0 4px 14px rgba(6,95,70,0.25)',
              '&:hover': { bgcolor: '#047857', boxShadow: '0 6px 20px rgba(6,95,70,0.3)' },
              whiteSpace: 'nowrap',
            }}
          >
            {labelCTA}
          </Button>
        </Box>

        {/* Stats */}
        <Box display="flex" gap={1.5} flexWrap="wrap" mb={4}>
          {p.ambientes    && <StatChip label="Ambientes"        value={p.ambientes} />}
          {p.dormitorios  && <StatChip label="Dormitorios"      value={p.dormitorios} />}
          {p.banios       && <StatChip label="Baños"            value={p.banios} />}
          {p.metros_cubiertos && <StatChip label="m² cubiertos" value={`${p.metros_cubiertos} m²`} />}
          {p.metros_totales   && <StatChip label="m² totales"   value={`${p.metros_totales} m²`} />}
          {p.cochera && (
            <Box sx={{
              display: 'flex', alignItems: 'center',
              bgcolor: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: '10px',
              px: 2, py: 1,
            }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: ACCENT }}>
                Cochera
              </Typography>
            </Box>
          )}
        </Box>

        {/* Descripción */}
        {p.descripcion && (
          <>
            <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9CA3AF', mb: 1.5 }}>
              Descripción
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {p.descripcion}
            </Typography>
          </>
        )}

        {/* CTA final */}
        <Box
          mt={6}
          sx={{
            bgcolor: ACCENT, borderRadius: '16px', p: { xs: 3, sm: 4 },
            textAlign: 'center',
          }}
        >
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', mb: 0.75 }}>
            {esAlquiler ? '¿Querés alquilar esta propiedad?' : '¿Te interesa esta propiedad?'}
          </Typography>
          <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', mb: 2.5 }}>
            Dejá tus datos y un asesor se comunica con vos a la brevedad.
          </Typography>
          <Button
            variant="contained"
            onClick={() => setContactOpen(true)}
            sx={{
              bgcolor: 'white', color: ACCENT, borderRadius: '10px',
              textTransform: 'none', fontWeight: 700, fontSize: '0.95rem',
              px: 3, py: 1, boxShadow: 'none',
              '&:hover': { bgcolor: '#F0FDF4', boxShadow: 'none' },
            }}
          >
            {labelCTA}
          </Button>
        </Box>

        {/* Footer */}
        <Box mt={6} textAlign="center">
          <Typography sx={{ fontSize: '0.72rem', color: '#D1D5DB' }}>
            Publicado por una inmobiliaria asociada
          </Typography>
        </Box>
      </Box>

      {/* CTA flotante en mobile */}
      <Box sx={{
        display: { xs: 'block', sm: 'none' },
        position: 'fixed', bottom: 0, left: 0, right: 0,
        bgcolor: 'white', borderTop: '1px solid #E5E7EB',
        px: 2, py: 1.5, zIndex: 50,
      }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => setContactOpen(true)}
          sx={{
            bgcolor: ACCENT, borderRadius: '10px', textTransform: 'none',
            fontWeight: 700, fontSize: '0.95rem', py: 1.25,
            boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
          }}
        >
          {labelCTA}
        </Button>
      </Box>

      <ContactDialog
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        propiedad={propiedad}
      />
    </Box>
  )
}
