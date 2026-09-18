// Estados posibles de una tarea, con los colores usados en toda la sección
// de "Gestión de proyectos" (grilla de etapas, resumen, etc.) para que una
// tarea "bloqueada" se vea igual en cualquier pantalla.
export const ESTADOS_TAREA = [
  { value: 'pendiente', label: 'Pendiente', bg: '#F1F5F9', color: '#475569' },
  { value: 'en_curso', label: 'En curso', bg: '#EFF6FF', color: '#1D4ED8' },
  { value: 'bloqueado', label: 'Bloqueado', bg: '#FEF2F2', color: '#DC2626' },
  { value: 'finalizado', label: 'Finalizado', bg: '#ECFDF5', color: '#065F46' },
]

export function estadoTareaInfo(estado) {
  return ESTADOS_TAREA.find(e => e.value === estado) ?? ESTADOS_TAREA[0]
}
