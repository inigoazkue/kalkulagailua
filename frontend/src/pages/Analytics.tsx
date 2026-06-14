import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { fetchAccounts, fetchPayrollDates, fetchAnalyticsData } from '../api/client'
import { clsx } from 'clsx'

type PeriodType = 'payroll' | 'month' | 'quarter' | 'year' | 'custom'

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'payroll', label: 'Nómina a nómina' },
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Año' },
  { value: 'custom', label: 'Entre fechas' },
]

const fmt = (v: number) => v.toLocaleString('es', { style: 'currency', currency: 'EUR' })
const fmtDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })
const pad = (n: number) => String(n).padStart(2, '0')

function buildPayrollCycles(dates: string[]) {
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

function computePeriod(
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
      const last = new Date(y, m + 1, 0).getDate()
      return { start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-${pad(last)}` }
    }
    case 'quarter': {
      const curQ = Math.floor(now.getMonth() / 3)
      const total = now.getFullYear() * 4 + curQ - quarterOffset
      const y = Math.floor(total / 4)
      const q = total % 4
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

export default function Analytics() {
  const now = useMemo(() => new Date(), [])
  const navigate = useNavigate()

  const [accountIdx, setAccountIdx] = useState(0)
  const [periodType, setPeriodType] = useState<PeriodType>('payroll')
  const [cycleIdx, setCycleIdx] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [quarterOffset, setQuarterOffset] = useState(0)
  const [yearOffset, setYearOffset] = useState(0)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts })
  const { data: payrollData } = useQuery({ queryKey: ['payroll-dates'], queryFn: fetchPayrollDates })

  const cycles = useMemo(() => buildPayrollCycles(payrollData?.dates ?? []), [payrollData])

  const monthOptions = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      return { value: i, label: d.toLocaleString('es', { month: 'long', year: 'numeric' }) }
    }), [now])

  const quarterOptions = useMemo(() => {
    const curQ = Math.floor(now.getMonth() / 3)
    return Array.from({ length: 8 }, (_, i) => {
      const total = now.getFullYear() * 4 + curQ - i
      return { value: i, label: `Q${(total % 4) + 1} ${Math.floor(total / 4)}` }
    })
  }, [now])

  const yearOptions = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({ value: i, label: String(now.getFullYear() - i) })), [now])

  const effectiveType: PeriodType = periodType === 'payroll' && !cycles.length ? 'month' : periodType
  const period = useMemo(
    () => computePeriod(effectiveType, cycles, cycleIdx, monthOffset, quarterOffset, yearOffset, customStart, customEnd),
    [effectiveType, cycles, cycleIdx, monthOffset, quarterOffset, yearOffset, customStart, customEnd]
  )

  const account = accounts[accountIdx] ?? null

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['analytics-data', account?.id, period?.start, period?.end],
    queryFn: () => fetchAnalyticsData({ account_id: account!.id, start: period!.start, end: period!.end }),
    enabled: !!account && !!period,
  })

  const summary = analyticsData?.summary ?? { income: 0, fixed_expenses: 0, variable_expenses: 0, investment: 0, net: 0 }
  const barData = analyticsData?.daily ?? []
  const pieData = analyticsData?.categories ?? []
  const barInterval = barData.length > 20 ? Math.floor(barData.length / 10) : 0

  function goToTransactions(categoryType?: string) {
    if (!period) return
    const p = new URLSearchParams({ start: period.start, end: period.end })
    if (account) p.set('account_id', String(account.id))
    if (categoryType) p.set('category_type', categoryType)
    navigate(`/transactions?${p.toString()}`)
  }

  const metrics = [
    { label: 'Ingresos', value: summary.income, color: 'text-green-400', categoryType: 'income' },
    { label: 'Gastos fijos', value: summary.fixed_expenses, color: 'text-red-400', categoryType: 'fixed_expense' },
    { label: 'Gastos variables', value: summary.variable_expenses, color: 'text-orange-400', categoryType: 'variable_expense' },
    { label: 'Inversión', value: summary.investment, color: 'text-purple-400', categoryType: 'investment' },
    { label: 'Neto', value: summary.net, color: summary.net >= 0 ? 'text-blue-400' : 'text-red-400', categoryType: undefined },
  ]

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold text-white mr-1">Analítica</h2>

        <select value={periodType}
          onChange={e => { setPeriodType(e.target.value as PeriodType); setCycleIdx(0) }}
          className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500">
          {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {periodType === 'payroll' && cycles.length > 0 && (
          <select value={cycleIdx} onChange={e => setCycleIdx(Number(e.target.value))}
            className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500">
            {cycles.map((c, i) => <option key={i} value={i}>{c.label}</option>)}
          </select>
        )}
        {periodType === 'payroll' && !cycles.length && (
          <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-lg">
            Marca una cuenta como "Cuenta nómina" en Ajustes → Cuentas
          </span>
        )}

        {periodType === 'month' && (
          <select value={monthOffset} onChange={e => setMonthOffset(Number(e.target.value))}
            className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500">
            {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}

        {periodType === 'quarter' && (
          <select value={quarterOffset} onChange={e => setQuarterOffset(Number(e.target.value))}
            className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500">
            {quarterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}

        {periodType === 'year' && (
          <select value={yearOffset} onChange={e => setYearOffset(Number(e.target.value))}
            className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500">
            {yearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}

        {periodType === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none" />
            <span className="text-slate-400 text-sm">→</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none" />
          </div>
        )}

        {period && (
          <span className="text-xs text-slate-500 ml-auto">
            {fmtDate(period.start)} – {fmtDate(period.end)}
          </span>
        )}
      </div>

      {accounts.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-8 text-center text-slate-400 text-sm">
          No hay cuentas. Crea una en Ajustes → Cuentas.
        </div>
      ) : (
        <>
          {/* Account tabs */}
          <div className="flex gap-2 flex-wrap">
            {accounts.map((a, i) => (
              <button key={a.id} onClick={() => setAccountIdx(i)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  accountIdx === i ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                )}>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                {a.name}
              </button>
            ))}
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {metrics.map(({ label, value, color, categoryType }) => (
              <button key={label}
                onClick={() => goToTransactions(categoryType)}
                disabled={!categoryType || !period}
                className={clsx(
                  'bg-slate-800 rounded-xl p-4 text-left transition-colors',
                  categoryType ? 'hover:bg-slate-700 cursor-pointer' : 'cursor-default'
                )}>
                <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
                <div className={`text-xl font-bold mt-1 ${color}`}>
                  {isLoading ? <span className="text-slate-600">—</span> : fmt(value)}
                </div>
                {categoryType && <div className="text-xs text-slate-600 mt-1">Ver transacciones →</div>}
              </button>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Ingresos y gastos diarios</h3>
              {isLoading ? (
                <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Cargando...</div>
              ) : barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} barSize={barData.length > 25 ? 4 : 7} barGap={1}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickFormatter={fmtDate} interval={barInterval} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${v}€`} width={60} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: 12 }}
                      labelFormatter={fmtDate} formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="income" name="Ingresos" fill="#22c55e" />
                    <Bar dataKey="expenses" name="Gastos" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Sin datos en este período</div>
              )}
            </div>

            <div className="bg-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Gastos por categoría</h3>
              {isLoading ? (
                <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Cargando...</div>
              ) : pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} dataKey="total" nameKey="name" cx="50%" cy="50%"
                      outerRadius={90}
                      label={({ percent }) => percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ''}
                      labelLine={false}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: 12 }}
                      formatter={(v: number) => fmt(v)} />
                    <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Sin gastos en este período</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
