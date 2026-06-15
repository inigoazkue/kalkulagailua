import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BarChart2, List, Upload,
  MoreHorizontal, ArrowLeftRight, TrendingUp,
  Wallet, Tag, LogOut, X, Database,
} from 'lucide-react'
import { clsx } from 'clsx'

const primaryNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analytics', label: 'Analítica', icon: BarChart2 },
  { to: '/transactions', label: 'Transacciones', icon: List },
  { to: '/import', label: 'Importar', icon: Upload },
]

const moreMainNav = [
  { to: '/transfers', label: 'Trans. internas', icon: ArrowLeftRight },
  { to: '/investments', label: 'Inversiones', icon: TrendingUp },
]

const moreSettingsNav = [
  { to: '/accounts', label: 'Cuentas', icon: Wallet },
  { to: '/categories', label: 'Categorías', icon: Tag },
  { to: '/backup', label: 'Backup', icon: Database },
]

export default function BottomNav({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="md:hidden">
      {/* "Más" sheet */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute bottom-[60px] left-0 right-0 bg-slate-800 border-t border-slate-700 rounded-t-2xl px-4 pt-4 pb-2"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Más</span>
              <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1">
              {moreMainNav.map(({ to, label, icon: Icon }) => (
                <button
                  key={to}
                  onClick={() => { navigate(to); setOpen(false) }}
                  className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm text-slate-300 hover:bg-slate-700 active:bg-slate-700 transition-colors text-left"
                >
                  <Icon size={18} className="shrink-0 text-slate-400" />
                  {label}
                </button>
              ))}
            </div>

            <div className="border-t border-slate-700 mt-2 pt-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 pb-1">Ajustes</p>
              <div className="grid grid-cols-2 gap-1">
                {moreSettingsNav.map(({ to, label, icon: Icon }) => (
                  <button
                    key={to}
                    onClick={() => { navigate(to); setOpen(false) }}
                    className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm text-slate-300 hover:bg-slate-700 active:bg-slate-700 transition-colors text-left"
                  >
                    <Icon size={18} className="shrink-0 text-slate-400" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-700 mt-2 pt-1 pb-1">
              <button
                onClick={() => { onLogout(); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-slate-700/50 active:bg-slate-700/50 transition-colors"
              >
                <LogOut size={18} />
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-slate-800 border-t border-slate-700 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {primaryNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => clsx(
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[9px] font-medium transition-colors overflow-hidden',
              isActive ? 'text-blue-400' : 'text-slate-500'
            )}
          >
            <Icon size={22} />
            <span className="truncate w-full text-center px-0.5">{label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setOpen(o => !o)}
          className={clsx(
            'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[9px] font-medium transition-colors',
            open ? 'text-blue-400' : 'text-slate-500'
          )}
        >
          <MoreHorizontal size={22} />
          <span>Más</span>
        </button>
      </nav>
    </div>
  )
}
