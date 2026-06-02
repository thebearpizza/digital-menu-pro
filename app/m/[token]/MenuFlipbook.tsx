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
  const bookRef = useRef<any>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)

  const categories = Array.from(new Set(items.map(i => i.category)))
  const catData = categories.map(cat => ({
    name: cat,
    items: items.filter(i => i.category === cat),
  }))

  const totalPages = 2 + catData.length * 2 + 2
  const hasInfo = !!(infoContent || infoTitle)

  // ── Flip helpers ───────────────────────────────────────────────────────────
  // lastFlipMs gates our custom swipe handler; stfIsFlipping tracks when
  // StPageFlip itself is mid-animation (corner drag or programmatic flip).
  // The two together prevent any double-flip scenario.
  const lastFlipMs    = useRef(0)
  const stfIsFlipping = useRef(false)

  const goNext = useCallback(() => {
    const now = Date.now()
    if (now - lastFlipMs.current < 500) return
    lastFlipMs.current = now
    bookRef.current?.pageFlip()?.flipNext()
  }, [])

  const goPrev = useCallback(() => {
    const now = Date.now()
    if (now - lastFlipMs.current < 500) return
    lastFlipMs.current = now
    bookRef.current?.pageFlip()?.flipPrev()
  }, [])

  // ── Full-width swipe detection ─────────────────────────────────────────────
  // StPageFlip's drag-to-flip only triggers near corners. These handlers catch
  // any horizontal swipe on the whole book surface.
  //
  // Strategy: fire on onTouchMove (early, at ~20 px) rather than waiting for
  // the finger to lift — this makes the response feel instant, not "rigid".
  // swipeHandled prevents move + end both triggering on the same gesture.
  // When StPageFlip is already handling a corner drag (stfIsFlipping = true)
  // we skip entirely so we never fight its animation.
  const swipeSX      = useRef(0)
  const swipeSY      = useRef(0)
  const swipeHandled = useRef(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    swipeSX.current      = e.touches[0].clientX
    swipeSY.current      = e.touches[0].clientY
    swipeHandled.current = false
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (swipeHandled.current || stfIsFlipping.current) return
    const dx  = e.touches[0].clientX - swipeSX.current
    const adx = Math.abs(dx)
    const ady = Math.abs(e.touches[0].clientY - swipeSY.current)
    // 20 px horizontal, clearly more H than V → fire immediately
    if (adx < 20 || ady > adx) return
    swipeHandled.current = true
    if (dx < 0) goNext(); else goPrev()
  }, [goNext, goPrev])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    // Fallback for slow / short gestures that didn't cross 20 px during move
    if (swipeHandled.current || stfIsFlipping.current) return
    const dx  = e.changedTouches[0].clientX - swipeSX.current
    const adx = Math.abs(dx)
    const ady = Math.abs(e.changedTouches[0].clientY - swipeSY.current)
    if (adx < 30 || ady > adx) return
    if (dx < 0) goNext(); else goPrev()
  }, [goNext, goPrev])

  // ── Body scroll-lock ───────────────────────────────────────────────────────
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

  // ── Viewport-aware sizing ──────────────────────────────────────────────────
  useEffect(() => {
    const RATIO = 360 / 520
    const calc = () => {
      const vw = Math.min(window.innerWidth, 460)
      const vh = window.innerHeight
      const availW = vw - 24       // side padding
      const availH = vh - 120      // header + indicator chrome
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

  // ── Keyboard navigation ────────────────────────────────────────────────────
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
    // Outer shell: overflow locked, NO touch-none here — it would prevent
    // StPageFlip's own touch listeners from receiving events.
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

      {/* ── Flipbook area ──────────────────────────────────────────────────── */}
      {/* This div is `relative` so nav buttons can be positioned here as
          SIBLINGS of the flipbook div (not inside it). Being siblings means
          StPageFlip's internal event handlers cannot intercept their taps. */}
      <div className="flex-1 w-full flex items-center justify-center min-h-0 relative">
        {dims && (
          <>
            {/* Flipbook wrapper: touch-action:none here (not on the whole page)
                so the browser doesn't scroll while the user drags pages.
                The custom swipe handler also lives here for full-width coverage. */}
            <div
              style={{ width: dims.w, height: dims.h, touchAction: 'pan-y' }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <HTMLFlipBook
                ref={bookRef}
                width={dims.w}
                height={dims.h}
                size="fixed"
                drawShadow
                flippingTime={600}
                usePortrait
                startZIndex={10}
                maxShadowOpacity={0.5}
                showCover={false}
                mobileScrollSupport={false}
                clickEventForward
                useMouseEvents
                swipeDistance={10}
                showPageCorners
                disableFlipByClick
                onChangeState={(e: any) => {
                  stfIsFlipping.current = e.data !== 'read'
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
                  /* Left: category title */
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

                  /* Right: dish list — no scroll, text truncated per spec */
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

            {/* ── Bottom-center navigation bar ────────────────────────────────
                Sibling of the flipbook div (never inside it) → StPageFlip's
                handlers cannot intercept taps here.
                onPointerUp + touch-action:manipulation = zero tap delay on iOS.
                The bar merges prev / counter / next in one centred row so the
                user has a clear, always-visible target at the bottom. */}
            <div
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-5"
              style={{ touchAction: 'manipulation' }}
            >
              <button
                type="button"
                onPointerUp={(e) => { e.stopPropagation(); goPrev() }}
                disabled={atStart}
                aria-label="Pagina precedente"
                className="text-[11px] uppercase tracking-[0.18em] text-zinc-400 hover:text-zinc-200 disabled:opacity-0 cursor-pointer px-2 py-2 transition-colors"
              >
                ‹ prec.
              </button>

              <span className="text-[9px] text-zinc-600 tabular-nums select-none">
                {currentPage + 1} / {totalPages}
              </span>

              <button
                type="button"
                onPointerUp={(e) => { e.stopPropagation(); goNext() }}
                disabled={atEnd}
                aria-label="Pagina successiva"
                className="text-[11px] uppercase tracking-[0.18em] text-zinc-400 hover:text-zinc-200 disabled:opacity-0 cursor-pointer px-2 py-2 transition-colors"
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
