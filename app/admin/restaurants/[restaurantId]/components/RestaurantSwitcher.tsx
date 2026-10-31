'use client'

// Nome del ristorante nel percorso in alto: toccandolo si passa a un altro
// ristorante restando nella stessa tab (Menu, Personalizzazione, Stile…).
// Il menu a tendina è quello nativo: sul telefono e sull'iPad si apre la
// rotella di sistema.

import { usePathname, useRouter } from 'next/navigation'

interface Props {
  currentId:   string
  currentName: string
  restaurants: { id: string; name: string }[]
}

/** Stessa tab nell'altro ristorante. Le pagine di un singolo menu (che
 *  appartiene al ristorante di prima) tornano all'elenco dei menu. */
export function sameTabPath(pathname: string, fromId: string, toId: string): string {
  const base = `/admin/restaurants/${fromId}`
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : ''
  const seg = rest.split('/').filter(Boolean)
  const keep = seg[0] === 'stile' && seg[1] === 'apertura' ? seg.slice(0, 2) : seg.slice(0, 1)
  return `/admin/restaurants/${toId}${keep.length ? `/${keep.join('/')}` : ''}`
}

export default function RestaurantSwitcher({ currentId, currentName, restaurants }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  if (restaurants.length < 2) return <span className="text-gray-700 font-medium">{currentName}</span>
  return (
    <span className="relative inline-flex items-center gap-1 text-gray-700 font-medium hover:text-gray-900">
      {currentName}
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="opacity-60">
        <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <select aria-label="Cambia ristorante" value={currentId}
        onChange={e => { if (e.target.value !== currentId) router.push(sameTabPath(pathname, currentId, e.target.value)) }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
        {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
    </span>
  )
}
