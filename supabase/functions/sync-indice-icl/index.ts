// Sincroniza la serie diaria del ICL (Índice para Contratos de Locación) desde la API
// pública de Estadísticas Monetarias v4.0 del BCRA (idVariable 40) a `indices_diarios`.
//
// La llama un cron diario (pg_cron + pg_net, ver 0065_indices_diarios.sql). Deployada con
// --no-verify-jwt como el resto, así que se protege con el header `x-sync-secret`
// (secret SYNC_INDICES_SECRET). Body opcional: { "desde": "YYYY-MM-DD", "hasta": "YYYY-MM-DD" }.
// Sin `desde`, retoma desde el último valor guardado menos unos días (por si el BCRA
// corrige algún valor reciente). Es idempotente (upsert por tipo+fecha).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SYNC_SECRET          = Deno.env.get('SYNC_INDICES_SECRET') ?? ''

const BCRA_URL      = 'https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/40'
const TIPO          = 'ICL'
const INICIO_SERIE  = '2020-07-01'
const DIAS_REPASO   = 7      // re-sincroniza los últimos días ya guardados
const DIAS_ADELANTE = 31     // el BCRA puede publicar valores futuros
const PAGE_SIZE     = 1000   // límite de la API por consulta

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function respuesta(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}

function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return iso(d)
}

function esFecha(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

function secretValido(recibido: string) {
  if (!SYNC_SECRET || recibido.length !== SYNC_SECRET.length) return false
  let diff = 0
  for (let i = 0; i < recibido.length; i++) diff |= recibido.charCodeAt(i) ^ SYNC_SECRET.charCodeAt(i)
  return diff === 0
}

async function traerSerie(desde: string, hasta: string) {
  const valores: { fecha: string; valor: number }[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = `${BCRA_URL}?desde=${desde}&hasta=${hasta}&limit=${PAGE_SIZE}&offset=${offset}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`BCRA respondió ${res.status}`)
    const json = await res.json()
    const detalle = json?.results?.[0]?.detalle ?? []
    for (const d of detalle) {
      const valor = Number(d?.valor)
      if (esFecha(d?.fecha) && Number.isFinite(valor) && valor > 0) valores.push({ fecha: d.fecha, valor })
    }
    const total = Number(json?.metadata?.resultset?.count ?? 0)
    if (detalle.length < PAGE_SIZE || offset + PAGE_SIZE >= total) break
  }
  return valores
}

serve(async (req) => {
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido.' }, 405)
  if (!secretValido(req.headers.get('x-sync-secret') ?? '')) return respuesta({ error: 'No autorizado.' }, 401)

  try {
    const body = await req.json().catch(() => ({}))
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    let desde: string
    if (esFecha(body?.desde)) {
      desde = body.desde
    } else {
      const { data: ultimo, error } = await supabase
        .from('indices_diarios')
        .select('fecha')
        .eq('tipo', TIPO)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      desde = ultimo ? sumarDias(ultimo.fecha, -DIAS_REPASO) : INICIO_SERIE
    }
    const hasta = esFecha(body?.hasta) ? body.hasta : sumarDias(iso(new Date()), DIAS_ADELANTE)

    const valores = await traerSerie(desde, hasta)
    const ahora = new Date().toISOString()
    for (let i = 0; i < valores.length; i += 500) {
      const lote = valores.slice(i, i + 500).map(v => ({ tipo: TIPO, fecha: v.fecha, valor: v.valor, fuente: 'BCRA', updated_at: ahora }))
      const { error } = await supabase.from('indices_diarios').upsert(lote, { onConflict: 'tipo,fecha' })
      if (error) throw error
    }

    const ultimaFecha = valores.reduce((max, v) => (v.fecha > max ? v.fecha : max), '')
    console.log(`sync-indice-icl: ${valores.length} valores (${desde} a ${hasta}), último ${ultimaFecha || '-'}`)
    return respuesta({ ok: true, tipo: TIPO, desde, hasta, cantidad: valores.length, ultima_fecha: ultimaFecha || null })
  } catch (e) {
    console.error('sync-indice-icl:', e instanceof Error ? e.message : e)
    return respuesta({ error: 'No se pudo sincronizar el índice.' }, 500)
  }
})
