'use client'

import { useEffect, useRef, useState } from 'react'
import { allergenName } from '@/lib/allergens'

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
  activeDish: DishData
  allDishes:  DishData[]
  onClose:    () => void
}

const ACCENT     = '#c9a96e'
const FONT_SERIF = "'Cormorant Garamond', 'Georgia', 'Times New Roman', serif"
const FONT_SANS  = "'DM Sans', 'Inter', system-ui, sans-serif"

// ── Component ──────────────────────────────────────────────────────────────────

export default function DishModal({ activeDish, allDishes, onClose }: Props) {
  const startIdx = allDishes.findIndex(d => d.id === activeDish.id)

  const [idx,        setIdx]        = useState(startIdx >= 0 ? startIdx : 0)
  const [contentKey, setContentKey] = useState(0)
  const [animDir,    setAnimDir]    = useState<'right' | 'left' | 'fade'>('fade')

  const touchStartX = useRef<number | null>(null)
  const mouseStartX = useRef<number | null>(null)

  const total = allDishes.length
  const dish  = allDishes[idx] ?? activeDish

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
      if (e.key === 'Escape')      { onClose(); return }
      if (e.key === 'ArrowLeft')   goTo(idx - 1, 'left')
      if (e.key === 'ArrowRight')  goTo(idx + 1, 'right')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, total, onClose]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Touch swipe ────────────────────────────────────────────────────────────

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
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
    if (mouseStartX.current === null) return
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ fontFamily: FONT_SANS }}
    >
      {/* Backdrop */}
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

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute top-3 right-4 z-10 text-xl leading-none transition-opacity hover:opacity-60 select-none"
          style={{ color: '#555555' }}
        >
          ×
        </button>

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
            horizontal gestures pass through to the card's swipe handlers. */}
        <div
          key={contentKey}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
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

          {/* Description */}
          {dish.description && (
            <p style={{ color: '#a09080', fontSize: '0.875rem', lineHeight: 1.7, marginBottom: 18 }}>
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
                {dish.allergens.map(id => allergenName(id)).join(' · ')}
              </p>
            </div>
          )}

          {/* Pairing */}
          {pairing && (
            <div
              style={{
                marginBottom: 16,
                padding:      '10px 14px',
                border:       '1px solid #222222',
                borderRadius: 6,
              }}
            >
              <p style={{ color: '#3e3e3e', fontSize: 8, letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 6 }}>
                {dish.pairing_label ?? 'Abbinamento consigliato'}
              </p>
              <p style={{ color: '#6a6a6a', fontSize: '0.8125rem' }}>
                {pairing.name}
                {pairing.price != null && (
                  <span style={{ color: ACCENT, marginLeft: 8 }}>
                    €&nbsp;{Number(pairing.price).toFixed(2)}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Navigation bar */}
        {total > 1 && (
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
