import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limit por IP: se llama antes de tener sesión (paso previo al login y
// a "olvidé mi contraseña"), así que no hay usuario para atar el límite.
// Reemplaza a la RPC pública email_for_username (ver ANALISIS_SEGURIDAD.md,
// punto 4) — acá sí se puede ver la IP real de quien llama, algo que la RPC
// vía PostgREST no podía (veía la IP del pooler, no la del cliente).
const VENTANA_MINUTOS = 15
const MAX_INTENTOS = 20

function ipDelRequest(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded ? forwarded.split(',')[0].trim() : 'desconocida'
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { username } = await req.json().catch(() => ({ username: null }))
    if (!username) {
      return new Response(JSON.stringify({ error: 'Falta username.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const ip = ipDelRequest(req)
    const desde = new Date(Date.now() - VENTANA_MINUTOS * 60 * 1000).toISOString()

    const { count, error: countError } = await supabase
      .from('resolve_username_intentos')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', desde)
    if (countError) throw countError

    if ((count ?? 0) >= MAX_INTENTOS) {
      return new Response(JSON.stringify({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' }), {
        status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('resolve_username_intentos').insert({ ip })

    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('email')
      .eq('nombre_usuario', username)
      .maybeSingle()
    if (usuarioError) throw usuarioError

    // Delay parejo exista o no el usuario, para no filtrar por timing.
    await sleep(300)

    return new Response(JSON.stringify({ email: usuario?.email ?? null }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? 'Error interno.' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
