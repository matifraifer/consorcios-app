// Fechas de recordatorios (recordatorios_contacto.fecha es 'YYYY-MM-DD', hora 'HH:MM:SS').
// Se comparan como texto en la fecha local para no correr el día por la zona horaria.

const pad = n => String(n).padStart(2, '0')

export function hoyISO(dias = 0) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fmtFechaISO(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function fmtHora(hora) {
  return hora ? String(hora).slice(0, 5) : ''
}

// 'vencido' | 'hoy' | 'manana' | 'futuro'
export function estadoRecordatorio(fecha) {
  if (!fecha) return 'futuro'
  const hoy = hoyISO()
  if (fecha < hoy) return 'vencido'
  if (fecha === hoy) return 'hoy'
  if (fecha === hoyISO(1)) return 'manana'
  return 'futuro'
}

export const ESTADO_RECORDATORIO_META = {
  vencido: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  hoy:     { color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  manana:  { color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  futuro:  { color: '#374151', bg: '#F3F4F6', border: '#E5E7EB' },
}

// Días entre hoy y la fecha (negativo = pasada)
export function diasDesdeHoy(fecha) {
  const [y, m, d] = String(fecha).slice(0, 10).split('-').map(Number)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.round((new Date(y, m - 1, d) - hoy) / 86400000)
}

// "Hoy", "Mañana", "Hace 3 días", "Viernes", "12 nov"
export function fechaRelativa(fecha) {
  if (!fecha) return ''
  const n = diasDesdeHoy(fecha)
  if (n === 0) return 'Hoy'
  if (n === 1) return 'Mañana'
  if (n === -1) return 'Ayer'
  if (n < 0) return `Hace ${-n} días`
  const [y, m, d] = String(fecha).slice(0, 10).split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const texto = n < 7
    ? date.toLocaleDateString('es-AR', { weekday: 'long' })
    : date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', ...(y !== new Date().getFullYear() && { year: 'numeric' }) }).replace(/\./g, '')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function etiquetaFecha(fecha) {
  const estado = estadoRecordatorio(fecha)
  if (estado === 'hoy') return 'Hoy'
  if (estado === 'manana') return 'Mañana'
  if (estado === 'vencido') return `Vencido · ${fmtFechaISO(fecha)}`
  return fmtFechaISO(fecha)
}
