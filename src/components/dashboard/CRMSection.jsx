import { useEffect, useMemo, useState } from 'react'
import { Box, Typography, Button, IconButton, Tooltip, Snackbar, FormControl, Select, MenuItem } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import LanguageIcon      from '@mui/icons-material/Language'
import OtherHousesIcon   from '@mui/icons-material/OtherHouses'
import GroupIcon         from '@mui/icons-material/Group'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import ContentCopyIcon   from '@mui/icons-material/ContentCopy'
import CheckIcon         from '@mui/icons-material/Check'
import ArrowForwardIcon  from '@mui/icons-material/ArrowForward'
import PersonOffIcon     from '@mui/icons-material/PersonOff'
import { useAuth } from '../../contexts/AuthContext'
import { getUsuarios } from '../../services/supabase'

const ACCENT = '#065F46'
const DARK   = '#071A0F'

const selectSx = {
  fontSize: '0.75rem',
  fontWeight: 500,
  bgcolor: 'white',
  borderRadius: '8px',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#065F46' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#065F46', borderWidth: 1 },
  '& .MuiSelect-select': { py: 0.6, px: 1.25 },
}

const ETAPA_COLORS = [
  { color: '#1D4ED8', border: '#BFDBFE', bg: '#EFF6FF' },
  { color: '#92400E', border: '#FDE68A', bg: '#FFFBEB' },
  { color: '#6D28D9', border: '#DDD6FE', bg: '#F5F3FF' },
  { color: '#065F46', border: '#A7F3D0', bg: '#ECFDF5' },
]

function saludo() {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'Buenos días'
  if (h >= 12 && h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function fmtFecha() {
  return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function fmtVisita(fecha, hora) {
  if (!fecha) return { diaSemana: '—', diaMes: '', hora: null }
  const d = new Date(`${fecha}T${hora || '00:00'}`)
  return {
    diaSemana: d.toLocaleDateString('es-AR', { weekday: 'short' }),
    diaMes:    d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
    hora:      hora ? hora.slice(0, 5) : null,
  }
}

function groupByTipo(arr) {
  const map = {}
  arr.forEach(p => {
    const t = p.tipo_propiedad || null
    if (!t) return
    map[t] = (map[t] || 0) + 1
  })
  return Object.entries(map).sort((a, b) => b[1] - a[1])
}

function SectionHeader({ icon, title, right }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      mb: 2, pb: 1.5, borderBottom: '2px solid #F3F4F6',
    }}>
      <Box display="flex" alignItems="center" gap={1}>
        {icon}
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>
          {title}
        </Typography>
      </Box>
      {right}
    </Box>
  )
}

export default function CRMSection({ prospectos, etapas, visitas, consultasPendientes = 0, propiedadesData = [], sinAsignar = 0 }) {
  const { user, clienteId } = useAuth()
  const navigate = useNavigate()
  const nombre = user?.nombre_usuario?.split(' ')[0] ?? ''
  const isAdmin = user?.rol?.toLowerCase() === 'admin'

  const [copiedId, setCopiedId]     = useState(null)
  const [snackOpen, setSnackOpen]   = useState(false)
  const [operadores, setOperadores] = useState([])
  const [filtroOperador, setFiltroOperador] = useState('')

  useEffect(() => {
    if (!isAdmin || !clienteId) return
    getUsuarios(clienteId)
      .then(list => setOperadores(list.filter(u => u.rol?.toLowerCase() === 'operador')))
      .catch(() => {})
  }, [isAdmin, clienteId])

  const activeAll = prospectos.filter(p => !p.cerrado)
  const active = isAdmin
    ? (filtroOperador ? activeAll.filter(p => p.asignado_nombre === filtroOperador) : activeAll)
    : activeAll.filter(p => p.asignado_nombre === user?.nombre_usuario)

  const kpiEtapas = etapas.map((etapa, i) => ({
    ...etapa,
    count: active.filter(p => p.etapa_id === etapa.id).length,
    style: ETAPA_COLORS[i % ETAPA_COLORS.length],
  }))

  const porUsuario = useMemo(() => {
    const map = new Map()
    active.forEach(p => {
      if (!p.asignado_nombre) return
      if (!map.has(p.asignado_nombre)) map.set(p.asignado_nombre, 0)
      map.set(p.asignado_nombre, map.get(p.asignado_nombre) + 1)
    })
    return Array.from(map.entries())
      .map(([nombre, count]) => ({ nombre, count }))
      .sort((a, b) => b.count - a.count)
  }, [active])

  const maxPorUsuario = Math.max(...porUsuario.map(u => u.count), 1)

  const ventaProps    = propiedadesData.filter(p => p.tipo_operacion === 'Venta')
  const alquilerProps = propiedadesData.filter(p => p.tipo_operacion === 'Alquiler')
  const ventaTipos    = groupByTipo(ventaProps)
  const alquilerTipos = groupByTipo(alquilerProps)

  function copyPhone(visitaId, telefono) {
    if (!telefono) return
    navigator.clipboard.writeText(telefono).then(() => {
      setCopiedId(visitaId)
      setSnackOpen(true)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  return (
    <Box sx={{ pb: 6 }}>

      {/* ── Hero ── */}
      <Box sx={{
        position: 'relative', overflow: 'hidden',
        borderRadius: '16px', bgcolor: DARK,
        p: { xs: 3, md: '32px 40px' }, mb: 4,
        '&::before': {
          content: '""', position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px', pointerEvents: 'none',
        },
        '&::after': {
          content: '""', position: 'absolute',
          right: '-60px', top: '-60px', width: 240, height: 240,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 65%)',
          pointerEvents: 'none',
        },
      }}>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography sx={{
            fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: '#10B981', mb: 0.875,
          }}>
            Panel CRM · {fmtFecha()}
          </Typography>
          <Typography sx={{
            fontSize: { xs: '1.4rem', md: '1.75rem' },
            fontWeight: 800, color: 'white', lineHeight: 1.1, letterSpacing: '-0.025em',
          }}>
            {saludo()}{nombre ? `, ${nombre}` : ''}
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', mt: 0.75 }}>
            {active.length} seguimiento{active.length !== 1 ? 's' : ''} activo{active.length !== 1 ? 's' : ''} en pipeline
          </Typography>
        </Box>
      </Box>

      {/* ══ CONSULTAS WEB ══ */}
      <Box sx={{ mb: 4 }}>
        <SectionHeader
          icon={<LanguageIcon sx={{ fontSize: 16, color: '#1D4ED8' }} />}
          title="Consultas Web"
          right={
            <Button
              size="small"
              endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
              onClick={() => navigate('/consultas-web')}
              sx={{
                fontSize: '0.72rem', fontWeight: 600, textTransform: 'none',
                color: '#1D4ED8', borderRadius: '8px', px: 1.5,
                '&:hover': { bgcolor: '#EFF6FF' },
              }}
            >
              Ver consultas
            </Button>
          }
        />

        <Box sx={{
          bgcolor: consultasPendientes > 0 ? '#EFF6FF' : 'white',
          border: `1px solid ${consultasPendientes > 0 ? '#BFDBFE' : '#E5E7EB'}`,
          borderLeft: `4px solid ${consultasPendientes > 0 ? '#1D4ED8' : '#E5E7EB'}`,
          borderRadius: '12px', p: 2.5,
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: '10px', flexShrink: 0,
            bgcolor: consultasPendientes > 0 ? '#DBEAFE' : '#F9FAFB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <LanguageIcon sx={{ fontSize: 22, color: consultasPendientes > 0 ? '#1D4ED8' : '#9CA3AF' }} />
          </Box>
          <Box flex={1}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', mb: 0.25 }}>
              Pendientes de respuesta
            </Typography>
            <Typography sx={{
              fontSize: '2rem', fontWeight: 800, color: consultasPendientes > 0 ? '#1D4ED8' : '#0F172A',
              lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
            }}>
              {consultasPendientes}
            </Typography>
          </Box>
          {consultasPendientes > 0 && (
            <Box display="flex" alignItems="center" gap={1}>
              <Box sx={{
                width: 7, height: 7, borderRadius: '50%', bgcolor: '#FBBF24', flexShrink: 0,
                animation: 'pulse 2s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { boxShadow: '0 0 0 2px rgba(251,191,36,0.35)' },
                  '50%':      { boxShadow: '0 0 0 6px rgba(251,191,36,0.1)'  },
                },
              }} />
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#B45309' }}>
                Requieren atención
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* ══ PROPIEDADES ══ */}
      {isAdmin && (
        <Box sx={{ mb: 4 }}>
          <SectionHeader
            icon={<OtherHousesIcon sx={{ fontSize: 16, color: ACCENT }} />}
            title="Propiedades disponibles"
          />

          <Box display="flex" gap={2} flexWrap="wrap">
            {[
              { label: 'VENTA',    props: ventaProps,    tipos: ventaTipos,    color: ACCENT,    bg: '#ECFDF5', border: '#A7F3D0', tipoColor: ACCENT },
              { label: 'ALQUILER', props: alquilerProps, tipos: alquilerTipos, color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', tipoColor: '#1D4ED8' },
            ].map(({ label, props, tipos, color, bg, border, tipoColor }) => (
              <Box key={label} sx={{
                flex: '1 1 220px', bgcolor: 'white',
                border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden',
              }}>
                <Box sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: tipos.length > 0 ? '1px solid #F3F4F6' : 'none' }}>
                  <Box sx={{ display: 'inline-flex', px: 1.25, py: 0.35, bgcolor: bg, border: `1px solid ${border}`, borderRadius: '6px', mb: 1.25 }}>
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color }}>{label}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '2.4rem', fontWeight: 800, color: '#0F172A', lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
                    {props.length}
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#9CA3AF', mt: 0.3 }}>
                    propiedad{props.length !== 1 ? 'es' : ''} disponible{props.length !== 1 ? 's' : ''}
                  </Typography>
                </Box>
                {tipos.length > 0 && (
                  <Box sx={{ px: 3, py: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {tipos.map(([tipo, count]) => (
                      <Box key={tipo} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.4, bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '6px' }}>
                        <Typography sx={{ fontSize: '0.65rem', color: '#374151', fontWeight: 500 }}>{tipo}</Typography>
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: tipoColor }}>{count}</Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* ══ SEGUIMIENTO DE CONTACTOS ══ */}
      <Box sx={{ mb: 4 }}>
        <SectionHeader
          icon={<GroupIcon sx={{ fontSize: 16, color: '#7C3AED' }} />}
          title="Seguimiento de contactos"
          right={
            isAdmin ? (
              <Box display="flex" alignItems="center" gap={1.5}>
                <FormControl size="small" sx={{ minWidth: 170 }}>
                  <Select
                    value={filtroOperador}
                    onChange={e => setFiltroOperador(e.target.value)}
                    displayEmpty
                    sx={selectSx}
                  >
                    <MenuItem value=""><em style={{ fontStyle: 'normal', color: '#9CA3AF' }}>Todos los operadores</em></MenuItem>
                    {operadores.map(o => (
                      <MenuItem key={o.id} value={o.nombre_usuario} sx={{ fontSize: '0.78rem' }}>{o.nombre_usuario}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {sinAsignar > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5, bgcolor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px' }}>
                    <PersonOffIcon sx={{ fontSize: 13, color: '#B45309' }} />
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#B45309' }}>
                      {sinAsignar} sin asignar
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : null
          }
        />

        {/* Etapas */}
        <Box display="flex" gap={1.5} mb={2} flexWrap="wrap">
          {kpiEtapas.map(etapa => (
            <Box key={etapa.id} sx={{
              flex: '1 1 110px',
              bgcolor: etapa.style.bg,
              border: `1px solid ${etapa.style.border}`,
              borderRadius: '12px', p: 2,
            }}>
              <Typography sx={{ fontSize: '0.57rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: etapa.style.color, opacity: 0.75, mb: 1 }}>
                {etapa.nombre}
              </Typography>
              <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, color: etapa.style.color, lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
                {etapa.count}
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: etapa.style.color, opacity: 0.6, mt: 0.3 }}>
                contacto{etapa.count !== 1 ? 's' : ''}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Por agente */}
        {porUsuario.length > 0 && (
          <Box sx={{ bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden' }}>
            <Box sx={{ px: 3, py: 1.75, borderBottom: '1px solid #F3F4F6' }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151' }}>Por agente</Typography>
            </Box>
            {porUsuario.map((row, i) => (
              <Box key={row.nombre} sx={{
                display: 'flex', alignItems: 'center', gap: 2,
                px: 3, py: 1.5,
                borderBottom: i < porUsuario.length - 1 ? '1px solid #F9FAFB' : 'none',
              }}>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '50%', bgcolor: '#ECFDF5', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: ACCENT }}>
                    {row.nombre.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </Typography>
                </Box>
                <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 500, color: '#111827', flex: 1 }}>
                  {row.nombre}
                </Typography>
                <Box sx={{ width: 120, height: 4, bgcolor: '#F3F4F6', borderRadius: 4, flexShrink: 0 }}>
                  <Box sx={{
                    height: '100%', width: `${(row.count / maxPorUsuario) * 100}%`,
                    bgcolor: ACCENT, borderRadius: 4, opacity: 0.7,
                    transition: 'width 0.5s ease',
                  }} />
                </Box>
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: ACCENT, letterSpacing: '-0.02em', flexShrink: 0, minWidth: 20, textAlign: 'right' }}>
                  {row.count}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* ══ PRÓXIMAS VISITAS ══ */}
      <Box>
        <SectionHeader
          icon={<CalendarTodayIcon sx={{ fontSize: 15, color: '#6B7280' }} />}
          title="Próximas visitas"
        />

        {visitas.length === 0 ? (
          <Box sx={{ bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', px: 3, py: 5, textAlign: 'center' }}>
            <CalendarTodayIcon sx={{ fontSize: 28, color: '#E5E7EB', mb: 1, display: 'block', mx: 'auto' }} />
            <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No hay visitas programadas próximas.</Typography>
          </Box>
        ) : (
          <Box sx={{ bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden' }}>
            {visitas.map((v, i) => {
              const { diaSemana, diaMes, hora } = fmtVisita(v.fecha, v.hora)
              const prospecto = v.prospectos
              const propiedad = v.propiedades
              const isCopied  = copiedId === v.id
              return (
                <Box key={v.id} sx={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  px: 3, py: 1.75,
                  borderBottom: i < visitas.length - 1 ? '1px solid #F9FAFB' : 'none',
                }}>
                  {/* Fecha */}
                  <Box sx={{
                    textAlign: 'center', minWidth: 52, flexShrink: 0,
                    bgcolor: '#F9FAFB', border: '1px solid #F3F4F6',
                    borderRadius: '8px', py: 0.875, px: 1,
                  }}>
                    <Typography sx={{ fontSize: '0.57rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'capitalize', lineHeight: 1.3 }}>
                      {diaSemana}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', mt: 0.1 }}>
                      {diaMes}
                    </Typography>
                    {hora && (
                      <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: ACCENT, mt: 0.25 }}>
                        {hora}
                      </Typography>
                    )}
                  </Box>

                  {/* Contacto + propiedad */}
                  <Box flex={1} overflow="hidden">
                    <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>
                      {prospecto?.nombre} {prospecto?.apellido}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: '0.72rem', color: '#9CA3AF', mt: 0.2 }}>
                      {propiedad?.titulo ?? 'Sin propiedad'}
                      {propiedad?.localidad ? ` · ${propiedad.localidad}` : ''}
                    </Typography>
                  </Box>

                  {/* Copiar teléfono */}
                  {prospecto?.telefono && (
                    <Tooltip title={isCopied ? '¡Copiado!' : `Copiar: ${prospecto.telefono}`} placement="top">
                      <IconButton
                        size="small"
                        onClick={() => copyPhone(v.id, prospecto.telefono)}
                        sx={{
                          flexShrink: 0, borderRadius: '7px',
                          color: isCopied ? ACCENT : '#9CA3AF',
                          bgcolor: isCopied ? '#ECFDF5' : 'transparent',
                          border: `1px solid ${isCopied ? '#A7F3D0' : 'transparent'}`,
                          transition: 'all 0.2s ease',
                          '&:hover': { bgcolor: '#F3F4F6', color: '#374151' },
                        }}
                      >
                        {isCopied
                          ? <CheckIcon sx={{ fontSize: 15 }} />
                          : <ContentCopyIcon sx={{ fontSize: 15 }} />
                        }
                      </IconButton>
                    </Tooltip>
                  )}

                  {/* Asignado */}
                  {prospecto?.asignado_nombre && (
                    <Box sx={{
                      px: 1.25, py: 0.4, flexShrink: 0,
                      bgcolor: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '20px',
                    }}>
                      <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: ACCENT, whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {prospecto.asignado_nombre}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )
            })}
          </Box>
        )}
      </Box>

      <Snackbar
        open={snackOpen}
        autoHideDuration={2000}
        onClose={() => setSnackOpen(false)}
        message="Teléfono copiado al portapapeles"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
