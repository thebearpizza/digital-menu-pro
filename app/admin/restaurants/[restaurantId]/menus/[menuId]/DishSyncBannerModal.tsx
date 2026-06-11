'use client'

import { useMemo, useState } from 'react'
import { applyDishSync, DishTwin } from './actions'
import { formatAllergensFull } from '@/lib/allergens'
import { Spinner } from '@/components/ui/Spinner'

interface SourceDish {
  id: string
  name: string
  description: string | null
  price: number | null
  image_url: string | null
  allergens: number[]
  category: string | null
}

interface Props {
  restaurantId: string
  source: SourceDish
  twins: DishTwin[]
  onClose: () => void
}

type FieldKey = 'description' | 'price' | 'image_url' | 'allergens' | 'category'

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'description', label: 'Descrizione' },
  { key: 'price',       label: 'Prezzo' },
  { key: 'image_url',   label: 'Foto' },
  { key: 'allergens',   label: 'Allergeni' },
  { key: 'category',    label: 'Categoria' },
]

function sameAllergens(a: number[] = [], b: number[] = []) {
  const x = [...a].sort((m, n) => m - n)
  const y = [...b].sort((m, n) => m - n)
  return x.length === y.length && x.every((v, i) => v === y[i])
}

function fieldEqual(key: FieldKey, source: SourceDish, twin: DishTwin): boolean {
  if (key === 'allergens') return sameAllergens(source.allergens, twin.allergens)
  if (key === 'price')     return Number(source.price ?? NaN) === Number(twin.price ?? NaN)
    || (source.price == null && twin.price == null)
  return (source[key] ?? '') === (twin[key] ?? '')
}

function preview(key: FieldKey, source: SourceDish): string {
  if (key === 'allergens') return formatAllergensFull(source.allergens) || '— nessuno —'
  if (key === 'price')     return source.price != null ? `€ ${Number(source.price).toFixed(2)}` : '—'
  if (key === 'image_url') return source.image_url ? 'Foto aggiornata' : '— nessuna —'
  const v = source[key]
  return v ? String(v) : '— vuoto —'
}

export default function DishSyncBannerModal({ restaurantId, source, twins, onClose }: Props) {
  // Campi che differiscono in almeno un gemello
  const diffFields = useMemo(
    () => FIELDS.filter(f => twins.some(t => !fieldEqual(f.key, source, t))),
    [source, twins]
  )

  const [selected, setSelected] = useState<Set<FieldKey>>(
    () => new Set(diffFields.filter(f => f.key !== 'category').map(f => f.key))
  )
  const [syncing, setSyncing] = useState(false)
  const [done, setDone]       = useState(false)

  function toggle(key: FieldKey) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleSync() {
    if (selected.size === 0) return
    setSyncing(true)
    try {
      await applyDishSync(restaurantId, source.id, twins.map(t => t.id), Array.from(selected))
      setDone(true)
    } catch (err: any) {
      alert('Errore sincronizzazione: ' + err.message)
    } finally {
      setSyncing(false)
    }
  }

  const menuList = Array.from(new Set(twins.map(t => t.menuName))).join(', ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 shadow-xl w-full max-w-md z-10 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Sincronizza nei menu collegati</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        {done ? (
          <div className="p-6">
            <p className="text-sm text-green-700 mb-4">
              Modifiche propagate a {twins.length} {twins.length === 1 ? 'piatto' : 'piatti'}.
            </p>
            <button onClick={onClose}
              className="w-full py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">
              Chiudi
            </button>
          </div>
        ) : (
          <div className="p-5">
            <p className="text-xs text-gray-500 mb-1">
              <strong>{source.name}</strong> è presente anche in: <span className="text-gray-700">{menuList}</span>.
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Seleziona i campi modificati da propagare anche a quelle copie:
            </p>

            <div className="space-y-2 mb-5">
              {diffFields.map(f => (
                <label key={f.key} className="flex items-start gap-2 text-sm cursor-pointer border border-gray-100 px-3 py-2 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selected.has(f.key)}
                    onChange={() => toggle(f.key)}
                    className="accent-blue-600 mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="font-medium text-gray-800">{f.label}</span>
                    <span className="block text-xs text-gray-400 truncate">{preview(f.key, source)}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSync}
                disabled={syncing || selected.size === 0}
                className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center"
              >
                {syncing ? <Spinner color="#fff" /> : 'Propaga modifiche'}
              </button>
              <button onClick={onClose}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors">
                Non ora
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
