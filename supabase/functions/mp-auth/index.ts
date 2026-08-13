import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// .trim() defensivo: es comun que copiar/pegar el secret desde el panel de MP
// arrastre un espacio o salto de linea, y eso alcanza para que MP responda
// invalid_client aunque el valor "se vea" bien.
const MP_CLIENT_ID     = (Deno.env.get('MP_CLIENT_ID') ?? '').trim()
const MP_CLIENT_SECRET = (Deno.env.get('MP_CLIENT_SECRET') ?? '').trim()
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Mientras se integra en ambiente de prueba: con test_token=true, Mercado Pago
// devuelve un access_token tipo TEST (solo sirve en sandbox) sin necesitar la
// cuenta de producción activada. Sacar el secret MP_TEST_MODE (o ponerlo en
// 'false') cuando se pase a producción real.
const MP_TEST_MODE = Deno.env.get('MP_TEST_MODE') === 'true'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { code, redirect_uri, cliente_id } = await req.json()

    if (!code || !redirect_uri || !cliente_id) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros requeridos.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    console.log(`mp-auth: client_id="${MP_CLIENT_ID}" (len ${MP_CLIENT_ID.length}), client_secret len ${MP_CLIENT_SECRET.length}, test_mode=${MP_TEST_MODE}`)

    // Intercambiar code por tokens
    const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     MP_CLIENT_ID,
        client_secret: MP_CLIENT_SECRET,
        code,
        redirect_uri,
        ...(MP_TEST_MODE ? { test_token: 'true' } : {}),
      }),
    })

    const tokens = await tokenRes.json()

    if (!tokenRes.ok) {
      return new Response(JSON.stringify({ error: tokens }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { error: dbError } = await supabase
      .from('mp_tokens')
      .upsert({
        cliente_id,
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        public_key:    tokens.public_key ?? null,
        mp_user_id:    String(tokens.user_id),
        expires_at:    expiresAt,
      }, { onConflict: 'cliente_id' })

    if (dbError) throw dbError

    return new Response(JSON.stringify({ success: true, mp_user_id: tokens.user_id }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? 'Error interno.' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
