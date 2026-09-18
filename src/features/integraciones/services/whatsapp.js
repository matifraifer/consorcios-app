import { supabase } from '../../../shared/services/supabaseClient'

const WHATSAPP_SERVICE_URL = import.meta.env.VITE_WHATSAPP_SERVICE_URL

async function whatsappAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }
}

async function whatsappRequest(path, options) {
  const res = await fetch(`${WHATSAPP_SERVICE_URL}${path}`, {
    ...options,
    headers: await whatsappAuthHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Error al comunicarse con el servicio de WhatsApp')
  return data
}

export async function getWhatsappSesion(cliente_id) {
  const { data, error } = await supabase
    .from('whatsapp_sesiones')
    .select('*')
    .eq('cliente_id', cliente_id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function connectWhatsapp(cliente_id) {
  return whatsappRequest(`/sessions/${cliente_id}/connect`, { method: 'POST' })
}

export async function disconnectWhatsapp(cliente_id) {
  return whatsappRequest(`/sessions/${cliente_id}/disconnect`, { method: 'POST' })
}

export async function sendWhatsappMensaje(cliente_id, telefono, body) {
  return whatsappRequest(`/sessions/${cliente_id}/send`, {
    method: 'POST',
    body: JSON.stringify({ telefono, body }),
  })
}

export async function getWhatsappMensajes(cliente_id) {
  const { data, error } = await supabase
    .from('whatsapp_mensajes')
    .select('*')
    .eq('cliente_id', cliente_id)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function marcarMensajesWhatsappLeidos(ids) {
  if (!ids?.length) return
  const { error } = await supabase
    .from('whatsapp_mensajes')
    .update({ leido: true })
    .in('id', ids)
  if (error) throw error
}
