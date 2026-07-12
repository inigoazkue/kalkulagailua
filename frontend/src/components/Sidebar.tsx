import { NavLink } from 'react-router-dom'
import { LayoutDashboard, List, TrendingUp, LogOut, BarChart2, Settings, Wallet, Upload, Tag, ArrowLeftRight, Database, ShieldCheck, ClipboardList } from 'lucide-react'
import { clsx } from 'clsx'
import { APP_VERSION } from '../utils/version'

const mainNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analytics', label: 'Analítica', icon: BarChart2 },
  { to: '/transactions', label: 'Transacciones', icon: List },
  { to: '/investments', label: 'Inversiones', icon: TrendingUp },
]

const supervisionNav = [
  { to: '/transfers', label: 'Trans. internas', icon: ArrowLeftRight },
  { to: '/investment-links', label: 'Inv. pendientes', icon: ClipboardList },
]

const settingsNav = [
  { to: '/accounts', label: 'Cuentas', icon: Wallet },
  { to: '/import', label: 'Importar', icon: Upload },
  { to: '/categories', label: 'Categorías', icon: Tag },
  { to: '/backup', label: 'Backup', icon: Database },
]

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isActive ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        )
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  )
}

export default function Sidebar({ onLogout }: { onLogout: () => void }) {
  return (
    <aside className="hidden md:flex w-56 bg-slate-800 flex-col py-6 px-3 shrink-0">
      <div className="px-3 mb-6">
        <h1 className="text-lg font-bold text-white tracking-tight">Kalkulagailua</h1>
        <p className="text-xs text-slate-400">Finanzas personales</p>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {mainNav.map(item => <NavItem key={item.to} {...item} />)}
      </nav>

      <div className="mt-4">
        <div className="flex items-center gap-2 px-3 py-1 mb-1">
          <ShieldCheck size={13} className="text-slate-500" />
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Supervisión</span>
        </div>
        <div className="flex flex-col gap-1">
          {supervisionNav.map(item => <NavItem key={item.to} {...item} />)}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2 px-3 py-1 mb-1">
          <Settings size={13} className="text-slate-500" />
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ajustes</span>
          <span className="text-[10px] text-slate-600">v{APP_VERSION}</span>
        </div>
        <div className="flex flex-col gap-1">
          {settingsNav.map(item => <NavItem key={item.to} {...item} />)}
        </div>
      </div>

      <button
        onClick={onLogout}
        className="mt-4 flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
      >
        <LogOut size={18} />
        Salir
      </button>
    </aside>
  )
}
