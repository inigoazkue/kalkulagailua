import { useState } from 'react'
import { Download, Database } from 'lucide-react'
import { downloadBackup } from '../api/client'

export default function Backup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleDownload() {
    setLoading(true)
    setError(null)
    setDone(false)
    try {
      await downloadBackup()
      setDone(true)
    } catch {
      setError('Error al generar el backup. Comprueba los logs del servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Backup de datos</h2>

      <div className="bg-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <Database size={20} className="text-slate-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm text-slate-300">
              Descarga un volcado completo de la base de datos en formato SQL.
              Incluye estructura y todos los datos (cuentas, transacciones, categorías, inversiones...).
            </p>
            <p className="text-xs text-slate-500">
              El archivo se puede restaurar con <code className="text-blue-400 bg-slate-700/60 px-1 py-0.5 rounded">psql</code> en cualquier PostgreSQL compatible.
            </p>
          </div>
        </div>

        <button
          onClick={handleDownload}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          <Download size={16} />
          {loading ? 'Generando backup...' : 'Descargar backup SQL'}
        </button>

        {done && (
          <p className="text-sm text-green-400">Backup descargado correctamente.</p>
        )}
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <div className="border-t border-slate-700 pt-4 space-y-2">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Cómo restaurar</p>
          <pre className="text-xs bg-slate-700/60 rounded-lg px-3 py-2 text-slate-300 overflow-x-auto">
{`psql postgresql://kalk:kalk@localhost:5432/kalkulagailua \\
  < kalkulagailua_YYYY-MM-DD.sql`}
          </pre>
        </div>
      </div>
    </div>
  )
}
