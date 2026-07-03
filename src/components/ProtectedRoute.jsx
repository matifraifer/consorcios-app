import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute() {
  const { user, initializing, mustChangePassword } = useAuth()
  if (initializing) return null
  if (!user) return <Navigate to="/login" replace />
  if (mustChangePassword) return <Navigate to="/cambiar-password" replace />
  return <Outlet />
}
