export type PeriodType = 'payroll' | 'month' | 'quarter' | 'year' | 'custom'

export const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'payroll', label: 'Nómina a nómina' },
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Año' },
  { value: 'custom', label: 'Entre fechas' },
]

const pad = (n: number) => String(n).padStart(2, '0')

export function buildPayrollCycles(dates: string[]) {
  if (!dates.length) return []
  const sorted = [...dates].sort()
  const today = new Date().toISOString().slice(0, 10)
  const cycles: { label: string; start: string; end: string }[] = []
  const last = new Date(sorted[sorted.length - 1] + 'T00:00:00')
  cycles.push({
    label: `${last.toLocaleString('es', { month: 'long', year: 'numeric' })} (en curso)`,
    start: sorted[sorted.length - 1],
    end: today,
  })
  for (let i = sorted.length - 1; i > 0; i--) {
    const s = new Date(sorted[i - 1] + 'T00:00:00')
    const e = new Date(sorted[i] + 'T00:00:00')
    cycles.push({
      label: `${s.toLocaleString('es', { day: 'numeric', month: 'short' })} → ${e.toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      start: sorted[i - 1],
      end: sorted[i],
    })
  }
  return cycles
}

export function computePeriod(
  type: PeriodType,
  cycles: { start: string; end: string }[],
  cycleIdx: number,
  monthOffset: number,
  quarterOffset: number,
  yearOffset: number,
  customStart: string,
  customEnd: string,
): { start: string; end: string } | null {
  const now = new Date()
  switch (type) {
    case 'payroll':
      return cycles[cycleIdx] ?? null
    case 'month': {
      const d = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1)
      const y = d.getFullYear(), m = d.getMonth()
      return { start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}` }
    }
    case 'quarter': {
      const curQ = Math.floor(now.getMonth() / 3)
      const total = now.getFullYear() * 4 + curQ - quarterOffset
      const y = Math.floor(total / 4), q = total % 4
      const sm = q * 3, em = sm + 2
      return { start: `${y}-${pad(sm + 1)}-01`, end: `${y}-${pad(em + 1)}-${pad(new Date(y, em + 1, 0).getDate())}` }
    }
    case 'year': {
      const y = now.getFullYear() - yearOffset
      return { start: `${y}-01-01`, end: `${y}-12-31` }
    }
    case 'custom':
      return customStart && customEnd ? { start: customStart, end: customEnd } : null
  }
}

export function buildMonthOptions(now: Date) {
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return { value: i, label: d.toLocaleString('es', { month: 'long', year: 'numeric' }) }
  })
}

export function buildQuarterOptions(now: Date) {
  const curQ = Math.floor(now.getMonth() / 3)
  return Array.from({ length: 8 }, (_, i) => {
    const total = now.getFullYear() * 4 + curQ - i
    return { value: i, label: `Q${(total % 4) + 1} ${Math.floor(total / 4)}` }
  })
}

export function buildYearOptions(now: Date) {
  return Array.from({ length: 5 }, (_, i) => ({ value: i, label: String(now.getFullYear() - i) }))
}
