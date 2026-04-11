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

export async function getPropietariosConDetalle(id_consorcio) {
  const { data, error } = await supabase
    .from('propietarios')
    .select('id, nombre, apellido, dni, departamentos(numeracion)')
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

export async function importarPropietarios(filas, id_consorcio) {
  // Traer departamentos del consorcio para poder vincular por numeracion
  const { data: deptos, error: dErr } = await supabase
    .from('departamentos')
    .select('id, numeracion')
    .eq('id_consorcio', id_consorcio)
  if (dErr) throw dErr

  const deptoMap = Object.fromEntries(
    deptos.map(d => [d.numeracion.trim().toLowerCase(), d.id])
  )

  const resultados = []
  for (const fila of filas) {
    try {
      // Parsear nombre y apellido desde el campo "Propietario"
      let nombre, apellido
      if (fila.propietario.includes(',')) {
        const [ap, nom] = fila.propietario.split(',').map(s => s.trim())
        apellido = ap
        nombre = nom || ''
      } else {
        const parts = fila.propietario.trim().split(/\s+/)
        apellido = parts[0] ?? ''
        nombre = parts.slice(1).join(' ')
      }

      const { data: prop, error: pErr } = await supabase
        .from('propietarios')
        .insert([{ nombre, apellido, dni: fila.dni, id_consorcio }])
        .select()
        .single()
      if (pErr) throw pErr

      // Vincular al departamento; si no existe, crearlo
      let deptoId = deptoMap[fila.unidad.trim().toLowerCase()]
      let deptoCreado = false
      if (deptoId) {
        await supabase
          .from('departamentos')
          .update({ id_propietario: prop.id })
          .eq('id', deptoId)
      } else if (fila.unidad.trim()) {
        const { data: nuevoDep, error: depErr } = await supabase
          .from('departamentos')
          .insert([{ numeracion: fila.unidad.trim(), id_consorcio, id_propietario: prop.id }])
          .select()
          .single()
        if (depErr) throw depErr
        deptoMap[fila.unidad.trim().toLowerCase()] = nuevoDep.id
        deptoId = nuevoDep.id
        deptoCreado = true
      }

      resultados.push({ ...fila, ok: true, vinculado: !!deptoId, deptoCreado })
    } catch (err) {
      resultados.push({ ...fila, ok: false, error: err.message })
    }
  }
  return resultados
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
    .select('id, numeracion, coeficiente, propietarios(nombre, apellido)')
    .eq('id_consorcio', consorcio_id)
    .order('numeracion', { ascending: true })
  if (error) throw error
  return data
}

export async function getDashboardDeuda(usuario_id) {
  const { data: periodos, error: perErr } = await supabase
    .from('periodos_expensas')
    .select('id, mes, anio, consorcio_id, consorcios(id, nombre)')
    .eq('usuario_id', usuario_id)
    .eq('estado', 'cerrado')
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })
  if (perErr) throw perErr
  if (!periodos.length) return { items: [], periodos: [] }

  const periodoIds = periodos.map(p => p.id)

  const { data: expensas, error: expErr } = await supabase
    .from('expensas_departamento')
    .select('id, periodo_id, departamento_id, monto_total, monto_pagado, pagado, departamentos(id, numeracion, inquilino, propietarios(nombre, apellido))')
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

// ---- CRM PROSPECTOS ----

export async function getEtapasCRM() {
  const { data, error } = await supabase.from('etapas_crm').select('*').order('orden')
  if (error) throw error
  return data
}

export async function getProspectos({ tipo_operacion, includeCierreNegativo = false }) {
  const { data, error } = await supabase
    .from('prospectos')
    .select('*, propiedades(id, titulo, precio_publicacion, moneda)')
    .eq('tipo_operacion', tipo_operacion)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.filter(p => {
    if (!p.cerrado) return true
    if (p.cerrado && p.cierre_exitoso === false && includeCierreNegativo) return true
    return false
  })
}

export async function createProspecto(data) {
  const { data: result, error } = await supabase
    .from('prospectos').insert([data])
    .select('*, propiedades(id, titulo)').single()
  if (error) throw error
  return result
}

export async function updateProspectoEtapa(id, etapa_id) {
  const { error } = await supabase
    .from('prospectos')
    .update({ etapa_id, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function cerrarProspecto(id, exitoso, propiedad_id = null) {
  const { error } = await supabase
    .from('prospectos')
    .update({ cerrado: true, cierre_exitoso: exitoso, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  if (exitoso && propiedad_id) {
    const { error: pErr } = await supabase
      .from('propiedades')
      .update({ estado: 'Vendida', updated_at: new Date().toISOString() })
      .eq('id', propiedad_id)
    if (pErr) throw pErr
  }
}

export async function getVisitasByProspecto(prospecto_id) {
  const { data, error } = await supabase
    .from('visitas')
    .select('*, propiedades(id, titulo, direccion, localidad)')
    .eq('prospecto_id', prospecto_id)
    .order('fecha').order('hora')
  if (error) throw error
  return data
}

export async function createVisita({ prospecto_id, propiedad_id, fecha, hora }) {
  const { data, error } = await supabase
    .from('visitas')
    .insert([{ prospecto_id, propiedad_id, fecha, hora }])
    .select('*, propiedades(id, titulo, direccion, localidad)').single()
  if (error) throw error
  return data
}

export async function deleteVisita(id) {
  const { error } = await supabase.from('visitas').delete().eq('id', id)
  if (error) throw error
}

export async function getPropiedadesInteresByProspecto(prospecto_id) {
  const { data, error } = await supabase
    .from('propiedades_interes')
    .select('*, propiedades(id, titulo, precio_publicacion, moneda, localidad)')
    .eq('prospecto_id', prospecto_id)
  if (error) throw error
  return data
}

export async function addPropiedadInteres({ prospecto_id, propiedad_id }) {
  const { data, error } = await supabase
    .from('propiedades_interes')
    .insert([{ prospecto_id, propiedad_id }])
    .select('*, propiedades(id, titulo, precio_publicacion, moneda, localidad)').single()
  if (error) throw error
  return data
}

export async function updatePropiedadInteres(id, { monto_propuesto, forma_pago }) {
  const { data, error } = await supabase
    .from('propiedades_interes')
    .update({ monto_propuesto: monto_propuesto || null, forma_pago: forma_pago || null })
    .eq('id', id)
    .select('*, propiedades(id, titulo, precio_publicacion, moneda, localidad)').single()
  if (error) throw error
  return data
}

export async function deletePropiedadInteres(id) {
  const { error } = await supabase.from('propiedades_interes').delete().eq('id', id)
  if (error) throw error
}

// ---- PROPIEDADES ----

export async function getPropiedades({ includeBaja = false } = {}) {
  let query = supabase
    .from('propiedades')
    .select('*')
    .order('created_at', { ascending: false })
  if (!includeBaja) query = query.neq('estado', 'Baja')
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
