import { Box, Grid, Typography } from '@mui/material'
import HomeWorkIcon from '@mui/icons-material/HomeWork'

function fmt(value) {
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function KPI({ label, value, accent }) {
  return (
    <Box
      sx={{
        bgcolor: 'white',
        borderRadius: '12px',
        p: 3.5,
        height: '100%',
        border: '1px solid #E5E7EB',
        borderTop: `3px solid ${accent}`,
      }}
    >
      <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9CA3AF', mb: 2 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: { xs: '1.7rem', sm: '2.2rem' }, fontWeight: 800, color: '#0F172A', lineHeight: 1, letterSpacing: '-0.03em' }}>
        {value}
      </Typography>
    </Box>
  )
}

export default function AlquileresKPIs({ vencidoTotal, corrienteTotal, corrienteCount }) {
  return (
    <Box mb={4}>
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        mb: 2, pb: 1.5, borderBottom: '2px solid #F3F4F6',
      }}>
        <Box display="flex" alignItems="center" gap={1}>
          <HomeWorkIcon sx={{ fontSize: 16, color: '#065F46' }} />
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>
            Alquileres por cobrar
          </Typography>
        </Box>
      </Box>
      <Grid container spacing={2} alignItems="stretch">
        <Grid item xs={12} sm={4}>
          <KPI label="Alquileres vencidos pendientes de cobrar" value={fmt(vencidoTotal)} accent="#EF4444" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KPI label="Alquileres pendientes de cobrar" value={fmt(corrienteTotal)} accent="#F59E0B" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <KPI label="Cantidad de alquileres por cobrar" value={corrienteCount} accent="#065F46" />
        </Grid>
      </Grid>
    </Box>
  )
}
