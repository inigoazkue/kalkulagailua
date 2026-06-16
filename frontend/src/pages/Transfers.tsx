import { useRef, useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { fetchTransfers, deleteTransfer, detectTransfers, validateTransfers, fetchAccounts, fetchCategories, assignCategory } from '../api/client'
import { Trash2, ArrowLeftRight, Search, Check, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import PrivacyToggle from '../components/PrivacyToggle'
import { Sensitive } from '../components/Sensitive'

const fmt = (val: string) =>
  Number(val).toLocaleString('es', { style: 'currency', currency: 'EUR' })

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  fixed_expense: 'Gastos fijos',
  variable_expense: 'Gastos variables',
  investment: 'Inversión',
  savings: 'Ahorro',
}
const EXPENSE_TYPE_ORDER = ['fixed_expense', 'variable_expense', 'investment', 'savings']

function TxCategoryDropdown({ txId, current }: { txId: number; current: { id: number; name: string; color: string } | null }) {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })

  const mutation = useMutation({
    mutationFn: (catId: number) => assignCategory(txId, catId, false),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      setOpen(false)
    },
  })

  // tx_out is always a debit — only show expense/savings/investment categories
  const grouped = EXPENSE_TYPE_ORDER
    .map(type => ({
      type,
      label: EXPENSE_TYPE_LABELS[type],
      items: categories.filter(c => c.category_type === type),
    }))
    .filter(g => g.items.length > 0)

  return (
    <div className="relative mt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-slate-600 hover:bg-slate-500 transition-colors max-w-[160px]"
      >
        {current ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: current.color }} />
            <span className="truncate">{current.name}</span>
          </>
        ) : (
          <span className="text-slate-400">Sin categoría</span>
        )}
        <ChevronDown size={10} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-48 bg-slate-700 rounded-lg shadow-xl border border-slate-600 py-1 max-h-56 overflow-y-auto">
          {grouped.map(group => (
            <div key={group.type}>
              <div className="px-3 pt-2 pb-1 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                {group.label}
              </div>
              {group.items.map(cat => (
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
          ))}
        </div>
      )}
    </div>
  )
}

export default function Transfers() {
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight') ? Number(searchParams.get('highlight')) : null

  const [selected, setSelected] = useState<Set<number>>(new Set())

  const qc = useQueryClient()
  const { data: transfers = [], isLoading } = useQuery({ queryKey: ['transfers'], queryFn: fetchTransfers })
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts })

  const highlightRef = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [transfers, highlightId])

  // Clear selection when transfers change
  useEffect(() => { setSelected(new Set()) }, [transfers])

  const accountName = (id: number) => accounts.find(a => a.id === id)?.name ?? `#${id}`

  const allIds = transfers.map(t => t.id)
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))
  const someSelected = selected.size > 0

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allIds))
    }
  }

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTransfer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })

  const detectMutation = useMutation({
    mutationFn: detectTransfers,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['transfers'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      if (data.created === 0) {
        alert('No se han detectado nuevas transferencias internas.')
      } else {
        alert(`${data.created} nueva${data.created !== 1 ? 's' : ''} transferencia${data.created !== 1 ? 's' : ''} detectada${data.created !== 1 ? 's' : ''}.`)
      }
    },
  })

  const validateMutation = useMutation({
    mutationFn: ({ ids, validated }: { ids: number[]; validated: boolean }) =>
      validateTransfers(ids, validated),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] })
      setSelected(new Set())
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Transferencias internas</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Movimientos entre tus propias cuentas. No se incluyen en cálculos de ingresos ni gastos.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PrivacyToggle />
          <button
            onClick={() => detectMutation.mutate()}
            disabled={detectMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors shrink-0"
          >
            <Search size={15} />
            {detectMutation.isPending ? 'Detectando...' : 'Detectar ahora'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm">Cargando...</div>
      ) : transfers.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-12 flex flex-col items-center gap-3 text-center">
          <ArrowLeftRight size={32} className="text-slate-600" />
          <p className="text-slate-400 text-sm">No hay transferencias internas detectadas.</p>
          <p className="text-xs text-slate-500">Se detectan al importar, o usa el botón "Detectar ahora".</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          {/* Bulk action bar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-700 min-h-[44px]">
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
              onChange={toggleAll}
              className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
            />
            {someSelected ? (
              <>
                <span className="text-xs text-slate-400">{selected.size} seleccionada{selected.size !== 1 ? 's' : ''}</span>
                <button
                  onClick={() => validateMutation.mutate({ ids: [...selected], validated: true })}
                  disabled={validateMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  <Check size={12} />
                  Validar selección
                </button>
                <button
                  onClick={() => validateMutation.mutate({ ids: [...selected], validated: false })}
                  disabled={validateMutation.isPending}
                  className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-slate-300 rounded-lg transition-colors"
                >
                  Desvalidar
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-500">{transfers.length} transferencia{transfers.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="w-8 px-4 py-3" />
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">Fecha</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">TX</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">RX</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">Importe</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {transfers.map(t => {
                const isHighlighted = t.id === highlightId
                const isChecked = selected.has(t.id)
                return (
                  <tr
                    key={t.id}
                    ref={isHighlighted ? highlightRef : undefined}
                    className={clsx(
                      'border-b border-slate-700/50 transition-colors',
                      isHighlighted
                        ? 'bg-sky-500/10 ring-1 ring-inset ring-sky-500/40'
                        : isChecked
                        ? 'bg-slate-700/40'
                        : 'hover:bg-slate-700/30'
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(t.id)}
                        className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{fmtDate(t.tx_out.date)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="text-slate-300">{accountName(t.tx_out.account_id)}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px]" title={t.tx_out.description}>{t.tx_out.description}</div>
                      <TxCategoryDropdown
                        txId={t.tx_out_id}
                        current={t.tx_out.category_assignment?.category ?? null}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="text-slate-300">{accountName(t.tx_in.account_id)}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px]" title={t.tx_in.description}>{t.tx_in.description}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono font-medium text-slate-200">
                      <Sensitive>{fmt(t.tx_in.amount)}</Sensitive>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={clsx(
                          'text-xs px-2 py-0.5 rounded-full',
                          t.is_manual ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-600 text-slate-400'
                        )}>
                          {t.is_manual ? 'Manual' : 'Auto'}
                        </span>
                        {t.is_validated && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 flex items-center gap-1">
                            <Check size={10} />
                            Validada
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => validateMutation.mutate({ ids: [t.id], validated: !t.is_validated })}
                          disabled={validateMutation.isPending}
                          title={t.is_validated ? 'Quitar validación' : 'Validar'}
                          className={clsx(
                            'p-1.5 rounded-lg transition-colors',
                            t.is_validated
                              ? 'text-green-400 hover:text-slate-400 hover:bg-slate-700'
                              : 'text-slate-500 hover:text-green-400 hover:bg-slate-700'
                          )}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(t.id)}
                          disabled={deleteMutation.isPending}
                          title="Desmarcar como transferencia interna"
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-700 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
