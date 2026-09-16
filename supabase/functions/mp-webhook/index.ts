import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Clave secreta de la aplicación de Mercado Pago (panel Developers → tu app →
// Webhooks → "Firma secreta"), no confundir con MP_CLIENT_SECRET. Es una sola
// para toda la plataforma, no por cliente/consorcio.
const MP_WEBHOOK_SECRET = Deno.env.get('MP_WEBHOOK_SECRET')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mercado Pago manda la notificación como query params (?type=payment&data.id=123
// o ?topic=payment&id=123) y también repite la info en el body JSON según la
// versión de webhook configurada. Contemplamos ambas formas.
async function extraerPaymentId(req: Request): Promise<string | null> {
  const url = new URL(req.url)
  const porQuery = url.searchParams.get('data.id') ?? url.searchParams.get('id')
  if (porQuery) return porQuery

  try {
    const body = await req.json()
    return body?.data?.id ?? body?.id ?? null
  } catch {
    return null
  }
}

// Valida la firma que Mercado Pago manda en el header `x-signature`
// (formato "ts=<timestamp>,v1=<hash>"), calculada como HMAC-SHA256 sobre
// "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" con la firma secreta de
// la app. Docs: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks#editor_5
async function validarFirma(req: Request, paymentId: string): Promise<boolean> {
  const xSignature = req.headers.get('x-signature')
  const xRequestId = req.headers.get('x-request-id')
  if (!xSignature || !xRequestId) return false

  const partes = Object.fromEntries(
    xSignature.split(',').map(p => p.trim().split('=').map(s => s.trim()))
  )
  const ts = partes.ts
  const hashRecibido = partes.v1
  if (!ts || !hashRecibido) return false

  const template = `id:${paymentId.toLowerCase()};request-id:${xRequestId};ts:${ts};`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(MP_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const firma = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(template))
  const hashCalculado = Array.from(new Uint8Array(firma)).map(b => b.toString(16).padStart(2, '0')).join('')

  return hashCalculado === hashRecibido
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Siempre respondemos 200 salvo error interno: si no hay pago que procesar
  // no tiene sentido que Mercado Pago reintente.
  try {
    const url = new URL(req.url)
    const pagoId = url.searchParams.get('pago_id')
    const paymentId = await extraerPaymentId(req)

    if (!pagoId || !paymentId) {
      return new Response(JSON.stringify({ ok: true, skipped: 'faltan identificadores' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Corta acá, antes de tocar la base o la API de MP, si la firma no matchea.
    // 401 no genera reintentos de Mercado Pago (a diferencia de un 5xx).
    if (!(await validarFirma(req, paymentId))) {
      return new Response(JSON.stringify({ error: 'Firma inválida.' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: pago, error: pagoError } = await supabase
      .from('mp_pagos')
      .select('id, cliente_id, departamento_id, periodos_ids, estado')
      .eq('id', pagoId)
      .maybeSingle()
    if (pagoError) throw pagoError
    if (!pago || pago.estado === 'aprobado') {
      return new Response(JSON.stringify({ ok: true, skipped: 'pago no encontrado o ya procesado' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const { data: mpToken, error: mpTokenError } = await supabase
      .from('mp_tokens')
      .select('access_token')
      .eq('cliente_id', pago.cliente_id)
      .maybeSingle()
    if (mpTokenError) throw mpTokenError
    if (!mpToken) {
      return new Response(JSON.stringify({ ok: true, skipped: 'sin token del cliente' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Nunca confiamos en el payload del webhook a ciegas: confirmamos el pago
    // directo contra la API de Mercado Pago con el access_token del cliente.
    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken.access_token}` },
    })
    if (!paymentRes.ok) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no se pudo consultar el pago' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const payment = await paymentRes.json()

    if (payment.status === 'approved') {
      await supabase
        .from('mp_pagos')
        .update({ estado: 'aprobado', mp_payment_id: String(paymentId), updated_at: new Date().toISOString() })
        .eq('id', pago.id)

      for (const periodoId of pago.periodos_ids as number[]) {
        const { data: exp } = await supabase
          .from('expensas_departamento')
          .select('monto_total')
          .eq('departamento_id', pago.departamento_id)
          .eq('periodo_id', periodoId)
          .maybeSingle()
        if (!exp) continue

        await supabase
          .from('expensas_departamento')
          .update({ pagado: true, monto_pagado: exp.monto_total })
          .eq('departamento_id', pago.departamento_id)
          .eq('periodo_id', periodoId)
      }
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      await supabase
        .from('mp_pagos')
        .update({ estado: 'rechazado', mp_payment_id: String(paymentId), updated_at: new Date().toISOString() })
        .eq('id', pago.id)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? 'Error interno.' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
