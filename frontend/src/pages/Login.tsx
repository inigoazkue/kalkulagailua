import { useState, FormEvent } from 'react'
import api from '../api/client'

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<{ access_token: string }>('/auth/login', { username, password })
      localStorage.setItem('token', res.data.access_token)
      api.defaults.headers.common['Authorization'] = `Bearer ${res.data.access_token}`
      onLogin()
    } catch {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">Kalkulagailua</h1>
          <p className="text-slate-400 text-sm mt-1">Finanzas personales</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2.5 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2.5 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
