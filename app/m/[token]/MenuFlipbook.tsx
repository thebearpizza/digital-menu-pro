'use client'

import { useRef, useState, useEffect, forwardRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import DishModal from './DishModal'

const HTMLFlipBook = dynamic(() => import('react-pageflip'), { ssr: false }) as any

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
  infoTitle?: string | null
  infoContent?: string | null
  onBack: () => void
}

const Page = forwardRef<HTMLDivElement, {
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}>(({ children, className = '', style }, ref) => (
  <div
    ref={ref}
    className={`flipbook-page ${className}`}
    style={{ width: '100%', height: '100%', ...style }}
  >
    {children}
  </div>
))
Page.displayName = 'Page'

export default function MenuFlipbook({ menuName, restaurantName, items, infoTitle, infoContent, onBack }: Props) {
  const bookRef    = useRef<any>(null)
  const swipeRef   = useRef<HTMLDivElement>(null)  // target for native touch listeners
  // flipInst holds the native StPageFlip object, populated by onInit.
  // Using a separate ref avoids relying on bookRef.current.pageFlip() which
  // can return null when the dynamic-import component hasn't fully resolved.
  const flipInst   = useRef<any>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)

  const categories = Array.from(new Set(items.map(i => i.category)))
  const catData = categories.map(cat => ({
    name: cat,
    items: items.filter(i => i.category === cat),
  }))

  const totalPages = 2 + catData.length * 2 + 2
  const hasInfo    = !!(infoContent || infoTitle)

  // ── Flip helpers ─────────────────────────────────────────────────────────────
  // 500 ms debounce prevents double-flip when button and swipe both fire for
  // the same gesture (e.g. touch lands on button area while swiping).
  const lastFlipMs = useRef(0)

  const goNext = useCallback(() => {
    const inst = flipInst.current
    if (!inst) {
      console.warn('[Flipbook] goNext: instance not ready yet')
      return
    }
    const now = Date.now()
    if (now - lastFlipMs.current < 500) return
    lastFlipMs.current = now
    console.log('[Flipbook] goNext →', inst)
    inst.flipNext()
  }, [])

  const goPrev = useCallback(() => {
    const inst = flipInst.current
    if (!inst) {
      console.warn('[Flipbook] goPrev: instance not ready yet')
      return
    }
    const now = Date.now()
    if (now - lastFlipMs.current < 500) return
    lastFlipMs.current = now
    console.log('[Flipbook] goPrev →', inst)
    inst.flipPrev()
  }, [])

  // ── Native capture-phase swipe listeners ─────────────────────────────────────
  // WHY NATIVE instead of React synthetic props (onTouchStart / onTouchEnd):
  //   React 18 delegates ALL synthetic events to the document root.
  //   StPageFlip attaches its own native listeners to its internal container.
  //   If StPageFlip calls e.stopPropagation() in the bubble phase, the event
  //   never reaches the document root → React never fires our handlers → swipe
  //   silently broken.
  //
  // WHY CAPTURE PHASE ({ capture: true }):
  //   Capture runs top-down (document → our wrapper → StPageFlip children)
  //   BEFORE any bubble-phase handler. stopPropagation in a child's bubble
  //   handler can never stop a parent's capture listener. We are guaranteed
  //   to see every touch on the book surface.
  //
  // WHY changedTouches[0] in touchend:
  //   At touchend, e.touches[] is already empty (finger is up).
  //   e.changedTouches[] contains the just-lifted touch — always populated.
  useEffect(() => {
    const el = swipeRef.current
    if (!el) return

    let x0 = 0, y0 = 0

    const onStart = (e: TouchEvent) => {
      x0 = e.touches[0].clientX
      y0 = e.touches[0].clientY
    }

    const onEnd = (e: TouchEvent) => {
      const dx  = e.changedTouches[0].clientX - x0   // ← changedTouches, never touches
      const adx = Math.abs(dx)
      const ady = Math.abs(e.changedTouches[0].clientY - y0)
      // > 40 px horizontal, diagonal tolerance ≤ 45°
      if (adx <= 40 || ady > adx) return
      if (dx < 0) goNext(); else goPrev()
    }

    // passive: true → we never call preventDefault, so browser gets the hint early
    // capture: true → fires BEFORE StPageFlip's bubble-phase handlers
    el.addEventListener('touchstart', onStart, { passive: true, capture: true })
    el.addEventListener('touchend',   onEnd,   { passive: true, capture: true })

    return () => {
      el.removeEventListener('touchstart', onStart, { capture: true })
      el.removeEventListener('touchend',   onEnd,   { capture: true })
    }
  }, [goNext, goPrev]) // goNext / goPrev are stable (useCallback [])

  // ── Body scroll-lock ─────────────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    root.classList.add('menu-locked')
    body.classList.add('menu-locked')
    return () => {
      root.classList.remove('menu-locked')
      body.classList.remove('menu-locked')
    }
  }, [])

  // ── Viewport-aware sizing ─────────────────────────────────────────────────────
  useEffect(() => {
    const RATIO = 360 / 520
    const calc = () => {
      const vw = Math.min(window.innerWidth, 460)
      const vh = window.innerHeight
      const availW = vw - 24
      const availH = vh - 120
      let w = availW
      let h = w / RATIO
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

  // ── Keyboard navigation ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goNext()
      if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   goPrev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev])

  const atStart = currentPage === 0
  const atEnd   = currentPage >= totalPages - 1

  return (
    <div className="fixed inset-0 h-[100dvh] bg-zinc-900 flex flex-col items-center overflow-hidden select-none">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
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

      {/* ── Flipbook area ───────────────────────────────────────────────────────
          DOM order:
            [1] swipeRef div  — receives native touch listeners, contains flipbook
            [2] nav bar div   — DOM-sibling of [1], z-[100], pointer-events:auto
          Being a sibling (not a child) of [1], the nav bar is never inside
          StPageFlip's event subtree. Its onClick handlers can never be
          intercepted by the library's internal touch machinery. */}
      <div className="flex-1 w-full flex items-center justify-center min-h-0 relative">
        {dims && (
          <>
            {/* [1] Swipe surface ───────────────────────────────────────────── */}
            {/* touch-action:none → browser never treats horizontal movement
                as a scroll candidate, so touchend always fires even on a fast
                flick. Native listeners attached via useEffect above. */}
            <div
              ref={swipeRef}
              style={{ width: dims.w, height: dims.h, touchAction: 'none' }}
            >
              <HTMLFlipBook
                ref={bookRef}
                width={dims.w}
                height={dims.h}
                size="fixed"
                drawShadow
                flippingTime={550}
                usePortrait
                startZIndex={10}
                maxShadowOpacity={0.45}
                showCover={false}
                mobileScrollSupport={false}
                clickEventForward
                useMouseEvents={false}
                swipeDistance={9999}
                showPageCorners={false}
                disableFlipByClick
                onInit={(e: any) => {
                  // e.object is the native StPageFlip instance — capture it here
                  // rather than relying on bookRef.current.pageFlip() which is
                  // a React-component bridge that may not be ready on first render.
                  flipInst.current = e.object
                  console.log('[Flipbook] onInit — instance ready:', e.object)
                }}
                onFlip={(e: any) => {
                  setCurrentPage(e.data)
                  lastFlipMs.current = Date.now()
                }}
              >
                {/* Page 0: Cover left */}
                <Page className="bg-zinc-800 border-r border-zinc-700 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-px h-16 bg-zinc-600 mx-auto mb-4" />
                    <p className="text-[9px] uppercase tracking-[0.35em] text-zinc-500">benvenuto</p>
                    <div className="w-px h-16 bg-zinc-600 mx-auto mt-4" />
                  </div>
                </Page>

                {/* Page 1: Cover right */}
                <Page className="bg-stone-50 flex flex-col items-center justify-center p-10 text-center">
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
                </Page>

                {/* Category page pairs */}
                {catData.flatMap((cat, i) => [
                  <Page
                    key={`cl-${cat.name}`}
                    className="flex flex-col border-r border-zinc-700"
                    style={{ background: 'linear-gradient(160deg,#18181b 0%,#27272a 100%)' }}
                  >
                    <div className="flex-1 flex flex-col items-center justify-center px-10 text-center">
                      <div className="w-8 h-px bg-zinc-500 mx-auto mb-6" />
                      <h2 className="text-xl font-light uppercase tracking-[0.18em] text-white">{cat.name}</h2>
                      <p className="mt-3 text-xs text-zinc-500">{cat.items.length} piatti</p>
                      <div className="w-8 h-px bg-zinc-500 mx-auto mt-6" />
                    </div>
                    <div className="pb-3 pr-4 text-[9px] font-mono text-zinc-600 self-end">{(i + 1) * 2}</div>
                  </Page>,

                  <Page key={`cr-${cat.name}`} className="bg-stone-50 flex flex-col">
                    <div className="px-5 pt-4 pb-2 border-b border-stone-200 shrink-0">
                      <h3 className="text-sm font-light uppercase tracking-widest text-stone-600 truncate">{cat.name}</h3>
                    </div>
                    <ul className="flex-1 overflow-hidden divide-y divide-stone-100 px-5 py-1.5">
                      {cat.items.map(dish => (
                        <li key={dish.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedDish(dish)}
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
                  </Page>,
                ])}

                {/* Back left: Info */}
                <Page className="bg-stone-100 flex flex-col items-center justify-center p-8 text-center">
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
                </Page>

                {/* Back right: Thank you */}
                <Page className="bg-zinc-800 flex flex-col items-center justify-center p-10 text-center">
                  <div className="w-px h-12 bg-zinc-600 mx-auto mb-4" />
                  <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">grazie</p>
                  <h2 className="text-xl font-light text-white mt-3">{restaurantName}</h2>
                  <div className="w-px h-12 bg-zinc-600 mx-auto mt-4" />
                </Page>
              </HTMLFlipBook>
            </div>

            {/* [2] Navigation bar ──────────────────────────────────────────────
                DOM sibling of [1] — physically AFTER the flipbook in the tree.
                z-[100] beats StPageFlip's startZIndex=10 by a wide margin.
                pointerEvents:'auto' is explicit: no ancestor can shadow it.
                touch-action:manipulation removes the 300 ms iOS tap delay.
                onClick (not onPointerUp) is used: the browser issues a click
                only when the finger stays still (tap), never on a swipe —
                so swiping through this area can never accidentally flip twice. */}
            <div
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-5"
              style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}
            >
              <button
                type="button"
                onClick={() => goPrev()}
                disabled={atStart}
                aria-label="Pagina precedente"
                className="px-3 py-3 text-[11px] uppercase tracking-[0.18em] text-zinc-400 hover:text-zinc-200 disabled:opacity-0 disabled:pointer-events-none cursor-pointer transition-colors"
              >
                ‹ prec.
              </button>

              <span className="text-[9px] text-zinc-600 tabular-nums select-none pointer-events-none">
                {currentPage + 1} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => goNext()}
                disabled={atEnd}
                aria-label="Pagina successiva"
                className="px-3 py-3 text-[11px] uppercase tracking-[0.18em] text-zinc-400 hover:text-zinc-200 disabled:opacity-0 disabled:pointer-events-none cursor-pointer transition-colors"
              >
                succ. ›
              </button>
            </div>
          </>
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
