import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ---- AUTH ----

export async function loginWithSupabase(username, password) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre_usuario, rol, password, cliente_id, clientes_servicio(nombre)')
    .eq('nombre_usuario', username)
    .single()

  if (error || !data) return null
  if (data.password !== password) return null

  return {
    id: data.id,
    nombre_usuario: data.nombre_usuario,
    rol: data.rol,
    cliente_id: data.cliente_id,
    cliente_nombre: data.clientes_servicio?.nombre ?? null,
  }
}

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
    .select('id, nombre, usuarios(nombre_usuario)')
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

export async function createPropietario({ dni, nombre, apellido, id_consorcio }) {
  const { data, error } = await supabase
    .from('propietarios')
    .insert([{ dni, nombre, apellido, id_consorcio }])
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

export async function updatePropietarioCRM(id, { nombre, apellido, dni }) {
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

export async function getPeriodoById(id) {
  const { data, error } = await supabase
    .from('periodos_expensas')
    .select('*, consorcios(nombre)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createPeriodo({ consorcio_id, mes, anio, cliente_id }) {
  const { data, error } = await supabase
    .from('periodos_expensas')
    .insert([{ consorcio_id, mes, anio, estado: 'abierto', cliente_id }])
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

export async function getProspectos({ tipo_operacion, includeCierreNegativo = false, cliente_id }) {
  const { data, error } = await supabase
    .from('prospectos')
    .select('*, propiedades(id, titulo, precio_publicacion, moneda)')
    .eq('tipo_operacion', tipo_operacion)
    .eq('cliente_id', cliente_id)
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

export async function getUsuarios(cliente_id) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre_usuario, rol')
    .eq('cliente_id', cliente_id)
    .order('nombre_usuario')
  if (error) throw error
  return data
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

// ---- PROPIEDADES PÚBLICAS (sin auth) ----

export async function getPropiedadPublica(id) {
  const { data, error } = await supabase
    .from('propiedades')
    .select('*')
    .eq('id', id)
    .neq('estado', 'Baja')
    .single()
  if (error) throw error
  return data
}

const CLIENTE_PUBLICO_FIELDS = 'id, nombre, logo_url, portada_urls, titulo_pagina, color_principal, color_secundario, color_acentuaciones, sobre_nosotros, email_contacto, whatsapp, telefono, coordenadas, redes_sociales, extension'

export async function getClientePublico(slugOrId) {
  // 1) intentar por extensión (slug personalizado)
  const { data: porSlug, error: e1 } = await supabase
    .from('clientes_servicio')
    .select(CLIENTE_PUBLICO_FIELDS)
    .eq('extension', slugOrId)
    .maybeSingle()
  if (e1) throw e1
  if (porSlug) return porSlug

  // 2) fallback: buscar por UUID
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
    .from('propiedades')
    .select('id, titulo, tipo_propiedad, tipo_operacion, precio_publicacion, moneda, direccion, localidad, provincia, ambientes, dormitorios, banios, metros_cubiertos, metros_totales, created_at')
    .eq('cliente_id', cliente_id)
    .neq('estado', 'Baja')
    .neq('estado', 'Vendida')
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
    .select('id, nombre, logo_url, portada_urls, titulo_pagina, extension, color_principal, color_secundario, color_acentuaciones, sobre_nosotros, email_contacto, whatsapp, telefono, coordenadas, redes_sociales')
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

// ---- CONTRATOS ----

const CONTRATOS_BUCKET = 'contratos-adjuntos'

const PLAZO_MAP = { Mensual: 1, Trimestral: 3, Cuatrimestral: 4, Semestral: 6, Anual: 12, Otro: 0 }

function generarPagos(contratoId, fechaInicio, fechaFin, montoBase, plazoActualizacion) {
  const plazoMeses = PLAZO_MAP[plazoActualizacion] ?? 0
  const pagos = []
  const current = new Date(fechaInicio + 'T12:00:00')
  const fin = new Date(fechaFin + 'T12:00:00')
  let n = 0
  while (current <= fin) {
    n++
    const periodoInicio = current.toISOString().slice(0, 10)
    const nextStart = new Date(current)
    nextStart.setMonth(nextStart.getMonth() + 1)
    const dayBeforeNext = new Date(nextStart)
    dayBeforeNext.setDate(dayBeforeNext.getDate() - 1)
    const periodoFin = dayBeforeNext <= fin
      ? dayBeforeNext.toISOString().slice(0, 10)
      : fin.toISOString().slice(0, 10)
    pagos.push({
      contrato_id: contratoId,
      periodo_numero: n,
      periodo_inicio: periodoInicio,
      periodo_fin: periodoFin,
      monto_base: montoBase,
      es_periodo_actualizacion: plazoMeses > 0 && n > 1 && (n - 1) % plazoMeses === 0,
      estado: 'pendiente',
    })
    current.setMonth(current.getMonth() + 1)
  }
  return pagos
}

export async function getContratos(cliente_id) {
  const { data, error } = await supabase
    .from('contratos')
    .select('*, propiedades(id, titulo, localidad)')
    .eq('cliente_id', cliente_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createContrato(payload, files, clienteId) {
  const { data: contrato, error } = await supabase
    .from('contratos')
    .insert([{ ...payload, cliente_id: clienteId }])
    .select().single()
  if (error) throw error

  if (files?.length) {
    const adjuntos = []
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${contrato.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from(CONTRATOS_BUCKET).upload(path, file)
      if (upErr) throw upErr
      adjuntos.push({ contrato_id: contrato.id, nombre: file.name, storage_path: path })
    }
    await supabase.from('contratos_adjuntos').insert(adjuntos)
  }

  const pagos = generarPagos(contrato.id, payload.fecha_inicio, payload.fecha_fin, payload.monto_base, payload.plazo_actualizacion)
  if (pagos.length) {
    const { error: pagosErr } = await supabase.from('pagos_contrato').insert(pagos)
    if (pagosErr) throw pagosErr
  }

  return contrato
}

export async function updateContrato(id, payload) {
  const { data, error } = await supabase
    .from('contratos')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function finalizarContrato(id) {
  const { data, error } = await supabase
    .from('contratos')
    .update({ finalizado: true, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function getContratoAdjuntos(contrato_id) {
  const { data, error } = await supabase
    .from('contratos_adjuntos').select('*')
    .eq('contrato_id', contrato_id).order('created_at')
  if (error) throw error
  return data ?? []
}

export async function getContratoAdjuntoUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(CONTRATOS_BUCKET).createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
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

export async function deleteContratoAdjunto(id, storagePath) {
  await supabase.storage.from(CONTRATOS_BUCKET).remove([storagePath])
  const { error } = await supabase.from('contratos_adjuntos').delete().eq('id', id)
  if (error) throw error
}

export async function getPagosContrato(contrato_id) {
  const { data, error } = await supabase
    .from('pagos_contrato').select('*')
    .eq('contrato_id', contrato_id).order('periodo_numero')
  if (error) throw error
  return data ?? []
}

export async function registrarPagoContrato(pagoId, { monto_pagado, fecha_pago, file }) {
  let comprobante_path = null
  if (file) {
    const ext = file.name.split('.').pop()
    const path = `comprobantes/${pagoId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from(CONTRATOS_BUCKET).upload(path, file)
    if (upErr) throw upErr
    comprobante_path = path
  }
  const { data, error } = await supabase
    .from('pagos_contrato')
    .update({ estado: 'pagado', monto_pagado: Number(monto_pagado), fecha_pago, comprobante_path })
    .eq('id', pagoId).select().single()
  if (error) throw error
  return data
}

export async function getComprobanteUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(CONTRATOS_BUCKET).createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}

// ---- DOCUMENTACIÓN RESPALDATORIA (propiedades y contratos) ----

const DOCUMENTOS_BUCKET = 'documentos-respaldatorios'

export async function getTiposDocumentacion(clienteId) {
  const { data, error } = await supabase
    .from('tipos_documentacion')
    .select('*')
    .or(`cliente_id.eq.${clienteId},cliente_id.is.null`)
    .order('orden')
    .order('nombre')
  if (error) throw error
  return data ?? []
}

export async function getDocumentosRespaldatorios(entidadTipo, entidadId) {
  const campo = entidadTipo === 'propiedad' ? 'propiedad_id' : 'contrato_id'
  const { data, error } = await supabase
    .from('documentos_respaldatorios')
    .select('*')
    .eq(campo, entidadId)
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function uploadDocumentoRespaldatorio(clienteId, entidadTipo, entidadId, file, { titulo, tipo_documentacion_id, tipo_personalizado }) {
  const ext = file.name.split('.').pop()
  const path = `${entidadTipo}/${entidadId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error: upErr } = await supabase.storage.from(DOCUMENTOS_BUCKET).upload(path, file)
  if (upErr) throw upErr
  const campo = entidadTipo === 'propiedad' ? 'propiedad_id' : 'contrato_id'
  const { data, error } = await supabase
    .from('documentos_respaldatorios')
    .insert([{
      cliente_id: clienteId,
      [campo]: entidadId,
      titulo,
      tipo_documentacion_id,
      tipo_personalizado,
      storage_path: path,
      nombre_archivo: file.name,
      mime_type: file.type,
    }])
    .select().single()
  if (error) throw error
  return data
}

export async function updateDocumentoRespaldatorio(id, { titulo, tipo_documentacion_id, tipo_personalizado }) {
  const { data, error } = await supabase
    .from('documentos_respaldatorios')
    .update({ titulo, tipo_documentacion_id, tipo_personalizado })
    .eq('id', id)
    .select().single()
  if (error) throw error
  return data
}

export async function deleteDocumentoRespaldatorio(id, storagePath) {
  await supabase.storage.from(DOCUMENTOS_BUCKET).remove([storagePath])
  const { error } = await supabase.from('documentos_respaldatorios').delete().eq('id', id)
  if (error) throw error
}

export async function getDocumentoRespaldatorioUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(DOCUMENTOS_BUCKET).createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function getIndicesActualizacion(clienteId) {
  const { data, error } = await supabase
    .from('indices_actualizacion').select('*').eq('cliente_id', clienteId).order('anio').order('mes')
  if (error) throw error
  return data ?? []
}

export async function upsertIndice({ tipo, mes, anio, valor, clienteId }) {
  const { data, error } = await supabase
    .from('indices_actualizacion')
    .upsert([{ tipo, mes, anio, valor: Number(valor), cliente_id: clienteId }], { onConflict: 'tipo,mes,anio,cliente_id' })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteIndice(id) {
  const { error } = await supabase.from('indices_actualizacion').delete().eq('id', id)
  if (error) throw error
}

// ---- CARGOS EXTRA CONTRATO ----

export async function getCargosExtraByPagos(pagoIds) {
  if (!pagoIds?.length) return []
  const { data, error } = await supabase
    .from('cargos_extra_contrato')
    .select('*')
    .in('pago_id', pagoIds)
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function createCargoExtra({ pago_id, descripcion, monto }) {
  const { data, error } = await supabase
    .from('cargos_extra_contrato')
    .insert([{ pago_id, descripcion, monto: Number(monto) }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCargoExtra(id) {
  const { error } = await supabase.from('cargos_extra_contrato').delete().eq('id', id)
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

export async function linkContactoPropiedad(contacto_id, propiedad_id) {
  const { error } = await supabase
    .from('contactos_propiedades')
    .insert([{ contacto_id, propiedad_id }])
  if (error && error.code !== '23505') throw error
}

// ---- MERCADOLIBRE ----

export async function getMlToken(cliente_id) {
  const { data, error } = await supabase
    .from('ml_tokens')
    .select('ml_user_id, expires_at')
    .eq('cliente_id', cliente_id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function deleteMlToken(cliente_id) {
  const { error } = await supabase
    .from('ml_tokens')
    .delete()
    .eq('cliente_id', cliente_id)
  if (error) throw error
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
