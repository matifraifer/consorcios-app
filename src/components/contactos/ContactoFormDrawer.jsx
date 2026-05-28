import { useEffect, useState } from 'react'
import {
  Box, Typography, Drawer, IconButton, TextField, Button,
  Alert, CircularProgress, Chip, Autocomplete, Select, MenuItem, FormControl,
} from '@mui/material'
import CloseIcon          from '@mui/icons-material/Close'
import CheckIcon          from '@mui/icons-material/Check'
import LockOutlinedIcon   from '@mui/icons-material/LockOutlined'
import AutoAwesomeIcon    from '@mui/icons-material/AutoAwesome'
import AddIcon            from '@mui/icons-material/Add'
import GroupIcon          from '@mui/icons-material/Group'
import LanguageIcon       from '@mui/icons-material/Language'
import {
  createContacto, updateContacto, getPropiedades, getUsuarios,
  getContactoPropiedades, setContactoPropiedades, checkDniExists,
  sugerirPropiedadesPorContacto,
} from '../../services/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#065F46'

const TIPOS_CONTACTO  = ['Comprador', 'Vendedor', 'Arrendatario', 'Locatario']
const TIPOS_PROPIEDAD = ['Casa', 'Departamento', 'Terreno', 'Local', 'Oficina', 'Otro']
const TIPOS_OPERACION = ['Alquiler', 'Compraventa']
const MONEDAS         = ['ARS', 'USD']
const ZONAS = [
  'Albardón','Angaco','Calingasta','Capital','Caucete','Chimbas',
  'Iglesia','Jáchal','9 de Julio','Pocito','Rawson','Rivadavia',
  'San Martín','Santa Lucía','Sarmiento','Ullum','Valle Fértil','25 de Mayo','Zonda',
]

const TIPO_META = {
  Comprador:    {  color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
  Vendedor:     {   color: '#B45309', bg: '#FFFBEB', border: '#FCD34D' },
  Arrendatario: { color: '#1D4ED8', bg: '#EFF6FF', border: '#93C5FD' },
  Locatario:    {  color: ACCENT,    bg: '#ECFDF5', border: '#6EE7B7' },
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}

const FORM_EMPTY = {
  tipos: [], nombre: '', apellido: '', dni: '', telefono: '', email: '', notas: '',
  tipo_propiedad_busca: [], tipo_operacion: '', presupuesto: '', moneda_presupuesto: 'ARS', zona_interes: [],
  asignado_nombre: '',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeCard({ tipo, selected, onToggle }) {
  const m = TIPO_META[tipo]
  return (
    <Box
      onClick={() => onToggle(tipo)}
      sx={{
        p: 1.5, borderRadius: '8px', cursor: 'pointer',
        border: `1.5px solid ${selected ? m.border : '#E5E7EB'}`,
        bgcolor: selected ? m.bg : 'white',
        position: 'relative',
        transition: 'all 0.15s',
        '&:hover': { borderColor: m.border, bgcolor: m.bg },
      }}
    >
      {selected && (
        <Box sx={{ position: 'absolute', top: 7, right: 7, width: 16, height: 16, borderRadius: '50%', bgcolor: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckIcon sx={{ fontSize: 10, color: 'white' }} />
        </Box>
      )}
      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: selected ? m.color : '#111827', mb: 0.2 }}>
        {tipo}
      </Typography>
      <Typography sx={{ fontSize: '0.67rem', color: '#9CA3AF', lineHeight: 1.3 }}>
        {m.desc}
      </Typography>
    </Box>
  )
}

function Label({ children, required, locked }) {
  return (
    <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
      {locked && <LockOutlinedIcon sx={{ fontSize: 12, color: '#9CA3AF' }} />}
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: locked ? '#9CA3AF' : '#374151' }}>
        {children}
      </Typography>
      {required && (
        <Typography component="span" sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#EF4444', lineHeight: 1 }}>*</Typography>
      )}
    </Box>
  )
}

function SectionTitle({ children }) {
  return (
    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: ACCENT, letterSpacing: '0.08em', textTransform: 'uppercase', mt: 3, mb: 1.5 }}>
      {children}
    </Typography>
  )
}

function fmtFecha(date) {
  if (!date) return null
  return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ConsultaBanner({ consulta }) {
  if (!consulta) return null
  return (
    <Box sx={{ mt: 2, mb: 0.5, border: '1px solid #A7F3D0', borderRadius: '10px', overflow: 'hidden', bgcolor: '#F0FDF4' }}>
      {/* Header del banner */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, bgcolor: '#DCFCE7', borderBottom: '1px solid #A7F3D0' }}>
        <LanguageIcon sx={{ fontSize: 14, color: ACCENT }} />
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: ACCENT, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Consulta desde la web
        </Typography>
        {consulta.created_at && (
          <Typography sx={{ fontSize: '0.68rem', color: '#6B7280', ml: 'auto' }}>
            {fmtFecha(consulta.created_at)}
          </Typography>
        )}
      </Box>

      <Box sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* Propiedad */}
        {consulta.propiedades && (
          <Box>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6B7280', mb: 0.25 }}>
              Propiedad consultada
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827' }}>
              {consulta.propiedades.titulo}
            </Typography>
            {(consulta.propiedades.direccion || consulta.propiedades.localidad) && (
              <Typography sx={{ fontSize: '0.72rem', color: '#6B7280' }}>
                {[consulta.propiedades.direccion, consulta.propiedades.localidad].filter(Boolean).join(', ')}
              </Typography>
            )}
          </Box>
        )}

        {/* Fila: presupuesto + provincia + zona */}
        {(consulta.presupuesto || consulta.provincia || consulta.zona_interes) && (
          <Box display="flex" gap={2} flexWrap="wrap">
            {consulta.presupuesto && (
              <Box>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6B7280', mb: 0.2 }}>Presupuesto</Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#374151' }}>{Number(consulta.presupuesto).toLocaleString('es-AR')}</Typography>
              </Box>
            )}
            {consulta.provincia && (
              <Box>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6B7280', mb: 0.2 }}>Provincia</Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#374151' }}>{consulta.provincia}</Typography>
              </Box>
            )}
            {consulta.zona_interes && (
              <Box>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6B7280', mb: 0.2 }}>Zona de interés</Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#374151' }}>{consulta.zona_interes}</Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Mensaje */}
        {consulta.mensaje && (
          <Box>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6B7280', mb: 0.25 }}>
              Mensaje
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: '#374151', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
              {consulta.mensaje}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ContactoFormDrawer({ open, onClose, contacto, clienteId, onSaved, prefill }) {
  const isEdit = !!contacto
  const [form, setForm]                             = useState(FORM_EMPTY)
  const [propiedadesVinculadas, setPropVinculadas]  = useState([])
  const [propiedadesDisponibles, setPropDisponibles]= useState([])
  const [usuarios, setUsuarios]                     = useState([])
  const [sugeridas, setSugeridas]                   = useState([])
  const [showSugeridas, setShowSugeridas]           = useState(false)
  const [loadingIA, setLoadingIA]                   = useState(false)
  const [loadingProps, setLoadingProps]             = useState(false)
  const [saving, setSaving]                         = useState(false)
  const [error, setError]                           = useState(null)

  const showDemandFields = form.tipos.includes('Comprador') || form.tipos.includes('Arrendatario')

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setError(null); setSugeridas([]); setShowSugeridas(false)

    setLoadingProps(true)
    Promise.all([
      getPropiedades({ cliente_id: clienteId, estado: 'Disponible' }),
      isEdit && contacto ? getContactoPropiedades(contacto.id) : Promise.resolve([]),
      getUsuarios(clienteId),
    ]).then(([props, vin, usrs]) => {
      setPropDisponibles(props)
      if (isEdit) setPropVinculadas(vin)
      setUsuarios(usrs ?? [])
    }).catch(() => {}).finally(() => setLoadingProps(false))

    if (isEdit && contacto) {
      setForm({
        tipos:               contacto.tipos ?? (contacto.tipo ? [contacto.tipo] : []),
        nombre:              contacto.nombre              ?? '',
        apellido:            contacto.apellido            ?? '',
        dni:                 contacto.dni                 ?? '',
        telefono:            contacto.telefono            ?? '',
        email:               contacto.email               ?? '',
        notas:               contacto.notas               ?? '',
        tipo_propiedad_busca: contacto.tipo_propiedad_busca ?? [],
        tipo_operacion:      contacto.tipo_operacion      ?? '',
        presupuesto:         contacto.presupuesto         ?? '',
        moneda_presupuesto:  contacto.moneda_presupuesto  ?? 'ARS',
        zona_interes:        contacto.zona_interes        ?? [],
        asignado_nombre:     contacto.asignado_nombre     ?? '',
      })
    } else {
      setForm({
        ...FORM_EMPTY,
        ...(prefill ? {
          nombre:         prefill.nombre          ?? '',
          apellido:       prefill.apellido        ?? '',
          dni:            prefill.dni             ?? '',
          telefono:       prefill.telefono        ?? '',
          email:          prefill.email           ?? '',
          presupuesto:    prefill.presupuesto     ?? '',
          zona_interes:   prefill.zona_interes ? [prefill.zona_interes] : [],
          tipo_operacion: prefill.tipo_operacion  ?? '',
        } : {}),
      })
      setPropVinculadas(prefill?.propiedad ? [prefill.propiedad] : [])
    }
  }, [open])

  function set(field, val) { setForm(p => ({ ...p, [field]: val })) }
  function toggleChip(field, val) {
    setForm(p => ({ ...p, [field]: p[field].includes(val) ? p[field].filter(v => v !== val) : [...p[field], val] }))
  }
  function toggleTipo(tipo) {
    setForm(prev => {
      const newTipos = prev.tipos.includes(tipo)
        ? prev.tipos.filter(t => t !== tipo)
        : [...prev.tipos, tipo]

      const hasCompraventa = newTipos.some(t => t === 'Comprador' || t === 'Vendedor')
      const hasAlquiler    = newTipos.some(t => t === 'Arrendatario' || t === 'Locatario')

      let newOp = prev.tipo_operacion
      if (newTipos.length === 0 || (hasCompraventa && hasAlquiler)) newOp = ''
      else if (hasCompraventa) newOp = 'Compraventa'
      else if (hasAlquiler)    newOp = 'Alquiler'

      return { ...prev, tipos: newTipos, tipo_operacion: newOp }
    })
  }

  // ── AI suggestion ──────────────────────────────────────────────────────────
  async function handleSuggestIA() {
    setLoadingIA(true); setShowSugeridas(false)
    try {
      const { tipo_propiedad_busca, tipo_operacion, zona_interes, presupuesto, moneda_presupuesto } = form
      const opMatch = tipo_operacion === 'Alquiler' ? 'Alquiler' : tipo_operacion === 'Compraventa' ? 'Venta' : null
      const res = await sugerirPropiedadesPorContacto({
        clienteId,
        tipoPropiedad:  tipo_propiedad_busca.length ? tipo_propiedad_busca : null,
        tipoOperacion:  opMatch,
        zonaInteres:    zona_interes.length ? zona_interes : null,
        presupuesto:    presupuesto || null,
        moneda:         moneda_presupuesto,
        excluirIds:     propiedadesVinculadas.map(p => p.id),
      })
      setSugeridas(res)
    } catch {
      setSugeridas([])
    } finally {
      setLoadingIA(false)
      setShowSugeridas(true)
    }
  }

  function addSugerida(p) {
    setPropVinculadas(prev => [...prev, p])
    setSugeridas(prev => prev.filter(s => s.id !== p.id))
  }

  function removePropVinculada(propId) {
    setPropVinculadas(prev => prev.filter(p => p.id !== propId))
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  async function validate() {
    if (!form.tipos.length)    return 'Seleccioná al menos un tipo de contacto.'
    if (!form.nombre.trim())   return 'El nombre es obligatorio.'
    if (!form.apellido.trim()) return 'El apellido es obligatorio.'
    if (!form.dni.trim())      return 'El DNI es obligatorio.'
    if (!form.telefono.trim()) return 'El teléfono es obligatorio.'
    if (!isEdit && form.dni.trim()) {
      const exists = await checkDniExists(form.dni, clienteId)
      if (exists) return 'Ya existe un contacto registrado con este DNI.'
    }
    return null
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const err = await validate()
    if (err) { setError(err); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        tipos: form.tipos.length ? form.tipos : null,
        tipo:  form.tipos[0] ?? null,
        nombre: form.nombre.trim(), apellido: form.apellido.trim(),
        telefono: form.telefono.trim(), email: form.email.trim() || null,
        notas: form.notas.trim() || null,
        tipo_propiedad_busca: form.tipo_propiedad_busca.length ? form.tipo_propiedad_busca : null,
        tipo_operacion:  form.tipo_operacion || null,
        presupuesto:     form.presupuesto ? Number(form.presupuesto) : null,
        moneda_presupuesto: form.moneda_presupuesto,
        zona_interes:    form.zona_interes.length ? form.zona_interes : null,
        asignado_nombre: form.asignado_nombre || null,
        cliente_id: clienteId,
      }
      if (!isEdit) { payload.dni = form.dni.trim(); payload.activo = true; payload.origen = 'APP' }
      const result = isEdit ? await updateContacto(contacto.id, payload) : await createContacto(payload)
      await setContactoPropiedades(result.id, propiedadesVinculadas.map(p => p.id))
      onSaved({ ...result, propiedades_count: propiedadesVinculadas.length })
      onClose()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const propOptions = propiedadesDisponibles.filter(p => !propiedadesVinculadas.find(v => v.id === p.id))

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 520, bgcolor: 'white', display: 'flex', flexDirection: 'column' } } }}
    >

      {/* Header */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center" gap={1.25}>
          <Box sx={{ width: 28, height: 28, borderRadius: '7px', bgcolor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GroupIcon sx={{ fontSize: 15, color: ACCENT }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
              {isEdit ? 'Editar contacto' : 'Nuevo contacto'}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF' }}>
              {isEdit ? `${contacto.apellido}, ${contacto.nombre}` : 'Completá los datos del contacto'}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 4 }}>

        {error && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{error}</Alert>
        )}

        {!isEdit && <ConsultaBanner consulta={prefill?.consulta} />}

        {/* Tipo de contacto */}
        <SectionTitle>Tipo de contacto</SectionTitle>
        <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5}>
          {TIPOS_CONTACTO.map(t => (
            <TypeCard key={t} tipo={t} selected={form.tipos.includes(t)} onToggle={toggleTipo} />
          ))}
        </Box>

        {/* Datos personales */}
        <SectionTitle>Datos personales</SectionTitle>

        <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5} mb={2}>
          <Box>
            <Label required>Nombre</Label>
            <TextField fullWidth size="small" value={form.nombre} onChange={e => set('nombre', e.target.value)} sx={fieldSx} />
          </Box>
          <Box>
            <Label required>Apellido</Label>
            <TextField fullWidth size="small" value={form.apellido} onChange={e => set('apellido', e.target.value)} sx={fieldSx} />
          </Box>
        </Box>

        <Box mb={2}>
          <Label required locked={isEdit}>DNI</Label>
          <TextField
            fullWidth size="small" value={form.dni}
            onChange={e => !isEdit && set('dni', e.target.value)}
            InputProps={{ readOnly: isEdit }}
            placeholder={isEdit ? '' : 'Número de documento'}
            sx={fieldSx}
            helperText={isEdit ? 'El DNI no puede modificarse una vez creado.' : undefined}
            FormHelperTextProps={{ sx: { fontSize: '0.68rem', color: '#9CA3AF', ml: 0, mt: 0.5 } }}
          />
        </Box>

        {/* Datos de contacto */}
        <SectionTitle>Datos de contacto</SectionTitle>

        <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5} mb={2}>
          <Box>
            <Label required>Teléfono</Label>
            <TextField fullWidth size="small" value={form.telefono} onChange={e => set('telefono', e.target.value)} sx={fieldSx} />
          </Box>
          <Box>
            <Label>Email</Label>
            <TextField fullWidth size="small" type="email" value={form.email} onChange={e => set('email', e.target.value)} sx={fieldSx} />
          </Box>
        </Box>

        {/* Preferencias */}
        <SectionTitle>Preferencias</SectionTitle>

        <Box mb={2}>
          <Label>Tipo de propiedad que busca</Label>
          <Box display="flex" gap={0.75} flexWrap="wrap" mt={0.5}>
            {TIPOS_PROPIEDAD.map(t => {
              const active = form.tipo_propiedad_busca.includes(t)
              return (
                <Chip key={t} label={t} onClick={() => toggleChip('tipo_propiedad_busca', t)} size="small" sx={{
                  fontSize: '0.75rem', fontWeight: active ? 600 : 400, cursor: 'pointer',
                  bgcolor: active ? ACCENT : 'white', color: active ? 'white' : '#6B7280',
                  border: `1px solid ${active ? ACCENT : '#E5E7EB'}`, borderRadius: '6px',
                  '&:hover': { bgcolor: active ? '#047857' : '#F9FAFB', borderColor: active ? '#047857' : ACCENT },
                }} />
              )
            })}
          </Box>
        </Box>

        <Box mb={2}>
          <Label>Tipo de operación</Label>
          <Box display="flex" gap={1} mt={0.5}>
            {TIPOS_OPERACION.map(op => {
              const active = form.tipo_operacion === op
              return (
                <Box key={op} onClick={() => set('tipo_operacion', active ? '' : op)} sx={{
                  flex: 1, py: 1.1, textAlign: 'center', borderRadius: '8px', cursor: 'pointer',
                  border: `1px solid ${active ? ACCENT : '#E5E7EB'}`,
                  bgcolor: active ? '#ECFDF5' : 'white', transition: 'all 0.15s',
                  '&:hover': { borderColor: ACCENT },
                }}>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: active ? ACCENT : '#6B7280' }}>
                    {op}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        </Box>

        {showDemandFields && (
          <>
            <Box mb={2}>
              <Label>Presupuesto disponible</Label>
              <Box display="flex" gap={1} mt={0.5} alignItems="center">
                <Box sx={{ display: 'flex', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                  {MONEDAS.map(m => (
                    <Box key={m} onClick={() => set('moneda_presupuesto', m)} sx={{
                      px: 1.5, py: 0.9,
                      bgcolor: form.moneda_presupuesto === m ? ACCENT : 'transparent',
                      color: form.moneda_presupuesto === m ? 'white' : '#6B7280',
                      fontSize: '0.75rem', fontWeight: 700,
                      cursor: 'pointer', transition: 'all 0.15s',
                      '&:hover': { bgcolor: form.moneda_presupuesto === m ? '#047857' : '#F9FAFB' },
                    }}>
                      {m}
                    </Box>
                  ))}
                </Box>
                <TextField size="small" type="number" placeholder="0" value={form.presupuesto} onChange={e => set('presupuesto', e.target.value)} sx={{ flex: 1, ...fieldSx }} />
              </Box>
            </Box>

            <Box mb={2}>
              <Label>Zona de interés</Label>
              <Box display="flex" flexWrap="wrap" gap={0.6} mt={0.5}>
                {ZONAS.map(z => {
                  const active = form.zona_interes.includes(z)
                  return (
                    <Chip key={z} label={z} onClick={() => toggleChip('zona_interes', z)} size="small" sx={{
                      fontSize: '0.7rem', fontWeight: active ? 600 : 400, cursor: 'pointer',
                      bgcolor: active ? ACCENT : 'white', color: active ? 'white' : '#6B7280',
                      border: `1px solid ${active ? ACCENT : '#E5E7EB'}`, borderRadius: '6px',
                      '&:hover': { bgcolor: active ? '#047857' : '#F9FAFB', borderColor: active ? '#047857' : ACCENT },
                    }} />
                  )
                })}
              </Box>
            </Box>
          </>
        )}

        {/* Propiedades vinculadas */}
        <SectionTitle>Propiedades vinculadas</SectionTitle>

        {showDemandFields && (
          <Box mb={2}>
            <Button
              onClick={handleSuggestIA}
              disabled={loadingIA || loadingProps}
              startIcon={loadingIA ? <CircularProgress size={13} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: 14 }} />}
              variant="outlined"
              size="small"
              sx={{
                borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.78rem',
                borderColor: ACCENT, color: ACCENT,
                '&:hover': { bgcolor: '#ECFDF5', borderColor: ACCENT },
                '&.Mui-disabled': { borderColor: '#E5E7EB', color: '#9CA3AF' },
              }}
            >
              {loadingIA ? 'Analizando...' : 'Sugerir propiedades coincidentes'}
            </Button>
          </Box>
        )}

        {showSugeridas && (
          <Box mb={2} sx={{ borderRadius: '8px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1, bgcolor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#6B7280' }}>
                {sugeridas.length === 0 ? 'Sin coincidencias' : `${sugeridas.length} propiedad${sugeridas.length !== 1 ? 'es' : ''} sugerida${sugeridas.length !== 1 ? 's' : ''}`}
              </Typography>
            </Box>
            {sugeridas.length === 0 ? (
              <Box sx={{ px: 2, py: 2 }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
                  No hay propiedades disponibles que coincidan con los criterios.
                </Typography>
              </Box>
            ) : (
              sugeridas.map((p, i) => (
                <Box key={p.id} sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  px: 2, py: 1.25, borderBottom: i < sugeridas.length - 1 ? '1px solid #F3F4F6' : 'none',
                  '&:hover': { bgcolor: '#F9FAFB' },
                }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827' }}>{p.titulo}</Typography>
                    <Box display="flex" alignItems="center" gap={0.75} mt={0.2}>
                      {p.localidad && (
                        <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF' }}>{p.localidad} ·</Typography>
                      )}
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: p.sobre_presupuesto ? 600 : 400, color: p.sobre_presupuesto ? '#EF4444' : '#9CA3AF' }}>
                        {p.moneda} {Number(p.precio_publicacion || 0).toLocaleString('es-AR')}
                      </Typography>
                      {p.sobre_presupuesto && (
                        <Typography sx={{ fontSize: '0.65rem', color: '#EF4444', bgcolor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '4px', px: 0.75, py: 0.1, fontWeight: 600 }}>
                          Supera presupuesto
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <Button
                    size="small" onClick={() => addSugerida(p)}
                    startIcon={<AddIcon sx={{ fontSize: 12 }} />}
                    sx={{
                      fontSize: '0.72rem', textTransform: 'none', fontWeight: 600,
                      color: ACCENT, borderRadius: '6px', border: '1px solid #A7F3D0', bgcolor: '#ECFDF5', px: 1.25,
                      '&:hover': { bgcolor: '#D1FAE5' },
                    }}
                  >
                    Agregar
                  </Button>
                </Box>
              ))
            )}
          </Box>
        )}

        {/* Lista de propiedades vinculadas */}
        {propiedadesVinculadas.length > 0 && (
          <Box mb={1.5} sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
            {propiedadesVinculadas.map((p, i) => (
              <Box key={p.id} sx={{
                display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
                borderBottom: i < propiedadesVinculadas.length - 1 ? '1px solid #F3F4F6' : 'none',
              }}>
                <Box flex={1} minWidth={0}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.titulo}
                  </Typography>
                  {p.localidad && (
                    <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF' }}>{p.localidad}</Typography>
                  )}
                </Box>
                <IconButton size="small" onClick={() => removePropVinculada(p.id)}
                  sx={{ color: '#9CA3AF', '&:hover': { color: '#EF4444' }, flexShrink: 0 }}>
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        {/* Picker de nueva propiedad */}
        {loadingProps ? (
          <Box display="flex" alignItems="center" gap={1} py={1}>
            <CircularProgress size={14} sx={{ color: ACCENT }} />
            <Typography sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>Cargando propiedades...</Typography>
          </Box>
        ) : (
          <Autocomplete
            options={propOptions}
            getOptionLabel={p => `${p.titulo}${p.localidad ? ` — ${p.localidad}` : ''}`}
            value={null}
            onChange={(_, val) => { if (val) setPropVinculadas(prev => [...prev, val]) }}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            noOptionsText="Sin propiedades disponibles"
            renderInput={params => (
              <TextField {...params} size="small"
                placeholder="Buscar y agregar propiedad..."
                sx={fieldSx}
              />
            )}
          />
        )}

        {/* Operador asignado */}
        <SectionTitle>Operador asignado</SectionTitle>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <Select
            value={form.asignado_nombre}
            onChange={e => set('asignado_nombre', e.target.value)}
            displayEmpty
            sx={{
              borderRadius: '8px', fontSize: '0.875rem',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT, borderWidth: 1 },
            }}
          >
            <MenuItem value="" sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Sin asignar</MenuItem>
            {usuarios.map(u => (
              <MenuItem key={u.id} value={u.nombre_usuario} sx={{ fontSize: '0.875rem' }}>
                {u.nombre_usuario}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Notas */}
        <Box mt={2}>
          <Label>Notas</Label>
          <TextField
            fullWidth multiline rows={2} size="small"
            value={form.notas} onChange={e => set('notas', e.target.value)}
            placeholder="Información adicional sobre este contacto..."
            sx={fieldSx}
          />
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, borderTop: '1px solid #E5E7EB', display: 'flex', gap: 1.5, flexShrink: 0 }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{
            bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem',
            boxShadow: 'none',
            '&:hover': { bgcolor: '#047857', boxShadow: 'none' },
            '&.Mui-disabled': { bgcolor: '#E5E7EB', color: '#9CA3AF' },
          }}
        >
          {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear contacto'}
        </Button>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 500, fontSize: '0.82rem', borderColor: '#E5E7EB', color: '#6B7280', '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' } }}
        >
          Cancelar
        </Button>
      </Box>
    </Drawer>
  )
}
