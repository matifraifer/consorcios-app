import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box, Typography, ToggleButton, ToggleButtonGroup, Checkbox, Tooltip, CircularProgress, Button, ButtonBase,
} from '@mui/material'
import NotificationsNoneIcon    from '@mui/icons-material/NotificationsNone'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import CheckCircleIcon          from '@mui/icons-material/CheckCircle'
import ChevronRightIcon         from '@mui/icons-material/ChevronRight'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { contarRecordatoriosPosteriores, getRecordatoriosAgenda, setRecordatorioCompletado } from '../../crm/services/crm'
import { fechaRelativa, fmtHora, hoyISO } from '../../crm/utils/recordatorios'
import ContactoActividadDrawer from '../../crm/components/contactos/ContactoActividadDrawer.jsx'
import Iniciales from '../../crm/components/contactos/Iniciales.jsx'

// Recordatorios de contactos en el inicio: una tira de agenda (vencidos + los próximos 7 días)
// con la cantidad por día, y la lista del día elegido. Cada fila se marca como hecha o abre
// la actividad del contacto.

const ACCENT = '#065F46'
const INK    = '#111827'
const BODY   = '#374151'
const MUTED  = '#6B7280'
const FAINT  = '#9CA3AF'
const LINE   = '#E5E7EB'
const DIAS   = 7 // hoy + 6

const TONOS = {
  vencidos: { fg: '#B91C1C', bg: '#FEF2F2', border: '#FECACA', activo: '#DC2626' },
  hoy:      { fg: '#B45309', bg: '#FFFBEB', border: '#FDE68A', activo: '#D97706' },
  dia:      { fg: ACCENT,    bg: '#F0FDF4', border: '#BBF7D0', activo: ACCENT },
}

function etiquetaColumna(iso, i) {
  if (i === 0) return { nombre: 'Hoy', numero: null }
  if (i === 1) return { nombre: 'Mañana', corto: 'Mañ.', numero: null }
  const [y, m, d] = iso.split('-').map(Number)
  const dia = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short' }).replace(/\./g, '')
  return { nombre: dia.charAt(0).toUpperCase() + dia.slice(1), numero: d }
}

function tituloLista(sel, columnas) {
  if (sel === 'vencidos') return 'Vencidos'
  const col = columnas.find(c => c.key === sel)
  if (!col) return ''
  if (col.index <= 1) return col.nombre
  const [y, m, d] = col.key.split('-').map(Number)
  const texto = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function SectionHeader({ right }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1,
      mb: 2, pb: 1.5, borderBottom: '2px solid #F3F4F6',
    }}>
      <Box display="flex" alignItems="center" gap={1}>
        <NotificationsNoneIcon sx={{ fontSize: 17, color: '#D97706' }} />
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: INK }}>Recordatorios</Typography>
      </Box>
      {right}
    </Box>
  )
}

export default function RecordatoriosAgenda() {
  const { user, clienteId } = useAuth()
  const navigate = useNavigate()
  const yo = user?.nombre_usuario ?? ''
  const rol = user?.rol?.toLowerCase()
  const puedeVerEquipo = rol === 'admin' || rol === 'inmo'

  const [alcance, setAlcance]       = useState('mios') // 'mios' | 'equipo'
  const [items, setItems]           = useState([])
  const [masAdelante, setMasAdelante] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(false)
  const [sel, setSel]               = useState(null)    // 'vencidos' | 'YYYY-MM-DD'
  const [togglingId, setTogglingId] = useState(null)
  const [actividadDe, setActividadDe] = useState(null)  // contacto abierto en el drawer

  const hoy = hoyISO()
  const ultimoDia = hoyISO(DIAS - 1)
  const asignado = alcance === 'mios' ? yo : null

  const cargar = useCallback(async () => {
    if (!clienteId) return
    try {
      const [lista, posteriores] = await Promise.all([
        getRecordatoriosAgenda({ clienteId, hasta: ultimoDia, asignado }),
        contarRecordatoriosPosteriores({ clienteId, desde: ultimoDia, asignado }),
      ])
      setItems(lista)
      setMasAdelante(posteriores)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [clienteId, ultimoDia, asignado])

  useEffect(() => { setLoading(true); cargar() }, [cargar])

  const columnas = useMemo(() => {
    const vencidos = items.filter(r => r.fecha < hoy)
    const dias = Array.from({ length: DIAS }, (_, i) => {
      const key = hoyISO(i)
      return { key, index: i, ...etiquetaColumna(key, i), items: items.filter(r => r.fecha === key), tono: i === 0 ? TONOS.hoy : TONOS.dia }
    })
    return [{ key: 'vencidos', index: -1, nombre: 'Vencidos', corto: 'Venc.', numero: null, items: vencidos, tono: TONOS.vencidos }, ...dias]
  }, [items, hoy])

  // Día elegido por defecto: vencidos si hay, si no hoy, si no el primero con algo
  useEffect(() => {
    if (loading) return
    setSel(prev => {
      if (prev && columnas.find(c => c.key === prev)?.items.length) return prev
      return (columnas.find(c => c.items.length) ?? columnas[1]).key
    })
  }, [loading, columnas])

  const seleccionada = columnas.find(c => c.key === sel) ?? columnas[1]
  const total = items.length

  async function marcarHecho(r) {
    setTogglingId(r.id)
    try {
      await setRecordatorioCompletado(r.id, true, yo)
      setItems(prev => prev.filter(x => x.id !== r.id))
    } catch {
      setError(true)
    } finally {
      setTogglingId(null)
    }
  }

  const toggleAlcance = puedeVerEquipo && (
    <ToggleButtonGroup size="small" exclusive value={alcance} onChange={(_, v) => v && setAlcance(v)}
      sx={{
        '& .MuiToggleButton-root': { textTransform: 'none', fontSize: '0.72rem', fontWeight: 600, px: 1.25, py: 0.25, color: MUTED, borderColor: LINE, lineHeight: 1.6, bgcolor: 'white' },
        '& .Mui-selected': { color: `${ACCENT} !important`, bgcolor: '#ECFDF5 !important' },
      }}>
      <ToggleButton value="mios">Míos</ToggleButton>
      <ToggleButton value="equipo">Equipo</ToggleButton>
    </ToggleButtonGroup>
  )

  return (
    <Box sx={{ mb: 4 }}>
      <SectionHeader right={toggleAlcance} />

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress size={22} sx={{ color: ACCENT }} /></Box>
      ) : error && total === 0 ? (
        <Typography sx={{ fontSize: '0.8rem', color: MUTED }}>No se pudieron cargar los recordatorios. Recargá la página para intentarlo de nuevo.</Typography>
      ) : (
        <Box sx={{ bgcolor: 'white', border: `1px solid ${LINE}`, borderRadius: '12px', overflow: 'hidden' }}>
          {/* Tira de agenda */}
          <Box role="tablist" aria-label="Días" sx={{
            display: 'grid', gridTemplateColumns: { xs: '1.25fr repeat(7, minmax(0, 1fr))', sm: '1.3fr repeat(7, minmax(0, 1fr))' },
            borderBottom: `1px solid ${LINE}`,
          }}>
            {columnas.map(c => {
              const n = c.items.length
              const activa = c.key === seleccionada.key
              const conAlgo = n > 0
              const urgente = conAlgo && c.index <= 0
              return (
                <ButtonBase
                  key={c.key}
                  role="tab"
                  aria-selected={activa}
                  aria-label={`${c.nombre}${c.numero ? ` ${c.numero}` : ''}: ${n} ${n === 1 ? 'recordatorio' : 'recordatorios'}`}
                  onClick={() => setSel(c.key)}
                  sx={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    py: { xs: 1.25, sm: 1.75 }, px: 0.5, minWidth: 0, position: 'relative',
                    bgcolor: activa ? c.tono.bg : urgente ? `${c.tono.bg}99` : 'white',
                    borderRight: `1px solid ${LINE}`, '&:last-of-type': { borderRight: 0 },
                    // separación entre "vencidos" y los días
                    ...(c.index === -1 && { borderRight: `2px solid ${LINE}` }),
                    transition: 'background-color 0.12s',
                    '&:hover': { bgcolor: c.tono.bg },
                    '&.Mui-focusVisible': { outline: `2px solid ${c.tono.activo}`, outlineOffset: -2 },
                    '&::after': {
                      content: '""', position: 'absolute', left: 0, right: 0, bottom: 0, height: 3,
                      bgcolor: activa ? c.tono.activo : 'transparent',
                    },
                  }}
                >
                  <Typography sx={{
                    fontSize: { xs: '0.6rem', sm: '0.7rem' }, fontWeight: 600, lineHeight: 1.2,
                    color: activa || urgente ? c.tono.fg : MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                  }}>
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{c.nombre}{c.numero ? ` ${c.numero}` : ''}</Box>
                    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{c.corto ?? c.nombre}{c.numero ? ` ${c.numero}` : ''}</Box>
                  </Typography>
                  <Typography sx={{
                    mt: 0.5, fontSize: { xs: '1.15rem', sm: '1.5rem' }, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em',
                    fontVariantNumeric: 'tabular-nums', color: conAlgo ? (c.index === -1 || c.index === 0 || activa ? c.tono.fg : INK) : '#D1D5DB',
                  }}>
                    {conAlgo ? n : '–'}
                  </Typography>
                </ButtonBase>
              )
            })}
          </Box>

          {/* Lista del día elegido */}
          <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pt: 1.75, pb: 1 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: INK, mb: 0.75 }}>
              {tituloLista(seleccionada.key, columnas)}
              <Box component="span" sx={{ fontWeight: 500, color: FAINT, ml: 0.75 }}>
                {seleccionada.items.length
                  ? `${seleccionada.items.length} ${seleccionada.items.length === 1 ? 'recordatorio' : 'recordatorios'}`
                  : ''}
              </Box>
            </Typography>

            {seleccionada.items.length === 0 ? (
              <Box py={2.5} display="flex" alignItems="center" justifyContent="space-between" gap={1.5} flexWrap="wrap">
                <Typography sx={{ fontSize: '0.8rem', color: MUTED }}>
                  {total === 0
                    ? (alcance === 'mios' ? 'No tenés recordatorios para esta semana.' : 'El equipo no tiene recordatorios para esta semana.')
                    : 'Nada para este día.'}
                </Typography>
                {total === 0 && (
                  <Button size="small" onClick={() => navigate('/contactos')}
                    sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.76rem', color: ACCENT, borderRadius: '8px', '&:hover': { bgcolor: '#ECFDF5' } }}>
                    Ir a contactos
                  </Button>
                )}
              </Box>
            ) : (
              seleccionada.items.map(r => {
                const c = r.contactos
                const vencido = r.fecha < hoy
                return (
                  <Box key={r.id} sx={{
                    display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1.25 }, py: 0.75,
                    borderTop: '1px solid #F3F4F6', '&:first-of-type': { borderTop: 0 },
                  }}>
                    <Box sx={{ width: 30, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                      {togglingId === r.id ? <CircularProgress size={16} sx={{ color: ACCENT }} /> : (
                        <Tooltip title="Marcar como hecho">
                          <Checkbox size="small" checked={false} onChange={() => marcarHecho(r)}
                            icon={<RadioButtonUncheckedIcon sx={{ fontSize: 20 }} />} checkedIcon={<CheckCircleIcon sx={{ fontSize: 20 }} />}
                            inputProps={{ 'aria-label': `Marcar como hecho: ${r.descripcion}` }}
                            sx={{ p: 0.5, color: '#D1D5DB', '&:hover': { color: ACCENT } }} />
                        </Tooltip>
                      )}
                    </Box>

                    <ButtonBase
                      onClick={() => setActividadDe(c)}
                      aria-label={`Abrir actividad de ${c?.apellido}, ${c?.nombre}`}
                      sx={{
                        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, textAlign: 'left',
                        borderRadius: '8px', px: 1, py: 0.5, '&:hover': { bgcolor: '#F9FAFB' },
                        '&.Mui-focusVisible': { outline: `2px solid ${ACCENT}`, outlineOffset: -2 },
                      }}
                    >
                      <Box sx={{ width: { xs: 54, sm: 72 }, flexShrink: 0 }}>
                        <Typography sx={{ fontSize: '0.76rem', fontWeight: 700, color: vencido ? '#B91C1C' : BODY, lineHeight: 1.2 }}>
                          {vencido ? fechaRelativa(r.fecha) : r.hora ? fmtHora(r.hora) : 'Sin hora'}
                        </Typography>
                        {vencido && r.hora && <Typography sx={{ fontSize: '0.68rem', color: FAINT }}>{fmtHora(r.hora)}</Typography>}
                      </Box>
                      <Box flex={1} minWidth={0}>
                        <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 600, color: INK, lineHeight: 1.3 }}>
                          {[c?.apellido, c?.nombre].filter(Boolean).join(', ')}
                        </Typography>
                        <Typography noWrap sx={{ fontSize: '0.76rem', color: MUTED, lineHeight: 1.35 }}>
                          {r.descripcion}
                        </Typography>
                      </Box>
                      {alcance === 'equipo' && r.asignado_nombre && (
                        <Tooltip title={`Asignado a ${r.asignado_nombre}`}>
                          <Box><Iniciales nombre={r.asignado_nombre} size={24} /></Box>
                        </Tooltip>
                      )}
                      <ChevronRightIcon sx={{ fontSize: 18, color: '#D1D5DB', flexShrink: 0 }} />
                    </ButtonBase>
                  </Box>
                )
              })
            )}
          </Box>

          {masAdelante > 0 && (
            <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pb: 1.5 }}>
              <Typography sx={{ fontSize: '0.72rem', color: FAINT }}>
                Y {masAdelante} {masAdelante === 1 ? 'recordatorio' : 'recordatorios'} más adelante.
              </Typography>
            </Box>
          )}
        </Box>
      )}

      <ContactoActividadDrawer
        open={!!actividadDe}
        onClose={() => setActividadDe(null)}
        contacto={actividadDe}
        clienteId={clienteId}
        onChanged={cargar}
      />
    </Box>
  )
}
