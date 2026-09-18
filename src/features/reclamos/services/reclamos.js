import { supabase } from '../../../shared/services/supabaseClient'

export async function getReclamos(cliente_id) {
  const { data, error } = await supabase
    .from('reclamos')
    .select('id, descripcion, estado, fecha, propietarios(nombre, apellido), consorcios(nombre), departamentos(numeracion)')
    .eq('cliente_id', cliente_id)
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

export async function createReclamo({ propietario_id, consorcio_id, departamento_id, descripcion, estado, fecha, cliente_id }) {
  const { data, error } = await supabase
    .from('reclamos')
    .insert([{ propietario_id, consorcio_id, departamento_id, descripcion, estado, fecha, cliente_id }])
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
