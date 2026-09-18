import { supabase } from '../../../shared/services/supabaseClient'
import { compareNumeracion } from '../../../shared/utils/compareNumeracion'

// ---- CONSORCIOS ----

export async function getConsorcios(cliente_id) {
  const { data, error } = await supabase
    .from('consorcios')
    .select('id, nombre')
    .eq('cliente_id', cliente_id)
    .order('nombre', { ascending: true })
  if (error) throw error
  return data
}

export async function getConsorcioById(id) {
  const { data, error } = await supabase
    .from('consorcios')
    .select('id, nombre, tasa_mora')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createConsorcio({ nombre, cliente_id }) {
  const { data, error } = await supabase
    .from('consorcios')
    .insert([{ nombre, cliente_id }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateConsorcio(id, { tasa_mora }) {
  const { data, error } = await supabase
    .from('consorcios')
    .update({ tasa_mora })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- DEPARTAMENTOS ----

export async function getDepartamentos(cliente_id) {
  const { data: consorcios, error: consError } = await supabase
    .from('consorcios')
    .select('id')
    .eq('cliente_id', cliente_id)
  if (consError) throw consError

  const ids = consorcios.map((c) => c.id)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('departamentos')
    .select('id, numeracion, inquilino, propietario_nombre, propietario_apellido, consorcios(nombre)')
    .in('id_consorcio', ids)
  if (error) throw error
  return data.sort(compareNumeracion)
}

export async function getDepartamentosByConsorcio(id_consorcio) {
  const { data, error } = await supabase
    .from('departamentos')
    .select('*')
    .eq('id_consorcio', id_consorcio)
  if (error) throw error
  return data.sort(compareNumeracion)
}

export async function createDepartamento({ numeracion, inquilino, inquilino_dni, propietario_nombre, propietario_apellido, propietario_dni, id_consorcio, coeficiente, email, telefono }) {
  const { data, error } = await supabase
    .from('departamentos')
    .insert([{ numeracion, inquilino, inquilino_dni: inquilino_dni || null, propietario_nombre: propietario_nombre || null, propietario_apellido: propietario_apellido || null, propietario_dni: propietario_dni || null, id_consorcio, coeficiente: coeficiente || null, email: email || null, telefono: telefono || null }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDepartamento(id, { numeracion, inquilino, inquilino_dni, propietario_nombre, propietario_apellido, propietario_dni, coeficiente, email, telefono }) {
  const { data, error } = await supabase
    .from('departamentos')
    .update({ numeracion, inquilino: inquilino || null, inquilino_dni: inquilino_dni || null, propietario_nombre: propietario_nombre || null, propietario_apellido: propietario_apellido || null, propietario_dni: propietario_dni || null, coeficiente: coeficiente || null, email: email || null, telefono: telefono || null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- PROPIETARIOS ----

export async function getPropietarios(cliente_id) {
  const { data: consorcios, error: consError } = await supabase
    .from('consorcios')
    .select('id')
    .eq('cliente_id', cliente_id)
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

export async function createPropietario({ dni, nombre, apellido, id_consorcio, cliente_id }) {
  const { data, error } = await supabase
    .from('propietarios')
    .insert([{ dni, nombre, apellido, id_consorcio, cliente_id }])
    .select()
    .single()
  if (error) throw error
  return data
}

// Propietarios CRM (inmobiliaria) — sin id_consorcio
export async function createPropietarioCRM({ nombre, apellido, dni, cliente_id }) {
  const { data, error } = await supabase
    .from('propietarios')
    .insert([{ nombre, apellido, dni: dni || '', cliente_id }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePropietario(id, { nombre, apellido, dni }) {
  const { data, error } = await supabase
    .from('propietarios')
    .update({ nombre, apellido, dni: dni || '' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getPropietarioCRM(id) {
  if (!id) return null
  const { data, error } = await supabase
    .from('propietarios')
    .select('id, nombre, apellido, dni')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function importarPropietarios(filas, id_consorcio, cliente_id) {
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
        .insert([{ nombre, apellido, dni: fila.dni, id_consorcio, cliente_id }])
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

// Igual que importarPropietarios, pero para la pestaña "Unidades funcionales":
// carga nombre/apellido/DNI directo en el departamento, sin crear fila en
// la tabla propietarios. Usada solo desde ConsorcioDetalle.jsx — la
// importación de la página global /propietarios sigue usando importarPropietarios.
export async function importarDepartamentosExcel(filas, id_consorcio) {
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

      let deptoId = deptoMap[fila.unidad.trim().toLowerCase()]
      let deptoCreado = false
      if (deptoId) {
        await supabase
          .from('departamentos')
          .update({ propietario_nombre: nombre, propietario_apellido: apellido, propietario_dni: fila.dni || null })
          .eq('id', deptoId)
      } else if (fila.unidad.trim()) {
        const { data: nuevoDep, error: depErr } = await supabase
          .from('departamentos')
          .insert([{ numeracion: fila.unidad.trim(), id_consorcio, propietario_nombre: nombre, propietario_apellido: apellido, propietario_dni: fila.dni || null }])
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
