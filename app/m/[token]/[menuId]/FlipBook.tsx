'use client'

import { useRef, useState, useEffect } from 'react'
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
  const cats = Object.keys(grouped).sort((a, b) =>
    a === 'Senza categoria' ? 1 : b === 'Senza categoria' ? -1 : a.localeCompare(b)
  )
  const pages: PageData[] = []
  cats.forEach(cat => {
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

// Modale montata nel body via portal-like div fisso
const DESC_PREVIEW_CHARS = 160

function DishModal({ dish, onClose }: { dish: Dish; onClose: () => void }) {
  const [descExpanded, setDescExpanded] = useState(false)
  const descLong = (dish.description?.length ?? 0) > DESC_PREVIEW_CHARS
  const hasPhoto = !!dish.image_url

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onPointerUp={onClose}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }} />
      <div
        onPointerUp={e => e.stopPropagation()}
        style={{
          position: 'relative',
          background: 'white',
          width: '100%',
          maxWidth: '480px',
          borderRadius: '24px 24px 0 0',
          height: hasPhoto ? '88vh' : 'auto',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, background: '#e5e5e5', borderRadius: 99 }} />
        </div>

        {/* Foto */}
        {hasPhoto && (
          <div style={{ width: '100%', flex: '0 0 52%', overflow: 'hidden', background: '#f5f5f4' }}>
            <img src={dish.image_url!} alt={dish.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {/* Info fisse: nome + prezzo */}
        <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1c1917', lineHeight: 1.3, margin: 0 }}>{dish.name}</h3>
            {dish.price != null && dish.price > 0 && (
              <span style={{ fontSize: 20, fontWeight: 700, color: '#1c1917', flexShrink: 0 }}>
                €{Number(dish.price).toFixed(2)}
              </span>
            )}
          </div>
          {!dish.is_available && (
            <span style={{ display: 'inline-block', marginBottom: 8, fontSize: 12, background: '#f5f5f4', color: '#a8a29e', padding: '3px 12px', borderRadius: 99 }}>
              Non disponibile
            </span>
          )}
        </div>

        {/* Descrizione: scroll solo se lunga */}
        {dish.description && (
          <div style={{
            padding: '8px 20px 0',
            flex: descLong ? '1 1 auto' : '0 0 auto',
            overflowY: descLong ? 'auto' : 'visible',
            WebkitOverflowScrolling: 'touch',
            flexShrink: descLong ? 1 : 0,
          }}>
            <p style={{ fontSize: 14, color: '#78716c', lineHeight: 1.6, margin: 0 }}>
              {dish.description}
            </p>
          </div>
        )}

        {/* Allergeni SOTTO la descrizione */}
            {dish.allergens?.length > 0 && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4 }}>
                {dish.allergens.map(a => {
                  const ALLERGEN_NUM: Record<string, string> = {
                    'Glutine': '1', 'Cereali contenenti glutine': '1',
                    'Crostacei': '2', 'Uova': '3', 'Pesce': '4',
                    'Arachidi': '5', 'Soia': '6', 'Latte': '7', 'Lattosio': '7',
                    'Frutta a guscio': '8', 'Noci': '8', 'Mandorle': '8', 'Nocciole': '8', 'Anacardi': '8', 'Pistacchi': '8',
                    'Sedano': '9', 'Senape': '10', 'Semi di sesamo': '11', 'Sesamo': '11',
                    'Anidride solforosa': '12', 'Solfiti': '12', 'Lupini': '13', 'Molluschi': '14',
                  }
                  const num = ALLERGEN_NUM[a] || '?'
                  return (
                    <span key={a} title={a} style={{
                      fontSize: 10, fontWeight: 700, color: '#a8a29e',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 4, padding: '1px 5px',
                      minWidth: 18, textAlign: 'center',
                    }}>{num}</span>
                  )
                })}
              </div>
            )}

      {/* Flipbook con spazio laterale per swipe */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 14px' }}>
        <HTMLFlipBook
          ref={bookRef}
          width={320}
          height={490}
          size="stretch"
          minWidth={260}
          maxWidth={460}
          minHeight={400}
          maxHeight={660}
          showCover={true}
          mobileScrollSupport={false}
          onFlip={(e: any) => setCurrentPage(e.data)}
          className=""
          style={{ filter: 'drop-shadow(0 32px 64px rgba(0,0,0,1)) drop-shadow(0 8px 24px rgba(0,0,0,0.8)) drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }}
          startPage={0}
          drawShadow={true}
          flippingTime={1000}
          usePortrait={true}
          startZIndex={0}
          autoSize={true}
          clickEventForward={true}
          useMouseEvents={true}
          swipeDistance={5}
          showPageCorners={true}
          disableFlipByClick={true}
          maxShadowOpacity={1}
        >
          <div className="page"><CoverPage menuName={menuName} restaurantName={restaurantName} /></div>
          {pages.map((page, i) => (
            <div key={i} className="page">
              <CategoryPage {...page} onSelect={(d) => setSelectedDish(d)} />
            </div>
          ))}
          <div className="page"><BackPage restaurantName={restaurantName} /></div>
        </HTMLFlipBook>

      </div>

      {/* Navigazione bottom: frecce + contatore — inglobate sotto il volantino */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingTop: 8,
      }}>
        {/* Freccia sinistra */}
        <button
          onPointerUp={() => { if (currentPage > 0) bookRef.current?.pageFlip().turnToPrevPage() }}
          disabled={currentPage === 0}
          style={{
            width: 44, height: 44,
            borderRadius: '12px 0 0 12px',
            background: currentPage === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRight: 'none',
            cursor: currentPage === 0 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: currentPage === 0 ? 0.2 : 1,
            transition: 'opacity 0.2s, background 0.2s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg width="16" height="16" fill="none" stroke="rgba(255,255,255,0.75)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Contatore centrale */}
        <div style={{
          height: 44, minWidth: 64, padding: '0 12px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.05em' }}>
            {currentPage + 1} / {totalPages}
          </span>
        </div>

        {/* Freccia destra */}
        <button
          onPointerUp={() => { if (currentPage < totalPages - 1) bookRef.current?.pageFlip().turnToNextPage() }}
          disabled={currentPage >= totalPages - 1}
          style={{
            width: 44, height: 44,
            borderRadius: '0 12px 12px 0',
            background: currentPage >= totalPages - 1 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderLeft: 'none',
            cursor: currentPage >= totalPages - 1 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: currentPage >= totalPages - 1 ? 0.2 : 1,
            transition: 'opacity 0.2s, background 0.2s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg width="16" height="16" fill="none" stroke="rgba(255,255,255,0.75)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Modale piatto — z-index altissimo, fuori da tutto */}
      {selectedDish && (
        <DishModal dish={selectedDish} onClose={() => setSelectedDish(null)} />
      )}
    </div>
  )
}
