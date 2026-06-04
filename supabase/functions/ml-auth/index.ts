import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ML_CLIENT_ID     = Deno.env.get('ML_CLIENT_ID')!
const ML_CLIENT_SECRET = Deno.env.get('ML_CLIENT_SECRET')!
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    // Intercambiar code por tokens
    const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     ML_CLIENT_ID,
        client_secret: ML_CLIENT_SECRET,
        code,
        redirect_uri,
      }),
    })

    const tokens = await tokenRes.json()

    if (!tokenRes.ok) {
      return new Response(JSON.stringify({ error: tokens }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { error: dbError } = await supabase
      .from('ml_tokens')
      .upsert({
        cliente_id,
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        ml_user_id:    String(tokens.user_id),
        expires_at:    expiresAt,
      }, { onConflict: 'cliente_id' })

    if (dbError) throw dbError

    return new Response(JSON.stringify({ success: true, ml_user_id: tokens.user_id }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? 'Error interno.' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
