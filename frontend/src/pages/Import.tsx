import { useRef, useState, DragEvent, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAccounts, importFile, updateAccountBalance, ImportResult, Account, BankId, AccountSubtype } from '../api/client'
import { Upload, CheckCircle, XCircle, Wallet, Pencil, Save } from 'lucide-react'
import { clsx } from 'clsx'
import { Link } from 'react-router-dom'

const BANK_LABELS: Record<BankId, string> = {
  caixabank: 'CaixaBank',
  myinvestor: 'MyInvestor',
  trade_republic: 'Trade Republic',
  bit2me: 'Bit2me',
}

const BANK_ACCEPT: Record<BankId, string> = {
  caixabank: '.csv',
  myinvestor: '.csv',
  trade_republic: '.csv',
  bit2me: '.xlsx',
}

const SUBTYPE_LABELS: Record<AccountSubtype, string> = {
  daily: 'Corriente',
  savings: 'Ahorro',
}

const fmtBalance = (val: string | number | null) =>
  val == null ? null : Number(val).toLocaleString('es', { style: 'currency', currency: 'EUR' })

function BalanceSection({ account, highlightEmpty }: { account: Account; highlightEmpty?: boolean }) {
  const [editing, setEditing] = useState(highlightEmpty && account.current_balance === null)
  const [balanceVal, setBalanceVal] = useState(account.current_balance != null ? String(account.current_balance) : '')
  const [dateVal, setDateVal] = useState(account.balance_date ?? '')
  const qc = useQueryClient()

  // If parent signals we should open the form (e.g. after import without balance)
  useEffect(() => {
    if (highlightEmpty && account.current_balance === null) setEditing(true)
  }, [highlightEmpty, account.current_balance])

  const mutation = useMutation({
    mutationFn: () => updateAccountBalance(account.id, {
      balance: Number(balanceVal.replace(',', '.')),
      balance_date: dateVal,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setEditing(false)
    },
  })

  const hasBalance = account.current_balance !== null

  return (
    <div className={clsx(
      'rounded-lg px-3 py-2',
      !hasBalance && highlightEmpty
        ? 'bg-amber-500/10 border border-amber-500/30'
        : 'bg-slate-700/50'
    )}>
      {!editing ? (
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-xs text-slate-400">Saldo disponible</span>
            {hasBalance ? (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-semibold text-white">{fmtBalance(account.current_balance)}</span>
                {account.balance_date && (
                  <span className="text-xs text-slate-500">
                    {new Date(account.balance_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-xs text-amber-400 mt-0.5">Sin saldo registrado — introdúcelo para el cálculo de ahorro</div>
            )}
          </div>
          <button onClick={() => {
            setBalanceVal(account.current_balance != null ? String(account.current_balance) : '')
            setDateVal(account.balance_date ?? '')
            setEditing(true)
          }} className="p-1 text-slate-400 hover:text-white rounded transition-colors shrink-0">
            <Pencil size={13} />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <span className="text-xs text-slate-400">Saldo disponible</span>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="number"
              step="0.01"
              value={balanceVal}
              onChange={e => setBalanceVal(e.target.value)}
              placeholder="1234.56"
              className="w-32 bg-slate-600 text-white text-sm rounded px-2 py-1 border border-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="date"
              value={dateVal}
              onChange={e => setDateVal(e.target.value)}
              className="bg-slate-600 text-white text-sm rounded px-2 py-1 border border-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => mutation.mutate()}
              disabled={!balanceVal || !dateVal || mutation.isPending}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
            >
              <Save size={12} /> Guardar
            </button>
            {hasBalance && (
              <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:text-white">
                Cancelar
              </button>
            )}
          </div>
          {mutation.isError && <p className="text-xs text-red-400">Error al guardar</p>}
        </div>
      )}
    </div>
  )
}

function AccountUploadBox({ account }: { account: Account }) {
  const [uploadState, setUploadState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error'
    result?: ImportResult
    error?: string
    dragging?: boolean
  }>({ status: 'idle' })
  const [needsBalance, setNeedsBalance] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (file: File) => importFile(account.id, file),
    onSuccess: result => {
      setUploadState({ status: 'success', result })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      if (!result.balance_updated) setNeedsBalance(true)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setUploadState({ status: 'error', error: msg })
    },
  })

  const handleFile = (file: File) => {
    setNeedsBalance(false)
    setUploadState({ status: 'loading' })
    mutation.mutate(file)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setUploadState(s => ({ ...s, dragging: false }))
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const accept = BANK_ACCEPT[account.bank]

  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: account.color }} />
        <div>
          <span className="font-medium text-white text-sm">{account.name}</span>
          <span className="ml-2 text-xs text-slate-500">{SUBTYPE_LABELS[account.subtype]}</span>
        </div>
      </div>

      <BalanceSection account={account} highlightEmpty={needsBalance} />

      <div
        onDragOver={e => { e.preventDefault(); setUploadState(s => ({ ...s, dragging: true })) }}
        onDragLeave={() => setUploadState(s => ({ ...s, dragging: false }))}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'border-2 border-dashed rounded-lg p-5 flex flex-col items-center gap-2 cursor-pointer transition-colors',
          uploadState.dragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
        )}
      >
        <Upload size={20} className="text-slate-400" />
        <span className="text-xs text-slate-400">
          {uploadState.status === 'loading' ? 'Procesando...' : 'Arrastra o haz clic'}
        </span>
        <span className="text-xs text-slate-600 uppercase">{accept}</span>
      </div>

      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />

      {uploadState.status === 'success' && uploadState.result && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-xs bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
            <CheckCircle size={14} className="text-green-400 shrink-0 mt-0.5" />
            <span className="text-green-400 font-medium">
              {uploadState.result.imported} importadas · {uploadState.result.duplicates} duplicadas
            </span>
          </div>
          {!uploadState.result.balance_updated && uploadState.result.last_transaction_date && (
            <div className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
              El extracto no incluye el saldo. Introdúcelo arriba a fecha{' '}
              <span className="font-medium">
                {new Date(uploadState.result.last_transaction_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              .
            </div>
          )}
        </div>
      )}
      {uploadState.status === 'error' && (
        <div className="flex items-start gap-2 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <span className="text-red-400">{uploadState.error}</span>
        </div>
      )}
    </div>
  )
}

export default function Import() {
  const { data: accounts = [], isLoading } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts })

  if (isLoading) return <div className="text-slate-400 text-sm">Cargando...</div>

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-white">Importar</h2>
        <div className="bg-slate-800 rounded-xl p-12 flex flex-col items-center gap-3 text-center">
          <Wallet size={32} className="text-slate-600" />
          <p className="text-slate-400 text-sm">Primero crea tus cuentas en la sección de Cuentas.</p>
          <Link to="/accounts"
            className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors">
            Ir a Cuentas
          </Link>
        </div>
      </div>
    )
  }

  const byBank = accounts.reduce((acc, a) => {
    if (!acc[a.bank]) acc[a.bank] = []
    acc[a.bank].push(a)
    return acc
  }, {} as Record<string, Account[]>)

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Importar transacciones</h2>
      {Object.entries(byBank).map(([bank, accs]) => (
        <div key={bank}>
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
            {BANK_LABELS[bank as BankId] ?? bank}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {accs.map(a => <AccountUploadBox key={a.id} account={a} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
