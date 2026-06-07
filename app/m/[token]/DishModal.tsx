'use client'

import { useEffect, useRef, useState } from 'react'
import { formatAllergensFull } from '@/lib/allergens'
import { fontStack, formatPrice, landingButtonRadius } from '@/lib/theme'
import type { CardTheme, RestaurantTheme } from '@/lib/theme'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DishData {
  id:              string
  name:            string
  description:     string | null
  price:           number | null
  category:        string
  image_url:       string | null
  allergens:       number[]
  pairing_dish_id: string | null
  pairing_label:   string | null
}

interface Props {
  activeDish:  DishData
  allDishes:   DishData[]
  isNested?:   boolean
  onClose:     () => void
  onBack?:     () => void
  onOpenDish:  (dish: DishData) => void
  theme?:      RestaurantTheme
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DishModal({ activeDish, allDishes, isNested, onClose, onBack, onOpenDish, theme }: Props) {
  const mn   = theme?.menu
  const card = theme?.card
  // Card-specific: use card theme if available, fall back to menu theme
  const CARD_BG      = card?.bgColor       ?? '#111111'
  const CARD_LAYOUT  = card?.layout        ?? 'photo-top'
  const FONT_SERIF   = fontStack(card?.title.font       ?? mn?.dishes.titleFont  ?? 'Cormorant Garamond', 'serif')
  const FONT_SANS    = fontStack(card?.description.font ?? mn?.descriptions.font ?? 'DM Sans',            'sans')
  const TITLE_COLOR  = card?.title.color   ?? '#ede8e0'
  const TITLE_SIZE   = card?.title.size    ?? mn?.dishes.titleSize   ?? 1.75
  const TITLE_WEIGHT = card?.title.weight  ?? 'light'
  const DESC_COLOR   = card?.description.color ?? mn?.descriptions.color ?? '#a09080'
  const DESC_SIZE    = card?.description.size  ?? mn?.descriptions.size  ?? 0.875
  const PRICE_COLOR  = card?.price.color   ?? mn?.prices.color  ?? mn?.accent ?? '#c9a96e'
  const PRICE_SIZE   = card?.price.size    ?? mn?.prices.size   ?? 1.1
  const PRICE_FORMAT = card?.price.format  ?? mn?.prices.format ?? 'symbol-left'
  const ALRG_COLOR   = card?.allergens.color   ?? mn?.allergens.color   ?? '#c9a96e'
  const ALRG_BG      = card?.allergens.bgColor ?? mn?.allergens.bgColor ?? '#181208'
  const ALRG_BADGE   = (card?.allergens.style  ?? mn?.allergens.style)  === 'badge'
  const CLOSE_COLOR  = card?.closeButton.color    ?? '#555555'
  const CLOSE_POS    = card?.closeButton.position ?? 'top-right'
  const CLOSE_SHAPE  = card?.closeButton.shape    ?? 'none'
  const CARD_RADIUS  = landingButtonRadius(theme?.landing.buttons.shape ?? 'flat')
  const TEXT_ALIGN   = (mn?.layout.dishAlignment === 'center' ? 'center' : mn?.layout.dishAlignment === 'right' ? 'right' : 'left') as 'left' | 'center' | 'right'

  // Derived accent for decorative elements (still uses menu accent)
  const ACCENT = mn?.accent ?? '#c9a96e'

  const startIdx = allDishes.findIndex(d => d.id === activeDish.id)

  const [idx,        setIdx]        = useState(startIdx >= 0 ? startIdx : 0)
  const [contentKey, setContentKey] = useState(0)
  const [animDir,    setAnimDir]    = useState<'right' | 'left' | 'fade'>('fade')

  const touchStartX = useRef<number | null>(null)
  const mouseStartX = useRef<number | null>(null)

  const total = allDishes.length
  const dish  = allDishes[idx] ?? activeDish

  // When activeDish changes (new modal pushed onto stack), reset to that dish
  useEffect(() => {
    const newIdx = allDishes.findIndex(d => d.id === activeDish.id)
    setIdx(newIdx >= 0 ? newIdx : 0)
    setAnimDir('fade')
    setContentKey(k => k + 1)
  }, [activeDish.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ─────────────────────────────────────────────────────────────

  function goTo(newIdx: number, dir: 'right' | 'left') {
    if (newIdx < 0 || newIdx >= total) return
    setAnimDir(dir)
    setIdx(newIdx)
    setContentKey(k => k + 1)
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (onBack) { onBack(); return }
        onClose()
        return
      }
      if (isNested) return
      if (e.key === 'ArrowLeft')  goTo(idx - 1, 'left')
      if (e.key === 'ArrowRight') goTo(idx + 1, 'right')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, total, onClose, onBack, isNested]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Touch swipe ────────────────────────────────────────────────────────────

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (isNested || touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if      (delta < -50) goTo(idx + 1, 'right')
    else if (delta >  50) goTo(idx - 1, 'left')
  }

  // ── Mouse drag ─────────────────────────────────────────────────────────────

  function onMouseDown(e: React.MouseEvent) {
    mouseStartX.current = e.clientX
  }
  function onMouseUp(e: React.MouseEvent) {
    if (isNested || mouseStartX.current === null) return
    const delta = e.clientX - mouseStartX.current
    mouseStartX.current = null
    if (Math.abs(delta) < 10) return
    if      (delta < -50) goTo(idx + 1, 'right')
    else if (delta >  50) goTo(idx - 1, 'left')
  }

  // ── Animation ─────────────────────────────────────────────────────────────

  const animStyle: React.CSSProperties =
    animDir === 'right' ? { animation: 'dish-slide-from-right 0.22s ease-out both' } :
    animDir === 'left'  ? { animation: 'dish-slide-from-left  0.22s ease-out both' } :
                          { animation: 'dish-fade-in          0.18s ease-out both' }

  // ── Pairing ────────────────────────────────────────────────────────────────

  const pairing = dish.pairing_dish_id
    ? allDishes.find(d => d.id === dish.pairing_dish_id)
    : null

  // ── Close button style ────────────────────────────────────────────────────

  const closeButtonStyle: React.CSSProperties =
    CLOSE_SHAPE === 'circle'
      ? { color: CLOSE_COLOR, background: CLOSE_COLOR + '22', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }
      : CLOSE_SHAPE === 'square'
      ? { color: CLOSE_COLOR, background: CLOSE_COLOR + '22', borderRadius: 4, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }
      : { color: CLOSE_COLOR }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center"
      style={{ fontFamily: FONT_SANS }}
    >
      {/* Backdrop — clicking it always closes everything */}
      <div
        className="absolute inset-0 modal-backdrop touch-none"
        style={{
          background:          'rgba(0,0,0,0.78)',
          backdropFilter:      'blur(6px)',
          WebkitBackdropFilter:'blur(6px)',
        } as React.CSSProperties}
        onClick={onClose}
      />

      {/* Card */}
      <div
        className="relative w-full sm:max-w-md flex flex-col modal-card overflow-hidden"
        style={{
          background:   CARD_BG,
          border:       `1px solid ${ACCENT}22`,
          borderRadius: CARD_RADIUS,
          maxHeight:    '88dvh',
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
      >
        {/* Drag handle */}
        <div className="flex justify-center shrink-0 pt-3 pb-1">
          <div style={{ width: 36, height: 3, borderRadius: 2, background: `${ACCENT}50` }} />
        </div>

        {/* Header row: back button (nested) or empty, close button */}
        <div className={`absolute top-3 left-0 right-0 flex items-center ${CLOSE_POS === 'top-left' ? 'flex-row-reverse' : ''} justify-between px-4 z-10`}>
          {onBack ? (
            <button
              onClick={onBack}
              aria-label="Indietro"
              className="flex items-center gap-1 transition-opacity hover:opacity-60 select-none"
              style={{ color: ACCENT, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}
            >
              ‹ indietro
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="text-xl leading-none transition-opacity hover:opacity-60 select-none"
            style={closeButtonStyle}
          >
            ×
          </button>
        </div>

        {/* Hero image — 16:9 aspect ratio (photo-top layout only) */}
        {CARD_LAYOUT === 'photo-top' && dish.image_url && (
          <div className="shrink-0 w-full aspect-video overflow-hidden" style={{ background: '#1a1a1a' }}>
            <img
              src={dish.image_url}
              alt={dish.name}
              className="w-full h-full object-cover object-center"
              style={{ opacity: 0.88 }}
              draggable={false}
            />
          </div>
        )}

        {/* Animated content — key forces re-mount → animation re-fires.
            touch-action:pan-y: browser handles vertical scroll natively;
            horizontal gestures pass through to the card's swipe handlers.
            Scrollbar completely hidden on all engines. */}
        <div
          key={contentKey}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          style={{ ...animStyle, padding: '20px 24px 4px', touchAction: 'pan-y' }}
        >
          {/* Category chip */}
          <p
            className="uppercase"
            style={{ color: ACCENT, fontSize: 9, letterSpacing: '0.28em', marginBottom: 10 }}
          >
            {dish.category}
          </p>

          {/* Name + price — photo-side wraps with thumbnail on the right */}
          {CARD_LAYOUT === 'photo-side' ? (
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-1 min-w-0">
                {/* Category chip already rendered above; name + price inside */}
                <div className={`flex gap-4 ${TEXT_ALIGN === 'center' ? 'flex-col items-center' : 'items-start justify-between'}`}>
                  <h2
                    style={{
                      fontFamily: FONT_SERIF,
                      fontSize:   `${TITLE_SIZE}rem`,
                      color:      TITLE_COLOR,
                      fontWeight: TITLE_WEIGHT === 'bold' ? 700 : TITLE_WEIGHT === 'normal' ? 400 : 300,
                      lineHeight: 1.2,
                      textAlign:  TEXT_ALIGN,
                    }}
                  >
                    {dish.name}
                  </h2>
                  {dish.price != null && (
                    <span
                      className={`tabular-nums ${TEXT_ALIGN === 'center' ? '' : 'shrink-0'}`}
                      style={{ color: PRICE_COLOR, fontSize: `${PRICE_SIZE}rem`, fontWeight: 600, paddingTop: TEXT_ALIGN === 'center' ? 0 : 4 }}
                    >
                      {formatPrice(dish.price, PRICE_FORMAT)}
                    </span>
                  )}
                </div>
              </div>
              {dish.image_url && (
                <div className="shrink-0 w-20 h-20 rounded overflow-hidden" style={{ background: '#1a1a1a' }}>
                  <img src={dish.image_url} alt={dish.name} className="w-full h-full object-cover" draggable={false} />
                </div>
              )}
            </div>
          ) : (
            /* photo-top and minimal: standard name + price row */
            <div className={`flex gap-4 mb-3 ${TEXT_ALIGN === 'center' ? 'flex-col items-center' : 'items-start justify-between'}`}>
              <h2
                style={{
                  fontFamily: FONT_SERIF,
                  fontSize:   `${TITLE_SIZE}rem`,
                  color:      TITLE_COLOR,
                  fontWeight: TITLE_WEIGHT === 'bold' ? 700 : TITLE_WEIGHT === 'normal' ? 400 : 300,
                  lineHeight: 1.2,
                  textAlign:  TEXT_ALIGN,
                }}
              >
                {dish.name}
              </h2>
              {dish.price != null && (
                <span
                  className={`tabular-nums ${TEXT_ALIGN === 'center' ? '' : 'shrink-0'}`}
                  style={{ color: PRICE_COLOR, fontSize: `${PRICE_SIZE}rem`, fontWeight: 600, paddingTop: TEXT_ALIGN === 'center' ? 0 : 4 }}
                >
                  {formatPrice(dish.price, PRICE_FORMAT)}
                </span>
              )}
            </div>
          )}

          {/* Gold rule */}
          <div style={{ height: 0.5, background: `${ACCENT}28`, marginBottom: 14 }} />

          {/* Description — pre-wrap preserves \n line-breaks entered in the admin */}
          {dish.description && (
            <p className="w-full max-w-full break-words" style={{ color: DESC_COLOR, fontFamily: FONT_SANS, fontSize: `${DESC_SIZE}rem`, lineHeight: 1.7, marginBottom: 18, whiteSpace: 'pre-wrap', textAlign: TEXT_ALIGN }}>
              {dish.description}
            </p>
          )}

          {/* Allergens */}
          {dish.allergens?.length > 0 && (
            <div
              style={{
                marginBottom: 16,
                padding:      ALRG_BADGE ? '4px 10px' : '10px 14px',
                background:   ALRG_BG,
                border:       `1px solid ${ALRG_COLOR}20`,
                borderRadius: ALRG_BADGE ? 20 : 6,
              }}
            >
              {!ALRG_BADGE && <p style={{ color: ALRG_COLOR, fontSize: 8, letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 6 }}>Allergeni</p>}
              <p style={{ color: ALRG_BADGE ? ALRG_COLOR : '#7a6a4a', fontSize: '0.75rem', lineHeight: 1.6 }}>
                {ALRG_BADGE ? '⚠ ' : ''}{formatAllergensFull(dish.allergens)}
              </p>
            </div>
          )}

          {/* Pairing — clickable, no price shown */}
          {pairing && (
            <button
              onClick={() => onOpenDish(pairing)}
              style={{
                display:      'block',
                width:        '100%',
                marginBottom: 16,
                padding:      '10px 14px',
                border:       `1px solid ${ACCENT}30`,
                borderRadius: 6,
                background:   'transparent',
                textAlign:    'left',
                cursor:       'pointer',
                transition:   'border-color 0.15s ease, background 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = `${ACCENT}60`
                ;(e.currentTarget as HTMLButtonElement).style.background = `${ACCENT}08`
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = `${ACCENT}30`
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              <p style={{ color: ACCENT, fontSize: 8, letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 6 }}>
                {dish.pairing_label ?? 'Abbinamento consigliato'}
              </p>
              <div className="flex items-center justify-between">
                <p style={{ color: '#8a8a8a', fontSize: '0.8125rem' }}>
                  {pairing.name}
                </p>
                <span style={{ color: ACCENT, fontSize: 10, letterSpacing: '0.1em' }}>›</span>
              </div>
            </button>
          )}
        </div>

        {/* Navigation bar — hidden in nested mode */}
        {!isNested && total > 1 && (
          <div
            className="shrink-0 flex items-center justify-between px-5"
            style={{ borderTop: '1px solid #1c1c1c', paddingTop: 12, paddingBottom: 20 }}
          >
            <button
              onClick={() => goTo(idx - 1, 'left')}
              disabled={idx === 0}
              className="transition-opacity"
              style={{
                color:         idx === 0 ? '#2a2a2a' : '#6a6a6a',
                fontSize:      11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontFamily:    FONT_SANS,
              }}
            >
              ‹ prec.
            </button>
            <span
              style={{ color: '#303030', fontSize: 10, letterSpacing: '0.15em', fontFamily: FONT_SANS }}
            >
              {idx + 1} / {total}
            </span>
            <button
              onClick={() => goTo(idx + 1, 'right')}
              disabled={idx === total - 1}
              className="transition-opacity"
              style={{
                color:         idx === total - 1 ? '#2a2a2a' : '#6a6a6a',
                fontSize:      11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontFamily:    FONT_SANS,
              }}
            >
              succ. ›
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
