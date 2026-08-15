import { useEffect, useState } from 'react'
import { Box, Typography, Paper, Alert, CircularProgress, Tooltip } from '@mui/material'
import TimelineIcon from '@mui/icons-material/Timeline'
import { getEtapasByProyecto } from '../../services/supabase'
import { calcEtapaStats } from '../../utils/calcEtapaStats'

const ACCENT = '#065F46'
const HOY_COLOR = '#DC2626'

const PX_PER_DAY = 26
const LABEL_WIDTH = 200
const MONTH_ROW_HEIGHT = 22
const DAY_ROW_HEIGHT = 22
const HEADER_HEIGHT = MONTH_ROW_HEIGHT + DAY_ROW_HEIGHT
const ROW_HEIGHT = 44
const BAR_HEIGHT = 20

const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function parseFecha(fecha) {
  if (!fecha) return null
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function fmtFecha(fecha) {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

function diffDias(a, b) {
  return Math.round((b - a) / 86400000)
}

function inicioMes(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function finMes(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function mesesEntre(min, max) {
  const meses = []
  let cur = inicioMes(min)
  while (cur <= max) {
    meses.push(cur)
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }
  return meses
}

function diasEntre(min, max) {
  const dias = []
  let cur = new Date(min)
  while (cur <= max) {
    dias.push(new Date(cur))
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)
  }
  return dias
}

function esFinDeSemana(date) {
  const dia = date.getDay()
  return dia === 0 || dia === 6
}

function fmt(value) {
  if (!value) return '—'
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function GanttProyectoTab({ proyectoId }) {
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

  const filas = etapas
    .map(etapa => ({ etapa, stats: calcEtapaStats(etapa) }))
    .filter(f => f.stats.fechaInicio && f.stats.fechaFin)

  const sinFechas = etapas.filter(e => {
    const s = calcEtapaStats(e)
    return !s.fechaInicio || !s.fechaFin
  })

  if (etapas.length === 0) {
    return (
      <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3, p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
        <TimelineIcon sx={{ fontSize: 40, color: '#10B981' }} />
        <Typography variant="subtitle1" fontWeight={600} color="#1A3D2C">No hay etapas cargadas</Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Creá etapas con tareas fechadas en "Etapas del proyecto" para ver el cronograma acá.
        </Typography>
      </Paper>
    )
  }

  if (filas.length === 0) {
    return (
      <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3, p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
        <TimelineIcon sx={{ fontSize: 40, color: '#10B981' }} />
        <Typography variant="subtitle1" fontWeight={600} color="#1A3D2C">Todavía no hay fechas cargadas</Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Cargá fechas de inicio y fin en las tareas de cada etapa para poder graficar el cronograma.
        </Typography>
      </Paper>
    )
  }

  const rangeStart = inicioMes(new Date(Math.min(...filas.map(f => parseFecha(f.stats.fechaInicio)))))
  const rangeEnd = finMes(new Date(Math.max(...filas.map(f => parseFecha(f.stats.fechaFin)))))
  const meses = mesesEntre(rangeStart, rangeEnd)
  const dias = diasEntre(rangeStart, rangeEnd)
  const totalWidth = Math.max(diffDias(rangeStart, rangeEnd) * PX_PER_DAY, 200)

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const hoyVisible = hoy >= rangeStart && hoy <= rangeEnd
  const hoyLeft = diffDias(rangeStart, hoy) * PX_PER_DAY

  const totalAltura = HEADER_HEIGHT + filas.length * ROW_HEIGHT

  return (
    <Box>
      <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Box sx={{ display: 'flex', width: 'fit-content', minWidth: '100%' }}>
            {/* Columna de nombres (sticky) */}
            <Box sx={{ width: LABEL_WIDTH, flexShrink: 0, position: 'sticky', left: 0, bgcolor: 'white', zIndex: 2, borderRight: '1px solid #E5E7EB' }}>
              <Box sx={{ height: HEADER_HEIGHT, borderBottom: '1px solid #E5E7EB', bgcolor: '#F9FAFB' }} />
              {filas.map(({ etapa }) => (
                <Box
                  key={etapa.id}
                  sx={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center', gap: 1, px: 2, borderBottom: '1px solid #F3F4F6' }}
                >
                  <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: etapa.color || ACCENT, flexShrink: 0 }} />
                  <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827' }}>
                    {etapa.nombre}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Timeline */}
            <Box sx={{ position: 'relative', width: totalWidth, flexShrink: 0, height: totalAltura }}>
              {/* Sombreado de fines de semana */}
              {dias.filter(esFinDeSemana).map(dia => (
                <Box
                  key={`fds-${dia.toISOString()}`}
                  sx={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: diffDias(rangeStart, dia) * PX_PER_DAY,
                    width: PX_PER_DAY, bgcolor: '#F9FAFB', zIndex: 0,
                  }}
                />
              ))}

              {/* Gridlines de mes (línea + etiqueta) */}
              {meses.map(mes => (
                <Box key={mes.toISOString()}>
                  <Box
                    sx={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: diffDias(rangeStart, mes) * PX_PER_DAY,
                      width: '1px', bgcolor: '#E5E7EB', zIndex: 0,
                    }}
                  />
                  <Typography
                    sx={{
                      position: 'absolute', top: 4, left: diffDias(rangeStart, mes) * PX_PER_DAY + 6,
                      fontSize: '0.68rem', fontWeight: 700, color: '#6B7280', letterSpacing: '0.03em', textTransform: 'uppercase',
                      zIndex: 2,
                    }}
                  >
                    {MESES_CORTO[mes.getMonth()]} {mes.getFullYear()}
                  </Typography>
                </Box>
              ))}

              {/* Gridlines de día (línea + número) */}
              {dias.map(dia => (
                <Box key={`dia-${dia.toISOString()}`}>
                  <Box
                    sx={{
                      position: 'absolute', top: MONTH_ROW_HEIGHT, height: DAY_ROW_HEIGHT,
                      left: diffDias(rangeStart, dia) * PX_PER_DAY,
                      width: '1px', bgcolor: '#F1F5F9', zIndex: 0,
                    }}
                  />
                  <Typography
                    sx={{
                      position: 'absolute', top: MONTH_ROW_HEIGHT, height: DAY_ROW_HEIGHT,
                      left: diffDias(rangeStart, dia) * PX_PER_DAY, width: PX_PER_DAY,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.66rem', fontWeight: 600, color: '#9CA3AF',
                      fontVariantNumeric: 'tabular-nums', zIndex: 2,
                    }}
                  >
                    {dia.getDate()}
                  </Typography>
                </Box>
              ))}

              {/* Separador entre fila de mes y fila de día, y debajo del header */}
              <Box sx={{ position: 'absolute', top: MONTH_ROW_HEIGHT - 1, left: 0, right: 0, height: '1px', bgcolor: '#F3F4F6', zIndex: 1 }} />
              <Box sx={{ position: 'absolute', top: HEADER_HEIGHT - 1, left: 0, right: 0, height: '1px', bgcolor: '#E5E7EB', zIndex: 1 }} />

              {/* Separadores de fila */}
              {filas.map((f, i) => (
                <Box
                  key={f.etapa.id}
                  sx={{
                    position: 'absolute', left: 0, right: 0,
                    top: HEADER_HEIGHT + (i + 1) * ROW_HEIGHT - 1,
                    height: '1px', bgcolor: '#F3F4F6', zIndex: 1,
                  }}
                />
              ))}

              {/* Línea de hoy */}
              {hoyVisible && (
                <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: hoyLeft, width: '2px', bgcolor: HOY_COLOR, zIndex: 3 }}>
                  <Typography
                    sx={{
                      position: 'absolute', top: -1, left: 4, fontSize: '0.62rem', fontWeight: 700,
                      color: HOY_COLOR, whiteSpace: 'nowrap',
                    }}
                  >
                    Hoy
                  </Typography>
                </Box>
              )}

              {/* Barras */}
              {filas.map(({ etapa, stats }, i) => {
                const start = parseFecha(stats.fechaInicio)
                const end = parseFecha(stats.fechaFin)
                const left = diffDias(rangeStart, start) * PX_PER_DAY
                const width = Math.max((diffDias(start, end) + 1) * PX_PER_DAY, 18)
                const color = etapa.color || ACCENT
                return (
                  <Tooltip
                    key={etapa.id}
                    placement="top"
                    title={
                      <Box sx={{ fontSize: '0.75rem', lineHeight: 1.6 }}>
                        <Box sx={{ fontWeight: 700 }}>{etapa.nombre}</Box>
                        <Box>{fmtFecha(stats.fechaInicio)} — {fmtFecha(stats.fechaFin)}</Box>
                        <Box>Avance: {stats.avance}%{stats.bloqueadas > 0 ? ` · ${stats.bloqueadas} bloqueada${stats.bloqueadas > 1 ? 's' : ''}` : ''}</Box>
                        <Box>Presupuestado: {fmt(stats.costoPresupuestado)}</Box>
                        <Box>Real: {fmt(stats.costoReal)}</Box>
                      </Box>
                    }
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        left,
                        width,
                        top: HEADER_HEIGHT + i * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2,
                        height: BAR_HEIGHT,
                        borderRadius: '6px',
                        bgcolor: color,
                        cursor: 'default',
                        zIndex: 2,
                        transition: 'filter 0.15s, transform 0.15s',
                        '&:hover': { filter: 'brightness(0.92)', transform: 'scaleY(1.08)' },
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute', top: 0, left: 0, bottom: 0,
                          width: `${stats.avance}%`,
                          bgcolor: 'rgba(255,255,255,0.35)',
                          borderRadius: '6px 0 0 6px',
                        }}
                      />
                    </Box>
                  </Tooltip>
                )
              })}

              {/* Etiqueta de % al final de cada barra */}
              {filas.map(({ etapa, stats }, i) => {
                const start = parseFecha(stats.fechaInicio)
                const end = parseFecha(stats.fechaFin)
                const left = diffDias(rangeStart, start) * PX_PER_DAY
                const width = Math.max((diffDias(start, end) + 1) * PX_PER_DAY, 18)
                return (
                  <Typography
                    key={`label-${etapa.id}`}
                    sx={{
                      position: 'absolute',
                      left: left + width + 8,
                      top: HEADER_HEIGHT + i * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2,
                      height: BAR_HEIGHT,
                      display: 'flex', alignItems: 'center',
                      fontSize: '0.72rem', fontWeight: 600, color: '#6B7280', whiteSpace: 'nowrap',
                      zIndex: 2,
                    }}
                  >
                    {stats.avance}%
                  </Typography>
                )
              })}
            </Box>
          </Box>
        </Box>
      </Paper>

      {sinFechas.length > 0 && (
        <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', mt: 1.5 }}>
          Sin fechas cargadas, no se muestran en el cronograma: {sinFechas.map(e => e.nombre).join(', ')}
        </Typography>
      )}

      <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', mt: 1 }}>
        El detalle de costos, responsables y tareas de cada etapa está en la pestaña "Etapas del proyecto".
      </Typography>
    </Box>
  )
}
