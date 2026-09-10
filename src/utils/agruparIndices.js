export const MESES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const PERIODOS = {
  mensual: { label: 'Mensual', meses: 1 },
  bimestral: { label: 'Bimestral', meses: 2 },
  trimestral: { label: 'Trimestral', meses: 3 },
  cuatrimestral: { label: 'Cuatrimestral', meses: 4 },
  anual: { label: 'Anual', meses: 12 },
}

// Agrupa registros mensuales de índices en bloques calendario (ancla en enero:
// bimestral = Ene-Feb/Mar-Abr/..., trimestral = Ene-Mar/Abr-Jun/..., etc.)
// componiendo la variación de los meses de cada bloque (interés compuesto),
// no sumándolos.
export function agruparIndices(indices, periodo) {
  const size = PERIODOS[periodo]?.meses ?? 1

  const grupos = new Map()
  for (const i of indices) {
    const mesInicio = Math.floor((i.mes - 1) / size) * size + 1
    const key = `${i.tipo}|${i.anio}|${mesInicio}`
    if (!grupos.has(key)) {
      grupos.set(key, { tipo: i.tipo, anio: i.anio, mesInicio, mesFin: Math.min(mesInicio + size - 1, 12), factor: 1, meses: 0 })
    }
    const g = grupos.get(key)
    g.factor *= (1 + Number(i.valor) / 100)
    g.meses += 1
  }

  return [...grupos.values()]
    .map(g => ({
      tipo: g.tipo,
      anio: g.anio,
      mesInicio: g.mesInicio,
      mesFin: g.mesFin,
      valor: (g.factor - 1) * 100,
      mesesCompuestos: g.meses,
    }))
    .sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mesInicio - b.mesInicio)
}

export function labelPeriodo({ mesInicio, mesFin, anio }, periodo) {
  if (periodo === 'anual') return String(anio)
  const yy = String(anio).slice(-2)
  if (periodo === 'mensual' || mesInicio === mesFin) return `${MESES_SHORT[mesInicio - 1]} ${yy}`
  return `${MESES_SHORT[mesInicio - 1]}-${MESES_SHORT[mesFin - 1]} ${yy}`
}

export function labelPeriodoLargo({ mesInicio, mesFin, anio }, periodo) {
  const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  if (periodo === 'anual') return String(anio)
  if (periodo === 'mensual' || mesInicio === mesFin) return `${MESES_LARGO[mesInicio - 1]} ${anio}`
  return `${MESES_LARGO[mesInicio - 1]} - ${MESES_LARGO[mesFin - 1]} ${anio}`
}
