'use client'

import { useState } from 'react'
import { syncDishToMasters } from './actions'
import { Spinner } from '@/components/ui/Spinner'

interface Dish {
  id: string
  name: string
  master_dish_id: string | null
}

interface Props {
  restaurantId: string
  dish: Dish
  onClose: () => void
}

const SYNC_FIELDS = [
  { key: 'name',        label: 'Nome' },
  { key: 'description', label: 'Descrizione' },
  { key: 'price',       label: 'Prezzo' },
  { key: 'image_url',   label: 'Foto' },
  { key: 'allergens',   label: 'Allergeni' },
]

export default function DishSyncModal({ restaurantId, dish, onClose }: Props) {
  const [selected, setSelected] = useState<string[]>(['name', 'description', 'price', 'allergens'])
  const [syncing, setSyncing]   = useState(false)
  const [done, setDone]         = useState(false)

  function toggle(key: string) {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  async function handleSync() {
    if (!dish.master_dish_id || selected.length === 0) return
    setSyncing(true)
    try {
      await syncDishToMasters(restaurantId, dish.id, dish.master_dish_id, selected)
      setDone(true)
    } catch (err: any) {
      alert('Errore sincronizzazione: ' + err.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 shadow-xl w-full max-w-sm z-10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Sincronizza duplicati</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        {done ? (
          <div>
            <p className="text-sm text-green-700 mb-4">Sincronizzazione completata.</p>
            <button onClick={onClose}
              className="w-full py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">
              Chiudi
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-4">
              <strong>{dish.name}</strong> è presente in altri menu. Scegli i campi da
              propagare ai duplicati:
            </p>
            <div className="space-y-2 mb-5">
              {SYNC_FIELDS.map(f => (
                <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(f.key)}
                    onChange={() => toggle(f.key)}
                    className="accent-blue-600"
                  />
                  {f.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSync}
                disabled={syncing || selected.length === 0}
                className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center"
              >
                {syncing ? <Spinner color="#fff" /> : 'Sincronizza'}
              </button>
              <button onClick={onClose}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors">
                Salta
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
