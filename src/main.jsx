import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import App from './App.jsx'
import { AuthProvider } from './features/auth/AuthContext.jsx'
import theme from './theme'

// Después de un deploy, una pestaña abierta con la versión anterior puede pedir un chunk
// que ya no existe al entrar a una página que todavía no había cargado. Vite emite
// vite:preloadError: se recarga para tomar la versión nueva. Si vuelve a fallar en menos
// de 10 segundos no se recarga otra vez (evita un loop si el problema es otro).
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'chunk-reload-at'
  let ultima = 0
  try { ultima = Number(sessionStorage.getItem(KEY)) || 0 } catch { /* storage bloqueado */ }
  if (Date.now() - ultima < 10000) return
  event.preventDefault()
  try { sessionStorage.setItem(KEY, String(Date.now())) } catch { /* storage bloqueado */ }
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
