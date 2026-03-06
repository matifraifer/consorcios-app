import { createContext, useContext, useState } from 'react'
import { loginWithSupabase } from '../services/supabase'

const AuthContext = createContext(null)

const STORAGE_KEY = 'consorcio_user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function login(username, password) {
    setLoading(true)
    setError(null)
    try {
      const result = await loginWithSupabase(username, password)
      if (result) {
        setUser(result)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result))
        return true
      } else {
        setError('Usuario o contraseña incorrectos')
        return false
      }
    } catch (err) {
      setError('Error de conexion. Intente nuevamente.')
      return false
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
