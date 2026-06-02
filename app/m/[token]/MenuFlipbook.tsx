'use client'

import { useEffect, useRef, useState, useCallback, memo } from 'react'
import DishModal from './DishModal'

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
  menuName: string
  restaurantName: string
  items: Dish[]
  pdfUrl?: string | null   // reserved for future PDF-based rendering
  infoTitle?: string | null
  infoContent?: string | null
  onBack: () => void
}

declare global {
  interface Window { jQuery: any; $: any }
}

// ── Script loader (deduped) ───────────────────────────────────────────────────
const _loaded = new Set<string>()
function requireScript(src: string): Promise<void> {
  if (_loaded.has(src)) return Promise.resolve()
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { _loaded.add(src); res(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload  = () => { _loaded.add(src); res() }
    s.onerror = () => rej(new Error(`Script load failed: ${src}`))
    document.head.appendChild(s)
  })
}

// ── Static page block ─────────────────────────────────────────────────────────
// turn.js restructures the DOM after initialisation — it wraps, moves and
// absolutely-positions every child element.  React must never diff those nodes
// again or it will fight the library and corrupt the layout.
//
// Solution: memo(() => true) is a permanent bail-out from re-rendering.
// The outer component uses `key` to remount this component whenever dims change,
// which is the only time a fresh turn.js init is needed.
interface BookProps {
  dims:           { w: number; h: number }
  catData:        { name: string; items: Dish[] }[]
  restaurantName: string
  menuName:       string
  hasInfo:        boolean
  infoTitle?:     string | null
  infoContent?:   string | null
  onDishClick:    (dish: Dish) => void
}

const TurnBook = memo(function TurnBook({
  dims, catData, restaurantName, menuName, hasInfo, infoTitle, infoContent, onDishClick,
}: BookProps) {
  const bookRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true

    requireScript('https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js')
      .then(() => requireScript('https://cdn.jsdelivr.net/npm/turn.js/turn.min.js'))
      .then(() => {
        const el = bookRef.current
        if (!alive || !el || !window.jQuery?.fn?.turn) return
        window.$(el).turn({
          width:        dims.w,
          height:       dims.h,
          autoCenter:   false,   // outer flex already centres the book
          display:      'single',
          duration:     800,
          gradients:    true,
          acceleration: true,
        })
        console.log('[MenuFlipbook] turn.js ready', dims)
      })
      .catch(err => console.error('[MenuFlipbook]', err))

    return () => {
      alive = false
      const el = bookRef.current
      if (el && window.$?.fn?.turn) {
        try { window.$(el).turn('destroy') } catch (_) {}
      }
    }
  }, []) // intentionally empty — one init per mount; key drives remount on resize

  const p = 'overflow-hidden'  // every page needs overflow:hidden for turn.js

  return (
    <div ref={bookRef} style={{ width: dims.w, height: dims.h }}>

      {/* 0 ── cover left */}
      <div className={`${p} bg-zinc-800 w-full h-full flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-px h-16 bg-zinc-600 mx-auto mb-4" />
          <p className="text-[9px] uppercase tracking-[0.35em] text-zinc-500">benvenuto</p>
          <div className="w-px h-16 bg-zinc-600 mx-auto mt-4" />
        </div>
      </div>

      {/* 1 ── cover right */}
      <div className={`${p} bg-stone-50 w-full h-full flex flex-col items-center justify-center p-10 text-center`}>
        <div className="text-[10px] uppercase tracking-[0.3em] text-stone-400 mb-3">il nostro menu</div>
        <h1 className="text-2xl font-light text-stone-800 leading-snug">{restaurantName}</h1>
        {menuName !== restaurantName && (
          <p className="mt-2 text-sm text-stone-400 italic">{menuName}</p>
        )}
        {catData.length > 0 && (
          <p className="mt-8 text-xs text-stone-400">
            {catData.length} {catData.length === 1 ? 'categoria' : 'categorie'}
            &nbsp;·&nbsp;sfoglia per scoprire
          </p>
        )}
        <div className="mt-4 text-[9px] font-mono text-stone-300">1</div>
      </div>

      {/* category page pairs */}
      {catData.flatMap((cat, i) => [

        /* category left — title */
        <div
          key={`cl-${cat.name}`}
          className={`${p} w-full h-full flex flex-col`}
          style={{ background: 'linear-gradient(160deg,#18181b 0%,#27272a 100%)' }}
        >
          <div className="flex-1 flex flex-col items-center justify-center px-10 text-center">
            <div className="w-8 h-px bg-zinc-500 mx-auto mb-6" />
            <h2 className="text-xl font-light uppercase tracking-[0.18em] text-white">{cat.name}</h2>
            <p className="mt-3 text-xs text-zinc-500">{cat.items.length} piatti</p>
            <div className="w-8 h-px bg-zinc-500 mx-auto mt-6" />
          </div>
          <div className="pb-3 pr-4 text-[9px] font-mono text-zinc-600 self-end">{(i + 1) * 2}</div>
        </div>,

        /* category right — dish list */
        <div key={`cr-${cat.name}`} className={`${p} bg-stone-50 w-full h-full flex flex-col`}>
          <div className="px-5 pt-4 pb-2 border-b border-stone-200 shrink-0">
            <h3 className="text-sm font-light uppercase tracking-widest text-stone-600 truncate">{cat.name}</h3>
          </div>
          <ul className="flex-1 overflow-hidden divide-y divide-stone-100 px-5 py-1.5">
            {cat.items.map(dish => (
              <li key={dish.id}>
                <button
                  type="button"
                  onClick={() => onDishClick(dish)}
                  className="w-full text-left py-2.5 group cursor-pointer"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium text-stone-800 group-hover:text-stone-500 group-hover:underline underline-offset-2 transition-colors leading-snug line-clamp-1">
                      {dish.name}
                    </span>
                    {dish.price != null && (
                      <span className="text-[12px] text-stone-500 shrink-0 tabular-nums whitespace-nowrap">
                        €&nbsp;{Number(dish.price).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {dish.description && (
                    <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-1 text-left leading-snug">
                      {dish.description}
                    </p>
                  )}
                  {dish.allergens?.length > 0 && (
                    <span className="text-[9px] text-stone-300 tabular-nums">
                      [{dish.allergens.join(', ')}]
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="px-5 py-1.5 border-t border-stone-200 text-right shrink-0">
            <span className="text-[9px] font-mono text-stone-400">{(i + 1) * 2 + 1}</span>
          </div>
        </div>,
      ])}

      {/* back left ── info */}
      <div className={`${p} bg-stone-100 w-full h-full flex flex-col items-center justify-center p-8 text-center`}>
        {hasInfo ? (
          <>
            <div className="w-6 h-px bg-stone-400 mb-4" />
            <h3 className="text-sm font-semibold uppercase tracking-widest text-stone-700 mb-3">
              {infoTitle ?? 'Informazioni'}
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line max-w-xs overflow-hidden">
              {infoContent}
            </p>
            <div className="w-6 h-px bg-stone-400 mt-4" />
          </>
        ) : (
          <div className="text-xs text-stone-400">—</div>
        )}
      </div>

      {/* back right ── thank you */}
      <div className={`${p} bg-zinc-800 w-full h-full flex flex-col items-center justify-center p-10 text-center`}>
        <div className="w-px h-12 bg-zinc-600 mx-auto mb-4" />
        <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">grazie</p>
        <h2 className="text-xl font-light text-white mt-3">{restaurantName}</h2>
        <div className="w-px h-12 bg-zinc-600 mx-auto mt-4" />
      </div>

    </div>
  )
}, () => true) // permanent bail — turn.js owns this DOM subtree after init


// ── Public component ──────────────────────────────────────────────────────────
export default function MenuFlipbook({
  menuName, restaurantName, items, infoTitle, infoContent, onBack,
}: Props) {
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)
  const [dims, setDims]                 = useState<{ w: number; h: number } | null>(null)

  const catData = Array.from(new Set(items.map(i => i.category))).map(cat => ({
    name:  cat,
    items: items.filter(i => i.category === cat),
  }))
  const hasInfo = !!(infoContent || infoTitle)

  const handleDishClick = useCallback((dish: Dish) => setSelectedDish(dish), [])

  // body scroll-lock
  useEffect(() => {
    document.documentElement.classList.add('menu-locked')
    document.body.classList.add('menu-locked')
    return () => {
      document.documentElement.classList.remove('menu-locked')
      document.body.classList.remove('menu-locked')
    }
  }, [])

  // viewport-aware sizing — same aspect ratio as before
  useEffect(() => {
    const RATIO = 360 / 520
    const calc = () => {
      const vw = Math.min(window.innerWidth, 460), vh = window.innerHeight
      const availW = vw - 24, availH = vh - 120
      let w = availW, h = w / RATIO
      if (h > availH) { h = availH; w = h * RATIO }
      setDims({ w: Math.max(240, Math.round(w)), h: Math.max(340, Math.round(h)) })
    }
    calc()
    window.addEventListener('resize', calc)
    window.addEventListener('orientationchange', calc)
    return () => {
      window.removeEventListener('resize', calc)
      window.removeEventListener('orientationchange', calc)
    }
  }, [])

  return (
    <div className="fixed inset-0 h-[100dvh] bg-zinc-900 flex flex-col items-center overflow-hidden select-none">

      {/* header */}
      <div className="shrink-0 flex items-center gap-4 w-full max-w-4xl px-4 py-3">
        <button onClick={onBack} className="text-xs text-zinc-400 hover:text-white transition-colors">
          ← Torna
        </button>
        <div className="flex-1 text-center min-w-0">
          <p className="text-sm font-light text-white tracking-wide truncate">{restaurantName}</p>
          {menuName !== restaurantName && (
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{menuName}</p>
          )}
        </div>
        <div className="w-10 shrink-0" />
      </div>

      {/* book area */}
      <div className="flex-1 w-full flex items-center justify-center min-h-0">
        {dims && (
          <div style={{ position: 'relative', width: dims.w, height: dims.h }}>

            {/* key forces a clean remount — and therefore a fresh turn.js init —
                whenever the viewport dimensions change.                           */}
            <TurnBook
              key={`book-${dims.w}-${dims.h}`}
              dims={dims}
              catData={catData}
              restaurantName={restaurantName}
              menuName={menuName}
              hasInfo={hasInfo}
              infoTitle={infoTitle}
              infoContent={infoContent}
              onDishClick={handleDishClick}
            />

            {/* visual nav hints — turn.js handles tapping the page corners natively */}
            {!selectedDish && (
              <>
                <span className="pointer-events-none absolute bottom-4 left-3 z-10 text-[11px] uppercase tracking-[0.18em] text-zinc-500 select-none">
                  ‹ prec.
                </span>
                <span className="pointer-events-none absolute bottom-4 right-3 z-10 text-[11px] uppercase tracking-[0.18em] text-zinc-500 select-none">
                  succ. ›
                </span>
              </>
            )}

          </div>
        )}
      </div>

      {selectedDish && (
        <DishModal
          item={selectedDish}
          allDishes={items}
          onClose={() => setSelectedDish(null)}
          onOpenDish={dish => setSelectedDish(dish)}
        />
      )}
    </div>
  )
}
