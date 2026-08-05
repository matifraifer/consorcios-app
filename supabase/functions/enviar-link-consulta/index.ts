import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CONSULTA_BASE_URL = 'https://app.granito.com.ar/consulta'
const EMAIL_FROM = 'no-reply@granito.com.ar'
const ACCENT = '#065F46'
const ACCENT_LIGHT = '#ECFDF5'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function fmt(value: number) {
  return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const MS_POR_DIA = 1000 * 60 * 60 * 24

// Mismo cálculo que src/utils/calcularSaldosMora.js, para un solo departamento
// (duplicado acá porque las Edge Functions no comparten bundle con el frontend).
function calcularSaldoTotal(periodos: any[], expensas: any[], departamentoId: number, tasaMora: number) {
  const ultimoPeriodo = periodos[0] ?? null
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
      .select('id, numeracion, email, token_consulta, id_consorcio, consorcios(nombre, tasa_mora)')
      .eq('id', departamento_id)
      .single()

    if (deptoError) throw deptoError
    if (!depto?.email) {
      return new Response(JSON.stringify({ error: 'El departamento no tiene email cargado.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const { data: periodos, error: periodosError } = await supabase
      .from('periodos_expensas')
      .select('id, mes, anio, fecha_vencimiento')
      .eq('consorcio_id', depto.id_consorcio)
      .eq('estado', 'cerrado')
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
    if (periodosError) throw periodosError

    const periodoIds = (periodos ?? []).map(p => p.id)
    let expensas: any[] = []
    if (periodoIds.length > 0) {
      const { data, error } = await supabase
        .from('expensas_departamento')
        .select('periodo_id, departamento_id, monto_total, monto_pagado, pagado')
        .in('periodo_id', periodoIds)
      if (error) throw error
      expensas = data ?? []
    }

    const saldoTotal = calcularSaldoTotal(periodos ?? [], expensas, depto.id, depto.consorcios?.tasa_mora)

    const link = `${CONSULTA_BASE_URL}/${depto.token_consulta}`
    const consorcioNombre = depto.consorcios?.nombre ?? ''

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto;">
        <div style="background:${ACCENT}; padding: 20px 28px; border-radius: 12px 12px 0 0;">
          <p style="margin:0; color:#ffffff; font-size:15px; font-weight:700; letter-spacing:0.02em;">
            ${consorcioNombre}
          </p>
        </div>
        <div style="background:#ffffff; border:1px solid #E5E7EB; border-top:none; border-radius: 0 0 12px 12px; padding: 28px;">
          <p style="margin:0 0 12px; font-size:15px; color:#111827;">Hola,</p>
          <p style="margin:0 0 20px; font-size:14px; color:#374151; line-height:1.5;">
            Te escribimos para informarte el estado de deuda de la unidad <strong>${depto.numeracion}</strong> en <strong>${consorcioNombre}</strong>.
          </p>
          <div style="background:${ACCENT_LIGHT}; border-radius:10px; padding:16px 20px; margin-bottom:24px;">
            <p style="margin:0; font-size:12px; color:${ACCENT}; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">
              Saldo total a pagar
            </p>
            <p style="margin:4px 0 0; font-size:24px; color:#111827; font-weight:800;">
              ${fmt(saldoTotal)}
            </p>
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 20px;">
            <tr>
              <td style="border-radius:8px; background:${ACCENT};">
                <a href="${link}" style="display:inline-block; padding:12px 28px; font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:8px;">
                  Consultá el detalle de tu saldo
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:0; font-size:12px; color:#9CA3AF; line-height:1.5;">
            Al ingresar te vamos a pedir tu email y el número de unidad para validar el acceso.
          </p>
        </div>
      </div>
    `

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
        html,
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
