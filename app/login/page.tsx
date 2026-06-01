'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const router   = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email o password non corretti.'); setLoading(false) }
    else { router.push('/admin'); router.refresh() }
  }

  async function handleSignUp(e: React.MouseEvent) {
    e.preventDefault()
    if (!email || !password) { setError('Inserisci email e password.'); return }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else {
      setLoading(false)
      alert('Registrazione effettuata! Controlla la tua email per confermare.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-gray-200 shadow-sm p-8">
        <div className="mb-7">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1">
            Digital Menu Pro
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Accedi al gestionale</h1>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email"
              className="w-full px-3 py-2 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required autoComplete="current-password"
              className="w-full px-3 py-2 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit" disabled={loading}
              className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Accesso…' : 'Accedi'}
            </button>
            <button
              type="button" onClick={handleSignUp} disabled={loading}
              className="flex-1 border border-gray-300 text-gray-600 text-sm font-medium py-2 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Registrati
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
