import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { fetchAccounts, fetchPayrollDates, fetchAnalyticsData, AnalyticsCategory } from '../api/client'
import { clsx } from 'clsx'
import {
  PeriodType, PERIOD_OPTIONS, buildPayrollCycles, computePeriod,
  buildMonthOptions, buildQuarterOptions, buildYearOptions,
} from '../utils/periods'

const fmt = (v: number) => v.toLocaleString('es', { style: 'currency', currency: 'EUR' })
const fmtDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })

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

  const monthOptions = useMemo(() => buildMonthOptions(now), [now])
  const quarterOptions = useMemo(() => buildQuarterOptions(now), [now])
  const yearOptions = useMemo(() => buildYearOptions(now), [now])

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

  // Build shared URL params
  function txParams(extra: Record<string, string> = {}) {
    const p = new URLSearchParams()
    if (period) { p.set('start', period.start); p.set('end', period.end) }
    if (account) p.set('account_id', String(account.id))
    Object.entries(extra).forEach(([k, v]) => p.set(k, v))
    return p.toString()
  }

  // Metric card navigation — uses `metric` param that replicates analytics logic exactly
  function goMetric(metric: string) {
    navigate(`/transactions?${txParams({ metric })}`)
  }

  // Bar click: navigate to that specific day
  function handleBarClick(data: any) {
    if (!data?.activeLabel) return
    const day = data.activeLabel as string
    // Use start=day&end=day for the clicked date, keep account
    const p = new URLSearchParams()
    p.set('start', day)
    p.set('end', day)
    if (account) p.set('account_id', String(account.id))
    navigate(`/transactions?${p.toString()}`)
  }

  // Pie click: navigate to that category's transactions
  function handlePieClick(entry: AnalyticsCategory) {
    if (entry.id === null) {
      // "Sin categoría" → uncategorized negative transactions in the period
      navigate(`/transactions?${txParams({ metric: 'uncategorized' })}`)
    } else {
      navigate(`/transactions?${txParams({ category_id: String(entry.id) })}`)
    }
  }

  const metrics = [
    { label: 'Ingresos', value: summary.income, color: 'text-green-400', metric: 'income' },
    { label: 'Gastos fijos', value: summary.fixed_expenses, color: 'text-red-400', metric: 'fixed_expense' },
    { label: 'Gastos variables', value: summary.variable_expenses, color: 'text-orange-400', metric: 'variable_expense' },
    { label: 'Inversión', value: summary.investment, color: 'text-purple-400', metric: 'investment' },
    { label: 'Neto', value: summary.net, color: summary.net >= 0 ? 'text-blue-400' : 'text-red-400', metric: '' },
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
                <div className="text-left">
                  <div>{a.name}</div>
                  {a.current_balance !== null && (
                    <div className="text-xs font-normal text-slate-400">{fmt(Number(a.current_balance))}</div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Metric cards — clickable, navigate with exact analytics logic */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {metrics.map(({ label, value, color, metric }) => (
              <button key={label}
                onClick={() => metric && period && goMetric(metric)}
                disabled={!metric || !period}
                className={clsx(
                  'bg-slate-800 rounded-xl p-4 text-left transition-colors',
                  metric ? 'hover:bg-slate-700 cursor-pointer' : 'cursor-default'
                )}>
                <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
                <div className={`text-xl font-bold mt-1 ${color}`}>
                  {isLoading ? <span className="text-slate-600">—</span> : fmt(value)}
                </div>
                {metric && <div className="text-xs text-slate-600 mt-1">Ver transacciones →</div>}
              </button>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Bar chart — click a bar to see that day's transactions */}
            <div className="bg-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-1">Ingresos y gastos diarios</h3>
              <p className="text-xs text-slate-500 mb-3">Haz clic en una barra para ver las transacciones de ese día</p>
              {isLoading ? (
                <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Cargando...</div>
              ) : barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} barSize={barData.length > 25 ? 4 : 7} barGap={1}
                    onClick={handleBarClick} style={{ cursor: 'pointer' }}>
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

            {/* Pie chart — click a slice to see that category's transactions */}
            <div className="bg-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-1">Gastos por categoría</h3>
              <p className="text-xs text-slate-500 mb-3">Haz clic en un sector para ver esas transacciones</p>
              {isLoading ? (
                <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Cargando...</div>
              ) : pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="total" nameKey="name" cx="50%" cy="50%"
                      outerRadius={90}
                      label={({ percent }) => percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ''}
                      labelLine={false}
                      onClick={(_data, _index, event) => {
                        event.stopPropagation()
                        handlePieClick(_data as AnalyticsCategory)
                      }}
                      style={{ cursor: 'pointer' }}>
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
