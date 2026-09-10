import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const MODEL = 'claude-haiku-4-5'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TIPOS_ACTUALIZACION = ['IPC', 'ICL', 'Otro']
const PLAZOS_ACTUALIZACION = ['Mensual', 'Trimestral', 'Cuatrimestral', 'Semestral', 'Anual', 'Otro']

const EXTRACT_TOOL = {
  name: 'datos_contrato',
  description: 'Datos estructurados extraídos de un contrato de alquiler argentino.',
  input_schema: {
    type: 'object',
    properties: {
      inquilino_nombre: { type: ['string', 'null'] },
      inquilino_apellido: { type: ['string', 'null'] },
      inquilino_dni: { type: ['string', 'null'] },
      propietario_nombre: { type: ['string', 'null'] },
      propietario_apellido: { type: ['string', 'null'] },
      propietario_dni: { type: ['string', 'null'] },
      fecha_inicio: { type: ['string', 'null'], description: 'Formato YYYY-MM-DD' },
      fecha_fin: { type: ['string', 'null'], description: 'Formato YYYY-MM-DD' },
      dia_vencimiento: { type: ['integer', 'null'], description: 'Día del mes (1-31) en que vence el pago' },
      monto_base: { type: ['number', 'null'] },
      tipo_actualizacion: { type: ['string', 'null'], enum: [...TIPOS_ACTUALIZACION, null] },
      plazo_actualizacion: { type: ['string', 'null'], enum: [...PLAZOS_ACTUALIZACION, null] },
      observaciones: { type: ['string', 'null'] },
    },
    required: [
      'inquilino_nombre', 'inquilino_apellido', 'inquilino_dni',
      'propietario_nombre', 'propietario_apellido', 'propietario_dni',
      'fecha_inicio', 'fecha_fin', 'dia_vencimiento', 'monto_base',
      'tipo_actualizacion', 'plazo_actualizacion', 'observaciones',
    ],
    additionalProperties: false,
  },
}

const SYSTEM_PROMPT = `Sos un asistente que extrae datos estructurados de contratos de alquiler de inmuebles en Argentina.
Se te va a dar el texto plano de un contrato (puede tener errores de OCR/formato). Extraé únicamente los datos que
aparezcan explícitamente en el texto y llamá a la herramienta "datos_contrato" con el resultado.
Reglas:
- Si un dato no aparece en el texto, poné null en ese campo. No inventes ni asumas datos.
- Las fechas van en formato YYYY-MM-DD.
- monto_base es el monto de alquiler mensual base, como número (sin separadores de miles ni símbolo de moneda).
- tipo_actualizacion solo puede ser uno de: ${TIPOS_ACTUALIZACION.join(', ')}, o null si no se menciona un índice de actualización reconocible.
- plazo_actualizacion solo puede ser uno de: ${PLAZOS_ACTUALIZACION.join(', ')}, o null si no se menciona la periodicidad de actualización.
- observaciones: un resumen breve (1-2 líneas) de cláusulas relevantes no cubiertas por los otros campos, o null.`

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { texto } = await req.json()

    if (!texto || typeof texto !== 'string' || !texto.trim()) {
      return jsonError('Falta el texto del contrato.')
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: [EXTRACT_TOOL],
        tool_choice: { type: 'tool', name: 'datos_contrato' },
        messages: [
          { role: 'user', content: texto.slice(0, 40000) },
        ],
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return jsonError(data?.error?.message ?? 'Error al llamar a la IA.', 502)
    }

    const toolUse = (data.content ?? []).find((b: any) => b.type === 'tool_use')
    if (!toolUse) {
      return jsonError('La IA no devolvió datos estructurados.', 502)
    }

    return new Response(JSON.stringify({ data: toolUse.input }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return jsonError(err.message ?? 'Error interno.', 500)
  }
})
