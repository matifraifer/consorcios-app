import { supabase } from '../../../shared/services/supabaseClient'

// ---- CONTRATOS ----

const CONTRATOS_BUCKET = 'contratos-adjuntos'
const FIRMAS_BUCKET = 'firmas'

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

// Escapa caracteres que rompen la sintaxis de filtros de PostgREST (or/ilike separados por coma)
function sanitizeFiltro(v) {
  return v.replace(/[,()%]/g, ' ').trim()
}

export async function getContratos(cliente_id, filters = {}, { page = 0, pageSize = 25 } = {}) {
  // Filtrar por propiedades.titulo sobre una relación embebida requiere inner join,
  // si no PostgREST ignora el filtro y devuelve igual los contratos sin esa propiedad.
  const propiedadesSelect = filters.busqPropiedad
    ? 'propiedades!inner(id, titulo, localidad, direccion)'
    : 'propiedades(id, titulo, localidad, direccion)'

  let query = supabase
    .from('contratos')
    .select(`*, ${propiedadesSelect}`, { count: 'exact' })
    .eq('cliente_id', cliente_id)
    .eq('deleted', false)

  if (filters.busqInquilino) {
    const q = sanitizeFiltro(filters.busqInquilino)
    query = query.or(`inquilino_nombre.ilike.%${q}%,inquilino_apellido.ilike.%${q}%`)
  }
  if (filters.busqPropietario) {
    const q = sanitizeFiltro(filters.busqPropietario)
    query = query.or(`propietario_nombre.ilike.%${q}%,propietario_apellido.ilike.%${q}%`)
  }
  if (filters.busqPropiedad) {
    query = query.ilike('propiedades.titulo', `%${sanitizeFiltro(filters.busqPropiedad)}%`)
  }
  if (filters.filtroEstado === 'Finalizado') {
    query = query.eq('finalizado', true)
  } else if (filters.filtroEstado === 'Vigente' || filters.filtroEstado === 'Vencido') {
    const today = new Date().toISOString().slice(0, 10)
    query = query.eq('finalizado', false)
    query = filters.filtroEstado === 'Vigente' ? query.gte('fecha_fin', today) : query.lt('fecha_fin', today)
  }
  if (filters.filtroFechaDesde) query = query.gte('fecha_fin', filters.filtroFechaDesde)
  if (filters.filtroFechaHasta) query = query.lte('fecha_inicio', filters.filtroFechaHasta)

  const from = page * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

export async function createContrato(payload, files, clienteId) {
  const { data: contrato, error } = await supabase
    .from('contratos')
    .insert([{ ...payload, cliente_id: clienteId }])
    .select('*, propiedades(id, titulo, localidad)')
    .single()
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

// Qué condiciones se pueden editar en un contrato ya creado (mismas reglas que la RPC
// editar_contrato_condiciones, acá solo para bloquear los campos en el formulario).
export async function getRestriccionesEdicion(contratoId) {
  const [pagos, actualizaciones] = await Promise.all([
    supabase.from('pagos_contrato').select('id, periodo_numero, estado').eq('contrato_id', contratoId),
    supabase.from('actualizaciones_contrato').select('id', { count: 'exact', head: true }).eq('contrato_id', contratoId),
  ])
  if (pagos.error) throw pagos.error
  if (actualizaciones.error) throw actualizaciones.error

  const lista = pagos.data ?? []
  const pagados = lista.filter(p => p.estado === 'pagado').length
  const conActualizaciones = (actualizaciones.count ?? 0) > 0
  const cuota1Pagada = lista.some(p => p.periodo_numero === 1 && p.estado === 'pagado')
  let cargosPendientes = 0
  if (lista.length) {
    const { count, error } = await supabase.from('cargos_extra_contrato')
      .select('id', { count: 'exact', head: true }).in('pago_id', lista.map(p => p.id))
    if (error) throw error
    cargosPendientes = count ?? 0
  }

  return {
    totalPagos: lista.length,
    pagados,
    cargosPendientes,
    montoBase: conActualizaciones ? 'El contrato ya tuvo actualizaciones por índice aplicadas.' : null,
    deposito: conActualizaciones
      ? 'El contrato ya tuvo actualizaciones por índice aplicadas.'
      : cuota1Pagada ? 'El depósito ya se cobró con la primera cuota.' : null,
    actualizacion: conActualizaciones ? 'El contrato ya tuvo actualizaciones por índice aplicadas.' : null,
    fechaInicio: pagados > 0 ? 'El contrato ya tiene pagos registrados.' : null,
  }
}

// anterior: el contrato antes de editar (para saber si cambió la fecha de inicio y hay
// que rearmar los períodos).
export async function updateContrato(id, payload, anterior = null) {
  // Primero las condiciones que impactan en los pagos (monto base, depósito, tipo/plazo de
  // actualización, fecha de inicio): la RPC valida las reglas y actualiza los pagos en
  // una transacción. Si algo no se puede cambiar, corta acá y no se guarda nada.
  const cambiaInicio = anterior && payload.fecha_inicio !== anterior.fecha_inicio
  const { error: condErr } = await supabase.rpc('editar_contrato_condiciones', {
    p_contrato_id: id,
    p_monto_base: payload.monto_base,
    p_deposito: payload.deposito ?? null,
    p_tipo_actualizacion: payload.tipo_actualizacion,
    p_plazo_actualizacion: payload.plazo_actualizacion,
    p_fecha_inicio: payload.fecha_inicio,
    p_pagos_regenerados: cambiaInicio
      ? generarPagos(id, payload.fecha_inicio, payload.fecha_fin, payload.monto_base, payload.plazo_actualizacion)
        .map(({ periodo_numero, periodo_inicio, periodo_fin, es_periodo_actualizacion }) =>
          ({ periodo_numero, periodo_inicio, periodo_fin, es_periodo_actualizacion }))
      : null,
  })
  if (condErr) throw condErr

  const { data, error } = await supabase
    .from('contratos')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, propiedades(id, titulo, localidad)')
    .single()
  if (error) throw error

  // Si se extendió la fecha_fin, generar los pagos mensuales que todavía no existen
  const { data: ultimoPago, error: pagosError } = await supabase
    .from('pagos_contrato')
    .select('periodo_numero, periodo_fin')
    .eq('contrato_id', id)
    .order('periodo_numero', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (pagosError) throw pagosError

  let nuevosPagos = []
  if (ultimoPago) {
    const ultimoFin = new Date(ultimoPago.periodo_fin + 'T12:00:00')
    const nuevoFin = new Date(payload.fecha_fin + 'T12:00:00')
    if (nuevoFin > ultimoFin) {
      const siguienteInicio = new Date(ultimoFin)
      siguienteInicio.setDate(siguienteInicio.getDate() + 1)
      nuevosPagos = generarPagos(id, siguienteInicio.toISOString().slice(0, 10), payload.fecha_fin, payload.monto_base, payload.plazo_actualizacion)
        .map((p, i) => ({ ...p, periodo_numero: ultimoPago.periodo_numero + 1 + i }))
    }
  } else {
    // Contrato sin pagos generados (caso raro) → generarlos desde cero
    nuevosPagos = generarPagos(id, payload.fecha_inicio, payload.fecha_fin, payload.monto_base, payload.plazo_actualizacion)
  }

  if (nuevosPagos.length) {
    // es_periodo_actualizacion depende del período_numero global, recalcular con la numeración ya remapeada
    const plazoMeses = PLAZO_MAP[payload.plazo_actualizacion] ?? 0
    nuevosPagos = nuevosPagos.map(p => ({
      ...p,
      es_periodo_actualizacion: plazoMeses > 0 && p.periodo_numero > 1 && (p.periodo_numero - 1) % plazoMeses === 0,
    }))
    const { error: insertError } = await supabase.from('pagos_contrato').insert(nuevosPagos)
    if (insertError) throw insertError
  }

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

// Eliminación lógica: el contrato deja de mostrarse en todos lados, pero la fila (y sus
// pagos, recibos, cargos e historial de actualizaciones) queda en la base.
export async function eliminarContrato(id) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('contratos')
    .update({ deleted: true, deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
    .eq('id', id)
  if (error) throw error
}

// Para la advertencia al eliminar un contrato desde la grilla
export async function contarPagosRegistrados(contratoId) {
  const { count, error } = await supabase
    .from('pagos_contrato')
    .select('id', { count: 'exact', head: true })
    .eq('contrato_id', contratoId)
    .eq('estado', 'pagado')
  if (error) throw error
  return count ?? 0
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

// Todos los pagos de alquiler (de todos los contratos vigentes) de un cliente —
// usado para los KPIs de alquileres por cobrar del home.
export async function getPagosContratoCliente(clienteId) {
  const { data, error } = await supabase
    .from('pagos_contrato')
    .select('*, contratos!inner(id, cliente_id, tipo_actualizacion, plazo_actualizacion, finalizado)')
    .eq('contratos.cliente_id', clienteId)
    .eq('contratos.finalizado', false)
    .eq('contratos.deleted', false)
    .order('periodo_numero')
  if (error) throw error
  return data ?? []
}

// Condiciones del contrato que cambian del lado de la base al registrar pagos
// (deposito_vigente lo actualiza la RPC al aplicar una actualización).
export async function getContratoCondiciones(id) {
  const { data, error } = await supabase
    .from('contratos')
    .select('deposito, deposito_vigente, interes_mora_diario')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function registrarPagoContrato(pagoId, { monto_pagado, fecha_pago, file, monto_mora = 0, dias_mora = null }) {
  let comprobante_path = null
  if (file) {
    const ext = file.name.split('.').pop()
    const path = `comprobantes/${pagoId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from(CONTRATOS_BUCKET).upload(path, file)
    if (upErr) throw upErr
    comprobante_path = path
  }

  // En una sola transacción: aplica las actualizaciones por índice pendientes hasta este
  // período (monto_vigente + historial + cargo por diferencia de depósito), guarda el
  // cargo de interés por mora y marca el pago como pagado. Si faltan índices, falla
  // entera y el pago no se registra.
  const { error: rpcError } = await supabase.rpc('registrar_pago_contrato', {
    p_pago_id: pagoId,
    p_monto_pagado: Number(monto_pagado),
    p_fecha_pago: fecha_pago,
    p_comprobante_path: comprobante_path,
    p_monto_mora: Number(monto_mora) || 0,
    p_dias_mora: dias_mora,
  })
  if (rpcError) throw rpcError

  const { data, error } = await supabase
    .from('pagos_contrato')
    .select(`*, contratos(cliente_id, inquilino_nombre, inquilino_apellido, propietario_nombre, propietario_apellido, dia_vencimiento, es_compraventa, comision_gestion, propiedades(direccion, titulo))`)
    .eq('id', pagoId)
    .single()
  if (error) throw error

  // Numera y crea los recibos del pago (inquilino y, si el contrato tiene comisión de
  // gestión configurada, rendición al propietario), con un snapshot de los datos que
  // los componen (no se recalculan mas adelante ni si se edita el contrato). No bloquea
  // el registro del pago si falla.
  try {
    const { data: cargosExtra, error: cargosErr } = await supabase
      .from('cargos_extra_contrato')
      .select('descripcion, monto, tipo')
      .eq('pago_id', data.id)
    if (cargosErr) throw cargosErr

    const c = data.contratos
    const direccion = c.propiedades?.direccion || c.propiedades?.titulo || 'sin especificar'
    const concepto = c.es_compraventa ? 'Cuota' : 'Alquiler'
    const [anio, mesNum] = data.periodo_inicio.split('-').map(Number)
    const periodoMes = `${anio}-${String(mesNum).padStart(2, '0')}-01`
    const vencimientoFecha = c.dia_vencimiento
      ? new Date(anio, mesNum - 1, Number(c.dia_vencimiento)).toISOString().slice(0, 10)
      : null

    await crearReciboContrato({
      cliente_id: c.cliente_id,
      contrato_id: data.contrato_id,
      pago_id: data.id,
      fecha_pago: data.fecha_pago,
      monto: data.monto_pagado,
      inquilino_nombre: c.inquilino_nombre,
      inquilino_apellido: c.inquilino_apellido,
      direccion_inmueble: direccion,
      concepto,
      cuota_numero: data.periodo_numero,
      periodo_mes: periodoMes,
      vencimiento_fecha: vencimientoFecha,
      es_compraventa: c.es_compraventa,
      cargos_extra: cargosExtra ?? [],
    })

    // Recibo de rendición al propietario: se genera siempre (sin comisión de gestión se
    // rinde el 100% del alquiler). Los cargos extra se restan para quedarse con el
    // alquiler; como los descuentos están en negativo, montoAlquiler queda en el alquiler
    // completo y la comisión no se ve afectada. Los descuentos se guardan aparte y se
    // restan de lo rendido al armar el PDF.
    {
      const comisionPct = Number(c.comision_gestion) || 0
      const totalCargos = (cargosExtra ?? []).reduce((s, cg) => s + Number(cg.monto), 0)
      const montoAlquiler = Number(data.monto_pagado) - totalCargos
      const comision = montoAlquiler * (comisionPct / 100)

      await crearReciboPropietario({
        cliente_id: c.cliente_id,
        contrato_id: data.contrato_id,
        pago_id: data.id,
        fecha_pago: data.fecha_pago,
        monto: comision,
        monto_alquiler: montoAlquiler,
        comision_pct: comisionPct,
        propietario_nombre: c.propietario_nombre,
        propietario_apellido: c.propietario_apellido,
        direccion_inmueble: direccion,
        cuota_numero: data.periodo_numero,
        periodo_mes: periodoMes,
        vencimiento_fecha: vencimientoFecha,
        descuentos: (cargosExtra ?? [])
          .filter(cg => cg.tipo === 'descuento')
          .map(cg => ({ descripcion: cg.descripcion, monto: Math.abs(Number(cg.monto)) })),
      })
    }
  } catch (reciboErr) {
    console.error('No se pudo generar el recibo del pago:', reciboErr)
  }

  delete data.contratos
  return data
}

export async function getComprobanteUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(CONTRATOS_BUCKET).createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}

// ---- RECIBOS DE PAGO (alquileres) ----

export async function crearReciboContrato({
  cliente_id, contrato_id, pago_id, fecha_pago, monto,
  inquilino_nombre, inquilino_apellido, direccion_inmueble, concepto,
  cuota_numero, periodo_mes, vencimiento_fecha, es_compraventa, cargos_extra,
}) {
  const { data, error } = await supabase.rpc('crear_recibo_contrato', {
    p_cliente_id: cliente_id,
    p_contrato_id: contrato_id,
    p_pago_id: pago_id,
    p_fecha_pago: fecha_pago,
    p_monto: monto,
    p_inquilino_nombre: inquilino_nombre,
    p_inquilino_apellido: inquilino_apellido,
    p_direccion_inmueble: direccion_inmueble,
    p_concepto: concepto,
    p_cuota_numero: cuota_numero,
    p_periodo_mes: periodo_mes,
    p_vencimiento_fecha: vencimiento_fecha,
    p_es_compraventa: es_compraventa,
    p_cargos_extra: cargos_extra ?? [],
  })
  if (error) throw error
  return data
}

// Firma de la inmobiliaria guardada en el recibo (file_firma, bucket privado "firmas").
export async function getFirmaReciboUrl(fileFirma) {
  if (!fileFirma) return null
  const { data, error } = await supabase.storage
    .from(FIRMAS_BUCKET).createSignedUrl(fileFirma, 300)
  if (error) throw error
  return data.signedUrl
}

export async function getReciboByPago(pagoId) {
  const { data, error } = await supabase
    .from('recibos_contrato')
    .select('*')
    .eq('pago_id', pagoId)
    .maybeSingle()
  if (error) throw error
  return data
}

// ---- RECIBOS DE RENDICIÓN AL PROPIETARIO (comisión de gestión) ----

export async function crearReciboPropietario({
  cliente_id, contrato_id, pago_id, fecha_pago, monto, monto_alquiler, comision_pct,
  propietario_nombre, propietario_apellido, direccion_inmueble,
  cuota_numero, periodo_mes, vencimiento_fecha, descuentos = [],
}) {
  const { data, error } = await supabase.rpc('crear_recibo_propietario', {
    p_cliente_id: cliente_id,
    p_contrato_id: contrato_id,
    p_pago_id: pago_id,
    p_fecha_pago: fecha_pago,
    p_monto: monto,
    p_monto_alquiler: monto_alquiler,
    p_comision_pct: comision_pct,
    p_propietario_nombre: propietario_nombre,
    p_propietario_apellido: propietario_apellido,
    p_direccion_inmueble: direccion_inmueble,
    p_cuota_numero: cuota_numero,
    p_periodo_mes: periodo_mes,
    p_vencimiento_fecha: vencimiento_fecha,
    p_descuentos: descuentos,
  })
  if (error) throw error
  return data
}

export async function setMedioRendicion(reciboId, medio) {
  const { error } = await supabase
    .from('recibos_propietario')
    .update({ medio_rendicion: medio })
    .eq('id', reciboId)
  if (error) throw error
}

export async function getReciboPropietarioByPago(pagoId) {
  const { data, error } = await supabase
    .from('recibos_propietario')
    .select('*')
    .eq('pago_id', pagoId)
    .maybeSingle()
  if (error) throw error
  return data
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

export async function getIndicesActualizacion() {
  // Sin filtro de cliente_id: la RLS ya devuelve los propios + los marcados como externo=true de otros clientes.
  const { data, error } = await supabase
    .from('indices_actualizacion').select('*').order('anio').order('mes')
  if (error) throw error
  return data ?? []
}

export async function upsertIndice({ tipo, mes, anio, valor, clienteId, externo }) {
  const { data, error } = await supabase
    .from('indices_actualizacion')
    .upsert([{ tipo, mes, anio, valor: Number(valor), cliente_id: clienteId, externo: !!externo }], { onConflict: 'tipo,mes,anio,cliente_id' })
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

// tipo 'descuento': monto se recibe en positivo y se guarda negativo (resta del total).
export async function createCargoExtra({ pago_id, descripcion, monto, tipo = 'manual' }) {
  const valor = tipo === 'descuento' ? -Math.abs(Number(monto)) : Number(monto)
  const { data, error } = await supabase
    .from('cargos_extra_contrato')
    .insert([{ pago_id, descripcion, monto: valor, tipo }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCargoExtra(id) {
  const { error } = await supabase.from('cargos_extra_contrato').delete().eq('id', id)
  if (error) throw error
}
