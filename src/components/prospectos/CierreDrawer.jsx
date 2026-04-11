import { useState } from 'react'
import {
  Box, Typography, Drawer, IconButton, Button, Alert, CircularProgress,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import { cerrarProspecto } from '../../services/supabase'

const ACCENT = '#065F46'

export default function CierreDrawer({ open, onClose, prospecto, onClosed }) {
  const [saving, setSaving] = useState(null) // 'exitoso' | 'negativo' | null
  const [error, setError] = useState(null)

  async function handleCierre(exitoso) {
    setSaving(exitoso ? 'exitoso' : 'negativo')
    setError(null)
    try {
      const propId = exitoso && prospecto.tipo_operacion === 'venta' ? prospecto.propiedad_id : null
      await cerrarProspecto(prospecto.id, exitoso, propId)
      onClosed(prospecto.id, exitoso)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  if (!prospecto) return null

  const tienePropiedad = !!prospecto.propiedad_id
  const esVenta = prospecto.tipo_operacion === 'venta'

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      slotProps={{ paper: { sx: { width: 420, bgcolor: 'white', display: 'flex', flexDirection: 'column' } } }}>

      {/* Header */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Registrar cierre</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>{prospecto.nombre} {prospecto.apellido}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Box sx={{ flex: 1, px: 3, py: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

        <Typography sx={{ fontSize: '0.82rem', color: '#6B7280', lineHeight: 1.7, mb: 3 }}>
          ¿Cómo cerró la gestión con <strong style={{ color: '#111827' }}>{prospecto.nombre} {prospecto.apellido}</strong>?
        </Typography>

        {/* Cierre exitoso */}
        <Box
          sx={{ border: '1px solid #A7F3D0', borderRadius: '12px', p: 2.5, mb: 2, cursor: 'pointer', bgcolor: '#F0FDF4', transition: 'all 0.15s', '&:hover': { bgcolor: '#DCFCE7', borderColor: ACCENT } }}
          onClick={() => !saving && handleCierre(true)}
        >
          <Box display="flex" alignItems="center" gap={1.5} mb={1}>
            {saving === 'exitoso'
              ? <CircularProgress size={20} sx={{ color: ACCENT }} />
              : <CheckCircleIcon sx={{ color: ACCENT, fontSize: 22 }} />
            }
            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#065F46' }}>
              {saving === 'exitoso' ? 'Cerrando...' : 'Cierre exitoso'}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.8rem', color: '#15803D', lineHeight: 1.6 }}>
            La operación se concretó.
            {esVenta && tienePropiedad && (
              <> La propiedad asociada pasará automáticamente a estado <strong>Vendida</strong>.</>
            )}
          </Typography>
        </Box>

        {/* Cierre negativo */}
        <Box
          sx={{ border: '1px solid #FECACA', borderRadius: '12px', p: 2.5, cursor: 'pointer', bgcolor: '#FFF5F5', transition: 'all 0.15s', '&:hover': { bgcolor: '#FEE2E2', borderColor: '#EF4444' } }}
          onClick={() => !saving && handleCierre(false)}
        >
          <Box display="flex" alignItems="center" gap={1.5} mb={1}>
            {saving === 'negativo'
              ? <CircularProgress size={20} sx={{ color: '#EF4444' }} />
              : <CancelIcon sx={{ color: '#EF4444', fontSize: 22 }} />
            }
            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#EF4444' }}>
              {saving === 'negativo' ? 'Procesando...' : 'Cierre negativo'}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.8rem', color: '#B91C1C', lineHeight: 1.6 }}>
            La operación no se concretó. El prospecto quedará archivado y visible con el filtro de cierres negativos.
          </Typography>
        </Box>
      </Box>
    </Drawer>
  )
}
