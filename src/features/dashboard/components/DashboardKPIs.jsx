import { Box, Grid, Typography } from '@mui/material'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmt(value) {
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function SmallKPI({ label, value, accent = '#065F46' }) {
  return (
    <Box
      sx={{
        bgcolor: 'white',
        borderRadius: '12px',
        p: 3.5,
        height: '100%',
        border: '1px solid #E5E7EB',
        borderTop: `3px solid ${accent}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Typography
        sx={{
          fontSize: '0.65rem',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#9CA3AF',
          mb: 2,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '2.6rem',
          fontWeight: 800,
          color: '#0F172A',
          lineHeight: 1,
          letterSpacing: '-0.03em',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

export default function DashboardKPIs({ kpis }) {
  const { totalAdeudado, deptosMorosos, consorciosMorosos, periodoMasAtrasado } = kpis

  const labelAtrasado = periodoMasAtrasado
    ? `${MESES[(periodoMasAtrasado.mes ?? 1) - 1]} ${periodoMasAtrasado.anio}`
    : '—'

  return (
    <Grid container spacing={2} mb={4} alignItems="stretch">
      {/* Card principal — total adeudado */}
      <Grid item xs={12} md={5}>
        <Box
          sx={{
            bgcolor: 'white',
            border: '1px solid #E5E7EB',
            borderTop: '3px solid #F97316',
            borderRadius: '12px',
            p: 3.5,
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.65rem',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#9CA3AF',
              mb: 2,
            }}
          >
            Monto total adeudado
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: '2rem', sm: '2.6rem' },
              fontWeight: 800,
              lineHeight: 1,
              color: '#0F172A',
              letterSpacing: '-0.03em',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {fmt(totalAdeudado)}
          </Typography>
        </Box>
      </Grid>

      {/* Cards secundarias */}
      <Grid item xs={12} md={7}>
        <Grid container spacing={2} height="100%">
          <Grid item xs={12} sm={4}>
            <SmallKPI
              label="Departamentos morosos"
              value={deptosMorosos}
              accent="#F59E0B"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <SmallKPI
              label="Consorcios con deuda"
              value={consorciosMorosos}
              accent="#065F46"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <SmallKPI
              label="Período más atrasado"
              value={labelAtrasado}
              accent="#EF4444"
            />
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  )
}
