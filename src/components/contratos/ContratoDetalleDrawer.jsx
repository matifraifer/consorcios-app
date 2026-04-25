import { useEffect, useState } from 'react'
import {
  Box, Typography, Drawer, IconButton, Button, Divider,
  CircularProgress, Alert, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import ScheduleIcon from '@mui/icons-material/Schedule'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import {
  getPagosContrato, getContratoAdjuntos, getContratoAdjuntoUrl,
  deleteContratoAdjunto, registrarPagoContrato, getComprobanteUrl, finalizarContrato,
  getCargosExtraByPagos, createCargoExtra, deleteCargoExtra,
} from '../../services/supabase'

const ACCENT = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'

const MESES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const PLAZO_MAP = { Mensual: 1, Trimestral: 3, Cuatrimestral: 4, Semestral: 6, Anual: 12, Otro: 0 }

// Recalcula si un período es de actualización (independiente de lo guardado en DB)
// El inquilino paga `plazo` meses al mismo valor, luego se actualiza.
// Trimestral → n=4,7,10… | Cuatrimestral → n=5,9,13… | etc.
function esActualizacion(periodoNumero, plazoActualizacion) {
  const plazoMeses = PLAZO_MAP[plazoActualizacion] ?? 0
  return plazoMeses > 0 && periodoNumero > 1 && (periodoNumero - 1) % plazoMeses === 0
}

// Calcula el monto acumulado para CUALQUIER período, aplicando todas las
// actualizaciones encadenadas que ocurrieron hasta ese período.
function computeMontoActualizado(pago, allPagos, indices, tipoActualizacion, plazoActualizacion) {
  // Períodos de actualización hasta este período (recalculado, no depende de DB)
  const updatePeriods = allPagos
    .filter(p => esActualizacion(p.periodo_numero, plazoActualizacion) && p.periodo_numero <= pago.periodo_numero)
    .sort((a, b) => a.periodo_numero - b.periodo_numero)

  // Sin actualizaciones previas → monto base
  if (updatePeriods.length === 0) return pago.monto_base

  let monto = pago.monto_base

  for (const up of updatePeriods) {
    const [y, m] = up.periodo_inicio.split('-').map(Number)
    const idx = indices.find(
      i => i.tipo === tipoActualizacion && i.mes === m && i.anio === y
    )
    if (idx) {
      monto = monto * (1 + idx.valor / 100)
    }
  }

  return Math.round(monto)
}

function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = (d.includes('T') ? d.split('T')[0] : d).split('-')
  return `${day}/${m}/${y}`
}

function fmt(v) {
  if (!v && v !== 0) return '—'
  return Number(v).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function InfoRow({ label, value }) {
  return (
    <Box display="flex" justifyContent="space-between" alignItems="flex-start" py={0.75}>
      <Typography sx={{ fontSize: '0.78rem', color: '#6B7280', flexShrink: 0, mr: 2 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827', textAlign: 'right' }}>{value}</Typography>
    </Box>
  )
}

function EstadoPagoBadge({ estado }) {
  const styles = {
    pagado: { icon: <CheckCircleOutlineIcon sx={{ fontSize: 13 }} />, color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', label: 'Pagado' },
    pendiente: { icon: <ScheduleIcon sx={{ fontSize: 13 }} />, color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', label: 'Pendiente' },
    vencido: { icon: <ErrorOutlineIcon sx={{ fontSize: 13 }} />, color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', label: 'Vencido' },
  }
  const s = styles[estado] ?? styles.pendiente
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, bgcolor: s.bg, border: `1px solid ${s.border}`, borderRadius: '20px', px: 1, py: 0.3 }}>
      <Box sx={{ color: s.color, display: 'flex', alignItems: 'center' }}>{s.icon}</Box>
      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: s.color, letterSpacing: '0.04em' }}>{s.label}</Typography>
    </Box>
  )
}

function SectionTitle({ children }) {
  return (
    <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: ACCENT, mt: 2.5, mb: 1.5 }}>
      {children}
    </Typography>
  )
}

// ---- Dialog: Registrar pago ----
function RegistrarPagoDialog({ open, pago, montoSugerido, onClose, onPaid }) {
  const [montoPagado, setMontoPagado] = useState('')
  const [fechaPago, setFechaPago] = useState('')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setMontoPagado(montoSugerido ? String(montoSugerido) : '')
      setFechaPago(new Date().toISOString().slice(0, 10))
      setFile(null)
      setError(null)
    }
  }, [open, montoSugerido])

  async function handleSave() {
    if (!montoPagado || !fechaPago) { setError('Completar monto y fecha.'); return }
    setSaving(true)
    try {
      const updated = await registrarPagoContrato(pago.id, { monto_pagado: Number(montoPagado), fecha_pago: fechaPago, file })
      onPaid(updated)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px', fontSize: '0.875rem',
      '& fieldset': { borderColor: '#E5E7EB' },
      '&:hover fieldset': { borderColor: ACCENT },
      '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
    },
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '14px' } }}>
      <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700, pb: 1 }}>Registrar pago</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 1.5, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}
        <Box display="flex" flexDirection="column" gap={1.5}>
          <Box>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Monto pagado *</Typography>
            <TextField fullWidth size="small" type="number" value={montoPagado} onChange={e => setMontoPagado(e.target.value)} sx={fieldSx} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Fecha de pago *</Typography>
            <TextField fullWidth size="small" type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={fieldSx} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Comprobante (opcional)</Typography>
            <Button
              variant="outlined" component="label" size="small"
              startIcon={<AttachFileIcon sx={{ fontSize: 14 }} />}
              sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.78rem', borderColor: '#E5E7EB', color: '#374151', '&:hover': { borderColor: ACCENT, color: ACCENT } }}
            >
              {file ? file.name : 'Adjuntar archivo'}
              <input type="file" hidden onChange={e => setFile(e.target.files[0] || null)} />
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none', borderRadius: '8px', color: '#6B7280' }}>Cancelar</Button>
        <Button
          onClick={handleSave} disabled={saving} variant="contained"
          startIcon={saving ? <CircularProgress size={13} color="inherit" /> : null}
          sx={{ bgcolor: ACCENT, textTransform: 'none', borderRadius: '8px', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
        >
          {saving ? 'Guardando...' : 'Registrar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ---- Main Drawer ----
export default function ContratoDetalleDrawer({ open, onClose, contrato, indices, userRole, onFinalizado }) {
  const isAdmin = userRole?.toLowerCase() === 'admin'

  const [pagos, setPagos] = useState([])
  const [adjuntos, setAdjuntos] = useState([])
  const [loadingPagos, setLoadingPagos] = useState(false)
  const [loadingAdj, setLoadingAdj] = useState(false)
  const [error, setError] = useState(null)

  const [pagoDialog, setPagoDialog] = useState(null)
  const [montoSugerido, setMontoSugerido] = useState(0)
  const [finalizandoId, setFinalizandoId] = useState(null)
  const [confirmFin, setConfirmFin] = useState(false)

  // Cargos extra por período
  const [cargos, setCargos] = useState({}) // { [pago_id]: cargo[] }
  const [cargoDialog, setCargoDialog] = useState(null) // pago_id | null
  const [cargoDesc, setCargoDesc] = useState('')
  const [cargoMonto, setCargoMonto] = useState('')
  const [savingCargo, setSavingCargo] = useState(false)

  useEffect(() => {
    if (!open || !contrato) return
    setError(null)
    loadData()
  }, [open, contrato?.id])

  async function loadData() {
    setLoadingPagos(true)
    setLoadingAdj(true)
    try {
      const [p, a] = await Promise.all([
        getPagosContrato(contrato.id),
        getContratoAdjuntos(contrato.id),
      ])
      setPagos(p)
      setAdjuntos(a)
      // Cargar cargos extra para todos los períodos
      const cargosData = await getCargosExtraByPagos(p.map(x => x.id))
      const map = {}
      cargosData.forEach(c => {
        if (!map[c.pago_id]) map[c.pago_id] = []
        map[c.pago_id].push(c)
      })
      setCargos(map)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingPagos(false)
      setLoadingAdj(false)
    }
  }

  async function handleDownload(adj) {
    try {
      const url = await getContratoAdjuntoUrl(adj.storage_path)
      window.open(url, '_blank')
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDeleteAdj(adj) {
    try {
      await deleteContratoAdjunto(adj.id, adj.storage_path)
      setAdjuntos(prev => prev.filter(a => a.id !== adj.id))
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDownloadComprobante(storagePath) {
    try {
      const url = await getComprobanteUrl(storagePath)
      window.open(url, '_blank')
    } catch (e) {
      setError(e.message)
    }
  }

  function openPagoDialog(pago, total) {
    setMontoSugerido(total)
    setPagoDialog(pago)
  }

  function openCargoDialog(pagoId) {
    setCargoDialog(pagoId)
    setCargoDesc('')
    setCargoMonto('')
  }

  async function handleSaveCargo() {
    if (!cargoDesc.trim() || !cargoMonto || Number(cargoMonto) <= 0) return
    setSavingCargo(true)
    try {
      const nuevo = await createCargoExtra({ pago_id: cargoDialog, descripcion: cargoDesc.trim(), monto: Number(cargoMonto) })
      setCargos(prev => ({
        ...prev,
        [cargoDialog]: [...(prev[cargoDialog] ?? []), nuevo],
      }))
      setCargoDialog(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingCargo(false)
    }
  }

  async function handleDeleteCargo(pagoId, cargoId) {
    try {
      await deleteCargoExtra(cargoId)
      setCargos(prev => ({
        ...prev,
        [pagoId]: (prev[pagoId] ?? []).filter(c => c.id !== cargoId),
      }))
    } catch (e) {
      setError(e.message)
    }
  }

  function handlePaid(updated) {
    setPagos(prev => prev.map(p => p.id === updated.id ? updated : p))
    setPagoDialog(null)
  }

  async function handleFinalizar() {
    setConfirmFin(false)
    setFinalizandoId(contrato.id)
    try {
      const updated = await finalizarContrato(contrato.id)
      onFinalizado(updated)
    } catch (e) {
      setError(e.message)
    } finally {
      setFinalizandoId(null)
    }
  }

  if (!contrato) return null

  const estado = contrato.finalizado
    ? 'Finalizado'
    : new Date(contrato.fecha_fin + 'T23:59:59') >= new Date() ? 'Vigente' : 'Vencido'

  const estadoStyles = {
    Vigente:    { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
    Vencido:    { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
    Finalizado: { bg: '#F1F5F9', color: '#94A3B8', border: '#E2E8F0' },
  }
  const es = estadoStyles[estado]

  // Recalcula es_periodo_actualizacion y monto acumulado para cada período
  const pagosConMonto = pagos.map(p => {
    const esActu = esActualizacion(p.periodo_numero, contrato.plazo_actualizacion)
    return {
      ...p,
      es_periodo_actualizacion: esActu,
      monto_actualizado: computeMontoActualizado(p, pagos, indices, contrato.tipo_actualizacion, contrato.plazo_actualizacion),
    }
  })

  const hasIndicesLoaded = indices.some(i => i.tipo === contrato.tipo_actualizacion)

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: '100%', sm: 560 }, display: 'flex', flexDirection: 'column' } }}
      >
        {/* Header */}
        <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <Box>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ACCENT, mb: 0.3 }}>
              Contrato
            </Typography>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
              {contrato.inquilino_apellido}, {contrato.inquilino_nombre}
            </Typography>
            <Box display="flex" alignItems="center" gap={1} mt={0.5}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, bgcolor: es.bg, border: `1px solid ${es.border}`, borderRadius: '20px', px: 1.25, py: 0.3 }}>
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: es.color }} />
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: es.color, letterSpacing: '0.04em' }}>{estado}</Typography>
              </Box>
              {contrato.propiedades?.titulo && (
                <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{contrato.propiedades.titulo}</Typography>
              )}
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: '#9CA3AF' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }} onClose={() => setError(null)}>{error}</Alert>}

          {/* Resumen */}
          <SectionTitle>Resumen del contrato</SectionTitle>
          <Box sx={{ bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', px: 2, py: 0.5 }}>
            <InfoRow label="Inquilino" value={`${contrato.inquilino_apellido}, ${contrato.inquilino_nombre}${contrato.inquilino_dni ? ` — DNI ${contrato.inquilino_dni}` : ''}`} />
            <Divider sx={{ borderColor: '#F3F4F6' }} />
            <InfoRow label="Propietario" value={`${contrato.propietario_apellido}, ${contrato.propietario_nombre}${contrato.propietario_dni ? ` — DNI ${contrato.propietario_dni}` : ''}`} />
            <Divider sx={{ borderColor: '#F3F4F6' }} />
            <InfoRow label="Período" value={`${fmtDate(contrato.fecha_inicio)} → ${fmtDate(contrato.fecha_fin)}`} />
            <Divider sx={{ borderColor: '#F3F4F6' }} />
            <InfoRow label="Monto base" value={`$ ${fmt(contrato.monto_base)}`} />
            <Divider sx={{ borderColor: '#F3F4F6' }} />
            <InfoRow label="Actualización" value={`${contrato.tipo_actualizacion} — ${contrato.plazo_actualizacion}`} />
            {contrato.dia_vencimiento && (
              <>
                <Divider sx={{ borderColor: '#F3F4F6' }} />
                <InfoRow label="Vencimiento del pago" value={`Día ${contrato.dia_vencimiento} de cada mes`} />
              </>
            )}
            {contrato.observaciones && (
              <>
                <Divider sx={{ borderColor: '#F3F4F6' }} />
                <InfoRow label="Observaciones" value={contrato.observaciones} />
              </>
            )}
          </Box>

          {/* Adjuntos */}
          <SectionTitle>Documentos adjuntos</SectionTitle>
          {loadingAdj ? (
            <CircularProgress size={20} sx={{ color: ACCENT, display: 'block', mx: 'auto' }} />
          ) : adjuntos.length === 0 ? (
            <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>Sin documentos adjuntos.</Typography>
          ) : (
            <Box display="flex" flexDirection="column" gap={0.75}>
              {adjuntos.map(a => (
                <Box key={a.id} display="flex" alignItems="center" justifyContent="space-between" sx={{ bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', px: 1.5, py: 0.75 }}>
                  <Box display="flex" alignItems="center" gap={1} minWidth={0}>
                    <AttachFileIcon sx={{ fontSize: 15, color: '#9CA3AF', flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.78rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}</Typography>
                  </Box>
                  <Box display="flex">
                    <Tooltip title="Descargar">
                      <IconButton size="small" onClick={() => handleDownload(a)} sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
                        <DownloadIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                    {isAdmin && (
                      <Tooltip title="Eliminar">
                        <IconButton size="small" onClick={() => handleDeleteAdj(a)} sx={{ color: '#9CA3AF', '&:hover': { color: '#EF4444' } }}>
                          <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {/* Calendario de pagos */}
          <SectionTitle>Calendario de pagos</SectionTitle>

          {contrato.tipo_actualizacion !== 'Otro' && !hasIndicesLoaded && (
            <Alert severity="info" sx={{ mb: 1.5, borderRadius: '8px', fontSize: '0.78rem', py: 0.5 }}>
              No hay índices {contrato.tipo_actualizacion} cargados. Los montos se muestran sin actualización.
            </Alert>
          )}

          {loadingPagos ? (
            <CircularProgress size={20} sx={{ color: ACCENT, display: 'block', mx: 'auto' }} />
          ) : pagosConMonto.length === 0 ? (
            <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>Sin pagos generados.</Typography>
          ) : (
            <Box display="flex" flexDirection="column" gap={0.75}>
              {pagosConMonto.map(p => {
                const [py, pm] = p.periodo_inicio.split('-').map(Number)
                const today = new Date()
                const efectivo = p.monto_actualizado
                const isVencido = p.estado === 'pendiente' && new Date(p.periodo_fin + 'T23:59:59') < today
                const pagosCargos = cargos[p.id] ?? []
                const totalCargos = pagosCargos.reduce((sum, c) => sum + Number(c.monto), 0)
                const total = efectivo + totalCargos

                return (
                  <Box
                    key={p.id}
                    sx={{
                      border: `1px solid ${p.es_periodo_actualizacion ? '#DDD6FE' : '#E5E7EB'}`,
                      bgcolor: p.es_periodo_actualizacion ? '#FAF5FF' : '#F9FAFB',
                      borderRadius: '10px', px: 1.5, py: 1,
                    }}
                  >
                    {/* Fila principal */}
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Box sx={{ textAlign: 'center', minWidth: 36 }}>
                          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                            {MESES_SHORT[pm - 1]}
                          </Typography>
                          <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
                            {py}
                          </Typography>
                        </Box>
                        <Box>
                          <Box display="flex" alignItems="center" gap={0.75}>
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                              $ {fmt(efectivo)}
                            </Typography>
                            {p.es_periodo_actualizacion && (
                              <Chip label="Actualización" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#EDE9FE', color: '#7C3AED', fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }} />
                            )}
                          </Box>
                          <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF' }}>
                            {fmtDate(p.periodo_inicio)} — {fmtDate(p.periodo_fin)}
                          </Typography>
                        </Box>
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <EstadoPagoBadge estado={isVencido ? 'vencido' : p.estado} />
                        {!contrato.finalizado && (
                          <Tooltip title="Agregar cargo extra">
                            <IconButton size="small" onClick={() => openCargoDialog(p.id)} sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
                              <AddCircleOutlineIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {p.estado === 'pendiente' && !contrato.finalizado && (
                          <Button
                            size="small" variant="outlined"
                            onClick={() => openPagoDialog(p, total)}
                            sx={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'none', borderRadius: '7px', borderColor: ACCENT, color: ACCENT, py: 0.3, px: 1.25, '&:hover': { bgcolor: ACCENT_LIGHT } }}
                          >
                            Pagar
                          </Button>
                        )}
                        {p.estado === 'pagado' && p.comprobante_path && (
                          <Tooltip title="Ver comprobante">
                            <IconButton size="small" onClick={() => handleDownloadComprobante(p.comprobante_path)} sx={{ color: '#9CA3AF', '&:hover': { color: ACCENT } }}>
                              <DownloadIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>

                    {/* Cargos extra */}
                    {pagosCargos.length > 0 && (
                      <Box mt={1} pt={1} sx={{ borderTop: '1px dashed #E5E7EB' }}>
                        {pagosCargos.map(c => (
                          <Box key={c.id} display="flex" alignItems="center" justifyContent="space-between" py={0.25}>
                            <Typography sx={{ fontSize: '0.72rem', color: '#6B7280', flex: 1 }}>+ {c.descripcion}</Typography>
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                                $ {fmt(c.monto)}
                              </Typography>
                              {!contrato.finalizado && (
                                <IconButton size="small" onClick={() => handleDeleteCargo(p.id, c.id)} sx={{ p: 0.2, color: '#D1D5DB', '&:hover': { color: '#EF4444' } }}>
                                  <DeleteOutlineIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                              )}
                            </Box>
                          </Box>
                        ))}
                        <Box display="flex" justifyContent="space-between" mt={0.5} pt={0.5} sx={{ borderTop: '1px solid #E5E7EB' }}>
                          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151' }}>Total</Typography>
                          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                            $ {fmt(total)}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Box>
          )}

          {/* Stats rapidos */}
          {pagosConMonto.length > 0 && (
            <Box mt={2} display="grid" gridTemplateColumns="1fr 1fr 1fr" gap={1}>
              {[
                { label: 'Total períodos', value: pagosConMonto.length },
                { label: 'Pagados', value: pagosConMonto.filter(p => p.estado === 'pagado').length },
                { label: 'Pendientes', value: pagosConMonto.filter(p => p.estado === 'pendiente').length },
              ].map(s => (
                <Box key={s.label} sx={{ bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', px: 1.5, py: 1, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>{s.value}</Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF' }}>{s.label}</Typography>
                </Box>
              ))}
            </Box>
          )}

          <Box height={24} />
        </Box>

        {/* Footer */}
        {isAdmin && !contrato.finalizado && (
          <>
            <Divider />
            <Box sx={{ px: 3, py: 2, flexShrink: 0 }}>
              <Button
                fullWidth variant="outlined" onClick={() => setConfirmFin(true)}
                disabled={!!finalizandoId}
                startIcon={finalizandoId ? <CircularProgress size={13} color="inherit" /> : null}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280', '&:hover': { borderColor: '#EF4444', color: '#EF4444', bgcolor: '#FEF2F2' } }}
              >
                {finalizandoId ? 'Finalizando...' : 'Finalizar contrato'}
              </Button>
            </Box>
          </>
        )}
      </Drawer>

      {/* Confirm finalizar */}
      <Dialog open={confirmFin} onClose={() => setConfirmFin(false)} maxWidth="xs" PaperProps={{ sx: { borderRadius: '14px' } }}>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700 }}>Finalizar contrato</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.875rem', color: '#374151' }}>
            Esta acción marcará el contrato como finalizado. No se podrán registrar nuevos pagos. ¿Continuar?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmFin(false)} sx={{ textTransform: 'none', borderRadius: '8px', color: '#6B7280' }}>Cancelar</Button>
          <Button
            onClick={handleFinalizar} variant="contained"
            sx={{ bgcolor: '#EF4444', textTransform: 'none', borderRadius: '8px', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#DC2626', boxShadow: 'none' } }}
          >
            Finalizar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog cargo extra */}
      <Dialog open={!!cargoDialog} onClose={() => setCargoDialog(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '14px' } }}>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700, pb: 1 }}>Agregar cargo extra</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Box display="flex" flexDirection="column" gap={1.5}>
            <Box>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Descripción *</Typography>
              <TextField
                fullWidth size="small" autoFocus
                placeholder="Ej: Multa por atraso, Expensas, etc."
                value={cargoDesc} onChange={e => setCargoDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveCargo() }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.875rem', '& fieldset': { borderColor: '#E5E7EB' }, '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 } } }}
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>Monto *</Typography>
              <TextField
                fullWidth size="small" type="number"
                value={cargoMonto} onChange={e => setCargoMonto(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveCargo() }}
                slotProps={{ input: { inputProps: { min: 0 } } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.875rem', '& fieldset': { borderColor: '#E5E7EB' }, '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 } } }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCargoDialog(null)} sx={{ textTransform: 'none', borderRadius: '8px', color: '#6B7280' }}>Cancelar</Button>
          <Button
            onClick={handleSaveCargo} disabled={savingCargo || !cargoDesc.trim() || !cargoMonto} variant="contained"
            startIcon={savingCargo ? <CircularProgress size={13} color="inherit" /> : null}
            sx={{ bgcolor: ACCENT, textTransform: 'none', borderRadius: '8px', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
          >
            {savingCargo ? 'Guardando...' : 'Agregar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Registrar pago dialog */}
      <RegistrarPagoDialog
        open={!!pagoDialog}
        pago={pagoDialog}
        montoSugerido={montoSugerido}
        onClose={() => setPagoDialog(null)}
        onPaid={handlePaid}
      />
    </>
  )
}
