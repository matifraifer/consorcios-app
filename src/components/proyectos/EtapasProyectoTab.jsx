import { Fragment, useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Collapse,
  Menu,
  MenuItem,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DownloadIcon from '@mui/icons-material/Download'
import EditIcon from '@mui/icons-material/Edit'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ListAltIcon from '@mui/icons-material/ListAlt'
import AssignmentIcon from '@mui/icons-material/Assignment'
import { getEtapasByProyecto, updateTarea } from '../../services/supabase'
import { calcEtapaStats } from '../../utils/calcEtapaStats'
import { ESTADOS_TAREA as ESTADOS, estadoTareaInfo as estadoInfo } from '../../utils/estadosTarea'
import EtapaFormDrawer from './EtapaFormDrawer'
import TareaFormDrawer from './TareaFormDrawer'

const ACCENT = '#065F46'

function fmt(value) {
  if (!value) return '—'
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtFecha(fecha) {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

function EstadoChip({ estado, onChange }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const info = estadoInfo(estado)

  return (
    <>
      <Chip
        label={info.label}
        size="small"
        onClick={e => { e.stopPropagation(); setAnchorEl(e.currentTarget) }}
        sx={{
          height: 22, fontSize: '0.68rem', fontWeight: 600, border: 'none', cursor: 'pointer',
          bgcolor: info.bg, color: info.color, '&:hover': { filter: 'brightness(0.95)' },
        }}
      />
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={e => { e?.stopPropagation?.(); setAnchorEl(null) }}>
        {ESTADOS.map(e => (
          <MenuItem
            key={e.value}
            selected={e.value === estado}
            onClick={ev => { ev.stopPropagation(); onChange(e.value); setAnchorEl(null) }}
            sx={{ fontSize: '0.82rem', gap: 1 }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: e.color }} />
            {e.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

function TareasEtapaTable({ tareas, onEstadoChange, onEditar }) {
  if (!tareas.length) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <AssignmentIcon sx={{ fontSize: 26, color: '#E5E7EB', mb: 1, display: 'block', mx: 'auto' }} />
        <Typography sx={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
          No hay tareas cargadas en esta etapa.
        </Typography>
      </Box>
    )
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          {['Tarea', 'Responsable', 'Fecha de inicio', 'Fecha fin. prevista', 'Fecha fin. real', 'Costo real', 'Estado', ''].map(h => (
            <TableCell
              key={h}
              sx={{ fontWeight: 700, fontSize: '0.66rem', color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1, borderBottom: '1px solid #E5E7EB' }}
            >
              {h}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {tareas.map(t => (
          <TableRow key={t.id} sx={{ '&:last-child td': { border: 0 }, '& td': { borderBottom: '1px solid #F3F4F6' } }}>
            <TableCell sx={{ py: 1 }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827' }}>{t.nombre}</Typography>
            </TableCell>
            <TableCell sx={{ py: 1 }}>
              <Typography sx={{ fontSize: '0.8rem', color: '#6B7280' }}>{t.responsable || '—'}</Typography>
            </TableCell>
            <TableCell sx={{ py: 1 }}>
              <Typography sx={{ fontSize: '0.8rem', color: '#6B7280' }}>{fmtFecha(t.fecha_inicio)}</Typography>
            </TableCell>
            <TableCell sx={{ py: 1 }}>
              <Typography sx={{ fontSize: '0.8rem', color: '#6B7280' }}>{fmtFecha(t.fecha_fin)}</Typography>
            </TableCell>
            <TableCell sx={{ py: 1 }}>
              <Typography sx={{ fontSize: '0.8rem', color: '#6B7280' }}>{fmtFecha(t.fecha_fin_real)}</Typography>
            </TableCell>
            <TableCell sx={{ py: 1 }}>
              <Typography sx={{ fontSize: '0.8rem', color: '#6B7280' }}>{fmt(t.costo_real)}</Typography>
            </TableCell>
            <TableCell sx={{ py: 1 }}>
              <EstadoChip estado={t.estado} onChange={nuevoEstado => onEstadoChange(t.id, nuevoEstado)} />
            </TableCell>
            <TableCell sx={{ py: 1 }} align="right">
              <Tooltip title="Editar tarea">
                <IconButton size="small" onClick={() => onEditar(t)} sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
                  <EditIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default function EtapasProyectoTab({ proyectoId }) {
  const [etapas, setEtapas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedIds, setExpandedIds] = useState([])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingEtapa, setEditingEtapa] = useState(null)

  const [tareaDrawerOpen, setTareaDrawerOpen] = useState(false)
  const [etapaParaTarea, setEtapaParaTarea] = useState(null)
  const [editingTarea, setEditingTarea] = useState(null)

  useEffect(() => {
    getEtapasByProyecto(proyectoId)
      .then(setEtapas)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [proyectoId])

  function toggleExpand(id) {
    setExpandedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function openNueva() {
    setEditingEtapa(null)
    setDrawerOpen(true)
  }

  function openEditar(etapa) {
    setEditingEtapa(etapa)
    setDrawerOpen(true)
  }

  function handleSaved(savedEtapa) {
    setEtapas(prev => {
      const existe = prev.some(e => e.id === savedEtapa.id)
      return existe ? prev.map(e => e.id === savedEtapa.id ? savedEtapa : e) : [...prev, savedEtapa]
    })
  }

  function openNuevaTarea(etapa) {
    setEtapaParaTarea(etapa)
    setEditingTarea(null)
    setTareaDrawerOpen(true)
  }

  function openEditarTarea(etapa, tarea) {
    setEtapaParaTarea(etapa)
    setEditingTarea(tarea)
    setTareaDrawerOpen(true)
  }

  function handleTareaSaved(etapaId, tarea) {
    setEtapas(prev => prev.map(e => {
      if (e.id !== etapaId) return e
      const existe = (e.tareas_etapa || []).some(t => t.id === tarea.id)
      return {
        ...e,
        tareas_etapa: existe
          ? e.tareas_etapa.map(t => t.id === tarea.id ? tarea : t)
          : [...(e.tareas_etapa || []), tarea],
      }
    }))
    setExpandedIds(prev => prev.includes(etapaId) ? prev : [...prev, etapaId])
  }

  async function handleEstadoChange(etapaId, tareaId, nuevoEstado) {
    try {
      const actualizada = await updateTarea(tareaId, { estado: nuevoEstado })
      setEtapas(prev => prev.map(e => e.id === etapaId
        ? { ...e, tareas_etapa: e.tareas_etapa.map(t => t.id === tareaId ? actualizada : t) }
        : e
      ))
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <Box display="flex" justifyContent="center" py={6}><CircularProgress sx={{ color: ACCENT }} /></Box>

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

      <Box display="flex" justifyContent="flex-end" gap={1.5} mb={2}>
        <Tooltip title="Próximamente">
          <Button
            variant="outlined"
            startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: '8px', textTransform: 'none', fontWeight: 600,
              fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#374151',
              '&:hover': { borderColor: ACCENT, color: ACCENT, bgcolor: '#ECFDF5' },
            }}
          >
            Descargar Excel
          </Button>
        </Tooltip>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openNueva}
          sx={{
            bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
            fontWeight: 600, fontSize: '0.82rem', px: 2, py: 1,
            boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
          }}
        >
          Nueva etapa
        </Button>
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                <TableCell sx={{ borderBottom: '1px solid #E5E7EB', width: 40 }} />
                {['Etapa', '% de avance', 'Tareas bloqueadas', 'Fecha de inicio', 'Fecha de fin', 'Costo presupuestado', 'Costo real'].map(h => (
                  <TableCell
                    key={h}
                    sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', py: 1.5, borderBottom: '1px solid #E5E7EB' }}
                  >
                    {h}
                  </TableCell>
                ))}
                <TableCell sx={{ borderBottom: '1px solid #E5E7EB' }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {etapas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} sx={{ py: 8, textAlign: 'center', border: 0 }}>
                    <ListAltIcon sx={{ fontSize: 32, color: '#E5E7EB', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
                      No hay etapas registradas.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                etapas.map(etapa => {
                  const stats = calcEtapaStats(etapa)
                  const expanded = expandedIds.includes(etapa.id)
                  return (
                    <Fragment key={etapa.id}>
                      <TableRow
                        onClick={() => toggleExpand(etapa.id)}
                        sx={{
                          cursor: 'pointer',
                          '& td': { borderBottom: expanded ? 'none' : '1px solid #F3F4F6' },
                          '&:hover': { bgcolor: '#F9FAFB' },
                        }}
                      >
                        <TableCell
                          sx={{
                            py: 1.5, position: 'relative',
                            '&::before': {
                              content: '""', position: 'absolute', left: 0, top: 0, bottom: 0,
                              width: 4, bgcolor: etapa.color || ACCENT,
                            },
                          }}
                        >
                          <ExpandMoreIcon
                            sx={{
                              fontSize: 20, color: '#9CA3AF',
                              transition: 'transform 0.2s ease',
                              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Box display="flex" alignItems="center">
                            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                              {etapa.nombre}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1.5, minWidth: 140 }}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <LinearProgress
                              variant="determinate"
                              value={stats.avance}
                              sx={{
                                flex: 1, height: 6, borderRadius: 3, bgcolor: '#F1F5F9',
                                '& .MuiLinearProgress-bar': { bgcolor: etapa.color || ACCENT, borderRadius: 3 },
                              }}
                            />
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', minWidth: 32 }}>
                              {stats.avance}%
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          {stats.bloqueadas > 0 ? (
                            <Chip
                              label={stats.bloqueadas}
                              size="small"
                              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, border: 'none', bgcolor: '#FEF2F2', color: '#DC2626' }}
                            />
                          ) : (
                            <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>0</Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>{fmtFecha(stats.fechaInicio)}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>{fmtFecha(stats.fechaFin)}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>{fmt(stats.costoPresupuestado)}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.82rem', color: '#6B7280' }}>{fmt(stats.costoReal)}</Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.5, pr: 2.5 }}>
                          <Box display="flex" gap={0.75} justifyContent="flex-end">
                            <Tooltip title="Editar etapa">
                              <IconButton
                                size="small"
                                onClick={e => { e.stopPropagation(); openEditar(etapa) }}
                                sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}
                              >
                                <EditIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Crear nueva tarea">
                              <IconButton
                                size="small"
                                onClick={e => { e.stopPropagation(); openNuevaTarea(etapa) }}
                                sx={{
                                  bgcolor: ACCENT, color: 'white', width: 30, height: 30,
                                  '&:hover': { bgcolor: '#047857' },
                                }}
                              >
                                <AddIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ '& td': { borderBottom: expanded ? '1px solid #F3F4F6' : 'none' } }}>
                        <TableCell colSpan={9} sx={{ py: 0 }}>
                          <Collapse in={expanded} timeout="auto" unmountOnExit>
                            <Box sx={{ bgcolor: '#FAFBFC', px: 2, py: 1.5 }}>
                              <TareasEtapaTable
                                tareas={etapa.tareas_etapa || []}
                                onEstadoChange={(tareaId, nuevoEstado) => handleEstadoChange(etapa.id, tareaId, nuevoEstado)}
                                onEditar={tarea => openEditarTarea(etapa, tarea)}
                              />
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <EtapaFormDrawer
        open={drawerOpen}
        proyectoId={proyectoId}
        etapa={editingEtapa}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
      />

      <TareaFormDrawer
        open={tareaDrawerOpen}
        etapa={etapaParaTarea}
        tarea={editingTarea}
        onClose={() => setTareaDrawerOpen(false)}
        onSaved={handleTareaSaved}
      />
    </Box>
  )
}
