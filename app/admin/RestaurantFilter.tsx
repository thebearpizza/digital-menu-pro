'use client'

// Scelta dei ristoranti di cui vedere le statistiche nella dashboard: "Tutti"
// o uno o più ristoranti (tocco per aggiungere o togliere). La scelta sta
// nell'indirizzo (?r=id1,id2), così resta anche ricaricando la pagina.

import { useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export default function RestaurantFilter({ restaurants, selected }: {
  restaurants: { id: string; name: string }[]
  selected:    string[]   // vuoto = tutti
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, start] = useTransition()
  if (restaurants.length < 2) return null

  const all = selected.length === 0
  const go = (ids: string[]) => {
    // Tutti scelti uno per uno = "Tutti".
    const q = ids.length && ids.length < restaurants.length ? `?r=${ids.join(',')}` : ''
    start(() => router.replace(`${pathname}${q}`, { scroll: false }))
  }
  const toggle = (id: string) =>
    go(all ? [id] : selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])

  const chip = (on: boolean) =>
    `text-xs font-medium px-3 py-1.5 border transition-colors ${on
      ? 'bg-blue-600 text-white border-blue-600'
      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`

  return (
    <div className={`mb-6 transition-opacity ${pending ? 'opacity-60' : ''}`}>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
        Statistiche di
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => go([])} aria-pressed={all}
          className={chip(all)} style={{ borderRadius: 999 }}>
          Tutti
        </button>
        {restaurants.map(r => {
          const on = !all && selected.includes(r.id)
          return (
            <button key={r.id} type="button" onClick={() => toggle(r.id)} aria-pressed={on}
              className={chip(on)} style={{ borderRadius: 999 }}>
              {r.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
