import { createContext, useContext, useEffect, useState } from 'react'
import {
  supabase, signInWithEmail, signOutSupabase, getUsuarioByAuthId,
  resolveEmailForUsername, updateUserPassword,
} from '../services/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    async function resolveSession(session) {
      if (!session) {
        if (active) {
          setUser(null)
          setMustChangePassword(false)
        }
        return
      }
      const perfil = await getUsuarioByAuthId(session.user.id)
      if (active) {
        setUser(perfil)
        // Por default se exige cambio de contraseña; solo se salta si el
        // metadata dice explícitamente must_change_password: false.
        setMustChangePassword(session.user.user_metadata?.must_change_password !== false)
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      resolveSession(data.session).finally(() => {
        if (active) setInitializing(false)
      })
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveSession(session)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function login(username, password) {
    setLoading(true)
    setError(null)
    try {
      const email = await resolveEmailForUsername(username)
      if (!email) {
        setError('Usuario o contraseña incorrectos')
        return false
      }
      const authUser = await signInWithEmail(email, password)
      const perfil = await getUsuarioByAuthId(authUser.id)
      if (!perfil) {
        setError('Este usuario no tiene un perfil asociado')
        await signOutSupabase()
        return false
      }
      setUser(perfil)
      setMustChangePassword(authUser.user_metadata?.must_change_password !== false)
      return true
    } catch {
      setError('Usuario o contraseña incorrectos')
      return false
    } finally {
      setLoading(false)
    }
  }

  async function changePassword(newPassword) {
    await updateUserPassword(newPassword)
    setMustChangePassword(false)
  }

  async function logout() {
    await signOutSupabase()
    setUser(null)
    setMustChangePassword(false)
  }

  const clienteId = user?.cliente_id ?? null

  return (
    <AuthContext.Provider value={{
      user, clienteId, login, logout, loading, error, initializing,
      mustChangePassword, changePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
