import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { fetchAccounts, fetchSummary, fetchPayrollDates, Account } from '../api/client'
import PrivacyToggle from '../components/PrivacyToggle'
import { Sensitive, SensitiveBlock } from '../components/Sensitive'

type PeriodType = 'payroll' | 'month' | 'quarter' | 'year'

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'payroll', label: 'Nómina a nómina' },
  { value: 'month', label: 'Mes natural' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Año' },
]

const fmt = (val: string | number) =>
  Number(val).toLocaleString('es', { style: 'currency', currency: 'EUR' })
const pad = (n: number) => String(n).padStart(2, '0')

function getCalendarMonthRange(monthsAgo: number) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
  const start = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const end = `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`
  return { start, end, label: d.toLocaleString('es', { month: 'short', year: '2-digit' }) }
}

function computePeriod(type: PeriodType, payrollDates: string[]): { start: string; end: string } | null {
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date()
  switch (type) {
    case 'payroll': {
      if (!payrollDates.length) return null
      const sorted = [...payrollDates].sort()
      return { start: sorted[sorted.length - 1], end: today }
    }
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
  }
}

function AccountSummaryCard({ account, start, end }: { account: Account; start: string; end: string }) {
  const { data: summary } = useQuery({
    queryKey: ['summary', start, end, account.id],
    queryFn: () => fetchSummary({ start, end, account_id: account.id }),
  })

  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: account.color }} />
        <span className="font-medium text-white text-sm">{account.name}</span>
        {account.current_balance !== null && (
          <span className="ml-auto text-sm font-semibold text-white"><Sensitive>{fmt(account.current_balance)}</Sensitive></span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-700/50 rounded-lg p-2">
          <div className="text-slate-400">Ingresos</div>
          <div className="text-green-400 font-semibold mt-0.5"><Sensitive>{fmt(summary?.income ?? 0)}</Sensitive></div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2 flex gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-slate-400">Fijos</div>
            <div className="text-red-400 font-semibold mt-0.5 truncate"><Sensitive>{fmt(summary?.fixed_expenses ?? 0)}</Sensitive></div>
          </div>
          <div className="w-px bg-slate-600 self-stretch shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-slate-400">Variables</div>
            <div className="text-orange-400 font-semibold mt-0.5 truncate"><Sensitive>{fmt(summary?.variable_expenses ?? 0)}</Sensitive></div>
          </div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2 flex gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-slate-400">Ahorro</div>
            <div className="text-emerald-400 font-semibold mt-0.5 truncate"><Sensitive>{fmt(summary?.savings_transfer ?? 0)}</Sensitive></div>
          </div>
          <div className="w-px bg-slate-600 self-stretch shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-slate-400">Inversión</div>
            <div className="text-purple-400 font-semibold mt-0.5 truncate"><Sensitive>{fmt(summary?.investment ?? 0)}</Sensitive></div>
          </div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2">
          <div className="text-slate-400">Neto período</div>
          <div className={`font-semibold mt-0.5 ${Number(summary?.savings ?? 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            <Sensitive>{fmt(summary?.savings ?? 0)}</Sensitive>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [periodType, setPeriodType] = useState<PeriodType>('payroll')

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts })
  const { data: payrollData } = useQuery({ queryKey: ['payroll-dates'], queryFn: fetchPayrollDates })

  const payrollDates = payrollData?.dates ?? []
  const hasPayrollAccount = accounts.some(a => a.is_payroll_account)
  const effectiveType: PeriodType = (periodType === 'payroll' && !payrollDates.length) ? 'month' : periodType

  const period = useMemo(() => computePeriod(effectiveType, payrollDates), [effectiveType, payrollDates])
  const fallbackPeriod = getCalendarMonthRange(0)
  const activePeriod = period ?? { start: fallbackPeriod.start, end: fallbackPeriod.end }

  const dashboardAccounts = accounts.filter(a => a.show_on_dashboard)
  const savingsAccounts = accounts.filter(a => a.include_in_savings)
  const hasSavings = savingsAccounts.length > 0
  const totalSavings = savingsAccounts.reduce((s, a) => s + Number(a.current_balance ?? 0), 0)
  const missingBalances = savingsAccounts.filter(a => a.current_balance === null)

  // Payroll income distribution pie
  const payrollAccount = accounts.find(a => a.is_payroll_account) ?? null
  const { data: payrollSummary } = useQuery({
    queryKey: ['summary', activePeriod.start, activePeriod.end, payrollAccount?.id],
    queryFn: () => fetchSummary({ start: activePeriod.start, end: activePeriod.end, account_id: payrollAccount!.id }),
    enabled: !!payrollAccount,
  })

  const payrollIncome = Number(payrollSummary?.income ?? 0)
  const incomePieData = useMemo(() => {
    if (!payrollSummary || payrollIncome <= 0) return []
    const fixed = Number(payrollSummary.fixed_expenses)
    const variable = Number(payrollSummary.variable_expenses)
    const savingsInv = Number(payrollSummary.savings_transfer) + Number(payrollSummary.investment)
    const libre = payrollIncome - fixed - variable - savingsInv
    return [
      { name: 'Gastos fijos', value: fixed, color: '#ef4444' },
      { name: 'Gastos variables', value: variable, color: '#f97316' },
      { name: 'Ahorro / Inversión', value: savingsInv, color: '#10b981' },
      ...(libre > 0 ? [{ name: 'Libre', value: libre, color: '#475569' }] : []),
    ].filter(d => d.value > 0)
  }, [payrollSummary, payrollIncome])

  // Trend: last 6 calendar months, savings accounts only
  const monthRanges = Array.from({ length: 6 }, (_, i) => getCalendarMonthRange(5 - i))
  const { data: m0 } = useQuery({ queryKey: ['summary', 'savings', monthRanges[0].start, monthRanges[0].end], queryFn: () => fetchSummary({ start: monthRanges[0].start, end: monthRanges[0].end, savings_only: true }) })
  const { data: m1 } = useQuery({ queryKey: ['summary', 'savings', monthRanges[1].start, monthRanges[1].end], queryFn: () => fetchSummary({ start: monthRanges[1].start, end: monthRanges[1].end, savings_only: true }) })
  const { data: m2 } = useQuery({ queryKey: ['summary', 'savings', monthRanges[2].start, monthRanges[2].end], queryFn: () => fetchSummary({ start: monthRanges[2].start, end: monthRanges[2].end, savings_only: true }) })
  const { data: m3 } = useQuery({ queryKey: ['summary', 'savings', monthRanges[3].start, monthRanges[3].end], queryFn: () => fetchSummary({ start: monthRanges[3].start, end: monthRanges[3].end, savings_only: true }) })
  const { data: m4 } = useQuery({ queryKey: ['summary', 'savings', monthRanges[4].start, monthRanges[4].end], queryFn: () => fetchSummary({ start: monthRanges[4].start, end: monthRanges[4].end, savings_only: true }) })
  const { data: m5 } = useQuery({ queryKey: ['summary', 'savings', monthRanges[5].start, monthRanges[5].end], queryFn: () => fetchSummary({ start: monthRanges[5].start, end: monthRanges[5].end, savings_only: true }) })

  const trendData = monthRanges.map((r, i) => {
    const s = [m0, m1, m2, m3, m4, m5][i]
    return {
      name: r.label,
      Ingresos: s ? Number(s.income) : 0,
      Gastos: s ? -(Number(s.fixed_expenses) + Number(s.variable_expenses)) : 0,
      Inversión: s ? -Number(s.investment) : 0,
      'Ahorro neto': s ? Number(s.savings) : 0,
    }
  })

  const periodLabel = period
    ? `${new Date(activePeriod.start + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })} – ${new Date(activePeriod.end + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : ''

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-semibold text-white">Dashboard</h2>
          <select
            value={periodType}
            onChange={e => setPeriodType(e.target.value as PeriodType)}
            className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {period && <span className="text-xs text-slate-500">{periodLabel}</span>}
          {periodType === 'payroll' && !payrollDates.length && hasPayrollAccount && (
            <span className="text-xs text-amber-400">Sin nóminas importadas aún</span>
          )}
          {periodType === 'payroll' && !hasPayrollAccount && (
            <span className="text-xs text-amber-400">Marca una cuenta como "Cuenta nómina" en Ajustes → Cuentas</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PrivacyToggle />
          {hasSavings && (
            <div className="text-right">
              <div className="text-xs text-slate-400">Ahorro total</div>
              <div className="text-2xl font-bold text-green-400"><Sensitive>{fmt(totalSavings)}</Sensitive></div>
              {missingBalances.length > 0 && (
                <div className="text-xs text-amber-400 mt-0.5">
                  Sin saldo: {missingBalances.map(a => a.name).join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {dashboardAccounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dashboardAccounts.map(a => (
            <AccountSummaryCard key={a.id} account={a} start={activePeriod.start} end={activePeriod.end} />
          ))}
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl p-8 text-center text-slate-400 text-sm">
          Activa "Mostrar en dashboard" en alguna cuenta para ver sus métricas aquí.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income distribution pie — payroll account */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-1">Distribución de ingresos</h3>
          <p className="text-xs text-slate-500 mb-3">
            {payrollAccount ? `${payrollAccount.name} · período seleccionado` : 'Marca una cuenta como "Cuenta nómina" en Ajustes → Cuentas'}
          </p>
          {payrollAccount && incomePieData.length > 0 ? (
            <SensitiveBlock>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={incomePieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    label={({ percent }) => percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}
                  >
                    {incomePieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      `${fmt(v)}${payrollIncome > 0 ? ` · ${((v / payrollIncome) * 100).toFixed(1)}% de ingresos` : ''}`,
                      name,
                    ]}
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: 12 }}
                  />
                  <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-center text-xs text-slate-500 mt-1">
                Ingresos totales: <span className="text-green-400 font-medium">{fmt(payrollIncome)}</span>
              </p>
            </SensitiveBlock>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              {!payrollAccount ? 'Sin cuenta nómina configurada' : 'Sin datos en este período'}
            </div>
          )}
        </div>

        {/* 6-month savings trend */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-1">Tendencia (6 meses)</h3>
          <p className="text-xs text-slate-500 mb-3">Cuentas de ahorro total · meses naturales</p>
          <SensitiveBlock>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${v}€`} />
                <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: 12 }}
                  formatter={(v: number) => fmt(v)}
                />
                <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
                <Line type="monotone" dataKey="Ingresos" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                <Line type="monotone" dataKey="Gastos" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                <Line type="monotone" dataKey="Inversión" stroke="#a855f7" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                <Line type="monotone" dataKey="Ahorro neto" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </SensitiveBlock>
        </div>
      </div>
    </div>
  )
}
