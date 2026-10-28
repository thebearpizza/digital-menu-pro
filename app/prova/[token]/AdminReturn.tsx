'use client'
// Tasto "Torna al gestionale": solo quando il menu è aperto dall'Anteprima del
// gestionale (?from=admin). Il nuovo menu passa dalla pagina d'apertura al menu
// cambiando indirizzo, quindi l'informazione resta nella scheda del browser
// (sessionStorage) e il tasto torna alla pagina del gestionale da cui si era
// partiti. I clienti che arrivano dal QR non lo vedono mai.

import { useEffect, useState } from 'react'

const KEY = 'lito-admin-return'

export default function AdminReturn({ fromAdmin = false }: { fromAdmin?: boolean }) {
  const [href, setHref] = useState<string | null>(null)
  useEffect(() => {
    try {
      if (fromAdmin) {
        let back = '/admin'
        try {
          const ref = document.referrer ? new URL(document.referrer) : null
          if (ref && ref.origin === location.origin && ref.pathname.startsWith('/admin')) back = ref.pathname + ref.search
        } catch { /* referrer illeggibile */ }
        sessionStorage.setItem(KEY, back)
      }
      setHref(sessionStorage.getItem(KEY))
    } catch { /* memoria non disponibile: niente tasto */ }
  }, [fromAdmin])
  if (!href) return null
  return (
    <a href={href}
      style={{
        position: 'fixed', top: 'calc(10px + env(safe-area-inset-top))', left: 10, zIndex: 2147482000,
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px 7px 11px', borderRadius: 9999,
        fontSize: 13, fontWeight: 600, color: '#3a2a08', textDecoration: 'none',
        background: 'linear-gradient(180deg, #fdf8ee 0%, #eee2c9 100%)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.8)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
      <svg width="8" height="13" viewBox="0 0 8 13" aria-hidden><path d="M6.5 1.5L1.5 6.5l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      Gestionale
    </a>
  )
}
