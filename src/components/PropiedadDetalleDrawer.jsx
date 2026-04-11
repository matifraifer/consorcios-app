import {
  Box, Typography, Drawer, Divider, IconButton, Button, Chip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import BlockIcon from '@mui/icons-material/Block'

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
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export default function PropiedadDetalleDrawer({ open, onClose, propiedad, onEdit, onBaja, userRole }) {
  if (!propiedad) return null
  const isAdmin = userRole?.toLowerCase() === 'admin'
  const isBaja = propiedad.estado === 'Baja'

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

        {propiedad.descripcion && (
          <Section title="Descripción">
            <Typography sx={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {propiedad.descripcion}
            </Typography>
          </Section>
        )}
        
        <Section title="Detalles">
          <Row label="Metros cubiertos"   value={propiedad.metros_cubiertos ? `${propiedad.metros_cubiertos} m²` : null} />
          <Row label="Metros totales"     value={propiedad.metros_totales   ? `${propiedad.metros_totales} m²`   : null} />
          <Row label="Características"   value={caracteristicas || null} />
          <Row label="Propietario"        value={propiedad.propietario_id} />
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
            <Row label="Comprador"          value={propiedad.comprador_nombre} />
            <Row label="DNI comprador"      value={propiedad.comprador_dni} />
            <Row label="Teléfono"           value={propiedad.comprador_telefono} />
            <Row label="Fecha de venta"     value={fmtDate(propiedad.fecha_venta)} />
            <Row label="Precio final"       value={fmt(propiedad.precio_final_venta, propiedad.moneda)} mono />
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
    </Drawer>
  )
}
