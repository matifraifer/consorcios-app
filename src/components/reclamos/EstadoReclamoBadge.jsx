import { Box, Typography } from '@mui/material'
import ScheduleIcon from '@mui/icons-material/Schedule'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'

export const ESTADOS_RECLAMO = ['pendiente', 'resuelto', 'descartado']

export const ESTADO_RECLAMO_STYLES = {
  pendiente:  { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A', label: 'Pendiente',  icon: ScheduleIcon },
  resuelto:   { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0', label: 'Resuelto',   icon: CheckCircleOutlineIcon },
  descartado: { bg: '#F1F5F9', color: '#94A3B8', border: '#E2E8F0', label: 'Descartado', icon: HighlightOffIcon },
}

export default function EstadoReclamoBadge({ estado, size = 'medium' }) {
  const s = ESTADO_RECLAMO_STYLES[estado] ?? ESTADO_RECLAMO_STYLES.pendiente
  const Icon = s.icon
  const compact = size === 'small'
  return (
    <Box
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.5,
        bgcolor: s.bg, border: `1px solid ${s.border}`, borderRadius: '20px',
        px: compact ? 0.9 : 1.25, py: compact ? 0.25 : 0.4,
      }}
    >
      <Icon sx={{ fontSize: compact ? 12 : 13, color: s.color }} />
      <Typography sx={{ fontSize: compact ? '0.62rem' : '0.68rem', fontWeight: 700, color: s.color, letterSpacing: '0.04em' }}>
        {s.label}
      </Typography>
    </Box>
  )
}
