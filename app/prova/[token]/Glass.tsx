'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Tasto in vetro, ispirato al "Liquid Glass" di iOS: cerchio traslucido che
// sfoca e satura ciò che c'è sotto, riflesso in alto a sinistra, bordo di luce
// sottile e ombra morbida. Alla pressione si gonfia appena con un rimbalzo,
// come i controlli di iOS. Pensato per tutti i tasti in sovraimpressione.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'

const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

interface Props {
  label:    string
  onClick:  () => void
  children: React.ReactNode
  size?:    number
  /** Nascosto con dissolvenza (resta al suo posto, non cliccabile). */
  hidden?:  boolean
}

export function GlassButton({ label, onClick, children, size = 40, hidden = false }: Props) {
  const [pressed, setPressed] = useState(false)
  const release = () => setPressed(false)
  return (
    <button type="button" aria-label={label} aria-hidden={hidden || undefined} tabIndex={hidden ? -1 : 0}
      onClick={onClick}
      onPointerDown={() => setPressed(true)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
      className="relative flex items-center justify-center"
      style={{
        width: size, height: size, borderRadius: size / 2,
        pointerEvents: hidden ? 'none' : 'auto',
        opacity: hidden ? 0 : 1,
        transform: `scale(${hidden ? 0.7 : pressed ? 1.12 : 1})`,
        transition: `transform 320ms ${SPRING}, opacity 220ms ease, filter 200ms ease`,
        filter: pressed ? 'brightness(1.06)' : 'none',
        WebkitTapHighlightColor: 'transparent',
        // Vetro: velo chiaro + sfocatura e saturazione di ciò che sta sotto.
        background: 'rgba(255,255,255,0.30)',
        backdropFilter: 'blur(12px) saturate(1.9) brightness(1.04)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.9) brightness(1.04)',
        // Bordo di luce, riflesso in alto a sinistra, rilievo in basso a destra, ombra.
        boxShadow: [
          'inset 0 0 0 0.5px rgba(255,255,255,0.65)',
          'inset 1.5px 1.5px 1px -1px rgba(255,255,255,0.95)',
          'inset -1.5px -1.5px 1px -1px rgba(255,255,255,0.55)',
          '0 0 0 0.5px rgba(0,0,0,0.07)',
          '0 6px 18px rgba(20,14,8,0.14)',
        ].join(', '),
      }}>
      {/* Riflesso curvo della superficie. */}
      <span aria-hidden className="pointer-events-none absolute inset-0"
        style={{ borderRadius: 'inherit', background: 'radial-gradient(120% 90% at 28% 12%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 42%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.18) 100%)' }} />
      <span className="relative flex items-center justify-center">{children}</span>
    </button>
  )
}
