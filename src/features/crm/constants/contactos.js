// Clasificación de contactos: listas usadas por el formulario, la importación
// por Excel, los filtros y los badges. Los valores se guardan tal cual en la base
// (contactos.origen_contacto, contactos.tipos/tipo, contactos.embudo_contacto).

export const ORIGENES_CONTACTO = [
  'AMIGO', 'FAMILIAR', 'COMPAÑERO', 'CARTEL/INTERNET', 'REDES SOCIALES', 'OTROS',
]

export const TIPOS_CONTACTO = [
  'PROPIETARIO', 'COMPRADOR', 'INQUILINO', 'PROFESIONAL', 'INFLUENCER',
  'INVERSOR', 'COLEGA', 'CONSTRUCTOR', 'ALIANZA COMERCIAL',
]

export const EMBUDO_CONTACTO = ['PROSPECTO', '1er contacto', '2do contacto', '3er contacto']

// Tipos asignados automáticamente al vincular un contacto desde un contrato
export const TIPO_PROPIETARIO = 'PROPIETARIO'
export const TIPO_INQUILINO   = 'INQUILINO'
export const TIPO_COMPRADOR   = 'COMPRADOR'

const NEUTRAL = { color: '#374151', bg: '#F3F4F6', border: '#E5E7EB' }

export const TIPO_CONTACTO_META = {
  PROPIETARIO:         { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0' },
  COMPRADOR:           { color: '#6D28D9', bg: '#F5F3FF', border: '#DDD6FE' },
  INQUILINO:           { color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  PROFESIONAL:         { color: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC' },
  INFLUENCER:          { color: '#BE185D', bg: '#FDF2F8', border: '#FBCFE8' },
  INVERSOR:            { color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
  COLEGA:              { color: '#4338CA', bg: '#EEF2FF', border: '#C7D2FE' },
  CONSTRUCTOR:         { color: '#9A3412', bg: '#FFF7ED', border: '#FED7AA' },
  'ALIANZA COMERCIAL': { color: '#115E59', bg: '#F0FDFA', border: '#99F6E4' },
}

export function tipoContactoMeta(tipo) {
  return TIPO_CONTACTO_META[tipo] ?? NEUTRAL
}

export function getContactTipos(c) {
  if (c?.tipos?.length) return c.tipos
  return c?.tipo ? [c.tipo] : []
}

// Busca el valor de la lista sin distinguir mayúsculas/minúsculas ni espacios extra
export function matchOpcion(lista, valor) {
  const v = String(valor ?? '').trim().toLowerCase()
  if (!v) return null
  return lista.find(o => o.toLowerCase() === v) ?? null
}
