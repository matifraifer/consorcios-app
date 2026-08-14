const MS_POR_DIA = 1000 * 60 * 60 * 24

// Saldo último período / saldo en mora / interés de mora por departamento.
// periodos viene ordenado desc (más reciente primero); solo incluye períodos cerrados.
// Compartido entre ConsorcioDetalle.jsx (pestaña Liquidaciones) y ConsultaDeudaPublica.jsx
// para que ambos calculen el saldo exactamente igual.
export function calcularSaldosMora(departamentos, periodos, expensas, tasaMora) {
  const ultimoPeriodo = periodos[0] ?? null
  const hoy = new Date()

  return departamentos.map(dep => {
    let saldoUltimo = 0
    let saldoMora = 0
    let interesMora = 0

    for (const periodo of periodos) {
      const exp = expensas.find(e => e.periodo_id === periodo.id && e.departamento_id === dep.id)
      if (!exp || exp.pagado) continue

      const saldo = Math.max(0, Number(exp.monto_total ?? 0) - Number(exp.monto_pagado ?? 0))
      if (saldo <= 0) continue

      if (ultimoPeriodo && periodo.id === ultimoPeriodo.id) {
        saldoUltimo += saldo
      } else {
        saldoMora += saldo
      }

      if (periodo.fecha_vencimiento) {
        const vencimiento = new Date(periodo.fecha_vencimiento)
        const diasAtraso = (hoy - vencimiento) / MS_POR_DIA
        const mesesAtraso = Math.floor(diasAtraso / 30)
        if (mesesAtraso > 0) {
          interesMora += saldo * (Number(tasaMora || 0) / 100) * mesesAtraso
        }
      }
    }

    return {
      departamento_id: dep.id,
      numeracion: dep.numeracion,
      propietario: dep.propietario_apellido ? `${dep.propietario_apellido}, ${dep.propietario_nombre}` : null,
      inquilino: dep.inquilino,
      activo: dep.activo,
      saldoUltimo,
      saldoMora,
      interesMora,
      saldoTotal: saldoUltimo + saldoMora + interesMora,
    }
  })
}
