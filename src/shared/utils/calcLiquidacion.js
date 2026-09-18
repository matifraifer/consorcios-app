// Calcula el monto que le corresponde a cada departamento considerando
// la asignación por gasto y la distribución por coeficiente o igualitaria.
// Compartido entre ExpensasDetalle.jsx y GastosPeriodoDrawer.jsx para que
// ambos calculen la liquidación exactamente igual.
export function calcLiquidacion(departamentos, gastos) {
  return departamentos.map(dep => {
    let monto_ord = 0
    let monto_ext = 0

    for (const g of gastos) {
      // Subconjunto de departamentos asignados a este gasto
      const asignados = (!g.departamentos_ids?.length)
        ? departamentos
        : departamentos.filter(d => g.departamentos_ids.includes(d.id))

      // ¿Este departamento participa en este gasto?
      if (!asignados.some(d => d.id === dep.id)) continue

      const someHaveCoef = asignados.some(d => d.coeficiente)

      let share
      if (!someHaveCoef) {
        // Distribución igualitaria dentro del subconjunto
        share = Number(g.monto) / (asignados.length || 1)
      } else if (!dep.coeficiente) {
        // Este dept no tiene coeficiente pero otros sí → excluido de este gasto
        continue
      } else {
        // Distribución por coeficiente, normalizado al subconjunto
        const totalCoef = asignados
          .filter(d => d.coeficiente)
          .reduce((s, d) => s + Number(d.coeficiente), 0)
        share = totalCoef > 0 ? Number(g.monto) * (Number(dep.coeficiente) / totalCoef) : 0
      }

      if (g.tipo === 'ordinario') monto_ord += share
      else monto_ext += share
    }

    // ¿El dept queda excluido de algún gasto al que estaba asignado?
    const hasProblematicGastos = gastos.some(g => {
      const asig = (!g.departamentos_ids?.length)
        ? departamentos
        : departamentos.filter(d => g.departamentos_ids.includes(d.id))
      return asig.some(d => d.id === dep.id) && asig.some(d => d.coeficiente) && !dep.coeficiente
    })

    return {
      departamento_id:      dep.id,
      numeracion:           dep.numeracion,
      propietario:          dep.propietario_apellido ? `${dep.propietario_apellido}, ${dep.propietario_nombre}` : '-',
      coeficiente:          dep.coeficiente,
      monto_ordinario:      monto_ord,
      monto_extraordinario: monto_ext,
      monto_total:          monto_ord + monto_ext,
      hasProblematicGastos,
    }
  })
}
