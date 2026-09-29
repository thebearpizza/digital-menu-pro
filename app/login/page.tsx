'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/Spinner'
import { useStaggerEntrance } from '@/lib/animations'
import { toLoginEmail } from '@/lib/username'
import LitoMark from '@/components/LitoMark'

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
    <div className="login-page min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <div className="flex flex-col items-center mb-7" aria-label="Lito">
        <LitoMark className="w-24 h-24 sm:w-28 sm:h-28" writeStartMs={250} writeMs={2400} />
        <div className="login-wordmark mt-1 text-[11px] uppercase">Lito</div>
      </div>
      <div ref={cardRef} className="login-card w-full max-w-sm px-7 py-8 sm:px-8">
        <h1 className="login-title mb-6">Accedi al gestionale</h1>

        {error && (
          <div className="login-error mb-4 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="login-label block mb-1.5">Nome utente</label>
            <input
              type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
              required autoComplete="username" autoCapitalize="none" spellCheck={false}
              className="login-input w-full px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="login-label block mb-1.5">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required autoComplete="current-password"
              className="login-input w-full px-3.5 py-2.5 text-sm"
            />
          </div>
          <div className="pt-2">
            <button
              type="submit" disabled={!!loading}
              className="login-button w-full py-2.5 text-sm flex items-center justify-center"
            >
              {loading === 'login' ? <Spinner color="#3a2a08" /> : 'Accedi'}
            </button>
          </div>
        </form>

        <p className="login-note mt-6 text-[11px] text-center">
          L&apos;accesso è riservato. Per ottenere un account contatta l&apos;amministratore.
        </p>
      </div>
    </div>
  )
}
