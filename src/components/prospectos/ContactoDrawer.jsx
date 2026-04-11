import { Box, Typography, Drawer, IconButton, Button } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import PersonIcon from '@mui/icons-material/Person'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

const ACCENT = '#065F46'

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', py: 1.25, borderBottom: '1px solid #F3F4F6' }}>
      <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', flexShrink: 0, mr: 2 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.8rem', color: '#111827', fontWeight: 500, textAlign: 'right' }}>{value}</Typography>
    </Box>
  )
}

export default function ContactoDrawer({ open, onClose, prospecto, onPassToNextEtapa }) {
  if (!prospecto) return null

  const esVenta = prospecto.tipo_operacion === 'venta'

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      slotProps={{ paper: { sx: { width: 420, bgcolor: 'white', display: 'flex', flexDirection: 'column' } } }}>

      {/* Header */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center" gap={1.25}>
          <Box sx={{ width: 28, height: 28, borderRadius: '7px', bgcolor: '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PersonIcon sx={{ fontSize: 15, color: '#0369A1' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Detalle de contacto</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>{prospecto.nombre} {prospecto.apellido}</Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
        {/* Tipo de operación */}
        <Box mb={3}>
          <Box sx={{
            display: 'inline-flex', px: 1.5, py: 0.5,
            bgcolor: esVenta ? '#ECFDF5' : '#EFF6FF',
            border: `1px solid ${esVenta ? '#A7F3D0' : '#BFDBFE'}`,
            borderRadius: '6px',
          }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: esVenta ? ACCENT : '#1D4ED8' }}>
              {esVenta ? 'Venta / Compra' : 'Alquiler'}
            </Typography>
          </Box>
        </Box>

        {/* Datos de contacto */}
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9CA3AF', mb: 1 }}>
          Datos de contacto
        </Typography>
        <Box mb={3}>
          <InfoRow label="Nombre" value={`${prospecto.nombre} ${prospecto.apellido}`} />
          <InfoRow label="Teléfono" value={prospecto.telefono} />
          <InfoRow label="Email" value={prospecto.email} />
        </Box>

        {/* Preferencias (solo venta) */}
        {esVenta && (
          <>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9CA3AF', mb: 1 }}>
              Preferencias de búsqueda
            </Typography>
            <Box mb={3}>
              <InfoRow
                label="Presupuesto"
                value={prospecto.presupuesto ? `USD ${Number(prospecto.presupuesto).toLocaleString('es-AR')}` : null}
              />
              <InfoRow label="Zona" value={prospecto.zona} />
              <InfoRow label="Tipo de inmueble" value={prospecto.tipo_inmueble} />
              <InfoRow
                label="Crédito hipotecario"
                value={prospecto.credito_hipotecario === true ? 'Sí' : prospecto.credito_hipotecario === false ? 'No' : null}
              />
            </Box>
          </>
        )}

        {/* Propiedad vinculada */}
        {prospecto.propiedades && (
          <>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9CA3AF', mb: 1 }}>
              Propiedad vinculada
            </Typography>
            <Box sx={{ bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', p: 2 }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827' }}>{prospecto.propiedades.titulo}</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF', mt: 0.25 }}>{prospecto.propiedades.localidad}</Typography>
            </Box>
          </>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, borderTop: '1px solid #E5E7EB', display: 'flex', gap: 1.5, flexShrink: 0 }}>
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon sx={{ fontSize: 15 }} />}
          onClick={() => { onPassToNextEtapa(); onClose() }}
          sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
        >
          Pasar a Presentación
        </Button>
        <Button variant="outlined" onClick={onClose}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#374151', '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' } }}>
          Guardar
        </Button>
        <Button variant="text" onClick={onClose}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.82rem', color: '#9CA3AF', '&:hover': { bgcolor: '#F9FAFB' } }}>
          Cerrar
        </Button>
      </Box>
    </Drawer>
  )
}
