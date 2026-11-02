import { useEffect, useState } from 'react'
import {
  Box, Typography, Drawer, IconButton, TextField, Button, Alert, CircularProgress,
  Select, MenuItem, FormControl, Checkbox, Tooltip, Collapse, ToggleButton, ToggleButtonGroup,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import CloseIcon                 from '@mui/icons-material/Close'
import AddIcon                   from '@mui/icons-material/Add'
import EditIcon                  from '@mui/icons-material/Edit'
import DeleteOutlineIcon         from '@mui/icons-material/DeleteOutline'
import CheckIcon                 from '@mui/icons-material/Check'
import WhatsAppIcon              from '@mui/icons-material/WhatsApp'
import PhoneOutlinedIcon         from '@mui/icons-material/PhoneOutlined'
import MailOutlineIcon           from '@mui/icons-material/MailOutline'
import RadioButtonUncheckedIcon  from '@mui/icons-material/RadioButtonUnchecked'
import CheckCircleIcon           from '@mui/icons-material/CheckCircle'
import ChatBubbleOutlineIcon     from '@mui/icons-material/ChatBubbleOutline'
import PersonAddAltIcon          from '@mui/icons-material/PersonAddAlt'
import TrendingUpIcon            from '@mui/icons-material/TrendingUp'
import LocalOfferOutlinedIcon    from '@mui/icons-material/LocalOfferOutlined'
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined'
import HomeOutlinedIcon          from '@mui/icons-material/HomeOutlined'
import ViewKanbanOutlinedIcon    from '@mui/icons-material/ViewKanbanOutlined'
import NotificationsNoneIcon     from '@mui/icons-material/NotificationsNone'
import TaskAltIcon               from '@mui/icons-material/TaskAlt'
import ExpandMoreIcon            from '@mui/icons-material/ExpandMore'
import { getUsuarios } from '../../../auth/services/auth'
import { useAuth } from '../../../auth/AuthContext.jsx'
import {
  createComentarioContacto, createRecordatorio, deleteComentarioContacto, deleteRecordatorio,
  getHistorialContacto, getRecordatoriosContacto, setRecordatorioCompletado,
  updateComentarioContacto, updateRecordatorio,
} from '../../services/crm'
import { estadoRecordatorio, fechaRelativa, fmtFechaISO, fmtHora, hoyISO } from '../../utils/recordatorios'
import { getContactTipos, tipoContactoMeta } from '../../constants/contactos'
import Iniciales from './Iniciales.jsx'

// ── Tokens ────────────────────────────────────────────────────────────
const ACCENT = '#065F46'
const INK    = '#111827'
const BODY   = '#374151'
const MUTED  = '#6B7280'
const FAINT  = '#9CA3AF'
const LINE   = '#E5E7EB'

// Urgencia del recordatorio: la fecha del próximo paso toma este color
const URGENCIA = {
  vencido: { fg: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  hoy:     { fg: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  normal:  { fg: ACCENT,    bg: '#F0FDF4', border: '#BBF7D0' },
}
const urgenciaDe = fecha => {
  const e = estadoRecordatorio(fecha)
  return e === 'vencido' ? URGENCIA.vencido : e === 'hoy' ? URGENCIA.hoy : URGENCIA.normal
}

const ATAJOS_FECHA = [
  { label: 'Hoy', dias: 0 },
  { label: 'Mañana', dias: 1 },
  { label: 'En 3 días', dias: 3 },
  { label: 'En una semana', dias: 7 },
]

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem', bgcolor: 'white',
    '& fieldset': { borderColor: LINE },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}
const selectSx = {
  fontSize: '0.875rem', borderRadius: '8px', bgcolor: 'white',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: LINE },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
}
const botonPrincipalSx = {
  bgcolor: ACCENT, color: 'white', borderRadius: '8px', textTransform: 'none', fontWeight: 600,
  fontSize: '0.8rem', boxShadow: 'none', px: 1.75, '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: LINE, color: FAINT },
}
const botonSecundarioSx = {
  borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.8rem', borderColor: LINE, color: MUTED,
}
// Íconos de editar/eliminar: aparecen al pasar el mouse (siempre visibles en pantallas táctiles)
const accionesHoverSx = {
  '& .acciones-hover': { opacity: 0, transition: 'opacity 0.12s' },
  '&:hover .acciones-hover, &:focus-within .acciones-hover': { opacity: 1 },
  '@media (hover: none)': { '& .acciones-hover': { opacity: 1 } },
}

// ── Piezas chicas ─────────────────────────────────────────────────────
function SectionHeader({ title, count, action }) {
  return (
    <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} mb={1.5}>
      <Box display="flex" alignItems="baseline" gap={0.75}>
        <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: INK }}>{title}</Typography>
        {count > 0 && <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: FAINT }}>{count}</Typography>}
      </Box>
      {action}
    </Box>
  )
}

function FieldLabel({ children }) {
  return <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: BODY, mb: 0.5 }}>{children}</Typography>
}

const PILL_TONOS = {
  neutro:  { bg: '#F3F4F6', fg: BODY, border: LINE },
  verde:   { bg: '#ECFDF5', fg: ACCENT, border: '#A7F3D0' },
  violeta: { bg: '#F5F3FF', fg: '#7C3AED', border: '#DDD6FE' },
  apagado: { bg: 'transparent', fg: FAINT, border: LINE },
}

function Pill({ children, tono = 'neutro', meta, tachado }) {
  const t = meta ? { bg: meta.bg, fg: meta.color, border: meta.border } : PILL_TONOS[tono]
  return (
    <Box component="span" sx={{
      display: 'inline-block', px: 0.75, py: 0.05, borderRadius: '5px', fontSize: '0.66rem', fontWeight: 700,
      bgcolor: t.bg, color: t.fg, border: `1px solid ${t.border}`, whiteSpace: 'nowrap', lineHeight: 1.6,
      textDecoration: tachado ? 'line-through' : 'none',
    }}>
      {children}
    </Box>
  )
}

function fmtFechaHora(ts) {
  return new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Historial: agrupado por día ──────────────────────────────────────
const pad2 = n => String(n).padStart(2, '0')
const diaLocal = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
const horaLocal = ts => new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

function etiquetaDia(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const texto = new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
    ...(y !== new Date().getFullYear() && { year: 'numeric' }),
  }).replace(/\./g, '')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function agruparPorDia(items) {
  const grupos = []
  for (const h of items) {
    const dia = diaLocal(h.created_at)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo?.dia === dia) ultimo.items.push(h)
    else grupos.push({ dia, items: [h] })
  }
  return grupos
}

const EVENTO_ICONO = {
  creado: PersonAddAltIcon,
  embudo: TrendingUpIcon,
  tipos: LocalOfferOutlinedIcon,
  asignado: AssignmentIndOutlinedIcon,
  propiedad_vinculada: HomeOutlinedIcon,
  propiedad_desvinculada: HomeOutlinedIcon,
  seguimiento_creado: ViewKanbanOutlinedIcon,
  recordatorio_creado: NotificationsNoneIcon,
  recordatorio_completado: TaskAltIcon,
}

function TextoCorto({ children }) {
  return (
    <Typography component="span" sx={{ fontSize: '0.78rem', color: MUTED, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {children}
    </Typography>
  )
}

// Una acción corta y el dato que cambió como chip
function EventoContenido({ h }) {
  const d = h.detalle ?? {}
  const accion = texto => <Typography component="span" sx={{ fontSize: '0.78rem', fontWeight: 600, color: BODY, flexShrink: 0 }}>{texto}</Typography>
  switch (h.tipo) {
    case 'creado':
      return <>{accion('Contacto creado')}{d.origen && d.origen !== 'APP' && <Pill tono={d.origen === 'IA' ? 'violeta' : 'neutro'}>{d.origen}</Pill>}</>
    case 'embudo':
      return (
        <>
          {accion('Embudo')}
          {d.de && <Pill tono="apagado">{d.de}</Pill>}
          {d.de && <Typography component="span" sx={{ fontSize: '0.72rem', color: FAINT }}>→</Typography>}
          {d.a ? <Pill tono="verde">{d.a}</Pill> : <TextoCorto>sin especificar</TextoCorto>}
        </>
      )
    case 'tipos': {
      const de = Array.isArray(d.de) ? d.de : []
      const a = Array.isArray(d.a) ? d.a : []
      return (
        <>
          {accion('Tipo')}
          {a.filter(t => !de.includes(t)).map(t => <Pill key={`+${t}`} meta={tipoContactoMeta(t)}>+ {t}</Pill>)}
          {de.filter(t => !a.includes(t)).map(t => <Pill key={`-${t}`} tono="apagado" tachado>{t}</Pill>)}
        </>
      )
    }
    case 'asignado':
      return d.a ? <>{accion('Asignado a')}<Pill tono="verde">{d.a}</Pill></> : accion('Sin operador asignado')
    case 'propiedad_vinculada':
      return <>{accion('Propiedad vinculada')}<TextoCorto>{d.titulo ?? ''}</TextoCorto></>
    case 'propiedad_desvinculada':
      return <>{accion('Propiedad desvinculada')}<TextoCorto>{d.titulo ?? ''}</TextoCorto></>
    case 'seguimiento_creado':
      return <>{accion('Seguimiento creado')}{d.etapa && <Pill tono="verde">{d.etapa}</Pill>}</>
    case 'recordatorio_creado':
      return (
        <>
          {accion('Recordatorio')}
          {d.fecha && <Pill>{fmtFechaISO(d.fecha).slice(0, 5)}{d.hora ? ` ${fmtHora(d.hora)}` : ''}</Pill>}
          <TextoCorto>{d.descripcion ?? ''}</TextoCorto>
        </>
      )
    case 'recordatorio_completado':
      return <>{accion('Recordatorio hecho')}<TextoCorto>{d.descripcion ?? ''}</TextoCorto></>
    default:
      return <TextoCorto>{h.texto ?? ''}</TextoCorto>
  }
}

// ── Formulario de recordatorio ───────────────────────────────────────
function RecordatorioForm({ value, onChange, usuarios, saving, onSave, onCancel }) {
  const atajoActivo = ATAJOS_FECHA.find(a => hoyISO(a.dias) === value.fecha)?.label
  return (
    <Box sx={{ border: `1px solid ${'#A7F3D0'}`, bgcolor: '#F7FDF9', borderRadius: '12px', p: 1.75, mb: 1.5 }}>
      <TextField fullWidth multiline minRows={2} maxRows={6} size="small" autoFocus value={value.descripcion}
        onChange={e => onChange({ ...value, descripcion: e.target.value })}
        placeholder="¿Qué hay que hacer? Ej: llamar para coordinar la visita"
        inputProps={{ 'aria-label': 'Recordatorio' }} sx={fieldSx} />

      <Box mt={1.5}>
        <FieldLabel>Cuándo</FieldLabel>
        <Box display="flex" flexWrap="wrap" gap={0.75} alignItems="center">
          {ATAJOS_FECHA.map(a => {
            const activo = atajoActivo === a.label
            return (
              <Button key={a.label} size="small" onClick={() => onChange({ ...value, fecha: hoyISO(a.dias) })}
                aria-pressed={activo}
                sx={{
                  textTransform: 'none', fontSize: '0.76rem', fontWeight: 600, borderRadius: '999px', px: 1.25, py: 0.25, minWidth: 0,
                  border: `1px solid ${activo ? ACCENT : LINE}`, bgcolor: activo ? ACCENT : 'white', color: activo ? 'white' : BODY,
                  '&:hover': { bgcolor: activo ? '#047857' : '#ECFDF5', borderColor: ACCENT },
                }}>
                {a.label}
              </Button>
            )
          })}
          <TextField size="small" type="date" value={value.fecha}
            onChange={e => onChange({ ...value, fecha: e.target.value })}
            inputProps={{ 'aria-label': 'Fecha' }}
            sx={{ ...fieldSx, width: 150, '& .MuiOutlinedInput-root': { ...fieldSx['& .MuiOutlinedInput-root'], borderRadius: '999px', fontSize: '0.8rem' } }} />
        </Box>
      </Box>

      <Box display="grid" gap={1.25} mt={1.5} sx={{ gridTemplateColumns: '120px 1fr' }}>
        <Box>
          <FieldLabel>Hora (opcional)</FieldLabel>
          <TextField fullWidth size="small" type="time" value={value.hora}
            onChange={e => onChange({ ...value, hora: e.target.value })} sx={fieldSx} />
        </Box>
        <Box minWidth={0}>
          <FieldLabel>Asignado a</FieldLabel>
          <FormControl fullWidth size="small">
            <Select value={value.asignado_nombre} displayEmpty sx={selectSx}
              onChange={e => onChange({ ...value, asignado_nombre: e.target.value })}>
              <MenuItem value="" sx={{ fontSize: '0.875rem', color: FAINT }}>Sin asignar</MenuItem>
              {usuarios.map(u => (
                <MenuItem key={u.id} value={u.nombre_usuario} sx={{ fontSize: '0.875rem' }}>{u.nombre_usuario}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      <Box display="flex" gap={1} mt={1.75}>
        <Button size="small" onClick={onSave} disabled={saving || !value.descripcion.trim() || !value.fecha}
          startIcon={saving ? <CircularProgress size={12} color="inherit" /> : null} sx={botonPrincipalSx}>
          {saving ? 'Guardando...' : value.id ? 'Guardar cambios' : 'Guardar recordatorio'}
        </Button>
        <Button size="small" variant="outlined" onClick={onCancel} disabled={saving} sx={botonSecundarioSx}>Cancelar</Button>
      </Box>
    </Box>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────
export default function ContactoActividadDrawer({ open, onClose, contacto, clienteId, onChanged }) {
  const { user } = useAuth()
  const yo = user?.nombre_usuario ?? ''

  const [recordatorios, setRecordatorios] = useState([])
  const [historial, setHistorial]         = useState([])
  const [usuarios, setUsuarios]           = useState([])
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState(null)

  const [recForm, setRecForm]             = useState(null)  // { id?, descripcion, fecha, hora, asignado_nombre }
  const [savingRec, setSavingRec]         = useState(false)
  const [togglingId, setTogglingId]       = useState(null)
  const [verCompletados, setVerCompletados] = useState(false)

  const [filtro, setFiltro]               = useState('todo') // 'todo' | 'comentarios'
  const [comentario, setComentario]       = useState('')
  const [savingComentario, setSavingComentario] = useState(false)
  const [editComentario, setEditComentario] = useState(null) // { id, texto }
  const [savingEdit, setSavingEdit]       = useState(false)

  const [confirmDelete, setConfirmDelete] = useState(null)  // { kind: 'recordatorio'|'comentario', item }
  const [deleting, setDeleting]           = useState(false)

  const contactoId = contacto?.id

  useEffect(() => {
    if (!open || !clienteId) return
    getUsuarios(clienteId).then(setUsuarios).catch(() => setUsuarios([]))
  }, [open, clienteId])

  useEffect(() => {
    if (!open || !contactoId) return
    setError(null)
    setRecForm(null)
    setVerCompletados(false)
    setFiltro('todo')
    setComentario('')
    setEditComentario(null)
    setRecordatorios([])
    setHistorial([])
    setLoading(true)
    Promise.all([getRecordatoriosContacto(contactoId), getHistorialContacto(contactoId)])
      .then(([recs, hist]) => { setRecordatorios(recs); setHistorial(hist) })
      .catch(err => setError(err.message ?? 'No se pudo cargar la actividad.'))
      .finally(() => setLoading(false))
  }, [open, contactoId])

  async function recargarHistorial() {
    try { setHistorial(await getHistorialContacto(contactoId)) } catch { /* el historial se refresca al reabrir */ }
  }

  const pendientes  = recordatorios.filter(r => !r.completado)
  const completados = recordatorios.filter(r => r.completado)
  const [proximo, ...despues] = pendientes

  // ── Recordatorios ──
  function nuevoRecordatorio() {
    setRecForm({ descripcion: '', fecha: hoyISO(), hora: '', asignado_nombre: yo })
  }

  function editarRecordatorio(r) {
    setRecForm({ id: r.id, descripcion: r.descripcion, fecha: r.fecha, hora: fmtHora(r.hora), asignado_nombre: r.asignado_nombre ?? '' })
  }

  function ordenar(lista) {
    return [...lista].sort((a, b) => (a.fecha + (a.hora ?? '')).localeCompare(b.fecha + (b.hora ?? '')))
  }

  async function guardarRecordatorio() {
    setSavingRec(true)
    setError(null)
    try {
      const datos = {
        descripcion: recForm.descripcion.trim(),
        fecha: recForm.fecha,
        hora: recForm.hora || null,
        asignado_nombre: recForm.asignado_nombre || null,
      }
      if (recForm.id) {
        const actualizado = await updateRecordatorio(recForm.id, datos)
        setRecordatorios(prev => ordenar(prev.map(r => (r.id === actualizado.id ? actualizado : r))))
      } else {
        const creado = await createRecordatorio({ ...datos, cliente_id: clienteId, contacto_id: contactoId, creado_por: yo })
        setRecordatorios(prev => ordenar([...prev, creado]))
        recargarHistorial()
      }
      setRecForm(null)
      onChanged?.()
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar el recordatorio.')
    } finally {
      setSavingRec(false)
    }
  }

  async function toggleCompletado(r) {
    setTogglingId(r.id)
    setError(null)
    try {
      const actualizado = await setRecordatorioCompletado(r.id, !r.completado, yo)
      setRecordatorios(prev => ordenar(prev.map(x => (x.id === actualizado.id ? actualizado : x))))
      if (actualizado.completado) recargarHistorial()
      onChanged?.()
    } catch (err) {
      setError(err.message ?? 'No se pudo actualizar el recordatorio.')
    } finally {
      setTogglingId(null)
    }
  }

  // ── Comentarios ──
  async function agregarComentario() {
    const texto = comentario.trim()
    if (!texto) return
    setSavingComentario(true)
    setError(null)
    try {
      const creado = await createComentarioContacto({ cliente_id: clienteId, contacto_id: contactoId, texto, usuario_nombre: yo })
      setHistorial(prev => [creado, ...prev])
      setComentario('')
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar el comentario.')
    } finally {
      setSavingComentario(false)
    }
  }

  function handleComentarioKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      agregarComentario()
    }
  }

  async function guardarEdicionComentario() {
    const texto = editComentario.texto.trim()
    if (!texto) return
    setSavingEdit(true)
    setError(null)
    try {
      const actualizado = await updateComentarioContacto(editComentario.id, texto)
      setHistorial(prev => prev.map(h => (h.id === actualizado.id ? actualizado : h)))
      setEditComentario(null)
    } catch (err) {
      setError(err.message ?? 'No se pudo editar el comentario.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function eliminarConfirmado() {
    const { kind, item } = confirmDelete
    setDeleting(true)
    setError(null)
    try {
      if (kind === 'recordatorio') {
        await deleteRecordatorio(item.id)
        setRecordatorios(prev => prev.filter(r => r.id !== item.id))
        onChanged?.()
      } else {
        await deleteComentarioContacto(item.id)
        setHistorial(prev => prev.filter(h => h.id !== item.id))
      }
      setConfirmDelete(null)
    } catch (err) {
      setError(err.message ?? 'No se pudo eliminar.')
      setConfirmDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  // ── Render: recordatorios ──
  function accionesRecordatorio(r, color = FAINT) {
    return (
      <Box className="acciones-hover" display="flex" flexShrink={0}>
        {!r.completado && (
          <Tooltip title="Editar">
            <IconButton size="small" aria-label="Editar recordatorio" onClick={() => editarRecordatorio(r)} disabled={!!recForm}
              sx={{ color, '&:hover': { color: ACCENT } }}>
              <EditIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Eliminar">
          <IconButton size="small" aria-label="Eliminar recordatorio" onClick={() => setConfirmDelete({ kind: 'recordatorio', item: r })}
            sx={{ color, '&:hover': { color: '#EF4444' } }}>
            <DeleteOutlineIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Box>
    )
  }

  // El próximo paso: la fecha es el titular, con el color de la urgencia
  function renderProximo(r) {
    if (recForm?.id === r.id) {
      return <RecordatorioForm value={recForm} onChange={setRecForm} usuarios={usuarios}
        saving={savingRec} onSave={guardarRecordatorio} onCancel={() => setRecForm(null)} />
    }
    const u = urgenciaDe(r.fecha)
    const vencido = estadoRecordatorio(r.fecha) === 'vencido'
    return (
      <Box sx={{ ...accionesHoverSx, bgcolor: u.bg, border: `1px solid ${u.border}`, borderRadius: '12px', p: 2 }}>
        <Box display="flex" alignItems="baseline" gap={1} flexWrap="wrap">
          <Typography sx={{ fontSize: '1.4rem', fontWeight: 700, color: u.fg, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
            {fechaRelativa(r.fecha)}
          </Typography>
          {r.hora && <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: u.fg }}>{fmtHora(r.hora)}</Typography>}
          {vencido && <Typography sx={{ fontSize: '0.75rem', color: MUTED }}>{fmtFechaISO(r.fecha)}</Typography>}
        </Box>
        <Typography sx={{ mt: 0.75, fontSize: '0.92rem', color: INK, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {r.descripcion}
        </Typography>
        <Box display="flex" alignItems="center" gap={1} mt={1.75} flexWrap="wrap">
          {r.asignado_nombre ? (
            <Box display="flex" alignItems="center" gap={0.75} minWidth={0}>
              <Iniciales nombre={r.asignado_nombre} size={22} />
              <Typography sx={{ fontSize: '0.76rem', color: BODY }}>{r.asignado_nombre === yo ? 'Vos' : r.asignado_nombre}</Typography>
            </Box>
          ) : (
            <Typography sx={{ fontSize: '0.76rem', color: MUTED }}>Sin asignar</Typography>
          )}
          <Box flex={1} />
          {accionesRecordatorio(r, MUTED)}
          <Button size="small" onClick={() => toggleCompletado(r)} disabled={togglingId === r.id}
            startIcon={togglingId === r.id ? <CircularProgress size={12} color="inherit" /> : <CheckIcon sx={{ fontSize: 15 }} />}
            sx={botonPrincipalSx}>
            Marcar como hecho
          </Button>
        </Box>
      </Box>
    )
  }

  // Filas compactas: los siguientes pendientes y los completados
  function renderFila(r) {
    if (recForm?.id === r.id) {
      return <Box key={r.id} p={1}><RecordatorioForm value={recForm} onChange={setRecForm} usuarios={usuarios}
        saving={savingRec} onSave={guardarRecordatorio} onCancel={() => setRecForm(null)} /></Box>
    }
    const u = urgenciaDe(r.fecha)
    return (
      <Box key={r.id} sx={{
        ...accionesHoverSx, display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75,
        borderBottom: '1px solid #F3F4F6', '&:last-child': { borderBottom: 0 },
      }}>
        <Box sx={{ width: 32, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          {togglingId === r.id ? <CircularProgress size={16} sx={{ color: ACCENT }} /> : (
            <Tooltip title={r.completado ? 'Marcar como pendiente' : 'Marcar como hecho'}>
              <Checkbox size="small" checked={r.completado} onChange={() => toggleCompletado(r)}
                icon={<RadioButtonUncheckedIcon sx={{ fontSize: 20 }} />} checkedIcon={<CheckCircleIcon sx={{ fontSize: 20 }} />}
                inputProps={{ 'aria-label': r.completado ? 'Marcar como pendiente' : 'Marcar como hecho' }}
                sx={{ p: 0.5, color: '#D1D5DB', '&.Mui-checked': { color: ACCENT }, '&:hover': { color: ACCENT } }} />
            </Tooltip>
          )}
        </Box>
        <Box sx={{ width: 84, flexShrink: 0 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: r.completado ? FAINT : u.fg, lineHeight: 1.2 }}>
            {r.completado ? fmtFechaISO(r.fecha).slice(0, 5) : fechaRelativa(r.fecha)}
          </Typography>
          {r.hora && <Typography sx={{ fontSize: '0.7rem', color: FAINT }}>{fmtHora(r.hora)}</Typography>}
        </Box>
        <Box flex={1} minWidth={0}>
          <Typography sx={{
            fontSize: '0.82rem', color: r.completado ? FAINT : INK, lineHeight: 1.4, wordBreak: 'break-word',
            textDecoration: r.completado ? 'line-through' : 'none',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {r.descripcion}
          </Typography>
          {r.completado && r.completado_por && (
            <Typography sx={{ fontSize: '0.68rem', color: FAINT }}>
              Hecho por {r.completado_por}{r.completado_at ? ` el ${fmtFechaHora(r.completado_at)}` : ''}
            </Typography>
          )}
        </Box>
        {accionesRecordatorio(r)}
        {r.asignado_nombre && !r.completado && (
          <Tooltip title={`Asignado a ${r.asignado_nombre}`}>
            <Box><Iniciales nombre={r.asignado_nombre} size={22} /></Box>
          </Tooltip>
        )}
      </Box>
    )
  }

  // ── Render: historial ──
  function renderComentario(h) {
    const esMio = h.usuario_nombre === yo
    const editando = editComentario?.id === h.id
    return (
      <Box key={h.id} sx={{ ...accionesHoverSx, display: 'flex', gap: 1.25, py: 1 }}>
        <Iniciales nombre={h.usuario_nombre} />
        <Box flex={1} minWidth={0}>
          <Box display="flex" alignItems="center" gap={0.75} minHeight={28}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: INK }}>{h.usuario_nombre || 'Usuario'}</Typography>
            <Tooltip title={fmtFechaHora(h.created_at)}>
              <Typography sx={{ fontSize: '0.7rem', color: FAINT }}>
                {horaLocal(h.created_at)}{h.editado_at ? ', editado' : ''}
              </Typography>
            </Tooltip>
            {esMio && !editando && (
              <Box className="acciones-hover" display="flex" ml="auto">
                <Tooltip title="Editar">
                  <IconButton size="small" aria-label="Editar comentario" onClick={() => setEditComentario({ id: h.id, texto: h.texto })}
                    sx={{ p: 0.4, color: FAINT, '&:hover': { color: ACCENT } }}>
                    <EditIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton size="small" aria-label="Eliminar comentario" onClick={() => setConfirmDelete({ kind: 'comentario', item: h })}
                    sx={{ p: 0.4, color: FAINT, '&:hover': { color: '#EF4444' } }}>
                    <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
          {editando ? (
            <Box mt={0.5}>
              <TextField fullWidth multiline minRows={2} maxRows={8} size="small" autoFocus value={editComentario.texto}
                onChange={e => setEditComentario(prev => ({ ...prev, texto: e.target.value }))} sx={fieldSx} />
              <Box display="flex" gap={1} mt={1}>
                <Button size="small" onClick={guardarEdicionComentario} disabled={savingEdit || !editComentario.texto.trim()}
                  startIcon={savingEdit ? <CircularProgress size={12} color="inherit" /> : null} sx={botonPrincipalSx}>
                  {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                </Button>
                <Button size="small" variant="outlined" onClick={() => setEditComentario(null)} disabled={savingEdit} sx={botonSecundarioSx}>
                  Cancelar
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ mt: 0.25, bgcolor: '#F9FAFB', border: '1px solid #EEF0F2', borderRadius: '2px 10px 10px 10px', px: 1.5, py: 1 }}>
              <Typography sx={{ fontSize: '0.84rem', color: '#1F2937', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {h.texto}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    )
  }

  function renderEvento(h) {
    const Icono = EVENTO_ICONO[h.tipo] ?? ChatBubbleOutlineIcon
    return (
      <Box key={h.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.6 }}>
        <Box sx={{ width: 28, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icono sx={{ fontSize: 12, color: MUTED }} />
          </Box>
        </Box>
        <Box flex={1} minWidth={0} display="flex" alignItems="center" gap={0.75} overflow="hidden">
          <EventoContenido h={h} />
        </Box>
        <Tooltip title={[h.usuario_nombre && `Por ${h.usuario_nombre}`, fmtFechaHora(h.created_at)].filter(Boolean).join(', ')}>
          <Typography sx={{ fontSize: '0.68rem', color: FAINT, flexShrink: 0 }}>{horaLocal(h.created_at)}</Typography>
        </Tooltip>
      </Box>
    )
  }

  const cantidadComentarios = historial.filter(h => h.tipo === 'comentario').length
  const historialVisible = filtro === 'comentarios' ? historial.filter(h => h.tipo === 'comentario') : historial

  // ── Encabezado: la persona y cómo contactarla ──
  const nombreCompleto = contacto ? [contacto.apellido, contacto.nombre].filter(Boolean).join(', ') : ''
  const tipos = getContactTipos(contacto)
  const telefonoDigitos = contacto?.telefono?.replace(/\D/g, '')
  const contactoAcciones = [
    telefonoDigitos && { label: 'WhatsApp', icon: <WhatsAppIcon sx={{ fontSize: 16 }} />, href: `https://wa.me/${telefonoDigitos}`, color: '#128C7E', externo: true },
    contacto?.telefono && { label: 'Llamar', icon: <PhoneOutlinedIcon sx={{ fontSize: 16 }} />, href: `tel:${contacto.telefono}`, color: BODY },
    contacto?.email && { label: 'Email', icon: <MailOutlineIcon sx={{ fontSize: 16 }} />, href: `mailto:${contacto.email}`, color: BODY },
  ].filter(Boolean)

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100vw', sm: 520 }, bgcolor: 'white', display: 'flex', flexDirection: 'column' } } }}
    >
      {/* Encabezado */}
      <Box sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
        <Box display="flex" alignItems="flex-start" gap={1.5}>
          <Iniciales nombre={contacto ? `${contacto.nombre ?? ''} ${contacto.apellido ?? ''}` : ''} size={44} />
          <Box flex={1} minWidth={0}>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: INK, lineHeight: 1.25, wordBreak: 'break-word' }}>
              {nombreCompleto}
            </Typography>
            {tipos.length > 0 && (
              <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.6}>
                {tipos.map(t => <Pill key={t} meta={tipoContactoMeta(t)}>{t}</Pill>)}
              </Box>
            )}
          </Box>
          <IconButton size="small" aria-label="Cerrar" onClick={onClose} sx={{ bgcolor: '#FEE2E2', color: '#DC2626', '&:hover': { bgcolor: '#FECACA' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        {contactoAcciones.length > 0 && (
          <Box display="flex" gap={1} mt={1.75} flexWrap="wrap" sx={{ pl: { xs: 0, sm: 7 } }}>
            {contactoAcciones.map(a => (
              <Button key={a.label} size="small" variant="outlined" component="a" href={a.href} startIcon={a.icon}
                {...(a.externo && { target: '_blank', rel: 'noopener noreferrer' })}
                sx={{
                  textTransform: 'none', fontSize: '0.76rem', fontWeight: 600, borderRadius: '999px', px: 1.25, py: 0.3,
                  borderColor: LINE, color: a.color, '&:hover': { borderColor: a.color, bgcolor: '#F9FAFB' },
                }}>
                {a.label}
              </Button>
            ))}
          </Box>
        )}
      </Box>

      {/* Cuerpo */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {error && (
          <Box px={3} pt={2}>
            <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: '8px', fontSize: '0.8rem' }}>{error}</Alert>
          </Box>
        )}

        {loading ? (
          <Box display="flex" alignItems="center" gap={1} py={6} justifyContent="center">
            <CircularProgress size={18} sx={{ color: ACCENT }} />
            <Typography sx={{ fontSize: '0.8rem', color: FAINT }}>Cargando actividad...</Typography>
          </Box>
        ) : (
          <>
            {/* ── Lo que hay que hacer ── */}
            <Box px={3} pt={2.5} pb={2.5}>
              <SectionHeader
                title="Próximo paso"
                action={proximo && !recForm && (
                  <Button size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={nuevoRecordatorio}
                    sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', color: ACCENT, borderRadius: '8px', '&:hover': { bgcolor: '#ECFDF5' } }}>
                    Agregar recordatorio
                  </Button>
                )}
              />

              {recForm && !recForm.id && (
                <RecordatorioForm value={recForm} onChange={setRecForm} usuarios={usuarios}
                  saving={savingRec} onSave={guardarRecordatorio} onCancel={() => setRecForm(null)} />
              )}

              {proximo ? renderProximo(proximo) : !recForm && (
                <Box sx={{ border: `1px dashed ${LINE}`, borderRadius: '12px', px: 2, py: 2.25, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '0.84rem', color: MUTED, flex: 1, minWidth: 180 }}>
                    No hay nada pendiente con este contacto.
                  </Typography>
                  <Button size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={nuevoRecordatorio} sx={botonPrincipalSx}>
                    Agregar recordatorio
                  </Button>
                </Box>
              )}

              {despues.length > 0 && (
                <Box mt={2.25}>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: MUTED, mb: 0.75 }}>
                    Después ({despues.length})
                  </Typography>
                  <Box sx={{ border: `1px solid ${LINE}`, borderRadius: '10px', overflow: 'hidden' }}>
                    {despues.map(renderFila)}
                  </Box>
                </Box>
              )}

              {completados.length > 0 && (
                <>
                  <Button size="small" onClick={() => setVerCompletados(v => !v)} aria-expanded={verCompletados}
                    endIcon={<ExpandMoreIcon sx={{ fontSize: 16, transform: verCompletados ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />}
                    sx={{ mt: 1.25, ml: -0.75, textTransform: 'none', fontWeight: 600, fontSize: '0.76rem', color: MUTED, borderRadius: '8px' }}>
                    {verCompletados ? 'Ocultar' : 'Ver'} completados ({completados.length})
                  </Button>
                  <Collapse in={verCompletados}>
                    <Box sx={{ border: '1px solid #F3F4F6', borderRadius: '10px', overflow: 'hidden', mt: 0.5, bgcolor: '#FCFCFD' }}>
                      {completados.map(renderFila)}
                    </Box>
                  </Collapse>
                </>
              )}
            </Box>

            {/* Franja: separa lo pendiente de lo que ya pasó */}
            <Box sx={{ height: 8, bgcolor: '#F3F4F6', borderTop: '1px solid #EEF0F2', borderBottom: '1px solid #EEF0F2' }} />

            {/* ── Lo que pasó ── */}
            <Box px={3} pt={2.5} pb={4}>
              <SectionHeader
                title="Historial"
                action={
                  <ToggleButtonGroup size="small" exclusive value={filtro} onChange={(_, v) => v && setFiltro(v)}
                    sx={{
                      '& .MuiToggleButton-root': {
                        textTransform: 'none', fontSize: '0.72rem', fontWeight: 600, px: 1.25, py: 0.25,
                        color: MUTED, borderColor: LINE, lineHeight: 1.6,
                      },
                      '& .Mui-selected': { color: `${ACCENT} !important`, bgcolor: '#ECFDF5 !important' },
                    }}>
                    <ToggleButton value="todo">Todo</ToggleButton>
                    <ToggleButton value="comentarios">Comentarios{cantidadComentarios ? ` (${cantidadComentarios})` : ''}</ToggleButton>
                  </ToggleButtonGroup>
                }
              />

              {/* Nuevo comentario */}
              <Box display="flex" gap={1.25} mb={2.5}>
                <Iniciales nombre={yo} />
                <Box flex={1} minWidth={0}>
                  <TextField fullWidth multiline minRows={1} maxRows={8} size="small" value={comentario}
                    onChange={e => setComentario(e.target.value)} onKeyDown={handleComentarioKeyDown}
                    placeholder="Escribí un comentario..." inputProps={{ 'aria-label': 'Nuevo comentario' }} sx={fieldSx} />
                  <Collapse in={!!comentario.trim()}>
                    <Box display="flex" justifyContent="flex-end" alignItems="center" gap={1.25} mt={1}>
                      <Typography sx={{ fontSize: '0.68rem', color: FAINT, display: { xs: 'none', sm: 'block' } }}>
                        Ctrl + Enter para guardar
                      </Typography>
                      <Button size="small" onClick={agregarComentario} disabled={savingComentario || !comentario.trim()}
                        startIcon={savingComentario ? <CircularProgress size={12} color="inherit" /> : null} sx={botonPrincipalSx}>
                        {savingComentario ? 'Guardando...' : 'Guardar comentario'}
                      </Button>
                    </Box>
                  </Collapse>
                </Box>
              </Box>

              {historialVisible.length === 0 ? (
                <Typography sx={{ fontSize: '0.8rem', color: FAINT }}>
                  {filtro === 'comentarios' ? 'Todavía no hay comentarios. Escribí el primero arriba.' : 'Todavía no hay actividad registrada.'}
                </Typography>
              ) : (
                agruparPorDia(historialVisible).map(grupo => (
                  <Box key={grupo.dia} mb={1.5}>
                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                      <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: BODY, flexShrink: 0 }}>{etiquetaDia(grupo.dia)}</Typography>
                      <Box flex={1} height="1px" bgcolor="#F3F4F6" />
                    </Box>
                    {grupo.items.map(h => (h.tipo === 'comentario' ? renderComentario(h) : renderEvento(h)))}
                  </Box>
                ))
              )}
            </Box>
          </>
        )}
      </Box>

      <Dialog open={!!confirmDelete} onClose={() => !deleting && setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700, color: INK }}>
          {confirmDelete?.kind === 'recordatorio' ? 'Eliminar recordatorio' : 'Eliminar comentario'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: BODY }}>
            ¿Estás seguro que deseas eliminar este {confirmDelete?.kind === 'recordatorio' ? 'recordatorio' : 'comentario'}? Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(null)} disabled={deleting} sx={{ textTransform: 'none', borderRadius: '8px', color: MUTED }}>
            Cancelar
          </Button>
          <Button onClick={eliminarConfirmado} disabled={deleting} variant="contained"
            startIcon={deleting ? <CircularProgress size={12} color="inherit" /> : null}
            sx={{ textTransform: 'none', borderRadius: '8px', bgcolor: '#EF4444', boxShadow: 'none', '&:hover': { bgcolor: '#DC2626', boxShadow: 'none' } }}>
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  )
}
