'use client'

/**
 * VerticalNotepadMenu — sfoglio verticale realistico (stile Reels).
 *
 * Differenze rispetto a un semplice perno rigido:
 *  • La pagina non ruota come un blocco: durante il volteggio riceve un'ombreggiatura
 *    dinamica (curl + ombra proiettata) che simula la flessione/curvatura della carta.
 *  • Swipe corto e iper-reattivo: una soglia bassa o un flick rapido completano
 *    automaticamente lo sfoglio (su = pagina successiva, giù = precedente).
 *  • Drag pilotato in modo imperativo (transform applicate direttamente al DOM via
 *    ref, niente re-render React per frame) per 60fps stabili su iOS/Android.
 *
 * Rilegatura in alto (transform-origin: top center); il foglio ruota su rotateX.
 * Componente isolato e autonomo: nessuna dipendenza dal flipbook orizzontale.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface NotepadPage {
  id: string
  content: React.ReactNode
  back?: React.ReactNode
  background?: string
}

interface VerticalNotepadMenuProps {
  pages: NotepadPage[]
  accent?: string
  pageBackground?: string
  pageBackBackground?: string
  onPageChange?: (index: number) => void
}

// ── Tuning ──────────────────────────────────────────────────────────────────
const FLIP_MS         = 460          // durata animazione di completamento/rientro
const FLIP_EASE       = 'cubic-bezier(.33,.78,.3,1)'
const SHORT_DIST_PX   = 42           // soglia bassa "short swipe" (Reels-style)
const FLICK_VEL       = 0.32         // px/ms — un flick rapido completa comunque
const DRAG_TRAVEL     = 0.55         // frazione di altezza per arrivare a fine corsa
const EDGE_RUBBER     = 0.07         // resistenza ai bordi (prima/ultima pagina)
const ONBOARD_MS      = 5000
const PEEK_PROGRESS   = 0.16
const PEEK_HOLD_MS    = 720

type Dir = 'up' | 'down'

export default function VerticalNotepadMenu({
  pages,
  accent = '#c9a96e',
  pageBackground = '#f7f3ea',
  pageBackBackground = '#e8e1d2',
  onPageChange,
}: VerticalNotepadMenuProps) {
  const [index, setIndex] = useState(0)
  const total = pages.length

  const rootRef = useRef<HTMLDivElement>(null)

  // Fogli attivi nello stack: precedente (sopra, ribaltato), corrente, successivo (sotto).
  const curRef  = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLDivElement>(null)
  const prevRef = useRef<HTMLDivElement>(null)
  // Overlay di ombreggiatura — pilotati in modo imperativo durante il drag.
  const curCurlRef  = useRef<HTMLDivElement>(null)  // curvatura del foglio corrente (su)
  const curCastRef  = useRef<HTMLDivElement>(null)  // ombra ricevuta dal foglio precedente (giù)
  const curBackRef  = useRef<HTMLDivElement>(null)  // ombra sul retro del corrente
  const nextCastRef = useRef<HTMLDivElement>(null)  // ombra proiettata sul successivo (su)
  const prevCurlRef = useRef<HTMLDivElement>(null)  // curvatura del foglio precedente (giù)
  const prevBackRef = useRef<HTMLDivElement>(null)  // ombra sul retro del precedente

  // Stato del gesto / animazione — in ref per non innescare render.
  const busyRef    = useRef(false)
  const draggingRef= useRef(false)
  const dirRef     = useRef<Dir | null>(null)
  const startYRef  = useRef(0)
  const lastYRef   = useRef(0)
  const lastTRef   = useRef(0)
  const velRef     = useRef(0)
  const heightRef  = useRef(1)
  const interactedRef = useRef(false)

  const hasNext = index < total - 1
  const hasPrev = index > 0

  // ── Applica una configurazione visiva (transform + overlay) in modo imperativo.
  //    p = 0 → foglio a riposo;  p = 1 → sfoglio completato nella direzione `dir`.
  function setTransition(on: boolean) {
    const t = on ? `transform ${FLIP_MS}ms ${FLIP_EASE}` : 'none'
    const o = on ? `opacity ${FLIP_MS}ms ${FLIP_EASE}` : 'none'
    ;[curRef, nextRef, prevRef].forEach(r => { if (r.current) r.current.style.transition = t })
    ;[curCurlRef, curCastRef, curBackRef, nextCastRef, prevCurlRef, prevBackRef]
      .forEach(r => { if (r.current) r.current.style.transition = o })
  }

  function applyVisual(dir: Dir, p: number) {
    const bell = Math.sin(Math.min(Math.max(p, 0), 1) * Math.PI) // 0→1→0, picco a metà
    if (dir === 'up') {
      // Il foglio corrente si solleva dal bordo inferiore e ribalta sopra la rilegatura.
      if (curRef.current)  curRef.current.style.transform  = `rotateX(${-180 * p}deg)`
      if (curCurlRef.current)  curCurlRef.current.style.opacity  = String(bell * 0.5)
      if (curBackRef.current)  curBackRef.current.style.opacity  = String(clamp((p - 0.5) * 2) * 0.4)
      if (nextCastRef.current) nextCastRef.current.style.opacity = String(bell * 0.55)
    } else {
      // Il foglio precedente ridiscende dall'alto sopra il corrente.
      if (prevRef.current)  prevRef.current.style.transform  = `rotateX(${-180 + 180 * p}deg)`
      if (prevCurlRef.current) prevCurlRef.current.style.opacity = String(bell * 0.5)
      if (prevBackRef.current) prevBackRef.current.style.opacity = String(clamp((0.5 - p) * 2) * 0.4)
      if (curCastRef.current)  curCastRef.current.style.opacity  = String(bell * 0.55)
    }
  }

  // ── Reset allo stato di riposo per l'indice corrente (nessun flash al cambio pagina).
  useLayoutEffect(() => {
    setTransition(false)
    if (curRef.current)  curRef.current.style.transform  = 'rotateX(0deg)'
    if (nextRef.current) nextRef.current.style.transform = 'rotateX(0deg)'
    if (prevRef.current) prevRef.current.style.transform = 'rotateX(-180deg)'
    ;[curCurlRef, curCastRef, curBackRef, nextCastRef, prevCurlRef, prevBackRef]
      .forEach(r => { if (r.current) r.current.style.opacity = '0' })
    busyRef.current = false
    dirRef.current  = null
  }, [index, total])

  // ── Commit / snap-back ──────────────────────────────────────────────────────
  function commit(dir: Dir) {
    busyRef.current = true
    setTransition(true)
    applyVisual(dir, 1)
    window.setTimeout(() => {
      const nextIndex = dir === 'up' ? index + 1 : index - 1
      onPageChange?.(nextIndex)
      setIndex(nextIndex)   // il layout-effect resetta i transform senza transizione
    }, FLIP_MS)
  }

  function snapBack(dir: Dir) {
    busyRef.current = true
    setTransition(true)
    applyVisual(dir, 0)
    window.setTimeout(() => { busyRef.current = false; setTransition(false); dirRef.current = null }, FLIP_MS)
  }

  // ── Gesture (Pointer Events: touch + mouse, così è testabile anche da desktop) ──
  function onPointerDown(e: React.PointerEvent) {
    if (busyRef.current) return
    interactedRef.current = true
    draggingRef.current = true
    dirRef.current = null
    startYRef.current = lastYRef.current = e.clientY
    lastTRef.current = performance.now()
    velRef.current = 0
    heightRef.current = rootRef.current?.clientHeight || window.innerHeight || 1
    setTransition(false)
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop */ }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return
    const y  = e.clientY
    const dy = startYRef.current - y               // >0 = dito verso l'alto
    const now = performance.now()
    const dt  = now - lastTRef.current
    if (dt > 0) velRef.current = (lastYRef.current - y) / dt   // >0 = verso l'alto
    lastYRef.current = y
    lastTRef.current = now

    // Blocca la direzione al primo movimento significativo.
    if (!dirRef.current) {
      if (Math.abs(dy) < 5) return
      dirRef.current = dy > 0 ? 'up' : 'down'
    }
    const dir = dirRef.current
    const able = dir === 'up' ? hasNext : hasPrev
    const travel = Math.abs(dy) / (heightRef.current * DRAG_TRAVEL)
    const p = able ? clamp(travel) : clamp(travel) * EDGE_RUBBER  // resistenza ai bordi
    applyVisual(dir, p)
  }

  function endGesture() {
    if (!draggingRef.current) return
    draggingRef.current = false
    const dir = dirRef.current
    if (!dir) return
    const able = dir === 'up' ? hasNext : hasPrev
    const dist = Math.abs(startYRef.current - lastYRef.current)
    const vel  = velRef.current
    const flickRight = dir === 'up' ? vel > FLICK_VEL : vel < -FLICK_VEL
    const go = able && (dist > SHORT_DIST_PX || flickRight)
    if (go) commit(dir)
    else    snapBack(dir)
  }

  // ── Onboarding nudge: dopo 5s di inattività il foglio "occhieggia" il retro. ──
  useEffect(() => {
    if (interactedRef.current || !hasNext) return
    let down: ReturnType<typeof setTimeout> | undefined
    const up = setTimeout(() => {
      if (busyRef.current || draggingRef.current) return
      setTransition(true)
      applyVisual('up', PEEK_PROGRESS)
      down = setTimeout(() => { applyVisual('up', 0); setTimeout(() => setTransition(false), FLIP_MS) }, PEEK_HOLD_MS)
    }, ONBOARD_MS)
    return () => { clearTimeout(up); if (down) clearTimeout(down) }
  }, [index, hasNext]) // eslint-disable-line react-hooks/exhaustive-deps

  const back = (pg?: NotepadPage) => pg?.back ?? <div className="np-back-default" />

  return (
    <div
      ref={rootRef}
      className="np-root"
      style={{ perspective: '1600px' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onPointerLeave={endGesture}
    >
      {/* Successivo — statico sotto, si scopre mentre il corrente si solleva. */}
      {hasNext && (
        <Sheet zIndex={1} sheetRef={nextRef} bg={pages[index + 1].background ?? pageBackground}
               front={pages[index + 1].content} back={back(pages[index + 1])} backBg={pages[index + 1].background ?? pageBackBackground}
               castRef={nextCastRef} />
      )}

      {/* Corrente — foglio attivo per lo swipe verso l'alto. */}
      <Sheet zIndex={2} sheetRef={curRef} bg={pages[index].background ?? pageBackground}
             front={pages[index].content} back={back(pages[index])} backBg={pages[index].background ?? pageBackBackground}
             curlRef={curCurlRef} castRef={curCastRef} backShadeRef={curBackRef} />

      {/* Precedente — ribaltato sopra la rilegatura, ridiscende sullo swipe verso il basso. */}
      {hasPrev && (
        <Sheet zIndex={3} sheetRef={prevRef} bg={pages[index - 1].background ?? pageBackground}
               front={pages[index - 1].content} back={back(pages[index - 1])} backBg={pages[index - 1].background ?? pageBackBackground}
               curlRef={prevCurlRef} backShadeRef={prevBackRef} initialAngle={-180} />
      )}

      {/* Indicatori di progresso verticali. */}
      <div className="np-progress">
        {pages.map((_, i) => (
          <span key={i} className="np-dot" style={{ background: i === index ? accent : 'rgba(255,255,255,0.22)' }} />
        ))}
      </div>

      {/* Invito allo swipe — chevron pulsante (scompare all'ultima pagina). */}
      {hasNext && (
        <div className="np-hint" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 15 12 9 18 15" />
          </svg>
        </div>
      )}

      <style jsx>{`
        .np-root { position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none; -webkit-tap-highlight-color: transparent; }
        .np-progress { position: absolute; top: 50%; right: 10px; transform: translateY(-50%); display: flex; flex-direction: column; gap: 6px; z-index: 40; pointer-events: none; }
        .np-dot { width: 6px; height: 6px; border-radius: 50%; transition: background .25s ease; }
        .np-hint { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 40; animation: np-pulse 1.7s ease-in-out infinite; pointer-events: none; }
        @keyframes np-pulse { 0%,100% { opacity:.35; transform: translateX(-50%) translateY(0); } 50% { opacity:1; transform: translateX(-50%) translateY(-6px); } }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Foglio singolo: fronte + retro, con overlay di curvatura/ombra agganciati via ref.
// ─────────────────────────────────────────────────────────────────────────────
function Sheet({
  zIndex, sheetRef, bg, backBg, front, back, initialAngle = 0,
  curlRef, castRef, backShadeRef,
}: {
  zIndex: number
  sheetRef: React.RefObject<HTMLDivElement>
  bg: string
  backBg: string
  front: React.ReactNode
  back: React.ReactNode
  initialAngle?: number
  curlRef?: React.RefObject<HTMLDivElement>
  castRef?: React.RefObject<HTMLDivElement>
  backShadeRef?: React.RefObject<HTMLDivElement>
}) {
  return (
    <div
      ref={sheetRef}
      className="np-sheet"
      style={{
        position: 'absolute', inset: 0, zIndex,
        transformOrigin: 'top center',
        transformStyle: 'preserve-3d',
        transform: `rotateX(${initialAngle}deg)`,
        willChange: 'transform',
      }}
    >
      <div className="np-face np-front" style={{ background: bg }}>
        {front}
        {/* Curvatura: ombra che attraversa il foglio mentre flette (picco a metà sfoglio). */}
        {curlRef && <div ref={curlRef} className="np-curl" style={{ opacity: 0 }} />}
        {/* Ombra ricevuta da un foglio che si solleva sopra questo. */}
        {castRef && <div ref={castRef} className="np-cast" style={{ opacity: 0 }} />}
      </div>

      <div className="np-face np-back" style={{ background: backBg }}>
        {back}
        {backShadeRef && <div ref={backShadeRef} className="np-back-shade" style={{ opacity: 0 }} />}
      </div>

      <style jsx>{`
        .np-face { position: absolute; inset: 0; overflow: hidden; backface-visibility: hidden; -webkit-backface-visibility: hidden; box-shadow: 0 14px 34px rgba(0,0,0,.28); }
        .np-back { transform: rotateX(180deg); }
        .np-back-default { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(0,0,0,.03) 0, rgba(0,0,0,.03) 1px, transparent 1px, transparent 28px); }
        .np-curl { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to top, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 42%, rgba(255,255,255,.10) 70%, rgba(0,0,0,0) 100%); }
        .np-cast { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to bottom, rgba(0,0,0,.6), rgba(0,0,0,0) 55%); }
        .np-back-shade { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to top, rgba(0,0,0,.4), rgba(0,0,0,0) 60%); }
      `}</style>
    </div>
  )
}

function clamp(n: number, min = 0, max = 1) { return Math.min(max, Math.max(min, n)) }
