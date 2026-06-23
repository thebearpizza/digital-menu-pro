'use client'

import { useState } from 'react'
import { moveDishToMenu, getMenuCategoriesForMove } from './actions'
import { Spinner } from '@/components/ui/Spinner'

interface SimpleMenu { id: string; name: string }

interface Props {
  restaurantId: string
  fromMenuId: string
  dishId: string
  dishName: string
  dishCategory: string | null
  menus: SimpleMenu[]
  onMoved: (dishId: string) => void
  onClose: () => void
}

export default function MoveDishModal({
  restaurantId, fromMenuId, dishId, dishName, dishCategory, menus, onMoved, onClose,
}: Props) {
  const [step,           setStep]          = useState<1 | 2>(1)
  const [targetMenuId,   setTargetMenuId]  = useState('')
  const [targetCategory, setTargetCategory] = useState('')
  const [existingCats,   setExistingCats]  = useState<string[]>([])
  const [loadingCats,    setLoadingCats]   = useState(false)
  const [moving,         setMoving]        = useState(false)
  const [error,          setError]         = useState<string | null>(null)

  const otherMenus    = menus.filter(m => m.id !== fromMenuId)
  const sourceCategory = dishCategory ?? 'Senza categoria'
  const newCatKey      = `__new__${sourceCategory}`

  async function proceedToStep2() {
    if (!targetMenuId) return
    setLoadingCats(true); setError(null)
    try {
      const cats = await getMenuCategoriesForMove(restaurantId, targetMenuId)
      setExistingCats(cats)
      setTargetCategory(cats.includes(sourceCategory) ? sourceCategory : newCatKey)
      setStep(2)
    } catch {
      setError('Errore nel caricamento delle categorie.')
    } finally {
      setLoadingCats(false)
    }
  }

  async function handleMove() {
    if (!targetMenuId || !targetCategory) return
    const resolved = targetCategory === newCatKey ? sourceCategory : targetCategory
    setMoving(true); setError(null)
    try {
      await moveDishToMenu(restaurantId, fromMenuId, dishId, targetMenuId, resolved)
      onMoved(dishId)
    } catch (err: any) {
      setError(err.message ?? 'Errore. Riprova.')
      setMoving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 shadow-xl w-full max-w-sm z-10 p-6">

        {/* ── Step 1: scegli menu ────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Sposta piatto — scegli menu</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Sposta <strong>{dishName}</strong> in un altro menu.
            </p>
            {error && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs">{error}</div>}
            {otherMenus.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">Non ci sono altri menu disponibili.</p>
            ) : (
              <div className="space-y-2 mb-5">
                {otherMenus.map(m => (
                  <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="target-menu" value={m.id}
                      checked={targetMenuId === m.id} onChange={() => setTargetMenuId(m.id)}
                      className="accent-blue-600" />
                    {m.name}
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={proceedToStep2} disabled={loadingCats || !targetMenuId}
                className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                {loadingCats ? <Spinner color="#fff" /> : 'Avanti →'}
              </button>
              <button onClick={onClose} className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors">
                Annulla
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: scegli categoria ───────────────────────────────────── */}
        {step === 2 && (
          <>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-gray-900">Sposta piatto — scegli categoria</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              In quale categoria inserire <strong>{dishName}</strong>?
            </p>
            {error && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs">{error}</div>}
            <div className="space-y-2 mb-5 max-h-60 overflow-y-auto">
              {existingCats.map(cat => (
                <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="target-cat" value={cat}
                    checked={targetCategory === cat} onChange={() => setTargetCategory(cat)}
                    className="accent-blue-600" />
                  {cat}
                </label>
              ))}
              <label className={`flex items-center gap-2 text-sm cursor-pointer ${existingCats.length > 0 ? 'border-t border-gray-100 pt-2 mt-1' : ''}`}>
                <input type="radio" name="target-cat" value={newCatKey}
                  checked={targetCategory === newCatKey} onChange={() => setTargetCategory(newCatKey)}
                  className="accent-blue-600" />
                <span className="text-gray-500">
                  Crea nuova: <strong className="text-gray-700">{sourceCategory}</strong>
                </span>
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)}
                className="px-3 py-2 text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors">
                ← Indietro
              </button>
              <button onClick={handleMove} disabled={moving || !targetCategory}
                className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center">
                {moving ? <Spinner color="#fff" /> : 'Sposta'}
              </button>
              <button onClick={onClose} className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors">
                Annulla
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
