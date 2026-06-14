import { useQuery } from '@tanstack/react-query'
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts'
import { fetchSummary, fetchTransactions } from '../api/client'

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

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 flex flex-col gap-1">
      <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{fmt(value)}</span>
    </div>
  )
}

export default function Dashboard() {
  const thisMonth = getMonthRange(0)

  const { data: summary } = useQuery({
    queryKey: ['summary', thisMonth.start, thisMonth.end],
    queryFn: () => fetchSummary({ start: thisMonth.start, end: thisMonth.end }),
  })

  const { data: txList } = useQuery({
    queryKey: ['transactions', thisMonth.start, thisMonth.end, 500],
    queryFn: () => fetchTransactions({ start: thisMonth.start, end: thisMonth.end, limit: 500 }),
  })

  const monthRanges = Array.from({ length: 6 }, (_, i) => getMonthRange(5 - i))

  const monthQueries = monthRanges.map(r => ({
    label: r.label,
    queryKey: ['summary', r.start, r.end] as const,
    params: { start: r.start, end: r.end },
  }))

  const { data: m0 } = useQuery({ queryKey: monthQueries[0].queryKey, queryFn: () => fetchSummary(monthQueries[0].params) })
  const { data: m1 } = useQuery({ queryKey: monthQueries[1].queryKey, queryFn: () => fetchSummary(monthQueries[1].params) })
  const { data: m2 } = useQuery({ queryKey: monthQueries[2].queryKey, queryFn: () => fetchSummary(monthQueries[2].params) })
  const { data: m3 } = useQuery({ queryKey: monthQueries[3].queryKey, queryFn: () => fetchSummary(monthQueries[3].params) })
  const { data: m4 } = useQuery({ queryKey: monthQueries[4].queryKey, queryFn: () => fetchSummary(monthQueries[4].params) })
  const { data: m5 } = useQuery({ queryKey: monthQueries[5].queryKey, queryFn: () => fetchSummary(monthQueries[5].params) })

  const monthlySummaries = [m0, m1, m2, m3, m4, m5]

  const trendData = monthRanges.map((r, i) => {
    const s = monthlySummaries[i]
    return {
      name: r.label,
      Ahorro: s ? Number(s.savings) : 0,
      Ingresos: s ? Number(s.income) : 0,
    }
  })

  const categorySpend: Record<string, { name: string; color: string; value: number }> = {}
  if (txList) {
    for (const tx of txList.items) {
      if (!tx.category_assignment) continue
      const cat = tx.category_assignment.category
      if (cat.category_type === 'income') continue
      const amount = Math.abs(Number(tx.amount))
      if (!categorySpend[cat.id]) {
        categorySpend[cat.id] = { name: cat.name, color: cat.color, value: 0 }
      }
      categorySpend[cat.id].value += amount
    }
  }
  const pieData = Object.values(categorySpend).filter(d => d.value > 0)

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Dashboard — {thisMonth.label}</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Ingresos" value={summary?.income ?? '0'} color="text-green-400" />
        <SummaryCard label="Gastos Fijos" value={summary?.fixed_expenses ?? '0'} color="text-red-400" />
        <SummaryCard label="Gastos Variables" value={summary?.variable_expenses ?? '0'} color="text-orange-400" />
        <SummaryCard label="Ahorro" value={summary?.savings ?? '0'} color="text-blue-400" />
      </div>

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
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              Sin datos este mes
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Tendencia de ahorro (6 meses)</h3>
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
