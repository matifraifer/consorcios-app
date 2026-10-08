import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const MODEL = 'claude-haiku-4-5'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Solo se llama desde el panel admin logueado (nunca desde una página
// pública), así que el origin se restringe a los dominios de la app en vez
// de '*' (ver ANALISIS_SEGURIDAD.md, punto 6).
const ALLOWED_ORIGINS = [
  'https://app.granito.com.ar',
  'https://consorcios-app.vercel.app',
]

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost:')
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

// Exige un usuario logueado real (no valida cliente_id porque esta función no
// toca datos de ningún tenant) — sin esto es un proxy abierto pagado por
// nosotros a la API de Anthropic (ver ANALISIS_SEGURIDAD.md, punto 1).
async function validarAcceso(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return { ok: false, status: 401, error: 'No autenticado.' }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { ok: false, status: 401, error: 'No autenticado.' }

  return { ok: true }
}

const TIPOS_ACTUALIZACION = ['IPC', 'ICL', 'Otro']
const PLAZOS_ACTUALIZACION = ['Mensual', 'Trimestral', 'Cuatrimestral', 'Semestral', 'Anual', 'Otro']
const TIPOS_PROPIEDAD = ['Casa', 'Departamento', 'Terreno', 'Local', 'Oficina', 'Otro']
const MONEDAS = ['ARS', 'USD']

const EXTRACT_TOOL = {
  name: 'datos_contrato',
  description: 'Datos estructurados extraídos de un contrato de alquiler o de compraventa en cuotas argentino.',
  input_schema: {
    type: 'object',
    properties: {
      es_compraventa: { type: 'boolean', description: 'true si es un contrato de compraventa del inmueble (no una locación/alquiler)' },
      inquilino_nombre: { type: ['string', 'null'] },
      inquilino_apellido: { type: ['string', 'null'] },
      inquilino_dni: { type: ['string', 'null'] },
      inquilino_telefono: { type: ['string', 'null'], description: 'Número de celular del inquilino/locatario' },
      propietario_nombre: { type: ['string', 'null'] },
      propietario_apellido: { type: ['string', 'null'] },
      propietario_dni: { type: ['string', 'null'] },
      propietario_telefono: { type: ['string', 'null'], description: 'Número de celular del propietario/locador' },
      fecha_inicio: { type: ['string', 'null'], description: 'Formato YYYY-MM-DD' },
      fecha_fin: { type: ['string', 'null'], description: 'Formato YYYY-MM-DD' },
      dia_vencimiento: { type: ['integer', 'null'], description: 'Día del mes (1-31) en que vence el pago' },
      monto_base: { type: ['number', 'null'] },
      deposito: { type: ['number', 'null'], description: 'Monto del depósito en garantía' },
      interes_mora_diario: { type: ['number', 'null'], description: 'Interés por mora como porcentaje DIARIO' },
      tipo_actualizacion: { type: ['string', 'null'], enum: [...TIPOS_ACTUALIZACION, null] },
      plazo_actualizacion: { type: ['string', 'null'], enum: [...PLAZOS_ACTUALIZACION, null] },
      observaciones: { type: ['string', 'null'] },
      nomenclatura_catastral: { type: ['string', 'null'] },
      servicio_agua: { type: ['string', 'null'], description: 'Número de cuenta o suministro del servicio de agua' },
      servicio_gas: { type: ['string', 'null'], description: 'Número de cuenta o suministro del servicio de gas' },
      servicio_energia: { type: ['string', 'null'], description: 'Número de cuenta o suministro del servicio de energía eléctrica' },
      servicio_municipalidad: { type: ['string', 'null'], description: 'Número de cuenta o partida municipal del inmueble (tasas municipales)' },
      direccion: { type: ['string', 'null'], description: 'Dirección del inmueble alquilado' },
      localidad: { type: ['string', 'null'], description: 'Localidad/ciudad del inmueble alquilado' },
      provincia: { type: ['string', 'null'], description: 'Provincia del inmueble alquilado' },
      tipo_propiedad: { type: ['string', 'null'], enum: [...TIPOS_PROPIEDAD, null], description: 'Tipo de inmueble alquilado' },
      moneda: { type: ['string', 'null'], enum: [...MONEDAS, null], description: 'Moneda en la que se pacta el monto de alquiler' },
    },
    required: [
      'es_compraventa',
      'inquilino_nombre', 'inquilino_apellido', 'inquilino_dni', 'inquilino_telefono',
      'propietario_nombre', 'propietario_apellido', 'propietario_dni', 'propietario_telefono',
      'fecha_inicio', 'fecha_fin', 'dia_vencimiento', 'monto_base', 'deposito', 'interes_mora_diario',
      'tipo_actualizacion', 'plazo_actualizacion', 'observaciones',
      'nomenclatura_catastral', 'servicio_agua', 'servicio_gas', 'servicio_energia', 'servicio_municipalidad',
      'direccion', 'localidad', 'provincia', 'tipo_propiedad', 'moneda',
    ],
    additionalProperties: false,
  },
}

const SYSTEM_PROMPT = `Sos un asistente que extrae datos estructurados de contratos de alquiler o de compraventa de inmuebles en Argentina.
Se te va a dar el texto plano de un contrato (puede tener errores de OCR/formato), o el contrato como PDF escaneado
o como fotos de sus páginas (pueden venir torcidas, con sellos o firmas encima). Extraé únicamente los datos que
aparezcan explícitamente en el contrato y llamá a la herramienta "datos_contrato" con el resultado. Si un dato no se
lee con claridad en un escaneo o foto, poné null en vez de adivinarlo.
Reglas:
- Si un dato no aparece en el texto, poné null en ese campo. No inventes ni asumas datos.
- es_compraventa: true si el contrato es de COMPRAVENTA del inmueble (boleto de compraventa, venta con pago en cuotas,
  "vendedor"/"comprador", "precio de venta", transferencia de dominio o escrituración). false si es una LOCACIÓN/ALQUILER
  ("locador"/"locatario", "alquiler", "canon locativo") o si no está claro.
  En una compraventa, completá los campos propietario_* con los datos del VENDEDOR e inquilino_* con los del COMPRADOR,
  y monto_base con el valor de la cuota mensual.
- Las fechas van en formato YYYY-MM-DD.
- monto_base es el monto de alquiler mensual base, como número (sin separadores de miles ni símbolo de moneda).
- deposito: monto del depósito en garantía, como número (sin separadores de miles ni símbolo de moneda), o null.
  Si el contrato lo expresa como cantidad de meses de alquiler (ej. "un mes de alquiler"), calculalo multiplicando por monto_base.
- interes_mora_diario: interés punitorio/moratorio por atraso en el pago, expresado como PORCENTAJE DIARIO (ej. 0.5 para 0,5% diario), o null.
  Si el contrato lo expresa mensual, dividilo por 30; si es anual, dividilo por 365. Si es un monto fijo en pesos (no un porcentaje), poné null.
- tipo_actualizacion solo puede ser uno de: ${TIPOS_ACTUALIZACION.join(', ')}, o null si no se menciona un índice de actualización reconocible.
- plazo_actualizacion solo puede ser uno de: ${PLAZOS_ACTUALIZACION.join(', ')}, o null si no se menciona la periodicidad de actualización.
- observaciones: un resumen breve (1-2 líneas) de cláusulas relevantes no cubiertas por los otros campos, o null.
- nomenclatura_catastral: el código de nomenclatura catastral del inmueble si figura, o null.
- servicio_agua, servicio_gas, servicio_energia: número de cuenta o de suministro de cada servicio si figuran en el contrato, o null.
  Empresas prestadoras habituales para reconocer cada servicio (el número puede aparecer junto al nombre de la empresa o simplemente como "N° de cuenta/suministro"): OSSE es agua, Ecogas es gas, Naturgy es energía eléctrica.
- servicio_municipalidad: número de cuenta, partida o padrón municipal del inmueble (tasas municipales, por ejemplo "cuenta municipal", "partida municipal", "TSU", "ABL" o "tasa de servicios urbanos"), o null.
  No confundir con la nomenclatura catastral ni con la partida inmobiliaria provincial (ARBA/Rentas).
- direccion, localidad, provincia: datos de ubicación del inmueble alquilado (no del domicilio de las partes), o null si no figuran.
- tipo_propiedad solo puede ser uno de: ${TIPOS_PROPIEDAD.join(', ')}, o null si no se puede determinar.
- moneda solo puede ser uno de: ${MONEDAS.join(', ')}. Si el contrato no menciona explícitamente la moneda, poné "ARS" (moneda por defecto).`

// Archivos que manda el frontend cuando el PDF es escaneado o son fotos (prepararContrato)
const MEDIA_TYPES_IMAGEN = ['image/jpeg', 'image/png', 'image/webp']
const MAX_ARCHIVOS = 20
const MAX_BASE64_TOTAL = 28 * 1024 * 1024 // margen bajo el límite de 32 MB por pedido de la API

// Arma el contenido del mensaje: texto plano, o un bloque document (PDF) / image por archivo.
function armarContenido(body: any): { contenido?: unknown; error?: string } {
  if (typeof body?.texto === 'string' && body.texto.trim()) {
    return { contenido: body.texto.slice(0, 40000) }
  }

  const archivos = body?.archivos
  if (!Array.isArray(archivos) || archivos.length === 0) {
    return { error: 'Falta el contenido del contrato.' }
  }
  if (archivos.length > MAX_ARCHIVOS) return { error: `Se pueden enviar hasta ${MAX_ARCHIVOS} archivos.` }

  let total = 0
  const bloques: unknown[] = []
  for (const a of archivos) {
    if (typeof a?.data !== 'string' || !a.data) return { error: 'Archivo inválido.' }
    total += a.data.length
    if (a.media_type === 'application/pdf') {
      if (archivos.length > 1) return { error: 'El PDF se envía solo, sin otros archivos.' }
      bloques.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data } })
    } else if (MEDIA_TYPES_IMAGEN.includes(a.media_type)) {
      bloques.push({ type: 'image', source: { type: 'base64', media_type: a.media_type, data: a.data } })
    } else {
      return { error: 'Tipo de archivo no soportado.' }
    }
  }
  if (total > MAX_BASE64_TOTAL) return { error: 'Los archivos son demasiado pesados.' }

  bloques.push({
    type: 'text',
    text: bloques.length > 1
      ? 'Estas son las páginas del contrato, en orden. Extraé sus datos.'
      : 'Este es el contrato. Extraé sus datos.',
  })
  return { contenido: bloques }
}

function jsonError(cors: Record<string, string>, message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  const CORS = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const acceso = await validarAcceso(req)
    if (!acceso.ok) return jsonError(CORS, acceso.error, acceso.status)

    const { contenido, error: errorContenido } = armarContenido(await req.json())
    if (errorContenido) return jsonError(CORS, errorContenido)

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
          { role: 'user', content: contenido },
        ],
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return jsonError(CORS, data?.error?.message ?? 'Error al llamar a la IA.', 502)
    }

    const toolUse = (data.content ?? []).find((b: any) => b.type === 'tool_use')
    if (!toolUse) {
      return jsonError(CORS, 'La IA no devolvió datos estructurados.', 502)
    }

    return new Response(JSON.stringify({ data: toolUse.input }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return jsonError(CORS, err.message ?? 'Error interno.', 500)
  }
})
