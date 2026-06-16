/** Formato de fechas y números consistente en toda la app: DD/MM/AAAA y coma decimal / punto de miles (es-ES). */

/** Acepta 'YYYY-MM-DD', cualquier string parseable por Date, o un objeto Date. Devuelve 'DD/MM/AAAA'. */
export function fmtDateEs(value: string | Date): string {
  const d = typeof value === 'string'
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)
    : value
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

/** Convierte un número escrito en formato español ("1.234,56") a un Number JS (1234.56). */
export function parseEsNumber(raw: string): number {
  return Number(raw.trim().replace(/\./g, '').replace(',', '.'))
}

/** Formatea un número como string español: punto de miles, coma decimal (sin símbolo de moneda). */
export function fmtEsNumber(val: number, decimals = 2): string {
  return val.toLocaleString('es', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
