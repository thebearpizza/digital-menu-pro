'use client'

import { useState } from 'react'
import { moveCategoryToMenu } from './actions'

interface SimpleMenu { id: string; name: string }

interface Props {
  restaurantId: string
  fromMenuId: string
  category: string
  dishCount: number
  menus: SimpleMenu[]
  onMoved: (category: string) => void
  onClose: () => void
}

export default function MoveCategoryModal({
  restaurantId, fromMenuId, category, dishCount, menus, onMoved, onClose,
}: Props) {
  const [target, setTarget] = useState('')
  const [moving, setMoving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const otherMenus = menus.filter(m => m.id !== fromMenuId)

  async function handleMove() {
    if (!target) return
    setMoving(true); setError(null)
    try {
      await moveCategoryToMenu(restaurantId, fromMenuId, category, target)
      onMoved(category)
    } catch (err: any) {
      setError(err.message ?? 'Errore. Riprova.')
      setMoving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 shadow-xl w-full max-w-sm z-10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Sposta categoria</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Sposta <strong>{category}</strong> ({dishCount} {dishCount === 1 ? 'piatto' : 'piatti'}) in un
          altro menu. I piatti verranno rimossi da questo menu.
        </p>

        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs">{error}</div>
        )}

        {otherMenus.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4">Non ci sono altri menu disponibili.</p>
        ) : (
          <div className="space-y-2 mb-5">
            {otherMenus.map(m => (
              <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="target-menu-cat"
                  value={m.id}
                  checked={target === m.id}
                  onChange={() => setTarget(m.id)}
                  className="accent-blue-600"
                />
                {m.name}
              </label>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleMove}
            disabled={moving || !target}
            className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {moving ? 'Spostamento…' : 'Sposta'}
          </button>
          <button onClick={onClose}
            className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors">
            Annulla
          </button>
        </div>
      </div>
    </div>
  )
}
