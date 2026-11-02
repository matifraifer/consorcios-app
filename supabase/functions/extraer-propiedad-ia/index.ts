import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const MODEL = 'claude-haiku-4-5'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Mismo criterio que extraer-contrato-ia: solo desde el panel admin logueado.
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

// Exige un usuario logueado real (ver ANALISIS_SEGURIDAD.md, punto 1).
async function validarAcceso(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return { ok: false, status: 401, error: 'No autenticado.' }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { ok: false, status: 401, error: 'No autenticado.' }

  return { ok: true }
}

// Deben coincidir con las listas de PropiedadFormDrawer.jsx
const TIPOS_PROPIEDAD = ['Casa', 'Departamento', 'Terreno', 'Local', 'Oficina']
const TIPOS_OPERACION = ['Venta', 'Alquiler']
const MONEDAS = ['USD', 'ARS']
const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán',
]
const ROLES_PERSONA = ['titular', 'vendedor', 'comprador', 'apoderado', 'otro']

const EXTRACT_TOOL = {
  name: 'datos_propiedad',
  description: 'Datos estructurados de un inmueble argentino extraídos de su documentación (escritura, boleto, plano, tasación, autorización de venta, boletas de servicios, fotos).',
  input_schema: {
    type: 'object',
    properties: {
      titulo: { type: ['string', 'null'], description: 'Título breve para la publicación, armado solo con datos presentes (ej. "Casa de 3 dormitorios en Rivadavia")' },
      tipo_propiedad: { type: ['string', 'null'], enum: [...TIPOS_PROPIEDAD, null] },
      tipo_operacion: { type: ['string', 'null'], enum: [...TIPOS_OPERACION, null] },
      direccion: { type: ['string', 'null'], description: 'Calle y número del inmueble' },
      localidad: { type: ['string', 'null'], description: 'Localidad, ciudad o departamento del inmueble' },
      provincia: { type: ['string', 'null'], enum: [...PROVINCIAS, null] },
      metros_cubiertos: { type: ['number', 'null'], description: 'Superficie cubierta construida en m2' },
      metros_totales: { type: ['number', 'null'], description: 'Superficie total del terreno o del inmueble en m2' },
      ambientes: { type: ['integer', 'null'] },
      dormitorios: { type: ['integer', 'null'] },
      banios: { type: ['integer', 'null'] },
      cochera: { type: ['boolean', 'null'] },
      precio_publicacion: { type: ['number', 'null'] },
      moneda: { type: ['string', 'null'], enum: [...MONEDAS, null] },
      descripcion: { type: ['string', 'null'], description: 'Descripción comercial para la publicación' },
      observaciones_internas: { type: ['string', 'null'], description: 'Datos registrales y notas internas' },
      nomenclatura_catastral: { type: ['string', 'null'] },
      servicio_agua: { type: ['string', 'null'], description: 'Número de cuenta o suministro del servicio de agua' },
      servicio_gas: { type: ['string', 'null'], description: 'Número de cuenta o suministro del servicio de gas' },
      servicio_energia: { type: ['string', 'null'], description: 'Número de cuenta o suministro del servicio de energía eléctrica' },
      servicio_municipalidad: { type: ['string', 'null'], description: 'Número de cuenta, partida o padrón municipal del inmueble' },
      personas: {
        type: 'array',
        description: 'Personas vinculadas a la titularidad del inmueble que aparecen en los documentos',
        items: {
          type: 'object',
          properties: {
            nombre: { type: ['string', 'null'] },
            apellido: { type: ['string', 'null'] },
            dni: { type: ['string', 'null'] },
            telefono: { type: ['string', 'null'] },
            email: { type: ['string', 'null'] },
            rol: { type: 'string', enum: ROLES_PERSONA },
            documento: { type: ['string', 'null'], description: 'Nombre del archivo del que se sacó el dato' },
          },
          required: ['nombre', 'apellido', 'dni', 'telefono', 'email', 'rol', 'documento'],
          additionalProperties: false,
        },
      },
      fotos_inmueble: {
        type: 'array',
        items: { type: 'integer' },
        description: 'Números de archivo que son fotos del inmueble en sí (no de documentos)',
      },
    },
    required: [
      'titulo', 'tipo_propiedad', 'tipo_operacion', 'direccion', 'localidad', 'provincia',
      'metros_cubiertos', 'metros_totales', 'ambientes', 'dormitorios', 'banios', 'cochera',
      'precio_publicacion', 'moneda', 'descripcion', 'observaciones_internas',
      'nomenclatura_catastral', 'servicio_agua', 'servicio_gas', 'servicio_energia', 'servicio_municipalidad',
      'personas', 'fotos_inmueble',
    ],
    additionalProperties: false,
  },
}

const SYSTEM_PROMPT = `Sos un asistente que extrae datos estructurados de la documentación de un inmueble en Argentina para cargarlo
en el sistema de una inmobiliaria. Vas a recibir uno o varios archivos numerados ("Archivo N: nombre"): texto plano extraído
de PDF o Word (puede tener errores de formato), PDF escaneados o fotos. Pueden ser escrituras, boletos de compraventa, planos,
informes de dominio, tasaciones, autorizaciones de venta, avisos, boletas de servicios o impuestos, o fotos del inmueble. Combiná la información de todos y llamá
a la herramienta "datos_propiedad" con el resultado.
Reglas generales:
- Extraé solo datos que aparezcan explícitamente. Si un dato no aparece o no se lee con claridad, poné null. No inventes ni asumas.
- Los números van sin separadores de miles ni símbolo de moneda.
Inmueble:
- tipo_propiedad solo puede ser uno de: ${TIPOS_PROPIEDAD.join(', ')}. Un "lote" o "fracción" es Terreno; una "unidad funcional" en propiedad horizontal es Departamento salvo que se indique otro destino.
- tipo_operacion: "Venta" o "Alquiler" solo si un documento indica qué operación se quiere publicar (autorización de venta, de alquiler, aviso). Una escritura o un boleto NO indican la operación a publicar: en ese caso null.
- direccion, localidad, provincia: ubicación del INMUEBLE, nunca el domicilio de las personas. provincia solo puede ser una de: ${PROVINCIAS.join(', ')} (Ciudad Autónoma de Buenos Aires es CABA).
- metros_cubiertos: superficie cubierta construida. metros_totales: superficie del terreno o superficie total. Si figura superficie según título y según mensura y difieren, usá la de mensura y aclaralo en observaciones_internas.
- precio_publicacion y moneda: solo si un documento indica el precio al que se quiere publicar (tasación, autorización de venta o de alquiler, aviso). El precio de una escritura o boleto es el de una compra anterior: NO lo uses como precio de publicación (poné null). moneda solo puede ser una de: ${MONEDAS.join(', ')}, o null.
- titulo: título breve para la publicación armado solo con datos presentes (tipo, dormitorios, localidad), o null si no hay datos suficientes.
- descripcion: 2 a 4 oraciones de descripción comercial basada solo en las características que aparecen en los documentos o se ven en las fotos, o null.
- observaciones_internas: datos registrales y técnicos útiles para la inmobiliaria que no tienen campo propio (matrícula o inscripción en el Registro, partida inmobiliaria provincial, número de plano, gravámenes, hipotecas o embargos mencionados, diferencias de superficie), en una lista breve, o null. No repitas acá la nomenclatura catastral ni las cuentas de servicios.
- nomenclatura_catastral: el código de nomenclatura catastral del inmueble si figura, o null.
- servicio_agua, servicio_gas, servicio_energia: número de cuenta o de suministro de cada servicio si figura (por ejemplo en una boleta), o null.
  Empresas prestadoras habituales para reconocer cada servicio: OSSE es agua, Ecogas es gas, Naturgy es energía eléctrica.
- servicio_municipalidad: número de cuenta, partida o padrón municipal (tasas municipales, "TSU", "ABL", "tasa de servicios urbanos"), o null.
  No confundir con la nomenclatura catastral ni con la partida inmobiliaria provincial (ARBA/Rentas).
Personas:
- personas: incluí a quienes figuran en la titularidad del inmueble. rol:
  - "titular": propietario actual. En una escritura o boleto de compraventa, el COMPRADOR es el titular actual. En un informe de dominio, los titulares registrales.
  - "vendedor": quien vendió en una escritura o boleto (ya no es el propietario).
  - "apoderado": quien firma en representación de un titular.
  - "comprador": solo si el documento es una reserva u oferta de un tercero que todavía no compró.
  - "otro": cualquier otra persona relevante para la titularidad.
  No incluyas escribanos, testigos, martilleros ni profesionales que firman planos.
- nombre y apellido por separado (los apellidos suelen venir en mayúsculas o primero). dni: solo el número de documento (no CUIT/CUIL; si solo hay CUIT, el DNI son los 8 dígitos del medio). documento: nombre del archivo de donde lo sacaste.
- Si no hay personas, devolvé una lista vacía.
Fotos:
- fotos_inmueble: números de los archivos que son fotos del inmueble (fachada, ambientes, terreno), no fotos de documentos. Lista vacía si no hay.`

const MEDIA_TYPES_IMAGEN = ['image/jpeg', 'image/png', 'image/webp']
const MAX_ARCHIVOS = 8
const MAX_BASE64_TOTAL = 28 * 1024 * 1024 // margen bajo el límite de 32 MB por pedido de la API
const MAX_TEXTO_POR_ARCHIVO = 30000
const MAX_TEXTO_TOTAL = 80000

// Arma el contenido del mensaje: un encabezado "Archivo N: nombre" y luego el texto
// o el bloque document (PDF) / image de cada archivo.
function armarContenido(body: any): { contenido?: unknown[]; error?: string } {
  const documentos = body?.documentos
  if (!Array.isArray(documentos) || documentos.length === 0) return { error: 'Faltan los documentos.' }
  if (documentos.length > MAX_ARCHIVOS) return { error: `Se pueden enviar hasta ${MAX_ARCHIVOS} archivos.` }

  let totalBase64 = 0
  let totalTexto = 0
  const bloques: unknown[] = []
  documentos.forEach((d: any, i: number) => {
    const nombre = typeof d?.nombre === 'string' ? d.nombre.slice(0, 200) : `archivo ${i + 1}`
    const encabezado = `Archivo ${i + 1}: ${nombre}`

    if (typeof d?.texto === 'string') {
      const restante = Math.max(0, MAX_TEXTO_TOTAL - totalTexto)
      const texto = d.texto.slice(0, Math.min(MAX_TEXTO_POR_ARCHIVO, restante))
      totalTexto += texto.length
      bloques.push({ type: 'text', text: `${encabezado}\n\n${texto}` })
      return
    }

    if (typeof d?.data !== 'string' || !d.data) throw new Error(`El archivo "${nombre}" es inválido.`)
    totalBase64 += d.data.length
    bloques.push({ type: 'text', text: encabezado })
    if (d.media_type === 'application/pdf') {
      bloques.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: d.data } })
    } else if (MEDIA_TYPES_IMAGEN.includes(d.media_type)) {
      bloques.push({ type: 'image', source: { type: 'base64', media_type: d.media_type, data: d.data } })
    } else {
      throw new Error(`El formato del archivo "${nombre}" no es compatible.`)
    }
  })
  if (totalBase64 > MAX_BASE64_TOTAL) return { error: 'Los archivos son demasiado pesados.' }

  bloques.push({ type: 'text', text: 'Extraé los datos del inmueble a partir de estos archivos.' })
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

    let armado
    try {
      armado = armarContenido(await req.json())
    } catch (err) {
      return jsonError(CORS, err.message ?? 'Contenido inválido.')
    }
    if (armado.error) return jsonError(CORS, armado.error)

    // No se loguea el contenido ni la respuesta: los documentos traen datos personales.
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: [EXTRACT_TOOL],
        tool_choice: { type: 'tool', name: 'datos_propiedad' },
        messages: [
          { role: 'user', content: armado.contenido },
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
