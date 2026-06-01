'use client'

import { useState } from 'react'
import DishForm from './DishForm'
import DishSyncModal from './DishSyncModal'
import { deleteDish } from './actions'
import { allergenName } from '@/lib/allergens'

interface Dish {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string | null
  image_url: string | null
  allergens: number[]
  sort_order: number
  is_active: boolean
  pairing_dish_id: string | null
  pairing_label: string | null
  master_dish_id: string | null
}

interface SimpleDish { id: string; name: string; category: string }

interface Props {
  restaurantId: string
  menuId: string
  initialDishes: Dish[]
  allDishes: SimpleDish[]
}

export default function DishList({ restaurantId, menuId, initialDishes, allDishes }: Props) {
  const [dishes, setDishes]           = useState(initialDishes)
  const [formOpen, setFormOpen]       = useState(false)
  const [editingDish, setEditingDish] = useState<Dish | null>(null)
  const [syncDish, setSyncDish]       = useState<Dish | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)

  const categories = Array.from(new Set(dishes.map(d => d.category ?? 'Senza categoria'))).sort()
  const byCategory = Object.fromEntries(
    categories.map(cat => [cat, dishes.filter(d => (d.category ?? 'Senza categoria') === cat)])
  )

  async function handleDelete(dish: Dish) {
    if (!confirm(`Eliminare "${dish.name}"?`)) return
    setDeletingId(dish.id)
    try {
      await deleteDish(restaurantId, menuId, dish.id)
      setDishes(prev => prev.filter(d => d.id !== dish.id))
    } catch { alert("Errore durante l'eliminazione.") }
    finally { setDeletingId(null) }
  }

  function handleSaved(saved: any, isNew: boolean) {
    setDishes(prev =>
      isNew ? [...prev, saved] : prev.map(d => d.id === saved.id ? saved : d)
    )
    setFormOpen(false)
    setEditingDish(null)
    // After saving, if dish has master_dish_id offer sync
    if (!isNew && saved.master_dish_id) setSyncDish(saved)
  }

  return (
    <div>
      <div className="mb-5">
        <button
          onClick={() => { setEditingDish(null); setFormOpen(true) }}
          className="bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 transition-colors"
        >
          + Aggiungi piatto
        </button>
      </div>

      {(formOpen || editingDish) && (
        <DishForm
          restaurantId={restaurantId}
          menuId={menuId}
          dish={editingDish}
          allDishes={allDishes}
          onSaved={handleSaved}
          onClose={() => { setFormOpen(false); setEditingDish(null) }}
        />
      )}

      {syncDish && (
        <DishSyncModal
          restaurantId={restaurantId}
          dish={syncDish}
          onClose={() => setSyncDish(null)}
        />
      )}

      {dishes.length === 0 ? (
        <div className="bg-white border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-500">Nessun piatto. Clicca &ldquo;Aggiungi piatto&rdquo; per iniziare.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {categories.map(cat => (
            <div key={cat} className="bg-white border border-gray-200">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">{cat}</span>
                <span className="text-xs text-gray-400">({byCategory[cat].length})</span>
              </div>
              <table className="w-full">
                <tbody className="divide-y divide-gray-50">
                  {byCategory[cat].map(dish => (
                    <tr key={dish.id} className={`hover:bg-gray-50 ${!dish.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{dish.name}</div>
                        {dish.description && (
                          <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{dish.description}</div>
                        )}
                        {dish.allergens?.length > 0 && (
                          <div className="text-[10px] text-orange-500 mt-0.5">
                            {dish.allergens.map(a => `${a}. ${allergenName(a)}`).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap text-right">
                        {dish.price != null ? `€ ${Number(dish.price).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => { setEditingDish(dish); setFormOpen(false) }}
                          className="text-xs text-blue-600 hover:underline mr-3"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => handleDelete(dish)}
                          disabled={deletingId === dish.id}
                          className="text-xs text-red-500 hover:underline disabled:opacity-40"
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
