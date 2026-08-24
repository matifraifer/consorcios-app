import { Box, Typography, Tooltip } from '@mui/material'

const ACCENT_BAR = '#F97316'
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const BAR_TRACK_HEIGHT = 120

function fmtCompact(value) {
  const n = Number(value ?? 0)
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`
  return `$${Math.round(n)}`
}

function fmtFull(value) {
  return `$${Number(value ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function GraficoDeudaPorPeriodo({ data = [] }) {
  if (data.length === 0) return null

  const maxMonto = Math.max(...data.map(d => d.monto), 1)

  return (
    <Box sx={{ bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', p: { xs: 2, sm: 3 } }}>
      <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', mb: 2.5 }}>
        Deuda por período
      </Typography>

      <Box display="flex" alignItems="flex-end" gap={{ xs: 1, sm: 1.5 }} height={BAR_TRACK_HEIGHT}>
        {data.map(({ key, mes, anio, monto }) => {
          const heightPct = monto > 0 ? Math.max(4, (monto / maxMonto) * 100) : 2
          return (
            <Box key={key} flex={1} display="flex" flexDirection="column" alignItems="center" justifyContent="flex-end" height="100%">
              <Tooltip title={`${MESES_CORTOS[mes - 1]} ${anio}: ${fmtFull(monto)}`} placement="top">
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="flex-end" height="100%" width="100%" sx={{ cursor: 'default' }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: monto > 0 ? ACCENT_BAR : '#D1D5DB', mb: 0.5, fontVariantNumeric: 'tabular-nums' }}>
                    {monto > 0 ? fmtCompact(monto) : '—'}
                  </Typography>
                  <Box sx={{
                    width: '60%', maxWidth: 36,
                    height: `${heightPct}%`,
                    bgcolor: monto > 0 ? ACCENT_BAR : '#E5E7EB',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.4s ease',
                  }} />
                </Box>
              </Tooltip>
              <Typography sx={{ fontSize: '0.62rem', color: '#9CA3AF', mt: 1, whiteSpace: 'nowrap' }}>
                {MESES_CORTOS[mes - 1]} {String(anio).slice(-2)}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
