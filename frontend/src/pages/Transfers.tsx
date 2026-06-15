import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchTransfers, deleteTransfer, fetchAccounts } from '../api/client'
import { Trash2, ArrowLeftRight } from 'lucide-react'

const fmt = (val: string) =>
  Number(val).toLocaleString('es', { style: 'currency', currency: 'EUR' })

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })

export default function Transfers() {
  const qc = useQueryClient()
  const { data: transfers = [], isLoading } = useQuery({ queryKey: ['transfers'], queryFn: fetchTransfers })
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts })

  const accountName = (id: number) => accounts.find(a => a.id === id)?.name ?? `#${id}`

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTransfer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Transferencias internas</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Movimientos entre tus propias cuentas detectados automáticamente. No se incluyen en cálculos de ingresos ni gastos.
        </p>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm">Cargando...</div>
      ) : transfers.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-12 flex flex-col items-center gap-3 text-center">
          <ArrowLeftRight size={32} className="text-slate-600" />
          <p className="text-slate-400 text-sm">No hay transferencias internas detectadas.</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">Fecha</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">Salida</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">Entrada</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">Importe</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-4 py-3">Tipo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {transfers.map(t => (
                <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-300">{fmtDate(t.tx_out.date)}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-slate-300">{accountName(t.tx_out.account_id)}</div>
                    <div className="text-xs text-slate-500 truncate max-w-xs" title={t.tx_out.description}>{t.tx_out.description}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-slate-300">{accountName(t.tx_in.account_id)}</div>
                    <div className="text-xs text-slate-500 truncate max-w-xs" title={t.tx_in.description}>{t.tx_in.description}</div>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono font-medium text-slate-200">
                    {fmt(t.tx_in.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${t.is_manual ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-600 text-slate-400'}`}>
                      {t.is_manual ? 'Manual' : 'Auto'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteMutation.mutate(t.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-700 transition-colors"
                      title="Desmarcar como transferencia interna"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
