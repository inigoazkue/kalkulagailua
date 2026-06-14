import { useRef, useState, DragEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAccounts, importFile, ImportResult, Account, BankId, AccountSubtype } from '../api/client'
import { Upload, CheckCircle, XCircle, Wallet } from 'lucide-react'
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

interface UploadState {
  status: 'idle' | 'loading' | 'success' | 'error'
  result?: ImportResult
  error?: string
  dragging?: boolean
}

function AccountUploadBox({ account }: { account: Account }) {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (file: File) => importFile(account.id, file),
    onSuccess: result => {
      setState({ status: 'success', result })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setState({ status: 'error', error: msg })
    },
  })

  const handleFile = (file: File) => {
    setState({ status: 'loading' })
    mutation.mutate(file)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setState(s => ({ ...s, dragging: false }))
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

      <div
        onDragOver={e => { e.preventDefault(); setState(s => ({ ...s, dragging: true })) }}
        onDragLeave={() => setState(s => ({ ...s, dragging: false }))}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'border-2 border-dashed rounded-lg p-5 flex flex-col items-center gap-2 cursor-pointer transition-colors',
          state.dragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
        )}
      >
        <Upload size={20} className="text-slate-400" />
        <span className="text-xs text-slate-400">
          {state.status === 'loading' ? 'Procesando...' : 'Arrastra o haz clic'}
        </span>
        <span className="text-xs text-slate-600 uppercase">{accept}</span>
      </div>

      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />

      {state.status === 'success' && state.result && (
        <div className="flex items-start gap-2 text-xs bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
          <CheckCircle size={14} className="text-green-400 shrink-0 mt-0.5" />
          <span className="text-green-400 font-medium">{state.result.imported} importadas · {state.result.duplicates} duplicadas</span>
        </div>
      )}
      {state.status === 'error' && (
        <div className="flex items-start gap-2 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <span className="text-red-400">{state.error}</span>
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
