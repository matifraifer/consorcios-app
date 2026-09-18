export const PLAZO_MAP = { Mensual: 1, Trimestral: 3, Cuatrimestral: 4, Semestral: 6, Anual: 12, Otro: 0 }

// Trimestral → n=4,7,10… | Cuatrimestral → n=5,9,13… | etc.
export function esActualizacion(periodoNumero, plazoActualizacion) {
  const plazoMeses = PLAZO_MAP[plazoActualizacion] ?? 0
  return plazoMeses > 0 && periodoNumero > 1 && (periodoNumero - 1) % plazoMeses === 0
}

// Calcula el monto acumulado para CUALQUIER período, aplicando todas las
// actualizaciones encadenadas que ocurrieron hasta ese período.
//
// Los índices (IPC/ICL) se cargan como variación MENSUAL, así que cada
// actualización (trimestral/cuatrimestral/etc.) tiene que componer la
// variación de los `plazoMeses` meses del período recién finalizado —
// no alcanza con tomar el valor de un solo mes.
export function computeMontoActualizado(pago, allPagos, indices, tipoActualizacion, plazoActualizacion) {
  const plazoMeses = PLAZO_MAP[plazoActualizacion] ?? 0

  // Períodos de actualización hasta este período (recalculado, no depende de DB)
  const updatePeriods = allPagos
    .filter(p => esActualizacion(p.periodo_numero, plazoActualizacion) && p.periodo_numero <= pago.periodo_numero)
    .sort((a, b) => a.periodo_numero - b.periodo_numero)

  // Sin actualizaciones previas → monto base
  if (updatePeriods.length === 0) return pago.monto_base

  let monto = pago.monto_base

  for (const up of updatePeriods) {
    // Meses que componen el período recién finalizado (los `plazoMeses` anteriores a esta actualización)
    const mesesPeriodo = allPagos.filter(
      p => p.periodo_numero >= up.periodo_numero - plazoMeses && p.periodo_numero <= up.periodo_numero - 1
    )

    let factor = 1
    for (const mp of mesesPeriodo) {
      const [y, m] = mp.periodo_inicio.split('-').map(Number)
      const idx = indices.find(i => i.tipo === tipoActualizacion && i.mes === m && i.anio === y)
      if (idx) factor *= (1 + idx.valor / 100)
    }
    monto = monto * factor
  }

  return Math.round(monto)
}
