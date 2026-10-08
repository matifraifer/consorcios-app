export const PLAZO_MAP = { Mensual: 1, Trimestral: 3, Cuatrimestral: 4, Semestral: 6, Anual: 12, Otro: 0 }

const MS_POR_DIA = 1000 * 60 * 60 * 24

// Trimestral → n=4,7,10… | Cuatrimestral → n=5,9,13… | etc.
export function esActualizacion(periodoNumero, plazoActualizacion) {
  const plazoMeses = PLAZO_MAP[plazoActualizacion] ?? 0
  return plazoMeses > 0 && periodoNumero > 1 && (periodoNumero - 1) % plazoMeses === 0
}

// Coeficiente de UNA actualización: los índices (IPC/ICL) se cargan como variación
// MENSUAL, así que se compone la variación de los `plazoMeses` meses del período recién
// finalizado. Devuelve también los meses sin índice cargado.
function factorActualizacion(up, allPagos, indices, tipoActualizacion, plazoMeses) {
  const mesesPeriodo = allPagos.filter(
    p => p.periodo_numero >= up.periodo_numero - plazoMeses && p.periodo_numero <= up.periodo_numero - 1
  )
  let factor = 1
  const faltantes = []
  for (const mp of mesesPeriodo) {
    const [y, m] = mp.periodo_inicio.split('-').map(Number)
    const idx = indices.find(i => i.tipo === tipoActualizacion && i.mes === m && i.anio === y)
    if (idx) factor *= (1 + idx.valor / 100)
    else faltantes.push(`${String(m).padStart(2, '0')}/${y}`)
  }
  return { factor, faltantes }
}

// Último período (anterior a `pago`) con la actualización ya aplicada y guardada en la
// base (monto_vigente). Las estimaciones arrancan desde ahí.
function ultimoCongelado(pago, allPagos) {
  return allPagos
    .filter(p => p.periodo_numero < pago.periodo_numero && p.monto_vigente != null)
    .sort((a, b) => b.periodo_numero - a.periodo_numero)[0] ?? null
}

// Actualizaciones todavía no aplicadas en la base, hasta este período inclusive.
function actualizacionesPendientes(pago, allPagos, plazoActualizacion) {
  const desde = ultimoCongelado(pago, allPagos)?.periodo_numero ?? 0
  return allPagos
    .filter(p => esActualizacion(p.periodo_numero, plazoActualizacion)
      && p.periodo_numero > desde && p.periodo_numero <= pago.periodo_numero && p.monto_vigente == null)
    .sort((a, b) => a.periodo_numero - b.periodo_numero)
}

// Monto de alquiler de un período. Si la actualización ya se aplicó (al registrar el pago
// del período de actualización, RPC registrar_pago_contrato), usa el monto guardado
// (monto_vigente). Si no, lo estima encadenando las actualizaciones pendientes desde el
// último monto guardado, con el mismo redondeo por paso que hace la base.
export function computeMontoActualizado(pago, allPagos, indices, tipoActualizacion, plazoActualizacion) {
  if (pago.monto_vigente != null) return Number(pago.monto_vigente)

  const plazoMeses = PLAZO_MAP[plazoActualizacion] ?? 0
  const congelado = ultimoCongelado(pago, allPagos)
  let monto = Number(congelado ? congelado.monto_vigente : pago.monto_base)
  if (plazoMeses === 0) return monto

  for (const up of actualizacionesPendientes(pago, allPagos, plazoActualizacion)) {
    monto = Math.round(monto * factorActualizacion(up, allPagos, indices, tipoActualizacion, plazoMeses).factor)
  }
  return monto
}

// Meses sin índice cargado que bloquearían aplicar las actualizaciones pendientes hasta
// este período (misma regla que la RPC: si no hay NINGÚN índice de ese tipo cargado, el
// contrato no se actualiza y no falta nada; las de períodos ya pagados no bloquean).
export function indicesFaltantes(pago, allPagos, indices, tipoActualizacion, plazoActualizacion) {
  const plazoMeses = PLAZO_MAP[plazoActualizacion] ?? 0
  if (plazoMeses === 0 || !indices.some(i => i.tipo === tipoActualizacion)) return []
  return actualizacionesPendientes(pago, allPagos, plazoActualizacion)
    .filter(up => up.estado !== 'pagado')
    .flatMap(up => factorActualizacion(up, allPagos, indices, tipoActualizacion, plazoMeses).faltantes)
}

// Diferencia de depósito ESTIMADA para un período de actualización que todavía no se
// aplicó. Una vez aplicada, la diferencia ya figura como cargo extra (tipo 'deposito').
export function computeDiferenciaDeposito(pago, allPagos, indices, contrato) {
  const deposito = Number(contrato.deposito_vigente ?? contrato.deposito ?? 0)
  const plazoMeses = PLAZO_MAP[contrato.plazo_actualizacion] ?? 0
  if (!deposito || plazoMeses === 0 || pago.monto_vigente != null) return 0
  if (!esActualizacion(pago.periodo_numero, contrato.plazo_actualizacion)) return 0
  if (!indices.some(i => i.tipo === contrato.tipo_actualizacion)) return 0

  let dep = deposito
  let anterior = deposito
  for (const up of actualizacionesPendientes(pago, allPagos, contrato.plazo_actualizacion)) {
    anterior = dep
    dep = Math.round(dep * factorActualizacion(up, allPagos, indices, contrato.tipo_actualizacion, plazoMeses).factor)
  }
  return Math.max(dep - anterior, 0)
}

// Depósito en garantía completo que se cobra con la primera cuota, mientras todavía no
// está guardado como cargo extra (tipo 'deposito_inicial', lo crea la RPC al registrar
// el pago de la cuota 1).
export function computeDepositoInicial(pago, contrato, cargosDelPago = []) {
  if (pago.periodo_numero !== 1 || pago.estado === 'pagado') return 0
  if (cargosDelPago.some(c => c.tipo === 'deposito_inicial')) return 0
  return Number(contrato.deposito) || 0
}

// Día de vencimiento del período: dia_vencimiento del contrato en el mes del período
// (o el último día del mes si no está configurado / el mes es más corto).
export function fechaVencimientoCuota(periodoInicio, diaVencimiento) {
  if (!periodoInicio) return null
  const [y, m] = periodoInicio.split('-').map(Number)
  const ultimoDiaMes = new Date(y, m, 0).getDate()
  const dia = Math.min(Number(diaVencimiento || ultimoDiaMes), ultimoDiaMes)
  return new Date(y, m - 1, dia)
}

// Un pago pendiente está vencido cuando pasó el día de vencimiento de su mes (todo ese
// día cuenta como en término). Misma regla que la mora.
export function estaVencido(pago, diaVencimiento, hoy = new Date()) {
  if (pago.estado !== 'pendiente') return false
  const v = fechaVencimientoCuota(pago.periodo_inicio, diaVencimiento)
  return !!v && new Date(v.getFullYear(), v.getMonth(), v.getDate(), 23, 59, 59) < hoy
}

// YYYY-MM-DD en hora local (toISOString convierte a UTC y puede correr el día)
export function fechaIsoLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function aFecha(valor) {
  if (valor instanceof Date) return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate())
  const [y, m, d] = String(valor).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Interés por mora (interés simple, % diario sobre el alquiler del mes sin cargos extra).
// Solo corre si se paga DESPUÉS del vencimiento; en ese caso los días se cuentan desde el
// día 1 del mes del período. fechaReferencia: fecha de pago (o hoy, para estimar).
export function computeMora(pago, contrato, montoAlquiler, fechaReferencia) {
  const tasa = Number(contrato.interes_mora_diario)
  if (!tasa || !pago.periodo_inicio || !fechaReferencia) return { dias: 0, monto: 0 }

  const vencimiento = fechaVencimientoCuota(pago.periodo_inicio, contrato.dia_vencimiento)
  const ref = aFecha(fechaReferencia)
  if (ref <= vencimiento) return { dias: 0, monto: 0 }

  const [y, m] = pago.periodo_inicio.split('-').map(Number)
  const dias = Math.round((ref - new Date(y, m - 1, 1)) / MS_POR_DIA)
  const monto = Math.round(Number(montoAlquiler) * (tasa / 100) * dias * 100) / 100
  return { dias, monto }
}
