import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import QRCode from 'qrcode'
import pino from 'pino'
import { supabaseAdmin } from './supabaseAdmin.js'
import { useSupabaseAuthState, clearAuthState } from './authState.js'

const logger = pino({ level: 'warn' })

// Un socket activo por cliente_id. No persiste entre restarts del proceso:
// tras un restart, startSession() se vuelve a llamar con las credenciales
// guardadas en whatsapp_sesiones.auth_state (sin re-escanear el QR), salvo
// que la sesión haya sido cerrada desde el teléfono.
const sockets = new Map()

async function updateSesion(clienteId, fields) {
  await supabaseAdmin
    .from('whatsapp_sesiones')
    .upsert({ cliente_id: clienteId, updated_at: new Date().toISOString(), ...fields })
}

export function isConnected(clienteId) {
  return sockets.has(clienteId)
}

export async function startSession(clienteId) {
  if (sockets.has(clienteId)) return

  const { state, saveCreds } = await useSupabaseAuthState(clienteId)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false })
  sockets.set(clienteId, sock)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update

    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr)
      await updateSesion(clienteId, { estado: 'qr_pendiente', qr: qrDataUrl })
    }

    if (connection === 'open') {
      await updateSesion(clienteId, {
        estado: 'conectado',
        qr: null,
        numero: sock.user?.id?.split(':')[0] ?? null,
      })
    }

    if (connection === 'close') {
      sockets.delete(clienteId)
      const loggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut

      if (loggedOut) {
        await clearAuthState(clienteId)
        await updateSesion(clienteId, { estado: 'desconectado', qr: null, numero: null })
      } else {
        await updateSesion(clienteId, { estado: 'desconectado', qr: null })
        startSession(clienteId).catch((err) => logger.error(err, 'reconexión fallida'))
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of messages) {
      if (m.key.fromMe) continue
      const body = m.message?.conversation ?? m.message?.extendedTextMessage?.text
      if (!body) continue

      const telefono = m.key.remoteJid?.split('@')[0]
      if (!telefono) continue

      await supabaseAdmin.from('whatsapp_mensajes').insert({
        cliente_id: clienteId,
        telefono,
        direction: 'entrante',
        body,
        wa_message_id: m.key.id,
      })
    }
  })
}

export async function stopSession(clienteId) {
  const sock = sockets.get(clienteId)
  if (sock) {
    await sock.logout().catch(() => {})
    sockets.delete(clienteId)
  }
  await clearAuthState(clienteId)
  await updateSesion(clienteId, { estado: 'desconectado', qr: null, numero: null })
}

export async function sendMessage(clienteId, telefono, body) {
  const sock = sockets.get(clienteId)
  if (!sock) {
    const err = new Error('No hay una sesión de WhatsApp conectada para este cliente')
    err.status = 409
    throw err
  }

  const jid = `${telefono.replace(/\D/g, '')}@s.whatsapp.net`
  const sent = await sock.sendMessage(jid, { text: body })

  await supabaseAdmin.from('whatsapp_mensajes').insert({
    cliente_id: clienteId,
    telefono: telefono.replace(/\D/g, ''),
    direction: 'saliente',
    body,
    wa_message_id: sent?.key?.id ?? null,
  })
}
