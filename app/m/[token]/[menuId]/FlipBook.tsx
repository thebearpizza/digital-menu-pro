'use client'

import { useRef, useState, useCallback } from 'react'
import HTMLFlipBook from 'react-pageflip'

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

function buildPages(dishes: Dish[]): PageData[] {
  const grouped: Record<string, Dish[]> = {}
  dishes.forEach(dish => {
    const cat = dish.category?.trim() || 'Senza categoria'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(dish)
  })
  const categories = Object.keys(grouped).sort((a, b) =>
    a === 'Senza categoria' ? 1 : b === 'Senza categoria' ? -1 : a.localeCompare(b)
  )
  const pages: PageData[] = []
  categories.forEach(cat => {
    const catDishes = grouped[cat]
    const totalPages = Math.ceil(catDishes.length / MAX_PER_PAGE)
    for (let i = 0; i < totalPages; i++) {
      pages.push({
        category: cat,
        dishes: catDishes.slice(i * MAX_PER_PAGE, (i + 1) * MAX_PER_PAGE),
        pageNum: i + 1,
        totalPages,
      })
    }
  })
  return pages
}

function DishModal({ dish, onClose }: { dish: Dish; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />
      <div
        className="relative bg-white rounded-t-3xl w-full max-w-lg overflow-hidden shadow-2xl"
        style={{ maxHeight: '75vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-stone-200 rounded-full" />
        </div>

        {/* Foto solo se presente */}
        {dish.image_url && (
          <div className="w-full bg-stone-100" style={{ height: '220px' }}>
            <img src={dish.image_url} alt={dish.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-5 overflow-y-auto" style={{ maxHeight: dish.image_url ? 'calc(75vh - 280px)' : 'calc(75vh - 60px)' }}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-xl font-bold text-stone-800 leading-tight">{dish.name}</h3>
            {dish.price != null && dish.price > 0 && (
              <span className="text-xl font-bold text-stone-800 flex-shrink-0">
                €{Number(dish.price).toFixed(2)}
              </span>
            )}
          </div>
          {dish.description && (
            <p className="text-stone-500 text-sm leading-relaxed mb-3">{dish.description}</p>
          )}
          {dish.allergens?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">Allergeni</p>
              <div className="flex flex-wrap gap-1.5">
                {dish.allergens.map(a => (
                  <span key={a} className="text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full">{a}</span>
                ))}
              </div>
            </div>
          )}
          {!dish.is_available && (
            <span className="inline-block mt-3 text-xs bg-stone-100 text-stone-400 px-3 py-1 rounded-full">
              Non disponibile
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 bg-stone-100 hover:bg-stone-200 rounded-full flex items-center justify-center transition-colors"
        >
          <svg className="w-4 h-4 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function DishRow({ dish, onSelect }: { dish: Dish; onSelect: (d: Dish) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(dish)}
      className="w-full text-left flex items-start justify-between gap-3 py-2.5 px-2 rounded-xl hover:bg-stone-50 active:bg-stone-100 transition-colors border-b border-stone-100 last:border-0"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-semibold text-stone-800 leading-tight ${!dish.is_available ? 'opacity-40' : ''}`}>
            {dish.name}
          </span>
          {!dish.is_available && <span className="text-xs text-stone-300 flex-shrink-0">(N/D)</span>}
        </div>
        {dish.description && (
          <p className="text-xs text-stone-400 mt-0.5 leading-snug truncate max-w-[180px]">{dish.description}</p>
        )}
        {dish.allergens?.length > 0 && (
          <p className="text-xs text-stone-300 mt-0.5 truncate max-w-[180px]">
            {dish.allergens.slice(0, 3).join(', ')}{dish.allergens.length > 3 ? ` +${dish.allergens.length - 3}` : ''}
          </p>
        )}
      </div>
      {dish.price != null && dish.price > 0 && (
        <span className="text-sm font-bold text-stone-700 flex-shrink-0 mt-0.5">
          €{Number(dish.price).toFixed(2)}
        </span>
      )}
    </button>
  )
}

function CategoryPage({ category, dishes, pageNum, totalPages, onSelect }: PageData & { onSelect: (d: Dish) => void }) {
  return (
    <div className="w-full h-full bg-white flex flex-col select-none">
      <div className="px-4 pt-4 pb-2 border-b border-stone-100 flex-shrink-0 flex items-center justify-between">
        <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest">{category}</h2>
        {totalPages > 1 && (
          <span className="text-xs text-stone-300">{pageNum}/{totalPages}</span>
        )}
      </div>
      <div className="flex-1 px-2 py-1 overflow-hidden">
        {dishes.map(dish => (
          <DishRow key={dish.id} dish={dish} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

function CoverPage({ menuName, restaurantName }: { menuName: string; restaurantName: string }) {
  return (
    <div className="w-full h-full bg-stone-900 flex flex-col items-center justify-center p-8 select-none">
      <p className="text-stone-400 text-xs uppercase tracking-widest mb-3">{restaurantName}</p>
      <h1 className="text-white text-3xl font-bold text-center leading-tight">{menuName}</h1>
      <div className="mt-8 flex items-center gap-2 text-stone-500 text-xs">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Sfoglia il menu
      </div>
    </div>
  )
}

function BackPage({ restaurantName }: { restaurantName: string }) {
  return (
    <div className="w-full h-full bg-stone-800 flex flex-col items-center justify-center p-8 select-none">
      <p className="text-stone-400 text-sm text-center">{restaurantName}</p>
      <p className="text-stone-600 text-xs mt-2">Grazie per la visita</p>
    </div>
  )
}

export default function FlipBook({ dishes, menuName, restaurantName }: Props) {
  const bookRef = useRef<any>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)

  const pages = buildPages(dishes)
  const totalPages = pages.length + 2

  // Indice di pagina per categoria (cover = 0, prima cat = 1)
  const categoryPageIndex: Record<string, number> = {}
  pages.forEach((p, i) => {
    if (!(p.category in categoryPageIndex)) {
      categoryPageIndex[p.category] = i + 1
    }
  })

  const categories = Object.keys(categoryPageIndex)

  function goToCategory(cat: string) {
    bookRef.current?.pageFlip().flip(categoryPageIndex[cat])
  }

  const handleSelect = useCallback((dish: Dish) => {
    setSelectedDish(dish)
  }, [])

  return (
    <div
      className="flex flex-col items-center bg-stone-950 overflow-hidden"
      style={{ minHeight: '100dvh' }}
    >
      {/* Navigazione categorie */}
      {categories.length > 0 && (
        <div className="w-full px-3 pt-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide flex-shrink-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => goToCategory(cat)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white transition-colors"
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Flipbook */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-2 py-2">
        <HTMLFlipBook
          ref={bookRef}
          width={340}
          height={520}
          size="stretch"
          minWidth={280}
          maxWidth={520}
          minHeight={440}
          maxHeight={720}
          showCover={true}
          mobileScrollSupport={false}
          onFlip={(e: any) => setCurrentPage(e.data)}
          className="shadow-2xl"
          style={{
            filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.8))',
          }}
          startPage={0}
          drawShadow={true}
          flippingTime={800}
          usePortrait={true}
          startZIndex={0}
          autoSize={true}
          clickEventForward={false}
          useMouseEvents={true}
          swipeDistance={15}
          showPageCorners={true}
          disableFlipByClick={false}
          maxShadowOpacity={0.8}
        >
          <div className="page"><CoverPage menuName={menuName} restaurantName={restaurantName} /></div>
          {pages.map((page, i) => (
            <div key={i} className="page">
              <CategoryPage {...page} onSelect={handleSelect} />
            </div>
          ))}
          <div className="page"><BackPage restaurantName={restaurantName} /></div>
        </HTMLFlipBook>
      </div>

      {/* Controlli */}
      <div className="flex items-center gap-8 py-4 flex-shrink-0">
        <button
          onClick={() => bookRef.current?.pageFlip().flipPrev()}
          disabled={currentPage === 0}
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors flex items-center justify-center text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-stone-500 text-xs tabular-nums">{currentPage + 1} / {totalPages}</span>
        <button
          onClick={() => bookRef.current?.pageFlip().flipNext()}
          disabled={currentPage >= totalPages - 1}
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors flex items-center justify-center text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Modale piatto — fuori dal flipbook, non interferisce */}
      {selectedDish && (
        <DishModal dish={selectedDish} onClose={() => setSelectedDish(null)} />
      )}
    </div>
  )
}
