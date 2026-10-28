'use client'
// Interruttore "Menu sul QR": quale menu vedono i clienti che scansionano il
// QR (/m/<token>, indirizzo che non cambia mai). Si può tornare indietro in
// ogni momento; l'effetto è immediato.

import { useState, useTransition } from 'react'
import { setNewMenu } from './actions'

export default function QrSwitch({ restaurantId, token, initial }: { restaurantId: string; token: string; initial: boolean }) {
  const [on, setOn] = useState(initial)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, start] = useTransition()

  const apply = (next: boolean) => start(async () => {
    setError(null)
    const r = await setNewMenu(restaurantId, next)
    if (r.ok) { setOn(next); setAsking(false) } else setError(r.error)
  })

  return (
    <div className="mb-3 mx-4 sm:mx-0 border p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{ borderRadius: 14, borderColor: on ? '#86c79b' : '#e5e7eb', background: on ? '#f1faf3' : '#fff' }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">
          Menu sul QR: {on ? 'nuovo menu' : 'vecchio menu'}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {asking
            ? 'Chi scansiona il QR vedrà subito la nuova pagina d\'apertura e il nuovo menu. Puoi tornare al vecchio quando vuoi.'
            : on
              ? 'I clienti vedono il nuovo menu. Il QR stampato non cambia.'
              : 'Le modifiche qui sotto si vedono solo nell\'anteprima finché non attivi il nuovo menu.'}
        </p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a href={`/m/${token}?from=admin`} className="text-xs font-medium text-gray-600 border border-gray-200 px-3 py-2 hover:bg-gray-50" style={{ borderRadius: 999 }}>
          Apri come i clienti
        </a>
        {asking ? (<>
          <button type="button" disabled={busy} onClick={() => apply(true)}
            className="text-xs font-semibold text-white bg-green-700 px-3 py-2 disabled:opacity-50" style={{ borderRadius: 999 }}>
            {busy ? 'Attivo…' : 'Conferma'}
          </button>
          <button type="button" disabled={busy} onClick={() => setAsking(false)}
            className="text-xs font-medium text-gray-600 px-3 py-2" style={{ borderRadius: 999 }}>
            Annulla
          </button>
        </>) : on ? (
          <button type="button" disabled={busy} onClick={() => apply(false)}
            className="text-xs font-medium text-gray-700 border border-gray-300 px-3 py-2 hover:bg-gray-50 disabled:opacity-50" style={{ borderRadius: 999 }}>
            {busy ? 'Ripristino…' : 'Torna al vecchio menu'}
          </button>
        ) : (
          <button type="button" onClick={() => setAsking(true)}
            className="text-xs font-semibold text-white bg-gray-900 px-3 py-2" style={{ borderRadius: 999 }}>
            Attiva il nuovo menu
          </button>
        )}
      </div>
    </div>
  )
}
