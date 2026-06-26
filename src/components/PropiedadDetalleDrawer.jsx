import { useEffect, useState } from 'react'
import {
  Box, Typography, Drawer, IconButton, Button, CircularProgress, Tooltip, Snackbar, Chip,
} from '@mui/material'
import CloseIcon              from '@mui/icons-material/Close'
import EditIcon               from '@mui/icons-material/Edit'
import BlockIcon              from '@mui/icons-material/Block'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ChevronLeftIcon        from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon       from '@mui/icons-material/ChevronRight'
import ImageNotSupportedIcon  from '@mui/icons-material/ImageNotSupported'
import LinkIcon               from '@mui/icons-material/Link'
import PersonIcon             from '@mui/icons-material/Person'
import RoomIcon               from '@mui/icons-material/Room'
import VisibilityIcon         from '@mui/icons-material/Visibility'
import ChatBubbleOutlineIcon  from '@mui/icons-material/ChatBubbleOutline'
import DownloadIcon           from '@mui/icons-material/Download'
import { getPropiedadImagenes, getPublicImageUrl, getPropiedadContactos, getMetricasPropiedad, getClienteConfig } from '../services/supabase'
import DocumentacionRespaldatoriaSection from './DocumentacionRespaldatoriaSection'
import { generarReportePropiedad } from '../services/reportePropiedad'

const ACCENT       = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'

const TIPO_META = {
  Comprador:    { color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
  Vendedor:     { color: '#B45309', bg: '#FFFBEB', border: '#FCD34D' },
  Arrendatario: { color: '#1D4ED8', bg: '#EFF6FF', border: '#93C5FD' },
  Locatario:    { color: ACCENT,    bg: '#ECFDF5', border: '#6EE7B7' },
}

const ESTADO_STYLES = {
  Disponible: { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
  Reservada:  { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  Vendida:    { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  Baja:       { bg: '#F1F5F9', color: '#94A3B8', border: '#E2E8F0' },
}

function EstadoBadge({ estado }) {
  const s = ESTADO_STYLES[estado] ?? ESTADO_STYLES.Disponible
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.6,
      bgcolor: s.bg, border: `1px solid ${s.border}`, borderRadius: '20px',
      px: 1.5, py: 0.5,
    }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: s.color }} />
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: s.color, letterSpacing: '0.04em' }}>
        {estado}
      </Typography>
    </Box>
  )
}

function MetricaCard({ icon, label, value, loading }) {
  return (
    <Box sx={{
      flex: 1, display: 'flex', alignItems: 'center', gap: 1.25,
      bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px',
      px: 1.75, py: 1.25,
    }}>
      <Box sx={{ width: 30, height: 30, borderRadius: '8px', bgcolor: ACCENT_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </Box>
      <Box minWidth={0}>
        {loading ? (
          <CircularProgress size={14} sx={{ color: ACCENT }} />
        ) : (
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </Typography>
        )}
        <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF', mt: 0.25 }}>{label}</Typography>
      </Box>
    </Box>
  )
}

function Row({ label, value, mono = false }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <Box display="flex" justifyContent="space-between" alignItems="baseline" py={1}
      sx={{ borderBottom: '1px solid #F9FAFB' }}>
      <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', minWidth: 160 }}>{label}</Typography>
      <Typography sx={{
        fontSize: '0.82rem', fontWeight: 500, color: '#111827', textAlign: 'right',
        fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
      }}>
        {value}
      </Typography>
    </Box>
  )
}

function SectionTitle({ children }) {
  return (
    <Typography sx={{
      fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: ACCENT, mb: 1.5, mt: 3,
    }}>
      {children}
    </Typography>
  )
}

function fmt(value, moneda) {
  if (!value) return null
  const n = Number(value).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return moneda ? `${moneda} ${n}` : `$${n}`
}

function fmtDate(d) {
  if (!d) return null
  const s = d.includes('T') ? d.split('T')[0] : d
  const [y, m, day] = s.split('-')
  return `${day}/${m}/${y}`
}

// ── Lightbox ───────────────────────────────────────────────────────────────
function Lightbox({ images, index, onClose, onPrev, onNext }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  return (
    <Box
      onClick={onClose}
      sx={{
        position: 'fixed', inset: 0, zIndex: 2000,
        bgcolor: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <IconButton
        onClick={onClose}
        sx={{ position: 'absolute', top: 16, right: 16, color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
      >
        <CloseIcon />
      </IconButton>

      <Typography sx={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem' }}>
        {index + 1} / {images.length}
      </Typography>

      {images.length > 1 && (
        <IconButton
          onClick={e => { e.stopPropagation(); onPrev() }}
          sx={{ position: 'absolute', left: 16, color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
        >
          <ChevronLeftIcon />
        </IconButton>
      )}

      <Box
        component="img"
        src={images[index]}
        alt=""
        onClick={e => e.stopPropagation()}
        sx={{
          maxWidth: 'calc(100vw - 120px)',
          maxHeight: 'calc(100vh - 80px)',
          objectFit: 'contain',
          borderRadius: '8px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
      />

      {images.length > 1 && (
        <IconButton
          onClick={e => { e.stopPropagation(); onNext() }}
          sx={{ position: 'absolute', right: 16, color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
        >
          <ChevronRightIcon />
        </IconButton>
      )}

      {images.length > 1 && (
        <Box
          onClick={e => e.stopPropagation()}
          sx={{
            position: 'absolute', bottom: 16,
            display: 'flex', gap: 1,
            maxWidth: 'calc(100vw - 40px)',
            overflowX: 'auto', px: 2,
          }}
        >
          {images.map((url, i) => (
            <Box
              key={i}
              component="img"
              src={url}
              alt=""
              onClick={() => onNext(i)}
              sx={{
                width: 56, height: 42, objectFit: 'cover', borderRadius: '6px',
                cursor: 'pointer', flexShrink: 0,
                border: i === index ? '2px solid white' : '2px solid transparent',
                opacity: i === index ? 1 : 0.55,
                transition: 'all 0.15s',
                '&:hover': { opacity: 1 },
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}

// ── Galería ────────────────────────────────────────────────────────────────
function ImageGallery({ propiedadId }) {
  const [images, setImages]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [lightboxIndex, setLightboxIndex] = useState(null)

  useEffect(() => {
    setLoading(true)
    getPropiedadImagenes(propiedadId)
      .then(rows => setImages(rows.map(r => getPublicImageUrl(r.storage_path))))
      .catch(() => setImages([]))
      .finally(() => setLoading(false))
  }, [propiedadId])

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <CircularProgress size={14} sx={{ color: '#9CA3AF' }} />
        <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Cargando fotos...</Typography>
      </Box>
    )
  }

  if (images.length === 0) {
    return (
      <Box mb={2} sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: 90, bgcolor: '#F9FAFB', border: '1px dashed #E5E7EB', borderRadius: '10px', gap: 0.75,
      }}>
        <ImageNotSupportedIcon sx={{ fontSize: 22, color: '#D1D5DB' }} />
        <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Sin fotos cargadas</Typography>
      </Box>
    )
  }

  const goPrev = (target) => setLightboxIndex(target !== undefined ? target : i => (i - 1 + images.length) % images.length)
  const goNext = (target) => setLightboxIndex(target !== undefined ? target : i => (i + 1) % images.length)

  return (
    <>
      <Box
        mb={1}
        onClick={() => setLightboxIndex(0)}
        sx={{
          width: '100%', height: 220, borderRadius: '10px', overflow: 'hidden',
          cursor: 'pointer', position: 'relative',
          '&:hover .img-overlay': { opacity: 1 },
        }}
      >
        <Box component="img" src={images[0]} alt=""
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <Box className="img-overlay" sx={{
          position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.25)',
          opacity: 0, transition: 'opacity 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{ color: 'white', fontSize: '0.75rem', fontWeight: 600, bgcolor: 'rgba(0,0,0,0.4)', px: 1.5, py: 0.5, borderRadius: '20px' }}>
            Ver foto
          </Typography>
        </Box>
      </Box>

      {images.length > 1 && (
        <Box display="flex" gap={1} mb={2} sx={{ overflowX: 'auto', pb: 0.5 }}>
          {images.slice(1).map((url, i) => (
            <Box
              key={i}
              onClick={() => setLightboxIndex(i + 1)}
              sx={{
                width: 72, height: 54, borderRadius: '8px', overflow: 'hidden',
                flexShrink: 0, cursor: 'pointer', position: 'relative',
                border: '1px solid #E5E7EB',
                '&:hover .thumb-overlay': { opacity: 1 },
              }}
            >
              <Box component="img" src={url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <Box className="thumb-overlay" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.3)', opacity: 0, transition: 'opacity 0.15s' }} />
            </Box>
          ))}
          <Box sx={{ display: 'flex', alignItems: 'center', pl: 0.5, flexShrink: 0 }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
              {images.length} foto{images.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={goPrev}
          onNext={goNext}
        />
      )}
    </>
  )
}

// ── Componente principal ───────────────────────────────────────────────────
export default function PropiedadDetalleDrawer({ open, onClose, propiedad, onEdit, onBaja, onReactivar, userRole, clienteId }) {
  const [copied, setCopied]           = useState(false)
  const [contactos, setContactos]     = useState([])
  const [loadingContactos, setLoadingContactos] = useState(false)
  const [metricas, setMetricas]       = useState({ visitasWeb: 0, consultas: 0, visitasFisicas: 0 })
  const [loadingMetricas, setLoadingMetricas] = useState(false)
  const [downloadingReporte, setDownloadingReporte] = useState(false)

  useEffect(() => {
    if (!open || !propiedad?.id) { setContactos([]); return }
    setLoadingContactos(true)
    getPropiedadContactos(propiedad.id)
      .then(setContactos)
      .catch(() => setContactos([]))
      .finally(() => setLoadingContactos(false))
  }, [open, propiedad?.id])

  useEffect(() => {
    if (!open || !propiedad?.id) { setMetricas({ visitasWeb: 0, consultas: 0, visitasFisicas: 0 }); return }
    setLoadingMetricas(true)
    getMetricasPropiedad(propiedad.id)
      .then(setMetricas)
      .catch(() => setMetricas({ visitasWeb: 0, consultas: 0, visitasFisicas: 0 }))
      .finally(() => setLoadingMetricas(false))
  }, [open, propiedad?.id])

  async function handleDescargarReporte() {
    setDownloadingReporte(true)
    try {
      const [imgs, clienteConfig] = await Promise.all([
        getPropiedadImagenes(propiedad.id),
        getClienteConfig(clienteId),
      ])
      const fotoUrl = imgs[0] ? getPublicImageUrl(imgs[0].storage_path) : null
      await generarReportePropiedad({
        propiedad,
        clienteConfig,
        fotoUrl,
        visitasWeb: metricas.visitasWeb,
        visitasFisicas: metricas.visitasFisicas,
        contactosCount: contactos.length,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setDownloadingReporte(false)
    }
  }

  if (!propiedad) return null
  const isAdmin = userRole?.toLowerCase() === 'admin'
  const isBaja  = propiedad.estado === 'Baja'

  const hasMap = propiedad.latitud != null && propiedad.longitud != null

  function copyPublicLink() {
    const url = `${window.location.origin}/p/${propiedad.id}`
    navigator.clipboard.writeText(url).then(() => setCopied(true))
  }

  const caracteristicas = [
    propiedad.ambientes   && `${propiedad.ambientes} amb.`,
    propiedad.dormitorios && `${propiedad.dormitorios} dorm.`,
    propiedad.banios      && `${propiedad.banios} baño${propiedad.banios !== 1 ? 's' : ''}`,
    propiedad.cochera     && 'Cochera',
  ].filter(Boolean).join('  ·  ')

  const ubicacion = [propiedad.direccion, propiedad.localidad, propiedad.provincia]
    .filter(Boolean).join(', ')

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 520, bgcolor: 'white', display: 'flex', flexDirection: 'column' } } }}
    >
      {/* Header */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1} pr={2}>
            <Box display="flex" alignItems="center" gap={1} mb={0.75} flexWrap="wrap">
              <EstadoBadge estado={propiedad.estado} />
              {propiedad.tipo_propiedad && (
                <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
                  {propiedad.tipo_propiedad}
                </Typography>
              )}
              {propiedad.tipo_operacion && (
                <Chip
                  label={propiedad.tipo_operacion}
                  size="small"
                  sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600, bgcolor: '#F3F4F6', color: '#374151', border: 'none' }}
                />
              )}
            </Box>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
              {propiedad.titulo || 'Sin título'}
            </Typography>
            {ubicacion && (
              <Typography sx={{ fontSize: '0.78rem', color: '#6B7280', mt: 0.5 }}>
                {ubicacion}
              </Typography>
            )}
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        {/* Precio destacado */}
        {propiedad.precio_publicacion && (
          <Box sx={{ bgcolor: ACCENT_LIGHT, border: '1px solid #A7F3D0', borderRadius: '10px', px: 2.5, py: 1.5, mt: 2, display: 'inline-block' }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: ACCENT, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Precio de publicación
            </Typography>
            <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', lineHeight: 1, mt: 0.25, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
              {fmt(propiedad.precio_publicacion, propiedad.moneda)}
            </Typography>
          </Box>
        )}

        {/* Métricas del sitio web */}
        <Box display="flex" gap={1.25} mt={2}>
          <MetricaCard
            icon={<VisibilityIcon sx={{ fontSize: 15, color: ACCENT }} />}
            label="Visitas a la web"
            value={metricas.visitasWeb}
            loading={loadingMetricas}
          />
          <MetricaCard
            icon={<ChatBubbleOutlineIcon sx={{ fontSize: 15, color: ACCENT }} />}
            label="Consultas recibidas"
            value={metricas.consultas}
            loading={loadingMetricas}
          />
        </Box>

        {/* Descargar reporte */}
        <Button
          fullWidth
          variant="outlined"
          onClick={handleDescargarReporte}
          disabled={downloadingReporte}
          startIcon={downloadingReporte ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : <DownloadIcon sx={{ fontSize: 16 }} />}
          sx={{
            mt: 1.25, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem',
            borderColor: '#E5E7EB', color: ACCENT,
            '&:hover': { borderColor: ACCENT, bgcolor: ACCENT_LIGHT },
            '&.Mui-disabled': { borderColor: '#E5E7EB', color: '#9CA3AF' },
          }}
        >
          {downloadingReporte ? 'Generando reporte...' : 'Descargar reporte'}
        </Button>
      </Box>

      {/* Contenido */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 4 }}>

        {/* Fotos */}
        <SectionTitle>Fotos</SectionTitle>
        <ImageGallery propiedadId={propiedad.id} />

        {/* Características */}
        <SectionTitle>Características</SectionTitle>
        <Row label="Tipo de propiedad"  value={propiedad.tipo_propiedad} />
        <Row label="Tipo de operación"  value={propiedad.tipo_operacion} />
        <Row label="Metros cubiertos"   value={propiedad.metros_cubiertos ? `${propiedad.metros_cubiertos} m²` : null} />
        <Row label="Metros totales"     value={propiedad.metros_totales   ? `${propiedad.metros_totales} m²`   : null} />
        <Row label="Ambientes"          value={propiedad.ambientes        ? String(propiedad.ambientes)         : null} />
        <Row label="Dormitorios"        value={propiedad.dormitorios      ? String(propiedad.dormitorios)       : null} />
        <Row label="Baños"              value={propiedad.banios           ? String(propiedad.banios)            : null} />
        <Row label="Cochera"            value={propiedad.cochera ? 'Sí' : null} />

        {/* Descripción */}
        {propiedad.descripcion && (
          <>
            <SectionTitle>Descripción</SectionTitle>
            <Typography sx={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {propiedad.descripcion}
            </Typography>
          </>
        )}

        {/* Ubicación / Mapa */}
        <SectionTitle>Ubicación</SectionTitle>
        <Row label="Provincia"  value={propiedad.provincia} />
        <Row label="Localidad"  value={propiedad.localidad} />
        <Row label="Dirección"  value={propiedad.direccion} />
        {hasMap && (
          <Box mt={1.5} sx={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #E5E7EB', height: 200 }}>
            <Box
              component="iframe"
              title="Mapa"
              src={`https://www.google.com/maps?q=${propiedad.latitud},${propiedad.longitud}&output=embed`}
              sx={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </Box>
        )}
        {!hasMap && (
          <Box mt={1} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
            <RoomIcon sx={{ fontSize: 16, color: '#D1D5DB' }} />
            <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>Sin coordenadas cargadas</Typography>
          </Box>
        )}

        {/* Contactos vinculados */}
        <SectionTitle>Contactos vinculados</SectionTitle>
        {loadingContactos ? (
          <Box display="flex" alignItems="center" gap={1}>
            <CircularProgress size={13} sx={{ color: '#9CA3AF' }} />
            <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Cargando...</Typography>
          </Box>
        ) : contactos.length > 0 ? (
          <Box sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
            {contactos.map((c, i) => (
              <Box key={c.id} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.25,
                borderBottom: i < contactos.length - 1 ? '1px solid #F3F4F6' : 'none',
              }}>
                <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <PersonIcon sx={{ fontSize: 16, color: '#6B7280' }} />
                </Box>
                <Box flex={1} minWidth={0}>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827' }}>
                    {c.apellido}, {c.nombre}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#6B7280', mt: 0.1 }}>
                    {[c.dni && `DNI: ${c.dni}`, c.telefono, c.email].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                {(c.tipos?.length > 0 || c.tipo) && (
                  <Box display="flex" gap={0.5} flexShrink={0}>
                    {(c.tipos?.length ? c.tipos : [c.tipo]).map(t => {
                      const m = TIPO_META[t] ?? { color: '#374151', bg: '#F3F4F6', border: '#E5E7EB' }
                      return (
                        <Box key={t} sx={{ px: 0.75, py: 0.25, borderRadius: '5px', bgcolor: m.bg, border: `1px solid ${m.border}` }}>
                          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: m.color }}>{t}</Typography>
                        </Box>
                      )
                    })}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon sx={{ fontSize: 16, color: '#D1D5DB' }} />
            <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>Sin contactos vinculados</Typography>
          </Box>
        )}

        {/* Documentación respaldatoria */}
        <DocumentacionRespaldatoriaSection
          clienteId={clienteId}
          entidadTipo="propiedad"
          entidadId={propiedad.id}
          inmediato
        />

        {/* Observaciones internas */}
        {propiedad.observaciones_internas && (
          <>
            <SectionTitle>Observaciones internas</SectionTitle>
            <Box sx={{ bgcolor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', p: 1.5 }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#92400E', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {propiedad.observaciones_internas}
              </Typography>
            </Box>
          </>
        )}

        {/* Datos de venta */}
        {propiedad.estado === 'Vendida' && (
          <>
            <SectionTitle>Datos de la venta</SectionTitle>
            <Row label="Comprador"        value={propiedad.comprador_nombre} />
            <Row label="DNI comprador"    value={propiedad.comprador_dni} />
            <Row label="Teléfono"         value={propiedad.comprador_telefono} />
            <Row label="Fecha de venta"   value={fmtDate(propiedad.fecha_venta)} />
            <Row label="Precio final"     value={fmt(propiedad.precio_final_venta, propiedad.moneda)} mono />
          </>
        )}

        {/* Registro */}
        <SectionTitle>Registro</SectionTitle>
        <Row label="Fecha de alta"     value={fmtDate(propiedad.created_at?.split('T')[0])} />
        <Row label="Última actualiz."  value={fmtDate(propiedad.updated_at?.split('T')[0])} />
      </Box>

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, borderTop: '1px solid #E5E7EB', display: 'flex', gap: 1.5, flexShrink: 0, flexWrap: 'wrap' }}>
        {!isBaja && (
          <Button
            variant="contained"
            startIcon={<EditIcon sx={{ fontSize: 15 }} />}
            onClick={onEdit}
            sx={{
              bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
              fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none',
              '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
            }}
          >
            Editar
          </Button>
        )}
        <Tooltip title="Copiar enlace público">
          <Button
            variant="outlined"
            startIcon={<LinkIcon sx={{ fontSize: 15 }} />}
            onClick={copyPublicLink}
            sx={{
              borderRadius: '8px', textTransform: 'none', fontWeight: 600,
              fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280',
              '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' },
            }}
          >
            {copied ? 'Copiado' : 'Compartir'}
          </Button>
        </Tooltip>
        {isAdmin && !isBaja && (
          <Button
            variant="outlined"
            startIcon={<BlockIcon sx={{ fontSize: 15 }} />}
            onClick={onBaja}
            sx={{
              borderRadius: '8px', textTransform: 'none', fontWeight: 600,
              fontSize: '0.82rem', borderColor: '#FECACA', color: '#EF4444',
              '&:hover': { borderColor: '#EF4444', bgcolor: '#FEF2F2' },
            }}
          >
            Dar de baja
          </Button>
        )}
        {isAdmin && isBaja && (
          <Button
            variant="outlined"
            startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 15 }} />}
            onClick={onReactivar}
            sx={{
              borderRadius: '8px', textTransform: 'none', fontWeight: 600,
              fontSize: '0.82rem', borderColor: '#A7F3D0', color: '#065F46',
              '&:hover': { borderColor: '#065F46', bgcolor: '#ECFDF5' },
            }}
          >
            Reactivar
          </Button>
        )}
        <Button
          variant="outlined"
          onClick={onClose}
          sx={{
            borderRadius: '8px', textTransform: 'none', fontWeight: 500,
            fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280',
            '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' },
            ml: 'auto',
          }}
        >
          Cerrar
        </Button>
      </Box>

      <Snackbar
        open={copied}
        autoHideDuration={2500}
        onClose={() => setCopied(false)}
        message="Enlace copiado al portapapeles"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Drawer>
  )
}
