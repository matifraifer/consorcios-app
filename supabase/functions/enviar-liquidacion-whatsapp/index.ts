import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Cuenta de Twilio única para toda la plataforma (un solo número, no por consorcio).
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!
const TWILIO_WHATSAPP_NUMBER = Deno.env.get('TWILIO_WHATSAPP_NUMBER')!

// Plantilla de WhatsApp aprobada en Twilio Content Template Builder. Body:
// "Hola Vecino/a! Te enviamos el saldo de expensas impago al dia de la fecha
// del consorcio {{1}}. Saldo total {{2}} fecha de vencimiento del periodo {{3}}"
// + botón de URL con base fija "https://app.granito.com.ar/consulta/{{4}}"
// (variable 4 = solo el token, no la URL completa).
const TWILIO_TEMPLATE_SID = Deno.env.get('TWILIO_TEMPLATE_SID')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function fmt(value: number) {
  return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtFecha(value: string) {
  const [anio, mes, dia] = value.split('-')
  return `${dia}/${mes}/${anio}`
}

const MS_POR_DIA = 1000 * 60 * 60 * 24

// Mismo cálculo que src/utils/calcularSaldosMora.js, para un solo departamento
// (duplicado acá porque las Edge Functions no comparten bundle con el frontend,
// igual que en enviar-link-consulta / enviar-recordatorios-whatsapp).
function calcularSaldoTotal(periodos: any[], expensas: any[], departamentoId: number, tasaMora: number) {
  const hoy = new Date()
  let saldoTotal = 0

  for (const periodo of periodos) {
    const exp = expensas.find(e => e.periodo_id === periodo.id && e.departamento_id === departamentoId)
    if (!exp || exp.pagado) continue

    const saldo = Math.max(0, Number(exp.monto_total ?? 0) - Number(exp.monto_pagado ?? 0))
    if (saldo <= 0) continue

    saldoTotal += saldo

    if (periodo.fecha_vencimiento) {
      const diasAtraso = (hoy.getTime() - new Date(periodo.fecha_vencimiento).getTime()) / MS_POR_DIA
      const mesesAtraso = Math.floor(diasAtraso / 30)
      if (mesesAtraso > 0) saldoTotal += saldo * (Number(tasaMora || 0) / 100) * mesesAtraso
    }
  }

  return saldoTotal
}

function normalizarTelefono(telefono: string) {
  const limpio = telefono.trim().replace(/[\s-]/g, '')
  return limpio.startsWith('+') ? limpio : `+${limpio}`
}

async function enviarWhatsapp(telefono: string, contentVariables: Record<string, string>) {
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)
  const body = new URLSearchParams({
    From: `whatsapp:${normalizarTelefono(TWILIO_WHATSAPP_NUMBER)}`,
    To: `whatsapp:${normalizarTelefono(telefono)}`,
    ContentSid: TWILIO_TEMPLATE_SID,
    ContentVariables: JSON.stringify(contentVariables),
  })

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const data = await res.json()
  return { ok: res.ok, data }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { consorcio_id } = await req.json()
    if (!consorcio_id) {
      return new Response(JSON.stringify({ error: 'Falta consorcio_id.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: consorcio, error: consorcioError } = await supabase
      .from('consorcios')
      .select('id, nombre, tasa_mora')
      .eq('id', consorcio_id)
      .single()
    if (consorcioError) throw consorcioError

    const { data: periodos, error: periodosError } = await supabase
      .from('periodos_expensas')
      .select('id, mes, anio, fecha_vencimiento')
      .eq('consorcio_id', consorcio_id)
      .eq('estado', 'cerrado')
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
    if (periodosError) throw periodosError

    // Período más reciente del consorcio — su fecha_vencimiento es la que se
    // muestra en la plantilla como "fecha de vencimiento del periodo".
    const periodoActual = (periodos ?? [])[0] ?? null

    const { data: departamentos, error: deptosError } = await supabase
      .from('departamentos')
      .select('id, numeracion, telefono, token_consulta')
      .eq('id_consorcio', consorcio_id)
    if (deptosError) throw deptosError

    const periodoIds = (periodos ?? []).map(p => p.id)
    const deptoIds = (departamentos ?? []).map(d => d.id)

    let expensas: any[] = []
    if (periodoIds.length > 0 && deptoIds.length > 0) {
      const { data, error } = await supabase
        .from('expensas_departamento')
        .select('periodo_id, departamento_id, monto_total, monto_pagado, pagado')
        .in('periodo_id', periodoIds)
        .in('departamento_id', deptoIds)
      if (error) throw error
      expensas = data ?? []
    }

    let enviados = 0
    let sinTelefono = 0
    let sinDeuda = 0
    let errores = 0

    for (const depto of departamentos ?? []) {
      if (!depto.telefono) { sinTelefono++; continue }

      const saldoTotal = calcularSaldoTotal(periodos ?? [], expensas, depto.id, consorcio.tasa_mora)
      if (saldoTotal <= 0) { sinDeuda++; continue }

      const contentVariables = {
        '1': consorcio.nombre,
        '2': fmt(saldoTotal),
        '3': periodoActual?.fecha_vencimiento ? fmtFecha(periodoActual.fecha_vencimiento) : '-',
        '4': depto.token_consulta,
      }

      const { ok, data } = await enviarWhatsapp(depto.telefono, contentVariables)
      if (ok) {
        enviados++
      } else {
        errores++
        console.error(`Twilio error (depto ${depto.id}, ${depto.telefono}):`, JSON.stringify(data))
      }
    }

    return new Response(JSON.stringify({ enviados, sinTelefono, sinDeuda, errores }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? 'Error interno.' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
