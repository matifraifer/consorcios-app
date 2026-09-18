import { Box, Typography, Paper } from '@mui/material'
import PaidIcon from '@mui/icons-material/Paid'

export default function CostosProyecto() {
  return (
    <Box>
      <Typography variant="h5" fontWeight={700} color="#1A3D2C" mb={0.5}>
        Costos del proyecto
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Seguimiento de presupuesto y gastos por proyecto
      </Typography>

      <Paper
        elevation={0}
        sx={{
          border: '1px solid #E5E7EB',
          borderRadius: 3,
          p: 6,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
        }}
      >
        <PaidIcon sx={{ fontSize: 40, color: '#10B981' }} />
        <Typography variant="subtitle1" fontWeight={600} color="#1A3D2C">
          Próximamente
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Acá vas a poder controlar los costos de tus proyectos.
        </Typography>
      </Paper>
    </Box>
  )
}
