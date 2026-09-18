// Estadísticas derivadas de las tareas de una etapa — usado tanto por la
// grilla de "Etapas del proyecto" como por el Diagrama de Gantt, para que
// ambas vistas siempre muestren los mismos números.
export function calcEtapaStats(etapa) {
  const tareas = etapa.tareas_etapa || []
  const total = tareas.length
  const finalizadas = tareas.filter(t => t.estado === 'finalizado').length
  const bloqueadas = tareas.filter(t => t.estado === 'bloqueado').length
  const avance = total ? Math.round((finalizadas / total) * 100) : 0
  const fechasInicio = tareas.map(t => t.fecha_inicio).filter(Boolean).sort()
  const fechasFin = tareas.map(t => t.fecha_fin).filter(Boolean).sort()
  const costoPresupuestado = tareas.reduce((s, t) => s + Number(t.costo_presupuestado || 0), 0)
  const costoReal = tareas.reduce((s, t) => s + Number(t.costo_real || 0), 0)
  return {
    total,
    bloqueadas,
    avance,
    fechaInicio: fechasInicio[0] ?? null,
    fechaFin: fechasFin[fechasFin.length - 1] ?? null,
    costoPresupuestado,
    costoReal,
  }
}
