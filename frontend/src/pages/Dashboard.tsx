import { useQuery } from '@tanstack/react-query'
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts'
import { fetchAccounts, fetchSummary, fetchTransactions, Account } from '../api/client'

function getMonthRange(monthsAgo: number) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
  const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const end = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  return { start, end, label: d.toLocaleString('es', { month: 'short', year: '2-digit' }) }
}

const fmt = (val: string | number) =>
  Number(val).toLocaleString('es', { style: 'currency', currency: 'EUR' })

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
          <span className="ml-auto text-sm font-semibold text-white">{fmt(account.current_balance)}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-700/50 rounded-lg p-2">
          <div className="text-slate-400">Ingresos</div>
          <div className="text-green-400 font-semibold mt-0.5">{fmt(summary?.income ?? 0)}</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2">
          <div className="text-slate-400">Gastos fijos</div>
          <div className="text-red-400 font-semibold mt-0.5">{fmt(summary?.fixed_expenses ?? 0)}</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2">
          <div className="text-slate-400">Gastos variables</div>
          <div className="text-orange-400 font-semibold mt-0.5">{fmt(summary?.variable_expenses ?? 0)}</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2">
          <div className="text-slate-400">Neto mes</div>
          <div className={`font-semibold mt-0.5 ${Number(summary?.savings ?? 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {fmt(summary?.savings ?? 0)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const thisMonth = getMonthRange(0)

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts })

  const dashboardAccounts = accounts.filter(a => a.show_on_dashboard)
  const savingsAccounts = accounts.filter(a => a.include_in_savings && a.current_balance !== null)
  const totalSavings = savingsAccounts.reduce((s, a) => s + Number(a.current_balance), 0)
  const hasSavings = savingsAccounts.length > 0

  const { data: txList } = useQuery({
    queryKey: ['transactions', thisMonth.start, thisMonth.end, 500],
    queryFn: () => fetchTransactions({ start: thisMonth.start, end: thisMonth.end, limit: 500 }),
  })

  const monthRanges = Array.from({ length: 6 }, (_, i) => getMonthRange(5 - i))

  const { data: m0 } = useQuery({ queryKey: ['summary', monthRanges[0].start, monthRanges[0].end], queryFn: () => fetchSummary({ start: monthRanges[0].start, end: monthRanges[0].end }) })
  const { data: m1 } = useQuery({ queryKey: ['summary', monthRanges[1].start, monthRanges[1].end], queryFn: () => fetchSummary({ start: monthRanges[1].start, end: monthRanges[1].end }) })
  const { data: m2 } = useQuery({ queryKey: ['summary', monthRanges[2].start, monthRanges[2].end], queryFn: () => fetchSummary({ start: monthRanges[2].start, end: monthRanges[2].end }) })
  const { data: m3 } = useQuery({ queryKey: ['summary', monthRanges[3].start, monthRanges[3].end], queryFn: () => fetchSummary({ start: monthRanges[3].start, end: monthRanges[3].end }) })
  const { data: m4 } = useQuery({ queryKey: ['summary', monthRanges[4].start, monthRanges[4].end], queryFn: () => fetchSummary({ start: monthRanges[4].start, end: monthRanges[4].end }) })
  const { data: m5 } = useQuery({ queryKey: ['summary', monthRanges[5].start, monthRanges[5].end], queryFn: () => fetchSummary({ start: monthRanges[5].start, end: monthRanges[5].end }) })

  const trendData = monthRanges.map((r, i) => {
    const s = [m0, m1, m2, m3, m4, m5][i]
    return { name: r.label, Ahorro: s ? Number(s.savings) : 0, Ingresos: s ? Number(s.income) : 0 }
  })

  const categorySpend: Record<string, { name: string; color: string; value: number }> = {}
  if (txList) {
    for (const tx of txList.items) {
      if (!tx.category_assignment) continue
      const cat = tx.category_assignment.category
      if (cat.category_type === 'income') continue
      const amount = Math.abs(Number(tx.amount))
      if (!categorySpend[cat.id]) categorySpend[cat.id] = { name: cat.name, color: cat.color, value: 0 }
      categorySpend[cat.id].value += amount
    }
  }
  const pieData = Object.values(categorySpend).filter(d => d.value > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h2 className="text-xl font-semibold text-white">Dashboard — {thisMonth.label}</h2>
        {hasSavings && (
          <div className="text-right">
            <div className="text-xs text-slate-400">Ahorro total</div>
            <div className="text-2xl font-bold text-green-400">{fmt(totalSavings)}</div>
          </div>
        )}
      </div>

      {dashboardAccounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dashboardAccounts.map(a => (
            <AccountSummaryCard key={a.id} account={a} start={thisMonth.start} end={thisMonth.end} />
          ))}
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl p-8 text-center text-slate-400 text-sm">
          Activa "Mostrar en dashboard" en alguna cuenta para ver sus métricas aquí.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Gasto por categoría</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Sin datos este mes</div>
          )}
        </div>

        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Tendencia (6 meses)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${v}€`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                formatter={(v: number) => fmt(v)}
              />
              <Legend />
              <Line type="monotone" dataKey="Ingresos" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Ahorro" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
