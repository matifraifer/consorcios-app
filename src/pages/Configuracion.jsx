import { useEffect, useRef, useState } from 'react'
import {
  Box, Typography, Switch, CircularProgress, TextField, Button,
  Select, MenuItem, FormControl, InputLabel, IconButton, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import LanguageIcon from '@mui/icons-material/Language'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import PaymentIcon from '@mui/icons-material/Payment'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useAuth } from '../contexts/AuthContext'
import {
  // getMlToken, deleteMlToken, supabase, // MercadoLibre — deshabilitado temporalmente
  getClienteConfig, updateClienteConfig, uploadClienteLogo,
  uploadPortadaImage, deletePortadaImage,
  getWhatsappSesion, connectWhatsapp, disconnectWhatsapp,
  getMpToken, testMercadoPago, disconnectMercadoPago,
} from '../services/supabase'

const ACCENT = '#065F46'
// MercadoLibre — deshabilitado temporalmente
// const ML_CLIENT_ID    = '3889570283764172'
// const ML_REDIRECT_URI = 'https://consorcios-app.vercel.app/ml-callback'
// const ML_AUTH_URL = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(ML_REDIRECT_URI)}&state=granito`

const MP_CLIENT_ID    = '834882963305769'
const MP_REDIRECT_URI = 'https://app.granito.com.ar/mp-callback'
const MP_AUTH_URL = `https://auth.mercadopago.com.ar/authorization?client_id=${MP_CLIENT_ID}&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(MP_REDIRECT_URI)}&state=granito`

const RED_SOCIAL_TIPOS = ['Instagram', 'Página web', 'Otro']
const MAX_REDES = 3

const WA_POLL_MS = 2000
const WA_TIMEOUT_MS = 90000

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px', fontSize: '0.875rem',
    '& fieldset': { borderColor: '#E5E7EB' },
    '&:hover fieldset': { borderColor: ACCENT },
    '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1 },
  },
}

function SectionTitle({ children }) {
  return (
    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9CA3AF', mb: 2 }}>
      {children}
    </Typography>
  )
}

function SubsectionTitle({ children }) {
  return (
    <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', mb: 1.5, mt: 3 }}>
      {children}
    </Typography>
  )
}

function Label({ children }) {
  return (
    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>
      {children}
    </Typography>
  )
}

function ColorPicker({ label, value, onChange }) {
  const inputRef = useRef(null)
  const safeHex = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#000000'

  function handleHexInput(e) {
    let v = e.target.value
    if (v && !v.startsWith('#')) v = '#' + v
    onChange(v)
  }

  return (
    <Box>
      <Label>{label}</Label>
      <Box display="flex" alignItems="center" gap={1.25}>
        <Box
          onClick={() => inputRef.current?.click()}
          sx={{
            width: 36, height: 36, borderRadius: '8px', flexShrink: 0,
            bgcolor: safeHex, border: '1px solid #E5E7EB', cursor: 'pointer',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
            transition: 'transform 0.1s', '&:hover': { transform: 'scale(1.08)' },
          }}
        />
        <Box
          component="input"
          ref={inputRef}
          type="color"
          value={safeHex}
          onChange={e => onChange(e.target.value)}
          sx={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        />
        <TextField
          size="small"
          value={value}
          onChange={handleHexInput}
          placeholder="#000000"
          inputProps={{ maxLength: 7, style: { fontFamily: 'monospace', fontSize: '0.82rem' } }}
          sx={{ ...fieldSx, width: 110 }}
        />
      </Box>
    </Box>
  )
}

function IntegrationCard({ logo, name, description, connected, loading, onToggle }) {
  return (
    <Box sx={{
      bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px',
      p: 2.5, display: 'flex', alignItems: 'center', gap: 2,
      opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
    }}>
      <Box sx={{
        width: 44, height: 44, borderRadius: '10px', flexShrink: 0,
        bgcolor: connected ? '#ECFDF5' : '#F9FAFB',
        border: `1px solid ${connected ? '#A7F3D0' : '#E5E7EB'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {logo}
      </Box>

      <Box flex={1} minWidth={0}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>
            {name}
          </Typography>
          {!loading && (
            <Box sx={{
              px: 1, py: 0.2,
              bgcolor: connected ? '#ECFDF5' : '#F3F4F6',
              border: `1px solid ${connected ? '#A7F3D0' : '#E5E7EB'}`,
              borderRadius: '20px',
            }}>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: connected ? ACCENT : '#9CA3AF' }}>
                {connected ? 'Conectado' : 'Desconectado'}
              </Typography>
            </Box>
          )}
          {loading && <CircularProgress size={12} sx={{ color: ACCENT }} />}
        </Box>
        <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', mt: 0.25 }}>
          {description}
        </Typography>
      </Box>

      <Switch
        checked={connected}
        disabled={loading}
        onChange={onToggle}
        sx={{
          flexShrink: 0,
          '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT },
          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT },
        }}
      />
    </Box>
  )
}

const RED_SOCIAL_EMPTY = { tipo: '', valor: '' }

export default function Configuracion() {
  const { clienteId } = useAuth()

  // MercadoLibre — deshabilitado temporalmente
  // const [mlStatus, setMlStatus]   = useState('loading')
  // const [mlNickname, setMlNickname] = useState('')
  // const [mlToggling, setMlToggling] = useState(false)
  // useEffect(() => { if (!clienteId) return; checkMlConnection() }, [clienteId])
  // async function checkMlConnection() { ... }
  // async function handleMlToggle() { ... }
  // const mlConnected = mlStatus === 'connected'
  // const mlLoading   = mlStatus === 'loading' || mlToggling

  // ── Mercado Pago ──
  const [mpStatus, setMpStatus]     = useState('loading') // 'loading' | 'connected' | 'disconnected'
  const [mpNickname, setMpNickname] = useState('')
  const [mpToggling, setMpToggling] = useState(false)

  useEffect(() => { if (!clienteId) return; checkMpConnection() }, [clienteId])

  async function checkMpConnection() {
    try {
      const tokenRow = await getMpToken(clienteId)
      if (!tokenRow) { setMpStatus('disconnected'); return }
      const result = await testMercadoPago(clienteId)
      if (result?.connected) {
        setMpNickname(result.nickname ?? '')
        setMpStatus('connected')
      } else {
        setMpStatus('disconnected')
      }
    } catch {
      setMpStatus('disconnected')
    }
  }

  async function handleMpToggle() {
    if (mpConnected) {
      setMpToggling(true)
      try {
        await disconnectMercadoPago(clienteId)
        setMpStatus('disconnected')
        setMpNickname('')
      } catch (err) {
        setSnackMsg(err.message)
      } finally {
        setMpToggling(false)
      }
    } else {
      window.location.href = MP_AUTH_URL
    }
  }

  const mpConnected = mpStatus === 'connected'
  const mpLoading   = mpStatus === 'loading' || mpToggling

  // ── WhatsApp ──
  const [waSesion, setWaSesion]     = useState(null)
  const [waDialogOpen, setWaDialogOpen] = useState(false)
  const [waBusy, setWaBusy]         = useState(false)
  const [waError, setWaError]       = useState(null)
  const [waTimedOut, setWaTimedOut] = useState(false)
  const waPollRef = useRef(null)
  const waTimeoutRef = useRef(null)

  useEffect(() => {
    if (!clienteId) return
    refreshWaSesion()
    return stopWaPolling
  }, [clienteId])

  async function refreshWaSesion() {
    try {
      setWaSesion(await getWhatsappSesion(clienteId))
    } catch { /* la card queda como "Desconectado" si falla */ }
  }

  function stopWaPolling() {
    if (waPollRef.current) clearInterval(waPollRef.current)
    if (waTimeoutRef.current) clearTimeout(waTimeoutRef.current)
    waPollRef.current = null
    waTimeoutRef.current = null
  }

  async function handleOpenWaDialog() {
    setWaError(null)
    setWaTimedOut(false)
    setWaDialogOpen(true)
    setWaBusy(true)
    try {
      await connectWhatsapp(clienteId)
    } catch (err) {
      setWaError(err.message)
      setWaBusy(false)
      return
    }

    waPollRef.current = setInterval(async () => {
      try {
        const data = await getWhatsappSesion(clienteId)
        setWaSesion(data)
        if (data?.estado === 'conectado') {
          stopWaPolling()
          setWaBusy(false)
        }
      } catch { /* se reintenta en el próximo tick */ }
    }, WA_POLL_MS)

    waTimeoutRef.current = setTimeout(() => {
      stopWaPolling()
      setWaTimedOut(true)
      setWaBusy(false)
    }, WA_TIMEOUT_MS)
  }

  function handleCloseWaDialog() {
    stopWaPolling()
    setWaDialogOpen(false)
    setWaBusy(false)
  }

  async function handleDisconnectWa() {
    setWaBusy(true)
    setWaError(null)
    try {
      await disconnectWhatsapp(clienteId)
      await refreshWaSesion()
    } catch (err) {
      setWaError(err.message)
    } finally {
      setWaBusy(false)
    }
  }

  const waConnected = waSesion?.estado === 'conectado'

  // ── Configuración de web pública ──
  const [webLoading, setWebLoading] = useState(true)
  const [webSaving, setWebSaving]   = useState(false)
  const [logoUrl, setLogoUrl]       = useState(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [portada, setPortada]       = useState([])
  const [portadaUploading, setPortadaUploading] = useState(false)
  const [tituloPagina, setTituloPagina] = useState('')
  const [extension, setExtension]   = useState('')
  const [colorPrincipal, setColorPrincipal]       = useState('')
  const [colorSecundario, setColorSecundario]     = useState('')
  const [colorAcentuaciones, setColorAcentuaciones] = useState('')
  const [sobreNosotros, setSobreNosotros] = useState('')
  const [email, setEmail]           = useState('')
  const [whatsapp, setWhatsapp]     = useState('')
  const [telefono, setTelefono]     = useState('')
  const [coordenadas, setCoordenadas] = useState('')
  const [redes, setRedes]           = useState([])
  const [snackMsg, setSnackMsg]     = useState('')
  const [webError, setWebError]     = useState(null)

  useEffect(() => {
    if (!clienteId) return
    getClienteConfig(clienteId)
      .then(data => {
        setLogoUrl(data.logo_url ?? null)
        setPortada(Array.isArray(data.portada_urls) ? data.portada_urls : [])
        setTituloPagina(data.titulo_pagina ?? '')
        setExtension(data.extension ?? '')
        setColorPrincipal(data.color_principal ?? '')
        setColorSecundario(data.color_secundario ?? '')
        setColorAcentuaciones(data.color_acentuaciones ?? '')
        setSobreNosotros(data.sobre_nosotros ?? '')
        setEmail(data.email_contacto ?? '')
        setWhatsapp(data.whatsapp ?? '')
        setTelefono(data.telefono ?? '')
        setCoordenadas(data.coordenadas ?? '')
        setRedes(Array.isArray(data.redes_sociales) ? data.redes_sociales : [])
      })
      .catch(err => setWebError(err.message))
      .finally(() => setWebLoading(false))
  }, [clienteId])

  async function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    setWebError(null)
    try {
      const url = await uploadClienteLogo(clienteId, file)
      setLogoUrl(url)
    } catch (err) {
      setWebError(err.message)
    } finally {
      setLogoUploading(false)
    }
  }

  async function handlePortadaAdd(e) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const disponibles = 5 - portada.length
    const toUpload = files.slice(0, disponibles)
    setPortadaUploading(true)
    setWebError(null)
    try {
      const urls = await Promise.all(toUpload.map(f => uploadPortadaImage(clienteId, f)))
      setPortada(prev => [...prev, ...urls])
    } catch (err) {
      setWebError(err.message)
    } finally {
      setPortadaUploading(false)
    }
  }

  async function handlePortadaRemove(url) {
    setPortada(prev => prev.filter(u => u !== url))
    try { await deletePortadaImage(url) } catch { /* silencioso */ }
  }

  function addRedSocial() {
    if (redes.length >= MAX_REDES) return
    setRedes(prev => [...prev, { ...RED_SOCIAL_EMPTY }])
  }

  function updateRedSocial(i, field, value) {
    setRedes(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  function removeRedSocial(i) {
    setRedes(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSaveWeb() {
    setWebSaving(true)
    setWebError(null)
    const slug = extension.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    try {
      await updateClienteConfig(clienteId, {
        logo_url:            logoUrl,
        portada_urls:        portada,
        titulo_pagina:       tituloPagina.trim() || null,
        extension:           slug || null,
        color_principal:     colorPrincipal.trim() || null,
        color_secundario:    colorSecundario.trim() || null,
        color_acentuaciones: colorAcentuaciones.trim() || null,
        sobre_nosotros:      sobreNosotros.trim() || null,
        email_contacto:      email.trim() || null,
        whatsapp:            whatsapp.trim() || null,
        telefono:            telefono.trim() || null,
        coordenadas:         coordenadas.trim() || null,
        redes_sociales:      redes.filter(r => r.tipo && r.valor.trim()),
      })
      setExtension(slug)
      setSnackMsg('Configuración guardada correctamente.')
    } catch (err) {
      if (err.code === '23505') {
        setWebError('Esa extensión ya está en uso. Elegí otro nombre.')
      } else {
        setWebError(err.message)
      }
    } finally {
      setWebSaving(false)
    }
  }

  return (
    <Box sx={{ pb: 6, maxWidth: 720 }}>
      {/* Header */}
      <Box mb={4}>
        <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          Configuración de la cuenta
        </Typography>
        <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF', mt: 0.5 }}>
          Administrá las integraciones y preferencias de tu cuenta
        </Typography>
      </Box>

      {/* Sección: Integraciones */}
      <Box mb={5}>
        <SectionTitle>Integraciones</SectionTitle>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <IntegrationCard
            logo={<WhatsAppIcon sx={{ fontSize: 22, color: waConnected ? '#25D366' : '#9CA3AF' }} />}
            name="WhatsApp"
            description={waConnected ? `Conectado${waSesion?.numero ? ` (${waSesion.numero})` : ''}` : 'Escaneá un código QR para conectar tu número'}
            connected={waConnected}
            loading={waBusy}
            onToggle={() => (waConnected ? handleDisconnectWa() : handleOpenWaDialog())}
          />

          <IntegrationCard
            logo={<PaymentIcon sx={{ fontSize: 22, color: mpConnected ? '#009EE3' : '#9CA3AF' }} />}
            name="Mercado Pago"
            description={mpConnected ? `Conectado${mpNickname ? ` (${mpNickname})` : ''}` : 'Conectá tu cuenta para cobrar expensas online'}
            connected={mpConnected}
            loading={mpLoading}
            onToggle={handleMpToggle}
          />

          <IntegrationCard
            logo={<LanguageIcon sx={{ fontSize: 22, color: '#9CA3AF' }} />}
            name="MercadoLibre"
            description="Próximamente disponible"
            connected={false}
            loading={false}
            onToggle={() => {}}
          />

          <IntegrationCard
            logo={<LanguageIcon sx={{ fontSize: 22, color: '#9CA3AF' }} />}
            name="ZonaProp"
            description="Próximamente disponible"
            connected={false}
            loading={false}
            onToggle={() => {}}
          />
        </Box>
      </Box>

      {/* Sección: Configuración de web pública */}
      <Box mb={5}>
        <SectionTitle>Configuración de web pública</SectionTitle>

        {webLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={24} sx={{ color: ACCENT }} />
          </Box>
        ) : (
          <Box sx={{ bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', p: 3 }}>

            {webError && <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px', fontSize: '0.82rem' }}>{webError}</Alert>}

            {/* ── Personalización del sitio web público ── */}
            <SubsectionTitle sx={{ mt: 0 }}>Personalización del sitio web público</SubsectionTitle>

            {/* Logo */}
            <Label>Logo de la inmobiliaria</Label>
            <Box display="flex" alignItems="center" gap={2} mb={0.75}>
              <Box sx={{
                width: 64, height: 64, borderRadius: '10px', flexShrink: 0,
                bgcolor: '#F9FAFB', border: '1px solid #E5E7EB',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
                {logoUploading ? (
                  <CircularProgress size={20} sx={{ color: ACCENT }} />
                ) : logoUrl ? (
                  <Box component="img" src={logoUrl} alt="Logo" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <CloudUploadIcon sx={{ fontSize: 24, color: '#D1D5DB' }} />
                )}
              </Box>
              <Button
                component="label"
                variant="outlined"
                disabled={logoUploading}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', borderColor: '#E5E7EB', color: '#374151', '&:hover': { borderColor: '#D1D5DB', bgcolor: '#F9FAFB' } }}
              >
                {logoUrl ? 'Cambiar logo' : 'Subir logo'}
                <input type="file" hidden accept=".png,.svg,.jpeg,.jpg,image/png,image/svg+xml,image/jpeg" onChange={handleLogoChange} />
              </Button>
            </Box>
            <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF', mb: 2.5 }}>
              Recomendamos subir el logo en formato PNG o SVG.
            </Typography>

            {/* Portada */}
            <Label>Portada</Label>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 0.5 }}>
              {portada.map((url, i) => (
                <Box key={i} sx={{ position: 'relative', width: 110, height: 80, borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                  <Box component="img" src={url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <IconButton
                    size="small"
                    onClick={() => handlePortadaRemove(url)}
                    sx={{
                      position: 'absolute', top: 3, right: 3,
                      bgcolor: 'rgba(0,0,0,0.45)', color: 'white', p: '2px',
                      '&:hover': { bgcolor: 'rgba(239,68,68,0.85)' },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Box>
              ))}

              {portada.length < 5 && (
                <Box
                  component="label"
                  sx={{
                    width: 110, height: 80, borderRadius: '8px', flexShrink: 0,
                    border: '1.5px dashed #D1D5DB', bgcolor: '#F9FAFB',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: portadaUploading ? 'default' : 'pointer', gap: 0.5,
                    '&:hover': { borderColor: ACCENT, bgcolor: '#ECFDF5' },
                    transition: 'all 0.15s',
                  }}
                >
                  {portadaUploading ? (
                    <CircularProgress size={18} sx={{ color: ACCENT }} />
                  ) : (
                    <>
                      <AddIcon sx={{ fontSize: 18, color: '#9CA3AF' }} />
                      <Typography sx={{ fontSize: '0.62rem', color: '#9CA3AF' }}>Agregar</Typography>
                    </>
                  )}
                  <input
                    type="file" hidden multiple
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    disabled={portadaUploading}
                    onChange={handlePortadaAdd}
                  />
                </Box>
              )}
            </Box>
            <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF', mb: 2.5 }}>
              Hasta 5 imágenes. Se mostrarán en la página pública de tu inmobiliaria.
            </Typography>

            {/* Título de página */}
            <Label>Título de página</Label>
            <TextField
              fullWidth size="small"
              placeholder="Ej: Inmobiliaria Del Sur"
              value={tituloPagina}
              onChange={e => setTituloPagina(e.target.value.slice(0, 20))}
              sx={{ ...fieldSx, mb: 0.5 }}
              inputProps={{ maxLength: 20 }}
              InputProps={{
                endAdornment: (
                  <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF', whiteSpace: 'nowrap', pr: 0.5 }}>
                    {tituloPagina.length}/20
                  </Typography>
                ),
              }}
            />
            <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF', mb: 2.5 }}>
              Nombre que aparece en la pestaña del navegador y en el encabezado del sitio.
            </Typography>

            {/* Extensión */}
            <Label>Extensión</Label>
            <TextField
              fullWidth size="small"
              placeholder="mi-inmobiliaria"
              value={extension}
              onChange={e => setExtension(e.target.value)}
              sx={{ ...fieldSx, mb: 0.5 }}
              inputProps={{ maxLength: 60 }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2.5 }}>
              <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF' }}>
                URL pública: <span style={{ color: '#374151', fontWeight: 600 }}>
                  app.granito.com.ar/inmobiliaria/{extension.trim() || '<extension>'}
                </span>
              </Typography>
              <IconButton
                size="small"
                onClick={() => {
                  navigator.clipboard.writeText(`https://app.granito.com.ar/inmobiliaria/${extension.trim()}`)
                  setSnackMsg('URL copiada al portapapeles')
                }}
                disabled={!extension.trim()}
                sx={{ p: 0.4 }}
              >
                <ContentCopyIcon sx={{ fontSize: 14, color: '#9CA3AF' }} />
              </IconButton>
            </Box>

            {/* Colores */}
            <Label>Colores</Label>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 2.5 }}>
              <ColorPicker label="Color principal"   value={colorPrincipal}     onChange={setColorPrincipal} />
              <ColorPicker label="Color secundario"  value={colorSecundario}    onChange={setColorSecundario} />
              <ColorPicker label="Acentuaciones"     value={colorAcentuaciones} onChange={setColorAcentuaciones} />
            </Box>

            {/* ── Información del sitio ── */}
            <Box sx={{ borderTop: '1px solid #F3F4F6', pt: 2.5, mt: 1 }}>

              {/* Sobre la inmobiliaria */}
              <Label>Sobre la inmobiliaria</Label>
              <TextField
                fullWidth multiline rows={4} size="small"
                placeholder="Contanos sobre la inmobiliaria, su experiencia y los servicios que ofrece..."
                value={sobreNosotros}
                onChange={e => setSobreNosotros(e.target.value)}
                sx={{ ...fieldSx, mb: 1 }}
              />

              {/* Datos de contacto */}
              <SubsectionTitle>Datos de contacto</SubsectionTitle>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 1 }}>
                <Box>
                  <Label>Mail</Label>
                  <TextField fullWidth size="small" type="email" value={email} onChange={e => setEmail(e.target.value)} sx={fieldSx} />
                </Box>
                <Box>
                  <Label>WhatsApp</Label>
                  <TextField fullWidth size="small" placeholder="264 1234567" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} sx={fieldSx} />
                </Box>
                <Box>
                  <Label>Teléfono fijo/celular</Label>
                  <TextField fullWidth size="small" value={telefono} onChange={e => setTelefono(e.target.value)} sx={fieldSx} />
                </Box>
                <Box>
                  <Label>Coordenadas</Label>
                  <TextField fullWidth size="small" placeholder="Ej: -31.5375, -68.5364" value={coordenadas} onChange={e => setCoordenadas(e.target.value)} sx={fieldSx} />
                </Box>
              </Box>

              {/* Redes sociales */}
              <SubsectionTitle>Redes sociales</SubsectionTitle>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 1 }}>
                {redes.map((red, i) => (
                  <Box key={i} display="flex" gap={1.5} alignItems="flex-start">
                    <FormControl size="small" sx={{ ...fieldSx, width: 160, flexShrink: 0 }}>
                      <InputLabel>Tipo</InputLabel>
                      <Select label="Tipo" value={red.tipo} onChange={e => updateRedSocial(i, 'tipo', e.target.value)}>
                        {RED_SOCIAL_TIPOS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <TextField
                      fullWidth size="small" placeholder="URL o usuario"
                      value={red.valor}
                      onChange={e => updateRedSocial(i, 'valor', e.target.value)}
                      sx={fieldSx}
                    />
                    <IconButton size="small" onClick={() => removeRedSocial(i)} sx={{ color: '#9CA3AF', flexShrink: 0, mt: 0.25, '&:hover': { color: '#EF4444' } }}>
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                ))}

                {redes.length < MAX_REDES && (
                  <Button
                    onClick={addRedSocial}
                    startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                    sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', color: ACCENT, '&:hover': { bgcolor: '#ECFDF5' } }}
                  >
                    Agregar red social
                  </Button>
                )}
              </Box>
            </Box>

            {/* Guardar */}
            <Box display="flex" justifyContent="flex-end" mt={3}>
              <Button
                variant="contained"
                onClick={handleSaveWeb}
                disabled={webSaving}
                startIcon={webSaving ? <CircularProgress size={14} color="inherit" /> : null}
                sx={{ bgcolor: ACCENT, borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', boxShadow: 'none', '&:hover': { bgcolor: '#047857', boxShadow: 'none' } }}
              >
                {webSaving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      <Snackbar
        open={!!snackMsg}
        autoHideDuration={3000}
        onClose={() => setSnackMsg('')}
        message={snackMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <Dialog open={waDialogOpen} onClose={handleCloseWaDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Conectar WhatsApp</DialogTitle>
        <DialogContent>
          {waError && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px', fontSize: '0.82rem' }}>{waError}</Alert>}

          {waSesion?.estado === 'conectado' ? (
            <Typography sx={{ fontSize: '0.85rem', color: '#374151', textAlign: 'center', py: 3 }}>
              Conectado correctamente{waSesion.numero ? ` (${waSesion.numero})` : ''}.
            </Typography>
          ) : waTimedOut ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography sx={{ fontSize: '0.82rem', color: '#9CA3AF', mb: 2 }}>
                El código QR expiró. Volvé a intentarlo.
              </Typography>
              <Button
                variant="outlined"
                onClick={handleOpenWaDialog}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, borderColor: '#E5E7EB', color: '#374151' }}
              >
                Reintentar
              </Button>
            </Box>
          ) : waSesion?.qr ? (
            <Box sx={{ textAlign: 'center' }}>
              <Box component="img" src={waSesion.qr} alt="Código QR de WhatsApp" sx={{ width: 220, height: 220, mx: 'auto', display: 'block' }} />
              <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', mt: 2 }}>
                Abrí WhatsApp en tu teléfono, entrá a Dispositivos vinculados y escaneá este código.
              </Typography>
            </Box>
          ) : (
            <Box display="flex" justifyContent="center" py={5}>
              <CircularProgress size={24} sx={{ color: ACCENT }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseWaDialog} sx={{ textTransform: 'none', color: '#6B7280' }}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
