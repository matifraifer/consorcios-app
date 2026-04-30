import { useState, useEffect } from 'react'
import {
  Box, Typography, Drawer, IconButton, Button, Alert, CircularProgress, Chip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import { cerrarProspecto, getPropiedadesInteresByProspecto } from '../../services/supabase'

const ACCENT = '#065F46'

const ESTADOS_PROPIEDAD = [
  { value: 'Disponible',  label: 'Disponible',   desc: 'La propiedad vuelve al mercado.',        color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0' },
  { value: 'Reservada',   label: 'Reservada',    desc: 'En proceso de firma o seña.',             color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
  { value: 'Vendida',     label: 'Vendida',       desc: 'Operación de compraventa finalizada.',   color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  { value: 'Baja',        label: 'Dada de baja',  desc: 'La propiedad se retira del sistema.',   color: '#94A3B8', bg: '#F1F5F9', border: '#E2E8F0' },
]

function fmt(val, moneda) {
  if (!val) return null
  return `${moneda ?? ''} ${Number(val).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`.trim()
}

export default function CierreDrawer({ open, onClose, prospecto, onClosed }) {
  // step: 1 = tipo, 2 = seleccionar propiedad (si hay interes), 3 = estado propiedad
  const [step, setStep] = useState(1)
  const [tipoSelected, setTipoSelected] = useState(null)       // 'exitoso' | 'negativo'
  const [interesRows, setInteresRows] = useState([])
  const [loadingInteres, setLoadingInteres] = useState(false)
  const [propiedadSelected, setPropiedadSelected] = useState(null) // row de propiedades_interes
  const [estadoSelected, setEstadoSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const tieneInteres = interesRows.length > 0

  // Calcular cuántos pasos hay segun el caso
  function totalSteps() {
    if (tieneInteres) return 3            // tipo → propiedad → estado
    if (prospecto?.propiedad_id) return 2 // tipo → estado
    return 1                               // tipo solo
  }

  function getDefaultEstado(tipo) {
    if (tipo === 'exitoso') {
      return prospecto?.tipo_operacion === 'venta' ? 'Vendida' : 'Disponible'
    }
    return 'Disponible'
  }

  // Cargar propiedades de interés cuando se abre
  useEffect(() => {
    if (!open || !prospecto) return
    setLoadingInteres(true)
    getPropiedadesInteresByProspecto(prospecto.id)
      .then(rows => setInteresRows(rows))
      .catch(() => setInteresRows([]))
      .finally(() => setLoadingInteres(false))
  }, [open, prospecto?.id])

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setStep(1)
      setTipoSelected(null)
      setPropiedadSelected(null)
      setEstadoSelected(null)
      setError(null)
      setSaving(false)
      setInteresRows([])
    }
  }, [open])

  function handleSelectTipo(tipo) {
    setTipoSelected(tipo)
    if (tieneInteres) {
      // Paso 2: seleccionar la propiedad
      if (interesRows.length === 1) setPropiedadSelected(interesRows[0])
      setStep(2)
    } else if (prospecto?.propiedad_id) {
      // Paso 3: elegir estado (propiedad_id del prospecto)
      setEstadoSelected(getDefaultEstado(tipo))
      setStep(3)
    } else {
      // Sin propiedad: cerrar directo
      handleConfirm(tipo, null, null)
    }
  }

  function handleSelectPropiedad(row) {
    setPropiedadSelected(row)
    setEstadoSelected(getDefaultEstado(tipoSelected))
    setStep(3)
  }

  async function handleConfirm(tipo = tipoSelected, propRow = propiedadSelected, estado = estadoSelected) {
    setSaving(true)
    setError(null)
    try {
      const propId = propRow?.propiedad_id ?? prospecto?.propiedad_id ?? null
      const compradorData = propId ? {
        nombre: `${prospecto.nombre} ${prospecto.apellido}`.trim(),
        telefono: prospecto.telefono ?? null,
      } : null
      // IDs de las otras propiedades de interés a revertir
      const otrasIds = interesRows
        .map(r => r.propiedad_id)
        .filter(pid => pid !== propId)
      await cerrarProspecto(prospecto.id, tipo === 'exitoso', propId, estado, compradorData, otrasIds)
      onClosed(prospecto.id, tipo === 'exitoso')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleBack() {
    if (step === 3 && tieneInteres) { setStep(2); setEstadoSelected(null) }
    else if (step === 3) { setStep(1); setTipoSelected(null); setEstadoSelected(null) }
    else if (step === 2) { setStep(1); setTipoSelected(null); setPropiedadSelected(null) }
  }

  if (!prospecto) return null

  const steps = totalSteps()
  const propTitulo = propiedadSelected?.propiedades?.titulo
    ?? (prospecto.propiedades?.titulo ?? 'la propiedad asociada')

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      slotProps={{ paper: { sx: { width: 440, bgcolor: 'white', display: 'flex', flexDirection: 'column' } } }}>

      {/* Header */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center" gap={1}>
          {step > 1 && (
            <IconButton size="small" onClick={handleBack} sx={{ mr: 0.5 }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          )}
          <Box>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>
              {step === 1 && 'Registrar cierre'}
              {step === 2 && 'Propiedad del cierre'}
              {step === 3 && 'Estado de la propiedad'}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>
              {prospecto.nombre} {prospecto.apellido}
            </Typography>
          </Box>
        </Box>
        <Box display="flex" alignItems="center" gap={1.5}>
          {steps > 1 && (
            <Box display="flex" gap={0.5}>
              {Array.from({ length: steps }).map((_, i) => (
                <Box key={i} sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: step > i ? ACCENT : '#E5E7EB', transition: 'background 0.2s' }} />
              ))}
            </Box>
          )}
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>
      </Box>

      <Box sx={{ flex: 1, px: 3, py: 3, overflowY: 'auto' }}>
        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>}

        {/* ── Paso 1: tipo de cierre ── */}
        {step === 1 && (
          <>
            <Typography sx={{ fontSize: '0.82rem', color: '#6B7280', lineHeight: 1.7, mb: 3 }}>
              Como cerro la gestion con <strong style={{ color: '#111827' }}>{prospecto.nombre} {prospecto.apellido}</strong>?
            </Typography>

            {loadingInteres && (
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <CircularProgress size={14} sx={{ color: '#9CA3AF' }} />
                <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>Cargando propiedades de interés...</Typography>
              </Box>
            )}

            {/* Exitoso */}
            <Box
              sx={{ border: '1px solid #A7F3D0', borderRadius: '12px', p: 2.5, mb: 2, cursor: 'pointer', bgcolor: '#F0FDF4', transition: 'all 0.15s', '&:hover': { bgcolor: '#DCFCE7', borderColor: ACCENT } }}
              onClick={() => !loadingInteres && handleSelectTipo('exitoso')}
            >
              <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                <CheckCircleIcon sx={{ color: ACCENT, fontSize: 22 }} />
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#065F46' }}>Cierre exitoso</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.8rem', color: '#15803D', lineHeight: 1.6 }}>
                La operacion se concreto.
                {tieneInteres && <> Se te pedira indicar la propiedad y su estado final.</>}
                {!tieneInteres && prospecto.propiedad_id && <> Se te pedira actualizar el estado de la propiedad.</>}
              </Typography>
            </Box>

            {/* Negativo */}
            <Box
              sx={{ border: '1px solid #FECACA', borderRadius: '12px', p: 2.5, cursor: 'pointer', bgcolor: '#FFF5F5', transition: 'all 0.15s', '&:hover': { bgcolor: '#FEE2E2', borderColor: '#EF4444' } }}
              onClick={() => !loadingInteres && handleSelectTipo('negativo')}
            >
              <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                <CancelIcon sx={{ color: '#EF4444', fontSize: 22 }} />
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#EF4444' }}>Cierre negativo</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.8rem', color: '#B91C1C', lineHeight: 1.6 }}>
                La operacion no se concreto. El prospecto quedara archivado.
                {tieneInteres && <> Las propiedades en negociacion volveran a Disponible.</>}
              </Typography>
            </Box>
          </>
        )}

        {/* ── Paso 2: seleccionar propiedad de interés ── */}
        {step === 2 && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, p: 1.5, bgcolor: '#FFFBEB', borderRadius: '8px', border: '1px solid #FDE68A' }}>
              <Typography sx={{ fontSize: '0.78rem', color: '#92400E', lineHeight: 1.6 }}>
                Selecciona con cual de las propiedades en negociacion se cerro la operacion.
                {interesRows.length > 1 && <strong> Las otras volveran a estado Disponible.</strong>}
              </Typography>
            </Box>

            <Box display="flex" flexDirection="column" gap={1.25}>
              {interesRows.map(row => {
                const selected = propiedadSelected?.id === row.id
                const p = row.propiedades
                return (
                  <Box
                    key={row.id}
                    onClick={() => handleSelectPropiedad(row)}
                    sx={{
                      border: `1.5px solid ${selected ? ACCENT : '#E5E7EB'}`,
                      borderRadius: '10px',
                      p: 2,
                      cursor: 'pointer',
                      bgcolor: selected ? '#ECFDF5' : 'white',
                      transition: 'all 0.15s',
                      '&:hover': { bgcolor: '#ECFDF5', borderColor: ACCENT },
                    }}
                  >
                    <Box display="flex" alignItems="flex-start" gap={1.25}>
                      <HomeWorkOutlinedIcon sx={{ fontSize: 18, color: selected ? ACCENT : '#9CA3AF', mt: 0.25, flexShrink: 0 }} />
                      <Box flex={1}>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>
                          {p?.titulo ?? 'Sin título'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', mt: 0.25 }}>
                          {p?.localidad}{p?.localidad && ' · '}{fmt(p?.precio_publicacion, p?.moneda) ?? ''}
                        </Typography>
                        {row.monto_propuesto && (
                          <Typography sx={{ fontSize: '0.72rem', color: ACCENT, mt: 0.5, fontWeight: 600 }}>
                            Oferta: {fmt(row.monto_propuesto, p?.moneda)}
                            {row.forma_pago && ` · ${row.forma_pago}`}
                          </Typography>
                        )}
                      </Box>
                      {selected && <CheckCircleIcon sx={{ fontSize: 18, color: ACCENT, flexShrink: 0 }} />}
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </>
        )}

        {/* ── Paso 3: estado de la propiedad ── */}
        {step === 3 && (
          <>
            {/* Banner propiedad */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 3, p: 2, bgcolor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
              <HomeWorkOutlinedIcon sx={{ color: '#6B7280', fontSize: 20, mt: 0.25, flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
                  Propiedad seleccionada
                </Typography>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                  {propTitulo}
                </Typography>
              </Box>
              <Chip
                label={tipoSelected === 'exitoso' ? 'Cierre exitoso' : 'Cierre negativo'}
                size="small"
                sx={{
                  ml: 'auto', flexShrink: 0,
                  bgcolor: tipoSelected === 'exitoso' ? '#ECFDF5' : '#FFF5F5',
                  color: tipoSelected === 'exitoso' ? ACCENT : '#EF4444',
                  border: `1px solid ${tipoSelected === 'exitoso' ? '#A7F3D0' : '#FECACA'}`,
                  fontSize: '0.7rem', fontWeight: 600,
                }}
              />
            </Box>

            {/* Banner comprador */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 3, p: 2, bgcolor: '#F0FDF4', borderRadius: '10px', border: '1px solid #A7F3D0' }}>
              <PersonOutlineIcon sx={{ color: ACCENT, fontSize: 20, mt: 0.25, flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
                  Datos del comprador (autorrelleno)
                </Typography>
                <Typography sx={{ fontSize: '0.82rem', color: '#111827', fontWeight: 600 }}>
                  {prospecto.nombre} {prospecto.apellido}
                </Typography>
                {prospecto.telefono && (
                  <Typography sx={{ fontSize: '0.78rem', color: '#6B7280', mt: 0.25 }}>
                    {prospecto.telefono}
                  </Typography>
                )}
              </Box>
            </Box>

            <Typography sx={{ fontSize: '0.82rem', color: '#6B7280', mb: 2 }}>
              Selecciona en que estado quedo la propiedad:
            </Typography>

            <Box display="flex" flexDirection="column" gap={1.25}>
              {ESTADOS_PROPIEDAD.map(e => {
                const selected = estadoSelected === e.value
                return (
                  <Box
                    key={e.value}
                    onClick={() => setEstadoSelected(e.value)}
                    sx={{
                      border: `1.5px solid ${selected ? e.color : e.border}`,
                      borderRadius: '10px',
                      p: 2,
                      cursor: 'pointer',
                      bgcolor: selected ? e.bg : 'white',
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      '&:hover': { bgcolor: e.bg, borderColor: e.color },
                    }}
                  >
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: e.color, flexShrink: 0 }} />
                    <Box flex={1}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: e.color }}>{e.label}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', mt: 0.25 }}>{e.desc}</Typography>
                    </Box>
                    {selected && <CheckCircleIcon sx={{ fontSize: 18, color: e.color, flexShrink: 0 }} />}
                  </Box>
                )
              })}
            </Box>

            <Button
              fullWidth variant="contained"
              disabled={!estadoSelected || saving}
              onClick={() => handleConfirm()}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{
                mt: 3, bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none',
                fontWeight: 600, fontSize: '0.875rem', py: 1.25, boxShadow: 'none',
                '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
                '&:disabled': { bgcolor: '#E5E7EB', color: '#9CA3AF' },
              }}
            >
              {saving ? 'Registrando...' : 'Confirmar cierre'}
            </Button>
          </>
        )}
      </Box>
    </Drawer>
  )
}
