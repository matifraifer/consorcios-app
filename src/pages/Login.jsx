import { useState, useEffect, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Box, TextField, Button, Typography, Alert, CircularProgress, GlobalStyles } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'

const loginStyles = (
  <GlobalStyles styles={`
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;900&display=swap');

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes lineGrow {
      from { width: 0; }
      to   { width: 40px; }
    }
    @keyframes gridPulse {
      0%, 100% { opacity: 0.06; }
      50%       { opacity: 0.13; }
    }
    @keyframes floatDot {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-10px); }
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0; }
    }
    .typewriter-cursor {
      display: inline-block;
      width: 3px;
      height: 0.85em;
      background: rgba(255,255,255,0.7);
      margin-left: 4px;
      vertical-align: middle;
      border-radius: 1px;
      animation: blink 0.85s step-end infinite;
    }

    .login-field input {
      color: #1A1A18 !important;
      font-family: 'Poppins', sans-serif !important;
      font-size: 14px !important;
    }
    .login-field label {
      color: #9CA3AF !important;
      font-family: 'Poppins', sans-serif !important;
      font-size: 13px !important;
    }
    .login-field label.Mui-focused {
      color: #065F46 !important;
    }
    .login-field .MuiOutlinedInput-root fieldset {
      border-color: #E5E5E0 !important;
      border-width: 1.5px !important;
      transition: border-color 0.2s;
    }
    .login-field .MuiOutlinedInput-root:hover fieldset {
      border-color: #C8C8C0 !important;
    }
    .login-field .MuiOutlinedInput-root.Mui-focused fieldset {
      border-color: #065F46 !important;
    }
    .login-field .MuiOutlinedInput-root {
      background: #FAFAF8 !important;
      border-radius: 8px !important;
    }
    .login-field input:-webkit-autofill,
    .login-field input:-webkit-autofill:hover,
    .login-field input:-webkit-autofill:focus {
      -webkit-box-shadow: 0 0 0px 1000px #FAFAF8 inset !important;
      -webkit-text-fill-color: #1A1A18 !important;
    }

    .submit-btn {
      background: #065F46 !important;
      color: #ffffff !important;
      font-family: 'Poppins', sans-serif !important;
      font-weight: 600 !important;
      font-size: 13px !important;
      letter-spacing: 0.1em !important;
      text-transform: uppercase !important;
      border-radius: 8px !important;
      height: 52px;
      transition: background 0.2s, transform 0.15s, box-shadow 0.2s !important;
      box-shadow: none !important;
    }
    .submit-btn:hover:not(:disabled) {
      background: #047857 !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 10px 28px rgba(6,95,70,0.25) !important;
    }
    .submit-btn:active {
      transform: translateY(0px) !important;
    }
    .submit-btn:disabled {
      background: #D1FAE5 !important;
      color: #6EE7B7 !important;
    }
  `} />
)

const WORDS = ['edificios', 'casas', 'departamentos', 'locales', 'terrenos']
const TYPING_SPEED = 80
const ERASING_SPEED = 45
const PAUSE_AFTER_TYPE = 1800
const PAUSE_AFTER_ERASE = 300

function useTypewriter(words) {
  const [displayed, setDisplayed] = useState(words[0])
  const [wordIndex, setWordIndex] = useState(0)
  const [phase, setPhase] = useState('pause') // 'typing' | 'pausing' | 'erasing' | 'pause'
  const [charIndex, setCharIndex] = useState(words[0].length)
  const timeout = useRef(null)

  useEffect(() => {
    if (phase === 'pause') {
      timeout.current = setTimeout(() => setPhase('erasing'), PAUSE_AFTER_TYPE)
    } else if (phase === 'erasing') {
      if (charIndex === 0) {
        timeout.current = setTimeout(() => {
          const next = (wordIndex + 1) % words.length
          setWordIndex(next)
          setPhase('typing')
        }, PAUSE_AFTER_ERASE)
      } else {
        timeout.current = setTimeout(() => {
          const next = charIndex - 1
          setCharIndex(next)
          setDisplayed(words[wordIndex].slice(0, next))
        }, ERASING_SPEED)
      }
    } else if (phase === 'typing') {
      const target = words[wordIndex]
      if (charIndex === target.length) {
        timeout.current = setTimeout(() => setPhase('pause'), PAUSE_AFTER_TYPE)
      } else {
        timeout.current = setTimeout(() => {
          const next = charIndex + 1
          setCharIndex(next)
          setDisplayed(target.slice(0, next))
        }, TYPING_SPEED)
      }
    }
    return () => clearTimeout(timeout.current)
  }, [phase, charIndex, wordIndex, words])

  // reset charIndex when wordIndex changes (after erase)
  useEffect(() => {
    setCharIndex(0)
  }, [wordIndex])

  return displayed
}

export default function Login() {
  const { user, login, loading, error } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const cyclingWord = useTypewriter(WORDS)

  if (user) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    const success = await login(username, password)
    if (success) navigate('/dashboard', { replace: true })
  }

  return (
    <>
      {loginStyles}
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          bgcolor: '#F7F7F4',
          fontFamily: "'Poppins', sans-serif",
          overflow: 'hidden',
        }}
      >
        {/* Left panel — brand (verde) */}
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'space-between',
            p: '52px 56px',
            position: 'relative',
            bgcolor: '#065F46',
            overflow: 'hidden',
          }}
        >
          {/* Grid sutil */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)
              `,
              backgroundSize: '52px 52px',
              animation: 'gridPulse 6s ease-in-out infinite',
            }}
          />

          {/* Blob de luz */}
          <Box
            sx={{
              position: 'absolute',
              width: 480,
              height: 480,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)',
              top: -120,
              right: -120,
              pointerEvents: 'none',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              width: 360,
              height: 360,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
              bottom: -80,
              left: -60,
              pointerEvents: 'none',
            }}
          />

          {/* Puntos flotantes */}
          {[
            { top: '28%', left: '20%', size: 5, delay: '0s' },
            { top: '45%', left: '75%', size: 3, delay: '1.4s' },
            { top: '65%', left: '35%', size: 4, delay: '0.7s' },
            { top: '20%', left: '60%', size: 3, delay: '2s' },
          ].map((dot, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                top: dot.top,
                left: dot.left,
                width: dot.size,
                height: dot.size,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.3)',
                animation: `floatDot 4s ease-in-out ${dot.delay} infinite`,
              }}
            />
          ))}

          {/* Logo */}
          <Box sx={{ position: 'relative', zIndex: 1, animation: 'fadeUp 0.7s ease both' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Box sx={{ width: 13, height: 13, bgcolor: 'rgba(255,255,255,0.85)', borderRadius: '2px' }} />
              </Box>
              <Typography
                sx={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: 12,
                  letterSpacing: '0.2em',
                  color: 'rgba(255,255,255,0.55)',
                  textTransform: 'uppercase',
                }}
              >
                Consorcios
              </Typography>
            </Box>
          </Box>

          {/* Headline central */}
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 2,
                bgcolor: 'rgba(255,255,255,0.35)',
                mb: 3,
                animation: 'lineGrow 0.8s 0.3s ease both',
              }}
            />
            <Typography
              sx={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 900,
                fontSize: 'clamp(34px, 3.5vw, 52px)',
                lineHeight: 1.1,
                color: '#ffffff',
                mb: 2.5,
                animation: 'fadeUp 0.8s 0.2s ease both',
                opacity: 0,
                animationFillMode: 'both',
              }}
            >
              Gestión<br />
              <Box component="span" sx={{ color: 'rgba(255,255,255,0.45)' }}>inteligente</Box><br />
              de{' '}
              <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                {cyclingWord}
                <Box component="span" className="typewriter-cursor" />
                
              </Box>
            </Typography>
            <Typography
              sx={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 300,
                fontSize: 13.5,
                color: 'rgba(255,255,255,0.45)',
                lineHeight: 1.75,
                maxWidth: 280,
                animation: 'fadeUp 0.8s 0.4s ease both',
                opacity: 0,
                animationFillMode: 'both',
              }}
            >
              Administracion de consorcios,<br />expensas, propietarios<br />y contratos en un solo lugar.
            </Typography>
          </Box>

          {/* Footer */}
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              animation: 'fadeUp 0.8s 0.6s ease both',
              opacity: 0,
              animationFillMode: 'both',
            }}
          >
            <Typography
              sx={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: 11,
                color: 'rgba(255,255,255,0.2)',
                letterSpacing: '0.06em',
              }}
            >
              v1.0 — plataforma privada
            </Typography>
          </Box>
        </Box>

        {/* Right panel — formulario */}
        <Box
          sx={{
            width: { xs: '100%', md: 480 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            px: { xs: 4, sm: 6, md: 7 },
            py: 8,
            position: 'relative',
            bgcolor: '#ffffff',
            boxShadow: { md: '-8px 0 40px rgba(0,0,0,0.06)' },
          }}
        >
          {/* Linea acento superior */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #065F46 0%, #34D399 100%)',
            }}
          />

          <Box
            sx={{
              animation: 'fadeUp 0.7s 0.15s ease both',
              opacity: 0,
              animationFillMode: 'both',
            }}
          >
            {/* Logo mobile */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mb: 5 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  border: '2px solid #065F46',
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Box sx={{ width: 10, height: 10, bgcolor: '#065F46', borderRadius: '2px' }} />
              </Box>
              <Typography
                sx={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: 12,
                  letterSpacing: '0.18em',
                  color: '#9CA3AF',
                  textTransform: 'uppercase',
                }}
              >
                Consorcios
              </Typography>
            </Box>

            <Typography
              sx={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 700,
                fontSize: 27,
                color: '#111110',
                mb: 0.5,
                letterSpacing: '-0.01em',
              }}
            >
              Bienvenido
            </Typography>
            <Typography
              sx={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 400,
                fontSize: 13.5,
                color: '#9CA3AF',
                mb: 5,
              }}
            >
              Ingrese sus credenciales para continuar
            </Typography>

            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 3,
                  bgcolor: '#FEF2F2',
                  color: '#B91C1C',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  fontSize: 13,
                  fontFamily: "'Poppins', sans-serif",
                  '& .MuiAlert-icon': { color: '#EF4444' },
                }}
              >
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Box sx={{ mb: 2.5 }}>
                <Typography
                  sx={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#6B7280',
                    mb: 0.8,
                  }}
                >
                  Usuario
                </Typography>
                <TextField
                  className="login-field"
                  fullWidth
                  placeholder="nombre de usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  size="small"
                  label=""
                  InputLabelProps={{ shrink: false }}
                  sx={{ '& .MuiInputBase-input::placeholder': { color: '#C4C4BC', opacity: 1 } }}
                />
              </Box>

              <Box sx={{ mb: 4 }}>
                <Typography
                  sx={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#6B7280',
                    mb: 0.8,
                  }}
                >
                  Contrasena
                </Typography>
                <TextField
                  className="login-field"
                  type="password"
                  fullWidth
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  size="small"
                  label=""
                  InputLabelProps={{ shrink: false }}
                  sx={{ '& .MuiInputBase-input::placeholder': { color: '#C4C4BC', opacity: 1 } }}
                />
              </Box>

              <Button
                className="submit-btn"
                type="submit"
                fullWidth
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} sx={{ color: '#6EE7B7' }} /> : null}
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </form>
          </Box>

          {/* Watermark */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 24,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Typography
              sx={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: 11,
                color: '#D1D5DB',
                letterSpacing: '0.04em',
              }}
            >
              acceso restringido — solo personal autorizado
            </Typography>
          </Box>
        </Box>
      </Box>
    </>
  )
}
