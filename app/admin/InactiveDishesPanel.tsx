'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { activateDishFromDashboard } from './actions'

interface InactiveDish {
  id:        string
  name:      string
  category:  string | null
  price:     number | null
  menu_id:   string
  menu_name: string
}

interface RestaurantGroup {
  id:       string
  name:     string
  dishes:   InactiveDish[]
}

export default function InactiveDishesPanel({ groups }: { groups: RestaurantGroup[] }) {
  const visible = groups.filter(g => g.dishes.length > 0)
  if (!visible.length) return null

  return (
    <div className="space-y-5 mt-8">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Piatti disattivati
      </h2>
      {visible.map(g => (
        <RestaurantDishTable key={g.id} group={g} />
      ))}
    </div>
  )
}

function RestaurantDishTable({ group }: { group: RestaurantGroup }) {
  const [dishes, setDishes]     = useState(group.dishes)
  const [activating, setActive] = useState<Set<string>>(new Set())
  const [, startTransition]     = useTransition()

  function handleActivate(dish: InactiveDish) {
    setActive(prev => new Set(Array.from(prev).concat(dish.id)))
    startTransition(async () => {
      try {
        await activateDishFromDashboard(group.id, dish.menu_id, dish.id)
        setDishes(prev => prev.filter(d => d.id !== dish.id))
      } catch {
        // keep row on error
      } finally {
        setActive(prev => { const s = new Set(prev); s.delete(dish.id); return s })
      }
    })
  }

  if (!dishes.length) return null

  return (
    <div className="bg-white border border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <Link
          href={`/admin/restaurants/${group.id}`}
          className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
        >
          {group.name}
        </Link>
        <span className="text-xs text-gray-400">
          {dishes.length} disattivat{dishes.length === 1 ? 'o' : 'i'}
        </span>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-64">
        <table className="w-full min-w-[540px]">
          <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
            <tr className="text-left">
              <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Piatto</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Categoria</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Menu</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Prezzo</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {dishes.map(d => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-sm text-gray-700">{d.name}</td>
                <td className="px-4 py-2.5 text-sm text-gray-400">{d.category ?? '—'}</td>
                <td className="px-4 py-2.5 text-sm text-gray-400">
                  <Link
                    href={`/admin/restaurants/${group.id}/menus/${d.menu_id}`}
                    className="hover:text-blue-600 hover:underline"
                  >
                    {d.menu_name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-600 whitespace-nowrap">
                  {d.price != null ? `€ ${d.price.toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => handleActivate(d)}
                    disabled={activating.has(d.id)}
                    className="text-xs text-green-700 border border-green-200 bg-green-50 px-2.5 py-1 hover:bg-green-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {activating.has(d.id) ? '…' : 'Attiva'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
