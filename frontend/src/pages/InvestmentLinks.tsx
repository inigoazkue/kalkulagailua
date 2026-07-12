import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchInvestmentLinks, detectInvestmentLinks,
  validateInvestmentLinks, rejectInvestmentLinks, resetInvestmentLinks,
  deleteInvestmentLink, createInvestmentLink,
  fetchAssets, fetchAccounts,
  InvestmentAsset, InvestmentLinkRow,
} from '../api/client'
import { Search, Check, X, Trash2, ClipboardList } from 'lucide-react'
import { clsx } from 'clsx'
import PrivacyToggle from '../components/PrivacyToggle'
import { Sensitive } from '../components/Sensitive'
import { fmtDateEs } from '../utils/format'

const fmt = (val: string) =>
  Number(val).toLocaleString('es', { style: 'currency', currency: 'EUR' })

type FilterStatus = 'sin_asignar' | 'pendientes' | 'validadas' | 'no_validadas' | 'todas'

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'sin_asignar', label: 'Sin asignar' },
  { value: 'pendientes', label: 'Pendientes' },
  { value: 'validadas', label: 'Validadas' },
  { value: 'no_validadas', label: 'No validadas' },
  { value: 'todas', label: 'Todas' },
]

function applyFilter(rows: InvestmentLinkRow[], filter: FilterStatus): InvestmentLinkRow[] {
  if (filter === 'sin_asignar') return rows.filter(r => r.link === null)
  if (filter === 'pendientes') return rows.filter(r => r.link !== null && !r.link.is_validated && !r.link.is_rejected)
  if (filter === 'validadas') return rows.filter(r => r.link !== null && r.link.is_validated)
  if (filter === 'no_validadas') return rows.filter(r => r.link !== null && r.link.is_rejected)
  return rows
}

function AssetDropdown({ transactionId, assets, onLinked }: {
  transactionId: number
  assets: InvestmentAsset[]
  onLinked: () => void
}) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (assetId: number) => createInvestmentLink(transactionId, assetId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investment-links'] }); onLinked() },
  })
  return (
    <select
      className="text-xs bg-slate-700 text-slate-300 rounded px-2 py-1 border border-slate-600 max-w-[200px]"
      defaultValue=""
      onChange={e => { if (e.target.value) mutation.mutate(Number(e.target.value)) }}
      disabled={mutation.isPending}
    >
      <option value="" disabled>Asignar activo…</option>
      {assets.map(a => (
        <option key={a.id} value={a.id}>{a.ticker} — {a.name}</option>
      ))}
    </select>
  )
}

export default function InvestmentLinks() {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('sin_asignar')

  const qc = useQueryClient()
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['investment-links'], queryFn: fetchInvestmentLinks })
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: fetchAssets })
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts })

  const accountName = (id: number) => accounts.find(a => a.id === id)?.name ?? `#${id}`

  const filteredRows = applyFilter(rows, filterStatus)

  // Only rows with a link can be bulk-selected (they have a link ID)
  const selectableIds = filteredRows.filter(r => r.link !== null).map(r => r.link!.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id))
  const someSelected = selected.size > 0

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectableIds))
    }
  }

  function toggleOne(linkId: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(linkId)) next.delete(linkId)
      else next.add(linkId)
      return next
    })
  }

  const detectMutation = useMutation({
    mutationFn: detectInvestmentLinks,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['investment-links'] })
      if (data.created === 0) {
        alert('No se han detectado nuevos vínculos de inversión.')
      } else {
        alert(`${data.created} vínculo${data.created !== 1 ? 's' : ''} detectado${data.created !== 1 ? 's' : ''}.`)
      }
    },
  })

  const validateMutation = useMutation({
    mutationFn: (ids: number[]) => validateInvestmentLinks(ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investment-links'] }); setSelected(new Set()) },
  })

  const rejectMutation = useMutation({
    mutationFn: (ids: number[]) => rejectInvestmentLinks(ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investment-links'] }); setSelected(new Set()) },
  })

  const resetMutation = useMutation({
    mutationFn: (ids: number[]) => resetInvestmentLinks(ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investment-links'] }); setSelected(new Set()) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteInvestmentLink(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investment-links'] }) },
  })

  const isBusy = validateMutation.isPending || rejectMutation.isPending || resetMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Inversiones pendientes</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Vincula tus transacciones de inversión a activos concretos.
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

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1 self-start w-fit">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => { setFilterStatus(opt.value); setSelected(new Set()) }}
            className={clsx(
              'px-3 py-1.5 text-xs rounded-md transition-colors',
              filterStatus === opt.value
                ? 'bg-slate-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm">Cargando...</div>
      ) : rows.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-12 flex flex-col items-center gap-3 text-center">
          <ClipboardList size={32} className="text-slate-600" />
          <p className="text-slate-400 text-sm">No hay transacciones de inversión.</p>
          <p className="text-xs text-slate-500">Importa transacciones o usa el botón "Detectar ahora".</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-12 flex flex-col items-center gap-3 text-center">
          <ClipboardList size={32} className="text-slate-600" />
          <p className="text-slate-400 text-sm">No hay transacciones en este filtro.</p>
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
              disabled={selectableIds.length === 0}
            />
            {someSelected ? (
              <>
                <span className="text-xs text-slate-400">{selected.size} seleccionada{selected.size !== 1 ? 's' : ''} de {selectableIds.length}</span>
                <button
                  onClick={() => validateMutation.mutate([...selected])}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  <Check size={12} />
                  Validar
                </button>
                <button
                  onClick={() => rejectMutation.mutate([...selected])}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  <X size={12} />
                  No validar
                </button>
                <button
                  onClick={() => resetMutation.mutate([...selected])}
                  disabled={isBusy}
                  className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-slate-300 rounded-lg transition-colors"
                >
                  Pendiente
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-500">{filteredRows.length} transacción{filteredRows.length !== 1 ? 'es' : ''}</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="w-8 px-4 py-3" />
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">Fecha</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">Descripción</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">Importe</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">Activo</th>
                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => {
                  const { transaction: tx, link } = row
                  const isChecked = link !== null && selected.has(link.id)
                  const canSelect = link !== null

                  return (
                    <tr
                      key={tx.id}
                      className={clsx(
                        'border-b border-slate-700/50 transition-colors',
                        isChecked
                          ? 'bg-slate-700/40'
                          : 'hover:bg-slate-700/30'
                      )}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => canSelect && toggleOne(link!.id)}
                          disabled={!canSelect}
                          className="w-4 h-4 rounded accent-blue-500 cursor-pointer disabled:opacity-30"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                        {fmtDateEs(tx.date)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="text-slate-300 truncate max-w-[220px]" title={tx.description}>
                          {tx.description}
                        </div>
                        <div className="text-xs text-slate-500">{accountName(tx.account_id)}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-medium text-slate-200 whitespace-nowrap">
                        <Sensitive>{fmt(tx.amount)}</Sensitive>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {link ? (
                          <div>
                            <div className="text-slate-200 font-medium">{link.asset.name}</div>
                            <div className="text-xs text-slate-500">{link.asset.ticker}</div>
                          </div>
                        ) : (
                          <AssetDropdown
                            transactionId={tx.id}
                            assets={assets}
                            onLinked={() => {}}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {link ? (
                            <>
                              <span className={clsx(
                                'text-xs px-2 py-0.5 rounded-full',
                                link.is_auto ? 'bg-slate-600 text-slate-400' : 'bg-blue-500/20 text-blue-300'
                              )}>
                                {link.is_auto ? 'Auto' : 'Manual'}
                              </span>
                              {link.is_validated && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 flex items-center gap-1">
                                  <Check size={10} />
                                  Validada
                                </span>
                              )}
                              {link.is_rejected && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 flex items-center gap-1">
                                  <X size={10} />
                                  No validada
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-slate-500">Sin asignar</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {link && (
                            <>
                              <button
                                onClick={() => link.is_validated
                                  ? resetMutation.mutate([link.id])
                                  : validateMutation.mutate([link.id])}
                                disabled={isBusy}
                                title={link.is_validated ? 'Quitar validación (volver a pendiente)' : 'Validar'}
                                className={clsx(
                                  'p-1.5 rounded-lg transition-colors',
                                  link.is_validated
                                    ? 'text-green-400 hover:text-slate-400 hover:bg-slate-700'
                                    : 'text-slate-500 hover:text-green-400 hover:bg-slate-700'
                                )}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => link.is_rejected
                                  ? resetMutation.mutate([link.id])
                                  : rejectMutation.mutate([link.id])}
                                disabled={isBusy}
                                title={link.is_rejected ? 'Quitar rechazo (volver a pendiente)' : 'No validar'}
                                className={clsx(
                                  'p-1.5 rounded-lg transition-colors',
                                  link.is_rejected
                                    ? 'text-red-400 hover:text-slate-400 hover:bg-slate-700'
                                    : 'text-slate-500 hover:text-red-400 hover:bg-slate-700'
                                )}
                              >
                                <X size={14} />
                              </button>
                              <button
                                onClick={() => deleteMutation.mutate(link.id)}
                                disabled={deleteMutation.isPending}
                                title="Eliminar vínculo"
                                className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-red-400 hover:bg-slate-700"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
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
