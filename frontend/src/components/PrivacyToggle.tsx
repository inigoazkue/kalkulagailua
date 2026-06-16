import { Eye, EyeOff } from 'lucide-react'
import { clsx } from 'clsx'
import { usePrivacy } from '../context/PrivacyContext'

export default function PrivacyToggle({ className }: { className?: string }) {
  const { hidden, toggle } = usePrivacy()
  return (
    <button
      onClick={toggle}
      title={hidden ? 'Mostrar importes y gráficos' : 'Ocultar importes y gráficos'}
      className={clsx(
        'p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors shrink-0',
        className
      )}
    >
      {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  )
}
