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

// El JID de un numero puede venir con sufijo de dispositivo (ej. "...:0"),
// que hay que descartar para quedarnos solo con el numero.
function numeroDeJid(jid) {
  return jid.split('@')[0].split(':')[0]
}

// WhatsApp reemplazó el numero de telefono por un identificador opaco ("LID")
// en remoteJid para contactos ya migrados. Si no lo resolvemos, terminamos
// guardando el LID como si fuera el numero real. remoteJidAlt suele traer ya
// el JID de telefono cuando Baileys lo conoce; si no, se lo pedimos al
// signalRepository (que mantiene el mapeo LID <-> numero).
async function resolveTelefono(sock, key, clienteId) {
  const jid = key.remoteJid
  if (!jid) return null
  if (!jid.endsWith('@lid')) return numeroDeJid(jid)

  if (key.remoteJidAlt) return numeroDeJid(key.remoteJidAlt)

  try {
    const pn = await sock.signalRepository.lidMapping.getPNForLID(jid)
    if (pn) return numeroDeJid(pn)
  } catch (err) {
    console.error(`[wa:${clienteId}] no se pudo resolver LID ${jid}`, err)
  }

  console.warn(`[wa:${clienteId}] no se encontro numero real para LID ${jid}, se descarta el mensaje`)
  return null
}

// Grupos (@g.us) y estados/broadcast no son conversaciones 1:1 con un
// contacto -- no tiene sentido guardarlos como si fueran un "telefono".
function esChatIndividual(jid) {
  return !!jid && (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid'))
}

function extraerTexto(m) {
  return m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? null
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

  const sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false, syncFullHistory: true })
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

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    console.log(`[wa:${clienteId}] messages.upsert (type=${type}) x${messages.length}`)
    try {
      for (const m of messages) {
        if (m.key.fromMe) continue
        if (!esChatIndividual(m.key.remoteJid)) continue
        const body = extraerTexto(m)
        if (!body) continue

        const telefono = await resolveTelefono(sock, m.key, clienteId)
        if (!telefono) continue

        const { error } = await supabaseAdmin.from('whatsapp_mensajes').upsert({
          cliente_id: clienteId,
          telefono,
          direction: 'entrante',
          body,
          wa_message_id: m.key.id,
          leido: false,
        }, { onConflict: 'cliente_id,wa_message_id', ignoreDuplicates: true })
        if (error) throw error
        console.log(`[wa:${clienteId}] mensaje entrante guardado, telefono=${telefono}`)
      }
    } catch (err) {
      console.error(`[wa:${clienteId}] error guardando mensaje entrante`, err)
    }
  })

  // Al vincular un dispositivo nuevo, WhatsApp manda una tanda de mensajes
  // historicos (recientes, no todo el historial) por este evento -- una sola
  // vez, en el primer pairing. Reconexiones posteriores con las mismas
  // credenciales no vuelven a dispararlo.
  sock.ev.on('messaging-history.set', async ({ messages, isLatest }) => {
    console.log(`[wa:${clienteId}] messaging-history.set x${messages.length} (isLatest=${isLatest})`)
    try {
      const filas = []
      for (const m of messages) {
        if (!esChatIndividual(m.key.remoteJid)) continue
        const body = extraerTexto(m)
        if (!body) continue

        const telefono = await resolveTelefono(sock, m.key, clienteId)
        if (!telefono) continue

        const ts = Number(m.messageTimestamp) || Math.floor(Date.now() / 1000)
        filas.push({
          cliente_id: clienteId,
          telefono,
          direction: m.key.fromMe ? 'saliente' : 'entrante',
          body,
          wa_message_id: m.key.id,
          leido: true,
          created_at: new Date(ts * 1000).toISOString(),
        })
      }
      if (!filas.length) return

      const { error } = await supabaseAdmin
        .from('whatsapp_mensajes')
        .upsert(filas, { onConflict: 'cliente_id,wa_message_id', ignoreDuplicates: true })
      if (error) throw error
      console.log(`[wa:${clienteId}] historial sincronizado: ${filas.length} mensajes guardados`)
    } catch (err) {
      console.error(`[wa:${clienteId}] error sincronizando historial`, err)
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
