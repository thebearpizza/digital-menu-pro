'use client'
/* eslint-disable @next/next/no-img-element */

import { useMemo, useRef, useState } from 'react'

type Dish = {
  id: string
  name: string
  description: string | null
  price: number | null
  image_url: string | null
  allergens: string[]
  is_available: boolean
  category: string | null
}

type Props = {
  dishes: Dish[]
  menuName: string
  restaurantName: string
}

type PageData = {
  category: string
  dishes: Dish[]
  pageNum: number
  totalPages: number
}

const MAX_PER_PAGE = 8
const SWIPE_THRESHOLD = 10
const DESC_PREVIEW_CHARS = 80

const ALLERGEN_NUM: Record<string, string> = {
  'Glutine': '1', 'Cereali contenenti glutine': '1',
  'Crostacei': '2', 'Uova': '3', 'Pesce': '4',
  'Arachidi': '5', 'Soia': '6', 'Latte': '7', 'Lattosio': '7',
  'Frutta a guscio': '8', 'Noci': '8', 'Mandorle': '8', 'Nocciole': '8',
  'Anacardi': '8', 'Pistacchi': '8', 'Sedano': '9', 'Senape': '10',
  'Semi di sesamo': '11', 'Sesamo': '11',
  'Anidride solforosa': '12', 'Solfiti': '12', 'Lupini': '13', 'Molluschi': '14',
}

function buildPages(dishes: Dish[]): PageData[] {
  const grouped: Record<string, Dish[]> = {}
  dishes.forEach((dish) => {
    const cat = dish.category?.trim() || 'Senza categoria'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(dish)
  })

  const cats = Object.keys(grouped).sort((a, b) =>
    a === 'Senza categoria' ? 1 : b === 'Senza categoria' ? -1 : a.localeCompare(b)
  )

  const pages: PageData[] = []
  cats.forEach((cat) => {
    const items = grouped[cat]
    const tot = Math.ceil(items.length / MAX_PER_PAGE)
    for (let i = 0; i < tot; i++) {
      pages.push({
        category: cat,
        dishes: items.slice(i * MAX_PER_PAGE, (i + 1) * MAX_PER_PAGE),
        pageNum: i + 1,
        totalPages: tot,
      })
    }
  })

  return pages
}

function truncate(text: string | null, max: number) {
  if (!text) return ''
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

function CoverPage({ menuName, restaurantName }: { menuName: string; restaurantName: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-8 gap-4 select-none bg-gradient-to-br from-[#fbf6ed] to-[#f2e8d9] border-l-[3px] border-[#cab69a]/70 shadow-inner">
      <div className="w-12 h-px rounded-full bg-[#7a6348]/60" />
      <h1 className="text-center text-[22px] leading-tight font-semibold text-[#3d2e1a] font-serif">
        {menuName}
      </h1>
      <p className="text-[13px] text-[#8c7355] text-center">{restaurantName}</p>
      <div className="w-12 h-px rounded-full bg-[#7a6348]/60" />
      <div className="absolute bottom-6 flex items-center gap-1.5 text-[11px] tracking-[0.18em] text-[#b8a080]">
        <svg width="12" height="12" viewBox="0 0 24 24" className="stroke-current">
          <path d="M9 5l7 7-7 7" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>SFOGLIA IL MENU</span>
      </div>
    </div>
  )
}

function CategoryPage({ category, dishes, pageNum, totalPages, onSelect }: PageData & { onSelect: (d: Dish) => void }) {
  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-[#fcf9f4] to-[#f7efe4] border-l border-[#bda687]/40 shadow-[inset_0_0_20px_rgba(255,255,255,0.22)] select-none overflow-hidden">
      <div className="px-4 pt-3.5 pb-2.5 border-b border-[#a08256]/30 flex items-baseline justify-between flex-shrink-0">
        <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#8c7355]">
          {category}
        </h2>
        {totalPages > 1 && (
          <span className="text-[9px] text-[#c4b090]">
            {pageNum}/{totalPages}
          </span>
        )}
      </div>

      <div className="flex-1 py-1.5 overflow-hidden">
        {dishes.map((dish, idx) => (
          <button
            key={dish.id}
            onClick={() => dish.is_available && onSelect(dish)}
            className="w-full flex items-start gap-2.5 px-3.5 py-1.5 text-left border-b border-[#a08256]/15 last:border-b-0 bg-transparent"
          >
            {dish.image_url && (
              <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-[#ede6d6]">
                <img src={dish.image_url} alt={dish.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-1.5">
                <span className={`text-[13px] font-semibold leading-tight truncate ${dish.is_available ? 'text-[#3d2e1a]' : 'text-[#c4b090]'}`}>
                  {dish.name}
                </span>
                {dish.price != null && dish.price > 0 && (
                  <span className={`text-[12px] font-semibold flex-shrink-0 ${dish.is_available ? 'text-[#6b5235]' : 'text-[#c4b090]'}`}>
                    €{Number(dish.price).toFixed(2)}
                  </span>
                )}
              </div>

              {dish.description && (
                <p className="mt-0.5 text-[10px] leading-snug text-[#a08060]">
                  {truncate(dish.description, DESC_PREVIEW_CHARS)}
                </p>
              )}

              {dish.allergens?.length > 0 && (
                <p className="mt-0.5 text-[10px] text-[#b8a080] leading-none">
                  {dish.allergens.map(a => ALLERGEN_NUM[a] ?? '?').join(' · ')}
                </p>
              )}

              {!dish.is_available && (
                <span className="mt-0.5 block text-[9px] text-[#c4b090]">Non disponibile</span>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="px-3.5 py-1.5 border-t border-[#a08256]/25 flex justify-end flex-shrink-0">
        <span className="text-[9px] text-[#d4c4a8]">· · ·</span>
      </div>
    </div>
  )
}

function BackPage({ restaurantName }: { restaurantName: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-8 select-none bg-gradient-to-br from-[#f1e9da] to-[#e8dfc8] border-r-[3px] border-[#cab69a]/70 shadow-inner">
      <div className="w-8 h-px rounded-full bg-[#7a6348]/55 mb-4" />
      <p className="text-[13px] text-[#8c7355] text-center font-serif">{restaurantName}</p>
      <p className="mt-1 text-[10px] tracking-[0.18em] uppercase text-[#b8a080]">Grazie per la visita</p>
      <div className="w-8 h-px rounded-full bg-[#7a6348]/55 mt-4" />
    </div>
  )
}

function DishModal({ dish, onClose }: { dish: Dish; onClose: () => void }) {
  if (!dish) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/80 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[85vh] rounded-t-3xl bg-white shadow-2xl flex flex-col"
      >
        <div className="flex justify-center pt-3 pb-1.5">
          <div className="w-10 h-1 rounded-full bg-neutral-300" />
        </div>

        {dish.image_url && (
          <div className="w-full max-h-[42vh] overflow-hidden bg-neutral-100">
            <img
              src={dish.image_url}
              alt={dish.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="px-5 pt-3 pb-4 space-y-2 overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[18px] font-semibold text-neutral-900 leading-snug">
              {dish.name}
            </h3>
            {dish.price != null && dish.price > 0 && (
              <span className="text-[18px] font-semibold text-neutral-900 flex-shrink-0">
                €{Number(dish.price).toFixed(2)}
              </span>
            )}
          </div>

          {!dish.is_available && (
            <span className="inline-block px-3 py-[3px] rounded-full bg-neutral-100 text-[12px] text-neutral-500">
              Non disponibile
            </span>
          )}

          {dish.description && (
            <p className="text-[14px] text-neutral-600 leading-relaxed">
              {dish.description}
            </p>
          )}

          {dish.allergens?.length > 0 && (
            <div className="pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 mb-1.5">
                Allergeni
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dish.allergens.map((a) => (
                  <span
                    key={a}
                    className="px-2 py-[2px] rounded-full bg-neutral-100 text-[12px] text-neutral-600"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MenuViewer3D({ dishes, menuName, restaurantName }: Props) {
  const pages = useMemo(() => buildPages(dishes), [dishes])
  const totalPages = pages.length + 2

  const [currentPage, setCurrentPage] = useState(0)
  const [displayPage, setDisplayPage] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)

  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const categoryPageIndex: Record<string, number> = {}
  pages.forEach((p, i) => {
    if (!(p.category in categoryPageIndex)) categoryPageIndex[p.category] = i + 1
  })
  const categories = Object.keys(categoryPageIndex)

  const clampPage = (p: number) => Math.max(0, Math.min(totalPages - 1, p))

  const changePage = (target: number) => {
    const safe = clampPage(target)
    if (safe === currentPage || isAnimating) return
    setDirection(safe > currentPage ? 'next' : 'prev')
    setDisplayPage(currentPage)
    setIsAnimating(true)
    setTimeout(() => setCurrentPage(safe), 140)
    setTimeout(() => {
      setDisplayPage(safe)
      setIsAnimating(false)
    }, 520)
  }

  const goPrev = () => changePage(currentPage - 1)
  const goNext = () => changePage(currentPage + 1)
  const goToCategory = (target: number) => changePage(target)

  const visiblePage = isAnimating ? displayPage : currentPage

  const currentContent = useMemo(() => {
    if (visiblePage === 0) return <CoverPage menuName={menuName} restaurantName={restaurantName} />
    if (visiblePage === totalPages - 1) return <BackPage restaurantName={restaurantName} />
    return (
      <CategoryPage
        {...pages[visiblePage - 1]}
        onSelect={setSelectedDish}
      />
    )
  }, [visiblePage, menuName, restaurantName, totalPages, pages])

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isAnimating) return
    const t = e.touches[0]
    touchStartX.current = t.clientX
    touchStartY.current = t.clientY
  }

  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isAnimating || touchStartX.current == null || touchStartY.current == null) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStartX.current
    const dy = t.clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD) return
    if (Math.abs(dx) <= Math.abs(dy)) return
    if (dx < 0) goNext()
    else goPrev()
  }

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] bg-[#15100c] overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
      {categories.length > 0 && (
        <div className="flex-shrink-0 pt-2.5 pb-1.5 relative z-20">
          <div className="flex gap-1.5 px-3 overflow-x-auto scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => goToCategory(categoryPageIndex[cat])}
                className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-white/5 text-white/70 border border-white/15 whitespace-nowrap"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex items-center justify-center px-2 pb-1 relative">
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="relative"
          style={{
            width: 'min(94vw, 430px)',
            height: 'min(calc(100dvh - 120px - env(safe-area-inset-bottom,0px)), 78vh)',
            minHeight: 440,
            maxHeight: 760,
            perspective: '2200px',
          }}
        >
          <div
            className="absolute inset-0 rounded-[3px] overflow-hidden"
            style={{
              transformStyle: 'preserve-3d',
              transformOrigin: direction === 'next' ? 'left center' : 'right center',
              transform: isAnimating
                ? direction === 'next'
                  ? 'rotateY(-18deg) translateX(-8px) scale(0.995)'
                  : 'rotateY(18deg) translateX(8px) scale(0.995)'
                : 'rotateY(0deg) translateX(0px) scale(1)',
              transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
              boxShadow: isAnimating
                ? '0 6px 18px rgba(0,0,0,0.55), 0 24px 46px rgba(0,0,0,0.72), 0 40px 82px rgba(0,0,0,0.82)'
                : '0 4px 10px rgba(0,0,0,0.46), 0 18px 38px rgba(0,0,0,0.68), 0 34px 72px rgba(0,0,0,0.80)',
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: isAnimating
                  ? direction === 'next'
                    ? 'linear-gradient(90deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.12) 22%, rgba(0,0,0,0.16) 100%)'
                    : 'linear-gradient(90deg, rgba(0,0,0,0.16) 0%, rgba(255,255,255,0.12) 78%, rgba(255,255,255,0.42) 100%)'
                  : 'linear-gradient(90deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.06) 18%, rgba(0,0,0,0.10) 100%)',
                transition: 'background 520ms ease',
              }}
            />
            <div className="absolute inset-0 bg-[#f8f1e6]">
              {currentContent}
            </div>
          </div>

          <div
            className="absolute left-2 right-2 -bottom-2 rounded-full pointer-events-none"
            style={{
              height: 22,
              background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.16) 56%, rgba(0,0,0,0) 100%)',
              filter: 'blur(7px)',
              transform: isAnimating
                ? direction === 'next'
                  ? 'translateX(-8px) scaleX(0.94)'
                  : 'translateX(8px) scaleX(0.94)'
                : 'translateX(0px) scaleX(1)',
              transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </div>
      </div>

      <div className="flex-shrink-0 flex justify-center pb-[max(6px,env(safe-area-inset-bottom,0px))] bg-[#15100c] relative z-20">
        <div className="inline-flex items-center bg-white/[0.04] border border-white/12 border-t-0 rounded-b-[10px] shadow-[0_6px_24px_rgba(0,0,0,0.6),_inset_0_-1px_0_rgba(245,240,232,0.04)]">
          <button
            onClick={goPrev}
            className="w-[54px] h-10 flex items-center justify-center border-r border-white/10"
            style={{ cursor: currentPage === 0 || isAnimating ? 'default' : 'pointer', opacity: currentPage === 0 ? 0.18 : 0.85 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" className="stroke-white/95">
              <path d="M15 19l-7-7 7-7" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="px-4 h-10 flex items-center pointer-events-none">
            <span className="text-[10px] text-white/40 tracking-[0.18em] font-[450] tabular-nums">
              {currentPage + 1} · {totalPages}
            </span>
          </div>

          <button
            onClick={goNext}
            className="w-[54px] h-10 flex items-center justify-center border-l border-white/10"
            style={{ cursor: currentPage >= totalPages - 1 || isAnimating ? 'default' : 'pointer', opacity: currentPage >= totalPages - 1 ? 0.18 : 0.85 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" className="stroke-white/95">
              <path d="M9 5l7 7-7 7" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {selectedDish && (
        <DishModal dish={selectedDish} onClose={() => setSelectedDish(null)} />
      )}
    </div>
  )
}
