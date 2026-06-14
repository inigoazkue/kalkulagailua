import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { fetchAccounts, fetchTransactions, fetchPayrollDates, Transaction } from '../api/client'
import { clsx } from 'clsx'

type PeriodType = 'payroll' | 'month' | 'quarter' | 'year' | 'custom'

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'payroll', label: 'Nómina a nómina' },
  { value: 'month', label: 'Mes natural' },
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
  customStart: string,
  customEnd: string,
): { start: string; end: string } | null {
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date()
  switch (type) {
    case 'payroll':
      return cycles[cycleIdx] ?? null
    case 'month': {
      const y = now.getFullYear(), m = now.getMonth()
      const last = new Date(y, m + 1, 0).getDate()
      return { start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-${pad(last)}` }
    }
    case 'quarter': {
      const qm = Math.floor(now.getMonth() / 3) * 3
      return { start: `${now.getFullYear()}-${pad(qm + 1)}-01`, end: today }
    }
    case 'year':
      return { start: `${now.getFullYear()}-01-01`, end: today }
    case 'custom':
      return customStart && customEnd ? { start: customStart, end: customEnd } : null
  }
}

function aggregateChartData(items: Transaction[]) {
  let income = 0, fixedExp = 0, varExp = 0, invest = 0
  const byDay: Record<string, { date: string; Ingresos: number; Gastos: number }> = {}
  const byCat: Record<string, { name: string; color: string; value: number }> = {}

  for (const tx of items) {
    const amount = Number(tx.amount)
    if (!byDay[tx.date]) byDay[tx.date] = { date: tx.date, Ingresos: 0, Gastos: 0 }
    if (amount > 0) {
      byDay[tx.date].Ingresos += amount
      income += amount
    } else {
      byDay[tx.date].Gastos += Math.abs(amount)
      const catType = tx.category_assignment?.category.category_type
      const catName = tx.category_assignment?.category.name ?? 'Sin categoría'
      const catColor = tx.category_assignment?.category.color ?? '#6b7280'
      if (!byCat[catName]) byCat[catName] = { name: catName, color: catColor, value: 0 }
      byCat[catName].value += Math.abs(amount)
      if (catType === 'fixed_expense') fixedExp += Math.abs(amount)
      else if (catType === 'investment') invest += Math.abs(amount)
      else varExp += Math.abs(amount)
    }
  }

  return {
    barData: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
    pieData: Object.values(byCat).filter(d => d.value > 0).sort((a, b) => b.value - a.value),
    summary: { income, fixedExp, varExp, invest, net: income - fixedExp - varExp - invest },
  }
}

export default function Analytics() {
  const [accountIdx, setAccountIdx] = useState(0)
  const [periodType, setPeriodType] = useState<PeriodType>('payroll')
  const [cycleIdx, setCycleIdx] = useState(0)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts })
  const { data: payrollData } = useQuery({ queryKey: ['payroll-dates'], queryFn: fetchPayrollDates })

  const cycles = useMemo(() => buildPayrollCycles(payrollData?.dates ?? []), [payrollData])
  const effectiveType = periodType === 'payroll' && !cycles.length ? 'month' : periodType
  const period = useMemo(
    () => computePeriod(effectiveType, cycles, cycleIdx, customStart, customEnd),
    [effectiveType, cycles, cycleIdx, customStart, customEnd]
  )

  const account = accounts[accountIdx] ?? null

  const { data: txList } = useQuery({
    queryKey: ['analytics-txns', account?.id, period?.start, period?.end],
    queryFn: () => fetchTransactions({ account_id: account!.id, start: period!.start, end: period!.end, limit: 2000 }),
    enabled: !!account && !!period,
  })

  const { barData, pieData, summary } = useMemo(
    () => aggregateChartData(txList?.items ?? []),
    [txList]
  )

  const barInterval = barData.length > 20 ? Math.floor(barData.length / 10) : 0

  return (
    <div className="space-y-5">
      {/* Header + period selector */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-white">Analítica</h2>

        <select
          value={periodType}
          onChange={e => { setPeriodType(e.target.value as PeriodType); setCycleIdx(0) }}
          className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {periodType === 'payroll' && cycles.length > 0 && (
          <select
            value={cycleIdx}
            onChange={e => setCycleIdx(Number(e.target.value))}
            className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {cycles.map((c, i) => <option key={i} value={i}>{c.label}</option>)}
          </select>
        )}

        {periodType === 'payroll' && !cycles.length && (
          <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-lg">
            Marca una cuenta como "Cuenta nómina" en Ajustes → Cuentas
          </span>
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

      {/* Account tabs */}
      {accounts.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-8 text-center text-slate-400 text-sm">
          No hay cuentas. Crea una en Ajustes → Cuentas.
        </div>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {accounts.map((a, i) => (
              <button
                key={a.id}
                onClick={() => setAccountIdx(i)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  accountIdx === i
                    ? 'bg-slate-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                )}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                {a.name}
              </button>
            ))}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Ingresos', value: summary.income, color: 'text-green-400' },
              { label: 'Gastos fijos', value: summary.fixedExp, color: 'text-red-400' },
              { label: 'Gastos variables', value: summary.varExp, color: 'text-orange-400' },
              { label: 'Inversión', value: summary.invest, color: 'text-purple-400' },
              { label: 'Neto', value: summary.net, color: summary.net >= 0 ? 'text-blue-400' : 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
                <div className={`text-xl font-bold mt-1 ${color}`}>{fmt(value)}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Ingresos y gastos diarios</h3>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} barSize={barData.length > 25 ? 4 : 7} barGap={1}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickFormatter={fmtDate}
                      interval={barInterval}
                    />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${v}€`} width={60} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: 12 }}
                      labelFormatter={fmtDate}
                      formatter={(v: number) => fmt(v)}
                    />
                    <Legend />
                    <Bar dataKey="Ingresos" fill="#22c55e" />
                    <Bar dataKey="Gastos" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Sin datos en este período</div>
              )}
            </div>

            <div className="bg-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Gastos por categoría</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) => percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ''}
                      labelLine={false}
                    >
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: 12 }}
                      formatter={(v: number) => fmt(v)}
                    />
                    <Legend
                      formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
                    />
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
