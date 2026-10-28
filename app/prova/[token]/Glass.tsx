'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Superfici in vetro, ispirate al "Liquid Glass" di iOS: velo chiaro che sfoca
// e satura ciò che c'è sotto, riflesso in alto a sinistra, bordo di luce sottile
// e ombra morbida. Alla pressione i tasti si gonfiano appena con un rimbalzo,
// i pannelli si aprono "crescendo" dal tasto che li ha chiamati.
// Pensato per tutti i comandi in sovraimpressione del menu.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useState } from 'react'

export const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const GLASS_INK = '#1d1915'

/** Tinta del vetro dei comandi (scelta nella Personalizzazione): chiaro, o
 *  scuro con testo bianco (per carte scure o per chi lo preferisce). */
export type GlassTintKind = 'light' | 'dark'
export const GlassTint = createContext<GlassTintKind>('light')
export const glassInk = (tint: GlassTintKind) => (tint === 'dark' ? '#ffffff' : GLASS_INK)

/** Vetro liquido attivo: la superficie la disegna il motore WebGL (pagina
 *  d'apertura, menu) sotto il testo; gli elementi si segnano con data-glass
 *  e lasciano trasparente il proprio fondo. Dove sotto non c'è il disegno
 *  WebGL (es. la scheda del piatto) resta false: vetro dei browser. */
export const LiquidOn = createContext(false)

/**
 * Stile di base del vetro. Poco velo e poca sfocatura (si intravede ciò che
 * sta sotto, schiarito; saturazione moderata: sulla carta crema di più
 * ingiallirebbe il vetro), bordo di luce netto, spessore ai bordi
 * (chiaro in alto, appena scuro in basso), ombra morbida.
 */
export function glassSurface(strength: 'light' | 'panel' = 'light', tint: GlassTintKind = 'light'): React.CSSProperties {
  const panel = strength === 'panel'
  if (tint === 'dark') {
    // Vetro fumé: velo scuro, sfocatura un po' più forte, filo di luce tenue.
    const f = panel ? 'blur(16px) saturate(1.5) brightness(0.82)' : 'blur(12px) saturate(1.5) brightness(0.88)'
    return {
      background: panel
        ? 'linear-gradient(180deg, rgba(38,33,28,0.66), rgba(24,21,18,0.58))'
        : 'linear-gradient(180deg, rgba(38,33,28,0.46), rgba(24,21,18,0.36))',
      backdropFilter: f,
      WebkitBackdropFilter: f,
      boxShadow: [
        'inset 0 1px 0 rgba(255,255,255,0.20)',
        'inset 0 0 0 0.5px rgba(255,255,255,0.12)',
        '0 0 0 0.5px rgba(0,0,0,0.22)',
        panel ? '0 18px 50px rgba(0,0,0,0.35)' : '0 6px 18px rgba(0,0,0,0.20), 0 1px 3px rgba(0,0,0,0.14)',
      ].join(', '),
    }
  }
  // Come il "Liquid Glass" chiaro di iOS 26: poco velo, sfocatura che ravviva i
  // colori di ciò che sta sotto, filo di luce sul bordo alto, contorno
  // sottilissimo e ombra morbida (sulla carta chiara un vetro troppo bianco e
  // lucido sembra plastica).
  const filter = panel
    ? 'blur(14px) saturate(1.7) brightness(1.06)'
    : 'blur(10px) saturate(1.8) brightness(1.04)'
  return {
    background: panel
      ? 'linear-gradient(180deg, rgba(255,255,255,0.46), rgba(250,247,241,0.34))'
      : 'linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0.12))',
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.85)',          // filo di luce in alto
      'inset 0 0 0 0.5px rgba(255,255,255,0.5)',       // bordo del vetro
      'inset 0 -1px 0 rgba(40,28,14,0.04)',            // spessore in basso
      '0 0 0 0.5px rgba(40,28,14,0.09)',               // contorno (stacca dalla carta)
      panel ? '0 18px 50px rgba(20,14,8,0.20)' : '0 6px 18px rgba(40,28,14,0.10), 0 1px 3px rgba(40,28,14,0.08)',
    ].join(', '),
  }
}

/** Riflesso della superficie (da mettere come primo figlio): luce morbida
 *  dall'alto che sfuma a metà, appena un ritorno sul fondo. */
export function GlassSheen() {
  const k = useContext(GlassTint) === 'dark' ? 0.3 : 1
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0"
      style={{
        borderRadius: 'inherit',
        background: `linear-gradient(180deg, rgba(255,255,255,${0.38 * k}) 0%, rgba(255,255,255,${0.06 * k}) 48%, rgba(255,255,255,0) 62%, rgba(255,255,255,${0.10 * k}) 100%)`,
      }} />
  )
}

/**
 * Vetro chiaro per le superfici della scheda prodotto: sfocatura media (il
 * menu dietro si intuisce ma non si legge) e velo chiaro e caldo. La parte
 * bassa della scheda ci aggiunge sopra una velatura che cresce mentre la
 * scheda si allarga (DishCard, --frost).
 */
export function glassSheet(alpha = 0.52): React.CSSProperties {
  const filter = 'blur(8px) saturate(1.35) brightness(1.08)'
  return {
    background: `linear-gradient(180deg, rgba(255,253,249,${alpha}), rgba(255,253,249,${Math.max(0.08, alpha - 0.08)}))`,
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
  }
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
  const tint = useContext(GlassTint)
  const liquid = useContext(LiquidOn)
  const release = () => setPressed(false)
  return (
    <button type="button" aria-label={label} aria-hidden={hidden || undefined} tabIndex={hidden ? -1 : 0}
      aria-expanded={expanded}
      onClick={onClick}
      onPointerDown={() => setPressed(true)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
      data-glass={liquid ? '' : undefined} data-radius={size / 2} data-pressed={pressed ? '1' : '0'}
      className="relative flex items-center justify-center shrink-0"
      style={{
        ...(liquid ? {} : glassSurface('light', tint)),
        height: size, minWidth: size, borderRadius: size / 2,
        padding: pill ? '0 15px 0 13px' : 0,
        pointerEvents: hidden ? 'none' : 'auto',
        opacity: hidden ? 0 : 1,
        transform: `scale(${hidden ? 0.7 : pressed ? 1.1 : 1})`,
        transition: `transform 320ms ${SPRING}, opacity 220ms ease, filter 200ms ease`,
        filter: pressed && !liquid ? 'brightness(1.06)' : 'none',
        color: glassInk(tint),
        WebkitTapHighlightColor: 'transparent',
      }}>
      {!liquid && <GlassSheen />}
      <span className="relative flex items-center justify-center" style={{ gap: 7 }}>{children}</span>
    </button>
  )
}

/**
 * Pannello a tendina (come i menu contestuali di iOS): cresce dall'angolo del
 * tasto che lo apre, si chiude toccando fuori. Resta montato il tempo
 * dell'animazione di chiusura.
 */
export function GlassMenu({ open, onClose, align, edge, bottom, top, title, children }: {
  open:     boolean
  onClose:  () => void
  align:    'left' | 'right'
  /** Distanza (px) dal bordo sinistro/destro: il pannello parte dal suo tasto. */
  edge:     number
  /** Distanza dal fondo dello schermo (il pannello si apre verso l'alto)… */
  bottom?:  string
  /** …oppure dalla cima (si apre verso il basso). */
  top?:     string
  title?:   string
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const tint = useContext(GlassTint)
  const liquid = useContext(LiquidOn)
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
      <div role="menu" className="fixed overflow-hidden" data-glass={liquid ? '' : undefined} data-radius="24" data-panel="1"
        style={{
          ...(liquid ? {} : glassSurface('panel', tint)),
          zIndex: 45, top, bottom: top ? undefined : bottom, [align]: Math.max(12, edge),
          minWidth: 232, maxWidth: 'calc(100vw - 24px)', maxHeight: '60vh', overflowY: 'auto',
          borderRadius: 24, padding: '6px 0',
          transformOrigin: `${align} ${top ? 'top' : 'bottom'}`,
          transform: shown ? 'scale(1)' : 'scale(0.55)',
          opacity: shown ? 1 : 0,
          transition: shown ? `transform 380ms ${SPRING}, opacity 180ms ease` : 'transform 200ms ease, opacity 180ms ease',
        }}>
        {!liquid && <GlassSheen />}
        {title && (
          <div className="relative" style={{ padding: '8px 18px 6px', fontFamily: '"Inter", -apple-system, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: tint === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(29,25,21,0.45)' }}>
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
  const ink = glassInk(useContext(GlassTint))
  return (
    <button type="button" role="menuitemradio" aria-checked={!!checked} onClick={onClick}
      className="w-full flex items-center text-left active:bg-black/5 transition-colors"
      style={{ gap: 12, padding: '11px 18px', minHeight: 46, fontFamily: '"Inter", -apple-system, sans-serif', fontSize: 16, color: ink, WebkitTapHighlightColor: 'transparent' }}>
      <span className="shrink-0 flex items-center justify-center" style={{ width: 16 }}>
        {checked && (
          <svg width="14" height="11" viewBox="0 0 14 11" aria-hidden><path d="M1.5 5.8l3.8 3.7L12.5 1.5" fill="none" stroke={ink} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
      </span>
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span className="flex-1 min-w-0 truncate">{label}</span>
    </button>
  )
}
