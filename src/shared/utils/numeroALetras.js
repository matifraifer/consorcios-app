const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
const DIEZ_A_DIECINUEVE = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve']
const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

function gruposDeTres(n) {
  if (n === 0) return 'cero'
  if (n === 100) return 'cien'

  const c = Math.floor(n / 100)
  const resto = n % 100
  let texto = c > 0 ? CENTENAS[c] : ''

  if (resto > 0) {
    if (texto) texto += ' '
    if (resto < 10) {
      texto += UNIDADES[resto]
    } else if (resto < 20) {
      texto += DIEZ_A_DIECINUEVE[resto - 10]
    } else {
      const d = Math.floor(resto / 10)
      const u = resto % 10
      texto += DECENAS[d]
      if (u > 0) texto += ` y ${UNIDADES[u]}`
    }
  }
  return texto
}

// Convierte un entero no negativo a su forma en letras, en español.
function enteroALetras(n) {
  if (n === 0) return 'cero'

  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000

  const partes = []
  if (millones > 0) {
    partes.push(millones === 1 ? 'un millón' : `${gruposDeTres(millones)} millones`)
  }
  if (miles > 0) {
    partes.push(miles === 1 ? 'mil' : `${gruposDeTres(miles)} mil`)
  }
  if (resto > 0) {
    partes.push(gruposDeTres(resto))
  }
  return partes.join(' ')
}

// Ej: montoEnLetras(150000) -> "ciento cincuenta mil pesos"
export function montoEnLetras(monto, moneda = 'pesos') {
  const entero = Math.round(Number(monto) || 0)
  const texto = enteroALetras(Math.abs(entero))
  const capitalizado = texto.charAt(0).toUpperCase() + texto.slice(1)
  return `${entero < 0 ? '-' : ''}${capitalizado} ${moneda}`
}
