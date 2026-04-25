import { useEffect, useState } from 'react'
import {
  Box, Typography, Drawer, IconButton, Button, CircularProgress, Tooltip, Snackbar,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import BlockIcon from '@mui/icons-material/Block'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ImageNotSupportedIcon from '@mui/icons-material/ImageNotSupported'
import LinkIcon from '@mui/icons-material/Link'
import { getPropiedadImagenes, getPublicImageUrl } from '../services/supabase'

const ACCENT = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'

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

function Section({ title, children }) {
  return (
    <Box mb={3}>
      <Typography sx={{
        fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.01em',
        textTransform: 'none', color: '#111827', mb: 1,
      }}>
        {title}
      </Typography>
      {children}
    </Box>
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
  // Cerrar con Escape, navegar con flechas
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
      {/* Cerrar */}
      <IconButton
        onClick={onClose}
        sx={{ position: 'absolute', top: 16, right: 16, color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
      >
        <CloseIcon />
      </IconButton>

      {/* Contador */}
      <Typography sx={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem' }}>
        {index + 1} / {images.length}
      </Typography>

      {/* Flecha izq */}
      {images.length > 1 && (
        <IconButton
          onClick={e => { e.stopPropagation(); onPrev() }}
          sx={{ position: 'absolute', left: 16, color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
        >
          <ChevronLeftIcon />
        </IconButton>
      )}

      {/* Imagen */}
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

      {/* Flecha der */}
      {images.length > 1 && (
        <IconButton
          onClick={e => { e.stopPropagation(); onNext() }}
          sx={{ position: 'absolute', right: 16, color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
        >
          <ChevronRightIcon />
        </IconButton>
      )}

      {/* Miniaturas */}
      {images.length > 1 && (
        <Box
          onClick={e => e.stopPropagation()}
          sx={{
            position: 'absolute', bottom: 16,
            display: 'flex', gap: 1,
            maxWidth: 'calc(100vw - 40px)',
            overflowX: 'auto',
            px: 2,
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
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
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
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <CircularProgress size={14} sx={{ color: '#9CA3AF' }} />
        <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Cargando fotos...</Typography>
      </Box>
    )
  }

  if (images.length === 0) {
    return (
      <Box
        mb={3}
        sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: 100, bgcolor: '#F9FAFB', border: '1px dashed #E5E7EB', borderRadius: '10px', gap: 0.75,
        }}
      >
        <ImageNotSupportedIcon sx={{ fontSize: 22, color: '#D1D5DB' }} />
        <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Sin fotos cargadas</Typography>
      </Box>
    )
  }

  const openLightbox = (i) => setLightboxIndex(i)
  const closeLightbox = () => setLightboxIndex(null)
  const goPrev = (target) => setLightboxIndex(target !== undefined ? target : i => (i - 1 + images.length) % images.length)
  const goNext = (target) => setLightboxIndex(target !== undefined ? target : i => (i + 1) % images.length)

  return (
    <>
      {/* Imagen principal */}
      <Box
        mb={1}
        onClick={() => openLightbox(0)}
        sx={{
          width: '100%', height: 220, borderRadius: '10px', overflow: 'hidden',
          cursor: 'pointer', position: 'relative',
          '&:hover .img-overlay': { opacity: 1 },
        }}
      >
        <Box
          component="img"
          src={images[0]}
          alt=""
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <Box
          className="img-overlay"
          sx={{
            position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.25)',
            opacity: 0, transition: 'opacity 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Typography sx={{ color: 'white', fontSize: '0.75rem', fontWeight: 600, bgcolor: 'rgba(0,0,0,0.4)', px: 1.5, py: 0.5, borderRadius: '20px' }}>
            Ver foto
          </Typography>
        </Box>
      </Box>

      {/* Miniaturas (si hay más de 1) */}
      {images.length > 1 && (
        <Box display="flex" gap={1} mb={3} sx={{ overflowX: 'auto', pb: 0.5 }}>
          {images.slice(1).map((url, i) => (
            <Box
              key={i}
              onClick={() => openLightbox(i + 1)}
              sx={{
                width: 72, height: 54, borderRadius: '8px', overflow: 'hidden',
                flexShrink: 0, cursor: 'pointer', position: 'relative',
                border: '1px solid #E5E7EB',
                '&:hover .thumb-overlay': { opacity: 1 },
              }}
            >
              <Box component="img" src={url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <Box
                className="thumb-overlay"
                sx={{
                  position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.3)',
                  opacity: 0, transition: 'opacity 0.15s',
                }}
              />
            </Box>
          ))}
          {/* Badge total de fotos */}
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
          onClose={closeLightbox}
          onPrev={goPrev}
          onNext={goNext}
        />
      )}
    </>
  )
}

// ── Componente principal ───────────────────────────────────────────────────
export default function PropiedadDetalleDrawer({ open, onClose, propiedad, onEdit, onBaja, onReactivar, userRole }) {
  const [copied, setCopied] = useState(false)

  if (!propiedad) return null
  const isAdmin = userRole?.toLowerCase() === 'admin'
  const isBaja = propiedad.estado === 'Baja'

  function copyPublicLink() {
    const url = `${window.location.origin}/p/${propiedad.id}`
    navigator.clipboard.writeText(url).then(() => setCopied(true))
  }

  const caracteristicas = [
    propiedad.ambientes && `${propiedad.ambientes} amb.`,
    propiedad.dormitorios && `${propiedad.dormitorios} dorm.`,
    propiedad.banios && `${propiedad.banios} baño${propiedad.banios !== 1 ? 's' : ''}`,
    propiedad.cochera && 'Cochera',
  ].filter(Boolean).join('  ·  ')

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
            <Box display="flex" alignItems="center" gap={1} mb={0.75}>
              <EstadoBadge estado={propiedad.estado} />
              <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
                {propiedad.tipo_propiedad}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
              {propiedad.titulo}
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: '#6B7280', mt: 0.5 }}>
              {propiedad.direccion} — {propiedad.localidad}, {propiedad.provincia}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        {/* Precio destacado */}
        <Box sx={{ bgcolor: ACCENT_LIGHT, border: '1px solid #A7F3D0', borderRadius: '10px', px: 2.5, py: 1.5, mt: 2, display: 'inline-block' }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: ACCENT, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Precio de publicación
          </Typography>
          <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', lineHeight: 1, mt: 0.25, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {fmt(propiedad.precio_publicacion, propiedad.moneda)}
          </Typography>
        </Box>
      </Box>

      {/* Contenido */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>

        {/* ── Galería de fotos ── */}
        <ImageGallery propiedadId={propiedad.id} />

        {propiedad.descripcion && (
          <Section title="Descripción">
            <Typography sx={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {propiedad.descripcion}
            </Typography>
          </Section>
        )}

        <Section title="Detalles">
          <Row label="Metros cubiertos"  value={propiedad.metros_cubiertos ? `${propiedad.metros_cubiertos} m²` : null} />
          <Row label="Metros totales"    value={propiedad.metros_totales   ? `${propiedad.metros_totales} m²`   : null} />
          <Row label="Características"  value={caracteristicas || null} />
          <Row label="Propietario"       value={propiedad.propietario_id} />
        </Section>

        {propiedad.observaciones_internas && (
          <Section title="Observaciones internas">
            <Box sx={{ bgcolor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', p: 1.5 }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#92400E', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {propiedad.observaciones_internas}
              </Typography>
            </Box>
          </Section>
        )}

        {propiedad.estado === 'Vendida' && (
          <Section title="Datos de la venta">
            <Row label="Comprador"        value={propiedad.comprador_nombre} />
            <Row label="DNI comprador"    value={propiedad.comprador_dni} />
            <Row label="Teléfono"         value={propiedad.comprador_telefono} />
            <Row label="Fecha de venta"   value={fmtDate(propiedad.fecha_venta)} />
            <Row label="Precio final"     value={fmt(propiedad.precio_final_venta, propiedad.moneda)} mono />
          </Section>
        )}

        <Section title="Registro">
          <Row label="Fecha de alta"    value={fmtDate(propiedad.created_at?.split('T')[0])} />
          <Row label="Última actualiz." value={fmtDate(propiedad.updated_at?.split('T')[0])} />
        </Section>
      </Box>

      {/* Footer acciones */}
      <Box sx={{ px: 3, py: 2, borderTop: '1px solid #E5E7EB', display: 'flex', gap: 1.5, flexShrink: 0 }}>
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
