'use client'

// Nome del menu (percorso e titolo): toccandolo si passa a un altro menu
// dello stesso ristorante. Menu a tendina nativo (rotella su telefono e iPad).

import { useRouter } from 'next/navigation'

export default function MenuSwitcher({ restaurantId, currentId, currentName, menus, className, chevron = 10 }: {
  restaurantId: string
  currentId:    string
  currentName:  string
  menus:        { id: string; name: string }[]
  className?:   string
  chevron?:     number
}) {
  const router = useRouter()
  if (menus.length < 2) return <span className={className}>{currentName}</span>
  return (
    <span className={`relative inline-flex items-center gap-1 ${className ?? ''}`}>
      {currentName}
      <svg width={chevron} height={chevron} viewBox="0 0 10 10" aria-hidden className="opacity-60 shrink-0">
        <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <select aria-label="Cambia menu" value={currentId}
        onChange={e => { if (e.target.value !== currentId) router.push(`/admin/restaurants/${restaurantId}/menus/${e.target.value}`) }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
        {menus.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    </span>
  )
}
