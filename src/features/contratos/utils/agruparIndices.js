export const MESES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const PERIODOS = {
  mensual: { label: 'Mensual', meses: 1 },
  bimestral: { label: 'Bimestral', meses: 2 },
  trimestral: { label: 'Trimestral', meses: 3 },
  cuatrimestral: { label: 'Cuatrimestral', meses: 4 },
  anual: { label: 'Anual', meses: 12 },
}

const COLORES_BASE = { IPC: '#2a78d6', ICL: '#eb6834' }
const COLORES_EXTRA = ['#7c3aed', '#0891b2', '#db2777', '#ca8a04', '#16a34a', '#64748b']

// Tipos presentes en `indices` (IPC/ICL primero, después los propios en orden
// alfabético), cada uno con un color estable según su posición.
export function listarTiposIndices(indices) {
  const extras = [...new Set(indices.map(i => i.tipo))]
    .filter(t => t && !(t in COLORES_BASE))
    .sort((a, b) => a.localeCompare(b))
  const base = Object.keys(COLORES_BASE).filter(t => indices.some(i => i.tipo === t))
  return [
    ...base.map(tipo => ({ tipo, color: COLORES_BASE[tipo] })),
    ...extras.map((tipo, idx) => ({ tipo, color: COLORES_EXTRA[idx % COLORES_EXTRA.length] })),
  ]
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
