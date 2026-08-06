import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box, Typography, TextField, Button, IconButton, CircularProgress, Alert, Chip, useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import SendIcon from '@mui/icons-material/Send'
import AddCommentIcon from '@mui/icons-material/AddComment'
import SearchIcon from '@mui/icons-material/Search'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined'
import CloseIcon from '@mui/icons-material/Close'
import { useAuth } from '../contexts/AuthContext'
import { getWhatsappMensajes, sendWhatsappMensaje, getContactos, getContactoPropiedades } from '../services/supabase'

const ACCENT   = '#065F46'
const POLL_MS  = 5000
const LIST_W   = 300
const INFO_W   = 300

const TIPO_META = {
  Comprador:    { color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' },
  Vendedor:     { color: '#B45309', bg: '#FFFBEB', border: '#FCD34D' },
  Arrendatario: { color: '#1D4ED8', bg: '#EFF6FF', border: '#93C5FD' },
  Locatario:    { color: ACCENT,    bg: '#ECFDF5', border: '#6EE7B7' },
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}

function soloDigitos(telefono) {
  return (telefono || '').replace(/\D/g, '')
}

function telefonosCoinciden(a, b) {
  const da = soloDigitos(a)
  const db = soloDigitos(b)
  if (!da || !db) return false
  const len = Math.min(da.length, db.length, 8)
  return da.slice(-len) === db.slice(-len)
}

function fmtHora(date) {
  return new Date(date).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function fmtListaHora(date) {
  const d = new Date(date)
  const hoy = new Date()
  return d.toDateString() === hoy.toDateString()
    ? d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

function iniciales(contacto, telefono) {
  if (contacto?.nombre || contacto?.apellido) {
    return `${contacto.nombre?.[0] ?? ''}${contacto.apellido?.[0] ?? ''}`.toUpperCase() || '?'
  }
  return soloDigitos(telefono).slice(-2) || '?'
}

function nombreConversacion(c) {
  if (c.contacto) return `${c.contacto.nombre} ${c.contacto.apellido}`
  return c.telefono
}

function Avatar({ contacto, telefono, size = 40 }) {
  return (
    <Box
      sx={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        bgcolor: contacto ? '#ECFDF5' : '#F3F4F6',
        border: `1px solid ${contacto ? '#A7F3D0' : '#E5E7EB'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Typography sx={{ fontSize: size * 0.35, fontWeight: 700, color: contacto ? ACCENT : '#9CA3AF' }}>
        {iniciales(contacto, telefono)}
      </Typography>
    </Box>
  )
}

export default function WhatsApp() {
  const { clienteId } = useAuth()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [mensajes, setMensajes]   = useState([])
  const [contactos, setContactos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  const [selectedTelefono, setSelectedTelefono] = useState(null)
  const [busqueda, setBusqueda]                 = useState('')
  const [nuevoChatOpen, setNuevoChatOpen]       = useState(false)
  const [nuevoTelefono, setNuevoTelefono]       = useState('')

  const [texto, setTexto]     = useState('')
  const [sending, setSending] = useState(false)

  const [contactoPropiedades, setContactoPropiedades] = useState([])
  const [loadingPropiedades, setLoadingPropiedades]   = useState(false)

  const pollRef   = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!clienteId) return
    getContactos(clienteId).then(setContactos).catch(() => {})
    refresh()
    pollRef.current = setInterval(refresh, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [clienteId])

  async function refresh() {
    try {
      setMensajes(await getWhatsappMensajes(clienteId))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const conversaciones = useMemo(() => {
    const grupos = new Map()
    for (const m of mensajes) {
      const key = soloDigitos(m.telefono).slice(-8) || m.telefono
      if (!grupos.has(key)) grupos.set(key, [])
      grupos.get(key).push(m)
    }
    const lista = Array.from(grupos.values()).map(msjs => {
      const ordenados = [...msjs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      const ultimo = ordenados[ordenados.length - 1]
      const contacto = contactos.find(c => telefonosCoinciden(c.telefono, ultimo.telefono))
      return { telefono: ultimo.telefono, mensajes: ordenados, ultimo, contacto }
    })
    return lista.sort((a, b) => new Date(b.ultimo.created_at) - new Date(a.ultimo.created_at))
  }, [mensajes, contactos])

  const conversacionesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return conversaciones
    return conversaciones.filter(c => nombreConversacion(c).toLowerCase().includes(q))
  }, [conversaciones, busqueda])

  const conversacionActual = useMemo(() => {
    if (!selectedTelefono) return null
    return conversaciones.find(c => telefonosCoinciden(c.telefono, selectedTelefono)) ?? null
  }, [conversaciones, selectedTelefono])

  const contactoActual = conversacionActual?.contacto
    ?? (selectedTelefono ? contactos.find(c => telefonosCoinciden(c.telefono, selectedTelefono)) : null)
    ?? null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [conversacionActual?.mensajes.length, selectedTelefono])

  useEffect(() => {
    if (!contactoActual) { setContactoPropiedades([]); return }
    setLoadingPropiedades(true)
    getContactoPropiedades(contactoActual.id)
      .then(setContactoPropiedades)
      .catch(() => setContactoPropiedades([]))
      .finally(() => setLoadingPropiedades(false))
  }, [contactoActual?.id])

  function abrirConversacion(telefono) {
    setSelectedTelefono(telefono)
    setNuevoChatOpen(false)
  }

  function iniciarNuevoChat() {
    if (!nuevoTelefono.trim()) return
    setSelectedTelefono(nuevoTelefono.trim())
    setNuevoTelefono('')
    setNuevoChatOpen(false)
  }

  async function handleSend() {
    if (!selectedTelefono || !texto.trim()) return
    setSending(true)
    setError(null)
    try {
      await sendWhatsappMensaje(clienteId, selectedTelefono.trim(), texto.trim())
      setTexto('')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const alturaContenedor = isMobile ? 'calc(100vh - 128px)' : 'calc(100vh - 64px)'

  // ─── Columna: lista de chats ────────────────────────────────────────────────
  // Nota: estas tres secciones se calculan como JSX inline (no como
  // componentes function separados) para que React no las trate como un
  // "tipo" nuevo en cada render -- si no, cualquier setState (por ejemplo
  // tipear en el input) desmonta y remonta todo el bloque y el input pierde
  // el foco a cada letra.
  const listaChats = (
      <Box sx={{
        width: isMobile ? '100%' : LIST_W, flexShrink: 0,
        borderRight: isMobile ? 'none' : '1px solid #E5E7EB',
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>Mensajería</Typography>
            <IconButton
              size="small" onClick={() => setNuevoChatOpen(p => !p)}
              sx={{ bgcolor: nuevoChatOpen ? '#ECFDF5' : '#F3F4F6', color: nuevoChatOpen ? ACCENT : '#6B7280' }}
            >
              {nuevoChatOpen ? <CloseIcon sx={{ fontSize: 17 }} /> : <AddCommentIcon sx={{ fontSize: 17 }} />}
            </IconButton>
          </Box>

          {nuevoChatOpen ? (
            <Box display="flex" gap={0.75}>
              <TextField
                size="small" autoFocus placeholder="Número de teléfono"
                value={nuevoTelefono} onChange={e => setNuevoTelefono(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') iniciarNuevoChat() }}
                sx={{ flex: 1, ...fieldSx }}
              />
              <Button
                variant="contained" onClick={iniciarNuevoChat} disabled={!nuevoTelefono.trim()}
                sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
              >
                Iniciar
              </Button>
            </Box>
          ) : (
            <TextField
              size="small" fullWidth placeholder="Buscar contacto..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: 17, color: '#9CA3AF', mr: 0.75 }} /> }}
              sx={fieldSx}
            />
          )}
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={22} sx={{ color: ACCENT }} />
            </Box>
          ) : conversacionesFiltradas.length === 0 ? (
            <Typography sx={{ fontSize: '0.8rem', color: '#9CA3AF', textAlign: 'center', py: 4, px: 2 }}>
              {busqueda ? 'Sin resultados.' : 'Todavía no hay conversaciones.'}
            </Typography>
          ) : (
            conversacionesFiltradas.map(c => {
              const activo = selectedTelefono && telefonosCoinciden(c.telefono, selectedTelefono)
              return (
                <Box
                  key={c.telefono}
                  onClick={() => abrirConversacion(c.telefono)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.25, cursor: 'pointer',
                    bgcolor: activo ? '#ECFDF5' : 'transparent',
                    borderLeft: `3px solid ${activo ? ACCENT : 'transparent'}`,
                    '&:hover': { bgcolor: activo ? '#ECFDF5' : '#F9FAFB' },
                  }}
                >
                  <Avatar contacto={c.contacto} telefono={c.telefono} size={38} />
                  <Box flex={1} minWidth={0}>
                    <Box display="flex" justifyContent="space-between" alignItems="baseline" gap={1}>
                      <Typography noWrap sx={{ fontSize: '0.84rem', fontWeight: 600, color: '#111827' }}>
                        {nombreConversacion(c)}
                      </Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: '#9CA3AF', flexShrink: 0 }}>
                        {fmtListaHora(c.ultimo.created_at)}
                      </Typography>
                    </Box>
                    <Typography noWrap sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                      {c.ultimo.direction === 'saliente' ? 'Vos: ' : ''}{c.ultimo.body}
                    </Typography>
                  </Box>
                </Box>
              )
            })
          )}
        </Box>
      </Box>
  )

  // ─── Columna: mensajes ──────────────────────────────────────────────────────
  const columnaMensajes = (() => {
    if (!selectedTelefono) {
      return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <ChatBubbleOutlineIcon sx={{ fontSize: 36, color: '#D1D5DB' }} />
          <Typography sx={{ fontSize: '0.85rem', color: '#9CA3AF' }}>
            Seleccioná una conversación para ver los mensajes.
          </Typography>
        </Box>
      )
    }

    const listaMensajes = conversacionActual?.mensajes ?? []

    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2.5, py: 1.5, borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          {isMobile && (
            <IconButton size="small" onClick={() => setSelectedTelefono(null)}>
              <ArrowBackIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
          <Avatar contacto={contactoActual} telefono={selectedTelefono} size={34} />
          <Box minWidth={0}>
            <Typography noWrap sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>
              {contactoActual ? `${contactoActual.nombre} ${contactoActual.apellido}` : selectedTelefono}
            </Typography>
            {contactoActual && (
              <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF' }}>{selectedTelefono}</Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {listaMensajes.length === 0 ? (
            <Typography sx={{ fontSize: '0.8rem', color: '#9CA3AF', textAlign: 'center', mt: 2 }}>
              Nueva conversación. Escribí el primer mensaje.
            </Typography>
          ) : (
            listaMensajes.map(m => (
              <Box
                key={m.id}
                sx={{
                  alignSelf: m.direction === 'saliente' ? 'flex-end' : 'flex-start',
                  maxWidth: '70%',
                  bgcolor: m.direction === 'saliente' ? '#ECFDF5' : '#F9FAFB',
                  border: `1px solid ${m.direction === 'saliente' ? '#A7F3D0' : '#E5E7EB'}`,
                  borderRadius: '10px', px: 1.5, py: 1,
                }}
              >
                <Typography sx={{ fontSize: '0.85rem', color: '#111827', whiteSpace: 'pre-wrap' }}>
                  {m.body}
                </Typography>
                <Typography sx={{ fontSize: '0.63rem', color: '#9CA3AF', mt: 0.25, textAlign: 'right' }}>
                  {fmtHora(m.created_at)}
                </Typography>
              </Box>
            ))
          )}
          <div ref={bottomRef} />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, p: 1.5, borderTop: '1px solid #E5E7EB', flexShrink: 0 }}>
          <TextField
            size="small" fullWidth placeholder="Escribí un mensaje..."
            value={texto} onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
            sx={fieldSx}
          />
          <Button
            variant="contained" onClick={handleSend}
            disabled={sending || !texto.trim()}
            startIcon={sending ? <CircularProgress size={14} color="inherit" /> : <SendIcon sx={{ fontSize: 16 }} />}
            sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
          >
            Enviar
          </Button>
        </Box>
      </Box>
    )
  })()

  // ─── Columna: info del contacto ─────────────────────────────────────────────
  const columnaInfo = (() => {
    if (!selectedTelefono) return null

    return (
      <Box sx={{ width: INFO_W, flexShrink: 0, borderLeft: '1px solid #E5E7EB', overflowY: 'auto', p: 2.5 }}>
        {!contactoActual ? (
          <Box display="flex" flexDirection="column" alignItems="center" textAlign="center" gap={1} mt={4}>
            <PersonOutlineIcon sx={{ fontSize: 30, color: '#D1D5DB' }} />
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Sin contacto vinculado</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
              No hay ningún contacto registrado con el número {selectedTelefono}.
            </Typography>
          </Box>
        ) : (
          <>
            <Box display="flex" flexDirection="column" alignItems="center" textAlign="center" mb={2.5}>
              <Avatar contacto={contactoActual} telefono={selectedTelefono} size={56} />
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', mt: 1 }}>
                {contactoActual.nombre} {contactoActual.apellido}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{contactoActual.telefono}</Typography>
              {contactoActual.email && (
                <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{contactoActual.email}</Typography>
              )}
            </Box>

            {(contactoActual.tipos?.length > 0) && (
              <Box mb={2}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF', mb: 0.75 }}>
                  Tipo de contacto
                </Typography>
                <Box display="flex" gap={0.5} flexWrap="wrap">
                  {contactoActual.tipos.map(t => {
                    const m = TIPO_META[t] ?? { color: '#374151', bg: '#F3F4F6', border: '#E5E7EB' }
                    return (
                      <Chip key={t} label={t} size="small" sx={{
                        fontSize: '0.68rem', fontWeight: 600, height: 22,
                        color: m.color, bgcolor: m.bg, border: `1px solid ${m.border}`,
                      }} />
                    )
                  })}
                </Box>
              </Box>
            )}

            {(contactoActual.tipo_operacion || contactoActual.presupuesto) && (
              <Box mb={2}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF', mb: 0.75 }}>
                  Preferencias
                </Typography>
                {contactoActual.tipo_operacion && (
                  <Typography sx={{ fontSize: '0.8rem', color: '#374151', mb: 0.25 }}>
                    Operación: <b>{contactoActual.tipo_operacion}</b>
                  </Typography>
                )}
                {contactoActual.presupuesto && (
                  <Typography sx={{ fontSize: '0.8rem', color: '#374151', mb: 0.25 }}>
                    Presupuesto: <b>{contactoActual.moneda_presupuesto} {Number(contactoActual.presupuesto).toLocaleString('es-AR')}</b>
                  </Typography>
                )}
                {contactoActual.zona_interes?.length > 0 && (
                  <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.75}>
                    {contactoActual.zona_interes.map(z => (
                      <Chip key={z} label={z} size="small" sx={{ fontSize: '0.68rem', height: 22, color: '#6B7280', bgcolor: '#F9FAFB', border: '1px solid #E5E7EB' }} />
                    ))}
                  </Box>
                )}
              </Box>
            )}

            <Box>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF', mb: 0.75 }}>
                Propiedades vinculadas
              </Typography>
              {loadingPropiedades ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress size={16} sx={{ color: ACCENT }} />
                </Box>
              ) : contactoPropiedades.length === 0 ? (
                <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Sin propiedades vinculadas.</Typography>
              ) : (
                <Box display="flex" flexDirection="column" gap={0.75}>
                  {contactoPropiedades.map(p => (
                    <Box key={p.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', border: '1px solid #E5E7EB', borderRadius: '8px', px: 1.25, py: 1 }}>
                      <HomeWorkOutlinedIcon sx={{ fontSize: 15, color: ACCENT, mt: 0.25 }} />
                      <Box minWidth={0}>
                        <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#111827' }}>{p.titulo}</Typography>
                        <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF' }}>
                          {[p.localidad, p.tipo_operacion].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </>
        )}
      </Box>
    )
  })()

  return (
    <Box sx={{ height: alturaContenedor, display: 'flex', flexDirection: 'column' }}>
      {error && <Alert severity="error" sx={{ mb: 1.5, borderRadius: '8px', fontSize: '0.82rem', flexShrink: 0 }}>{error}</Alert>}

      <Box sx={{ flex: 1, minHeight: 0, bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', display: 'flex', overflow: 'hidden' }}>
        {(!isMobile || !selectedTelefono) && listaChats}
        {(!isMobile || selectedTelefono) && columnaMensajes}
        {!isMobile && columnaInfo}
      </Box>
    </Box>
  )
}
