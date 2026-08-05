import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CONSULTA_BASE_URL = 'https://app.granito.com.ar/consulta'
const EMAIL_FROM = 'no-reply@granito.com.ar'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { departamento_id } = await req.json()

    if (!departamento_id) {
      return new Response(JSON.stringify({ error: 'Falta departamento_id.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: depto, error: deptoError } = await supabase
      .from('departamentos')
      .select('numeracion, email, token_consulta, consorcios(nombre)')
      .eq('id', departamento_id)
      .single()

    if (deptoError) throw deptoError
    if (!depto?.email) {
      return new Response(JSON.stringify({ error: 'El departamento no tiene email cargado.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const link = `${CONSULTA_BASE_URL}/${depto.token_consulta}`
    const consorcioNombre = depto.consorcios?.nombre ?? ''

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: depto.email,
        subject: `Consulta de deuda — ${consorcioNombre}`,
        html: `
          <p>Hola,</p>
          <p>Podés consultar el estado de deuda de la unidad <strong>${depto.numeracion}</strong> en <strong>${consorcioNombre}</strong> ingresando al siguiente link:</p>
          <p><a href="${link}">${link}</a></p>
          <p>Te vamos a pedir tu email y el número de unidad para validar el acceso.</p>
        `,
      }),
    })

    const emailData = await emailRes.json()

    if (!emailRes.ok) {
      return new Response(JSON.stringify({ error: emailData }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? 'Error interno.' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
