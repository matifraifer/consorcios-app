import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Pública (anon) — la llama el Portal del Vecino para dibujar la firma de la
// inmobiliaria en el recibo del inquilino. El bucket "firmas" es privado, así que
// anon no puede leerlo directo: acá se valida el acceso con las mismas RPC del
// portal (token + DNI, o cliente + DNI) y recién ahí se devuelve una signed URL corta.

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const SIGNED_URL_SEGUNDOS = 120

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { token, cliente_id, dni, pago_id } = await req.json()
    if (!dni || !pago_id || (!token && !cliente_id)) {
      return json({ error: 'Faltan parámetros requeridos.' }, 400)
    }

    // Mismas RPC que usa el portal, con la anon key: si el DNI no corresponde al
    // token/cliente, no devuelven el contrato y el pago no aparece.
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data, error } = token
      ? await anon.rpc('portal_alquiler_token', { p_token: token, p_dni: dni })
      : await anon.rpc('portal_alquiler_dni', { p_cliente_id: cliente_id, p_dni: dni })
    if (error) throw error

    const pagoValido = (data?.contratos ?? []).some((c: any) =>
      (c.pagos ?? []).some((p: any) => p.id === pago_id && p.recibo))
    if (!pagoValido) return json({ error: 'No autorizado.' }, 403)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: recibo, error: reciboError } = await admin
      .from('recibos_contrato')
      .select('file_firma')
      .eq('pago_id', pago_id)
      .maybeSingle()
    if (reciboError) throw reciboError
    if (!recibo?.file_firma) return json({ url: null })

    const { data: signed, error: signError } = await admin.storage
      .from('firmas')
      .createSignedUrl(recibo.file_firma, SIGNED_URL_SEGUNDOS)
    if (signError) throw signError

    return json({ url: signed.signedUrl })
  } catch (err) {
    console.error('firma-recibo:', err)
    return json({ error: 'No se pudo obtener la firma.' }, 500)
  }
})
