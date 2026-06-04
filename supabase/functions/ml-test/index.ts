import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { cliente_id } = await req.json()

    if (!cliente_id) {
      return new Response(JSON.stringify({ error: 'Falta cliente_id.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: token, error: dbError } = await supabase
      .from('ml_tokens')
      .select('access_token, expires_at, ml_user_id')
      .eq('cliente_id', cliente_id)
      .maybeSingle()

    if (dbError) throw dbError
    if (!token) {
      return new Response(JSON.stringify({ connected: false, error: 'No hay token guardado.' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Llamada real a la API de MercadoLibre
    const mlRes = await fetch('https://api.mercadolibre.com/users/me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    })

    if (!mlRes.ok) {
      return new Response(JSON.stringify({ connected: false, error: 'Token inválido o expirado.' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const mlUser = await mlRes.json()

    return new Response(JSON.stringify({
      connected: true,
      nickname: mlUser.nickname,
      email:    mlUser.email,
      ml_user_id: mlUser.id,
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ connected: false, error: err.message ?? 'Error interno.' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
