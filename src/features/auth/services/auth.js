import { supabase } from '../../../shared/services/supabaseClient'

export async function resolveEmailForUsername(username) {
  const { data, error } = await supabase.functions.invoke('resolve-username', { body: { username } })
  if (error) throw error
  return data.email
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

export async function signOutSupabase() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function requestPasswordReset(username) {
  const email = await resolveEmailForUsername(username)
  if (!email) return
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/cambiar-password`,
  })
  if (error) throw error
}

export async function updateUserPassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
    data: { must_change_password: false },
  })
  if (error) throw error
  return data.user
}

export async function getUsuarioByAuthId(authUserId) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre_usuario, rol, cliente_id, clientes_servicio(nombre)')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (error || !data) return null

  return {
    id: data.id,
    nombre_usuario: data.nombre_usuario,
    rol: data.rol,
    cliente_id: data.cliente_id,
    cliente_nombre: data.clientes_servicio?.nombre ?? null,
  }
}

export async function getUsuarios(cliente_id) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre_usuario, rol')
    .eq('cliente_id', cliente_id)
    .order('nombre_usuario')
  if (error) throw error
  return data
}
