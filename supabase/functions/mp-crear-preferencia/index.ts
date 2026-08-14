import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CONSULTA_BASE_URL = 'https://app.granito.com.ar/consulta'
const MS_POR_DIA = 1000 * 60 * 60 * 24

// Comisión fija que cobra Mercado Pago (no varía por consorcio, a diferencia
// de comision_plataforma_fee que sí es configurable por consorcio).
const MP_COMISION_PCT = 6.19

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MESES_LABEL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function redondear(n: number) {
  return Math.round(n * 100) / 100
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { token, email, numeracion, periodos_ids } = await req.json()

    if (!token || !email || !numeracion || !Array.isArray(periodos_ids) || periodos_ids.length === 0) {
      return jsonError('Faltan parámetros requeridos.')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Misma validación de identidad que la RPC consultar_deuda_departamento:
    // el token no es adivinable, pero igual pedimos email + numeración para
    // no confiar solo en el link.
    const { data: depto, error: deptoError } = await supabase
      .from('departamentos')
      .select('id, numeracion, email, id_consorcio, consorcios(cliente_id, nombre, tasa_mora, comision_plataforma_fee, permite_pagos_parciales)')
      .eq('token_consulta', token)
      .maybeSingle()

    if (deptoError) throw deptoError
    if (
      !depto ||
      !depto.email ||
      depto.email.trim().toLowerCase() !== String(email).trim().toLowerCase() ||
      depto.numeracion.trim().toLowerCase() !== String(numeracion).trim().toLowerCase()
    ) {
      return jsonError('Los datos ingresados no coinciden.', 403)
    }

    const consorcio = depto.consorcios as any
    if (!consorcio?.cliente_id) return jsonError('No se pudo determinar el consorcio.', 400)

    const { data: periodos, error: periodosError } = await supabase
      .from('periodos_expensas')
      .select('id, mes, anio, fecha_vencimiento')
      .eq('consorcio_id', depto.id_consorcio)
      .eq('estado', 'cerrado')
    if (periodosError) throw periodosError
    if (!periodos || periodos.length === 0) return jsonError('No hay períodos válidos para pagar.')

    const { data: expensas, error: expensasError } = await supabase
      .from('expensas_departamento')
      .select('periodo_id, monto_total, monto_pagado, pagado')
      .eq('departamento_id', depto.id)
      .in('periodo_id', periodos.map(p => p.id))
    if (expensasError) throw expensasError

    const hoy = new Date()

    function calcularMontoPeriodo(periodo: { fecha_vencimiento: string | null }, saldo: number) {
      let monto = saldo
      if (periodo.fecha_vencimiento) {
        const diasAtraso = (hoy.getTime() - new Date(periodo.fecha_vencimiento).getTime()) / MS_POR_DIA
        const mesesAtraso = Math.floor(diasAtraso / 30)
        if (mesesAtraso > 0) monto += saldo * (Number(consorcio.tasa_mora || 0) / 100) * mesesAtraso
      }
      return redondear(monto)
    }

    // Todos los períodos impagos del departamento (no solo los pedidos), para
    // poder validar la regla de "no admite pagos parciales" del consorcio.
    const periodosImpagosIds: number[] = []
    for (const periodo of periodos) {
      const exp = expensas?.find(e => e.periodo_id === periodo.id)
      if (!exp || exp.pagado) continue
      const saldo = Math.max(0, Number(exp.monto_total ?? 0) - Number(exp.monto_pagado ?? 0))
      if (saldo <= 0) continue
      periodosImpagosIds.push(periodo.id)
    }

    if (consorcio.permite_pagos_parciales === false) {
      const solicitados = [...new Set(periodos_ids)].sort((a, b) => a - b)
      const impagos = [...periodosImpagosIds].sort((a, b) => a - b)
      const cubreTodo = solicitados.length === impagos.length && solicitados.every((id, i) => id === impagos[i])
      if (!cubreTodo) return jsonError('Este consorcio no admite pagos parciales: tenés que pagar el total adeudado.')
    }

    const items: { title: string; quantity: number; unit_price: number; currency_id: string }[] = []
    const periodosAPagar: number[] = []
    let montoDeuda = 0

    for (const periodo of periodos) {
      if (!periodos_ids.includes(periodo.id)) continue
      const exp = expensas?.find(e => e.periodo_id === periodo.id)
      if (!exp || exp.pagado) continue

      const saldo = Math.max(0, Number(exp.monto_total ?? 0) - Number(exp.monto_pagado ?? 0))
      if (saldo <= 0) continue

      const monto = calcularMontoPeriodo(periodo, saldo)
      periodosAPagar.push(periodo.id)
      montoDeuda += monto
      items.push({
        title: `Expensas ${MESES_LABEL[periodo.mes - 1]} ${periodo.anio} - Unidad ${depto.numeracion}`,
        quantity: 1,
        unit_price: monto,
        currency_id: 'ARS',
      })
    }

    if (periodosAPagar.length === 0) return jsonError('Los períodos seleccionados ya no tienen saldo pendiente.')
    montoDeuda = redondear(montoDeuda)

    // Comisión de la plataforma (opcional, por consorcio): si está configurada,
    // se le recarga al propietario un monto calculado para que, después de
    // que Mercado Pago descuente su propia comisión, al consorcio le llegue
    // el 100% de montoDeuda y a la plataforma le llegue comisionPlataforma
    // completo vía marketplace_fee.
    const comisionPlataforma = Number(consorcio.comision_plataforma_fee || 0)
    let montoTotal = montoDeuda
    let tarifaServicio = 0
    let recargoMp = 0

    if (comisionPlataforma > 0) {
      montoTotal = redondear((montoDeuda + comisionPlataforma) / (1 - MP_COMISION_PCT / 100))
      tarifaServicio = redondear(montoTotal - montoDeuda)
      recargoMp = redondear(tarifaServicio - comisionPlataforma)

      items.push({
        title: 'Tarifa por servicio',
        quantity: 1,
        unit_price: tarifaServicio,
        currency_id: 'ARS',
      })
    }

    const { data: mpToken, error: mpTokenError } = await supabase
      .from('mp_tokens')
      .select('access_token')
      .eq('cliente_id', consorcio.cliente_id)
      .maybeSingle()
    if (mpTokenError) throw mpTokenError
    if (!mpToken) return jsonError('Este consorcio no tiene Mercado Pago configurado.')

    const { data: pago, error: pagoError } = await supabase
      .from('mp_pagos')
      .insert({
        cliente_id: consorcio.cliente_id,
        departamento_id: depto.id,
        periodos_ids: periodosAPagar,
        monto: montoTotal,
        comision_plataforma: comisionPlataforma > 0 ? comisionPlataforma : null,
        recargo_mp: comisionPlataforma > 0 ? recargoMp : null,
        estado: 'pendiente',
      })
      .select('id')
      .single()
    if (pagoError) throw pagoError

    const preferenceBody: Record<string, unknown> = {
      items,
      external_reference: pago.id,
      notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook?pago_id=${pago.id}`,
      back_urls: {
        success: `${CONSULTA_BASE_URL}/${token}?pago=success`,
        failure: `${CONSULTA_BASE_URL}/${token}?pago=failure`,
        pending: `${CONSULTA_BASE_URL}/${token}?pago=pending`,
      },
      auto_return: 'approved',
    }
    if (comisionPlataforma > 0) preferenceBody.marketplace_fee = comisionPlataforma

    const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpToken.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferenceBody),
    })

    const preference = await prefRes.json()

    if (!prefRes.ok) {
      return jsonError(preference.message ?? 'Error al crear la preferencia de pago en Mercado Pago.', 400)
    }

    await supabase.from('mp_pagos').update({ preference_id: preference.id }).eq('id', pago.id)

    return new Response(JSON.stringify({ init_point: preference.init_point }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return jsonError(err.message ?? 'Error interno.', 500)
  }
})
