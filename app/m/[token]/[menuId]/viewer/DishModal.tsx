'use client'

import { useAtom } from 'jotai'
import { selectedDishAtom, type DishDetail } from './menu-book-state'

const allergenEmoji: Record<string, string> = {
  glutine: '\U0001f33e', lattosio: '\U0001f95b', noci: '\U0001f95c', uova: '\U0001f95a',
  pesce: '\U0001f41f', soia: '\U0001fad8', sedano: '\U0001f96c', senape: '\U0001f33f',
}
const tagColors: Record<string, { bg: string; color: string }> = {
  vegano:          { bg: '#d1fae5', color: '#065f46' },
  vegetariano:     { bg: '#ecfccb', color: '#365314' },
  piccante:        { bg: '#fee2e2', color: '#991b1b' },
  'senza glutine': { bg: '#fef3c7', color: '#92400e' },
  chef:            { bg: '#f3e7d3', color: '#6b3e1a' },
}

export default function DishModal() {
  const [dish, setDish] = useAtom(selectedDishAtom)
  if (!dish) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setDish(null)}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#faf8f3' }} onClick={e => e.stopPropagation()}>
        {dish.image
          ? <img src={dish.image} alt={dish.name} className="w-full h-52 object-cover" />
          : <div className="w-full h-40 flex items-center justify-center text-7xl" style={{ background: 'linear-gradient(135deg,#f3e7d3 0%,#e8d5b7 100%)' }}>\U0001f37d\ufe0f</div>
        }
        <button onClick={() => setDish(null)} className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white font-bold" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }} aria-label="Chiudi">x</button>
        <div className="p-5">
          {dish.tags && dish.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {dish.tags.map(t => {
                const s = tagColors[t] ?? { bg: '#f3f4f6', color: '#374151' }
                return <span key={t} className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>{t === 'chef' ? 'Consiglio dello Chef' : t}</span>
              })}
            </div>
          )}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h2 className="text-xl font-bold leading-tight" style={{ color: '#2a1d16', fontFamily: 'Georgia,serif' }}>{dish.name}</h2>
            {dish.price > 0 && <span className="text-xl font-bold shrink-0" style={{ color: '#8b4513' }}>€ {dish.price.toFixed(2)}</span>}
          </div>
          <p className="text-sm leading-relaxed mb-4" style={{ color: '#5c4a3a' }}>{dish.description}</p>
          {dish.allergens.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9a8472' }}>Allergeni</p>
              <div className="flex flex-wrap gap-2">
                {dish.allergens.map(a => (
                  <span key={a} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: '#f0e8dc', color: '#6b4c2a' }}>
                    <span>{allergenEmoji[a] ?? '!'}</span><span className="capitalize">{a}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : <p className="text-xs" style={{ color: '#7a9a6a' }}>Nessun allergene principale</p>}
        </div>
      </div>
    </div>
  )
}
