import { supabase } from '../../../shared/services/supabaseClient'

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
    .select('*, propiedades(id, titulo, localidad, direccion)')
    .eq('cliente_id', cliente_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
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

export async function updateContrato(id, payload) {
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
    .order('periodo_numero')
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
    .eq('id', pagoId).select('*, contratos(cliente_id)').single()
  if (error) throw error

  // Numera y crea el recibo del pago (no bloquea el registro del pago si falla)
  try {
    await crearReciboContrato({
      cliente_id: data.contratos.cliente_id,
      contrato_id: data.contrato_id,
      pago_id: data.id,
      fecha_pago: data.fecha_pago,
      monto: data.monto_pagado,
    })
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

export async function crearReciboContrato({ cliente_id, contrato_id, pago_id, fecha_pago, monto }) {
  const { data, error } = await supabase.rpc('crear_recibo_contrato', {
    p_cliente_id: cliente_id,
    p_contrato_id: contrato_id,
    p_pago_id: pago_id,
    p_fecha_pago: fecha_pago,
    p_monto: monto,
  })
  if (error) throw error
  return data
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
