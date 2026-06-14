import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { fetchTransactions, fetchCategories, fetchAccounts, assignCategory, Transaction } from '../api/client'
import { clsx } from 'clsx'

const CATEGORY_TYPE_LABELS: Record<string, string> = {
  income: 'Ingresos',
  fixed_expense: 'Gastos fijos',
  variable_expense: 'Gastos variables',
  investment: 'Inversión',
}

const col = createColumnHelper<Transaction>()

const fmt = (val: string) =>
  Number(val).toLocaleString('es', { style: 'currency', currency: 'EUR' })

function CategoryDropdown({ tx }: { tx: Transaction }) {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })

  const mutation = useMutation({
    mutationFn: (catId: number) => assignCategory(tx.id, catId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      setOpen(false)
    },
  })

  const current = tx.category_assignment?.category

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 transition-colors"
      >
        {current ? (
          <>
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: current.color }}
            />
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
  const [page, setPage] = useState(1)
  const [start, setStart] = useState(searchParams.get('start') ?? '')
  const [end, setEnd] = useState(searchParams.get('end') ?? '')
  const [accountId, setAccountId] = useState<string>(searchParams.get('account_id') ?? '')
  const [categoryId, setCategoryId] = useState<string>(searchParams.get('category_id') ?? '')
  const [categoryType, setCategoryType] = useState<string>(searchParams.get('category_type') ?? '')
  const [metric, setMetric] = useState<string>(searchParams.get('metric') ?? '')
  const limit = 50

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', page, start, end, accountId, categoryId, categoryType, metric],
    queryFn: () =>
      fetchTransactions({
        page,
        limit,
        start: start || undefined,
        end: end || undefined,
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-white">Transacciones</h2>
        {metric && (
          <span className="flex items-center gap-1.5 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
            {CATEGORY_TYPE_LABELS[metric] ?? metric}
            <button onClick={() => { setMetric(''); setPage(1) }} className="hover:text-white">✕</button>
          </span>
        )}
        {categoryId && categories.find(c => c.id === Number(categoryId)) && (
          <span className="flex items-center gap-1.5 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
            {categories.find(c => c.id === Number(categoryId))?.name}
            <button onClick={() => { setCategoryId(''); setPage(1) }} className="hover:text-white">✕</button>
          </span>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl p-4 flex flex-wrap gap-3">
        <input
          type="date"
          value={start}
          onChange={e => { setStart(e.target.value); setPage(1) }}
          className="bg-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Desde"
        />
        <input
          type="date"
          value={end}
          onChange={e => { setEnd(e.target.value); setPage(1) }}
          className="bg-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Hasta"
        />
        <select
          value={accountId}
          onChange={e => { setAccountId(e.target.value); setPage(1) }}
          className="bg-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todas las cuentas</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select
          value={categoryType}
          onChange={e => { setCategoryType(e.target.value); setCategoryId(''); setPage(1) }}
          className="bg-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(CATEGORY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          value={categoryId}
          onChange={e => { setCategoryId(e.target.value); setCategoryType(''); setPage(1) }}
          className="bg-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

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
