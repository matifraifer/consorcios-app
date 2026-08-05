import { Router } from 'express'
import { requireClienteAccess } from './middleware/auth.js'
import { startSession, stopSession, sendMessage } from './sessions.js'

const router = Router()

// Límite simple de envíos por cliente_id, para no habilitar blasteo masivo
// desde este MVP (riesgo de ban del número por comportamiento de spam).
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000
const sendLog = new Map() // clienteId -> timestamps[]

function underRateLimit(clienteId) {
  const now = Date.now()
  const timestamps = (sendLog.get(clienteId) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (timestamps.length >= RATE_LIMIT) {
    sendLog.set(clienteId, timestamps)
    return false
  }
  timestamps.push(now)
  sendLog.set(clienteId, timestamps)
  return true
}

router.post('/sessions/:clienteId/connect', requireClienteAccess, async (req, res) => {
  try {
    await startSession(req.params.clienteId)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/sessions/:clienteId/disconnect', requireClienteAccess, async (req, res) => {
  try {
    await stopSession(req.params.clienteId)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/sessions/:clienteId/send', requireClienteAccess, async (req, res) => {
  const { telefono, body } = req.body ?? {}
  if (!telefono || !body) {
    return res.status(400).json({ error: 'Faltan telefono o body' })
  }
  if (!underRateLimit(req.params.clienteId)) {
    return res.status(429).json({ error: 'Límite de mensajes por minuto alcanzado' })
  }

  try {
    await sendMessage(req.params.clienteId, telefono, body)
    res.json({ ok: true })
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message })
  }
})

export default router
