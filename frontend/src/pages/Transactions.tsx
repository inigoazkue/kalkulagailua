import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  fetchTransactions, fetchCategories, fetchAccounts, fetchPayrollDates,
  assignCategory, Transaction,
} from '../api/client'
import { clsx } from 'clsx'
import {
  PeriodType, PERIOD_OPTIONS, buildPayrollCycles, computePeriod,
  buildMonthOptions, buildQuarterOptions, buildYearOptions,
} from '../utils/periods'

type TxPeriodType = 'all' | PeriodType

const TX_PERIOD_OPTIONS: { value: TxPeriodType; label: string }[] = [
  { value: 'all', label: 'Todo' },
  ...PERIOD_OPTIONS,
]

const CATEGORY_TYPE_LABELS: Record<string, string> = {
  income: 'Ingresos',
  fixed_expense: 'Gastos fijos',
  variable_expense: 'Gastos variables',
  investment: 'Inversión',
}

const BANK_LABELS: Record<string, string> = {
  caixabank: 'CaixaBank',
  myinvestor: 'MyInvestor',
  trade_republic: 'Trade Republic',
  bit2me: 'Bit2Me',
}

const col = createColumnHelper<Transaction>()

const fmt = (val: string) =>
  Number(val).toLocaleString('es', { style: 'currency', currency: 'EUR' })

const selectCls = 'bg-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500'

function CategoryDropdown({ tx }: { tx: Transaction }) {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })

  const mutation = useMutation({
    mutationFn: (catId: number) => assignCategory(tx.id, catId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      setOpen(false)
    },
  })

  if (tx.is_internal_transfer) {
    return <span className="text-xs px-2 py-1 rounded-md bg-sky-500/20 text-sky-300">↔ Interna</span>
  }

  const current = tx.category_assignment?.category

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 transition-colors"
      >
        {current ? (
          <>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: current.color }} />
            {current.name}
          </>
        ) : (
          <span className="text-slate-400">Sin categoría</span>
        )}
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-52 bg-slate-700 rounded-lg shadow-xl border border-slate-600 py-1 max-h-64 overflow-y-auto">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => mutation.mutate(cat.id)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-600 flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              {cat.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Transactions() {
  const [searchParams] = useSearchParams()
  const now = useMemo(() => new Date(), [])
  const [page, setPage] = useState(1)
  const limit = 50

  // Init period from URL: if start+end provided, use custom; otherwise default to payroll
  const urlStart = searchParams.get('start') ?? ''
  const urlEnd = searchParams.get('end') ?? ''
  const hasUrlDates = !!(urlStart && urlEnd)

  const [periodType, setPeriodType] = useState<TxPeriodType>(hasUrlDates ? 'custom' : 'payroll')
  const [cycleIdx, setCycleIdx] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [quarterOffset, setQuarterOffset] = useState(0)
  const [yearOffset, setYearOffset] = useState(0)
  const [customStart, setCustomStart] = useState(urlStart)
  const [customEnd, setCustomEnd] = useState(urlEnd)

  const [bankId, setBankId] = useState<string>('')
  const [accountId, setAccountId] = useState<string>(searchParams.get('account_id') ?? '')
  const [categoryId, setCategoryId] = useState<string>(searchParams.get('category_id') ?? '')
  const [categoryType, setCategoryType] = useState<string>(searchParams.get('category_type') ?? '')
  const [metric, setMetric] = useState<string>(searchParams.get('metric') ?? '')

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })
  const { data: payrollData } = useQuery({ queryKey: ['payroll-dates'], queryFn: fetchPayrollDates })

  const cycles = useMemo(() => buildPayrollCycles(payrollData?.dates ?? []), [payrollData])
  const monthOptions = useMemo(() => buildMonthOptions(now), [now])
  const quarterOptions = useMemo(() => buildQuarterOptions(now), [now])
  const yearOptions = useMemo(() => buildYearOptions(now), [now])

  const effectivePeriodType: PeriodType =
    periodType === 'all'
      ? 'month' // won't be used but satisfies type
      : periodType === 'payroll' && !cycles.length
      ? 'month'
      : periodType

  const period = useMemo(() => {
    if (periodType === 'all') return null
    return computePeriod(effectivePeriodType, cycles, cycleIdx, monthOffset, quarterOffset, yearOffset, customStart, customEnd)
  }, [periodType, effectivePeriodType, cycles, cycleIdx, monthOffset, quarterOffset, yearOffset, customStart, customEnd])

  const activeStart = period?.start ?? ''
  const activeEnd = period?.end ?? ''

  // Unique banks from accounts
  const banks = useMemo(() => {
    const seen = new Set<string>()
    return accounts.filter(a => { const fresh = !seen.has(a.bank); seen.add(a.bank); return fresh }).map(a => a.bank)
  }, [accounts])

  // Accounts filtered by selected bank
  const filteredAccounts = useMemo(
    () => bankId ? accounts.filter(a => a.bank === bankId) : accounts,
    [accounts, bankId]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', page, activeStart, activeEnd, accountId, categoryId, categoryType, metric],
    queryFn: () =>
      fetchTransactions({
        page,
        limit,
        start: activeStart || undefined,
        end: activeEnd || undefined,
        account_id: accountId ? Number(accountId) : undefined,
        category_id: categoryId ? Number(categoryId) : undefined,
        category_type: categoryType || undefined,
        metric: metric || undefined,
      }),
  })

  const columns = [
    col.accessor('date', {
      header: 'Fecha',
      cell: info => info.getValue(),
    }),
    col.accessor('description', {
      header: 'Descripción',
      cell: info => (
        <span className="text-sm text-slate-200 max-w-xs truncate block" title={info.getValue()}>
          {info.getValue()}
        </span>
      ),
    }),
    col.accessor('amount', {
      header: 'Importe',
      cell: info => {
        const val = Number(info.getValue())
        return (
          <span className={clsx('font-mono font-medium', val >= 0 ? 'text-green-400' : 'text-red-400')}>
            {fmt(info.getValue())}
          </span>
        )
      },
    }),
    col.display({
      id: 'category',
      header: 'Categoría',
      cell: ({ row }) => <CategoryDropdown tx={row.original} />,
    }),
    col.accessor('account_id', {
      header: 'Cuenta',
      cell: info => {
        const acc = accounts.find(a => a.id === info.getValue())
        return <span className="text-xs text-slate-400">{acc?.name ?? info.getValue()}</span>
      },
    }),
  ]

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  function resetPage() { setPage(1) }

  return (
    <div className="space-y-4">
      {/* Active filter badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-white">Transacciones</h2>
        {metric && (
          <span className="flex items-center gap-1.5 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
            {CATEGORY_TYPE_LABELS[metric] ?? metric}
            <button onClick={() => { setMetric(''); resetPage() }} className="hover:text-white">✕</button>
          </span>
        )}
        {categoryId && categories.find(c => c.id === Number(categoryId)) && (
          <span className="flex items-center gap-1.5 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
            {categories.find(c => c.id === Number(categoryId))?.name}
            <button onClick={() => { setCategoryId(''); resetPage() }} className="hover:text-white">✕</button>
          </span>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-3">
        {/* Period row */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={periodType}
            onChange={e => { setPeriodType(e.target.value as TxPeriodType); setCycleIdx(0); resetPage() }}
            className={selectCls}>
            {TX_PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {periodType === 'payroll' && cycles.length > 0 && (
            <select value={cycleIdx} onChange={e => { setCycleIdx(Number(e.target.value)); resetPage() }} className={selectCls}>
              {cycles.map((c, i) => <option key={i} value={i}>{c.label}</option>)}
            </select>
          )}
          {periodType === 'payroll' && !cycles.length && (
            <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-lg">
              Marca una cuenta como "Cuenta nómina" en Ajustes → Cuentas
            </span>
          )}
          {periodType === 'month' && (
            <select value={monthOffset} onChange={e => { setMonthOffset(Number(e.target.value)); resetPage() }} className={selectCls}>
              {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {periodType === 'quarter' && (
            <select value={quarterOffset} onChange={e => { setQuarterOffset(Number(e.target.value)); resetPage() }} className={selectCls}>
              {quarterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {periodType === 'year' && (
            <select value={yearOffset} onChange={e => { setYearOffset(Number(e.target.value)); resetPage() }} className={selectCls}>
              {yearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {periodType === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart}
                onChange={e => { setCustomStart(e.target.value); resetPage() }}
                className={selectCls} />
              <span className="text-slate-400 text-sm">→</span>
              <input type="date" value={customEnd}
                onChange={e => { setCustomEnd(e.target.value); resetPage() }}
                className={selectCls} />
            </div>
          )}
          {period && (
            <span className="text-xs text-slate-500 ml-auto">
              {new Date(period.start + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}
              {' – '}
              {new Date(period.end + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Account / category row */}
        <div className="flex flex-wrap gap-2">
          <select value={bankId}
            onChange={e => {
              setBankId(e.target.value)
              // Clear account if it doesn't belong to the new bank
              if (e.target.value && accountId) {
                const acc = accounts.find(a => a.id === Number(accountId))
                if (acc && acc.bank !== e.target.value) { setAccountId('') }
              }
              resetPage()
            }}
            className={selectCls}>
            <option value="">Todos los bancos</option>
            {banks.map(b => <option key={b} value={b}>{BANK_LABELS[b] ?? b}</option>)}
          </select>

          <select value={accountId}
            onChange={e => { setAccountId(e.target.value); resetPage() }}
            className={selectCls}>
            <option value="">Todas las cuentas</option>
            {filteredAccounts.map(a => (
              <option key={a.id} value={a.id}>
                {bankId ? a.name : `${BANK_LABELS[a.bank] ?? a.bank} · ${a.name}`}
              </option>
            ))}
          </select>

          <select value={categoryType}
            onChange={e => { setCategoryType(e.target.value); setCategoryId(''); setMetric(''); resetPage() }}
            className={selectCls}>
            <option value="">Todos los tipos</option>
            {Object.entries(CATEGORY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          <select value={categoryId}
            onChange={e => { setCategoryId(e.target.value); setCategoryType(''); setMetric(''); resetPage() }}
            className={selectCls}>
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id} className="border-b border-slate-700">
                    {hg.headers.map(h => (
                      <th key={h.id} className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-3 text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400 text-sm">
                      No hay transacciones
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{data?.total ?? 0} transacciones</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span>Pág {page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
