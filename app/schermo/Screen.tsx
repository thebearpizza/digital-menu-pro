'use client'
// Mostra l'area che il browser lascia al sito, come la vede il menu (stesse
// impostazioni di pagina): da inserire in "Il mio telefono" nell'anteprima.

import { useEffect, useState } from 'react'

export default function Screen() {
  const [m, setM] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const read = () => setM({ w: window.innerWidth, h: window.innerHeight })
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])
  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: '#fbf8f2', color: '#1d1915', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <p className="text-xs uppercase tracking-[0.3em]" style={{ color: '#9a8462' }}>Misure dello schermo</p>
      <p className="text-5xl font-semibold tabular-nums">{m ? `${m.w} × ${m.h}` : '…'}</p>
      <p className="text-sm max-w-xs" style={{ color: '#5f574d' }}>
        Larghezza × altezza. Inseriscile nell&apos;anteprima della Personalizzazione, in &quot;Schermo → Il mio telefono&quot;.
        Tieni il telefono in verticale, con le barre del browser visibili come quando si apre il menu.
      </p>
    </main>
  )
}
