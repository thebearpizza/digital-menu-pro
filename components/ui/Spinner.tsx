'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Loading indicators powered by anime.js — used inside buttons (dot pulse) and
// for full-screen loading states (rotating ring).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react'
import { animate, stagger } from 'animejs'

// Compact 3-dot pulse, sized to sit inline inside a button's text.
export function Spinner({ size = 5, color = 'currentColor', className = '' }: {
  size?: number; color?: string; className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const dots = el.querySelectorAll('.dmp-spinner-dot')
    const anim = animate(dots, {
      translateY: [
        { to: -size * 1.3, duration: 260, ease: 'outQuad' },
        { to: 0,           duration: 260, ease: 'inQuad'  },
      ],
      loop: true,
      delay: stagger(110),
    })
    return () => { anim.revert() }
  }, [size])

  return (
    <span ref={ref} role="status" aria-label="Caricamento in corso"
      className={`inline-flex items-center ${className}`} style={{ gap: size * 0.6, height: size * 1.3 * 2 }}>
      {[0, 1, 2].map(i => (
        <span key={i} className="dmp-spinner-dot" style={{
          display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color,
        }} />
      ))}
    </span>
  )
}

// Larger rotating ring for full-screen / full-section loading states.
export function RingSpinner({ size = 32, color = 'currentColor', thickness = 2, className = '' }: {
  size?: number; color?: string; thickness?: number; className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const anim = animate(el, { rotate: '1turn', duration: 900, loop: true, ease: 'linear' })
    return () => { anim.revert() }
  }, [])

  return (
    <span ref={ref} role="status" aria-label="Caricamento in corso"
      className={`inline-block shrink-0 ${className}`}
      style={{
        width: size, height: size, borderRadius: '50%',
        border: `${thickness}px solid ${color}33`,
        borderTopColor: color,
      }} />
  )
}
