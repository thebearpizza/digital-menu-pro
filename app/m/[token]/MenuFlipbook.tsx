'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import DishModal from './DishModal'

interface MenuItem {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string
  photo_url: string | null
}

interface Props {
  restaurantName: string
  restaurantDescription: string | null
  items: MenuItem[]
}

type Spread =
  | { type: 'cover' }
  | { type: 'category'; name: string; items: MenuItem[] }

type AnimPhase = 'idle' | 'exit-fwd' | 'enter-fwd' | 'exit-bwd' | 'enter-bwd'

export default function MenuFlipbook({ restaurantName, restaurantDescription, items }: Props) {
  const [displayIndex, setDisplayIndex] = useState(0)
  const [targetIndex, setTargetIndex]   = useState(0)
  const [phase, setPhase]               = useState<AnimPhase>('idle')
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)

  // Build spreads: cover + one spread per category
  const categories = Array.from(new Set(items.map(i => i.category)))
  const spreads: Spread[] = [
    { type: 'cover' },
    ...categories.map(cat => ({
      type:  'category' as const,
      name:  cat,
      items: items.filter(i => i.category === cat),
    })),
  ]
  const total = spreads.length

  const navigate = useCallback(
    (dir: 'fwd' | 'bwd') => {
      if (phase !== 'idle') return
      const next = dir === 'fwd' ? displayIndex + 1 : displayIndex - 1
      if (next < 0 || next >= total) return
      setTargetIndex(next)
      setPhase(`exit-${dir}`)
    },
    [phase, displayIndex, total]
  )

  // Animation state machine
  useEffect(() => {
    if (phase === 'idle') return

    if (phase === 'exit-fwd' || phase === 'exit-bwd') {
      const nextPhase: AnimPhase = phase === 'exit-fwd' ? 'enter-fwd' : 'enter-bwd'
      const t = setTimeout(() => {
        setDisplayIndex(targetIndex)
        setPhase(nextPhase)
      }, 200)
      return () => clearTimeout(t)
    }

    if (phase === 'enter-fwd' || phase === 'enter-bwd') {
      const t = setTimeout(() => setPhase('idle'), 300)
      return () => clearTimeout(t)
    }
  }, [phase, targetIndex])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') navigate('fwd')
      if (e.key === 'ArrowLeft'  || e.key === 'PageUp'  ) navigate('bwd')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  // Swipe gesture
  const touchX = useRef(0)
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd   = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 55) navigate(dx < 0 ? 'fwd' : 'bwd')
  }

  const animClass: Record<AnimPhase, string> = {
    'idle':      '',
    'exit-fwd':  'fb-exit-fwd',
    'enter-fwd': 'fb-enter-fwd',
    'exit-bwd':  'fb-exit-bwd',
    'enter-bwd': 'fb-enter-bwd',
  }

  const spread     = spreads[displayIndex]
  const canGoBack  = displayIndex > 0
  const canGoFwd   = displayIndex < total - 1
  const isAnimating = phase !== 'idle'

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center py-8 px-4 select-none">
      {/* Restaurant title */}
      <div className="mb-5 text-center">
        <h1 className="text-base font-semibold text-white tracking-wide">{restaurantName}</h1>
        {displayIndex > 0 && spread.type === 'category' && (
          <p className="text-xs text-zinc-400 mt-1">
            {spread.name}&nbsp;&middot;&nbsp;{displayIndex}&nbsp;/&nbsp;{total - 1}
          </p>
        )}
      </div>

      {/* Book container */}
      <div
        className={`w-full max-w-4xl shadow-2xl ${animClass[phase]}`}
        style={{ minHeight: 480 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="grid md:grid-cols-2">

          {/* ── LEFT PAGE ──────────────────────────────── */}
          {spread.type === 'cover' ? (
            <div
              className="hidden md:flex bg-zinc-800 border-r border-zinc-700 items-center justify-center"
              style={{ minHeight: 480 }}
            >
              <div className="text-center">
                <div className="w-px h-14 bg-zinc-600 mx-auto mb-4" />
                <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">benvenuto</p>
                <div className="w-px h-14 bg-zinc-600 mx-auto mt-4" />
              </div>
            </div>
          ) : (
            <div
              className="hidden md:flex flex-col items-center justify-center border-r border-zinc-700"
              style={{
                minHeight: 480,
                background: 'linear-gradient(160deg, #18181b 0%, #27272a 100%)',
              }}
            >
              <div className="text-center px-10 flex-1 flex flex-col items-center justify-center">
                <div className="w-8 h-px bg-zinc-500 mx-auto mb-6" />
                <h2 className="text-2xl font-light uppercase tracking-[0.18em] text-white">
                  {spread.name}
                </h2>
                <div className="w-8 h-px bg-zinc-500 mx-auto mt-6" />
              </div>
              <div className="pb-4 text-[10px] text-zinc-600 font-mono self-end pr-4">
                {displayIndex * 2 - 1}
              </div>
            </div>
          )}

          {/* ── RIGHT PAGE ─────────────────────────────── */}
          <div className="bg-stone-50 flex flex-col" style={{ minHeight: 480 }}>
            {spread.type === 'cover' ? (
              /* Cover page */
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                <div className="text-[10px] uppercase tracking-[0.28em] text-stone-400 mb-3">
                  il nostro menu
                </div>
                <h2 className="text-2xl font-light text-stone-800">{restaurantName}</h2>
                {restaurantDescription && (
                  <p className="mt-4 text-sm text-stone-500 max-w-xs leading-relaxed">
                    {restaurantDescription}
                  </p>
                )}
                {total > 1 && (
                  <p className="mt-8 text-xs text-stone-400">
                    {total - 1}&nbsp;{total - 1 === 1 ? 'sezione' : 'sezioni'}
                    &nbsp;&middot;&nbsp;usa le frecce per sfogliare
                  </p>
                )}
                {total === 1 && (
                  <p className="mt-8 text-xs text-stone-400">Menu in aggiornamento</p>
                )}
              </div>
            ) : (
              /* Category items page */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile category header */}
                <div className="md:hidden px-6 pt-5 pb-3 border-b border-stone-200">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-0.5">
                    {displayIndex}&nbsp;/&nbsp;{total - 1}
                  </div>
                  <h2 className="text-lg font-light uppercase tracking-widest text-stone-700">
                    {spread.name}
                  </h2>
                </div>

                {/* Items list */}
                <ul className="flex-1 overflow-y-auto divide-y divide-stone-100 px-6 py-2">
                  {spread.items.map((item: MenuItem) => (
                    <li key={item.id}>
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="w-full text-left py-3.5 group"
                      >
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="text-sm font-medium text-stone-800 group-hover:text-stone-500 group-hover:underline underline-offset-2 transition-colors">
                            {item.name}
                          </span>
                          {item.price != null && (
                            <span className="text-sm text-stone-500 shrink-0 whitespace-nowrap tabular-nums">
                              &euro;&nbsp;{Number(item.price).toFixed(2)}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-stone-400 mt-0.5 line-clamp-1 text-left">
                            {item.description}
                          </p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Page number footer */}
            <div className="px-6 py-2 border-t border-stone-200">
              <span className="text-[10px] font-mono text-stone-400 float-right">
                {displayIndex === 0 ? '1' : String(displayIndex * 2)}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-5 mt-6">
        <button
          onClick={() => navigate('bwd')}
          disabled={!canGoBack || isAnimating}
          aria-label="Pagina precedente"
          className="w-9 h-9 flex items-center justify-center text-lg text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 disabled:opacity-20 transition-colors"
        >
          &#8249;
        </button>

        {/* Spread indicators */}
        <div className="flex gap-1.5">
          {spreads.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                if (i === displayIndex || isAnimating) return
                setTargetIndex(i)
                setPhase(i > displayIndex ? 'exit-fwd' : 'exit-bwd')
              }}
              aria-label={`Sezione ${i + 1}`}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === displayIndex ? 'bg-white' : 'bg-zinc-600 hover:bg-zinc-400'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => navigate('fwd')}
          disabled={!canGoFwd || isAnimating}
          aria-label="Pagina successiva"
          className="w-9 h-9 flex items-center justify-center text-lg text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 disabled:opacity-20 transition-colors"
        >
          &#8250;
        </button>
      </div>

      {/* Dish detail modal */}
      {selectedItem && (
        <DishModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  )
}
