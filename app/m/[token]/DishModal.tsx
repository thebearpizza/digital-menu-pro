'use client'

import { useEffect, useRef, useState } from 'react'
import { formatAllergens } from '@/lib/allergens'
import { fontStack, formatPrice, cardBorderRadius, cardNavColors } from '@/lib/theme'
import type { CardTheme, RestaurantTheme } from '@/lib/theme'
import { EditHandle, sendEdit, useIsMobilePreview } from './EditHandle'
import { animateCardIn } from '@/lib/animations'
import { uiText, type Lang } from '@/lib/translations'

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
  editMode?:   boolean
  theme?:      RestaurantTheme
  // I dati del piatto arrivano già tradotti; lang serve per le etichette fisse
  // (allergeni, abbinamento).
  lang?:       Lang
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DishModal({ activeDish, allDishes, isNested, onClose, onBack, onOpenDish, editMode = false, theme, lang = 'it' }: Props) {
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
  const PRICE_FONT   = fontStack(card?.price.font ?? mn?.prices.font ?? 'DM Sans', 'sans')
  const PRICE_SIZE   = card?.price.size    ?? mn?.prices.size   ?? 1.1
  const PRICE_FORMAT = card?.price.format  ?? mn?.prices.format ?? 'symbol-left'
  const PRICE_CURR   = card?.price.currency ?? mn?.prices.currency ?? '€'
  const ALRG_COLOR   = card?.allergens.color   ?? mn?.allergens.color   ?? '#c9a96e'
  const ALRG_BG      = card?.allergens.bgColor ?? mn?.allergens.bgColor ?? '#181208'
  const ALRG_BADGE   = (card?.allergens.style  ?? mn?.allergens.style)  === 'badge'
  const ALRG_DISPLAY = card?.allergens.display   ?? mn?.allergens.display   ?? 'full'
  const ALRG_SEP     = card?.allergens.separator ?? mn?.allergens.separator ?? ', '
  const ALRG_SIZE    = card?.allergens.size      ?? mn?.allergens.size      ?? 0.85
  const ALRG_LABEL   = card?.allergens.labelColor ?? ALRG_COLOR
  const CLOSE_COLOR  = card?.closeButton.color    ?? '#555555'
  const CLOSE_POS    = card?.closeButton.position ?? 'top-right'
  const CLOSE_SHAPE  = card?.closeButton.shape    ?? 'none'
  const CLOSE_SHOW   = card?.closeButton.show     ?? true
  const CLOSE_SIZE   = card?.closeButton.size     ?? 1.25
  const CARD_RADIUS  = cardBorderRadius(card?.borderRadius ?? 'sm')
  const TEXT_ALIGN   = (card?.align ?? mn?.layout.dishAlignment ?? 'left') as 'left' | 'center' | 'right'

  // Decorative accent: card-owned, with menu accent only as legacy fallback
  const ACCENT = card?.accent ?? mn?.accent ?? '#c9a96e'

  // Category chip: card-owned settings, independent from menu.categories
  const CAT_COLOR = card?.category.color ?? ACCENT
  const CAT_SIZE  = card?.category.size  ?? 0.5625

  // Pairing box ("Abbinamento consigliato"): label + product colors
  const PAIR_LABEL_COLOR = card?.pairing.labelColor   ?? ACCENT
  const PAIR_PROD_COLOR  = card?.pairing.productColor ?? '#8a8a8a'

  // Prev/next + page-counter colors, kept within the same neutral gray tone
  // but boosted for legibility against the active card background.
  const NAV_COLORS = cardNavColors(CARD_BG)

  const isMobilePreview = useIsMobilePreview()

  const startIdx = allDishes.findIndex(d => d.id === activeDish.id)

  const [idx,        setIdx]        = useState(startIdx >= 0 ? startIdx : 0)
  const [contentKey, setContentKey] = useState(0)
  const [animDir,    setAnimDir]    = useState<'right' | 'left' | 'fade'>('fade')

  const touchStartX = useRef<number | null>(null)
  const mouseStartX = useRef<number | null>(null)
  const cardRef     = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  // Pop-in entrance for the card + backdrop, played once when the modal mounts.
  useEffect(() => {
    const anims = animateCardIn(cardRef.current, backdropRef.current)
    return () => { anims.forEach(a => a.revert()) }
  }, [])

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

  // Circle/square boxes scale with the glyph (1.4× keeps the original 28px
  // box at the default 1.25rem glyph size).
  const closeBox = `${CLOSE_SIZE * 1.4}rem`
  const closeButtonStyle: React.CSSProperties =
    CLOSE_SHAPE === 'circle'
      ? { color: CLOSE_COLOR, fontSize: `${CLOSE_SIZE}rem`, background: CLOSE_COLOR + '22', borderRadius: '50%', width: closeBox, height: closeBox, display: 'flex', alignItems: 'center', justifyContent: 'center' }
      : CLOSE_SHAPE === 'square'
      ? { color: CLOSE_COLOR, fontSize: `${CLOSE_SIZE}rem`, background: CLOSE_COLOR + '22', borderRadius: 4, width: closeBox, height: closeBox, display: 'flex', alignItems: 'center', justifyContent: 'center' }
      : { color: CLOSE_COLOR, fontSize: `${CLOSE_SIZE}rem` }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center"
      style={{ fontFamily: FONT_SANS }}
    >
      {/* Backdrop — clicking it always closes everything */}
      <div
        ref={backdropRef}
        className="absolute inset-0 touch-none"
        style={{
          background:          'rgba(0,0,0,0.78)',
          backdropFilter:      'blur(6px)',
          WebkitBackdropFilter:'blur(6px)',
        } as React.CSSProperties}
        onClick={onClose}
      />

      {/* Card */}
      <div
        ref={cardRef}
        className="relative w-full sm:max-w-md flex flex-col overflow-hidden"
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
          {CLOSE_SHOW ? (
            <button
              onClick={onClose}
              aria-label="Chiudi"
              className="leading-none transition-opacity hover:opacity-60 select-none"
              style={closeButtonStyle}
            >
              ×
            </button>
          ) : (
            <span />
          )}
        </div>

        {/* Card background edit badge — admin preview only.
            Hidden on mobile: the chip bar already exposes a "Stile Card" target. */}
        {editMode && !isMobilePreview && (
          <button
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 bg-blue-500 text-white rounded-full text-[11px] shadow-lg"
            onClick={() => sendEdit('card-style')}>
            <span>✏</span><span>Sfondo card</span>
          </button>
        )}

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
          {/* Category chip — own edit target: must NOT touch menu.categories */}
          <EditHandle target="card-category" editMode={editMode}>
            <p
              className="uppercase"
              style={{ color: CAT_COLOR, fontSize: `${CAT_SIZE}rem`, letterSpacing: '0.28em', marginBottom: 10, textAlign: TEXT_ALIGN }}
            >
              {dish.category}
            </p>
          </EditHandle>

          {/* Name + price — photo-side wraps with thumbnail on the right */}
          {CARD_LAYOUT === 'photo-side' ? (
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-1 min-w-0">
                {/* Category chip already rendered above; name + price inside */}
                <div className={`flex gap-4 ${TEXT_ALIGN === 'center' ? 'flex-col items-center' : 'items-start justify-between'}`}>
                  <EditHandle target="dish-title" editMode={editMode}>
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
                  </EditHandle>
                  {dish.price != null && (
                    <EditHandle target="dish-price" editMode={editMode} className={TEXT_ALIGN === 'center' ? '' : 'shrink-0'}>
                      <span
                        className="tabular-nums"
                        style={{ color: PRICE_COLOR, fontFamily: PRICE_FONT, fontSize: `${PRICE_SIZE}rem`, fontWeight: 600, paddingTop: TEXT_ALIGN === 'center' ? 0 : 4 }}
                      >
                        {formatPrice(dish.price, PRICE_FORMAT, PRICE_CURR)}
                      </span>
                    </EditHandle>
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
              <EditHandle target="dish-title" editMode={editMode}>
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
              </EditHandle>
              {dish.price != null && (
                <EditHandle target="dish-price" editMode={editMode} className={TEXT_ALIGN === 'center' ? '' : 'shrink-0'}>
                  <span
                    className="tabular-nums"
                    style={{ color: PRICE_COLOR, fontFamily: PRICE_FONT, fontSize: `${PRICE_SIZE}rem`, fontWeight: 600, paddingTop: TEXT_ALIGN === 'center' ? 0 : 4 }}
                  >
                    {formatPrice(dish.price, PRICE_FORMAT, PRICE_CURR)}
                  </span>
                </EditHandle>
              )}
            </div>
          )}

          {/* Gold rule */}
          <div style={{ height: 0.5, background: `${ACCENT}28`, marginBottom: 14 }} />

          {/* Description — pre-wrap preserves \n line-breaks entered in the admin */}
          {dish.description && (
            <EditHandle target="dish-description" editMode={editMode}>
              <p className="w-full max-w-full break-words" style={{ color: DESC_COLOR, fontFamily: FONT_SANS, fontSize: `${DESC_SIZE}rem`, lineHeight: 1.7, marginBottom: 18, whiteSpace: 'pre-wrap', textAlign: TEXT_ALIGN }}>
                {dish.description}
              </p>
            </EditHandle>
          )}

          {/* Allergens */}
          {dish.allergens?.length > 0 && (
            <EditHandle target="allergens" editMode={editMode}>
              <div
                style={{
                  marginBottom: 16,
                  padding:      ALRG_BADGE ? '4px 10px' : '10px 14px',
                  background:   ALRG_BG,
                  border:       `1px solid ${ALRG_COLOR}20`,
                  borderRadius: ALRG_BADGE ? 20 : 6,
                }}
              >
                {!ALRG_BADGE && <p style={{ color: ALRG_LABEL, fontSize: 8, letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 6 }}>{uiText('allergens', lang)}</p>}
                <p style={{ color: ALRG_COLOR, fontSize: `${ALRG_SIZE}rem`, lineHeight: 1.6 }}>
                  {ALRG_BADGE ? '⚠ ' : ''}{formatAllergens(dish.allergens, ALRG_DISPLAY, ALRG_SEP, lang)}
                </p>
              </div>
            </EditHandle>
          )}

          {/* Pairing — clickable, no price shown. In edit mode the EditHandle
              intercepts the click to open the pairing-colors editor instead. */}
          {pairing && (
            <EditHandle target="card-pairing" editMode={editMode}>
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
                <p style={{ color: PAIR_LABEL_COLOR, fontSize: 8, letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {dish.pairing_label ?? uiText('pairing', lang)}
                </p>
                <div className="flex items-center justify-between">
                  <p style={{ color: PAIR_PROD_COLOR, fontSize: '0.8125rem' }}>
                    {pairing.name}
                  </p>
                  <span style={{ color: ACCENT, fontSize: 10, letterSpacing: '0.1em' }}>›</span>
                </div>
              </button>
            </EditHandle>
          )}
        </div>

        {/* Navigation bar — hidden in nested mode */}
        {!isNested && total > 1 && (
          <div
            className="shrink-0 flex items-center justify-between px-5"
            style={{ borderTop: `1px solid ${NAV_COLORS.divider}`, paddingTop: 12, paddingBottom: 20 }}
          >
            <button
              onClick={() => goTo(idx - 1, 'left')}
              disabled={idx === 0}
              className="transition-opacity"
              style={{
                color:         idx === 0 ? NAV_COLORS.disabled : NAV_COLORS.active,
                fontSize:      11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontFamily:    FONT_SANS,
              }}
            >
              ‹ prec.
            </button>
            <span
              style={{ color: NAV_COLORS.counter, fontSize: 10, letterSpacing: '0.15em', fontFamily: FONT_SANS }}
            >
              {idx + 1} / {total}
            </span>
            <button
              onClick={() => goTo(idx + 1, 'right')}
              disabled={idx === total - 1}
              className="transition-opacity"
              style={{
                color:         idx === total - 1 ? NAV_COLORS.disabled : NAV_COLORS.active,
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
