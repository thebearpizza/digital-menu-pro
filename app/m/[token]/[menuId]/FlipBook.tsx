'use client'

import { useRef, useState } from 'react'
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

// Modale dettaglio piatto
function DishModal({ dish, onClose }: { dish: Dish; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {dish.image_url ? (
          <div className="w-full h-52 bg-stone-100">
            <img src={dish.image_url} alt={dish.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-full h-32 bg-stone-100 flex items-center justify-center">
            <svg className="w-12 h-12 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <div className="p-5">
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
            <div className="flex flex-wrap gap-1 mb-4">
              {dish.allergens.map(a => (
                <span key={a} className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{a}</span>
              ))}
            </div>
          )}
          {!dish.is_available && (
            <span className="text-xs bg-stone-100 text-stone-400 px-3 py-1 rounded-full">Non disponibile</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center transition-colors"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// Riga singola piatto nella pagina
function DishRow({ dish, onSelect }: { dish: Dish; onSelect: (d: Dish) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(dish)}
      className="w-full text-left flex items-start justify-between gap-2 py-2.5 px-3 rounded-xl hover:bg-stone-50 active:bg-stone-100 transition-colors border-b border-stone-100 last:border-0"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-sm font-semibold text-stone-800 leading-tight ${!dish.is_available ? 'opacity-40' : ''}`}>
            {dish.name}
          </span>
          {!dish.is_available && (
            <span className="text-xs text-stone-400">(N/D)</span>
          )}
        </div>
        {dish.description && (
          <p className="text-xs text-stone-400 mt-0.5 leading-snug line-clamp-1">{dish.description}</p>
        )}
        {dish.allergens?.length > 0 && (
          <p className="text-xs text-stone-300 mt-0.5 truncate">
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

// Pagina categoria con max 8 piatti
function CategoryPage({
  category,
  dishes,
  pageNum,
  totalPages,
  onSelect,
}: {
  category: string
  dishes: Dish[]
  pageNum: number
  totalPages: number
  onSelect: (d: Dish) => void
}) {
  return (
    <div className="w-full h-full bg-white flex flex-col">
      {/* Header categoria */}
      <div className="px-4 pt-4 pb-2 border-b border-stone-100 flex-shrink-0">
        <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest">{category}</h2>
        {totalPages > 1 && (
          <p className="text-xs text-stone-300 mt-0.5">{pageNum}/{totalPages}</p>
        )}
      </div>
      {/* Lista piatti */}
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
    <div className="w-full h-full bg-stone-900 flex flex-col items-center justify-center p-8">
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
    <div className="w-full h-full bg-stone-800 flex flex-col items-center justify-center p-8">
      <p className="text-stone-400 text-sm text-center">{restaurantName}</p>
      <p className="text-stone-600 text-xs mt-2">Grazie per la visita</p>
    </div>
  )
}

// Costruisce le pagine dividendo per categoria, max 8 piatti per pagina
function buildPages(dishes: Dish[]): Array<{ category: string; dishes: Dish[]; pageNum: number; totalPages: number }> {
  const MAX = 8
  const grouped: Record<string, Dish[]> = {}

  dishes.forEach(dish => {
    const cat = dish.category?.trim() || 'Senza categoria'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(dish)
  })

  const categories = Object.keys(grouped).sort((a, b) =>
    a === 'Senza categoria' ? 1 : b === 'Senza categoria' ? -1 : a.localeCompare(b)
  )

  const pages: Array<{ category: string; dishes: Dish[]; pageNum: number; totalPages: number }> = []

  categories.forEach(cat => {
    const catDishes = grouped[cat]
    const totalPages = Math.ceil(catDishes.length / MAX)
    for (let i = 0; i < totalPages; i++) {
      pages.push({
        category: cat,
        dishes: catDishes.slice(i * MAX, (i + 1) * MAX),
        pageNum: i + 1,
        totalPages,
      })
    }
  })

  return pages
}

export default function FlipBook({ dishes, menuName, restaurantName }: Props) {
  const bookRef = useRef<any>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)

  const pages = buildPages(dishes)
  const totalPages = pages.length + 2 // cover + pagine + back

  function prevPage() { bookRef.current?.pageFlip().flipPrev() }
  function nextPage() { bookRef.current?.pageFlip().flipNext() }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-950 px-2 py-6">

      <HTMLFlipBook
        ref={bookRef}
        width={340}
        height={500}
        size="stretch"
        minWidth={280}
        maxWidth={500}
        minHeight={420}
        maxHeight={680}
        showCover={true}
        mobileScrollSupport={true}
        onFlip={(e: any) => setCurrentPage(e.data)}
        className="shadow-2xl"
        style={{}}
        startPage={0}
        drawShadow={true}
        flippingTime={700}
        usePortrait={true}
        startZIndex={0}
        autoSize={true}
        clickEventForward={false}
        useMouseEvents={true}
        swipeDistance={30}
        showPageCorners={true}
        disableFlipByClick={false}
        maxShadowOpacity={0.5}
      >
        {/* Cover */}
        <div className="page">
          <CoverPage menuName={menuName} restaurantName={restaurantName} />
        </div>

        {/* Pagine categoria */}
        {pages.map((page, i) => (
          <div key={i} className="page">
            <CategoryPage
              category={page.category}
              dishes={page.dishes}
              pageNum={page.pageNum}
              totalPages={page.totalPages}
              onSelect={setSelectedDish}
            />
          </div>
        ))}

        {/* Back cover */}
        <div className="page">
          <BackPage restaurantName={restaurantName} />
        </div>
      </HTMLFlipBook>

      {/* Controlli navigazione */}
      <div className="flex items-center gap-8 mt-6">
        <button
          onClick={prevPage}
          disabled={currentPage === 0}
          className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors flex items-center justify-center text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-stone-400 text-sm tabular-nums">{currentPage + 1} / {totalPages}</span>
        <button
          onClick={nextPage}
          disabled={currentPage >= totalPages - 1}
          className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors flex items-center justify-center text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <p className="text-stone-600 text-xs mt-3">Tocca un piatto per i dettagli</p>

      {/* Modale dettaglio piatto */}
      {selectedDish && (
        <DishModal dish={selectedDish} onClose={() => setSelectedDish(null)} />
      )}
    </div>
  )
}
