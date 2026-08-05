import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys'
import { supabaseAdmin } from './supabaseAdmin.js'

// Reemplaza useMultiFileAuthState (disco efímero en Railway) por una fila en
// whatsapp_sesiones.auth_state. BufferJSON.replacer/reviver son necesarios
// porque las creds/keys de Baileys contienen Buffers y Uint8Arrays que JSON
// no serializa de forma nativa.
function toJsonSafe(value) {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer))
}

function fromJsonSafe(value) {
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver)
}

export async function useSupabaseAuthState(clienteId) {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_sesiones')
    .select('auth_state')
    .eq('cliente_id', clienteId)
    .maybeSingle()
  if (error) throw error

  const stored = data?.auth_state ? fromJsonSafe(data.auth_state) : null
  const creds = stored?.creds ?? initAuthCreds()
  const keys = stored?.keys ?? {}

  async function persist() {
    await supabaseAdmin.from('whatsapp_sesiones').upsert({
      cliente_id: clienteId,
      auth_state: toJsonSafe({ creds, keys }),
      updated_at: new Date().toISOString(),
    })
  }

  const state = {
    creds,
    keys: {
      get: async (type, ids) => {
        const result = {}
        for (const id of ids) {
          const value = keys[type]?.[id]
          if (value !== undefined) result[id] = value
        }
        return result
      },
      set: async (data) => {
        for (const type of Object.keys(data)) {
          keys[type] = { ...(keys[type] ?? {}), ...data[type] }
        }
        await persist()
      },
    },
  }

  return { state, saveCreds: persist }
}

export async function clearAuthState(clienteId) {
  await supabaseAdmin
    .from('whatsapp_sesiones')
    .update({ auth_state: null })
    .eq('cliente_id', clienteId)
}
