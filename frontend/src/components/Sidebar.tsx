import { NavLink } from 'react-router-dom'
import { LayoutDashboard, List, Upload, TrendingUp, LogOut } from 'lucide-react'
import { clsx } from 'clsx'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transacciones', icon: List },
  { to: '/import', label: 'Importar', icon: Upload },
  { to: '/investments', label: 'Inversiones', icon: TrendingUp },
]

export default function Sidebar({ onLogout }: { onLogout: () => void }) {
  return (
    <aside className="w-56 bg-slate-800 flex flex-col py-6 px-3 shrink-0">
      <div className="px-3 mb-6">
        <h1 className="text-lg font-bold text-white tracking-tight">Kalkulagailua</h1>
        <p className="text-xs text-slate-400">Finanzas personales</p>
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <button
        onClick={onLogout}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
      >
        <LogOut size={18} />
        Salir
      </button>
    </aside>
  )
}
