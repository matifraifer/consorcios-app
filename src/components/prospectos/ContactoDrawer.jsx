import { useEffect, useState } from 'react'
import {
  Box, Typography, Drawer, IconButton, Button, CircularProgress,
  Select, MenuItem, FormControl, Divider,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import PersonIcon from '@mui/icons-material/Person'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import HistoryIcon from '@mui/icons-material/History'
import {
  updateProspectoAsignado,
  addHistorialProspecto,
  getHistorialByProspecto,
  getContactoPropiedades,
} from '../../services/supabase'

const ACCENT = '#065F46'

const selectSx = {
  fontSize: '0.82rem', borderRadius: '8px',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
}

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', py: 1.25, borderBottom: '1px solid #F3F4F6' }}>
      <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', flexShrink: 0, mr: 2 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.8rem', color: '#111827', fontWeight: 500, textAlign: 'right' }}>{value}</Typography>
    </Box>
  )
}

function SectionLabel({ children }) {
  return (
    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9CA3AF', mt: 3, mb: 1.5 }}>
      {children}
    </Typography>
  )
}

function Initials({ nombre }) {
  const text = (nombre ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#475569' }}>{text}</Typography>
    </Box>
  )
}

function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export default function ContactoDrawer({ open, onClose, prospecto, onPassToNextEtapa, usuarios = [], currentUser, onAsignadoChange }) {
  const [asignado, setAsignado] = useState('')
  const [savingAsignado, setSavingAsignado] = useState(false)
  const [historial, setHistorial] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [historialError, setHistorialError] = useState(false)
  const [propiedades, setPropiedades] = useState([])
  const [loadingProps, setLoadingProps] = useState(false)

  useEffect(() => {
    if (!open || !prospecto) return
    setAsignado(prospecto.asignado_nombre ?? '')
    setHistorialError(false)
    setLoadingHistorial(true)
    getHistorialByProspecto(prospecto.id)
      .then(data => setHistorial(data))
      .catch(() => { setHistorial([]); setHistorialError(true) })
      .finally(() => setLoadingHistorial(false))

    if (prospecto.contacto_id) {
      setLoadingProps(true)
      getContactoPropiedades(prospecto.contacto_id)
        .then(data => setPropiedades(data ?? []))
        .catch(() => setPropiedades([]))
        .finally(() => setLoadingProps(false))
    } else if (prospecto.propiedades) {
      setPropiedades([prospecto.propiedades])
    } else {
      setPropiedades([])
    }
  }, [open, prospecto?.id])

  async function handleAsignadoChange(newNombre) {
    if (newNombre === asignado) return
    setSavingAsignado(true)
    try {
      await updateProspectoAsignado(prospecto.id, newNombre)
      await addHistorialProspecto(prospecto.id, currentUser?.nombre_usuario ?? 'Sistema', `Reasignó a ${newNombre}`)
      setAsignado(newNombre)
      onAsignadoChange?.(prospecto.id, newNombre)
      const data = await getHistorialByProspecto(prospecto.id)
      setHistorial(data)
    } catch {
      // silencioso
    } finally {
      setSavingAsignado(false)
    }
  }

  if (!prospecto) return null

  const esVenta = prospecto.tipo_operacion === 'venta'

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      slotProps={{ paper: { sx: { width: 440, bgcolor: 'white', display: 'flex', flexDirection: 'column' } } }}>

      {/* Header */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center" gap={1.25}>
          <Box sx={{ width: 28, height: 28, borderRadius: '7px', bgcolor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PersonIcon sx={{ fontSize: 15, color: ACCENT }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Detalle de seguimiento</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>{prospecto.nombre} {prospecto.apellido}</Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>

        {/* Tipo de operación */}
        <Box mb={3}>
          <Box sx={{
            display: 'inline-flex', px: 1.5, py: 0.5,
            bgcolor: esVenta ? '#ECFDF5' : '#EFF6FF',
            border: `1px solid ${esVenta ? '#A7F3D0' : '#BFDBFE'}`,
            borderRadius: '6px',
          }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: esVenta ? ACCENT : '#1D4ED8' }}>
              {esVenta ? 'Venta / Compra' : 'Alquiler'}
            </Typography>
          </Box>
        </Box>

        {/* Asignado a */}
        <SectionLabel>Asignado a</SectionLabel>
        <Box display="flex" alignItems="center" gap={1.5} mb={3}>
          <Initials nombre={asignado || '?'} />
          <FormControl size="small" sx={{ flex: 1 }}>
            <Select
              value={asignado}
              displayEmpty
              onChange={e => handleAsignadoChange(e.target.value)}
              disabled={savingAsignado}
              sx={selectSx}
            >
              <MenuItem value="" sx={{ fontSize: '0.82rem', color: '#9CA3AF' }}>Sin asignar</MenuItem>
              {usuarios.map(u => (
                <MenuItem key={u.id} value={u.nombre_usuario} sx={{ fontSize: '0.82rem' }}>
                  {u.nombre_usuario}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {savingAsignado && <CircularProgress size={16} sx={{ color: ACCENT, flexShrink: 0 }} />}
        </Box>

        {/* Datos de contacto */}
        <SectionLabel>Datos de contacto</SectionLabel>
        <Box mb={3}>
          <InfoRow label="Nombre" value={`${prospecto.nombre} ${prospecto.apellido}`} />
          <InfoRow label="Teléfono" value={prospecto.telefono} />
          <InfoRow label="Email" value={prospecto.email} />
        </Box>

        {/* Preferencias (solo venta) */}
        {esVenta && (
          <>
            <SectionLabel>Preferencias de búsqueda</SectionLabel>
            <Box mb={3}>
              <InfoRow
                label="Presupuesto"
                value={prospecto.presupuesto ? `USD ${Number(prospecto.presupuesto).toLocaleString('es-AR')}` : null}
              />
              <InfoRow label="Zona" value={prospecto.zona} />
              <InfoRow label="Tipo de inmueble" value={prospecto.tipo_inmueble} />
              <InfoRow
                label="Crédito hipotecario"
                value={prospecto.credito_hipotecario === true ? 'Sí' : prospecto.credito_hipotecario === false ? 'No' : null}
              />
            </Box>
          </>
        )}

        {/* Propiedades vinculadas */}
        {(loadingProps || propiedades.length > 0) && (
          <>
            <SectionLabel>Propiedades vinculadas</SectionLabel>
            {loadingProps ? (
              <Box display="flex" alignItems="center" gap={1} py={1} mb={2}>
                <CircularProgress size={13} sx={{ color: ACCENT }} />
                <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>Cargando propiedades...</Typography>
              </Box>
            ) : (
              <Box mb={3} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {propiedades.map(p => (
                  <Box key={p.id} sx={{ bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', p: 2 }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', mb: 0.5 }}>
                      {p.titulo}
                    </Typography>
                    {(p.direccion || p.localidad) && (
                      <Typography sx={{ fontSize: '0.78rem', color: '#6B7280', mb: p.precio_publicacion ? 1 : 0 }}>
                        {[p.direccion, p.localidad, p.provincia].filter(Boolean).join(', ')}
                      </Typography>
                    )}
                    {p.precio_publicacion && (
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, bgcolor: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '6px', px: 1.25, py: 0.4 }}>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: ACCENT }}>
                          {p.moneda} {Number(p.precio_publicacion).toLocaleString('es-AR')}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}

        <Divider sx={{ mb: 3, borderColor: '#F3F4F6' }} />

        {/* Historial */}
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <HistoryIcon sx={{ fontSize: 15, color: '#9CA3AF' }} />
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9CA3AF' }}>
            Historial de actividad
          </Typography>
        </Box>

        {loadingHistorial ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={20} sx={{ color: ACCENT }} />
          </Box>
        ) : historialError ? (
          <Typography sx={{ fontSize: '0.78rem', color: '#EF4444', py: 1 }}>
            No se pudo cargar el historial. Verificá que la migración SQL fue ejecutada.
          </Typography>
        ) : historial.length === 0 ? (
          <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF', py: 1 }}>
            Sin actividad registrada aún.
          </Typography>
        ) : (
          <Box>
            {historial.map((h, i) => (
              <Box key={h.id} sx={{
                pl: 2,
                borderLeft: `2px solid ${i === 0 ? ACCENT : '#E5E7EB'}`,
                mb: 2,
              }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#111827', fontWeight: 500, lineHeight: 1.4 }}>
                  {h.accion}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF', mt: 0.25 }}>
                  {h.usuario_nombre} · {fmtDateTime(h.created_at)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, borderTop: '1px solid #E5E7EB', display: 'flex', gap: 1.5, flexShrink: 0 }}>
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon sx={{ fontSize: 15 }} />}
          onClick={() => { onPassToNextEtapa(); onClose() }}
          sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
        >
          Pasar a Presentación
        </Button>
        <Button variant="outlined" onClick={onClose}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#374151', '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' } }}>
          Guardar
        </Button>
        <Button variant="text" onClick={onClose}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.82rem', color: '#9CA3AF', '&:hover': { bgcolor: '#F9FAFB' } }}>
          Cerrar
        </Button>
      </Box>
    </Drawer>
  )
}
