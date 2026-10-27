'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Superfici in vetro, ispirate al "Liquid Glass" di iOS: velo chiaro che sfoca
// e satura ciò che c'è sotto, riflesso in alto a sinistra, bordo di luce sottile
// e ombra morbida. Alla pressione i tasti si gonfiano appena con un rimbalzo,
// i pannelli si aprono "crescendo" dal tasto che li ha chiamati.
// Pensato per tutti i comandi in sovraimpressione del menu.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

export const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const GLASS_INK = '#1d1915'

/**
 * Stile di base del vetro. Poco velo e poca sfocatura (si intravede ciò che
 * sta sotto, schiarito; saturazione moderata: sulla carta crema di più
 * ingiallirebbe il vetro), bordo di luce netto, spessore ai bordi
 * (chiaro in alto, appena scuro in basso), ombra morbida.
 */
export function glassSurface(strength: 'light' | 'panel' = 'light'): React.CSSProperties {
  const panel = strength === 'panel'
  const filter = panel
    ? 'blur(12px) saturate(1.5) brightness(1.08)'
    : 'blur(2.5px) saturate(1.5) brightness(1.1) contrast(1.04)'
  return {
    background: panel
      ? 'linear-gradient(180deg, rgba(255,255,255,0.42), rgba(250,247,241,0.28))'
      : 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.03))',
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
    boxShadow: [
      'inset 0 0 0 1px rgba(255,255,255,0.55)',              // bordo di luce
      'inset 1.5px 2px 1.5px -1px rgba(255,255,255,1)',       // spigolo illuminato in alto a sinistra
      'inset -1.5px -2px 1.5px -1px rgba(255,255,255,0.6)',   // riflesso in basso a destra
      'inset 0 10px 14px -10px rgba(255,255,255,0.75)',       // spessore: luce che entra dall'alto
      'inset 0 -10px 14px -10px rgba(40,28,14,0.10)',         // spessore: ombra del vetro in basso
      '0 0 0 0.5px rgba(0,0,0,0.08)',
      panel ? '0 18px 50px rgba(20,14,8,0.22)' : '0 8px 22px rgba(20,14,8,0.16), 0 1px 3px rgba(20,14,8,0.10)',
    ].join(', '),
  }
}

/**
 * Vetro per le superfici della scheda prodotto:
 *  • clear   → vetro chiaro: sfocatura media, il menu dietro si intuisce ma
 *              non si legge (zona con foto, nome e prezzo, testi grandi);
 *  • frosted → vetro smerigliato: sfocatura forte e velo chiaro, il testo da
 *              leggere (descrizione, allergeni) non ha niente dietro che disturbi.
 */
export function glassSheet(kind: 'clear' | 'frosted'): React.CSSProperties {
  const filter = kind === 'clear'
    ? 'blur(8px) saturate(1.35) brightness(1.08)'
    : 'blur(18px) saturate(1.4) brightness(1.1)'
  return {
    background: kind === 'clear'
      ? 'linear-gradient(180deg, rgba(255,253,249,0.52), rgba(255,253,249,0.44))'
      : 'rgba(252,249,243,0.66)',
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
  }
}

/** Riflessi della superficie (da mettere come primo figlio): una luce curva in
 *  alto a sinistra e una più tenue che ritorna dal bordo in basso. */
export function GlassSheen() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0"
      style={{
        borderRadius: 'inherit',
        background: [
          'radial-gradient(90% 60% at 30% 0%, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.18) 45%, rgba(255,255,255,0) 70%)',
          'radial-gradient(70% 45% at 70% 108%, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0) 70%)',
        ].join(', '),
      }} />
  )
}

interface ButtonProps {
  label:    string
  onClick:  () => void
  children: React.ReactNode
  size?:    number
  /** Pillola con testo (larghezza libera) invece del cerchio. */
  pill?:    boolean
  /** Nascosto con dissolvenza (resta al suo posto, non cliccabile). */
  hidden?:  boolean
  expanded?: boolean
}

export function GlassButton({ label, onClick, children, size = 40, pill = false, hidden = false, expanded }: ButtonProps) {
  const [pressed, setPressed] = useState(false)
  const release = () => setPressed(false)
  return (
    <button type="button" aria-label={label} aria-hidden={hidden || undefined} tabIndex={hidden ? -1 : 0}
      aria-expanded={expanded}
      onClick={onClick}
      onPointerDown={() => setPressed(true)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
      className="relative flex items-center justify-center shrink-0"
      style={{
        ...glassSurface(),
        height: size, minWidth: size, borderRadius: size / 2,
        padding: pill ? '0 15px 0 13px' : 0,
        pointerEvents: hidden ? 'none' : 'auto',
        opacity: hidden ? 0 : 1,
        transform: `scale(${hidden ? 0.7 : pressed ? 1.1 : 1})`,
        transition: `transform 320ms ${SPRING}, opacity 220ms ease, filter 200ms ease`,
        filter: pressed ? 'brightness(1.06)' : 'none',
        color: GLASS_INK,
        WebkitTapHighlightColor: 'transparent',
      }}>
      <GlassSheen />
      <span className="relative flex items-center justify-center" style={{ gap: 7 }}>{children}</span>
    </button>
  )
}

/**
 * Pannello a tendina (come i menu contestuali di iOS): cresce dall'angolo del
 * tasto che lo apre, si chiude toccando fuori. Resta montato il tempo
 * dell'animazione di chiusura.
 */
export function GlassMenu({ open, onClose, align, edge, bottom, title, children }: {
  open:     boolean
  onClose:  () => void
  align:    'left' | 'right'
  /** Distanza (px) dal bordo sinistro/destro: il pannello parte dal suo tasto. */
  edge:     number
  /** Distanza dal fondo dello schermo (il pannello si apre verso l'alto). */
  bottom:   string
  title?:   string
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(r)
    }
    setShown(false)
    const tm = window.setTimeout(() => setMounted(false), 220)
    return () => clearTimeout(tm)
  }, [open])
  if (!mounted) return null
  return (
    <>
      <div className="fixed inset-0" style={{ zIndex: 44 }} onClick={onClose} />
      <div role="menu" className="fixed overflow-hidden"
        style={{
          ...glassSurface('panel'),
          zIndex: 45, bottom, [align]: Math.max(12, edge),
          minWidth: 232, maxWidth: 'calc(100vw - 24px)', maxHeight: '60vh', overflowY: 'auto',
          borderRadius: 24, padding: '6px 0',
          transformOrigin: `${align} bottom`,
          transform: shown ? 'scale(1)' : 'scale(0.55)',
          opacity: shown ? 1 : 0,
          transition: shown ? `transform 380ms ${SPRING}, opacity 180ms ease` : 'transform 200ms ease, opacity 180ms ease',
        }}>
        <GlassSheen />
        {title && (
          <div className="relative" style={{ padding: '8px 18px 6px', fontFamily: '"Inter", -apple-system, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(29,25,21,0.45)' }}>
            {title}
          </div>
        )}
        <div className="relative">{children}</div>
      </div>
    </>
  )
}

export function GlassMenuItem({ icon, label, checked, onClick }: {
  icon?:    React.ReactNode
  label:    string
  checked?: boolean
  onClick:  () => void
}) {
  return (
    <button type="button" role="menuitemradio" aria-checked={!!checked} onClick={onClick}
      className="w-full flex items-center text-left active:bg-black/5 transition-colors"
      style={{ gap: 12, padding: '11px 18px', minHeight: 46, fontFamily: '"Inter", -apple-system, sans-serif', fontSize: 16, color: GLASS_INK, WebkitTapHighlightColor: 'transparent' }}>
      <span className="shrink-0 flex items-center justify-center" style={{ width: 16 }}>
        {checked && (
          <svg width="14" height="11" viewBox="0 0 14 11" aria-hidden><path d="M1.5 5.8l3.8 3.7L12.5 1.5" fill="none" stroke={GLASS_INK} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
      </span>
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span className="flex-1 min-w-0 truncate">{label}</span>
    </button>
  )
}
