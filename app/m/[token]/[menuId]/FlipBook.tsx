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

function DishPage({ dish }: { dish: Dish }) {
  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden">
      {dish.image_url ? (
        <div className="w-full flex-shrink-0" style={{ height: '55%' }}>
          <img
            src={dish.image_url}
            alt={dish.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full flex-shrink-0 bg-stone-100 flex items-center justify-center" style={{ height: '55%' }}>
          <svg className="w-16 h-16 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      <div className="flex-1 p-5 flex flex-col justify-between overflow-hidden">
        <div>
          {dish.category && (
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">{dish.category}</p>
          )}
          <h3 className="text-xl font-bold text-stone-800 leading-tight">{dish.name}</h3>
          {dish.description && (
            <p className="text-stone-500 text-sm mt-2 leading-relaxed line-clamp-3">{dish.description}</p>
          )}
        </div>

        <div className="mt-3">
          {dish.allergens?.length > 0 && (
            <p className="text-xs text-stone-400 mb-2">
              <span className="font-medium">Allergeni:</span> {dish.allergens.join(', ')}
            </p>
          )}
          <div className="flex items-center justify-between">
            {!dish.is_available && (
              <span className="text-xs bg-stone-100 text-stone-400 px-2 py-1 rounded-full">Non disponibile</span>
            )}
            {dish.price != null && dish.price > 0 && (
              <span className="text-2xl font-bold text-stone-800 ml-auto">
                €{Number(dish.price).toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CoverPage({ menuName, restaurantName }: { menuName: string; restaurantName: string }) {
  return (
    <div className="w-full h-full bg-stone-900 flex flex-col items-center justify-center p-8">
      <p className="text-stone-400 text-sm uppercase tracking-widest mb-3">{restaurantName}</p>
      <h1 className="text-white text-3xl font-bold text-center">{menuName}</h1>
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

export default function FlipBook({ dishes, menuName, restaurantName }: Props) {
  const bookRef = useRef<any>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const totalPages = dishes.length + 2 // cover + piatti + back

  function prevPage() {
    bookRef.current?.pageFlip().flipPrev()
  }

  function nextPage() {
    bookRef.current?.pageFlip().flipNext()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-950 px-4 py-8">

      {/* Flipbook */}
      <div className="w-full flex justify-center">
        <HTMLFlipBook
          ref={bookRef}
          width={320}
          height={460}
          size="fixed"
          minWidth={280}
          maxWidth={400}
          minHeight={400}
          maxHeight={560}
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
          autoSize={false}
          clickEventForward={true}
          useMouseEvents={true}
          swipeDistance={30}
          showPageCorners={true}
          disableFlipByClick={false}
        >
          {/* Cover */}
          <div className="page">
            <CoverPage menuName={menuName} restaurantName={restaurantName} />
          </div>

          {/* Piatti */}
          {dishes.map((dish) => (
            <div key={dish.id} className="page">
              <DishPage dish={dish} />
            </div>
          ))}

          {/* Back cover */}
          <div className="page">
            <BackPage restaurantName={restaurantName} />
          </div>
        </HTMLFlipBook>
      </div>

      {/* Controlli navigazione */}
      <div className="flex items-center gap-8 mt-8">
        <button
          onClick={prevPage}
          disabled={currentPage === 0}
          className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors flex items-center justify-center text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="text-stone-400 text-sm">
          {currentPage + 1} / {totalPages}
        </span>

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

      {/* Hint swipe */}
      <p className="text-stone-600 text-xs mt-4">Scorri o clicca i bordi per sfogliare</p>

    </div>
  )
}
