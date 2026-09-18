import { supabase } from '../../../shared/services/supabaseClient'
import { compareNumeracion } from '../../../shared/utils/compareNumeracion'

// ---- PERIODOS EXPENSAS ----

export async function getPeriodos(cliente_id) {
  const { data, error } = await supabase
    .from('periodos_expensas')
    .select('*, consorcios(nombre), gastos(monto)')
    .eq('cliente_id', cliente_id)
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })
  if (error) throw error
  return data
}

export async function getPeriodosByConsorcio(consorcio_id) {
  const { data, error } = await supabase
    .from('periodos_expensas')
    .select('*, gastos(monto)')
    .eq('consorcio_id', consorcio_id)
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

export async function createPeriodo({ consorcio_id, mes, anio, cliente_id, usuario_id, fecha_vencimiento }) {
  const { data, error } = await supabase
    .from('periodos_expensas')
    .insert([{ consorcio_id, mes, anio, estado: 'abierto', cliente_id, usuario_id, fecha_vencimiento: fecha_vencimiento || null }])
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

export async function createGasto({ periodo_id, nombre, monto, categoria, tipo, proveedor, comprobante, departamentos_ids }) {
  const { data, error } = await supabase
    .from('gastos')
    .insert([{
      periodo_id, nombre, monto, categoria, tipo,
      proveedor: proveedor || null,
      comprobante: comprobante || null,
      departamentos_ids: departamentos_ids?.length ? departamentos_ids : null,
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateGasto(id, { nombre, monto, categoria, tipo, proveedor, comprobante, departamentos_ids }) {
  const { data, error } = await supabase
    .from('gastos')
    .update({
      nombre, monto, categoria, tipo,
      proveedor: proveedor || null,
      comprobante: comprobante || null,
      departamentos_ids: departamentos_ids?.length ? departamentos_ids : null,
    })
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
    .select('id, numeracion, coeficiente, propietario_nombre, propietario_apellido, activo, email')
    .eq('id_consorcio', consorcio_id)
  if (error) throw error
  return data.sort(compareNumeracion)
}

// "Eliminar" una unidad funcional no borra el registro (queda como dato
// histórico de expensas/reclamos) — solo la inactiva. false = inactiva
// (se oculta de la grilla y del selector de gastos), true = reactivarla.
export async function setDepartamentoActivo(id, activo) {
  const { data, error } = await supabase
    .from('departamentos')
    .update({ activo })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getDashboardDeuda(cliente_id) {
  const { data: periodos, error: perErr } = await supabase
    .from('periodos_expensas')
    .select('id, mes, anio, consorcio_id, consorcios(id, nombre)')
    .eq('cliente_id', cliente_id)
    .eq('estado', 'cerrado')
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })
  if (perErr) throw perErr
  if (!periodos.length) return { items: [], periodos: [] }

  const periodoIds = periodos.map(p => p.id)

  const { data: expensas, error: expErr } = await supabase
    .from('expensas_departamento')
    .select('id, periodo_id, departamento_id, monto_total, monto_pagado, pagado, departamentos(id, numeracion, inquilino, activo, propietarios(nombre, apellido))')
    .in('periodo_id', periodoIds)
    .eq('pagado', false)
  if (expErr) throw expErr

  const periodoMap = Object.fromEntries(periodos.map(p => [p.id, p]))

  const items = expensas
    .map(e => ({
      ...e,
      periodo: periodoMap[e.periodo_id],
      saldo: Math.max(0, Number(e.monto_total ?? 0) - Number(e.monto_pagado ?? 0)),
    }))
    .filter(e => e.saldo > 0)

  return { items, periodos }
}

// Total de unidades funcionales activas del cliente (todas las unidades de
// todos sus consorcios, sin importar si tienen o no deuda) — usada junto a
// getDashboardDeuda para armar el resumen "con deuda / sin deuda" del home.
export async function getTotalDepartamentosActivos(cliente_id) {
  const { data: consorcios, error: consError } = await supabase
    .from('consorcios')
    .select('id')
    .eq('cliente_id', cliente_id)
  if (consError) throw consError

  const ids = consorcios.map((c) => c.id)
  if (ids.length === 0) return 0

  const { data, error } = await supabase
    .from('departamentos')
    .select('id, activo')
    .in('id_consorcio', ids)
  if (error) throw error
  return data.filter(d => d.activo !== false).length
}

export async function getExpensasPendientes(cliente_id) {
  const { data: periodos, error: periodosError } = await supabase
    .from('periodos_expensas')
    .select('id')
    .eq('cliente_id', cliente_id)
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

export async function getLiquidacionesConsorcio(consorcio_id) {
  const [{ data: departamentos, error: depErr }, { data: periodos, error: perErr }] = await Promise.all([
    supabase
      .from('departamentos')
      .select('id, numeracion, inquilino, token_consulta, propietario_nombre, propietario_apellido, activo')
      .eq('id_consorcio', consorcio_id),
    supabase
      .from('periodos_expensas')
      .select('id, mes, anio, fecha_vencimiento')
      .eq('consorcio_id', consorcio_id)
      .eq('estado', 'cerrado')
      .order('anio', { ascending: false })
      .order('mes', { ascending: false }),
  ])
  if (depErr) throw depErr
  if (perErr) throw perErr
  departamentos.sort(compareNumeracion)

  const periodoIds = periodos.map(p => p.id)
  let expensas = []
  if (periodoIds.length > 0) {
    const { data, error } = await supabase
      .from('expensas_departamento')
      .select('id, periodo_id, departamento_id, monto_total, monto_pagado, pagado')
      .in('periodo_id', periodoIds)
    if (error) throw error
    expensas = data
  }

  return { departamentos, periodos, expensas }
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
