import { useMemo, useState } from 'react'
import { Box, Typography, Tooltip } from '@mui/material'
import { agruparIndices, labelPeriodo } from '../../utils/agruparIndices'

const SERIES = {
  IPC: { color: '#2a78d6', label: 'IPC' },
  ICL: { color: '#eb6834', label: 'ICL' },
}

const W = 800
const H = 260
const PAD_L = 42
const PAD_R = 16
const PAD_T = 16
const PAD_B = 32
const PLOT_W = W - PAD_L - PAD_R
const PLOT_H = H - PAD_T - PAD_B

function fmtVal(v) {
  return `${Number(v).toFixed(2)}%`
}

export default function GraficoIndices({ indices = [], periodo = 'mensual' }) {
  const [visible, setVisible] = useState({ IPC: true, ICL: true })

  const { puntos, minVal, maxVal } = useMemo(() => {
    const agrupados = agruparIndices(indices, periodo)
    const claves = new Map()
    for (const g of agrupados) {
      const key = `${g.anio}-${String(g.mesInicio).padStart(2, '0')}`
      if (!claves.has(key)) claves.set(key, { key, mesInicio: g.mesInicio, mesFin: g.mesFin, anio: g.anio, IPC: null, ICL: null })
      claves.get(key)[g.tipo] = g.valor
    }
    const puntos = [...claves.values()].sort((a, b) => a.key.localeCompare(b.key))
    const valores = agrupados.map(g => g.valor)
    const minVal = valores.length ? Math.min(0, ...valores) : 0
    const maxVal = valores.length ? Math.max(...valores, 1) : 1
    return { puntos, minVal, maxVal }
  }, [indices, periodo])

  if (puntos.length === 0) {
    return (
      <Box sx={{ bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', p: 4, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>No hay índices cargados todavía.</Typography>
      </Box>
    )
  }

  const n = puntos.length
  const xScale = i => PAD_L + (n === 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W)
  const yScale = v => PAD_T + (1 - (v - minVal) / (maxVal - minVal || 1)) * PLOT_H

  const gridSteps = 4
  const gridValues = Array.from({ length: gridSteps + 1 }, (_, i) => minVal + ((maxVal - minVal) * i) / gridSteps)

  const labelStep = Math.max(1, Math.ceil(n / 12))

  function buildSegments(tipo) {
    const segments = []
    let current = []
    puntos.forEach((p, i) => {
      const v = p[tipo]
      if (v === null || v === undefined) {
        if (current.length) segments.push(current)
        current = []
        return
      }
      current.push({ x: xScale(i), y: yScale(v), v, i })
    })
    if (current.length) segments.push(current)
    return segments
  }

  function toggle(tipo) {
    setVisible(prev => ({ ...prev, [tipo]: !prev[tipo] }))
  }

  return (
    <Box sx={{ bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', p: { xs: 2, sm: 3 } }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} mb={2}>
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF' }}>
          Variación de índices en el tiempo
        </Typography>
        <Box display="flex" gap={2}>
          {Object.entries(SERIES).map(([tipo, { color, label }]) => (
            <Box
              key={tipo}
              onClick={() => toggle(tipo)}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', userSelect: 'none', opacity: visible[tipo] ? 1 : 0.4 }}
            >
              <Box sx={{
                width: 14, height: 14, borderRadius: '4px',
                border: `2px solid ${color}`,
                bgcolor: visible[tipo] ? color : 'transparent',
                transition: 'all 0.15s',
              }} />
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <Box sx={{ width: '100%', minWidth: 480, position: 'relative', aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0, display: 'block' }}>
          {/* Gridlines */}
          {gridValues.map((v, i) => (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yScale(v)} y2={yScale(v)} stroke="#e1e0d9" strokeWidth={1} />
              <text x={PAD_L - 8} y={yScale(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#898781">
                {v.toFixed(1)}%
              </text>
            </g>
          ))}

          {/* Eje X */}
          <line x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} stroke="#c3c2b7" strokeWidth={1} />
          {puntos.map((p, i) => (
            i % labelStep === 0 && (
              <text key={p.key} x={xScale(i)} y={H - PAD_B + 16} textAnchor="middle" fontSize={10} fill="#898781">
                {labelPeriodo(p, periodo)}
              </text>
            )
          ))}

          {/* Líneas */}
          {Object.entries(SERIES).map(([tipo, { color }]) => {
            if (!visible[tipo]) return null
            const segments = buildSegments(tipo)
            return (
              <g key={tipo}>
                {segments.map((seg, si) => (
                  <path
                    key={si}
                    d={seg.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            )
          })}
        </svg>

        {/* Puntos con tooltip (overlay HTML para poder usar MUI Tooltip, posicionado en % para escalar junto al SVG) */}
        {Object.entries(SERIES).map(([tipo, { color }]) => {
          if (!visible[tipo]) return null
          return puntos.map((p, i) => {
            const v = p[tipo]
            if (v === null || v === undefined) return null
            const leftPct = (xScale(i) / W) * 100
            const topPct = (yScale(v) / H) * 100
            return (
              <Tooltip key={`${tipo}-${p.key}`} title={`${tipo} — ${labelPeriodo(p, periodo)}: ${fmtVal(v)}`} placement="top">
                <Box sx={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: 10, height: 10,
                  ml: '-5px', mt: '-5px',
                  borderRadius: '50%',
                  bgcolor: color,
                  border: '2px solid white',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
                  cursor: 'default',
                }} />
              </Tooltip>
            )
          })
        })}
      </Box>
      </Box>
    </Box>
  )
}
