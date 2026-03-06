import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ---- AUTH ----

export async function loginWithSupabase(username, password) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre_usuario, rol, password')
    .eq('nombre_usuario', username)
    .single()

  if (error || !data) return null
  if (data.password !== password) return null

  return { id: data.id, nombre_usuario: data.nombre_usuario, rol: data.rol }
}

// ---- CONSORCIOS ----

export async function getConsorcios(id_administrador) {
  const { data, error } = await supabase
    .from('consorcios')
    .select('id, nombre, usuarios(nombre_usuario)')
    .eq('id_administrador', id_administrador)
    .order('nombre', { ascending: true })
  if (error) throw error
  return data
}

export async function getConsorcioById(id) {
  const { data, error } = await supabase
    .from('consorcios')
    .select('id, nombre, usuarios(nombre_usuario)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createConsorcio({ nombre, id_administrador }) {
  const { data, error } = await supabase
    .from('consorcios')
    .insert([{ nombre, id_administrador }])
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- DEPARTAMENTOS ----

export async function getDepartamentos(id_administrador) {
  const { data: consorcios, error: consError } = await supabase
    .from('consorcios')
    .select('id')
    .eq('id_administrador', id_administrador)
  if (consError) throw consError

  const ids = consorcios.map((c) => c.id)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('departamentos')
    .select('id, numeracion, inquilino, propietarios(nombre, apellido), consorcios(nombre)')
    .in('id_consorcio', ids)
    .order('numeracion', { ascending: true })
  if (error) throw error
  return data
}

export async function getDepartamentosByConsorcio(id_consorcio) {
  const { data, error } = await supabase
    .from('departamentos')
    .select('*, propietarios(nombre, apellido)')
    .eq('id_consorcio', id_consorcio)
    .order('numeracion', { ascending: true })
  if (error) throw error
  return data
}

export async function createDepartamento({ numeracion, inquilino, id_propietario, id_consorcio, coeficiente }) {
  const { data, error } = await supabase
    .from('departamentos')
    .insert([{ numeracion, inquilino, id_propietario: id_propietario || null, id_consorcio, coeficiente: coeficiente || null }])
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- PROPIETARIOS ----

export async function getPropietarios(id_administrador) {
  const { data: consorcios, error: consError } = await supabase
    .from('consorcios')
    .select('id')
    .eq('id_administrador', id_administrador)
  if (consError) throw consError

  const ids = consorcios.map((c) => c.id)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('propietarios')
    .select('id, nombre, apellido, dni, consorcios(nombre), departamentos(numeracion)')
    .in('id_consorcio', ids)
    .order('apellido', { ascending: true })
  if (error) throw error
  return data
}

export async function getPropietariosByConsorcio(id_consorcio) {
  const { data, error } = await supabase
    .from('propietarios')
    .select('id, nombre, apellido')
    .eq('id_consorcio', id_consorcio)
    .order('apellido', { ascending: true })
  if (error) throw error
  return data
}

export async function createPropietario({ dni, nombre, apellido, id_consorcio }) {
  const { data, error } = await supabase
    .from('propietarios')
    .insert([{ dni, nombre, apellido, id_consorcio }])
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- RECLAMOS ----

export async function getReclamos(usuario_id) {
  const { data, error } = await supabase
    .from('reclamos')
    .select('id, descripcion, estado, fecha, propietarios(nombre, apellido), consorcios(nombre), departamentos(numeracion)')
    .eq('usuario_id', usuario_id)
    .order('fecha', { ascending: false })
  if (error) throw error
  return data
}

export async function getReclamoById(id) {
  const { data, error } = await supabase
    .from('reclamos')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createReclamo({ propietario_id, consorcio_id, departamento_id, descripcion, estado, fecha, usuario_id }) {
  const { data, error } = await supabase
    .from('reclamos')
    .insert([{ propietario_id, consorcio_id, departamento_id, descripcion, estado, fecha, usuario_id }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateReclamo(id, { propietario_id, consorcio_id, departamento_id, descripcion, estado, fecha }) {
  const { data, error } = await supabase
    .from('reclamos')
    .update({ propietario_id, consorcio_id, departamento_id, descripcion, estado, fecha })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- PERIODOS EXPENSAS ----

export async function getPeriodos(usuario_id) {
  const { data, error } = await supabase
    .from('periodos_expensas')
    .select('*, consorcios(nombre), gastos(monto)')
    .eq('usuario_id', usuario_id)
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })
  if (error) throw error
  return data
}

export async function getPeriodoById(id) {
  const { data, error } = await supabase
    .from('periodos_expensas')
    .select('*, consorcios(nombre)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createPeriodo({ consorcio_id, mes, anio, usuario_id }) {
  const { data, error } = await supabase
    .from('periodos_expensas')
    .insert([{ consorcio_id, mes, anio, estado: 'abierto', usuario_id }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function closePeriodo(id) {
  const { data, error } = await supabase
    .from('periodos_expensas')
    .update({ estado: 'cerrado' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- GASTOS ----

export async function getGastosByPeriodo(periodo_id) {
  const { data, error } = await supabase
    .from('gastos')
    .select('*')
    .eq('periodo_id', periodo_id)
    .order('id', { ascending: true })
  if (error) throw error
  return data
}

export async function createGasto({ periodo_id, nombre, monto, categoria, tipo, proveedor, comprobante }) {
  const { data, error } = await supabase
    .from('gastos')
    .insert([{ periodo_id, nombre, monto, categoria, tipo, proveedor: proveedor || null, comprobante: comprobante || null }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateGasto(id, { nombre, monto, categoria, tipo, proveedor, comprobante }) {
  const { data, error } = await supabase
    .from('gastos')
    .update({ nombre, monto, categoria, tipo, proveedor: proveedor || null, comprobante: comprobante || null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteGasto(id) {
  const { error } = await supabase.from('gastos').delete().eq('id', id)
  if (error) throw error
}

// ---- EXPENSAS DEPARTAMENTO ----

export async function getDepartamentosConCoeficiente(consorcio_id) {
  const { data, error } = await supabase
    .from('departamentos')
    .select('id, numeracion, coeficiente, propietarios(nombre, apellido)')
    .eq('id_consorcio', consorcio_id)
    .order('numeracion', { ascending: true })
  if (error) throw error
  return data
}

export async function getExpensasPendientes(usuario_id) {
  const { data: periodos, error: periodosError } = await supabase
    .from('periodos_expensas')
    .select('id')
    .eq('usuario_id', usuario_id)
    .eq('estado', 'cerrado')
  if (periodosError) throw periodosError
  if (!periodos.length) return []

  const periodoIds = periodos.map(p => p.id)
  const { data, error } = await supabase
    .from('expensas_departamento')
    .select('id, monto_total, departamentos(numeracion), periodos_expensas(mes, anio, consorcios(nombre))')
    .in('periodo_id', periodoIds)
    .eq('pagado', false)
  if (error) throw error
  return data
}

export async function getExpensasDepartamento(periodo_id) {
  const { data, error } = await supabase
    .from('expensas_departamento')
    .select('id, departamento_id, pagado, monto_pagado')
    .eq('periodo_id', Number(periodo_id))
  if (error) throw error
  return data
}

export async function registrarPago(id, { pagado, monto_pagado }) {
  const { data, error } = await supabase
    .from('expensas_departamento')
    .update({ pagado, monto_pagado: monto_pagado ?? null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function saveExpensasDepartamento(periodo_id, items) {
  const { error: deleteError } = await supabase
    .from('expensas_departamento')
    .delete()
    .eq('periodo_id', Number(periodo_id))
  if (deleteError) throw deleteError
  if (items.length === 0) return []
  const { data, error } = await supabase
    .from('expensas_departamento')
    .insert(items)
    .select()
  if (error) throw error
  return data
}
