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

// ─── Card modale piatto ───────────────────────────────────────────────────────
const DESC_PREVIEW_CHARS = 160

function DishModal({ dish, onClose }: { dish: Dish; onClose: () => void }) {
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

        {/* Nome + prezzo */}
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

        {/* Descrizione — scroll solo se lunga */}
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

        {/* Allergeni — sotto la descrizione, nomi estesi */}
        {dish.allergens?.length > 0 && (
          <div style={{ padding: '10px 20px 0', flexShrink: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Allergeni
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {dish.allergens.map(a => (
                <span key={a} style={{ fontSize: 12, background: '#f5f5f4', color: '#57534e', padding: '3px 10px', borderRadius: 99 }}>{a}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tasto chiudi */}
      <button
        onPointerUp={e => { e.stopPropagation(); onClose() }}
        style={{
          position: 'fixed',
          top: 'calc(12vh - 16px)',
          right: 'max(calc(50% - 224px), 12px)',
          zIndex: 10000,
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="16" height="16" fill="none" stroke="white" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ─── Pagina copertina ─────────────────────────────────────────────────────────
function CoverPage({ menuName, restaurantName }: { menuName: string; restaurantName: string }) {
  return (
    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg, #292524 0%, #1c1917 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, userSelect: 'none', gap: 16, position: 'relative' }}>
      <div style={{ width: 48, height: 2, background: 'rgba(255,255,255,0.2)', borderRadius: 99 }} />
      <h1 style={{ color: '#e7e5e4', fontSize: 22, fontWeight: 700, textAlign: 'center', lineHeight: 1.3, margin: 0 }}>{menuName}</h1>
      <p style={{ color: '#78716c', fontSize: 13, textAlign: 'center', margin: 0 }}>{restaurantName}</p>
      <div style={{ width: 48, height: 2, background: 'rgba(255,255,255,0.2)', borderRadius: 99 }} />
      <div style={{ position: 'absolute', bottom: 24, display: 'flex', alignItems: 'center', gap: 6, color: '#44403c', fontSize: 12 }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Sfoglia il menu
      </div>
    </div>
  )
}

// ─── Pagina categoria ─────────────────────────────────────────────────────────
function CategoryPage({ category, dishes, pageNum, totalPages, onSelect }: PageData & { onSelect: (d: Dish) => void }) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#1c1917', display: 'flex', flexDirection: 'column', userSelect: 'none', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#e7e5e4', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{category}</h2>
          {totalPages > 1 && (
            <span style={{ fontSize: 10, color: '#57534e' }}>{pageNum}/{totalPages}</span>
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'hidden', padding: '8px 0' }}>
        {dishes.map(dish => (
          <button
            key={dish.id}
            onPointerUp={() => dish.is_available && onSelect(dish)}
            style={{
              width: '100%', display: 'flex', alignItems: 'flex-start',
              padding: '8px 16px', gap: 10, background: 'none', border: 'none',
              cursor: dish.is_available ? 'pointer' : 'default',
              textAlign: 'left', WebkitTapHighlightColor: 'transparent',
            }}
          >
            {dish.image_url && (
              <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#292524' }}>
                <img src={dish.image_url} alt={dish.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: dish.is_available ? '#e7e5e4' : '#57534e', lineHeight: 1.3, flex: 1 }}>
                  {dish.name}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: dish.is_available ? '#a8a29e' : '#44403c', flexShrink: 0 }}>
                  {dish.price != null && dish.price > 0 ? `€${Number(dish.price).toFixed(2)}` : ''}
                </span>
              </div>
              {dish.description && (
                <p style={{ fontSize: 11, color: '#78716c', lineHeight: 1.4, marginTop: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                  {dish.description}
                </p>
              )}
              {dish.allergens?.length > 0 && (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4 }}>
                  {dish.allergens.map(a => (
                    <span key={a} title={a} style={{
                      fontSize: 9, fontWeight: 700, color: '#78716c',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 3, padding: '1px 4px',
                      minWidth: 16, textAlign: 'center',
                    }}>{ALLERGEN_NUM[a] ?? '?'}</span>
                  ))}
                </div>
              )}
              {!dish.is_available && (
                <span style={{ fontSize: 10, color: '#57534e', marginTop: 2, display: 'block' }}>Non disponibile</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Pagina finale ────────────────────────────────────────────────────────────
function BackPage({ restaurantName }: { restaurantName: string }) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#292524', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, userSelect: 'none' }}>
      <p style={{ color: '#78716c', fontSize: 14, textAlign: 'center', margin: 0 }}>{restaurantName}</p>
      <p style={{ color: '#44403c', fontSize: 12, marginTop: 8, margin: '8px 0 0' }}>Grazie per la visita</p>
    </div>
  )
}

// ─── Componente principale ────────────────────────────────────────────────────
export default function FlipBook({ dishes, menuName, restaurantName }: Props) {
  const bookRef = useRef<any>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)

  const pages = buildPages(dishes)
  const totalPages = pages.length + 2

  const categoryPageIndex: Record<string, number> = {}
  pages.forEach((p, i) => {
    if (!(p.category in categoryPageIndex)) {
      categoryPageIndex[p.category] = i + 1
    }
  })
  const categories = Object.keys(categoryPageIndex)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxHeight: '100dvh', background: '#0c0a09', overflow: 'hidden', touchAction: 'none' }}>

      {/* Barra categorie */}
      {categories.length > 0 && (
        <div style={{ flexShrink: 0, paddingTop: 12, paddingBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 12px', scrollbarWidth: 'none' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onPointerUp={() => bookRef.current?.pageFlip().turnToPage(categoryPageIndex[cat])}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 500,
                  background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)',
                  border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Flipbook centrato */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0', minHeight: 0 }}>
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

      {/* Navigazione bottom: frecce + contatore */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingTop: 8,
      }}>
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

      {/* Modale piatto */}
      {selectedDish && (
        <DishModal dish={selectedDish} onClose={() => setSelectedDish(null)} />
      )}
    </div>
  )
}
