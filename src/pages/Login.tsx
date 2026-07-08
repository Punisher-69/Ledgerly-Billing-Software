import { useState } from 'react'
import { getApi } from '@/lib/api'

export function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { ok } = await getApi().authLogin(username, password)
      if (ok) onLoggedIn()
      else setError('Incorrect username or password.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md rounded-2xl bg-yellow-50 p-8 shadow-lg border border-amber-400/50">
        <h1 className="text-2xl font-semibold text-zinc-950 text-center mb-1">Ledgerly</h1>
        <p className="text-sm text-zinc-700 text-center mb-8">Sign in to continue</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-800 mb-1">Username</label>
            <input
              className="w-full rounded-lg border border-amber-900/20 bg-white px-3 py-2.5 text-zinc-950 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-800 mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-lg border border-amber-900/20 bg-white px-3 py-2.5 text-zinc-950 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error ? <p className="text-sm text-zinc-950 bg-yellow-200/90 border border-amber-500/40 px-2 py-1 rounded">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-yellow-400 text-zinc-950 py-2.5 font-medium hover:bg-yellow-300 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
