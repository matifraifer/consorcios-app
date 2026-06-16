import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, CircularProgress, TextField, Select, MenuItem,
  FormControl, InputLabel, InputAdornment, Slider, IconButton,
} from '@mui/material'
import SearchIcon      from '@mui/icons-material/Search'
import ApartmentIcon   from '@mui/icons-material/Apartment'
import LocationOnIcon  from '@mui/icons-material/LocationOn'
import WhatsAppIcon    from '@mui/icons-material/WhatsApp'
import ChevronLeftIcon  from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import InstagramIcon   from '@mui/icons-material/Instagram'
import LanguageIcon    from '@mui/icons-material/Language'
import LinkIcon        from '@mui/icons-material/Link'
import { getClientePublico, getPropiedadesPublicas, getImagenesPrincipales } from '../services/supabase'

const FALLBACK_PRIMARY   = '#065F46'
const FALLBACK_SECONDARY = '#047857'
const TIPOS = ['Casa', 'Departamento', 'Terreno', 'Local', 'Oficina']

function fmt(value, moneda) {
  if (!value) return null
  const n = Number(value).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return moneda ? `${moneda} ${n}` : n
}

function fmtSlider(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`
  return String(v)
}

function makeFieldSx(primary) {
  return {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px', bgcolor: 'white', fontSize: '0.875rem',
      '& fieldset': { borderColor: '#E5E7EB' },
      '&:hover fieldset': { borderColor: primary },
      '&.Mui-focused fieldset': { borderColor: primary, borderWidth: '1.5px' },
    },
    '& .MuiInputLabel-root.Mui-focused': { color: primary },
  }
}

function SocialIcon({ tipo }) {
  if (tipo === 'Instagram') return <InstagramIcon sx={{ fontSize: 20 }} />
  if (tipo === 'Página web') return <LanguageIcon sx={{ fontSize: 20 }} />
  return <LinkIcon sx={{ fontSize: 20 }} />
}

function NavButton({ label, secondary, onClick }) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        background: 'none', border: 'none', cursor: 'pointer',
        px: 1.5, py: 0.75, borderRadius: '6px',
        fontSize: '0.82rem', fontWeight: 600, color: '#374151',
        fontFamily: 'inherit', transition: 'all 0.15s',
        '&:hover': { bgcolor: secondary, color: 'white' },
      }}
    >
      {label}
    </Box>
  )
}

function Carousel({ images }) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused]   = useState(false)

  useEffect(() => {
    if (images.length <= 1 || paused) return
    const id = setInterval(() => setCurrent(c => (c + 1) % images.length), 4500)
    return () => clearInterval(id)
  }, [images.length, paused])

  if (!images.length) return null

  return (
    <Box
      sx={{ position: 'relative', width: '100%', height: { xs: 280, md: 520 }, overflow: 'hidden', bgcolor: '#111' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {images.map((src, i) => (
        <Box key={i} component="img" src={src} alt=""
          sx={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
            opacity: i === current ? 1 : 0, transition: 'opacity 0.7s ease',
          }}
        />
      ))}

      {images.length > 1 && (
        <>
          <IconButton
            onClick={() => setCurrent(c => (c - 1 + images.length) % images.length)}
            sx={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(255,255,255,0.18)', color: 'white', backdropFilter: 'blur(6px)', '&:hover': { bgcolor: 'rgba(255,255,255,0.32)' } }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <IconButton
            onClick={() => setCurrent(c => (c + 1) % images.length)}
            sx={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(255,255,255,0.18)', color: 'white', backdropFilter: 'blur(6px)', '&:hover': { bgcolor: 'rgba(255,255,255,0.32)' } }}
          >
            <ChevronRightIcon />
          </IconButton>
          <Box sx={{ position: 'absolute', bottom: 20, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 1 }}>
            {images.map((_, i) => (
              <Box key={i} onClick={() => setCurrent(i)}
                sx={{ width: i === current ? 24 : 8, height: 8, borderRadius: '4px', bgcolor: i === current ? 'white' : 'rgba(255,255,255,0.45)', cursor: 'pointer', transition: 'all 0.3s' }}
              />
            ))}
          </Box>
        </>
      )}
    </Box>
  )
}

function PropiedadCard({ p, image, primary, secondary, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <Box
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '14px',
        overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s',
        '&:hover': { boxShadow: '0 8px 24px rgba(0,0,0,0.1)', transform: 'translateY(-2px)' },
      }}
    >
      <Box sx={{ position: 'relative', width: '100%', height: 200, bgcolor: '#F3F4F6' }}>
        {image ? (
          <Box component="img" src={image} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ApartmentIcon sx={{ fontSize: 36, color: '#D1D5DB' }} />
          </Box>
        )}
        <Box sx={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 0.75 }}>
          {p.tipo_operacion && (
            <Box sx={{ bgcolor: 'rgba(255,255,255,0.92)', borderRadius: '6px', px: 1, py: 0.3 }}>
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: primary }}>{p.tipo_operacion}</Typography>
            </Box>
          )}
          {p.tipo_propiedad && (
            <Box sx={{ bgcolor: 'rgba(255,255,255,0.92)', borderRadius: '6px', px: 1, py: 0.3 }}>
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#374151' }}>{p.tipo_propiedad}</Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ p: 2 }}>
        <Typography noWrap sx={{ fontSize: '0.92rem', fontWeight: 700, color: hovered ? secondary : primary, transition: 'color 0.15s', mb: 0.4 }}>
          {p.titulo}
        </Typography>
        <Box display="flex" alignItems="center" gap={0.5} mb={1.25}>
          <LocationOnIcon sx={{ fontSize: 13, color: '#9CA3AF', flexShrink: 0 }} />
          <Typography noWrap sx={{ fontSize: '0.78rem', color: '#9CA3AF' }}>
            {[p.localidad, p.provincia].filter(Boolean).join(', ') || 'Sin ubicación'}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', mb: 1.25 }}>
          {fmt(p.precio_publicacion, p.moneda) ?? 'Consultar precio'}
        </Typography>
        <Box display="flex" gap={1.5} sx={{ borderTop: '1px solid #F3F4F6', pt: 1.25 }}>
          {p.ambientes   && <Typography sx={{ fontSize: '0.72rem', color: '#6B7280' }}><b style={{ color: '#374151' }}>{p.ambientes}</b> amb.</Typography>}
          {p.dormitorios && <Typography sx={{ fontSize: '0.72rem', color: '#6B7280' }}><b style={{ color: '#374151' }}>{p.dormitorios}</b> dorm.</Typography>}
          {p.metros_totales && <Typography sx={{ fontSize: '0.72rem', color: '#6B7280' }}><b style={{ color: '#374151' }}>{p.metros_totales}</b> m²</Typography>}
        </Box>
      </Box>
    </Box>
  )
}

export default function InmobiliariaPublica() {
  const { clienteId } = useParams()
  const navigate       = useNavigate()

  const [cliente, setCliente]           = useState(null)
  const [propiedades, setPropiedades]   = useState([])
  const [images, setImages]             = useState({})
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)

  const [search, setSearch]                   = useState('')
  const [filtroOperacion, setFiltroOperacion] = useState('')
  const [filtroTipo, setFiltroTipo]           = useState('')
  const [filtroZona, setFiltroZona]           = useState('')
  const [filtroDorm, setFiltroDorm]           = useState('')
  const [filtroBanios, setFiltroBanios]       = useState('')
  const [precioRange, setPrecioRange]         = useState([0, 0])
  const [globalPrecio, setGlobalPrecio]       = useState([0, 0])

  const sobreRef       = useRef(null)
  const propiedadesRef = useRef(null)

  useEffect(() => {
    getClientePublico(clienteId)
      .then(async cli => {
        if (!cli) { setError('not found'); setLoading(false); return }
        setCliente(cli)
        const props = await getPropiedadesPublicas(cli.id)
        setPropiedades(props)
        const imgs = await getImagenesPrincipales(props.map(p => p.id))
        setImages(imgs)
        const prices = props.map(p => Number(p.precio_publicacion)).filter(n => n > 0)
        if (prices.length) {
          const mn = Math.min(...prices)
          const mx = Math.max(...prices)
          setGlobalPrecio([mn, mx])
          setPrecioRange([mn, mx])
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [clienteId])

  const scrollTo = useCallback(ref => ref.current?.scrollIntoView({ behavior: 'smooth' }), [])

  const handleAlquileres = () => {
    setFiltroOperacion('Alquiler')
    propiedadesRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const PRIMARY   = cliente?.color_principal   || FALLBACK_PRIMARY
  const SECONDARY = cliente?.color_secundario  || FALLBACK_SECONDARY
  const fieldSx   = makeFieldSx(PRIMARY)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return propiedades.filter(p => {
      if (q && !`${p.titulo} ${p.direccion ?? ''} ${p.localidad ?? ''}`.toLowerCase().includes(q)) return false
      if (filtroOperacion && p.tipo_operacion !== filtroOperacion) return false
      if (filtroTipo && p.tipo_propiedad !== filtroTipo) return false
      if (filtroZona && !`${p.localidad ?? ''} ${p.provincia ?? ''}`.toLowerCase().includes(filtroZona.toLowerCase())) return false
      if (filtroDorm) {
        if (filtroDorm === '4+') { if (!p.dormitorios || p.dormitorios < 4) return false }
        else if (p.dormitorios !== Number(filtroDorm)) return false
      }
      if (filtroBanios) {
        if (filtroBanios === '3+') { if (!p.banios || p.banios < 3) return false }
        else if (p.banios !== Number(filtroBanios)) return false
      }
      if (globalPrecio[0] !== globalPrecio[1]) {
        const pr = Number(p.precio_publicacion)
        if (pr > 0 && (pr < precioRange[0] || pr > precioRange[1])) return false
      }
      return true
    })
  }, [propiedades, search, filtroOperacion, filtroTipo, filtroZona, filtroDorm, filtroBanios, precioRange, globalPrecio])

  const waNumber = (cliente?.whatsapp || '').replace(/\D/g, '')
  const waUrl    = waNumber ? `https://wa.me/549${waNumber}` : null
  const mapsUrl  = cliente?.coordenadas
    ? `https://maps.google.com/maps?q=${encodeURIComponent(cliente.coordenadas)}&z=15&output=embed`
    : null

  if (loading) {
    return (
      <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor="#F8FAFC">
        <CircularProgress sx={{ color: FALLBACK_PRIMARY }} />
      </Box>
    )
  }

  if (error || !cliente) {
    return (
      <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor="#F8FAFC">
        <Box textAlign="center" px={3}>
          <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', mb: 1 }}>Inmobiliaria no encontrada</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>Esta página no existe o no está disponible.</Typography>
        </Box>
      </Box>
    )
  }

  const portadaImgs = cliente.portada_urls ?? []

  return (
    <Box minHeight="100vh" bgcolor="#F8FAFC" sx={{ position: 'relative' }}>

      {/* ── Header ── */}
      <Box sx={{
        bgcolor: 'white', borderBottom: '1px solid #E5E7EB',
        px: { xs: 2, md: 4 }, py: 1.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer' }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          {cliente.logo_url ? (
            <Box component="img" src={cliente.logo_url} alt={cliente.nombre} sx={{ height: 36, maxWidth: 140, objectFit: 'contain' }} />
          ) : (
            <>
              <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ApartmentIcon sx={{ fontSize: 17, color: 'white' }} />
              </Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                {cliente.titulo_pagina || cliente.nombre}
              </Typography>
            </>
          )}
        </Box>

        <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.25 }}>
          <NavButton label="Inicio"         secondary={SECONDARY} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
          {cliente.sobre_nosotros && <NavButton label="Sobre nosotros" secondary={SECONDARY} onClick={() => scrollTo(sobreRef)} />}
          <NavButton label="Inmuebles"      secondary={SECONDARY} onClick={() => scrollTo(propiedadesRef)} />
          <NavButton label="Alquileres"     secondary={SECONDARY} onClick={handleAlquileres} />
        </Box>
      </Box>

      {/* ── Portada ── */}
      {portadaImgs.length > 0 ? (
        <Carousel images={portadaImgs} />
      ) : (
        <Box sx={{
          width: '100%', height: { xs: 220, md: 380 },
          background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Box textAlign="center">
            {cliente.logo_url && (
              <Box component="img" src={cliente.logo_url} alt="" sx={{ height: 56, objectFit: 'contain', mb: 2, filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
            )}
            <Typography sx={{ fontSize: { xs: '1.6rem', md: '2.6rem' }, fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>
              {cliente.titulo_pagina || cliente.nombre}
            </Typography>
          </Box>
        </Box>
      )}

      {/* ── Sobre nosotros ── */}
      {cliente.sobre_nosotros && (
        <Box ref={sobreRef} sx={{ bgcolor: 'white', py: { xs: 6, md: 9 }, px: { xs: 3, md: 4 }, borderTop: '1px solid #F3F4F6' }}>
          <Box sx={{ maxWidth: 700, mx: 'auto', textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: PRIMARY, mb: 2 }}>
              Sobre nosotros
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, color: '#374151', lineHeight: 1.85 }}>
              {cliente.sobre_nosotros}
            </Typography>
          </Box>
        </Box>
      )}

      {/* ── Propiedades ── */}
      <Box ref={propiedadesRef} sx={{ maxWidth: 1220, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 5, md: 8 } }}>
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: PRIMARY, mb: 1 }}>
          Propiedades
        </Typography>
        <Typography sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, fontWeight: 800, color: PRIMARY, letterSpacing: '-0.02em', mb: 4 }}>
          Nuestras propiedades
        </Typography>

        {/* Filtros */}
        <Box sx={{ bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '14px', p: 2.5, mb: 4 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            <TextField
              size="small" placeholder="Buscar por título o dirección..."
              value={search} onChange={e => setSearch(e.target.value)}
              sx={{ ...fieldSx, flex: '2 1 220px' }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 17, color: '#9CA3AF' }} /></InputAdornment> }}
            />
            <FormControl size="small" sx={{ ...fieldSx, flex: '1 1 130px' }}>
              <InputLabel>Operación</InputLabel>
              <Select label="Operación" value={filtroOperacion} onChange={e => setFiltroOperacion(e.target.value)}>
                <MenuItem value=""><em style={{ fontStyle: 'normal', color: '#9CA3AF' }}>Todas</em></MenuItem>
                <MenuItem value="Venta">Venta</MenuItem>
                <MenuItem value="Alquiler">Alquiler</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ ...fieldSx, flex: '1 1 140px' }}>
              <InputLabel>Tipo</InputLabel>
              <Select label="Tipo" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                <MenuItem value=""><em style={{ fontStyle: 'normal', color: '#9CA3AF' }}>Todos</em></MenuItem>
                {TIPOS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              size="small" placeholder="Zona / localidad..."
              value={filtroZona} onChange={e => setFiltroZona(e.target.value)}
              sx={{ ...fieldSx, flex: '1 1 150px' }}
            />
            <FormControl size="small" sx={{ ...fieldSx, flex: '1 1 120px' }}>
              <InputLabel>Dormitorios</InputLabel>
              <Select label="Dormitorios" value={filtroDorm} onChange={e => setFiltroDorm(e.target.value)}>
                <MenuItem value=""><em style={{ fontStyle: 'normal', color: '#9CA3AF' }}>Todos</em></MenuItem>
                {['1', '2', '3', '4+'].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ ...fieldSx, flex: '1 1 100px' }}>
              <InputLabel>Baños</InputLabel>
              <Select label="Baños" value={filtroBanios} onChange={e => setFiltroBanios(e.target.value)}>
                <MenuItem value=""><em style={{ fontStyle: 'normal', color: '#9CA3AF' }}>Todos</em></MenuItem>
                {['1', '2', '3+'].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>

          {globalPrecio[0] !== globalPrecio[1] && (
            <Box sx={{ px: 1, pt: 2.5 }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', mb: 1.5 }}>
                Rango de precio:{' '}
                <span style={{ color: PRIMARY, fontWeight: 700 }}>
                  {fmtSlider(precioRange[0])} — {fmtSlider(precioRange[1])}
                </span>
              </Typography>
              <Slider
                value={precioRange}
                onChange={(_, v) => setPrecioRange(v)}
                min={globalPrecio[0]}
                max={globalPrecio[1]}
                valueLabelDisplay="auto"
                valueLabelFormat={fmtSlider}
                sx={{
                  color: PRIMARY,
                  '& .MuiSlider-thumb': { width: 16, height: 16 },
                  '& .MuiSlider-valueLabel': { bgcolor: PRIMARY },
                }}
              />
            </Box>
          )}
        </Box>

        {filtered.length === 0 ? (
          <Box sx={{ bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: '14px', py: 8, textAlign: 'center' }}>
            <ApartmentIcon sx={{ fontSize: 40, color: '#E5E7EB', mb: 1.5 }} />
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151', mb: 0.5 }}>No se encontraron propiedades</Typography>
            <Typography sx={{ fontSize: '0.8rem', color: '#9CA3AF' }}>Probá ajustar los filtros de búsqueda.</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)' }, gap: 2.5 }}>
            {filtered.map(p => (
              <PropiedadCard
                key={p.id} p={p} image={images[p.id]}
                primary={PRIMARY} secondary={SECONDARY}
                onClick={() => navigate(`/p/${p.id}`)}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* ── Donde encontrarnos ── */}
      {mapsUrl && (
        <Box sx={{ bgcolor: 'white', borderTop: '1px solid #E5E7EB' }}>
          <Box sx={{ maxWidth: 1220, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 5, md: 8 } }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: PRIMARY, mb: 1 }}>
              Ubicación
            </Typography>
            <Typography sx={{ fontSize: { xs: '1.4rem', md: '1.8rem' }, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', mb: 3 }}>
              Donde encontrarnos
            </Typography>
            <Box sx={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid #E5E7EB', height: { xs: 280, md: 420 } }}>
              <Box
                component="iframe"
                src={mapsUrl}
                sx={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                allowFullScreen
                loading="lazy"
              />
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Footer ── */}
      <Box sx={{ bgcolor: '#0F172A', color: 'white', py: 5, px: { xs: 3, md: 4 } }}>
        <Box sx={{
          maxWidth: 1220, mx: 'auto',
          display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 3,
        }}>
          <Box>
            {cliente.logo_url ? (
              <Box component="img" src={cliente.logo_url} alt={cliente.nombre}
                sx={{ height: 34, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.85, mb: 1, display: 'block' }}
              />
            ) : (
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'white', mb: 1 }}>
                {cliente.titulo_pagina || cliente.nombre}
              </Typography>
            )}
            <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>
              {cliente.titulo_pagina || cliente.nombre} · {propiedades.length} propiedad{propiedades.length !== 1 ? 'es' : ''} publicada{propiedades.length !== 1 ? 's' : ''}
            </Typography>
          </Box>

          {(cliente.redes_sociales ?? []).length > 0 && (
            <Box sx={{ display: 'flex', gap: 1.25 }}>
              {cliente.redes_sociales.map((red, i) => (
                <Box
                  key={i}
                  component="a"
                  href={red.valor.startsWith('http') ? red.valor : `https://${red.valor}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={red.tipo}
                  sx={{
                    width: 38, height: 38, borderRadius: '10px',
                    bgcolor: 'rgba(255,255,255,0.07)', color: '#9CA3AF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s', textDecoration: 'none',
                    '&:hover': { bgcolor: PRIMARY, color: 'white' },
                  }}
                >
                  <SocialIcon tipo={red.tipo} />
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Botón flotante WhatsApp ── */}
      {waUrl && (
        <Box
          component="a"
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 200,
            width: 54, height: 54, borderRadius: '50%',
            bgcolor: '#25D366', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 18px rgba(37,211,102,0.5)',
            transition: 'transform 0.15s, box-shadow 0.15s',
            '&:hover': { transform: 'scale(1.1)', boxShadow: '0 6px 22px rgba(37,211,102,0.65)' },
          }}
        >
          <WhatsAppIcon sx={{ fontSize: 28 }} />
        </Box>
      )}

    </Box>
  )
}
