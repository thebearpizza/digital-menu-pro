'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/Spinner'
import { useStaggerEntrance } from '@/lib/animations'
import { toLoginEmail } from '@/lib/username'

// Registrazione pubblica RIMOSSA: gli account non si creano più da qui.
// Vengono forniti a mano dall'account padre tramite la tab "Utenti" del
// gestionale (vedi app/admin/users/). Prima chiunque poteva registrarsi
// liberamente, e ogni account autenticato rientrava nel perimetro delle
// policy `authenticated` — quindi la registrazione aperta amplificava la
// portata di qualunque policy troppo larga.
//
// Accesso con NOME UTENTE: Supabase Auth vuole comunque un'email, quindi il
// nome utente viene tradotto in un'email interna (vedi lib/username.ts).
// Gli account storici con email vera (impresefc@gmail.com e gli altri)
// continuano ad accedere ESATTAMENTE come prima: se l'input contiene "@"
// viene passato tal quale, senza alcuna conversione.
export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState<'login' | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const router   = useRouter()
  const supabase = createClient()
  const cardRef = useStaggerEntrance<HTMLDivElement>({ duration: 600, staggerMs: 90, translateY: 14 })

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading('login')
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: toLoginEmail(identifier),
      password,
    })
    if (error) { setError('Nome utente o password non corretti.'); setLoading(null) }
    else { router.push('/admin'); router.refresh() }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div ref={cardRef} className="w-full max-w-sm bg-white border border-gray-200 shadow-sm p-8">
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome utente</label>
            <input
              type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
              required autoComplete="username" autoCapitalize="none" spellCheck={false}
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
          <div className="pt-1">
            <button
              type="submit" disabled={!!loading}
              className="w-full bg-blue-600 text-white text-sm font-medium py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center"
            >
              {loading === 'login' ? <Spinner color="#fff" /> : 'Accedi'}
            </button>
          </div>
        </form>

        <p className="mt-5 text-[11px] text-gray-400 text-center">
          L&apos;accesso è riservato. Per ottenere un account contatta l&apos;amministratore.
        </p>
      </div>
    </div>
  )
}
