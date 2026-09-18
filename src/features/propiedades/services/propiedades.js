import { supabase } from '../../../shared/services/supabaseClient'

// ---- PROPIEDADES ----

export async function getPropiedades({ includeBaja = false, includeVendida = false, cliente_id, estado } = {}) {
  let query = supabase
    .from('propiedades')
    .select('*')
    .eq('cliente_id', cliente_id)
    .order('created_at', { ascending: false })
  if (!includeBaja) query = query.neq('estado', 'Baja')
  if (!includeVendida) query = query.neq('estado', 'Vendida')
  if (estado) query = query.eq('estado', estado)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createPropiedad(data) {
  const { data: result, error } = await supabase
    .from('propiedades')
    .insert([data])
    .select()
    .single()
  if (error) throw error
  return result
}

export async function updatePropiedad(id, data) {
  const { data: result, error } = await supabase
    .from('propiedades')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return result
}

// ---- PROPIEDADES IMAGENES ----

const IMAGE_BUCKET = 'propiedades-imagenes'

export function getPublicImageUrl(storagePath) {
  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

export async function uploadClienteLogo(clienteId, file) {
  const ext = file.name.split('.').pop()
  const path = `logos/${clienteId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  return getPublicImageUrl(path)
}

export async function uploadPortadaImage(clienteId, file) {
  const ext = file.name.split('.').pop()
  const path = `portada/${clienteId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  return getPublicImageUrl(path)
}

export async function deletePortadaImage(url) {
  const marker = '/propiedades-imagenes/'
  const idx = url.indexOf(marker)
  if (idx === -1) return
  const path = url.slice(idx + marker.length)
  await supabase.storage.from(IMAGE_BUCKET).remove([path])
}

export async function getClienteConfig(cliente_id) {
  const { data, error } = await supabase
    .from('clientes_servicio')
    .select('id, nombre, logo_url, portada_urls, titulo_pagina, extension, color_principal, color_secundario, color_acentuaciones, sobre_nosotros, email_contacto, whatsapp, telefono, direccion, coordenadas, redes_sociales')
    .eq('id', cliente_id)
    .single()
  if (error) throw error
  return data
}

export async function updateClienteConfig(cliente_id, payload) {
  const { data, error } = await supabase
    .from('clientes_servicio')
    .update(payload)
    .eq('id', cliente_id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function uploadPropiedadImagen(clienteId, propiedadId, file) {
  const ext = file.name.split('.').pop()
  const path = `${clienteId}/${propiedadId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file)
  if (error) throw error
  return path
}

export async function insertPropiedadImagenes(propiedadId, paths) {
  const rows = paths.map((storage_path, i) => ({ propiedad_id: propiedadId, storage_path, orden: i }))
  const { error } = await supabase.from('propiedades_imagenes').insert(rows)
  if (error) throw error
}

export async function getPropiedadImagenes(propiedadId) {
  const { data, error } = await supabase
    .from('propiedades_imagenes')
    .select('id, storage_path, orden')
    .eq('propiedad_id', propiedadId)
    .order('orden')
  if (error) throw error
  return data ?? []
}

export async function deletePropiedadImagen(id, storagePath) {
  await supabase.storage.from(IMAGE_BUCKET).remove([storagePath])
  const { error } = await supabase.from('propiedades_imagenes').delete().eq('id', id)
  if (error) throw error
}

export async function darDeBajaPropiedad(id) {
  const { data, error } = await supabase
    .from('propiedades')
    .update({ estado: 'Baja', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function reactivarPropiedad(id) {
  const { data, error } = await supabase
    .from('propiedades')
    .update({ estado: 'Disponible', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- PROPIEDADES PÚBLICAS (sin auth) ----

export async function getPropiedadPublica(id) {
  const { data, error } = await supabase
    .from('propiedades_publicas')
    .select('*')
    .eq('id', id)
    .neq('estado', 'Baja')
    .single()
  if (error) throw error
  return data
}

export async function registrarVisitaPropiedad(propiedadId) {
  const { error } = await supabase.rpc('increment_propiedad_visitas', { p_id: propiedadId })
  if (error) throw error
}

export async function getMetricasPropiedad(propiedadId) {
  const [
    { data: prop, error: propErr },
    { count: consultas, error: consultasErr },
    { count: visitasFisicas, error: visitasErr },
  ] = await Promise.all([
    supabase.from('propiedades').select('visitas_count').eq('id', propiedadId).single(),
    supabase.from('consultas_web').select('*', { count: 'exact', head: true }).eq('propiedad_id', propiedadId),
    supabase.from('visitas').select('*', { count: 'exact', head: true }).eq('propiedad_id', propiedadId),
  ])
  if (propErr) throw propErr
  if (consultasErr) throw consultasErr
  if (visitasErr) throw visitasErr
  return {
    visitasWeb: prop?.visitas_count ?? 0,
    consultas: consultas ?? 0,
    visitasFisicas: visitasFisicas ?? 0,
  }
}

const CLIENTE_PUBLICO_FIELDS = 'id, nombre, logo_url, portada_urls, titulo_pagina, color_principal, color_secundario, color_acentuaciones, sobre_nosotros, email_contacto, whatsapp, telefono, coordenadas, redes_sociales, extension'

export async function getClientePublico(slugOrId) {
  // 1) intentar por extensión (slug personalizado) — case-insensitive, la
  // extensión se guarda tal cual la tipeó el admin en Configuracion.jsx
  const { data: porSlug, error: e1 } = await supabase
    .from('clientes_servicio')
    .select(CLIENTE_PUBLICO_FIELDS)
    .ilike('extension', slugOrId)
    .maybeSingle()
  if (e1) throw e1
  if (porSlug) return porSlug

  // 2) fallback: buscar por UUID (si no es un UUID, ni siquiera intentamos —
  // Postgres tira 22P02 en vez de "no encontrado" para un valor no-UUID)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(slugOrId)) return null

  const { data: porId, error: e2 } = await supabase
    .from('clientes_servicio')
    .select(CLIENTE_PUBLICO_FIELDS)
    .eq('id', slugOrId)
    .maybeSingle()
  if (e2) throw e2
  return porId
}

export async function getPropiedadesPublicas(cliente_id) {
  const { data, error } = await supabase
    .from('propiedades_publicas')
    .select('id, titulo, tipo_propiedad, tipo_operacion, precio_publicacion, moneda, direccion, localidad, provincia, ambientes, dormitorios, banios, metros_cubiertos, metros_totales, created_at')
    .eq('cliente_id', cliente_id)
    .neq('estado', 'Baja')
    .neq('estado', 'Vendida')
    .neq('estado', 'Alquilada')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getImagenesPrincipales(propiedadIds) {
  if (!propiedadIds.length) return {}
  const { data, error } = await supabase
    .from('propiedades_imagenes')
    .select('propiedad_id, storage_path, orden')
    .in('propiedad_id', propiedadIds)
    .order('orden')
  if (error) throw error
  const map = {}
  ;(data ?? []).forEach(row => {
    if (!(row.propiedad_id in map)) map[row.propiedad_id] = getPublicImageUrl(row.storage_path)
  })
  return map
}

const PROVINCIAS_VALIDAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán',
]
const TIPOS_PROPIEDAD_VALIDOS = ['Casa', 'Departamento', 'Terreno', 'Local', 'Oficina', 'Otro']

export async function crearPropiedadDesdeContrato({
  cliente_id, contacto_locador_id, direccion, localidad, provincia, tipo_propiedad, moneda, monto_base,
}) {
  const propiedad = await createPropiedad({
    cliente_id,
    titulo: `${tipo_propiedad || 'Propiedad'} en alquiler${direccion ? ` - ${direccion}` : localidad ? ` - ${localidad}` : ''}`,
    direccion: direccion || null,
    localidad: localidad || null,
    provincia: PROVINCIAS_VALIDAS.includes(provincia) ? provincia : 'San Juan',
    tipo_propiedad: TIPOS_PROPIEDAD_VALIDOS.includes(tipo_propiedad) ? tipo_propiedad : 'Otro',
    tipo_operacion: 'Alquiler',
    metros_cubiertos: null,
    metros_totales: null,
    ambientes: null,
    dormitorios: null,
    banios: null,
    descripcion: 'Propiedad generada automáticamente a partir de la carga de un contrato.',
    observaciones_internas: null,
    precio_publicacion: Number(monto_base),
    moneda: moneda === 'USD' ? 'USD' : 'ARS',
    estado: 'Alquilada',
  })

  const { error } = await supabase
    .from('contactos_propiedades')
    .insert([{ propiedad_id: propiedad.id, contacto_id: contacto_locador_id, tipo: 'Locador' }])
  if (error) throw error

  return propiedad
}

export async function sugerirPropiedadesPorContacto({
  clienteId, tipoPropiedad, tipoOperacion, zonaInteres, presupuesto, moneda, excluirIds = [],
}) {
  let q = supabase
    .from('propiedades')
    .select('id, titulo, localidad, tipo_propiedad, tipo_operacion, precio_publicacion, moneda, estado')
    .eq('cliente_id', clienteId)
    .eq('estado', 'Disponible')

  if (tipoPropiedad?.length)    q = q.in('tipo_propiedad', tipoPropiedad)
  if (tipoOperacion)            q = q.eq('tipo_operacion', tipoOperacion)
  if (zonaInteres?.length)      q = q.in('localidad', zonaInteres)
  if (presupuesto) {
    q = q.eq('moneda', moneda).lte('precio_publicacion', Number(presupuesto) * 1.2)
  }

  const { data, error } = await q
  if (error) throw error

  const excluir = new Set(excluirIds)
  return (data ?? [])
    .filter(p => !excluir.has(p.id))
    .map(p => ({
      ...p,
      sobre_presupuesto: presupuesto ? Number(p.precio_publicacion) > Number(presupuesto) : false,
    }))
}
