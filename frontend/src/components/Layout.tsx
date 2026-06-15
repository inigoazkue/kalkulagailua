import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function Layout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <Sidebar onLogout={onLogout} />
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top header */}
        <header className="md:hidden flex items-center px-4 h-12 bg-slate-800 border-b border-slate-700 shrink-0">
          <span className="text-sm font-bold text-white tracking-tight">Kalkulagailua</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
        <BottomNav onLogout={onLogout} />
      </div>
    </div>
  )
}
