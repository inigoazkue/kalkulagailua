import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchPositions, fetchPortfolioHistory, fetchFundTransfers, fetchAssets,
  createAssetByIsin, lookupIsin, updateAsset, syncAssetPrices,
  createFundTransfer, updateFundTransfer, deleteFundTransfer,
  AssetPosition, InvestmentAsset, FundTransfer, IsinLookupResult,
} from '../api/client'
import { Plus, X, TrendingUp, TrendingDown, RefreshCw, Pencil, Trash2, ArrowRightLeft, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import PrivacyToggle from '../components/PrivacyToggle'
import { Sensitive, SensitiveBlock } from '../components/Sensitive'
import { fmtDateEs } from '../utils/format'

const fmt = (val: string | number, decimals = 2) =>
  Number(val).toLocaleString('es', { style: 'currency', currency: 'EUR', minimumFractionDigits: decimals, maximumFractionDigits: decimals })

const fmtPct = (val: string | number) =>
  `${Number(val) >= 0 ? '+' : ''}${Number(val).toFixed(2)}%`

const fmtPrice = (val: string | number) => {
  const n = Number(val)
  return n >= 100
    ? n.toLocaleString('es', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n.toLocaleString('es', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

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

// ─── Add Asset Modal ──────────────────────────────────────────────────────────

function AddAssetModal({ onClose }: { onClose: () => void }) {
  const [isin, setIsin] = useState('')
  const [alias, setAlias] = useState('')
  const [lookupResult, setLookupResult] = useState<IsinLookupResult | null>(null)
  const [looked, setLooked] = useState(false)
  const qc = useQueryClient()

  const lookupMutation = useMutation({
    mutationFn: () => lookupIsin(isin.trim().toUpperCase()),
    onSuccess: (res) => { setLookupResult(res); setLooked(true) },
  })

  const createMutation = useMutation({
    mutationFn: () => createAssetByIsin(isin.trim().toUpperCase(), alias.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions'] })
      qc.invalidateQueries({ queryKey: ['assets'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-[440px] space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Añadir activo por ISIN</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex gap-2">
          <input
            type="text" value={isin}
            onChange={e => { setIsin(e.target.value.toUpperCase()); setLooked(false); setLookupResult(null) }}
            placeholder="Ej: IE00B4L5Y983" maxLength={12}
            className="flex-1 bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          />
          <button
            onClick={() => lookupMutation.mutate()}
            disabled={isin.trim().length < 12 || lookupMutation.isPending}
            className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-lg border border-slate-600"
          >
            {lookupMutation.isPending ? '...' : 'Buscar'}
          </button>
        </div>
        {lookupResult && (
          <div className={clsx('rounded-lg p-3 text-sm', lookupResult.found ? 'bg-green-900/20 border border-green-700/40' : 'bg-amber-900/20 border border-amber-700/40')}>
            {lookupResult.found ? (
              <>
                <p className="text-green-300 font-medium">{lookupResult.name}</p>
                <div className="flex gap-3 text-xs text-slate-400 mt-1">
                  {lookupResult.ticker && <span>Ticker: <span className="text-slate-200 font-mono">{lookupResult.ticker}</span></span>}
                  <span>Tipo: <span className="text-slate-200">{ASSET_TYPE_CONFIG[lookupResult.asset_type]?.label ?? lookupResult.asset_type}</span></span>
                </div>
              </>
            ) : (
              <p className="text-amber-300">ISIN no encontrado. Se guardará solo con el ISIN como nombre.</p>
            )}
          </div>
        )}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Alias (opcional)</label>
          <input type="text" value={alias} onChange={e => setAlias(e.target.value)} placeholder="Ej: MSCI World"
            className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        {createMutation.isError && <p className="text-red-400 text-xs">Error al añadir activo</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancelar</button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!looked || isin.trim().length < 12 || createMutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg"
          >
            {createMutation.isPending ? 'Añadiendo...' : 'Añadir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Asset Modal ─────────────────────────────────────────────────────────

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
      qc.invalidateQueries({ queryKey: ['positions'] })
      qc.invalidateQueries({ queryKey: ['assets'] })
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
          {([
            ['Nombre', name, setName],
            ['Ticker', ticker, setTicker],
            ['ISIN', isin, setIsin],
            ['Alias', alias, setAlias],
          ] as [string, string, (v: string) => void][]).map(([label, value, set]) => (
            <div key={label}>
              <label className="block text-xs text-slate-400 mb-1">{label}</label>
              <input type="text" value={value} onChange={e => set(e.target.value)}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg border border-slate-600"
          >
            <RefreshCw size={12} className={syncMutation.isPending ? 'animate-spin' : ''} />
            {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar precios'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancelar</button>
            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg"
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Asset Card ───────────────────────────────────────────────────────────────

function AssetCard({ pos, onEdit }: { pos: AssetPosition; onEdit: () => void }) {
  const qc = useQueryClient()
  const pnl = pos.pnl !== null ? Number(pos.pnl) : null
  const pnlPct = pos.pnl_pct !== null ? Number(pos.pnl_pct) : null
  const isPositive = pnl !== null ? pnl >= 0 : null
  const label = pos.asset.alias ?? pos.asset.ticker ?? pos.asset.name
  const sparklineColor = isPositive === null ? '#64748b' : isPositive ? '#22c55e' : '#ef4444'

  const syncMutation = useMutation({
    mutationFn: () => syncAssetPrices(pos.asset.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['positions'] }),
  })

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <AssetTypeBadge type={pos.asset.asset_type} />
          </div>
          <h3 className="font-semibold text-white text-sm leading-tight truncate" title={pos.asset.name}>
            {label}
          </h3>
          {pos.asset.alias && (
            <p className="text-xs text-slate-500 truncate mt-0.5">{pos.asset.name}</p>
          )}
          <p className="text-xs text-slate-600 font-mono mt-0.5">
            {pos.asset.isin ?? pos.asset.ticker ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            title="Sincronizar precios"
            className="p-1.5 text-slate-500 hover:text-blue-400 transition-colors"
          >
            <RefreshCw size={13} className={syncMutation.isPending ? 'animate-spin' : ''} />
          </button>
          <button onClick={onEdit} title="Editar" className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors">
            <Pencil size={13} />
          </button>
        </div>
      </div>

      {/* Sparkline */}
      <div className="px-2 h-[80px]">
        {pos.sparkline.length > 1 ? (
          <SensitiveBlock>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={pos.sparkline.map(p => ({ date: p.date, price: Number(p.price) }))} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${pos.asset.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={sparklineColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={sparklineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <Tooltip
                  formatter={(v: number) => [fmtPrice(v), 'Precio']}
                  labelFormatter={l => fmtDateEs(l as string)}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: 11 }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={sparklineColor}
                  strokeWidth={1.5}
                  fill={`url(#grad-${pos.asset.id})`}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </SensitiveBlock>
        ) : (
          <div className="h-full flex items-center justify-center gap-2 text-slate-600">
            <AlertCircle size={14} />
            <span className="text-xs">Sin datos de precio</span>
          </div>
        )}
      </div>

      {/* Current price */}
      {pos.current_price !== null && (
        <div className="px-4 py-2 flex items-baseline gap-2">
          <Sensitive>
            <span className="text-lg font-bold text-white">{fmtPrice(pos.current_price)}</span>
          </Sensitive>
          {pnlPct !== null && (
            <span className={clsx('text-xs font-mono', isPositive ? 'text-green-400' : 'text-red-400')}>
              {fmtPct(pnlPct)}
            </span>
          )}
          {pos.current_price_date && (
            <span className="text-xs text-slate-600 ml-auto">{fmtDateEs(pos.current_price_date)}</span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="px-4 pb-4 mt-auto space-y-1.5 border-t border-slate-700/50 pt-3">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Invertido</span>
          <Sensitive><span className="text-slate-200 font-mono">{fmt(pos.net_invested)}</span></Sensitive>
        </div>
        {pos.current_value !== null ? (
          <>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Valor actual</span>
              <Sensitive><span className="text-white font-mono font-medium">{fmt(pos.current_value)}</span></Sensitive>
            </div>
            {pnl !== null && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">P&amp;L</span>
                <div className="flex items-center gap-1.5">
                  {isPositive ? <TrendingUp size={12} className="text-green-400" /> : <TrendingDown size={12} className="text-red-400" />}
                  <Sensitive>
                    <span className={clsx('font-mono font-medium', isPositive ? 'text-green-400' : 'text-red-400')}>
                      {fmt(pnl)}
                    </span>
                  </Sensitive>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-600 italic">Valor no calculable (sin precios)</p>
        )}
      </div>
    </div>
  )
}

// ─── Portfolio Chart ──────────────────────────────────────────────────────────

const PERIODS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1A', days: 365 },
  { label: 'Máx', days: 0 },
]

function PortfolioChart() {
  const [period, setPeriod] = useState(3)

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
        <div className="flex items-center justify-center h-[180px] text-slate-500 text-sm">
          Sin datos (valida transacciones en "Inv. pendientes")
        </div>
      ) : (
        <SensitiveBlock>
          <ResponsiveContainer width="100%" height={180}>
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
                width={36}
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

// ─── Fund Transfer Modal ──────────────────────────────────────────────────────

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fund-transfers'] })
      qc.invalidateQueries({ queryKey: ['positions'] })
      onClose()
    },
  })

  const assetLabel = (a: InvestmentAsset) => a.alias ?? a.ticker ?? a.name

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-[520px] space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">{transfer ? 'Editar traspaso' : 'Nuevo traspaso'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {([
            ['Desde', fromId, setFromId],
            ['Hasta', toId, setToId],
          ] as [string, number, (v: number) => void][]).map(([label, value, set]) => (
            <div key={label}>
              <label className="block text-xs text-slate-400 mb-1">{label}</label>
              <select
                value={value}
                onChange={e => set(Number(e.target.value))}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {assets.map(a => <option key={a.id} value={a.id}>{assetLabel(a)}</option>)}
              </select>
            </div>
          ))}
        </div>

        {[
          { label: 'Salida', dateVal: withdrawalDate, setDate: setWithdrawalDate, amountVal: withdrawalAmount, setAmount: setWithdrawalAmount, feeVal: exitFee, setFee: setExitFee },
          { label: 'Llegada', dateVal: arrivalDate, setDate: setArrivalDate, amountVal: arrivalAmount, setAmount: setArrivalAmount, feeVal: entryFee, setFee: setEntryFee },
        ].map(({ label, dateVal, setDate, amountVal, setAmount, feeVal, setFee }) => (
          <div key={label} className="bg-slate-700/40 rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fecha</label>
                <input type="date" value={dateVal} onChange={e => setDate(e.target.value)}
                  className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Importe (€)</label>
                <input type="number" step="0.01" value={amountVal} onChange={e => setAmount(e.target.value)}
                  className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Comisión (€)</label>
                <input type="number" step="0.01" value={feeVal} onChange={e => setFee(e.target.value)}
                  className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        ))}

        <div>
          <label className="block text-xs text-slate-400 mb-1">Notas</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !withdrawalAmount || !arrivalAmount}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg"
          >
            {mutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Fund Transfers Section ───────────────────────────────────────────────────

function FundTransfersSection({ assets }: { assets: InvestmentAsset[] }) {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<FundTransfer | undefined>()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data: transfers = [] } = useQuery({ queryKey: ['fund-transfers'], queryFn: fetchFundTransfers })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteFundTransfer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fund-transfers'] })
      qc.invalidateQueries({ queryKey: ['positions'] })
      setDeletingId(null)
    },
  })

  const assetLabel = (a: { id: number; ticker: string | null; name: string; isin: string | null; alias: string | null }) =>
    a.alias ?? a.ticker ?? a.name

  if (transfers.length === 0 && assets.length < 2) return null

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <ArrowRightLeft size={16} className="text-slate-400" />
          <h3 className="text-sm font-medium text-slate-300">Traspasos entre fondos</h3>
        </div>
        {assets.length >= 2 && (
          <button
            onClick={() => { setEditing(undefined); setShowModal(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg border border-slate-600"
          >
            <Plus size={13} />
            Nuevo traspaso
          </button>
        )}
      </div>

      {transfers.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-sm">Sin traspasos registrados</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                {['Desde', 'Hasta', 'F. salida', 'Salida', 'Com.', 'F. llegada', 'Llegada', 'Com.', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transfers.map(t => (
                <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                  <td className="px-4 py-3 text-sm text-slate-300">{assetLabel(t.from_asset)}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{assetLabel(t.to_asset)}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{fmtDateEs(t.withdrawal_date)}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-300"><Sensitive>{fmt(t.withdrawal_amount)}</Sensitive></td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-500"><Sensitive>{fmt(t.exit_fee)}</Sensitive></td>
                  <td className="px-4 py-3 text-sm text-slate-400">{fmtDateEs(t.arrival_date)}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-300"><Sensitive>{fmt(t.arrival_amount)}</Sensitive></td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-500"><Sensitive>{fmt(t.entry_fee)}</Sensitive></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(t); setShowModal(true) }} className="p-1.5 text-slate-400 hover:text-slate-200">
                        <Pencil size={14} />
                      </button>
                      {deletingId === t.id ? (
                        <>
                          <button
                            onClick={() => deleteMutation.mutate(t.id)}
                            disabled={deleteMutation.isPending}
                            className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded"
                          >
                            {deleteMutation.isPending ? '...' : 'Confirmar'}
                          </button>
                          <button onClick={() => setDeletingId(null)} className="text-xs px-2 py-1 text-slate-400 hover:text-slate-200">Cancelar</button>
                        </>
                      ) : (
                        <button onClick={() => setDeletingId(t.id)} className="p-1.5 text-slate-400 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Investments() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAsset, setEditingAsset] = useState<InvestmentAsset | null>(null)

  const { data: positions = [], isLoading } = useQuery({ queryKey: ['positions'], queryFn: fetchPositions })
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: fetchAssets })

  const totalInvested = positions.reduce((s, p) => s + Number(p.net_invested), 0)
  const totalValue = positions.reduce((s, p) => s + (p.current_value !== null ? Number(p.current_value) : Number(p.net_invested)), 0)
  const totalPnl = positions.reduce((s, p) => s + (p.pnl !== null ? Number(p.pnl) : 0), 0)
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
  const isGlobalPositive = totalPnl >= 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Inversiones</h2>
        <div className="flex items-center gap-2">
          <PrivacyToggle />
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg"
          >
            <Plus size={16} />
            Añadir activo
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Capital invertido</p>
          <p className="text-xl font-bold text-white"><Sensitive>{fmt(totalInvested)}</Sensitive></p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Valor actual</p>
          <p className="text-xl font-bold text-white"><Sensitive>{fmt(totalValue)}</Sensitive></p>
        </div>
        <div className={clsx('rounded-xl p-4', isGlobalPositive ? 'bg-green-900/30' : 'bg-red-900/30')}>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">P&amp;L Total</p>
          <p className={clsx('text-xl font-bold', isGlobalPositive ? 'text-green-400' : 'text-red-400')}>
            <Sensitive>{fmt(totalPnl)}</Sensitive>
          </p>
        </div>
        <div className={clsx('rounded-xl p-4', isGlobalPositive ? 'bg-green-900/30' : 'bg-red-900/30')}>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Rentabilidad</p>
          <p className={clsx('text-xl font-bold', isGlobalPositive ? 'text-green-400' : 'text-red-400')}>
            <Sensitive>{fmtPct(totalPnlPct)}</Sensitive>
          </p>
        </div>
      </div>

      {/* Portfolio evolution chart */}
      <PortfolioChart />

      {/* Asset grid */}
      {isLoading ? (
        <div className="text-slate-400 text-sm">Cargando posiciones...</div>
      ) : positions.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-12 flex flex-col items-center gap-3 text-center">
          <TrendingUp size={32} className="text-slate-600" />
          <p className="text-slate-400 text-sm">No hay activos. Añade uno con su ISIN para empezar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {positions.map(pos => (
            <AssetCard key={pos.asset.id} pos={pos} onEdit={() => setEditingAsset(pos.asset)} />
          ))}
        </div>
      )}

      {/* Fund transfers */}
      <FundTransfersSection assets={assets} />

      {showAddModal && <AddAssetModal onClose={() => setShowAddModal(false)} />}
      {editingAsset && <EditAssetModal asset={editingAsset} onClose={() => setEditingAsset(null)} />}
    </div>
  )
}
