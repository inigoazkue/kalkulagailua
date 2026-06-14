import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchCategories, createCategory, updateCategory, deleteCategory, Category } from '../api/client'
import { Plus, Pencil, Trash2, X, Tag } from 'lucide-react'
import { clsx } from 'clsx'

type CategoryType = 'income' | 'fixed_expense' | 'variable_expense' | 'investment'

const TYPE_LABELS: Record<CategoryType, string> = {
  income: 'Ingreso',
  fixed_expense: 'Gasto fijo',
  variable_expense: 'Gasto variable',
  investment: 'Inversión',
}

const TYPE_COLORS: Record<CategoryType, string> = {
  income: 'bg-green-500/20 text-green-300',
  fixed_expense: 'bg-red-500/20 text-red-300',
  variable_expense: 'bg-orange-500/20 text-orange-300',
  investment: 'bg-purple-500/20 text-purple-300',
}

const COLOR_PRESETS = ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#eab308', '#6b7280', '#14b8a6', '#f43f5e', '#84cc16']

const TYPES: CategoryType[] = ['income', 'fixed_expense', 'variable_expense', 'investment']

interface FormData {
  id?: number
  name: string
  category_type: CategoryType
  color: string
  keywords: string
}

const emptyForm = (): FormData => ({
  name: '', category_type: 'variable_expense', color: '#6b7280', keywords: '',
})

function CategoryModal({ initial, onClose }: { initial: FormData; onClose: () => void }) {
  const [form, setForm] = useState<FormData>(initial)
  const qc = useQueryClient()
  const isEdit = !!initial.id

  const mutation = useMutation({
    mutationFn: () => {
      const kws = form.keywords.split(',').map(s => s.trim()).filter(Boolean)
      return isEdit
        ? updateCategory(initial.id!, { name: form.name, category_type: form.category_type, color: form.color, keywords: kws })
        : createCategory({ name: form.name, category_type: form.category_type, color: form.color, keywords: kws })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); onClose() },
  })

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">{isEdit ? 'Editar categoría' : 'Nueva categoría'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nombre</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Ej: Supermercado"
              className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Tipo</label>
            <select value={form.category_type} onChange={e => set('category_type', e.target.value as CategoryType)}
              className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500">
              {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
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

          <div>
            <label className="block text-xs text-slate-400 mb-1">Palabras clave (separadas por comas)</label>
            <input value={form.keywords} onChange={e => set('keywords', e.target.value)}
              placeholder="Ej: mercadona, lidl, carrefour"
              className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <p className="text-xs text-slate-500 mt-1">Se usarán para auto-categorizar transacciones que contengan estas palabras</p>
          </div>
        </div>

        {mutation.isError && <p className="text-red-400 text-xs">Error al guardar la categoría</p>}

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

function CategoryCard({ cat }: { cat: Category }) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const qc = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: () => deleteCategory(cat.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  const editInitial: FormData = {
    id: cat.id,
    name: cat.name,
    category_type: cat.category_type as CategoryType,
    color: cat.color,
    keywords: cat.keywords.map(k => k.keyword).join(', '),
  }

  return (
    <>
      <div className="bg-slate-800 rounded-xl p-4 flex items-start gap-3">
        <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: cat.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white text-sm">{cat.name}</span>
            <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-medium', TYPE_COLORS[cat.category_type as CategoryType])}>
              {TYPE_LABELS[cat.category_type as CategoryType]}
            </span>
          </div>
          {cat.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {cat.keywords.map(k => (
                <span key={k.id} className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded-md">{k.keyword}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setEditing(true)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
            <Pencil size={14} />
          </button>
          {!cat.is_default && (
            <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-700 transition-colors">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {editing && <CategoryModal initial={editInitial} onClose={() => setEditing(false)} />}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-80 shadow-2xl space-y-4">
            <p className="text-white font-medium">¿Eliminar "{cat.name}"?</p>
            <p className="text-slate-400 text-sm">Las transacciones con esta categoría quedarán sin categorizar.</p>
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

export default function Categories() {
  const [showModal, setShowModal] = useState(false)
  const { data: categories = [], isLoading } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })

  const grouped = TYPES.reduce((acc, t) => {
    acc[t] = categories.filter(c => c.category_type === t)
    return acc
  }, {} as Record<CategoryType, Category[]>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Categorías</h2>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors">
          <Plus size={16} /> Nueva categoría
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm">Cargando...</div>
      ) : categories.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-12 flex flex-col items-center gap-3 text-center">
          <Tag size={32} className="text-slate-600" />
          <p className="text-slate-400 text-sm">No hay categorías. Crea una para empezar a catalogar tus gastos.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {TYPES.map(type => grouped[type].length > 0 && (
            <div key={type}>
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">{TYPE_LABELS[type]}</h3>
              <div className="space-y-2">
                {grouped[type].map(c => <CategoryCard key={c.id} cat={c} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <CategoryModal initial={emptyForm()} onClose={() => setShowModal(false)} />}
    </div>
  )
}
