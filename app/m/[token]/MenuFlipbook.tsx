'use client'

import { useRef, useState, forwardRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import DishModal from './DishModal'
import { allergenName } from '@/lib/allergens'

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
    className={`flipbook-page overflow-hidden ${className}`}
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

  const categories = Array.from(new Set(items.map(i => i.category)))
  const catData = categories.map(cat => ({
    name: cat,
    items: items.filter(i => i.category === cat),
  }))

  const totalPages = 2 + catData.length * 2 + 2
  const hasInfo = !!(infoContent || infoTitle)

  const goNext = useCallback(() => bookRef.current?.pageFlip()?.flipNext(), [])
  const goPrev = useCallback(() => bookRef.current?.pageFlip()?.flipPrev(), [])

  // Keyboard navigation
  useState(() => {
    if (typeof window === 'undefined') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goNext()
      if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   goPrev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center py-6 px-2 select-none">
      {/* Header */}
      <div className="flex items-center gap-4 mb-5 w-full max-w-4xl px-4">
        <button onClick={onBack} className="text-xs text-zinc-400 hover:text-white transition-colors">
          ← Torna
        </button>
        <div className="flex-1 text-center">
          <p className="text-base font-light text-white tracking-wide">{restaurantName}</p>
          {menuName !== restaurantName && (
            <p className="text-xs text-zinc-500 mt-0.5">{menuName}</p>
          )}
        </div>
        <div className="w-10" />
      </div>

      {/* Flipbook */}
      <div className="w-full flex justify-center">
        <HTMLFlipBook
          ref={bookRef}
          width={360}
          height={520}
          size="fixed"
          drawShadow
          flippingTime={700}
          usePortrait
          maxShadowOpacity={0.4}
          showCover={false}
          mobileScrollSupport={false}
          clickEventForward
          useMouseEvents
          swipeDistance={40}
          showPageCorners
          disableFlipByClick={false}
          onFlip={(e: any) => setCurrentPage(e.data)}
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
                &nbsp;·&nbsp;frecce per sfogliare
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

            /* Right: dish list */
            <Page key={`cr-${cat.name}`} className="bg-stone-50 flex flex-col">
              <div className="md:hidden px-5 pt-4 pb-2 border-b border-stone-200">
                <h3 className="text-sm font-light uppercase tracking-widest text-stone-600">{cat.name}</h3>
              </div>
              <ul className="flex-1 overflow-y-auto divide-y divide-stone-100 px-5 py-1.5">
                {cat.items.map(dish => (
                  <li key={dish.id}>
                    <button
                      onClick={() => setSelectedDish(dish)}
                      className="w-full text-left py-2.5 group"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-medium text-stone-800 group-hover:text-stone-500 group-hover:underline underline-offset-2 transition-colors leading-snug">
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
              <div className="px-5 py-1.5 border-t border-stone-200 text-right">
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
                <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line max-w-xs">
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

      {/* Navigation */}
      <div className="flex items-center gap-5 mt-6">
        <button
          onClick={goPrev}
          disabled={currentPage === 0}
          aria-label="Pagina precedente"
          className="w-9 h-9 flex items-center justify-center text-lg text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 disabled:opacity-20 transition-colors"
        >
          &#8249;
        </button>
        <span className="text-xs text-zinc-500 tabular-nums">
          {currentPage + 1} / {totalPages}
        </span>
        <button
          onClick={goNext}
          disabled={currentPage >= totalPages - 1}
          aria-label="Pagina successiva"
          className="w-9 h-9 flex items-center justify-center text-lg text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 disabled:opacity-20 transition-colors"
        >
          &#8250;
        </button>
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
