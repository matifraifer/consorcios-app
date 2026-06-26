import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Box, Typography, CircularProgress, Alert, Button, Dialog,
  TextField, Select, MenuItem, FormControl, InputLabel,
  IconButton, Divider,
} from '@mui/material'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ApartmentIcon from '@mui/icons-material/Apartment'
import { getPropiedadPublica, getPropiedadImagenes, getPublicImageUrl, submitConsultaWeb, registrarVisitaPropiedad } from '../services/supabase'

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
  presupuesto: '', provincia: '', zona_interes: '', mensaje: '',
}

const DARK_PANEL = '#0B1E13'

function ArcCounter({ count, max }) {
  const r = 9, circ = 2 * Math.PI * r
  const pct = Math.min(count / max, 1)
  const color = pct > 0.9 ? '#EF4444' : pct > 0.7 ? '#F59E0B' : '#10B981'
  return (
    <Box display="flex" alignItems="center" gap={0.5}>
      <svg width="22" height="22" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
        <circle cx="11" cy="11" r={r} fill="none" stroke={color} strokeWidth="2"
          strokeDasharray={`${pct * circ} ${(1 - pct) * circ}`} strokeLinecap="round"
          transform="rotate(-90 11 11)" style={{ transition: 'stroke-dasharray 0.2s, stroke 0.2s' }} />
      </svg>
      <Typography component="span" sx={{ fontSize: '0.62rem', color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {max - count}
      </Typography>
    </Box>
  )
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: '1.5px' },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
  '& .MuiInputBase-input': { fontSize: '0.875rem' },
}

function ContactDialog({ open, onClose, propiedad }) {
  const [form, setForm] = useState(FORM_EMPTY)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  function set(field, value) { setForm(prev => ({ ...prev, [field]: value })) }

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
    setSending(true); setError(null)
    try {
      await submitConsultaWeb({
        dni: form.dni.trim(), nombre: form.nombre.trim(),
        apellido: form.apellido.trim(), telefono: form.telefono.trim(),
        email: form.email.trim() || null, presupuesto: form.presupuesto.trim() || null,
        provincia: form.provincia || null, zona_interes: form.zona_interes || null,
        mensaje: form.mensaje.trim() || null,
        propiedad_id: propiedad.id, cliente_id: propiedad.cliente_id,
      })
      setSuccess(true)
    } catch {
      setError('Ocurrió un error al enviar tu solicitud. Intentá de nuevo.')
    } finally { setSending(false) }
  }

  function handleClose() {
    if (sending) return
    setForm(FORM_EMPTY); setError(null); setSuccess(false); onClose()
  }

  const stdTF = (label, field, extra = {}) => (
    <TextField
      variant="outlined" size="small" fullWidth label={label}
      value={form[field]} onChange={e => set(field, e.target.value)}
      sx={fieldSx}
      {...extra}
    />
  )

  return (
    <Dialog
      open={open} onClose={handleClose} maxWidth={false}
      PaperProps={{
        sx: {
          width: { xs: '96vw', sm: 700 }, maxWidth: '100%',
          borderRadius: '16px', overflow: 'hidden',
          m: { xs: 1, sm: 3 },
          boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
          bgcolor: 'transparent',
        }
      }}
      slotProps={{ backdrop: { sx: { backdropFilter: 'blur(8px)', bgcolor: 'rgba(5,15,10,0.7)' } } }}
    >
      <style>{`
        @keyframes cfIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .cf-row { animation: cfIn 0.28s ease both }
      `}</style>

      <Box sx={{ display: 'flex', minHeight: { xs: 'auto', sm: 540 } }}>

        {/* ── Panel oscuro izquierdo (oculto en mobile y en success) ── */}
        <Box sx={{
          width: 210, flexShrink: 0,
          display: { xs: 'none', sm: success ? 'none' : 'flex' },
          flexDirection: 'column',
          bgcolor: DARK_PANEL,
          p: '28px 22px',
          position: 'relative', overflow: 'hidden',
          backgroundImage: 'radial-gradient(rgba(16,185,129,0.04) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}>
          {/* Barra superior de acento */}
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${ACCENT}, #10B981)` }} />

          {/* Círculos decorativos */}
          <Box sx={{ position: 'absolute', bottom: -40, right: -40, width: 140, height: 140, borderRadius: '50%', border: '1px solid rgba(16,185,129,0.07)', pointerEvents: 'none' }} />
          <Box sx={{ position: 'absolute', bottom: -70, right: -70, width: 200, height: 200, borderRadius: '50%', border: '1px solid rgba(16,185,129,0.04)', pointerEvents: 'none' }} />

          {/* Badge operación */}
          {propiedad?.tipo_operacion && (
            <Box sx={{ alignSelf: 'flex-start', mt: 1.5, mb: 2.5, px: 1.25, py: 0.35, border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', bgcolor: 'rgba(16,185,129,0.07)' }}>
              <Typography sx={{ fontSize: '0.57rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#10B981' }}>
                {propiedad.tipo_operacion}
              </Typography>
            </Box>
          )}

          {/* Título propiedad */}
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 600, color: '#DCFCE7', lineHeight: 1.3, mb: 'auto', pb: 2, flex: 1 }}>
            {propiedad?.titulo}
          </Typography>

          {/* Ubicación */}
          {(propiedad?.direccion || propiedad?.localidad) && (
            <Box mb={2}>
              <Typography sx={{ fontSize: '0.57rem', fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#3D7A5A', mb: 0.5 }}>
                Ubicación
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#7EB89A', lineHeight: 1.55 }}>
                {propiedad.direccion}{propiedad?.localidad ? `, ${propiedad.localidad}` : ''}
              </Typography>
            </Box>
          )}

          {/* Precio */}
          {propiedad?.precio_publicacion && (
            <Box sx={{ pt: 2, borderTop: '1px solid rgba(16,185,129,0.1)' }}>
              <Typography sx={{ fontSize: '0.57rem', fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#3D7A5A', mb: 0.4 }}>
                Precio
              </Typography>
              <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: '#DCFCE7', letterSpacing: '-0.01em' }}>
                {propiedad.moneda} {Number(propiedad.precio_publicacion).toLocaleString('es-AR')}
              </Typography>
            </Box>
          )}
        </Box>

        {/* ── Panel del formulario ── */}
        <Box sx={{ flex: 1, bgcolor: success ? DARK_PANEL : 'white', display: 'flex', flexDirection: 'column', position: 'relative', transition: 'background-color 0.4s' }}>

          {/* Botón cerrar */}
          <IconButton onClick={handleClose} size="small" sx={{
            position: 'absolute', top: 10, right: 10, zIndex: 10,
            width: 28, height: 28,
            color: success ? '#4B7A62' : '#9CA3AF',
            bgcolor: success ? 'rgba(16,185,129,0.06)' : 'rgba(0,0,0,0.04)',
            '&:hover': { bgcolor: success ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.08)', color: success ? '#DCFCE7' : '#374151' },
          }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>

          {success ? (
            /* ── Estado de éxito ── */
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: { xs: 4, sm: 5 }, textAlign: 'center' }}>
              <Box sx={{ width: 56, height: 56, borderRadius: '50%', border: `1.5px solid ${ACCENT}`, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3, animation: 'cfIn 0.5s ease' }}>
                <CheckCircleIcon sx={{ fontSize: 26, color: ACCENT }} />
              </Box>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#DCFCE7', mb: 1, lineHeight: 1.2, animation: 'cfIn 0.5s ease 0.1s both' }}>
                Consulta enviada
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#7EB89A', lineHeight: 1.8, mb: 3.5, maxWidth: 260, animation: 'cfIn 0.5s ease 0.2s both' }}>
                Recibimos tu mensaje. Un asesor se va a comunicar con vos a la brevedad.
              </Typography>
              <Button onClick={handleClose} sx={{
                textTransform: 'none', fontWeight: 600, fontSize: '0.82rem',
                color: '#10B981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', px: 3, py: 0.75,
                animation: 'cfIn 0.5s ease 0.3s both',
                '&:hover': { bgcolor: 'rgba(16,185,129,0.07)' },
              }}>
                Cerrar
              </Button>
            </Box>
          ) : (
            /* ── Formulario ── */
            <Box component="form" onSubmit={handleSubmit}
              sx={{ flex: 1, overflowY: 'auto', px: { xs: 2.5, sm: 3 }, pt: 3, pb: 3, display: 'flex', flexDirection: 'column', gap: 0 }}
            >
              {/* Header mobile: barra verde compacta con nombre de propiedad */}
              <Box sx={{ display: { xs: 'flex', sm: 'none' }, alignItems: 'center', gap: 1, mb: 2, p: 1.25, bgcolor: DARK_PANEL, borderRadius: '10px' }}>
                {propiedad?.tipo_operacion && (
                  <Box sx={{ px: 1, py: 0.2, border: '1px solid rgba(16,185,129,0.3)', borderRadius: '3px', bgcolor: 'rgba(16,185,129,0.08)', flexShrink: 0 }}>
                    <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#10B981' }}>
                      {propiedad.tipo_operacion}
                    </Typography>
                  </Box>
                )}
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#DCFCE7', lineHeight: 1.3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {propiedad?.titulo}
                </Typography>
              </Box>

              {/* Encabezado */}
              <Box className="cf-row" sx={{ mb: 2.5, animationDelay: '0s' }}>
                <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.25, pr: 4 }}>
                  Quiero más información
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', mt: 0.4 }}>
                  Completá tus datos y te contactamos a la brevedad
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.78rem', py: 0.5 }}>
                  {error}
                </Alert>
              )}

              {/* DNI */}
              <Box className="cf-row" sx={{ mb: 2, animationDelay: '0.06s' }}>
                {stdTF('DNI *', 'dni', { placeholder: 'Número de documento' })}
              </Box>

              {/* Nombre + Apellido */}
              <Box className="cf-row" sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2, animationDelay: '0.12s' }}>
                {stdTF('Nombre *', 'nombre')}
                {stdTF('Apellido *', 'apellido')}
              </Box>

              {/* Teléfono + Email */}
              <Box className="cf-row" sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2, animationDelay: '0.18s' }}>
                {stdTF('Teléfono *', 'telefono', { placeholder: '264 1234567' })}
                {stdTF('Email', 'email', { type: 'email' })}
              </Box>

              {/* Divisor */}
              <Box sx={{ height: '1px', bgcolor: '#F3F4F6', mb: 2 }} />

              {/* Presupuesto */}
              <Box className="cf-row" sx={{ mb: 2, animationDelay: '0.24s' }}>
                {stdTF('Presupuesto', 'presupuesto', { placeholder: 'Ej: USD 80.000' })}
              </Box>

              {/* Provincia + Zona */}
              <Box className="cf-row" sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2, animationDelay: '0.3s' }}>
                <FormControl size="small" fullWidth sx={fieldSx}>
                  <InputLabel>Provincia</InputLabel>
                  <Select label="Provincia" value={form.provincia} onChange={e => set('provincia', e.target.value)}>
                    <MenuItem value=""><em style={{ fontStyle: 'normal', color: '#9CA3AF' }}>—</em></MenuItem>
                    {PROVINCIAS.map(p => <MenuItem key={p} value={p} sx={{ fontSize: '0.875rem' }}>{p}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth sx={fieldSx}>
                  <InputLabel>Zona de interés</InputLabel>
                  <Select label="Zona de interés" value={form.zona_interes} onChange={e => set('zona_interes', e.target.value)}>
                    <MenuItem value=""><em style={{ fontStyle: 'normal', color: '#9CA3AF' }}>—</em></MenuItem>
                    {ZONAS.map(z => <MenuItem key={z} value={z} sx={{ fontSize: '0.875rem' }}>{z}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>

              {/* Mensaje */}
              <Box className="cf-row" sx={{ mb: 2.5, animationDelay: '0.36s' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                  <Typography sx={{ fontSize: '0.7rem', color: '#6B7280' }}>
                    Mensaje (opcional)
                  </Typography>
                  <ArcCounter count={form.mensaje.length} max={1000} />
                </Box>
                <TextField
                  variant="outlined" size="small" fullWidth multiline rows={3}
                  value={form.mensaje}
                  onChange={e => { if (e.target.value.length <= 1000) set('mensaje', e.target.value) }}
                  placeholder="Escribí tu consulta..."
                  sx={fieldSx}
                />
              </Box>

              {/* Submit */}
              <Button type="submit" variant="contained" disabled={sending} fullWidth
                startIcon={sending ? <CircularProgress size={14} color="inherit" /> : null}
                sx={{
                  bgcolor: ACCENT, color: 'white',
                  borderRadius: '8px', textTransform: 'none', fontWeight: 600,
                  fontSize: '0.875rem', py: 1.25, letterSpacing: '0.01em',
                  boxShadow: '0 2px 8px rgba(6,95,70,0.25)', mt: 'auto',
                  '&:hover': { bgcolor: '#047857', boxShadow: '0 4px 16px rgba(6,95,70,0.35)' },
                  '&.Mui-disabled': { bgcolor: '#E5E7EB', color: '#9CA3AF', boxShadow: 'none' },
                }}
              >
                {sending ? 'Enviando...' : 'Enviar consulta'}
              </Button>
            </Box>
          )}
        </Box>
      </Box>
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
  const visitaRegistrada = useRef(null)

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

    if (visitaRegistrada.current !== id) {
      visitaRegistrada.current = id
      registrarVisitaPropiedad(id).catch(() => {})
    }
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
