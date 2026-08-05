import { supabaseAdmin } from '../supabaseAdmin.js'

// El frontend no tiene la service-role key: manda el access_token de la
// sesión del usuario logueado. Acá se valida ese token y se confirma que
// el cliente_id del usuario coincide con el :clienteId de la URL, imitando
// el mismo límite que RLS aplica del lado de la base.
export async function requireClienteAccess(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'No autenticado' })

  const { data: perfil } = await supabaseAdmin
    .from('usuarios')
    .select('cliente_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!perfil || perfil.cliente_id !== req.params.clienteId) {
    return res.status(403).json({ error: 'No autorizado para este cliente' })
  }

  next()
}
