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

// ─── Modale dettaglio piatto ──────────────────────────────────────────────────
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
          position: 'relative', background: 'white', width: '100%', maxWidth: '480px',
          borderRadius: '24px 24px 0 0',
          height: hasPhoto ? '88vh' : 'auto', maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
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

        {/* Allergeni — nomi estesi sotto descrizione */}
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
          position: 'fixed', top: 'calc(12vh - 16px)', right: 'max(calc(50% - 224px), 12px)',
          zIndex: 10000, width: 32, height: 32, borderRadius: '50%',
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

// ─── Copertina ────────────────────────────────────────────────────────────────
function CoverPage({ menuName, restaurantName }: { menuName: string; restaurantName: string }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(160deg, #f5f0e8 0%, #ede6d6 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32, userSelect: 'none', gap: 16, position: 'relative',
      borderLeft: '3px solid rgba(180,160,120,0.3)',
    }}>
      <div style={{ width: 48, height: 1, background: 'rgba(120,100,70,0.35)', borderRadius: 99 }} />
      <h1 style={{ color: '#3d2e1a', fontSize: 22, fontWeight: 700, textAlign: 'center', lineHeight: 1.3, margin: 0, fontFamily: 'Georgia, serif' }}>{menuName}</h1>
      <p style={{ color: '#8c7355', fontSize: 13, textAlign: 'center', margin: 0 }}>{restaurantName}</p>
      <div style={{ width: 48, height: 1, background: 'rgba(120,100,70,0.35)', borderRadius: 99 }} />
      <div style={{ position: 'absolute', bottom: 24, display: 'flex', alignItems: 'center', gap: 6, color: '#b8a080', fontSize: 11, letterSpacing: '0.06em' }}>
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        SFOGLIA IL MENU
      </div>
    </div>
  )
}

// ─── Pagina categoria ─────────────────────────────────────────────────────────
function CategoryPage({ category, dishes, pageNum, totalPages, onSelect }: PageData & { onSelect: (d: Dish) => void }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(180deg, #faf7f2 0%, #f5f0e8 100%)',
      display: 'flex', flexDirection: 'column', userSelect: 'none', overflow: 'hidden',
      borderLeft: '1px solid rgba(180,160,120,0.2)',
    }}>
      {/* Header categoria */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(160,130,90,0.15)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8c7355', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>{category}</h2>
          {totalPages > 1 && (
            <span style={{ fontSize: 9, color: '#c4b090' }}>{pageNum}/{totalPages}</span>
          )}
        </div>
      </div>

      {/* Lista piatti */}
      <div style={{ flex: 1, overflowY: 'hidden', padding: '6px 0' }}>
        {dishes.map((dish, idx) => (
          <button
            key={dish.id}
            onPointerUp={() => dish.is_available && onSelect(dish)}
            style={{
              width: '100%', display: 'flex', alignItems: 'flex-start',
              padding: '7px 14px', gap: 10, background: 'none', border: 'none',
              cursor: dish.is_available ? 'pointer' : 'default',
              textAlign: 'left', WebkitTapHighlightColor: 'transparent',
              borderBottom: idx < dishes.length - 1 ? '1px solid rgba(160,130,90,0.08)' : 'none',
            }}
          >
            {/* Miniatura */}
            {dish.image_url && (
              <div style={{ width: 48, height: 48, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#ede6d6' }}>
                <img src={dish.image_url} alt={dish.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            {/* Testo */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'baseline' }}>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: dish.is_available ? '#3d2e1a' : '#c4b090',
                  lineHeight: 1.3, flex: 1,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {dish.name}
                </span>
                {dish.price != null && dish.price > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: dish.is_available ? '#6b5235' : '#c4b090', flexShrink: 0 }}>
                    €{Number(dish.price).toFixed(2)}
                  </span>
                )}
              </div>

              {/* Descrizione troncata */}
              {dish.description && (
                <p style={{
                  fontSize: 10, color: '#a08060', lineHeight: 1.4, margin: '2px 0 0',
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                } as React.CSSProperties}>
                  {dish.description}
                </p>
              )}

              {/* Allergeni — numeri senza contorno, stesso font del testo piatto */}
              {dish.allergens?.length > 0 && (
                <p style={{ fontSize: 10, color: '#b8a080', margin: '3px 0 0', lineHeight: 1 }}>
                  {dish.allergens.map(a => ALLERGEN_NUM[a] ?? '?').join(' · ')}
                </p>
              )}

              {!dish.is_available && (
                <span style={{ fontSize: 9, color: '#c4b090', marginTop: 2, display: 'block' }}>Non disponibile</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Footer pagina */}
      <div style={{ padding: '6px 14px', borderTop: '1px solid rgba(160,130,90,0.1)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 9, color: '#d4c4a8' }}>· · ·</span>
      </div>
    </div>
  )
}

// ─── Pagina finale ────────────────────────────────────────────────────────────
function BackPage({ restaurantName }: { restaurantName: string }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(160deg, #ede6d6 0%, #e8dfc8 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32, userSelect: 'none',
      borderRight: '3px solid rgba(180,160,120,0.3)',
    }}>
      <div style={{ width: 32, height: 1, background: 'rgba(120,100,70,0.3)', borderRadius: 99, marginBottom: 16 }} />
      <p style={{ color: '#8c7355', fontSize: 13, textAlign: 'center', margin: 0, fontFamily: 'Georgia, serif' }}>{restaurantName}</p>
      <p style={{ color: '#b8a080', fontSize: 10, marginTop: 8, margin: '8px 0 0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Grazie per la visita</p>
      <div style={{ width: 32, height: 1, background: 'rgba(120,100,70,0.3)', borderRadius: 99, marginTop: 16 }} />
    </div>
  )
}

// ─── Componente principale ────────────────────────────────────────────────────
export default function FlipBook({ dishes, menuName, restaurantName }: Props) {
  const bookRef = useRef<any>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)
  const [isFlipping, setIsFlipping] = useState(false)

  const pages = buildPages(dishes)
  const totalPages = pages.length + 2

  const categoryPageIndex: Record<string, number> = {}
  pages.forEach((p, i) => {
    if (!(p.category in categoryPageIndex)) categoryPageIndex[p.category] = i + 1
  })
  const categories = Object.keys(categoryPageIndex)

  // Flip direzione-aware: flip() va solo avanti, flipPrev() va indietro
  const goToPage = (n: number) => {
    if (isFlipping) return
    setIsFlipping(true)
    const pf = bookRef.current?.pageFlip()
    if (!pf) return
    if (n < currentPage) {
      // Andiamo indietro: flipPrev() ripetuto fino alla pagina target
      // Per jump diretti indietro usiamo turnToPrevPage + aggiornamento manuale
      pf.turnToPage(n)
    } else {
      pf.flip(n)
    }
    setTimeout(() => setIsFlipping(false), 1050)
  }

  const goPrev = () => {
    if (currentPage <= 0 || isFlipping) return
    setIsFlipping(true)
    bookRef.current?.pageFlip().flipPrev()
    setTimeout(() => setIsFlipping(false), 1050)
  }

  const goNext = () => {
    if (currentPage >= totalPages - 1 || isFlipping) return
    setIsFlipping(true)
    bookRef.current?.pageFlip().flipNext()
    setTimeout(() => setIsFlipping(false), 1050)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', maxHeight: '100dvh',
      background: '#1a1410',
      overflow: 'hidden', touchAction: 'none',
    }}>

      {/* Barra categorie */}
      {categories.length > 0 && (
        <div style={{ flexShrink: 0, paddingTop: 10, paddingBottom: 6 }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 12px', scrollbarWidth: 'none' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onPointerUp={() => goToPage(categoryPageIndex[cat])}
                style={{
                  flexShrink: 0, padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 500,
                  background: 'rgba(245,240,232,0.08)', color: 'rgba(245,240,232,0.5)',
                  border: '1px solid rgba(245,240,232,0.12)', cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background 0.2s, color 0.2s',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Flipbook centrato */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>

        {/* Il libro */}
        <HTMLFlipBook
          ref={bookRef}
          width={310}
          height={480}
          size="stretch"
          minWidth={240}
          maxWidth={440}
          minHeight={380}
          maxHeight={640}
          showCover={true}
          mobileScrollSupport={false}
          onFlip={(e: any) => { setCurrentPage(e.data); setIsFlipping(false) }}
          className=""
          style={{
            filter: [
              'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
              'drop-shadow(0 12px 32px rgba(0,0,0,0.8))',
              'drop-shadow(0 32px 64px rgba(0,0,0,0.9))',
            ].join(' '),
          }}
          startPage={0}
          drawShadow={true}
          flippingTime={900}
          usePortrait={true}
          startZIndex={0}
          autoSize={true}
          clickEventForward={false}
          useMouseEvents={true}
          swipeDistance={0}
          showPageCorners={true}
          disableFlipByClick={true}
          maxShadowOpacity={0.85}
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

      {/* Navigazione bottom — fascia integrata sotto il volantino */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingTop: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(245,240,232,0.04)',
          border: '1px solid rgba(245,240,232,0.08)',
          borderRadius: '0 0 10px 10px',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(245,240,232,0.06)',
        }}>
          {/* Freccia sinistra */}
          <button
            onPointerUp={goPrev}
            disabled={currentPage === 0 || isFlipping}
            style={{
              width: 48, height: 36,
              background: 'none', border: 'none',
              borderRight: '1px solid rgba(245,240,232,0.07)',
              cursor: currentPage === 0 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: currentPage === 0 ? 0.15 : 0.7,
              transition: 'opacity 0.2s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg width="14" height="14" fill="none" stroke="rgba(245,240,232,0.9)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Contatore */}
          <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.25)', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.1em' }}>
              {currentPage + 1} · {totalPages}
            </span>
          </div>

          {/* Freccia destra */}
          <button
            onPointerUp={goNext}
            disabled={currentPage >= totalPages - 1 || isFlipping}
            style={{
              width: 48, height: 36,
              background: 'none', border: 'none',
              borderLeft: '1px solid rgba(245,240,232,0.07)',
              cursor: currentPage >= totalPages - 1 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: currentPage >= totalPages - 1 ? 0.15 : 0.7,
              transition: 'opacity 0.2s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg width="14" height="14" fill="none" stroke="rgba(245,240,232,0.9)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Modale piatto */}
      {selectedDish && (
        <DishModal dish={selectedDish} onClose={() => setSelectedDish(null)} />
      )}
    </div>
  )
}
