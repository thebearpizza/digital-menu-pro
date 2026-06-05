'use client'

import { useEffect, useRef, useState } from 'react'
import { formatAllergensFull } from '@/lib/allergens'

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
}

const ACCENT     = '#c9a96e'
const FONT_SERIF = "'Cormorant Garamond', 'Georgia', 'Times New Roman', serif"
const FONT_SANS  = "'DM Sans', 'Inter', system-ui, sans-serif"

// ── Component ──────────────────────────────────────────────────────────────────

export default function DishModal({ activeDish, allDishes, isNested, onClose, onBack, onOpenDish }: Props) {
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
          background:   '#111111',
          border:       `1px solid ${ACCENT}22`,
          borderRadius: '14px',
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
        <div className="absolute top-3 left-0 right-0 flex items-center justify-between px-4 z-10">
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
            style={{ color: '#555555' }}
          >
            ×
          </button>
        </div>

        {/* Hero image — 16:9 aspect ratio */}
        {dish.image_url && (
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

          {/* Name + price */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <h2
              style={{
                fontFamily: FONT_SERIF,
                fontSize:   'clamp(1.35rem, 5vw, 1.75rem)',
                color:      '#ede8e0',
                fontWeight: 400,
                lineHeight: 1.2,
              }}
            >
              {dish.name}
            </h2>
            {dish.price != null && (
              <span
                className="shrink-0 tabular-nums"
                style={{ color: ACCENT, fontSize: '1.1rem', fontWeight: 600, paddingTop: 4 }}
              >
                €&nbsp;{Number(dish.price).toFixed(2)}
              </span>
            )}
          </div>

          {/* Gold rule */}
          <div style={{ height: 0.5, background: `${ACCENT}28`, marginBottom: 14 }} />

          {/* Description — pre-wrap preserves \n line-breaks entered in the admin */}
          {dish.description && (
            <p className="w-full max-w-full break-words" style={{ color: '#a09080', fontSize: '0.875rem', lineHeight: 1.7, marginBottom: 18, whiteSpace: 'pre-wrap' }}>
              {dish.description}
            </p>
          )}

          {/* Allergens */}
          {dish.allergens?.length > 0 && (
            <div
              style={{
                marginBottom: 16,
                padding:      '10px 14px',
                background:   '#181208',
                border:       `1px solid ${ACCENT}20`,
                borderRadius: 6,
              }}
            >
              <p style={{ color: ACCENT, fontSize: 8, letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 6 }}>
                Allergeni
              </p>
              <p style={{ color: '#7a6a4a', fontSize: '0.75rem', lineHeight: 1.6 }}>
                {formatAllergensFull(dish.allergens)}
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
