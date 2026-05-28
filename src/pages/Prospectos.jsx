import { useEffect, useMemo, useState } from 'react'
import {
  Box, Typography, Button, Alert, CircularProgress, Snackbar, Switch, FormControlLabel, Tooltip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CancelIcon from '@mui/icons-material/Cancel'
import GroupIcon from '@mui/icons-material/Group'
import {
  DndContext, DragOverlay, useSensor, useSensors, PointerSensor,
  useDraggable, useDroppable,
} from '@dnd-kit/core'
import { getEtapasCRM, getProspectos, updateProspectoEtapa, getPropiedades, getUsuarios, addHistorialProspecto } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'
import ProspectoFormDrawer from '../components/prospectos/ProspectoFormDrawer'
import ContactoDrawer from '../components/prospectos/ContactoDrawer'
import VisitaDrawer from '../components/prospectos/VisitaDrawer'
import NegociacionDrawer from '../components/prospectos/NegociacionDrawer'
import CierreDrawer from '../components/prospectos/CierreDrawer'

const ACCENT = '#065F46'

const ETAPA_CONFIG = [
  { color: '#6B7280', bg: '#F8FAFC', activeBg: '#F1F5F9', light: '#E2E8F0' },
  { color: '#D97706', bg: '#FFFBEB', activeBg: '#FEF9C3', light: '#FDE68A' },
  { color: '#7C3AED', bg: '#F5F3FF', activeBg: '#EDE9FE', light: '#DDD6FE' },
  { color: '#065F46', bg: '#ECFDF5', activeBg: '#D1FAE5', light: '#A7F3D0' },
]

function getEtapaConfig(orden) {
  return ETAPA_CONFIG[(orden ?? 1) - 1] ?? ETAPA_CONFIG[0]
}

// ── Kanban card (draggable) ───────────────────────────────────────────────────
function ProspectoCard({ prospecto, etapaOrden, onAction, onInfo, isOverlay = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: prospecto.id,
    disabled: prospecto.cerrado || isOverlay,
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  const isNegativo = prospecto.cerrado && prospecto.cierre_exitoso === false

  const actionIcon = useMemo(() => {
    if (etapaOrden === 2) return { icon: <CalendarMonthIcon sx={{ fontSize: 17, color: '#D97706' }} />, tooltip: 'Ver y agendar visitas' }
    if (etapaOrden === 3) return { icon: <MonetizationOnIcon sx={{ fontSize: 17, color: '#7C3AED' }} />, tooltip: 'Ver detalle de negociación' }
    if (etapaOrden === 4 && !prospecto.cerrado) return { icon: <CheckCircleOutlineIcon sx={{ fontSize: 17, color: ACCENT }} />, tooltip: null }
    return null
  }, [etapaOrden, prospecto.cerrado])

  const initials = prospecto.asignado_nombre
    ? prospecto.asignado_nombre.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : null

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={!isOverlay ? () => onInfo(prospecto) : undefined}
      sx={{
        bgcolor: isNegativo ? '#FFF5F5' : 'white',
        border: `1px solid ${isNegativo ? '#FECACA' : '#E5E7EB'}`,
        borderLeft: prospecto.origen_web ? '3px solid #1D4ED8' : undefined,
        borderRadius: '10px',
        p: 1.75,
        mb: 1.25,
        cursor: isDragging ? 'grabbing' : (prospecto.cerrado ? 'pointer' : 'grab'),
        opacity: isDragging ? 0.35 : 1,
        boxShadow: isOverlay ? '0 8px 24px rgba(0,0,0,0.12)' : '0 1px 2px rgba(0,0,0,0.04)',
        userSelect: 'none',
        touchAction: 'none',
        transition: isOverlay ? 'none' : 'box-shadow 0.15s',
        '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box flex={1} minWidth={0}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: isNegativo ? '#B91C1C' : '#111827', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {prospecto.apellido}, {prospecto.nombre}
          </Typography>
          {prospecto.propiedades ? (
            <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF', mt: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {prospecto.propiedades.titulo}
            </Typography>
          ) : (
            <Typography sx={{ fontSize: '0.72rem', color: '#D1D5DB', mt: 0.5 }}>Sin propiedad asignada</Typography>
          )}
        </Box>

        <Box display="flex" alignItems="center" gap={0.5} flexShrink={0} ml={1}>
          {isNegativo && <CancelIcon sx={{ fontSize: 14, color: '#EF4444' }} />}
          {/* Acción de etapa */}
          {actionIcon && !prospecto.cerrado && !isOverlay && (
            <Tooltip title={actionIcon.tooltip ?? ''} placement="top" arrow>
              <Box
                onClick={e => { e.stopPropagation(); onAction(prospecto) }}
                sx={{ width: 30, height: 30, borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', '&:hover': { bgcolor: '#F3F4F6' } }}
              >
                {actionIcon.icon}
              </Box>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Asignado */}
      {initials && (
        <Box display="flex" alignItems="center" gap={0.75} mt={1.25}>
          <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: '#475569' }}>{initials}</Typography>
          </Box>
          <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {prospecto.asignado_nombre}
          </Typography>
        </Box>
      )}

    </Box>
  )
}

// ── Kanban column (droppable) ─────────────────────────────────────────────────
function KanbanColumn({ etapa, prospectos, onAction, onInfo }) {
  const config = getEtapaConfig(etapa.orden)
  const { setNodeRef, isOver } = useDroppable({ id: String(etapa.id) })

  return (
    <Box sx={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{
        px: 1.5, py: 1.25, mb: 1,
        borderRadius: '10px',
        bgcolor: config.bg,
        border: `1px solid ${config.light}`,
      }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: config.color, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#111827' }}>
              {etapa.nombre}
            </Typography>
          </Box>
          <Box sx={{ bgcolor: config.light, borderRadius: '20px', px: 1, py: 0.25 }}>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: config.color }}>
              {prospectos.length}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Cards area */}
      <Box
        ref={setNodeRef}
        sx={{
          flex: 1, minHeight: 120,
          bgcolor: isOver ? config.activeBg : '#FAFAFA',
          border: `1px dashed ${isOver ? config.color : '#E5E7EB'}`,
          borderRadius: '10px',
          p: 1.25,
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 280px)',
          transition: 'all 0.15s',
        }}
      >
        {prospectos.length === 0 && !isOver && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80 }}>
            <Typography sx={{ fontSize: '0.72rem', color: '#D1D5DB' }}>Sin prospectos</Typography>
          </Box>
        )}
        {prospectos.map(p => (
          <ProspectoCard
            key={p.id}
            prospecto={p}
            etapaOrden={etapa.orden}
            onAction={onAction}
            onInfo={onInfo}
          />
        ))}
      </Box>
    </Box>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Prospectos() {
  const { user, clienteId } = useAuth()
  const [etapas, setEtapas] = useState([])
  const [prospectos, setProspectos] = useState([])
  const [propiedades, setPropiedades] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [snackMsg, setSnackMsg] = useState('')

  const [tipoFiltro, setTipoFiltro] = useState('venta')
  const [showNegativo, setShowNegativo] = useState(false)

  const [activeId, setActiveId] = useState(null)

  // Drawers
  const [formOpen, setFormOpen] = useState(false)
  const [contactoTarget, setContactoTarget] = useState(null)
  const [visitaTarget, setVisitaTarget] = useState(null)
  const [negociacionTarget, setNegociacionTarget] = useState(null)
  const [cierreTarget, setCierreTarget] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  async function loadEtapas() {
    const data = await getEtapasCRM()
    setEtapas(data)
    return data
  }

  async function loadProspectos() {
    const data = await getProspectos({ tipo_operacion: tipoFiltro, includeCierreNegativo: showNegativo, cliente_id: clienteId })
    setProspectos(data)
  }

  async function loadPropiedades() {
    const data = await getPropiedades({ includeBaja: false, cliente_id: clienteId })
    setPropiedades(data)
  }

  async function loadUsuarios() {
    const data = await getUsuarios(clienteId)
    setUsuarios(data)
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([loadEtapas(), loadPropiedades(), loadUsuarios()])
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadProspectos().catch(err => setError(err.message))
  }, [tipoFiltro, showNegativo])

  // Agrupar por etapa
  const grouped = useMemo(() => {
    const map = {}
    for (const e of etapas) map[e.id] = []
    for (const p of prospectos) {
      if (map[p.etapa_id] !== undefined) map[p.etapa_id].push(p)
    }
    return map
  }, [etapas, prospectos])

  const defaultEtapaId = useMemo(() => etapas.find(e => e.orden === 1)?.id, [etapas])
  const activeProspecto = useMemo(() => prospectos.find(p => p.id === activeId), [prospectos, activeId])
  const activeEtapaOrden = useMemo(() => {
    if (!activeProspecto) return 1
    return etapas.find(e => e.id === activeProspecto.etapa_id)?.orden ?? 1
  }, [activeProspecto, etapas])

  function handleDragStart(event) {
    setActiveId(event.active.id)
  }

  async function handlePassToEtapa(prospecto, targetOrden) {
    const targetEtapa = etapas.find(e => e.orden === targetOrden)
    if (!targetEtapa) return
    setProspectos(prev => prev.map(p => p.id === prospecto.id ? { ...p, etapa_id: targetEtapa.id } : p))
    try {
      await updateProspectoEtapa(prospecto.id, targetEtapa.id)
      addHistorialProspecto(prospecto.id, user?.nombre_usuario ?? 'Sistema', `Pasó a "${targetEtapa.nombre}"`).catch(() => {})
    } catch {
      setProspectos(prev => prev.map(p => p.id === prospecto.id ? { ...p, etapa_id: prospecto.etapa_id } : p))
      setSnackMsg('Error al mover el prospecto.')
      return
    }
    const updated = { ...prospecto, etapa_id: targetEtapa.id }
    if (targetOrden === 1) setContactoTarget(updated)
    else if (targetOrden === 2) setVisitaTarget(updated)
    else if (targetOrden === 3) setNegociacionTarget(updated)
    else if (targetOrden === 4) setCierreTarget(updated)
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return
    const prospectoId = active.id
    const newEtapaId = Number(over.id)
    const current = prospectos.find(p => p.id === prospectoId)
    if (!current || current.etapa_id === newEtapaId || current.cerrado) return
    const toEtapa = etapas.find(e => e.id === newEtapaId)
    // Optimistic update
    setProspectos(prev => prev.map(p => p.id === prospectoId ? { ...p, etapa_id: newEtapaId } : p))
    try {
      await updateProspectoEtapa(prospectoId, newEtapaId)
      addHistorialProspecto(prospectoId, user?.nombre_usuario ?? 'Sistema', `Pasó a "${toEtapa?.nombre}"`).catch(() => {})
    } catch {
      setProspectos(prev => prev.map(p => p.id === prospectoId ? { ...p, etapa_id: current.etapa_id } : p))
      setSnackMsg('Error al mover el prospecto.')
      return
    }
    const updated = { ...current, etapa_id: newEtapaId }
    if (toEtapa?.orden === 1) setContactoTarget(updated)
    else if (toEtapa?.orden === 2) setVisitaTarget(updated)
    else if (toEtapa?.orden === 3) setNegociacionTarget(updated)
    else if (toEtapa?.orden === 4) setCierreTarget(updated)
  }

  function handleAction(prospecto) {
    const etapa = etapas.find(e => e.id === prospecto.etapa_id)
    if (!etapa) return
    if (etapa.orden === 2) setVisitaTarget(prospecto)
    else if (etapa.orden === 3) setNegociacionTarget(prospecto)
    else if (etapa.orden === 4) setCierreTarget(prospecto)
  }

  function handleProspectoSaved(p) {
    loadProspectos().catch(() => {})
    setSnackMsg(`Prospecto "${p.nombre} ${p.apellido}" creado.`)
    addHistorialProspecto(p.id, user?.nombre_usuario ?? 'Sistema', 'Creó el prospecto').catch(() => {})
  }

  function handleAsignadoChange(prospectoId, newNombre) {
    setProspectos(prev => prev.map(p => p.id === prospectoId ? { ...p, asignado_nombre: newNombre } : p))
  }

  function handleClosed(id, exitoso) {
    setProspectos(prev => {
      if (!showNegativo && !exitoso) return prev.filter(p => p.id !== id)
      return prev.map(p => p.id === id ? { ...p, cerrado: true, cierre_exitoso: exitoso } : p)
    })
    setSnackMsg(exitoso ? 'Cierre exitoso registrado.' : 'Cierre negativo registrado.')
  }

  if (loading) return <Box display="flex" justifyContent="center" mt={6}><CircularProgress sx={{ color: ACCENT }} /></Box>
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box pb={4} sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* ── Header ── */}
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={3} flexShrink={0}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <GroupIcon sx={{ fontSize: 18, color: ACCENT }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>Seguimiento de contactos</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>Gestión del pipeline comercial</Typography>
          </Box>
        </Box>
        <Button
          variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}
          sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', px: 2, py: 1, boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
        >
          Nuevo seguimiento
        </Button>
      </Box>

      {/* ── Filtros ── */}
      <Box display="flex" alignItems="center" gap={3} mb={3} flexShrink={0}>
        {/* Tipo toggle */}
        <Box display="flex" gap={1}>
          {['venta', 'alquiler'].map(op => (
            <Box
              key={op}
              onClick={() => setTipoFiltro(op)}
              sx={{
                px: 2, py: 0.75, borderRadius: '8px', cursor: 'pointer',
                border: `1px solid ${tipoFiltro === op ? ACCENT : '#E5E7EB'}`,
                bgcolor: tipoFiltro === op ? '#ECFDF5' : 'white',
                transition: 'all 0.15s',
              }}
            >
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: tipoFiltro === op ? ACCENT : '#6B7280', textTransform: 'capitalize' }}>
                {op === 'venta' ? 'Venta / Compra' : 'Alquiler'}
              </Typography>
            </Box>
          ))}
        </Box>

        <FormControlLabel
          control={
            <Switch checked={showNegativo} onChange={e => setShowNegativo(e.target.checked)} size="small"
              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#EF4444' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#FCA5A5' } }}
            />
          }
          label={<Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>Mostrar cierres negativos</Typography>}
        />

        <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', ml: 'auto' }}>
          {prospectos.length} prospecto{prospectos.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* ── Kanban ── */}
      {etapas.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <GroupIcon sx={{ fontSize: 36, color: '#E5E7EB', display: 'block', mx: 'auto', mb: 1 }} />
          <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>
            No hay etapas configuradas. Ejecutá la migración SQL para inicializar las etapas.
          </Typography>
        </Box>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <Box sx={{ display: 'flex', gap: 2, flex: 1, overflowX: 'auto', pb: 2 }}>
            {etapas.map(etapa => (
              <KanbanColumn
                key={etapa.id}
                etapa={etapa}
                prospectos={grouped[etapa.id] ?? []}
                onAction={handleAction}
                onInfo={p => setContactoTarget(p)}
              />
            ))}
          </Box>

          <DragOverlay>
            {activeId && activeProspecto ? (
              <ProspectoCard
                prospecto={activeProspecto}
                etapaOrden={activeEtapaOrden}
                onAction={() => {}}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── Leyenda ── */}
      <Box display="flex" alignItems="center" gap={1} mt={2} flexShrink={0}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#1D4ED8', flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.72rem', color: '#6B7280' }}>
          Prospecto de formulario web
        </Typography>
      </Box>

      {/* ── Drawers ── */}
      <ProspectoFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        defaultEtapaId={defaultEtapaId}
        propiedades={propiedades}
        onSaved={handleProspectoSaved}
        asignadoNombre={user?.nombre_usuario}
        clienteId={clienteId}
      />

      <ContactoDrawer
        open={!!contactoTarget}
        onClose={() => setContactoTarget(null)}
        prospecto={contactoTarget}
        usuarios={usuarios}
        currentUser={user}
        onAsignadoChange={handleAsignadoChange}
        onPassToNextEtapa={() => {
          if (contactoTarget) handlePassToEtapa(contactoTarget, 2)
          setContactoTarget(null)
        }}
      />

      <VisitaDrawer
        open={!!visitaTarget}
        onClose={() => setVisitaTarget(null)}
        prospecto={visitaTarget}
        propiedades={propiedades}
        onPassToNextEtapa={() => {
          if (visitaTarget) handlePassToEtapa(visitaTarget, 3)
          setVisitaTarget(null)
        }}
      />

      <NegociacionDrawer
        open={!!negociacionTarget}
        onClose={() => setNegociacionTarget(null)}
        prospecto={negociacionTarget}
        propiedades={propiedades}
        onPassToNextEtapa={() => {
          if (negociacionTarget) handlePassToEtapa(negociacionTarget, 4)
          setNegociacionTarget(null)
        }}
      />

      <CierreDrawer
        open={!!cierreTarget}
        onClose={() => setCierreTarget(null)}
        prospecto={cierreTarget}
        onClosed={handleClosed}
      />

      <Snackbar
        open={!!snackMsg}
        autoHideDuration={3500}
        onClose={() => setSnackMsg('')}
        message={snackMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
