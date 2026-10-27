'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Scheda del piatto, come la scheda di un libro nell'app Libri.
//
//  • Si apre salendo dal basso: una scheda quasi a tutto schermo (staccata dai
//    bordi, angoli tondi), con il menu che si scurisce dietro.
//  • Scorrendo per leggere, nei primi EXPAND px la scheda si allarga fino a
//    tutto schermo; tornando su si rimpicciolisce alla misura iniziale.
//  • Arrivati in cima, tirando ancora verso il basso la scheda segue il dito e,
//    lasciata oltre la soglia (o con un gesto deciso), si chiude.
//
// La scheda è sempre grande quanto lo schermo: la misura "staccata" si ottiene
// con transform (scala + spostamento), così lo scorrimento resta nativo e il
// testo non viene mai reimpaginato mentre la scheda cambia misura.
// Tutte le animazioni scrivono lo stile direttamente (niente render React a
// ogni fotogramma).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PAPER, SERIF, SANS, type Dish } from './typeset'

const EXPAND = 96          // px di scorrimento per arrivare a tutto schermo
const CLOSE_PULL = 110     // px di trascinamento oltre la cima per chiudere

const CARD    = '#fffdf9'
const SECTION = '#f3eee5'
const INK     = '#1d1915'
const SOFT    = '#6a6157'
const ACCENT  = '#9a8462'
const LINE    = 'rgba(29,25,21,0.09)'

const priceFmt = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const price = (p: number | null) => (p === null || isNaN(p) ? '' : `${priceFmt.format(p)} €`)

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t) }
const easeOutQuint = (x: number) => 1 - Math.pow(1 - x, 5)
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const easeOutQuad = (x: number) => 1 - (1 - x) * (1 - x)

interface Props {
  dish:      Dish | null
  /** Altri piatti della stessa categoria (per "Altri piatti"). */
  siblings:  (d: Dish) => Dish[]
  onClosed:  () => void
  /** Chiamata a ogni fotogramma con 0..1 (presenza della scheda): il menu dietro si scurisce/arretra. */
  onPresence?: (o: number) => void
}

export default function DishCard({ dish: initial, siblings, onClosed, onPresence }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const cardRef     = useRef<HTMLDivElement>(null)
  const scrollRef   = useRef<HTMLDivElement>(null)
  const closeRef    = useRef<HTMLButtonElement>(null)
  const contentRef  = useRef<HTMLDivElement>(null)
  const probeRef    = useRef<HTMLDivElement>(null)

  const [dish, setDish] = useState<Dish | null>(initial)

  // Stato dell'animazione (fuori da React).
  const st = useRef({
    o: 0,            // presenza 0..1 (apertura/chiusura)
    pull: 0,         // trascinamento verso il basso oltre la cima (px)
    closing: false,
    raf: 0,
    tween: null as null | { key: 'o' | 'pull'; from: number; to: number; t0: number; dur: number; ease: (x: number) => number; done?: () => void },
  })

  // ── Geometria: applica o, pull e lo scorrimento allo stile.
  const apply = useCallback(() => {
    const card = cardRef.current, sc = scrollRef.current, bd = backdropRef.current, x = closeRef.current, probe = probeRef.current
    if (!card || !sc || !bd || !x || !probe) return
    const W = window.innerWidth, H = window.innerHeight
    const cs = getComputedStyle(probe)
    const safeTop = parseFloat(cs.paddingTop) || 0
    const wide = W >= 700
    const s = st.current
    const p = smooth(Math.max(0, sc.scrollTop) / EXPAND)          // 0 staccata → 1 tutto schermo
    const cardW = wide ? Math.min(760, W - 64) : W
    const safeBottom = parseFloat(cs.paddingBottom) || 0
    // Staccata: stesso margine ai lati e in basso, sotto la barra di stato in alto.
    const gapB = Math.max(10, safeBottom * 0.5)
    const s0 = wide ? 1 : Math.min((W - 20) / W, (H - safeTop - 10 - gapB) / H)
    const top0 = wide ? safeTop + 36 : H - gapB - H * s0
    const scale = s0 + (1 - s0) * p
    const top = top0 * (1 - p)
    const r = (wide ? 22 : 30) * (1 - p) + (wide ? 22 * p : 0)
    // Entrata/uscita dal basso + trascinamento per chiudere.
    const enter = (1 - s.o) * (H + 40)
    const y = top + enter + s.pull
    card.style.width = `${cardW}px`
    card.style.left = `${(W - cardW) / 2}px`
    card.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(5)})`
    card.style.borderRadius = `${(r / scale).toFixed(2)}px`
    // Ombra della scheda solo da staccata (a tutto schermo non serve).
    card.style.boxShadow = `0 -2px 30px rgba(20,14,8,${(0.16 * (1 - p)).toFixed(3)})`
    // Il tasto chiudi scende sotto la barra di stato quando la scheda tocca il bordo.
    x.style.transform = `translate3d(0, ${(safeTop * p).toFixed(2)}px, 0)`
    const fade = 1 - Math.min(1, s.pull / (CLOSE_PULL * 2.2))
    bd.style.opacity = (s.o * fade).toFixed(3)
    onPresence?.(s.o * fade)
  }, [onPresence])

  const loop = useCallback(() => {
    const s = st.current
    s.raf = 0
    const tw = s.tween
    if (tw) {
      const k = Math.min(1, (performance.now() - tw.t0) / tw.dur)
      s[tw.key] = tw.from + (tw.to - tw.from) * tw.ease(k)
      if (k >= 1) { s.tween = null; apply(); tw.done?.(); return }
      s.raf = requestAnimationFrame(loop)
    }
    apply()
  }, [apply])

  const tweenTo = useCallback((key: 'o' | 'pull', to: number, dur: number, ease: (x: number) => number, done?: () => void) => {
    const s = st.current
    s.tween = { key, from: s[key], to, t0: performance.now(), dur, ease, done }
    if (!s.raf) s.raf = requestAnimationFrame(loop)
  }, [loop])

  const close = useCallback((velocity = 0) => {
    const s = st.current
    if (s.closing) return
    s.closing = true
    // La scheda prosegue verso il basso: "o" scende, "pull" resta dov'è. Dopo
    // un gesto deciso parte già veloce; dal tasto accelera e frena.
    const flick = Math.abs(velocity) > 0.3
    const dur = flick ? Math.max(200, 320 - Math.min(120, Math.abs(velocity) * 90)) : 380
    tweenTo('o', 0, dur, flick ? easeOutQuad : easeInOut, () => onClosed())
  }, [onClosed, tweenTo])

  // ── Apertura
  useLayoutEffect(() => {
    apply()
    tweenTo('o', 1, 520, easeOutQuint)
    const s = st.current
    return () => { cancelAnimationFrame(s.raf); s.raf = 0 }
  }, [apply, tweenTo])

  // ── Gesti: scorrimento (allarga), trascinamento in cima (chiude), tastiera, rotella.
  useEffect(() => {
    const sc = scrollRef.current!
    const s = st.current
    let touch: null | { x0: number; y0: number; armed: boolean; pulling: boolean; last: { y: number; t: number }[]; bounceClose: boolean } = null

    const onScroll = () => {
      // iOS: rimbalzo oltre la cima durante un gesto iniziato più in basso.
      if (touch && sc.scrollTop < -CLOSE_PULL * 0.6) touch.bounceClose = true
      if (!s.raf) s.raf = requestAnimationFrame(loop)
    }
    const onStart = (e: TouchEvent) => {
      if (s.closing || e.touches.length > 1) return
      const y = e.touches[0].clientY
      touch = { x0: e.touches[0].clientX, y0: y, armed: sc.scrollTop <= 0, pulling: false, last: [{ y, t: e.timeStamp }], bounceClose: false }
      if (s.tween?.key === 'pull') s.tween = null
    }
    const onMove = (e: TouchEvent) => {
      if (!touch || s.closing) return
      const y = e.touches[0].clientY
      touch.last.push({ y, t: e.timeStamp }); if (touch.last.length > 5) touch.last.shift()
      const dy = y - touch.y0
      if (!touch.pulling) {
        if (!touch.armed || sc.scrollTop > 0) return
        if (dy < 0) { touch.armed = false; return }      // verso l'alto: scorrimento normale
        if (dy < 4) return
        // Gesto orizzontale (es. "Altri piatti"): non è una chiusura.
        if (Math.abs(e.touches[0].clientX - touch.x0) > dy) { touch.armed = false; return }
        touch.pulling = true
        touch.y0 = y
      }
      if (e.cancelable) e.preventDefault()
      s.pull = Math.max(0, y - touch.y0)
      if (!s.raf) s.raf = requestAnimationFrame(loop)
    }
    const onEnd = () => {
      if (!touch) return
      const t = touch
      touch = null
      if (t.bounceClose) { close(0.8); return }
      if (!t.pulling) return
      const a = t.last[0], b = t.last[t.last.length - 1]
      const v = b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0       // px/ms, positivo = in giù
      if ((s.pull > CLOSE_PULL && v > -0.1) || v > 0.65) close(v)
      else tweenTo('pull', 0, 340, easeOutQuint)
    }
    // Rotella/trackpad: in cima, una spinta decisa verso l'alto chiude.
    let wheelAcc = 0, wheelTimer = 0
    const onWheel = (e: WheelEvent) => {
      if (sc.scrollTop > 0 || e.deltaY >= 0) { wheelAcc = 0; return }
      wheelAcc += -e.deltaY
      clearTimeout(wheelTimer); wheelTimer = window.setTimeout(() => { wheelAcc = 0 }, 220)
      if (wheelAcc > 160) close()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const onResize = () => apply()

    sc.addEventListener('scroll', onScroll, { passive: true })
    sc.addEventListener('touchstart', onStart, { passive: true })
    sc.addEventListener('touchmove', onMove, { passive: false })
    sc.addEventListener('touchend', onEnd)
    sc.addEventListener('touchcancel', onEnd)
    sc.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(wheelTimer)
      sc.removeEventListener('scroll', onScroll)
      sc.removeEventListener('touchstart', onStart)
      sc.removeEventListener('touchmove', onMove)
      sc.removeEventListener('touchend', onEnd)
      sc.removeEventListener('touchcancel', onEnd)
      sc.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [apply, close, loop, tweenTo])

  // ── Passaggio a un altro piatto (abbinamento, "Altri piatti"): dissolvenza
  // del contenuto e ritorno morbido in cima (la scheda torna alla misura iniziale).
  const goTo = useCallback((d: Dish) => {
    const c = contentRef.current, sc = scrollRef.current
    if (!c || !sc) return
    if (d.image) { const im = new Image(); im.src = d.image }
    c.style.transition = 'opacity 140ms ease'
    c.style.opacity = '0'
    window.setTimeout(() => {
      setDish(d)
      requestAnimationFrame(() => {
        sc.scrollTo({ top: 0, behavior: 'smooth' })
        c.style.transition = 'opacity 260ms ease'
        c.style.opacity = '1'
      })
    }, 150)
  }, [])

  if (!dish) return null
  const others = siblings(dish).filter(d => d.id !== dish.id)
  const pairing = dish.pairing

  return (
    <div className="fixed inset-0 z-50">
      <div ref={probeRef} aria-hidden className="pointer-events-none fixed inset-0 invisible"
        style={{ padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }} />
      {/* Fondo: scurisce il menu; un tocco fuori dalla scheda la chiude. */}
      <div ref={backdropRef} className="absolute inset-0" style={{ background: 'rgba(24,18,12,0.42)', opacity: 0 }}
        onClick={() => close()} />

      <div ref={cardRef} role="dialog" aria-modal="true" aria-label={dish.name}
        className="absolute top-0 overflow-hidden"
        style={{ height: '100%', background: CARD, transformOrigin: '50% 0', willChange: 'transform', transform: 'translate3d(0,120vh,0)' }}>

        <div ref={scrollRef} className="absolute inset-0 overflow-y-auto"
          style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
          <div ref={contentRef} style={{ minHeight: `calc(100% + ${EXPAND}px)`, display: 'flex', flexDirection: 'column' }}>
            <Header key={dish.id} dish={dish} />
            <section style={{ background: SECTION, flex: 1, paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)' }}>
              <div className="mx-auto" style={{ maxWidth: 560, padding: '30px 24px 0' }}>
                {dish.description && (
                  <Block title="Descrizione">
                    <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 20, lineHeight: 1.45, color: INK, whiteSpace: 'pre-line' }}>
                      {dish.description}
                    </p>
                  </Block>
                )}

                {pairing && (
                  <Block title={pairing.label || 'Abbinamento consigliato'}>
                    <button type="button" onClick={() => goTo(pairing.dish)}
                      className="w-full flex items-center text-left active:opacity-60 transition-opacity"
                      style={{ gap: 14, background: CARD, borderRadius: 16, padding: 12, border: `1px solid ${LINE}` }}>
                      <Thumb dish={pairing.dish} size={56} />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate" style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 19, color: INK }}>{pairing.dish.name}</span>
                        <span className="block" style={{ fontFamily: SANS, fontSize: 12, color: SOFT, marginTop: 2 }}>
                          {[pairing.dish.category, price(pairing.dish.price)].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <Chevron />
                    </button>
                  </Block>
                )}

                {dish.allergens.length > 0 && (
                  <Block title="Allergeni">
                    <ul style={{ display: 'grid', gap: 10 }}>
                      {dish.allergens.map(a => (
                        <li key={a.n} className="flex items-center" style={{ gap: 12 }}>
                          <span className="inline-flex items-center justify-center shrink-0"
                            style={{ width: 26, height: 26, borderRadius: 13, border: `1px solid ${ACCENT}`, color: ACCENT, fontFamily: SANS, fontSize: 11, fontWeight: 600 }}>
                            {a.n}
                          </span>
                          <span style={{ fontFamily: SANS, fontSize: 15, color: INK }}>{a.name}</span>
                        </li>
                      ))}
                    </ul>
                  </Block>
                )}

                {others.length > 0 && (
                  <Block title={`Altro in ${dish.category}`}>
                    <div className="flex overflow-x-auto" style={{ gap: 12, margin: '0 -24px', padding: '2px 24px 6px', scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain' }}>
                      {others.map(o => (
                        <button key={o.id} type="button" onClick={() => goTo(o)}
                          className="shrink-0 text-left active:opacity-60 transition-opacity"
                          style={{ width: 132, scrollSnapAlign: 'start' }}>
                          <Thumb dish={o} size={132} />
                          <span className="block" style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, lineHeight: 1.2, color: INK, marginTop: 8 }}>{o.name}</span>
                          {o.price !== null && <span className="block" style={{ fontFamily: SANS, fontSize: 12, color: SOFT, marginTop: 2 }}>{price(o.price)}</span>}
                        </button>
                      ))}
                    </div>
                  </Block>
                )}
              </div>
            </section>
          </div>
        </div>

        <button ref={closeRef} type="button" aria-label="Chiudi" onClick={() => close()}
          className="absolute flex items-center justify-center active:scale-95 transition-transform"
          style={{ top: 14, left: 14, width: 34, height: 34, borderRadius: 17, background: 'rgba(253,251,247,0.78)', boxShadow: `0 0 0 1px ${LINE}, 0 2px 8px rgba(0,0,0,0.08)`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke={INK} strokeWidth="1.7" strokeLinecap="round" /></svg>
        </button>
      </div>
    </div>
  )
}

// ── Parti della scheda ───────────────────────────────────────────────────────

function Header({ dish }: { dish: Dish }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <header className="mx-auto w-full text-center" style={{ maxWidth: 560, padding: '64px 24px 30px', background: CARD }}>
      {dish.image && (
        <div className="mx-auto" style={{ width: 'min(74%, 320px)', marginBottom: 28 }}>
          <div style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 14, overflow: 'hidden', background: SECTION, boxShadow: '0 18px 40px rgba(40,28,14,0.20), 0 2px 6px rgba(40,28,14,0.10)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dish.image} alt="" draggable={false} onLoad={() => setLoaded(true)}
              ref={el => { if (el?.complete && el.naturalWidth && !loaded) setLoaded(true) }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: loaded ? 1 : 0, transition: 'opacity 300ms ease' }} />
          </div>
        </div>
      )}
      <p style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.28em', textTransform: 'uppercase', color: ACCENT }}>
        {dish.category}
      </p>
      <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 34, lineHeight: 1.1, color: INK, margin: '10px 0 0' }}>
        {dish.name}
      </h2>
      {(dish.price !== null || dish.allergens.length > 0) && (
        <div className="mx-auto flex" style={{ marginTop: 24, maxWidth: 380, borderRadius: 18, background: SECTION, padding: '14px 6px' }}>
          {dish.price !== null && <Stat label="Prezzo" value={price(dish.price)} />}
          {dish.price !== null && dish.allergens.length > 0 && <span style={{ width: 1, background: LINE, margin: '4px 0' }} />}
          {dish.allergens.length > 0 && <Stat label="Allergeni" value={dish.allergens.map(a => a.n).join(' · ')} />}
        </div>
      )}
    </header>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 min-w-0" style={{ padding: '0 10px' }}>
      <div style={{ fontFamily: SANS, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: SOFT }}>{label}</div>
      {/* Valori lunghi (molti allergeni): carattere più piccolo e a capo, mai tagliati. */}
      <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: value.length > 10 ? 17 : 22, lineHeight: 1.2, color: INK, marginTop: 4, textWrap: 'balance' } as React.CSSProperties}>{value}</div>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: ACCENT, marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  )
}

function Thumb({ dish, size }: { dish: Dish; size: number }) {
  return (
    <span className="block shrink-0 overflow-hidden" style={{ width: size, height: size, borderRadius: size > 80 ? 12 : 10, background: PAPER, boxShadow: `inset 0 0 0 1px ${LINE}` }}>
      {dish.image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={dish.image} alt="" loading="lazy" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span className="flex items-center justify-center h-full" style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: size * 0.42, color: ACCENT }}>{dish.name.trim().charAt(0)}</span>}
    </span>
  )
}

function Chevron() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden className="shrink-0" style={{ marginRight: 4 }}>
      <path d="M1 1l6 6-6 6" fill="none" stroke={SOFT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
