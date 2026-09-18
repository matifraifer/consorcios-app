import { supabase } from '../../../shared/services/supabaseClient'

// ---- CRM PROSPECTOS ----

export async function getEtapasCRM() {
  const { data, error } = await supabase.from('etapas_crm').select('*').order('orden')
  if (error) throw error
  return data
}

export async function getProspectos({ tipo_operacion, includeCierreNegativo = false, cliente_id, asignado_nombre }) {
  let query = supabase
    .from('prospectos')
    .select('*, propiedades(id, titulo, precio_publicacion, moneda)')
    .eq('tipo_operacion', tipo_operacion)
    .eq('cliente_id', cliente_id)
    .order('created_at', { ascending: false })
  if (asignado_nombre) query = query.eq('asignado_nombre', asignado_nombre)
  const { data, error } = await query
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

export async function cerrarProspecto(id, exitoso, propiedad_id = null, estadoPropiedad = null, compradorData = null, otrasPropiedad_ids = []) {
  const { error } = await supabase
    .from('prospectos')
    .update({ cerrado: true, cierre_exitoso: exitoso, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  // Actualizar la propiedad seleccionada con estado + datos del comprador
  if (propiedad_id && estadoPropiedad) {
    const propUpdate = { estado: estadoPropiedad, updated_at: new Date().toISOString() }
    if (compradorData) {
      propUpdate.comprador_nombre = compradorData.nombre ?? null
      propUpdate.comprador_telefono = compradorData.telefono ?? null
      if (estadoPropiedad === 'Vendida') {
        propUpdate.fecha_venta = new Date().toISOString().split('T')[0]
      }
    }
    const { error: pErr } = await supabase
      .from('propiedades')
      .update(propUpdate)
      .eq('id', propiedad_id)
    if (pErr) throw pErr
  }
  // Revertir las otras propiedades de interés a Disponible
  const otras = otrasPropiedad_ids.filter(pid => pid !== propiedad_id)
  if (otras.length > 0) {
    await supabase
      .from('propiedades')
      .update({ estado: 'Disponible', updated_at: new Date().toISOString() })
      .in('id', otras)
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

export async function addPropiedadInteres({ prospecto_id, propiedad_id, monto_propuesto }) {
  const { data, error } = await supabase
    .from('propiedades_interes')
    .insert([{ prospecto_id, propiedad_id, monto_propuesto: monto_propuesto ?? null }])
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

export async function updateProspectoAsignado(id, asignado_nombre) {
  const { error } = await supabase
    .from('prospectos')
    .update({ asignado_nombre, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function addHistorialProspecto(prospecto_id, usuario_nombre, accion) {
  const { error } = await supabase
    .from('historial_prospectos')
    .insert([{ prospecto_id, usuario_nombre, accion }])
  if (error) throw error
}

export async function getHistorialByProspecto(prospecto_id) {
  const { data, error } = await supabase
    .from('historial_prospectos')
    .select('*')
    .eq('prospecto_id', prospecto_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getCRMDashboardData(cliente_id) {
  const today = new Date().toISOString().slice(0, 10)

  const [
    { data: prospectos,         error: e1 },
    { data: etapas,             error: e2 },
    { data: visitas,            error: e3 },
    { count: consultasPendientes, error: e4 },
    { data: propiedadesData,    error: e5 },
    { count: sinAsignar,        error: e6 },
  ] = await Promise.all([
    supabase
      .from('prospectos')
      .select('id, nombre, apellido, etapa_id, asignado_nombre, cerrado, cierre_exitoso, etapas_crm(id, nombre, orden)')
      .eq('cliente_id', cliente_id),
    supabase
      .from('etapas_crm')
      .select('*')
      .order('orden'),
    supabase
      .from('visitas')
      .select('id, fecha, hora, propiedades(id, titulo, localidad), prospectos!inner(id, nombre, apellido, telefono, asignado_nombre, cliente_id)')
      .eq('prospectos.cliente_id', cliente_id)
      .gte('fecha', today)
      .order('fecha')
      .order('hora')
      .limit(8),
    supabase
      .from('consultas_web')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', cliente_id)
      .eq('estado', 'pendiente'),
    supabase
      .from('propiedades')
      .select('tipo_operacion, tipo_propiedad')
      .eq('cliente_id', cliente_id)
      .eq('estado', 'Disponible'),
    supabase
      .from('prospectos')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', cliente_id)
      .eq('cerrado', false)
      .is('asignado_nombre', null),
  ])

  if (e1) throw e1
  if (e2) throw e2
  if (e3) throw e3
  if (e4) throw e4
  if (e5) throw e5
  if (e6) throw e6

  return {
    prospectos:          prospectos ?? [],
    etapas:              etapas ?? [],
    visitas:             visitas ?? [],
    consultasPendientes: consultasPendientes ?? 0,
    propiedadesData:     propiedadesData ?? [],
    sinAsignar:          sinAsignar ?? 0,
  }
}

export async function createProspectoPublico({
  nombre, apellido, telefono, email,
  presupuesto, zona_interes, tipo_inmueble, credito_hipotecario,
  propiedad_id, cliente_id, tipo_operacion,
}) {
  const esAlquiler = tipo_operacion?.toLowerCase() === 'alquiler'

  // Crear contacto con origen WEB
  const { data: contacto, error: contactoErr } = await supabase
    .from('contactos')
    .insert([{
      nombre, apellido, telefono, email: email || null,
      cliente_id, activo: true, origen: 'WEB',
      tipos: [esAlquiler ? 'Arrendatario' : 'Comprador'],
      presupuesto: presupuesto || null,
      tipo_operacion: esAlquiler ? 'Alquiler' : 'Compraventa',
    }])
    .select().single()
  if (contactoErr) throw contactoErr

  if (propiedad_id && contacto) {
    await supabase.from('contactos_propiedades').insert([{ contacto_id: contacto.id, propiedad_id }])
  }

  const { data: prospecto, error } = await supabase
    .from('prospectos')
    .insert([{
      nombre, apellido, telefono, email: email || null,
      etapa_id: 1, cliente_id, cerrado: false,
      presupuesto: presupuesto || null,
      zona_interes: zona_interes || null,
      tipo_inmueble: tipo_inmueble || null,
      credito_hipotecario: credito_hipotecario ?? null,
      tipo_operacion: tipo_operacion?.toLowerCase() || null,
      propiedad_id: propiedad_id || null,
      origen_web: true,
    }])
    .select().single()
  if (error) throw error

  if (propiedad_id) {
    await supabase.from('propiedades_interes').insert([{ prospecto_id: prospecto.id, propiedad_id }])
  }

  return prospecto
}

// ---- CONTACTOS ----

export async function getContactos(cliente_id) {
  const { data, error } = await supabase
    .from('contactos')
    .select('*, contactos_propiedades(propiedad_id)')
    .eq('cliente_id', cliente_id)
    .eq('activo', true)
    .order('apellido')
    .order('nombre')
  if (error) throw error
  return (data ?? []).map(c => ({
    ...c,
    propiedades_count: c.contactos_propiedades?.length ?? 0,
  }))
}

export async function checkDniExists(dni, clienteId) {
  const { count, error } = await supabase
    .from('contactos')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .eq('dni', dni.trim())
    .eq('activo', true)
  if (error) throw error
  return count > 0
}

export async function getContactoPropiedades(contacto_id) {
  const { data, error } = await supabase
    .from('contactos_propiedades')
    .select('tipo, propiedades(id, titulo, localidad, tipo_propiedad, tipo_operacion, precio_publicacion, moneda, estado)')
    .eq('contacto_id', contacto_id)
  if (error) throw error
  return (data ?? []).map(r => ({ ...r.propiedades, tipo: r.tipo })).filter(r => r?.id)
}

export async function getContactoPropiedadesExt(contacto_id) {
  const { data, error } = await supabase
    .from('contactos_propiedades_ext')
    .select('propiedades_ext(id, titulo, precio, url, zona)')
    .eq('contacto_id', contacto_id)
  if (error) throw error
  return (data ?? []).map(r => r.propiedades_ext).filter(Boolean)
}

export async function getPropiedadesExtSugeridas(zonas, limit = 30) {
  let query = supabase
    .from('propiedades_ext')
    .select('id, titulo, precio, url, zona')
    .order('scrapeado_en', { ascending: false })
    .limit(limit)
  if (zonas) {
    const arr = Array.isArray(zonas) ? zonas.filter(Boolean) : [zonas]
    if (arr.length === 1) {
      query = query.ilike('zona', `%${arr[0]}%`)
    } else if (arr.length > 1) {
      query = query.or(arr.map(z => `zona.ilike.%${z}%`).join(','))
    }
  }
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getPropiedadesExt({ titulo, zona, ocultarSinPrecio, page = 0, pageSize = 50, clienteId } = {}) {
  let query = supabase
    .from('propiedades_ext')
    .select('id, titulo, precio, url, zona, scrapeado_en, contactos_propiedades_ext(contacto_id)', { count: 'exact' })
    .order('scrapeado_en', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)
  if (titulo?.trim()) query = query.ilike('titulo', `%${titulo.trim()}%`)
  if (zona?.trim()) query = query.ilike('zona', `%${zona.trim()}%`)
  if (ocultarSinPrecio) {
    query = query.not('precio', 'is', null).neq('precio', 'N/D').neq('precio', '')
  }
  if (clienteId) query = query.eq('contactos_propiedades_ext.cliente_id', clienteId)
  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

export async function vincularContactosExt(propiedadExtId, contactoIds, clienteId) {
  const { error: delError } = await supabase
    .from('contactos_propiedades_ext')
    .delete()
    .eq('propiedad_ext_id', propiedadExtId)
    .eq('cliente_id', clienteId)
  if (delError) throw delError
  if (contactoIds.length) {
    const { error: insError } = await supabase
      .from('contactos_propiedades_ext')
      .insert(contactoIds.map(id => ({ propiedad_ext_id: propiedadExtId, contacto_id: id, cliente_id: clienteId })))
    if (insError) throw insError
  }
}

export async function setContactoPropiedades(contacto_id, propiedad_ids) {
  const { data: existing } = await supabase
    .from('contactos_propiedades').select('propiedad_id').eq('contacto_id', contacto_id)
  const existingIds = (existing ?? []).map(r => r.propiedad_id)
  const toDelete = existingIds.filter(id => !propiedad_ids.includes(id))
  const toInsert = propiedad_ids.filter(id => !existingIds.includes(id))
  if (toDelete.length) {
    const { error } = await supabase.from('contactos_propiedades').delete()
      .eq('contacto_id', contacto_id).in('propiedad_id', toDelete)
    if (error) throw error
  }
  if (toInsert.length) {
    const { error } = await supabase.from('contactos_propiedades')
      .insert(toInsert.map(propiedad_id => ({ contacto_id, propiedad_id })))
    if (error) throw error
  }
}

export async function getPropiedadContactos(propiedad_id) {
  const { data, error } = await supabase
    .from('contactos_propiedades')
    .select('contactos(id, nombre, apellido, dni, telefono, email, tipo, tipos)')
    .eq('propiedad_id', propiedad_id)
  if (error) throw error
  return (data ?? []).map(r => r.contactos).filter(Boolean)
}

export async function setPropiedadContactos(propiedad_id, contacto_ids) {
  const { error: delErr } = await supabase
    .from('contactos_propiedades')
    .delete()
    .eq('propiedad_id', propiedad_id)
  if (delErr) throw delErr
  if (!contacto_ids?.length) return
  const { error } = await supabase
    .from('contactos_propiedades')
    .insert(contacto_ids.map(contacto_id => ({ propiedad_id, contacto_id })))
  if (error) throw error
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

export async function getContactoById(id) {
  const { data, error } = await supabase
    .from('contactos')
    .select('id, nombre, apellido, dni, telefono, email')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createContacto(data) {
  const { data: result, error } = await supabase
    .from('contactos').insert([data]).select().single()
  if (error) throw error
  return result
}

export async function updateContacto(id, data) {
  const { data: result, error } = await supabase
    .from('contactos').update(data).eq('id', id).select().single()
  if (error) throw error
  return result
}

const TIPOS_CONTACTO_VALIDOS = ['Comprador', 'Vendedor', 'Locatario', 'Locador']

export async function importarContactos(filas, clienteId, creadoPor = null) {
  const { data: existentes, error: exErr } = await supabase
    .from('contactos')
    .select('dni, email')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
  if (exErr) throw exErr

  const dnisExistentes   = new Set(existentes.filter(c => c.dni).map(c => c.dni.trim().toLowerCase()))
  const emailsExistentes = new Set(existentes.filter(c => c.email).map(c => c.email.trim().toLowerCase()))

  const resultados = []
  for (const fila of filas) {
    const { _fila, nombre, apellido, tipo, telefono, dni, email } = fila

    if (!nombre || !apellido || !tipo || !telefono) {
      resultados.push({ fila: _fila, estado: 'error', motivo: 'Faltan campos obligatorios (Nombre, Apellido, Tipo o Teléfono).' })
      continue
    }

    const tipoNormalizado = TIPOS_CONTACTO_VALIDOS.find(t => t.toLowerCase() === tipo.toLowerCase())
    if (!tipoNormalizado) {
      resultados.push({ fila: _fila, estado: 'error', motivo: `Tipo "${tipo}" inválido. Use: ${TIPOS_CONTACTO_VALIDOS.join(', ')}.` })
      continue
    }

    const dniNorm = dni ? dni.trim().toLowerCase() : null
    const emailNorm = email ? email.trim().toLowerCase() : null
    if ((dniNorm && dnisExistentes.has(dniNorm)) || (emailNorm && emailsExistentes.has(emailNorm))) {
      resultados.push({ fila: _fila, estado: 'duplicado', motivo: 'Ya existe un contacto con ese DNI o correo electrónico.' })
      continue
    }

    try {
      const { error } = await supabase.from('contactos').insert([{
        nombre, apellido, tipos: [tipoNormalizado], tipo: tipoNormalizado,
        telefono, dni: dni || null, email: email || null,
        cliente_id: clienteId, activo: true, origen: 'IMPORTADO', creado_por: creadoPor,
      }])
      if (error) throw error
      if (dniNorm) dnisExistentes.add(dniNorm)
      if (emailNorm) emailsExistentes.add(emailNorm)
      resultados.push({ fila: _fila, estado: 'importado' })
    } catch (err) {
      resultados.push({ fila: _fila, estado: 'error', motivo: err.message })
    }
  }
  return resultados
}

export async function vincularContactoDesdeContrato({ cliente_id, nombre, apellido, dni, telefono, tipo, creado_por, origen }) {
  if (!nombre || !apellido) return null

  let existente = null
  if (dni) {
    const { data, error } = await supabase
      .from('contactos')
      .select('id, tipos, tipo, telefono')
      .eq('cliente_id', cliente_id)
      .eq('dni', dni)
      .eq('activo', true)
      .maybeSingle()
    if (error) throw error
    existente = data
  }

  if (existente) {
    const tiposActuales = existente.tipos?.length ? existente.tipos : (existente.tipo ? [existente.tipo] : [])
    const update = {}
    if (!tiposActuales.includes(tipo)) update.tipos = [...tiposActuales, tipo]
    if (telefono && !existente.telefono) update.telefono = telefono
    if (Object.keys(update).length === 0) return existente
    const { data, error } = await supabase
      .from('contactos')
      .update(update)
      .eq('id', existente.id)
      .select().single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('contactos')
    .insert([{ nombre, apellido, dni: dni || null, telefono: telefono || null, tipos: [tipo], tipo, cliente_id, activo: true, origen: origen || 'APP', creado_por: creado_por || null }])
    .select().single()
  if (error) throw error
  return data
}

export async function buscarContactos(cliente_id, texto) {
  const q = texto.trim().toLowerCase()
  const { data, error } = await supabase
    .from('contactos')
    .select('id, nombre, apellido, dni, telefono')
    .eq('cliente_id', cliente_id)
    .eq('activo', true)
    .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,dni.ilike.%${q}%`)
    .order('apellido')
    .limit(20)
  if (error) throw error
  return data ?? []
}

export async function deleteContacto(id) {
  const { error } = await supabase
    .from('contactos')
    .update({ activo: false })
    .eq('id', id)
  if (error) throw error
}

// ---- CONSULTAS WEB ----

export async function submitConsultaWeb({
  cliente_id, propiedad_id, dni, nombre, apellido, telefono, email,
  presupuesto, provincia, zona_interes, mensaje,
}) {
  const { data, error } = await supabase
    .from('consultas_web')
    .insert([{
      cliente_id,
      propiedad_id: propiedad_id || null,
      dni,
      nombre,
      apellido,
      telefono,
      email: email || null,
      presupuesto: presupuesto ? Number(presupuesto) : null,
      provincia: provincia || null,
      zona_interes: zona_interes || null,
      mensaje: mensaje || null,
      estado: 'pendiente',
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getConsultasWeb(cliente_id) {
  const { data, error } = await supabase
    .from('consultas_web')
    .select('*, propiedades(id, titulo)')
    .eq('cliente_id', cliente_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function validarConsultaWeb(id) {
  const { data, error } = await supabase
    .from('consultas_web')
    .update({ estado: 'validada' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function inactivarConsultaWeb(id) {
  const { data, error } = await supabase
    .from('consultas_web')
    .update({ estado: 'inactiva' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function marcarConsultaConvertida(id, contacto_id) {
  const { data, error } = await supabase
    .from('consultas_web')
    .update({ estado: 'convertida', contacto_id })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function linkContactoPropiedad(contacto_id, propiedad_id) {
  const { error } = await supabase
    .from('contactos_propiedades')
    .insert([{ contacto_id, propiedad_id }])
  if (error && error.code !== '23505') throw error
}
