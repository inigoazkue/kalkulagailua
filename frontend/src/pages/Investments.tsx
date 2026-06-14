import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPositions, createAsset, InvestmentPosition } from '../api/client'
import { Plus, X, TrendingUp, TrendingDown } from 'lucide-react'
import { clsx } from 'clsx'

const fmt = (val: string | number, decimals = 2) =>
  Number(val).toLocaleString('es', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

const fmtPct = (val: string | number) =>
  `${Number(val) >= 0 ? '+' : ''}${Number(val).toFixed(2)}%`

function AddAssetModal({ onClose }: { onClose: () => void }) {
  const [ticker, setTicker] = useState('')
  const [assetType, setAssetType] = useState<string>('etf')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => createAsset({ ticker, asset_type: assetType }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['positions'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-96 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Añadir activo</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Ticker / Símbolo</label>
            <input
              type="text"
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              placeholder="Ej: VWCE, BTC, AAPL"
              className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tipo</label>
            <select
              value={assetType}
              onChange={e => setAssetType(e.target.value)}
              className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="etf">ETF</option>
              <option value="stock">Acción</option>
              <option value="fund">Fondo</option>
              <option value="crypto">Crypto</option>
            </select>
          </div>
        </div>

        {mutation.isError && (
          <p className="text-red-400 text-xs">
            {mutation.error instanceof Error ? mutation.error.message : 'Error al añadir activo'}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!ticker || mutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {mutation.isPending ? 'Buscando...' : 'Añadir'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AssetTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    etf: 'bg-blue-500/20 text-blue-300',
    stock: 'bg-green-500/20 text-green-300',
    fund: 'bg-purple-500/20 text-purple-300',
    crypto: 'bg-orange-500/20 text-orange-300',
  }
  return (
    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', colors[type] ?? 'bg-slate-600 text-slate-300')}>
      {type.toUpperCase()}
    </span>
  )
}

function PositionRow({ pos }: { pos: InvestmentPosition }) {
  const pnl = Number(pos.pnl)
  const pnlPct = Number(pos.pnl_pct)
  const isPositive = pnl >= 0

  return (
    <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
      <td className="px-4 py-4">
        <div className="flex flex-col">
          <span className="font-medium text-white text-sm">{pos.asset.ticker}</span>
          <span className="text-xs text-slate-400 max-w-xs truncate">{pos.asset.name}</span>
        </div>
      </td>
      <td className="px-4 py-4">
        <AssetTypeBadge type={pos.asset.asset_type} />
      </td>
      <td className="px-4 py-4 text-sm font-mono text-slate-200">{fmt(pos.cost_basis)}</td>
      <td className="px-4 py-4 text-sm font-mono text-slate-200">{fmt(pos.current_price, 4)}</td>
      <td className="px-4 py-4 text-sm font-mono text-white font-medium">{fmt(pos.current_value)}</td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-1">
          {isPositive ? (
            <TrendingUp size={14} className="text-green-400" />
          ) : (
            <TrendingDown size={14} className="text-red-400" />
          )}
          <span className={clsx('text-sm font-mono font-medium', isPositive ? 'text-green-400' : 'text-red-400')}>
            {fmt(pos.pnl)}
          </span>
        </div>
      </td>
      <td className="px-4 py-4">
        <span className={clsx('text-sm font-mono font-medium', isPositive ? 'text-green-400' : 'text-red-400')}>
          {fmtPct(pnlPct)}
        </span>
      </td>
    </tr>
  )
}

export default function Investments() {
  const [showModal, setShowModal] = useState(false)

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['positions'],
    queryFn: fetchPositions,
  })

  const totalCostBasis = positions.reduce((s, p) => s + Number(p.cost_basis), 0)
  const totalCurrentValue = positions.reduce((s, p) => s + Number(p.current_value), 0)
  const totalPnl = totalCurrentValue - totalCostBasis
  const totalPnlPct = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Inversiones</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
        >
          <Plus size={16} />
          Añadir activo
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Capital invertido</p>
          <p className="text-lg font-bold text-white">{fmt(totalCostBasis)}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Valor actual</p>
          <p className="text-lg font-bold text-white">{fmt(totalCurrentValue)}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">P&L Total</p>
          <p className={clsx('text-lg font-bold', totalPnl >= 0 ? 'text-green-400' : 'text-red-400')}>
            {fmt(totalPnl)}
          </p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Rentabilidad</p>
          <p className={clsx('text-lg font-bold', totalPnlPct >= 0 ? 'text-green-400' : 'text-red-400')}>
            {fmtPct(totalPnlPct)}
          </p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">Cargando posiciones...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Activo', 'Tipo', 'Coste', 'Precio actual', 'Valor', 'P&L', 'Rentabilidad'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map(pos => (
                  <PositionRow key={pos.asset.id} pos={pos} />
                ))}
                {positions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">
                      No hay posiciones. Añade un activo para empezar.
                    </td>
                  </tr>
                )}
              </tbody>
              {positions.length > 1 && (
                <tfoot>
                  <tr className="border-t border-slate-600 bg-slate-750">
                    <td colSpan={2} className="px-4 py-3 text-sm font-medium text-slate-300">Total</td>
                    <td className="px-4 py-3 text-sm font-mono font-bold text-white">{fmt(totalCostBasis)}</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-sm font-mono font-bold text-white">{fmt(totalCurrentValue)}</td>
                    <td className="px-4 py-3 text-sm font-mono font-bold">
                      <span className={clsx(totalPnl >= 0 ? 'text-green-400' : 'text-red-400')}>
                        {fmt(totalPnl)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono font-bold">
                      <span className={clsx(totalPnlPct >= 0 ? 'text-green-400' : 'text-red-400')}>
                        {fmtPct(totalPnlPct)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {showModal && <AddAssetModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
