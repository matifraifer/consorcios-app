import { supabase } from '../../../shared/services/supabaseClient'

export async function getProyectos(cliente_id) {
  const { data, error } = await supabase
    .from('proyectos')
    .select('id, nombre, costo_presupuestado, costo_real, fecha_fin_prevista, fecha_fin_real')
    .eq('cliente_id', cliente_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getProyectoById(id) {
  const { data, error } = await supabase
    .from('proyectos')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createProyecto({ nombre, cliente_id, costo_presupuestado, fecha_inicio, fecha_fin_prevista }) {
  const { data, error } = await supabase
    .from('proyectos')
    .insert([{ nombre, cliente_id, costo_presupuestado, fecha_inicio, fecha_fin_prevista }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProyecto(id, campos) {
  const { data, error } = await supabase
    .from('proyectos')
    .update(campos)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- ETAPAS DE PROYECTO ----

export async function getEtapasByProyecto(proyecto_id) {
  const { data, error } = await supabase
    .from('etapas_proyecto')
    .select('*, tareas_etapa(*)')
    .eq('proyecto_id', proyecto_id)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createEtapa({ proyecto_id, nombre, color }) {
  const { data, error } = await supabase
    .from('etapas_proyecto')
    .insert([{ proyecto_id, nombre, color }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateEtapa(id, { nombre, color }) {
  const { data, error } = await supabase
    .from('etapas_proyecto')
    .update({ nombre, color })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteEtapa(id) {
  const { error } = await supabase.from('etapas_proyecto').delete().eq('id', id)
  if (error) throw error
}

export async function createTarea({ etapa_id, nombre, descripcion, responsable, estado, costo_presupuestado, costo_real, fecha_inicio, fecha_fin, fecha_fin_real }) {
  const { data, error } = await supabase
    .from('tareas_etapa')
    .insert([{
      etapa_id,
      nombre,
      descripcion: descripcion || null,
      responsable: responsable || null,
      estado,
      costo_presupuestado: costo_presupuestado !== '' && costo_presupuestado !== null ? Number(costo_presupuestado) : null,
      costo_real: costo_real !== '' && costo_real !== null ? Number(costo_real) : null,
      fecha_inicio: fecha_inicio || null,
      fecha_fin: fecha_fin || null,
      fecha_fin_real: fecha_fin_real || null,
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTarea(id, campos) {
  const { data, error } = await supabase
    .from('tareas_etapa')
    .update(campos)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
