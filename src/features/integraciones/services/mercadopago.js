import { supabase } from '../../../shared/services/supabaseClient'

export async function getMpToken(cliente_id) {
  const { data, error } = await supabase
    .from('mp_tokens')
    .select('mp_user_id')
    .eq('cliente_id', cliente_id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function testMercadoPago(cliente_id) {
  const { data, error } = await supabase.functions.invoke('mp-test', { body: { cliente_id } })
  if (error) throw error
  return data
}

export async function disconnectMercadoPago(cliente_id) {
  const { error } = await supabase
    .from('mp_tokens')
    .delete()
    .eq('cliente_id', cliente_id)
  if (error) throw error
}

export async function crearPreferenciaPago({ token, dni, periodos_ids }) {
  const { data, error } = await supabase.functions.invoke('mp-crear-preferencia', {
    body: { token, dni, periodos_ids },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}
