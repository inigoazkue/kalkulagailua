import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchPositions, fetchPortfolioHistory, fetchFundTransfers, fetchAssets,
  createAssetByIsin, lookupIsin, updateAsset, syncAssetPrices,
  createFundTransfer, updateFundTransfer, deleteFundTransfer,
  InvestmentPosition, InvestmentAsset, FundTransfer, IsinLookupResult,
} from '../api/client'
import { Plus, X, TrendingUp, TrendingDown, RefreshCw, Pencil, Trash2, ArrowRightLeft } from 'lucide-react'
import { clsx } from 'clsx'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import PrivacyToggle from '../components/PrivacyToggle'
import { Sensitive, SensitiveBlock } from '../components/Sensitive'
import { fmtDateEs } from '../utils/format'

const fmt = (val: string | number, decimals = 2) =>
  Number(val).toLocaleString('es', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

const fmtPct = (val: string | number) =>
  `${Number(val) >= 0 ? '+' : ''}${Number(val).toFixed(2)}%`

const ASSET_TYPE_CONFIG: Record<string, { label: string; color: string; badgeClass: string }> = {
  etf:    { label: 'ETF',    color: '#3b82f6', badgeClass: 'bg-blue-500/20 text-blue-300' },
  stock:  { label: 'Acción', color: '#22c55e', badgeClass: 'bg-green-500/20 text-green-300' },
  fund:   { label: 'Fondo',  color: '#a855f7', badgeClass: 'bg-purple-500/20 text-purple-300' },
  crypto: { label: 'Crypto', color: '#f97316', badgeClass: 'bg-orange-500/20 text-orange-300' },
}

function AssetTypeBadge({ type }: { type: string }) {
  const cfg = ASSET_TYPE_CONFIG[type]
  return (
    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', cfg?.badgeClass ?? 'bg-slate-600 text-slate-300')}>
      {cfg?.label ?? type.toUpperCase()}
    </span>
  )
}

// ─── Add Asset Modal (ISIN flow) ────────────────────────────────────────────

function AddAssetModal({ onClose }: { onClose: () => void }) {
  const [isin, setIsin] = useState('')
  const [alias, setAlias] = useState('')
  const [lookupResult, setLookupResult] = useState<IsinLookupResult | null>(null)
  const [manualName, setManualName] = useState('')
  const [manualType, setManualType] = useState('etf')
  const [looked, setLooked] = useState(false)
  const qc = useQueryClient()

  const lookupMutation = useMutation({
    mutationFn: () => lookupIsin(isin.trim().toUpperCase()),
    onSuccess: (res) => {
      setLookupResult(res)
      setLooked(true)
      if (!res.found) {
        setManualName('')
        setManualType('etf')
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: () => createAssetByIsin(isin.trim().toUpperCase(), alias.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['positions'] })
      onClose()
    },
  })

  const canCreate = looked && isin.trim().length >= 12

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-[440px] space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Añadir activo por ISIN</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* ISIN input + lookup */}
        <div className="flex gap-2">
          <input
            type="text"
            value={isin}
            onChange={e => { setIsin(e.target.value.toUpperCase()); setLooked(false); setLookupResult(null) }}
            placeholder="Ej: IE00B4L5Y983"
            maxLength={12}
            className="flex-1 bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          />
          <button
            onClick={() => lookupMutation.mutate()}
            disabled={isin.trim().length < 12 || lookupMutation.isPending}
            className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-lg transition-colors border border-slate-600"
          >
            {lookupMutation.isPending ? '...' : 'Buscar'}
          </button>
        </div>

        {/* Lookup result */}
        {lookupResult && (
          <div className={clsx('rounded-lg p-3 text-sm space-y-1', lookupResult.found ? 'bg-green-900/20 border border-green-700/40' : 'bg-amber-900/20 border border-amber-700/40')}>
            {lookupResult.found ? (
              <>
                <p className="text-green-300 font-medium">{lookupResult.name}</p>
                <div className="flex gap-3 text-xs text-slate-400">
                  {lookupResult.ticker && <span>Ticker: <span className="text-slate-200 font-mono">{lookupResult.ticker}</span></span>}
                  <span>Tipo: <span className="text-slate-200">{ASSET_TYPE_CONFIG[lookupResult.asset_type]?.label ?? lookupResult.asset_type}</span></span>
                </div>
              </>
            ) : (
              <>
                <p className="text-amber-300">ISIN no encontrado automáticamente.</p>
                <div className="space-y-2 mt-2">
                  <input
                    type="text"
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    placeholder="Nombre del activo"
                    className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <select
                    value={manualType}
                    onChange={e => setManualType(e.target.value)}
                    className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="etf">ETF</option>
                    <option value="stock">Acción</option>
                    <option value="fund">Fondo</option>
                    <option value="crypto">Crypto</option>
                  </select>
                </div>
              </>
            )}
          </div>
        )}

        {/* Alias */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Alias (opcional)</label>
          <input
            type="text"
            value={alias}
            onChange={e => setAlias(e.target.value)}
            placeholder="Ej: MSCI World"
            className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {createMutation.isError && (
          <p className="text-red-400 text-xs">Error al añadir activo</p>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancelar</button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!canCreate || createMutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {createMutation.isPending ? 'Añadiendo...' : 'Añadir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Asset Modal ────────────────────────────────────────────────────────

function EditAssetModal({ asset, onClose }: { asset: InvestmentAsset; onClose: () => void }) {
  const [name, setName] = useState(asset.name)
  const [ticker, setTicker] = useState(asset.ticker ?? '')
  const [isin, setIsin] = useState(asset.isin ?? '')
  const [alias, setAlias] = useState(asset.alias ?? '')
  const [assetType, setAssetType] = useState(asset.asset_type)
  const qc = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: () => updateAsset(asset.id, {
      name: name.trim() || undefined,
      ticker: ticker.trim() || undefined,
      isin: isin.trim() || undefined,
      alias: alias.trim() || undefined,
      asset_type: assetType,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['positions'] })
      onClose()
    },
  })

  const syncMutation = useMutation({
    mutationFn: () => syncAssetPrices(asset.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['positions'] }),
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-[440px] space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Editar activo</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Nombre', value: name, set: setName },
            { label: 'Ticker', value: ticker, set: setTicker },
            { label: 'ISIN', value: isin, set: setIsin },
            { label: 'Alias', value: alias, set: setAlias },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-xs text-slate-400 mb-1">{label}</label>
              <input
                type="text"
                value={value}
                onChange={e => set(e.target.value)}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tipo</label>
            <select
              value={assetType}
              onChange={e => setAssetType(e.target.value as InvestmentAsset['asset_type'])}
              className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="etf">ETF</option>
              <option value="stock">Acción</option>
              <option value="fund">Fondo</option>
              <option value="crypto">Crypto</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg border border-slate-600 transition-colors"
          >
            <RefreshCw size={12} className={syncMutation.isPending ? 'animate-spin' : ''} />
            {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar precios'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancelar</button>
            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Portfolio History Chart ─────────────────────────────────────────────────

const PERIODS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1A', days: 365 },
  { label: 'Máx', days: 0 },
]

function PortfolioChart() {
  const [period, setPeriod] = useState(1) // index into PERIODS

  const startDate = useMemo(() => {
    const days = PERIODS[period].days
    if (!days) return undefined
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toISOString().slice(0, 10)
  }, [period])

  const { data: history = [] } = useQuery({
    queryKey: ['portfolio-history', startDate],
    queryFn: () => fetchPortfolioHistory(startDate),
  })

  const allZero = history.every(p => Number(p.value) === 0)

  return (
    <div className="bg-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-300">Evolución de cartera</h3>
        <div className="flex gap-1">
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPeriod(i)}
              className={clsx(
                'px-2.5 py-1 text-xs rounded-lg transition-colors',
                i === period ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {allZero || history.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-slate-500 text-sm">
          Sin datos históricos para este periodo
        </div>
      ) : (
        <SensitiveBlock>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={history} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradContrib" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={v => {
                  const d = new Date(`${v}T00:00:00`)
                  return `${d.getDate()}/${d.getMonth() + 1}`
                }}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                formatter={(v: number, name: string) => [fmt(v), name === 'value' ? 'Valor' : 'Aportaciones']}
                labelFormatter={l => fmtDateEs(l as string)}
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: 12 }}
              />
              <Area type="monotone" dataKey="contributions" stroke="#22c55e" strokeWidth={1.5} fill="url(#gradContrib)" dot={false} />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#gradValue)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </SensitiveBlock>
      )}
    </div>
  )
}

// ─── Allocation Pie ──────────────────────────────────────────────────────────

function AllocationPie({ positions, totalValue }: { positions: InvestmentPosition[]; totalValue: number }) {
  const grouped: Record<string, number> = {}
  for (const p of positions) {
    const t = p.asset.asset_type
    grouped[t] = (grouped[t] ?? 0) + Number(p.current_value)
  }
  const data = Object.entries(grouped)
    .map(([type, value]) => ({ name: ASSET_TYPE_CONFIG[type]?.label ?? type, value, color: ASSET_TYPE_CONFIG[type]?.color ?? '#64748b' }))
    .sort((a, b) => b.value - a.value)

  if (data.length === 0) return null
  return (
    <div className="bg-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-slate-300 mb-4">Distribución por tipo</h3>
      <SensitiveBlock>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
              label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''} labelLine={false}>
              {data.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <Tooltip
              formatter={(v: number) => [`${fmt(v)} · ${totalValue > 0 ? ((v / totalValue) * 100).toFixed(1) : 0}%`]}
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: 12 }}
            />
            <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </SensitiveBlock>
    </div>
  )
}

// ─── Top Holdings ────────────────────────────────────────────────────────────

function TopHoldings({ positions, totalValue }: { positions: InvestmentPosition[]; totalValue: number }) {
  const sorted = [...positions].sort((a, b) => Number(b.current_value) - Number(a.current_value)).slice(0, 5)
  return (
    <div className="bg-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-slate-300 mb-4">Principales posiciones</h3>
      <div className="space-y-3">
        {sorted.map(pos => {
          const pct = totalValue > 0 ? (Number(pos.current_value) / totalValue) * 100 : 0
          const isPositive = Number(pos.pnl) >= 0
          const label = pos.asset.alias ?? pos.asset.ticker ?? pos.asset.name
          return (
            <div key={pos.asset.id} className="flex items-center gap-3">
              <div className="w-24 shrink-0 truncate text-xs font-semibold text-white">{label}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400 truncate">{pos.asset.name}</span>
                  <span className="text-xs font-mono text-slate-300 ml-2 shrink-0"><Sensitive>{fmt(pos.current_value)}</Sensitive></span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className={clsx('h-full rounded-full', isPositive ? 'bg-blue-500' : 'bg-slate-500')} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
              <div className="w-10 shrink-0 text-right text-xs text-slate-400">{pct.toFixed(1)}%</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Position Row ────────────────────────────────────────────────────────────

function PositionRow({ pos, totalValue, onEdit }: { pos: InvestmentPosition; totalValue: number; onEdit: () => void }) {
  const qc = useQueryClient()
  const pnl = Number(pos.pnl)
  const pnlPct = Number(pos.pnl_pct)
  const currentValue = Number(pos.current_value)
  const isPositive = pnl >= 0
  const weight = totalValue > 0 ? (currentValue / totalValue) * 100 : 0
  const label = pos.asset.alias ?? pos.asset.ticker ?? pos.asset.name

  const syncMutation = useMutation({
    mutationFn: () => syncAssetPrices(pos.asset.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['positions'] }),
  })

  return (
    <tr className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
      <td className="px-4 py-3.5">
        <div className="flex flex-col">
          <span className="font-semibold text-white text-sm">{label}</span>
          {pos.asset.alias && <span className="text-xs text-slate-500 truncate max-w-[160px]">{pos.asset.name}</span>}
          {pos.asset.isin && <span className="text-xs text-slate-600 font-mono">{pos.asset.isin}</span>}
        </div>
      </td>
      <td className="px-4 py-3.5"><AssetTypeBadge type={pos.asset.asset_type} /></td>
      <td className="px-4 py-3.5 text-sm font-mono text-slate-300"><Sensitive>{fmt(pos.cost_basis)}</Sensitive></td>
      <td className="px-4 py-3.5 text-sm font-mono text-slate-300"><Sensitive>{fmt(pos.current_price, 4)}</Sensitive></td>
      <td className="px-4 py-3.5 text-sm font-mono text-white font-medium"><Sensitive>{fmt(currentValue)}</Sensitive></td>
      <td className="px-4 py-3.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            {isPositive ? <TrendingUp size={13} className="text-green-400 shrink-0" /> : <TrendingDown size={13} className="text-red-400 shrink-0" />}
            <span className={clsx('text-sm font-mono font-medium', isPositive ? 'text-green-400' : 'text-red-400')}>
              <Sensitive>{fmt(pnl)}</Sensitive>
            </span>
          </div>
          <span className={clsx('text-xs font-mono ml-4', isPositive ? 'text-green-500/70' : 'text-red-500/70')}>
            <Sensitive>{fmtPct(pnlPct)}</Sensitive>
          </span>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2 min-w-[80px]">
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(weight, 100)}%` }} />
          </div>
          <span className="text-xs text-slate-400 w-9 text-right">{weight.toFixed(1)}%</span>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1">
          <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} title="Sincronizar precios"
            className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors">
            <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
          </button>
          <button onClick={onEdit} title="Editar" className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors">
            <Pencil size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Fund Transfer Modal ─────────────────────────────────────────────────────

function FundTransferModal({ transfer, assets, onClose }: {
  transfer?: FundTransfer
  assets: InvestmentAsset[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [fromId, setFromId] = useState(transfer?.from_asset.id ?? (assets[0]?.id ?? 0))
  const [toId, setToId] = useState(transfer?.to_asset.id ?? (assets[1]?.id ?? assets[0]?.id ?? 0))
  const [withdrawalDate, setWithdrawalDate] = useState(transfer?.withdrawal_date ?? new Date().toISOString().slice(0, 10))
  const [withdrawalAmount, setWithdrawalAmount] = useState(transfer?.withdrawal_amount ?? '')
  const [exitFee, setExitFee] = useState(transfer?.exit_fee ?? '0')
  const [arrivalDate, setArrivalDate] = useState(transfer?.arrival_date ?? new Date().toISOString().slice(0, 10))
  const [arrivalAmount, setArrivalAmount] = useState(transfer?.arrival_amount ?? '')
  const [entryFee, setEntryFee] = useState(transfer?.entry_fee ?? '0')
  const [notes, setNotes] = useState(transfer?.notes ?? '')

  const payload = () => ({
    from_asset_id: fromId,
    to_asset_id: toId,
    withdrawal_date: withdrawalDate,
    withdrawal_amount: Number(withdrawalAmount),
    exit_fee: Number(exitFee),
    arrival_date: arrivalDate,
    arrival_amount: Number(arrivalAmount),
    entry_fee: Number(entryFee),
    notes: notes.trim() || undefined,
  })

  const mutation = useMutation({
    mutationFn: () => transfer ? updateFundTransfer(transfer.id, payload()) : createFundTransfer(payload()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fund-transfers'] }); onClose() },
  })

  const assetLabel = (a: InvestmentAsset) => a.alias ?? a.ticker ?? a.name

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-[520px] space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">{transfer ? 'Editar traspaso' : 'Nuevo traspaso'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* Assets */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Desde', value: fromId, set: setFromId },
            { label: 'Hasta', value: toId, set: setToId },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-xs text-slate-400 mb-1">{label}</label>
              <select value={value} onChange={e => set(Number(e.target.value))}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500">
                {assets.map(a => <option key={a.id} value={a.id}>{assetLabel(a)}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Withdrawal */}
        <div className="bg-slate-700/40 rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Salida</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fecha salida</label>
              <input type="date" value={withdrawalDate} onChange={e => setWithdrawalDate(e.target.value)}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Importe salida (€)</label>
              <input type="number" step="0.01" value={withdrawalAmount} onChange={e => setWithdrawalAmount(e.target.value)}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Comisión salida (€)</label>
              <input type="number" step="0.01" value={exitFee} onChange={e => setExitFee(e.target.value)}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Arrival */}
        <div className="bg-slate-700/40 rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Llegada</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fecha llegada</label>
              <input type="date" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Importe llegada (€)</label>
              <input type="number" step="0.01" value={arrivalAmount} onChange={e => setArrivalAmount(e.target.value)}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Comisión entrada (€)</label>
              <input type="number" step="0.01" value={entryFee} onChange={e => setEntryFee(e.target.value)}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Notas</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancelar</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !withdrawalAmount || !arrivalAmount}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors">
            {mutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Fund Transfers Section ──────────────────────────────────────────────────

function FundTransfersSection({ assets }: { assets: InvestmentAsset[] }) {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<FundTransfer | undefined>()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data: transfers = [] } = useQuery({ queryKey: ['fund-transfers'], queryFn: fetchFundTransfers })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteFundTransfer(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fund-transfers'] }); setDeletingId(null) },
  })

  const assetLabel = (a: { id: number; ticker: string | null; name: string; isin: string | null; alias: string | null }) =>
    a.alias ?? a.ticker ?? a.name

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <ArrowRightLeft size={16} className="text-slate-400" />
          <h3 className="text-sm font-medium text-slate-300">Traspasos entre fondos</h3>
        </div>
        <button onClick={() => { setEditing(undefined); setShowModal(true) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg border border-slate-600 transition-colors">
          <Plus size={13} />
          Nuevo traspaso
        </button>
      </div>

      {transfers.length === 0 ? (
        <div className="py-10 text-center text-slate-500 text-sm">Sin traspasos registrados</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                {['Desde', 'Hasta', 'Fecha salida', 'Importe salida', 'Com. salida', 'Fecha llegada', 'Importe llegada', 'Com. entrada', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transfers.map(t => (
                <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-300">{assetLabel(t.from_asset)}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{assetLabel(t.to_asset)}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{fmtDateEs(t.withdrawal_date)}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-300"><Sensitive>{fmt(t.withdrawal_amount)}</Sensitive></td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-400"><Sensitive>{fmt(t.exit_fee)}</Sensitive></td>
                  <td className="px-4 py-3 text-sm text-slate-400">{fmtDateEs(t.arrival_date)}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-300"><Sensitive>{fmt(t.arrival_amount)}</Sensitive></td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-400"><Sensitive>{fmt(t.entry_fee)}</Sensitive></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(t); setShowModal(true) }} className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"><Pencil size={14} /></button>
                      {deletingId === t.id ? (
                        <>
                          <button onClick={() => deleteMutation.mutate(t.id)} disabled={deleteMutation.isPending}
                            className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded transition-colors">
                            {deleteMutation.isPending ? '...' : 'Confirmar'}
                          </button>
                          <button onClick={() => setDeletingId(null)} className="text-xs px-2 py-1 text-slate-400 hover:text-slate-200">Cancelar</button>
                        </>
                      ) : (
                        <button onClick={() => setDeletingId(t.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <FundTransferModal
          transfer={editing}
          assets={assets}
          onClose={() => { setShowModal(false); setEditing(undefined) }}
        />
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Investments() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAsset, setEditingAsset] = useState<InvestmentAsset | null>(null)

  const { data: positions = [], isLoading } = useQuery({ queryKey: ['positions'], queryFn: fetchPositions })
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: fetchAssets })

  const totalCostBasis = positions.reduce((s, p) => s + Number(p.cost_basis), 0)
  const totalCurrentValue = positions.reduce((s, p) => s + Number(p.current_value), 0)
  const totalPnl = totalCurrentValue - totalCostBasis
  const totalPnlPct = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0
  const sortedPositions = [...positions].sort((a, b) => Number(b.current_value) - Number(a.current_value))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Inversiones</h2>
        <div className="flex items-center gap-2">
          <PrivacyToggle />
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors">
            <Plus size={16} />
            Añadir activo
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Capital invertido</p>
          <p className="text-xl font-bold text-white"><Sensitive>{fmt(totalCostBasis)}</Sensitive></p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Valor actual</p>
          <p className="text-xl font-bold text-white"><Sensitive>{fmt(totalCurrentValue)}</Sensitive></p>
        </div>
        <div className={clsx('rounded-xl p-4', totalPnl >= 0 ? 'bg-green-900/30' : 'bg-red-900/30')}>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">P&L Total</p>
          <p className={clsx('text-xl font-bold', totalPnl >= 0 ? 'text-green-400' : 'text-red-400')}>
            <Sensitive>{fmt(totalPnl)}</Sensitive>
          </p>
        </div>
        <div className={clsx('rounded-xl p-4', totalPnlPct >= 0 ? 'bg-green-900/30' : 'bg-red-900/30')}>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Rentabilidad</p>
          <p className={clsx('text-xl font-bold', totalPnlPct >= 0 ? 'text-green-400' : 'text-red-400')}>
            <Sensitive>{fmtPct(totalPnlPct)}</Sensitive>
          </p>
        </div>
      </div>

      {/* Portfolio history chart */}
      <PortfolioChart />

      {/* Distribution + top holdings */}
      {positions.length >= 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AllocationPie positions={positions} totalValue={totalCurrentValue} />
          <TopHoldings positions={positions} totalValue={totalCurrentValue} />
        </div>
      )}

      {/* Positions table */}
      <div className="bg-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">Cargando posiciones...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Activo', 'Tipo', 'Coste', 'Precio actual', 'Valor', 'P&L', 'Peso', ''].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedPositions.map(pos => (
                  <PositionRow key={pos.asset.id} pos={pos} totalValue={totalCurrentValue}
                    onEdit={() => setEditingAsset(pos.asset)} />
                ))}
                {positions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center text-slate-400 text-sm">
                      No hay posiciones. Añade un activo para empezar.
                    </td>
                  </tr>
                )}
              </tbody>
              {positions.length > 1 && (
                <tfoot>
                  <tr className="border-t border-slate-600 bg-slate-900/30">
                    <td colSpan={2} className="px-4 py-3 text-sm font-medium text-slate-300">Total</td>
                    <td className="px-4 py-3 text-sm font-mono font-bold text-white"><Sensitive>{fmt(totalCostBasis)}</Sensitive></td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-sm font-mono font-bold text-white"><Sensitive>{fmt(totalCurrentValue)}</Sensitive></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={clsx('text-sm font-mono font-bold', totalPnl >= 0 ? 'text-green-400' : 'text-red-400')}>
                          <Sensitive>{fmt(totalPnl)}</Sensitive>
                        </span>
                        <span className={clsx('text-xs font-mono', totalPnlPct >= 0 ? 'text-green-500/70' : 'text-red-500/70')}>
                          <Sensitive>{fmtPct(totalPnlPct)}</Sensitive>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 font-mono">100%</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Fund transfers */}
      <FundTransfersSection assets={assets} />

      {showAddModal && <AddAssetModal onClose={() => setShowAddModal(false)} />}
      {editingAsset && <EditAssetModal asset={editingAsset} onClose={() => setEditingAsset(null)} />}
    </div>
  )
}
