'use client'

import { useEffect } from 'react'

interface MenuItem {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string
  photo_url: string | null
}

export default function DishModal({
  item,
  onClose,
}: {
  item: MenuItem
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 modal-backdrop"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative bg-white w-full sm:max-w-md sm:shadow-2xl modal-card max-h-[90vh] overflow-y-auto">
        {/* Photo */}
        {item.photo_url && (
          <div className="relative h-52 overflow-hidden bg-stone-100">
            <img
              src={item.photo_url}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center bg-black/30 text-white text-xl leading-none hover:bg-black/50 transition-colors"
        >
          &times;
        </button>

        {/* Content */}
        <div className="p-6">
          <div className="text-[10px] uppercase tracking-widest text-stone-400 mb-2">
            {item.category}
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold text-stone-900">{item.name}</h2>
            {item.price != null && (
              <span className="text-xl font-semibold text-stone-700 shrink-0 tabular-nums">
                &euro;&nbsp;{Number(item.price).toFixed(2)}
              </span>
            )}
          </div>
          {item.description && (
            <p className="mt-3 text-sm text-stone-600 leading-relaxed">{item.description}</p>
          )}
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm font-medium text-stone-600 border border-stone-300 hover:bg-stone-50 transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}
