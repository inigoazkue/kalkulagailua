import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAccounts, createAccount, updateAccount, deleteAccount, Account, AccountCreate, AccountUpdate, BankId, AccountSubtype } from '../api/client'
import { Plus, Pencil, Trash2, X, Wallet } from 'lucide-react'
import { clsx } from 'clsx'

const BANK_LABELS: Record<BankId, string> = {
  caixabank: 'CaixaBank',
  myinvestor: 'MyInvestor',
  trade_republic: 'Trade Republic',
  bit2me: 'Bit2me',
}

const SUBTYPE_LABELS: Record<AccountSubtype, string> = {
  daily: 'Corriente',
  savings: 'Ahorro',
}

const SUBTYPE_COLORS: Record<AccountSubtype, string> = {
  daily: 'bg-blue-500/20 text-blue-300',
  savings: 'bg-green-500/20 text-green-300',
}

const COLOR_PRESETS = ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#eab308', '#6b7280']

const fmt = (val: string | number) =>
  Number(val).toLocaleString('es', { style: 'currency', currency: 'EUR' })

const BANKS: BankId[] = ['caixabank', 'myinvestor', 'trade_republic', 'bit2me']
const SUBTYPES: AccountSubtype[] = ['daily', 'savings']

type FormData = AccountCreate & { id?: number }

const emptyForm = (): FormData => ({
  name: '', bank: 'caixabank', subtype: 'daily',
  iban: '', color: '#3b82f6', include_in_savings: false, show_on_dashboard: true, is_payroll_account: false,
})

function AccountModal({ initial, onClose }: { initial: FormData; onClose: () => void }) {
  const [form, setForm] = useState<FormData>(initial)
  const qc = useQueryClient()
  const isEdit = !!initial.id

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? updateAccount(initial.id!, form as AccountUpdate)
      : createAccount(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); onClose() },
  })

  const set = (k: keyof FormData, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">{isEdit ? 'Editar cuenta' : 'Nueva cuenta'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nombre</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Ej: CaixaBank Diaria"
              className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Banco</label>
              <select value={form.bank} onChange={e => set('bank', e.target.value)}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500">
                {BANKS.map(b => <option key={b} value={b}>{BANK_LABELS[b]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tipo</label>
              <select value={form.subtype} onChange={e => set('subtype', e.target.value)}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500">
                {SUBTYPES.map(s => <option key={s} value={s}>{SUBTYPE_LABELS[s]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">IBAN (opcional)</label>
            <input value={form.iban ?? ''} onChange={e => set('iban', e.target.value)}
              placeholder="ES00 0000 0000..."
              className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PRESETS.map(c => (
                <button key={c} onClick={() => set('color', c)}
                  className={clsx('w-7 h-7 rounded-full border-2 transition-transform', form.color === c ? 'border-white scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.include_in_savings} onChange={e => set('include_in_savings', e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500" />
              <span className="text-sm text-slate-300">Incluir en ahorro total</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.show_on_dashboard} onChange={e => set('show_on_dashboard', e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500" />
              <span className="text-sm text-slate-300">Mostrar en dashboard</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={(form as any).is_payroll_account ?? false} onChange={e => set('is_payroll_account', e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500" />
              <span className="text-sm text-slate-300">Cuenta nómina</span>
            </label>
          </div>
        </div>

        {mutation.isError && (
          <p className="text-red-400 text-xs">Error al guardar la cuenta</p>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancelar</button>
          <button onClick={() => mutation.mutate()} disabled={!form.name || mutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors">
            {mutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AccountCard({ account }: { account: Account }) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const qc = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: () => deleteAccount(account.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })

  return (
    <>
      <div className="bg-slate-800 rounded-xl p-4 flex items-start gap-3">
        <div className="w-3 h-3 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: account.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white text-sm">{account.name}</span>
            <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-medium', SUBTYPE_COLORS[account.subtype])}>
              {SUBTYPE_LABELS[account.subtype]}
            </span>
            {account.include_in_savings && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Ahorro total</span>
            )}
          </div>
          {account.iban && (
            <p className="text-xs text-slate-500 font-mono mt-0.5">···· {account.iban.slice(-4)}</p>
          )}
          {account.current_balance !== null && (
            <p className="text-sm font-semibold text-white mt-1">{fmt(account.current_balance)}</p>
          )}
          {account.balance_date && (
            <p className="text-xs text-slate-500">actualizado {account.balance_date}</p>
          )}
          {account.last_transaction_date && (
            <p className="text-xs text-slate-600">
              Última tx: {new Date(account.last_transaction_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setEditing(true)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-700 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {editing && (
        <AccountModal
          initial={{ id: account.id, name: account.name, bank: account.bank, subtype: account.subtype, iban: account.iban ?? '', color: account.color, include_in_savings: account.include_in_savings, show_on_dashboard: account.show_on_dashboard, is_payroll_account: account.is_payroll_account }}
          onClose={() => setEditing(false)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-80 shadow-2xl space-y-4">
            <p className="text-white font-medium">¿Eliminar "{account.name}"?</p>
            <p className="text-slate-400 text-sm">Se eliminarán también todas sus transacciones.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancelar</button>
              <button onClick={() => deleteMutation.mutate()} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function Accounts() {
  const [showModal, setShowModal] = useState(false)
  const { data: accounts = [], isLoading } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts })

  const grouped = BANKS.reduce((acc, bank) => {
    acc[bank] = accounts.filter(a => a.bank === bank)
    return acc
  }, {} as Record<BankId, Account[]>)

  const totalSavings = accounts
    .filter(a => a.include_in_savings && a.current_balance !== null)
    .reduce((s, a) => s + Number(a.current_balance), 0)

  const hasSavings = accounts.some(a => a.include_in_savings && a.current_balance !== null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Cuentas</h2>
          {hasSavings && (
            <p className="text-sm text-slate-400 mt-0.5">
              Ahorro total: <span className="text-green-400 font-semibold">{fmt(totalSavings)}</span>
            </p>
          )}
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors">
          <Plus size={16} /> Nueva cuenta
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm">Cargando...</div>
      ) : accounts.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-12 flex flex-col items-center gap-3 text-center">
          <Wallet size={32} className="text-slate-600" />
          <p className="text-slate-400 text-sm">No hay cuentas. Crea una para empezar a importar.</p>
          <button onClick={() => setShowModal(true)}
            className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors">
            Nueva cuenta
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {BANKS.map(bank => grouped[bank].length > 0 && (
            <div key={bank}>
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">{BANK_LABELS[bank]}</h3>
              <div className="space-y-2">
                {grouped[bank].map(a => <AccountCard key={a.id} account={a} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <AccountModal initial={emptyForm()} onClose={() => setShowModal(false)} />}
    </div>
  )
}
