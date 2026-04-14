import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'

const ACCENT       = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'

const ETAPA_COLORS = [
  { color: '#1D4ED8', border: '#BFDBFE', bg: '#EFF6FF' },
  { color: '#92400E', border: '#FDE68A', bg: '#FFFBEB' },
  { color: '#6D28D9', border: '#DDD6FE', bg: '#F5F3FF' },
  { color: '#065F46', border: '#A7F3D0', bg: '#ECFDF5' },
]

function fmtVisita(fecha, hora) {
  if (!fecha) return { fecha: '—', hora: null }
  const d = new Date(`${fecha}T${hora || '00:00'}`)
  return {
    fecha: d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
    hora: hora ? hora.slice(0, 5) : null,
  }
}

function SectionHeader({ label, title }) {
  return (
    <Box mb={4}>
      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: ACCENT, mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
        {title}
      </Typography>
    </Box>
  )
}

export default function CRMSection({ prospectos, etapas, visitas }) {
  const active        = prospectos.filter(p => !p.cerrado)
  const cierreExitoso = prospectos.filter(p => p.cerrado && p.cierre_exitoso === true).length
  const cierreNegativo = prospectos.filter(p => p.cerrado && p.cierre_exitoso === false).length

  const kpiEtapas = etapas.map((etapa, i) => ({
    ...etapa,
    count: active.filter(p => p.etapa_id === etapa.id).length,
    style: ETAPA_COLORS[i % ETAPA_COLORS.length],
  }))

  const ranking = useMemo(() => {
    const map = new Map()
    prospectos.forEach(p => {
      const name = p.asignado_nombre ?? 'Sin asignar'
      if (!map.has(name)) map.set(name, { nombre: name, total: 0, porEtapa: {} })
      const entry = map.get(name)
      entry.total += 1
      if (!p.cerrado && p.etapas_crm?.nombre) {
        const en = p.etapas_crm.nombre
        entry.porEtapa[en] = (entry.porEtapa[en] || 0) + 1
      }
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [prospectos])

  const topUser = ranking[0]?.nombre

  return (
    <Box mt={7}>
      <SectionHeader label="CRM Comercial" title="Panel de prospectos" />

      {/* KPIs por etapa */}
      <Box display="flex" gap={2} mb={2} flexWrap="wrap">
        {kpiEtapas.map(etapa => (
          <Box
            key={etapa.id}
            sx={{
              flex: '1 1 150px',
              bgcolor: 'white',
              border: '1px solid #E5E7EB',
              borderTop: `3px solid ${etapa.style.color}`,
              borderRadius: '12px',
              p: 2.5,
            }}
          >
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', mb: 1.5 }}>
              {etapa.nombre}
            </Typography>
            <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, color: '#0F172A', lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
              {etapa.count}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF', mt: 0.5 }}>
              prospecto{etapa.count !== 1 ? 's' : ''}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Cierres */}
      <Box display="flex" gap={2} mb={4} flexWrap="wrap">
        <Box
          sx={{
            flex: '1 1 200px',
            bgcolor: 'white',
            border: '1px solid #E5E7EB',
            borderTop: '3px solid #10B981',
            borderRadius: '12px',
            p: 2.5,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              bgcolor: '#F0FDF4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CheckCircleOutlineIcon sx={{ fontSize: 20, color: '#10B981' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', mb: 0.25 }}>
              Cierre exitoso
            </Typography>
            <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: '#0F172A', lineHeight: 1, letterSpacing: '-0.03em' }}>
              {cierreExitoso}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            flex: '1 1 200px',
            bgcolor: 'white',
            border: '1px solid #E5E7EB',
            borderTop: '3px solid #EF4444',
            borderRadius: '12px',
            p: 2.5,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              bgcolor: '#FEF2F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <HighlightOffIcon sx={{ fontSize: 20, color: '#EF4444' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', mb: 0.25 }}>
              Cierre negativo
            </Typography>
            <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: '#0F172A', lineHeight: 1, letterSpacing: '-0.03em' }}>
              {cierreNegativo}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Ranking + Próximas visitas */}
      <Box display="flex" gap={3} flexWrap="wrap">

        {/* Ranking */}
        <Box
          sx={{
            flex: '1 1 300px',
            bgcolor: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEventsIcon sx={{ fontSize: 16, color: '#F59E0B' }} />
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827' }}>
              Ranking por usuario
            </Typography>
          </Box>

          {ranking.length === 0 ? (
            <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF', p: 3 }}>Sin datos.</Typography>
          ) : (
            ranking.map((row, i) => {
              const isTop = row.nombre === topUser && row.total > 0
              const etapaResumen = Object.entries(row.porEtapa)
                .map(([e, c]) => `${e}: ${c}`)
                .join(' · ')
              return (
                <Box
                  key={row.nombre}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 3,
                    py: 1.5,
                    borderBottom: i < ranking.length - 1 ? '1px solid #F3F4F6' : 'none',
                    bgcolor: isTop ? '#F0FDF4' : 'transparent',
                  }}
                >
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#D1D5DB', width: 18, flexShrink: 0 }}>
                    {i + 1}
                  </Typography>

                  <Box flex={1} overflow="hidden">
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: isTop ? 700 : 500, color: '#111827' }}>
                        {row.nombre}
                      </Typography>
                      {isTop && (
                        <Box sx={{ px: 1, py: 0.2, bgcolor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '20px', flexShrink: 0 }}>
                          <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: '#92400E' }}>TOP</Typography>
                        </Box>
                      )}
                    </Box>
                    {etapaResumen && (
                      <Typography noWrap sx={{ fontSize: '0.68rem', color: '#9CA3AF', mt: 0.2 }}>
                        {etapaResumen}
                      </Typography>
                    )}
                  </Box>

                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: isTop ? ACCENT : '#374151', letterSpacing: '-0.02em', flexShrink: 0 }}>
                    {row.total}
                  </Typography>
                </Box>
              )
            })
          )}
        </Box>

        {/* Próximas visitas */}
        <Box
          sx={{
            flex: '2 1 380px',
            bgcolor: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarTodayIcon sx={{ fontSize: 14, color: '#6B7280' }} />
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827' }}>
              Proximas visitas
            </Typography>
          </Box>

          {visitas.length === 0 ? (
            <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
              <CalendarTodayIcon sx={{ fontSize: 28, color: '#E5E7EB', mb: 1, display: 'block', mx: 'auto' }} />
              <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>
                No hay visitas programadas proximas.
              </Typography>
            </Box>
          ) : (
            visitas.map((v, i) => {
              const { fecha, hora } = fmtVisita(v.fecha, v.hora)
              const prospecto = v.prospectos
              const propiedad = v.propiedades
              return (
                <Box
                  key={v.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    px: 3,
                    py: 1.75,
                    borderBottom: i < visitas.length - 1 ? '1px solid #F3F4F6' : 'none',
                  }}
                >
                  {/* Fecha/hora */}
                  <Box
                    sx={{
                      textAlign: 'center',
                      minWidth: 60,
                      bgcolor: '#F9FAFB',
                      border: '1px solid #F3F4F6',
                      borderRadius: '8px',
                      py: 0.875,
                      px: 1,
                      flexShrink: 0,
                    }}
                  >
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: '#6B7280', textTransform: 'capitalize', lineHeight: 1.2 }}>
                      {fecha}
                    </Typography>
                    {hora && (
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#111827', mt: 0.25, lineHeight: 1 }}>
                        {hora}
                      </Typography>
                    )}
                  </Box>

                  {/* Prospecto + Propiedad */}
                  <Box flex={1} overflow="hidden">
                    <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>
                      {prospecto?.nombre} {prospecto?.apellido}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: '0.72rem', color: '#9CA3AF', mt: 0.2 }}>
                      {propiedad?.titulo ?? 'Propiedad sin titulo'}
                      {propiedad?.localidad ? ` · ${propiedad.localidad}` : ''}
                    </Typography>
                  </Box>

                  {/* Asignado */}
                  {prospecto?.asignado_nombre && (
                    <Box
                      sx={{
                        px: 1.25,
                        py: 0.4,
                        bgcolor: ACCENT_LIGHT,
                        border: '1px solid #A7F3D0',
                        borderRadius: '20px',
                        flexShrink: 0,
                      }}
                    >
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: ACCENT, whiteSpace: 'nowrap', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {prospecto.asignado_nombre}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )
            })
          )}
        </Box>
      </Box>
    </Box>
  )
}
