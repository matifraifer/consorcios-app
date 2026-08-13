import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
