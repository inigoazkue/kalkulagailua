import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <Sidebar onLogout={onLogout} />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
