import { supabase } from '../../../shared/services/supabaseClient'

// ---- CONSULTA DE DEUDA PÚBLICA (sin auth) ----

// Valida email + unidad del lado del servidor (RPC security definer) y
// devuelve los datos para calcular el saldo, o null si no coincide.
export async function getPortalDniExiste(clienteId, dni) {
  const { data, error } = await supabase
    .rpc('portal_dni_existe', { p_cliente_id: clienteId, p_dni: dni })
  if (error) throw error
  return data
}

export async function getPortalExpensasToken(token, dni) {
  const { data, error } = await supabase
    .rpc('portal_expensas_token', { p_token: token, p_dni: dni })
  if (error) throw error
  return data
}

export async function getPortalExpensasDni(clienteId, dni) {
  const { data, error } = await supabase
    .rpc('portal_expensas_dni', { p_cliente_id: clienteId, p_dni: dni })
  if (error) throw error
  return data
}

export async function getPortalAlquilerToken(token, dni) {
  const { data, error } = await supabase
    .rpc('portal_alquiler_token', { p_token: token, p_dni: dni })
  if (error) throw error
  return data
}

export async function getPortalAlquilerDni(clienteId, dni) {
  const { data, error } = await supabase
    .rpc('portal_alquiler_dni', { p_cliente_id: clienteId, p_dni: dni })
  if (error) throw error
  return data
}

export async function enviarLinkConsultaDeuda(departamento_id) {
  const { data, error } = await supabase.functions.invoke('enviar-link-consulta', { body: { departamento_id } })
  if (error) throw error
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
  return data
}

export async function extraerDatosContrato(texto) {
  const { data, error } = await supabase.functions.invoke('extraer-contrato-ia', { body: { texto } })
  if (error) throw error
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
  return data.data
}

export async function enviarLiquidacionWhatsapp(consorcio_id) {
  const { data, error } = await supabase.functions.invoke('enviar-liquidacion-whatsapp', { body: { consorcio_id } })
  if (error) throw error
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
  return data
}

export async function enviarLiquidacionEmail(periodo_id) {
  const { data, error } = await supabase.functions.invoke('enviar-liquidacion-email', { body: { periodo_id } })
  if (error) throw error
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
  return data
}

// Log de errores del portal público (sin login, sin forma de saber si algo
// rompe salvo que quede registrado). Nunca tira — si falla el insert, no
// queremos que eso rompa la UI encima del error original.
export async function logPortalError(ruta, contexto, error, detalle = {}) {
  try {
    await supabase.from('portal_error_logs').insert({
      ruta,
      contexto,
      mensaje: error?.message ?? String(error),
      detalle,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
  } catch {
    // noop
  }
}

// Buscador del selector /portal: solo nombre + slug, nunca la ficha completa,
// y solo trae resultados a partir de que el visitante tipea (no lista todo).
// Usa una RPC (en vez de ilike directo) para ignorar acentos/ñ en la búsqueda.
export async function buscarClientesPortal(query) {
  const { data, error } = await supabase
    .rpc('portal_buscar_clientes', { p_query: query })
  if (error) throw error
  return data
}
