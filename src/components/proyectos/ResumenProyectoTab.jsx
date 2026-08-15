import { useEffect, useState } from 'react'
import { Box, Typography, Paper, Alert, CircularProgress, LinearProgress } from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import RequestQuoteIcon from '@mui/icons-material/RequestQuote'
import { getEtapasByProyecto } from '../../services/supabase'
import { calcEtapaStats } from '../../utils/calcEtapaStats'
import { ESTADOS_TAREA } from '../../utils/estadosTarea'

const ACCENT = '#065F46'
const DESVIO_MAL = '#DC2626'
const DESVIO_BIEN = '#065F46'
const SECTION_MIN_HEIGHT = 440

function fmt(value) {
  if (!value) return '$0,00'
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function KpiTile({ label, icon, iconColor, children }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: '12px', border: '1px solid #E5E7EB', p: 3, width: '100%' }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#9CA3AF' }}>
          {label}
        </Typography>
        <Box sx={{ display: 'flex', color: iconColor || '#D1D5DB' }}>
          {icon}
        </Box>
      </Box>
      {children}
    </Paper>
  )
}

function SectionCard({ title, children }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: '12px', border: '1px solid #E5E7EB', p: 4, width: '100%', minHeight: SECTION_MIN_HEIGHT, display: 'flex', flexDirection: 'column' }}>
      <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#111827', mb: 3 }}>
        {title}
      </Typography>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>
    </Paper>
  )
}

export default function ResumenProyectoTab({ proyectoId }) {
  const [etapas, setEtapas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getEtapasByProyecto(proyectoId)
      .then(setEtapas)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [proyectoId])

  if (loading) return <Box display="flex" justifyContent="center" py={6}><CircularProgress sx={{ color: ACCENT }} /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  const etapasConStats = etapas.map(etapa => ({ etapa, stats: calcEtapaStats(etapa) }))
  const todasTareas = etapas.flatMap(e => e.tareas_etapa || [])
  const totalTareas = todasTareas.length

  const conteoPorEstado = Object.fromEntries(ESTADOS_TAREA.map(e => [e.value, 0]))
  todasTareas.forEach(t => { conteoPorEstado[t.estado] = (conteoPorEstado[t.estado] ?? 0) + 1 })

  const avanceProyecto = totalTareas
    ? Math.round((conteoPorEstado.finalizado / totalTareas) * 100)
    : 0

  const costoPresupuestado = todasTareas.reduce((s, t) => s + Number(t.costo_presupuestado || 0), 0)
  const costoReal = todasTareas.reduce((s, t) => s + Number(t.costo_real || 0), 0)
  const desvio = costoReal - costoPresupuestado
  const desvioPct = costoPresupuestado ? (desvio / costoPresupuestado) * 100 : null
  const desvioColor = desvio > 0 ? DESVIO_MAL : DESVIO_BIEN

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 3, mb: 3 }}>
        <KpiTile label="Avance del proyecto" icon={<TrendingUpIcon sx={{ fontSize: 22 }} />} iconColor={ACCENT}>
          <Typography sx={{ fontSize: '2.4rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', mb: 2 }}>
            {avanceProyecto}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={avanceProyecto}
            sx={{
              height: 8, borderRadius: 4, bgcolor: '#F1F5F9',
              '& .MuiLinearProgress-bar': { bgcolor: ACCENT, borderRadius: 4 },
            }}
          />
        </KpiTile>

        <KpiTile label="Costo real acumulado" icon={<AccountBalanceWalletIcon sx={{ fontSize: 22 }} />}>
          <Typography sx={{ fontSize: '2.4rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>
            {fmt(costoReal)}
          </Typography>
        </KpiTile>

        <KpiTile label="Costo presupuestado" icon={<RequestQuoteIcon sx={{ fontSize: 22 }} />}>
          <Typography sx={{ fontSize: '2.4rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>
            {fmt(costoPresupuestado)}
          </Typography>
        </KpiTile>

        <KpiTile
          label="Desvío"
          icon={desvio > 0 ? <TrendingUpIcon sx={{ fontSize: 22 }} /> : <TrendingDownIcon sx={{ fontSize: 22 }} />}
          iconColor={desvioColor}
        >
          <Typography sx={{ fontSize: '2.4rem', fontWeight: 800, color: desvioColor, letterSpacing: '-0.02em' }}>
            {desvio > 0 ? '+' : ''}{fmt(desvio)}
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: desvioColor, mt: 1 }}>
            {desvioPct !== null ? `${desvioPct > 0 ? '+' : ''}${desvioPct.toFixed(1)}% vs. presupuestado` : 'Sin presupuesto cargado'}
          </Typography>
        </KpiTile>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <SectionCard title="Avance por etapas">
          {etapasConStats.length === 0 ? (
            <Box flex={1} display="flex" alignItems="center" justifyContent="center">
              <Typography sx={{ fontSize: '0.85rem', color: '#9CA3AF' }}>
                No hay etapas cargadas.
              </Typography>
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" justifyContent="center" gap={4} flex={1}>
              {etapasConStats.map(({ etapa, stats }) => (
                <Box key={etapa.id}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Box sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: etapa.color || ACCENT, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: '#111827' }}>
                        {etapa.nombre}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#6B7280' }}>
                      {stats.avance}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={stats.avance}
                    sx={{
                      height: 12, borderRadius: 6, bgcolor: '#F1F5F9',
                      '& .MuiLinearProgress-bar': { bgcolor: etapa.color || ACCENT, borderRadius: 6 },
                    }}
                  />
                </Box>
              ))}
            </Box>
          )}
        </SectionCard>

        <SectionCard title="Tareas por estado">
          {totalTareas === 0 ? (
            <Box flex={1} display="flex" alignItems="center" justifyContent="center">
              <Typography sx={{ fontSize: '0.85rem', color: '#9CA3AF' }}>
                No hay tareas cargadas.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5, flex: 1 }}>
              {ESTADOS_TAREA.map(estado => (
                <Box
                  key={estado.value}
                  sx={{
                    borderRadius: '12px', bgcolor: estado.bg, p: 3,
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 0.75,
                  }}
                >
                  <Typography sx={{ fontSize: '3.2rem', fontWeight: 800, color: estado.color, lineHeight: 1 }}>
                    {conteoPorEstado[estado.value] ?? 0}
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: estado.color }}>
                    {estado.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </SectionCard>
      </Box>
    </Box>
  )
}
