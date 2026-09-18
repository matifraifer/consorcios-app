// `numeracion` es texto libre (ej. "1", "10", "PB", "2A"), por lo que el
// ORDER BY de Postgres lo ordena alfabéticamente (1, 10, 2, 20, 21...).
// Se ordena en el cliente con orden "natural" (numérico cuando corresponde).
export function compareNumeracion(a, b) {
  return (a.numeracion || '').localeCompare(b.numeracion || '', undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}
