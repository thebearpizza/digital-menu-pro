'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

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
const SWIPE_THRESHOLD = 18
const DESC_PREVIEW_CHARS = 85

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

function truncateText(text: string | null | undefined, max: number) {
  if (!text) return ''
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

function DishModal({ dish, onClose }: { dish: Dish; onClose: () => void }) {
  const hasPhoto = !!dish.image_url

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }} />

      <div
        onClick={(e) => e.stopPropagation()}
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
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, background: '#e5e5e5', borderRadius: 99 }} />
        </div>

        {hasPhoto && (
          <div style={{ width: '100%', flex: '0 0 52%', overflow: 'hidden', background: '#f5f5f4' }}>
            <img src={dish.image_url!} alt={dish.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

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

        {dish.description && (
          <div style={{ padding: '8px 20px 0' }}>
            <p style={{ fontSize: 14, color: '#78716c', lineHeight: 1.6, margin: 0 }}>
              {dish.description}
            </p>
          </div>
        )}

        {dish.allergens?.length > 0 && (
          <div style={{ padding: '10px 20px 0', flexShrink: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Allergeni
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {dish.allergens.map((a) => (
                <span key={a} style={{ fontSize: 12, background: '#f5f5f4', color: '#57534e', padding: '3px 10px', borderRadius: 99 }}>
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CoverPage({ menuName, restaurantName }: { menuName: string; restaurantName: string }) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(160deg, #f8f3ea 0%, #eee5d6 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      userSelect: 'none',
      gap: 16,
      position: 'relative',
      borderLeft: '3px solid rgba(180,160,120,0.28)',
    }}>
      <div style={{ width: 48, height: 1, background: 'rgba(120,100,70,0.35)', borderRadius: 99 }} />
      <h1 style={{ color: '#3d2e1a', fontSize: 22, fontWeight: 700, textAlign: 'center', lineHeight: 1.3, margin: 0, fontFamily: 'Georgia, serif' }}>
        {menuName}
      </h1>
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

function CategoryPage({
  category,
  dishes,
  pageNum,
  totalPages,
  onSelect,
}: PageData & { onSelect: (dish: Dish) => void }) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(180deg, #fcf9f4 0%, #f5eee3 100%)',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      overflow: 'hidden',
      borderLeft: '1px solid rgba(180,160,120,0.18)',
      boxShadow: 'inset 0 0 22px rgba(255,255,255,0.24)',
    }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(160,130,90,0.15)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8c7355', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>
            {category}
          </h2>
          {totalPages > 1 && <span style={{ fontSize: 9, color: '#c4b090' }}>{pageNum}/{totalPages}</span>}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'hidden', padding: '6px 0' }}>
        {dishes.map((dish, idx) => (
          <button
            key={dish.id}
            onClick={() => dish.is_available && onSelect(dish)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'flex-start',
              padding: '7px 14px',
              gap: 10,
              background: 'none',
              border: 'none',
              cursor: dish.is_available ? 'pointer' : 'default',
              textAlign: 'left',
              WebkitTapHighlightColor: 'transparent',
              borderBottom: idx < dishes.length - 1 ? '1px solid rgba(160,130,90,0.08)' : 'none',
            }}
          >
            {dish.image_url && (
              <div style={{ width: 48, height: 48, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#ede6d6' }}>
                <img src={dish.image_url} alt={dish.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'baseline' }}>
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: dish.is_available ? '#3d2e1a' : '#c4b090',
                  lineHeight: 1.3,
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {dish.name}
                </span>
                {dish.price != null && dish.price > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: dish.is_available ? '#6b5235' : '#c4b090', flexShrink: 0 }}>
                    €{Number(dish.price).toFixed(2)}
                  </span>
                )}
              </div>

              {dish.description && (
                <p style={{
                  fontSize: 10,
                  color: '#a08060',
                  lineHeight: 1.4,
                  margin: '2px 0 0',
                }}>
                  {truncateText(dish.description, DESC_PREVIEW_CHARS)}
                </p>
              )}

              {dish.allergens?.length > 0 && (
                <p style={{ fontSize: 10, color: '#b8a080', margin: '3px 0 0', lineHeight: 1 }}>
                  {dish.allergens.map((a) => ALLERGEN_NUM[a] ?? '?').join(' · ')}
                </p>
              )}

              {!dish.is_available && (
                <span style={{ fontSize: 9, color: '#c4b090', marginTop: 2, display: 'block' }}>
                  Non disponibile
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      <div style={{ padding: '6px 14px', borderTop: '1px solid rgba(160,130,90,0.1)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 9, color: '#d4c4a8' }}>· · ·</span>
      </div>
    </div>
  )
}

function BackPage({ restaurantName }: { restaurantName: string }) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(160deg, #efe7d8 0%, #e8dfc8 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      userSelect: 'none',
      borderRight: '3px solid rgba(180,160,120,0.28)',
    }}>
      <div style={{ width: 32, height: 1, background: 'rgba(120,100,70,0.3)', borderRadius: 99, marginBottom: 16 }} />
      <p style={{ color: '#8c7355', fontSize: 13, textAlign: 'center', margin: 0, fontFamily: 'Georgia, serif' }}>{restaurantName}</p>
      <p style={{ color: '#b8a080', fontSize: 10, margin: '8px 0 0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Grazie per la visita</p>
      <div style={{ width: 32, height: 1, background: 'rgba(120,100,70,0.3)', borderRadius: 99, marginTop: 16 }} />
    </div>
  )
}

export default function FlipBook({ dishes, menuName, restaurantName }: Props) {
  const pages = useMemo(() => buildPages(dishes), [dishes])
  const totalPages = pages.length + 2
  const [currentPage, setCurrentPage] = useState(0)
  const [displayPage, setDisplayPage] = useState(0)
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev'>('next')
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const categoryPageIndex: Record<string, number> = {}
  pages.forEach((p, i) => {
    if (!(p.category in categoryPageIndex)) categoryPageIndex[p.category] = i + 1
  })
  const categories = Object.keys(categoryPageIndex)

  const clampPage = (page: number) => Math.max(0, Math.min(totalPages - 1, page))

  const changePage = (target: number) => {
    const safeTarget = clampPage(target)
    if (safeTarget === currentPage || isAnimating) return

    setFlipDirection(safeTarget > currentPage ? 'next' : 'prev')
    setDisplayPage(currentPage)
    setIsAnimating(true)

    window.setTimeout(() => {
      setCurrentPage(safeTarget)
    }, 140)

    window.setTimeout(() => {
      setDisplayPage(safeTarget)
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
        onSelect={(dish) => setSelectedDish(dish)}
      />
    )
  }, [visiblePage, menuName, restaurantName, totalPages, pages])

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isAnimating) return
    const t = e.touches[0]
    touchStartX.current = t.clientX
    touchStartY.current = t.clientY
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isAnimating || touchStartX.current == null || touchStartY.current == null) return

    const t = e.changedTouches[0]
    const dx = t.clientX - touchStartX.current
    const dy = t.clientY - touchStartY.current

    touchStartX.current = null
    touchStartY.current = null

    if (Math.abs(dx) < SWIPE_THRESHOLD) return
    if (Math.abs(dx) <= Math.abs(dy)) return

    if (dx < 0) {
      goNext()
    } else {
      goPrev()
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100dvh - 52px)',
      maxHeight: 'calc(100dvh - 52px)',
      background: '#1a1410',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {categories.length > 0 && (
        <div style={{ flexShrink: 0, paddingTop: 10, paddingBottom: 6, position: 'relative', zIndex: 20 }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 12px', scrollbarWidth: 'none' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => goToCategory(categoryPageIndex[cat])}
                style={{
                  flexShrink: 0,
                  padding: '5px 12px',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 500,
                  background: 'rgba(245,240,232,0.08)',
                  color: 'rgba(245,240,232,0.65)',
                  border: '1px solid rgba(245,240,232,0.12)',
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 0,
        margin: '0 -3px',
        perspective: '1800px',
        position: 'relative',
      }}>
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            width: 'min(310px, calc(100vw - 38px))',
            height: '465px',
            minHeight: '360px',
            maxHeight: '620px',
            position: 'relative',
            transformStyle: 'preserve-3d',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 2,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.06) 100%)',
              boxShadow: [
                '0 2px 4px rgba(0,0,0,0.6)',
                '0 12px 32px rgba(0,0,0,0.8)',
                '0 32px 64px rgba(0,0,0,0.9)',
              ].join(', '),
              overflow: 'hidden',
              transformOrigin: flipDirection === 'next' ? 'left center' : 'right center',
              transform: isAnimating
                ? flipDirection === 'next'
                  ? 'rotateY(-14deg) translateX(-6px)'
                  : 'rotateY(14deg) translateX(6px)'
                : 'rotateY(0deg) translateX(0px)',
              transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 520ms ease',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: isAnimating
                  ? flipDirection === 'next'
                    ? 'linear-gradient(90deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.08) 26%, rgba(0,0,0,0.12) 100%)'
                    : 'linear-gradient(90deg, rgba(0,0,0,0.12) 0%, rgba(255,255,255,0.08) 74%, rgba(255,255,255,0.34) 100%)'
                  : 'linear-gradient(90deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 18%, rgba(0,0,0,0.10) 100%)',
                pointerEvents: 'none',
                zIndex: 3,
                transition: 'background 520ms ease',
              }}
            />

            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 2,
                overflow: 'hidden',
                background: '#f7f1e7',
              }}
            >
              {currentContent}
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              left: 8,
              right: 8,
              bottom: -6,
              height: 18,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.12) 55%, rgba(0,0,0,0) 100%)',
              filter: 'blur(6px)',
              transform: isAnimating
                ? flipDirection === 'next'
                  ? 'translateX(-6px) scaleX(0.96)'
                  : 'translateX(6px) scaleX(0.96)'
                : 'translateX(0px) scaleX(1)',
              transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      <div style={{
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'center',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: '#1a1410',
        position: 'relative',
        zIndex: 20,
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'linear-gradient(180deg, rgba(245,240,232,0.06) 0%, rgba(245,240,232,0.03) 100%)',
          border: '1px solid rgba(245,240,232,0.09)',
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          overflow: 'hidden',
          boxShadow: '0 6px 24px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(245,240,232,0.04)',
        }}>
          <button
            onClick={goPrev}
            style={{
              width: 52,
              height: 38,
              background: 'none',
              border: 'none',
              borderRight: '1px solid rgba(245,240,232,0.07)',
              cursor: currentPage === 0 || isAnimating ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: currentPage === 0 ? 0.15 : 0.82,
              transition: 'opacity 0.2s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg width="14" height="14" fill="none" stroke="rgba(245,240,232,0.95)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div style={{ padding: '0 18px', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.22)', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.1em' }}>
              {currentPage + 1} · {totalPages}
            </span>
          </div>

          <button
            onClick={goNext}
            style={{
              width: 52,
              height: 38,
              background: 'none',
              border: 'none',
              borderLeft: '1px solid rgba(245,240,232,0.07)',
              cursor: currentPage >= totalPages - 1 || isAnimating ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: currentPage >= totalPages - 1 ? 0.15 : 0.82,
              transition: 'opacity 0.2s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg width="14" height="14" fill="none" stroke="rgba(245,240,232,0.95)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
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
