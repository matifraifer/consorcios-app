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
  if (sockets.has(clienteId)) {
    console.log(`[wa:${clienteId}] ya hay una sesion activa, no se reinicia`)
    return
  }

  console.log(`[wa:${clienteId}] iniciando sesion`)
  const { state, saveCreds } = await useSupabaseAuthState(clienteId)
  const { version, isLatest } = await fetchLatestBaileysVersion()
  console.log(`[wa:${clienteId}] version de baileys ${version.join('.')} (ultima: ${isLatest})`)

  const sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false })
  sockets.set(clienteId, sock)
  console.log(`[wa:${clienteId}] socket creado, esperando eventos de conexion`)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    try {
      const { connection, qr, lastDisconnect } = update
      console.log(`[wa:${clienteId}] connection.update ->`, { connection, hasQr: !!qr })

      if (qr) {
        const qrDataUrl = await QRCode.toDataURL(qr)
        await updateSesion(clienteId, { estado: 'qr_pendiente', qr: qrDataUrl })
        console.log(`[wa:${clienteId}] QR generado y guardado`)
      }

      if (connection === 'open') {
        await updateSesion(clienteId, {
          estado: 'conectado',
          qr: null,
          numero: sock.user?.id?.split(':')[0] ?? null,
        })
        console.log(`[wa:${clienteId}] conectado como ${sock.user?.id}`)
      }

      if (connection === 'close') {
        sockets.delete(clienteId)
        const statusCode = lastDisconnect?.error?.output?.statusCode
        const loggedOut = statusCode === DisconnectReason.loggedOut
        console.log(`[wa:${clienteId}] conexion cerrada (statusCode=${statusCode}, loggedOut=${loggedOut})`, lastDisconnect?.error?.message)

        if (loggedOut) {
          await clearAuthState(clienteId)
          await updateSesion(clienteId, { estado: 'desconectado', qr: null, numero: null })
        } else {
          await updateSesion(clienteId, { estado: 'desconectado', qr: null })
          startSession(clienteId).catch((err) => console.error(`[wa:${clienteId}] reconexion fallida`, err))
        }
      }
    } catch (err) {
      console.error(`[wa:${clienteId}] error en connection.update`, err)
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
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
    } catch (err) {
      console.error(`[wa:${clienteId}] error guardando mensaje entrante`, err)
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

  const digits = telefono.replace(/\D/g, '')
  // No armamos el JID a mano: WhatsApp normaliza del lado del servidor casos
  // raros como el "9" de celular en Argentina. onWhatsApp() devuelve el JID
  // real si el numero esta registrado.
  const [lookup] = (await sock.onWhatsApp(digits)) ?? []
  console.log(`[wa:${clienteId}] onWhatsApp(${digits}) ->`, lookup)
  if (!lookup?.exists) {
    const err = new Error('Ese número no tiene WhatsApp o el formato no es válido')
    err.status = 400
    throw err
  }

  const sent = await sock.sendMessage(lookup.jid, { text: body })

  await supabaseAdmin.from('whatsapp_mensajes').insert({
    cliente_id: clienteId,
    telefono: digits,
    direction: 'saliente',
    body,
    wa_message_id: sent?.key?.id ?? null,
  })
}
