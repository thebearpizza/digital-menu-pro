'use client'

import { useEffect } from 'react'
import { allergenName } from '@/lib/allergens'

interface Dish {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string
  image_url: string | null
  allergens: number[]
  pairing_dish_id: string | null
  pairing_label: string | null
}

interface Props {
  item: Dish
  allDishes: Dish[]
  onClose: () => void
  onOpenDish: (dish: Dish) => void
}

export default function DishModal({ item, allDishes, onClose, onOpenDish }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pairing = item.pairing_dish_id
    ? allDishes.find(d => d.id === item.pairing_dish_id)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 modal-backdrop" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md sm:shadow-2xl modal-card max-h-[92vh] overflow-y-auto">

        {item.image_url && (
          <div className="relative h-56 overflow-hidden bg-stone-100">
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          </div>
        )}

        <button onClick={onClose} aria-label="Chiudi"
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center bg-black/30 text-white text-xl leading-none hover:bg-black/50 transition-colors">
          &times;
        </button>

        <div className="p-6">
          <div className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">{item.category}</div>

          <div className="flex items-baseline justify-between gap-4 mb-3">
            <h2 className="text-xl font-semibold text-stone-900">{item.name}</h2>
            {item.price != null && (
              <span className="text-xl font-semibold text-stone-700 shrink-0 tabular-nums">
                &euro;&nbsp;{Number(item.price).toFixed(2)}
              </span>
            )}
          </div>

          {item.description && (
            <p className="text-sm text-stone-600 leading-relaxed mb-4">{item.description}</p>
          )}

          {item.allergens?.length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-100">
              <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1.5">Allergeni</p>
              <ul className="space-y-0.5">
                {item.allergens.map(id => (
                  <li key={id} className="text-xs text-amber-900">
                    <span className="font-mono">{id}.</span> {allergenName(id)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pairing && (
            <div className="border border-stone-200 p-3">
              <p className="text-[10px] uppercase tracking-wider text-stone-400 mb-1.5">
                {item.pairing_label ?? 'Abbinamento consigliato'}
              </p>
              <button
                onClick={() => onOpenDish(pairing)}
                className="text-sm font-medium text-stone-800 hover:text-stone-500 hover:underline transition-colors text-left"
              >
                {pairing.name}
                {pairing.price != null && (
                  <span className="ml-2 text-stone-500 tabular-nums font-normal">
                    €&nbsp;{Number(pairing.price).toFixed(2)}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose}
            className="w-full py-2 text-sm font-medium text-stone-600 border border-stone-300 hover:bg-stone-50 transition-colors">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}
