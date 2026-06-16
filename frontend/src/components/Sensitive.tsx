import { ReactNode } from 'react'
import { clsx } from 'clsx'
import { usePrivacy } from '../context/PrivacyContext'

/** Envuelve un valor numérico inline (importes, porcentajes...). Se difumina cuando el modo privacidad está activo. */
export function Sensitive({ children, className }: { children: ReactNode; className?: string }) {
  const { hidden } = usePrivacy()
  return (
    <span className={clsx(hidden && 'blur-sm select-none', className)}>
      {children}
    </span>
  )
}

/** Igual que Sensitive pero para bloques (gráficos, tarjetas completas). Bloquea también la interacción mientras está oculto. */
export function SensitiveBlock({ children, className }: { children: ReactNode; className?: string }) {
  const { hidden } = usePrivacy()
  return (
    <div className={clsx(hidden && 'blur-md select-none pointer-events-none', className)}>
      {children}
    </div>
  )
}
