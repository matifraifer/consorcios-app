import { Avatar } from '@mui/material'

// Avatar con las iniciales del nombre y un color estable por nombre.
// Lo usan el drawer "Actividad del contacto" y los recordatorios del inicio.

const AVATAR_TONOS = [
  { bg: '#ECFDF5', fg: '#065F46' }, { bg: '#EFF6FF', fg: '#1D4ED8' }, { bg: '#F5F3FF', fg: '#6D28D9' },
  { bg: '#FFFBEB', fg: '#B45309' }, { bg: '#FDF2F8', fg: '#BE185D' }, { bg: '#F0FDFA', fg: '#0F766E' },
]

export default function Iniciales({ nombre, size = 28 }) {
  const n = nombre || '?'
  const tono = AVATAR_TONOS[[...n].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % AVATAR_TONOS.length]
  const iniciales = n.split(/[\s,._-]+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'
  return (
    <Avatar sx={{ width: size, height: size, fontSize: size * 0.38, fontWeight: 700, bgcolor: tono.bg, color: tono.fg, flexShrink: 0 }}>
      {iniciales}
    </Avatar>
  )
}
