import { useRef, useState, DragEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { importFile, ImportResult } from '../api/client'
import { Upload, CheckCircle, XCircle } from 'lucide-react'
import { clsx } from 'clsx'

interface BankConfig {
  id: string
  name: string
  accept: string
  description: string
}

const banks: BankConfig[] = [
  { id: 'caixabank', name: 'CaixaBank', accept: '.csv', description: 'CSV — Fecha, Concepto, Importe, Saldo' },
  { id: 'myinvestor', name: 'MyInvestor', accept: '.xlsx', description: 'Excel (.xlsx) — Mis Movimientos' },
  { id: 'trade_republic', name: 'Trade Republic', accept: '.csv', description: 'CSV nativo — Account Statements' },
  { id: 'bit2me', name: 'Bit2me', accept: '.xlsx', description: 'Excel (.xlsx) por año — Histórico de actividad' },
]

interface UploadState {
  status: 'idle' | 'loading' | 'success' | 'error'
  result?: ImportResult
  error?: string
  dragging?: boolean
}

function BankUploadBox({ bank }: { bank: BankConfig }) {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (file: File) => importFile(bank.id, file),
    onSuccess: result => {
      setState({ status: 'success', result })
      qc.invalidateQueries({ queryKey: ['transactions'] })
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

  return (
    <div className="bg-slate-800 rounded-xl p-5 space-y-3">
      <div>
        <h3 className="font-semibold text-white">{bank.name}</h3>
        <p className="text-xs text-slate-400 mt-0.5">{bank.description}</p>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setState(s => ({ ...s, dragging: true })) }}
        onDragLeave={() => setState(s => ({ ...s, dragging: false }))}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors',
          state.dragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
        )}
      >
        <Upload size={24} className="text-slate-400" />
        <span className="text-sm text-slate-400">
          {state.status === 'loading' ? 'Procesando...' : 'Arrastra o haz clic para seleccionar'}
        </span>
        <span className="text-xs text-slate-500">{bank.accept.toUpperCase()}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={bank.accept}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />

      {state.status === 'success' && state.result && (
        <div className="flex items-start gap-2 text-sm bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
          <CheckCircle size={16} className="text-green-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-green-400 font-medium">Importación completada</p>
            <p className="text-slate-300">
              {state.result.imported} transacciones importadas · {state.result.duplicates} duplicadas
            </p>
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex items-start gap-2 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">Error de importación</p>
            <p className="text-slate-300 text-xs">{state.error}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Import() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Importar transacciones</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {banks.map(bank => (
          <BankUploadBox key={bank.id} bank={bank} />
        ))}
      </div>
    </div>
  )
}
