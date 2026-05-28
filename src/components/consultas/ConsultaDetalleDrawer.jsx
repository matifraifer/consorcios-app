import {
  Box, Drawer, Typography, IconButton, Divider,
  Tooltip, Button, CircularProgress,
} from '@mui/material'
import CloseIcon             from '@mui/icons-material/Close'
import PersonIcon            from '@mui/icons-material/Person'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import BlockIcon             from '@mui/icons-material/Block'
import LanguageIcon          from '@mui/icons-material/Language'

const ACCENT = '#065F46'

const ESTADO_META = {
  pendiente:  { label: 'Pendiente',  bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' },
  validada:   { label: 'Validada',   bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7' },
  inactiva:   { label: 'Inactiva',   bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' },
  convertida: { label: 'Convertida', bg: '#EFF6FF', color: '#1D4ED8', border: '#93C5FD' },
}

function EstadoBadge({ estado }) {
  const s = ESTADO_META[estado] ?? ESTADO_META.pendiente
  return (
    <Box component="span" sx={{
      display: 'inline-block', px: 1.25, py: 0.3, borderRadius: '6px',
      bgcolor: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontSize: '0.7rem', fontWeight: 600,
    }}>
      {s.label}
    </Box>
  )
}

function Campo({ label, value, children }) {
  if (!value && !children) return null
  return (
    <Box>
      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', mb: 0.4 }}>
        {label}
      </Typography>
      {children ?? (
        <Typography sx={{ fontSize: '0.875rem', color: '#111827' }}>
          {value}
        </Typography>
      )}
    </Box>
  )
}

function fmt(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ConsultaDetalleDrawer({
  open, onClose, consulta, contactoExiste,
  onValidar, onInactivar, loading,
}) {
  if (!consulta) return null

  const isPendiente = consulta.estado === 'pendiente'

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100vw', sm: 420 }, display: 'flex', flexDirection: 'column' },
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 3, pt: 2.5, pb: 2,
        borderBottom: '1px solid #F3F4F6',
        display: 'flex', alignItems: 'flex-start', gap: 1.5,
      }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: '9px', bgcolor: '#EFF6FF',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25,
        }}>
          <LanguageIcon sx={{ fontSize: 18, color: '#1D4ED8' }} />
        </Box>
        <Box flex={1} minWidth={0}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
            {consulta.apellido}, {consulta.nombre}
          </Typography>
          <Box display="flex" alignItems="center" gap={1} mt={0.6}>
            <EstadoBadge estado={consulta.estado} />
            <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
              {fmt(consulta.created_at)}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#9CA3AF', mt: 0.25 }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Contenido */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* Datos personales */}
        <Box>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', mb: 1.5 }}>
            Datos personales
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <Campo label="DNI">
              <Box display="flex" alignItems="center" gap={0.75}>
                <Typography sx={{ fontSize: '0.875rem', color: '#111827' }}>
                  {consulta.dni ?? '—'}
                </Typography>
                {consulta.dni && contactoExiste && (
                  <Tooltip title="Ya existe un contacto registrado con este DNI">
                    <PersonIcon sx={{ fontSize: 15, color: '#1D4ED8' }} />
                  </Tooltip>
                )}
              </Box>
            </Campo>

            <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
              <Campo label="Teléfono" value={consulta.telefono ?? '—'} />
              <Campo label="Email" value={consulta.email ?? '—'} />
            </Box>
          </Box>
        </Box>

        <Divider sx={{ borderColor: '#F3F4F6' }} />

        {/* Propiedad consultada */}
        <Box>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', mb: 1.5 }}>
            Propiedad consultada
          </Typography>
          {consulta.propiedades ? (
            <Box sx={{ p: 1.5, bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                {consulta.propiedades.titulo}
              </Typography>
              {(consulta.propiedades.direccion || consulta.propiedades.localidad) && (
                <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', mt: 0.3 }}>
                  {[consulta.propiedades.direccion, consulta.propiedades.localidad].filter(Boolean).join(', ')}
                </Typography>
              )}
            </Box>
          ) : (
            <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>Sin propiedad asociada</Typography>
          )}
        </Box>

        <Divider sx={{ borderColor: '#F3F4F6' }} />

        {/* Preferencias */}
        <Box>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', mb: 1.5 }}>
            Preferencias
          </Typography>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
            <Campo
              label="Presupuesto"
              value={consulta.presupuesto ? Number(consulta.presupuesto).toLocaleString('es-AR') : '—'}
            />
            <Campo label="Provincia" value={consulta.provincia ?? '—'} />
            <Campo label="Zona de interés" value={consulta.zona_interes ?? '—'} />
          </Box>
        </Box>

        {/* Mensaje */}
        {consulta.mensaje && (
          <>
            <Divider sx={{ borderColor: '#F3F4F6' }} />
            <Box>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', mb: 1.5 }}>
                Mensaje
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.75, whiteSpace: 'pre-wrap', bgcolor: '#F9FAFB', p: 1.5, borderRadius: '8px', border: '1px solid #F3F4F6' }}>
                {consulta.mensaje}
              </Typography>
            </Box>
          </>
        )}
      </Box>

      {/* Footer con acciones */}
      {isPendiente && (
        <Box sx={{ px: 3, py: 2, borderTop: '1px solid #F3F4F6', display: 'flex', gap: 1.5 }}>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={13} color="inherit" /> : <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
            disabled={loading}
            onClick={onValidar}
            sx={{
              flex: 1, bgcolor: ACCENT, color: 'white', borderRadius: '8px',
              textTransform: 'none', fontWeight: 600, fontSize: '0.82rem',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
              '&.Mui-disabled': { bgcolor: '#E5E7EB', color: '#9CA3AF' },
            }}
          >
            {contactoExiste ? 'Vincular contacto' : 'Crear contacto'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<BlockIcon sx={{ fontSize: 15 }} />}
            disabled={loading}
            onClick={onInactivar}
            sx={{
              borderColor: '#E5E7EB', color: '#6B7280', borderRadius: '8px',
              textTransform: 'none', fontWeight: 600, fontSize: '0.82rem',
              '&:hover': { borderColor: '#EF4444', color: '#EF4444', bgcolor: '#FEF2F2' },
            }}
          >
            Inactivar
          </Button>
        </Box>
      )}
    </Drawer>
  )
}
