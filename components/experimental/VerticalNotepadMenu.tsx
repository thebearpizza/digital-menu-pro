'use client'

/**
 * VerticalNotepadMenu — sfoglio verticale realistico (stile Reels).
 *
 * Modello di interazione:
 *  • Nessun drag-follow: appena il dito si sposta di SWIPE_TRIGGER_PX (5px) in
 *    una direzione, l'intero volteggio parte in automatico (tempo/easing),
 *    indipendente da ulteriori movimenti del dito.
 *  • Curvatura "a bande": il foglio attivo è diviso in N_BANDS strisce
 *    orizzontali, ciascuna con un angolo di arrivo leggermente diverso →
 *    profilo convesso "a rullo" invece di una rotazione rigida a blocco.
 *  • Ombre dinamiche (curl/cast/back-shade) via CSS @keyframes a campana,
 *    sincronizzate con la durata del volteggio.
 *  • Ai bordi (prima/ultima pagina) un micro "rimbalzo" comunica che non c'è
 *    altro da sfogliare in quella direzione.
 *
 * Rilegatura in alto (transform-origin: top center per ogni banda).
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
const N_BANDS            = 12          // bande orizzontali per la curvatura "a rullo"
const FLIP_MS            = 460         // durata animazione di volteggio (sync con i keyframes CSS sotto)
const FLIP_EASE          = 'cubic-bezier(.33,.78,.3,1)'
const SWIPE_TRIGGER_PX   = 5           // spostamento minimo per innescare il volteggio
const EDGE_BOUNCE_PROGRESS = 0.06      // ampiezza del micro-rimbalzo ai bordi
const EDGE_BOUNCE_MS     = 180
const ONBOARD_MS         = 5000
const PEEK_PROGRESS      = 0.16
const PEEK_HOLD_MS       = 720

type Dir = 'up' | 'down'

// Peso per banda: 0 = vicino alla rilegatura, N_BANDS-1 = bordo libero.
function weight(i: number) {
  return 0.85 + (i / (N_BANDS - 1)) * 0.30 // 0.85 → 1.15
}
// Angolo finale (p=1) per ogni banda durante un volteggio verso l'alto (cur → prev).
function bandTargetUp(i: number) {
  return -180 * weight(i)
}
// Angolo finale (p=1) per ogni banda durante un volteggio verso il basso (prev → cur).
function bandTargetDown(i: number) {
  return -180 + 180 * weight(i)
}
// Micro-rimbalzo ai bordi (nessuna pagina nella direzione richiesta).
function bounceTarget(dir: Dir, i: number) {
  const mag = 180 * weight(i) * EDGE_BOUNCE_PROGRESS
  return dir === 'up' ? -mag : mag
}

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

  // Bande del foglio corrente (volteggio verso l'alto) e precedente (verso il basso).
  const curBandRefs  = useRef<(HTMLDivElement | null)[]>([])
  const prevBandRefs = useRef<(HTMLDivElement | null)[]>([])

  // Overlay di ombreggiatura — un solo livello per foglio, sopra lo stack di bande.
  const curCurlRef  = useRef<HTMLDivElement>(null)  // curvatura del foglio corrente (su)
  const curCastRef  = useRef<HTMLDivElement>(null)  // ombra ricevuta dal foglio precedente (giù)
  const curBackRef  = useRef<HTMLDivElement>(null)  // ombra sul retro del corrente
  const nextCastRef = useRef<HTMLDivElement>(null)  // ombra proiettata sul successivo (su)
  const prevCurlRef = useRef<HTMLDivElement>(null)  // curvatura del foglio precedente (giù)
  const prevBackRef = useRef<HTMLDivElement>(null)  // ombra sul retro del precedente

  // Stato del gesto / animazione — in ref per non innescare render.
  const busyRef       = useRef(false)
  const draggingRef   = useRef(false)
  const consumedRef   = useRef(false)
  const startYRef     = useRef(0)
  const interactedRef = useRef(false)

  const hasNext = index < total - 1
  const hasPrev = index > 0

  // ── Reset allo stato di riposo per l'indice corrente (nessun flash al cambio pagina).
  useLayoutEffect(() => {
    curBandRefs.current.forEach(el => {
      if (!el) return
      el.style.transition = 'none'
      el.style.transform  = 'rotateX(0deg)'
    })
    prevBandRefs.current.forEach(el => {
      if (!el) return
      el.style.transition = 'none'
      el.style.transform  = 'rotateX(-180deg)'
    })
    ;[curCurlRef, curCastRef, curBackRef, nextCastRef, prevCurlRef, prevBackRef].forEach(r => {
      if (!r.current) return
      r.current.classList.remove('np-anim-bell-50', 'np-anim-bell-55', 'np-anim-ramp-40')
      r.current.style.transition = 'none'
      r.current.style.opacity = '0'
    })
    busyRef.current = false
  }, [index, total])

  // ── Volteggio completo, guidato da CSS transition/keyframes (FLIP_MS). ─────────
  function commit(dir: Dir) {
    busyRef.current = true
    const bandRefs = dir === 'up' ? curBandRefs.current : prevBandRefs.current
    const targetFn = dir === 'up' ? bandTargetUp : bandTargetDown
    bandRefs.forEach((el, i) => {
      if (!el) return
      el.style.transition = `transform ${FLIP_MS}ms ${FLIP_EASE}`
      el.style.transform  = `rotateX(${targetFn(i)}deg)`
    })

    const curlRef = dir === 'up' ? curCurlRef  : prevCurlRef
    const castRef = dir === 'up' ? nextCastRef : curCastRef
    const backRef = dir === 'up' ? curBackRef  : prevBackRef
    curlRef.current?.classList.add('np-anim-bell-50')
    castRef.current?.classList.add('np-anim-bell-55')
    backRef.current?.classList.add('np-anim-ramp-40')

    window.setTimeout(() => {
      const nextIndex = dir === 'up' ? index + 1 : index - 1
      onPageChange?.(nextIndex)
      setIndex(nextIndex) // il layout-effect resetta le bande senza transizione
    }, FLIP_MS)
  }

  // ── Micro-rimbalzo ai bordi: nessuna pagina nella direzione dello swipe. ───────
  function edgeBounce(dir: Dir) {
    busyRef.current = true
    curBandRefs.current.forEach((el, i) => {
      if (!el) return
      el.style.transition = `transform ${EDGE_BOUNCE_MS}ms ease-out`
      el.style.transform  = `rotateX(${bounceTarget(dir, i)}deg)`
    })
    window.setTimeout(() => {
      curBandRefs.current.forEach(el => {
        if (!el) return
        el.style.transition = `transform ${EDGE_BOUNCE_MS}ms ease-in`
        el.style.transform  = 'rotateX(0deg)'
      })
      window.setTimeout(() => { busyRef.current = false }, EDGE_BOUNCE_MS)
    }, EDGE_BOUNCE_MS)
  }

  // ── Gesture (Pointer Events: touch + mouse) ────────────────────────────────────
  // Appena |dy| >= SWIPE_TRIGGER_PX il gesto è "consumato": parte subito il
  // volteggio completo (o il rimbalzo) e i movimenti successivi vengono ignorati.
  function onPointerDown(e: React.PointerEvent) {
    if (busyRef.current) return
    interactedRef.current = true
    draggingRef.current = true
    consumedRef.current = false
    startYRef.current = e.clientY
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop */ }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current || consumedRef.current || busyRef.current) return
    const dy = startYRef.current - e.clientY // >0 = dito verso l'alto
    if (Math.abs(dy) < SWIPE_TRIGGER_PX) return
    consumedRef.current = true
    const dir: Dir = dy > 0 ? 'up' : 'down'
    const able = dir === 'up' ? hasNext : hasPrev
    if (able) commit(dir)
    else edgeBounce(dir)
  }

  function endGesture() {
    draggingRef.current = false
    consumedRef.current = false
  }

  // ── Onboarding nudge: dopo 5s di inattività il foglio "occhieggia" il retro. ──
  useEffect(() => {
    if (interactedRef.current || !hasNext) return
    let holdTimer: ReturnType<typeof setTimeout> | undefined
    const peekTimer = setTimeout(() => {
      if (busyRef.current || draggingRef.current) return
      busyRef.current = true
      const bell = Math.sin(PEEK_PROGRESS * Math.PI)
      curBandRefs.current.forEach((el, i) => {
        if (!el) return
        el.style.transition = `transform ${FLIP_MS}ms ${FLIP_EASE}`
        el.style.transform  = `rotateX(${bandTargetUp(i) * PEEK_PROGRESS}deg)`
      })
      if (curCurlRef.current) {
        curCurlRef.current.style.transition = `opacity ${FLIP_MS}ms ${FLIP_EASE}`
        curCurlRef.current.style.opacity = String(bell * 0.5)
      }
      if (nextCastRef.current) {
        nextCastRef.current.style.transition = `opacity ${FLIP_MS}ms ${FLIP_EASE}`
        nextCastRef.current.style.opacity = String(bell * 0.55)
      }
      holdTimer = setTimeout(() => {
        curBandRefs.current.forEach(el => { if (el) el.style.transform = 'rotateX(0deg)' })
        if (curCurlRef.current)  curCurlRef.current.style.opacity  = '0'
        if (nextCastRef.current) nextCastRef.current.style.opacity = '0'
        setTimeout(() => { busyRef.current = false }, FLIP_MS)
      }, PEEK_HOLD_MS)
    }, ONBOARD_MS)
    return () => { clearTimeout(peekTimer); if (holdTimer) clearTimeout(holdTimer) }
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
        <Sheet zIndex={1} banded={false} bg={pages[index + 1].background ?? pageBackground}
               front={pages[index + 1].content} back={back(pages[index + 1])} backBg={pages[index + 1].background ?? pageBackBackground}
               castRef={nextCastRef} />
      )}

      {/* Corrente — foglio attivo per lo swipe verso l'alto. */}
      <Sheet zIndex={2} banded bandRefsArray={curBandRefs} bg={pages[index].background ?? pageBackground}
             front={pages[index].content} back={back(pages[index])} backBg={pages[index].background ?? pageBackBackground}
             curlRef={curCurlRef} castRef={curCastRef} backShadeRef={curBackRef} />

      {/* Precedente — ribaltato sopra la rilegatura, ridiscende sullo swipe verso il basso. */}
      {hasPrev && (
        <Sheet zIndex={3} banded bandRefsArray={prevBandRefs} bg={pages[index - 1].background ?? pageBackground}
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
// Foglio singolo: se `banded`, suddiviso in N_BANDS strisce orizzontali (ognuna
// con fronte+retro e proprio rotateX) per simulare la curvatura "a rullo";
// altrimenti un unico blocco fronte+retro (usato per il foglio statico `next`).
// Gli overlay di ombra (curl/cast/back-shade) sono livelli unici sopra lo stack.
// ─────────────────────────────────────────────────────────────────────────────
function Sheet({
  zIndex, bg, backBg, front, back, initialAngle = 0, banded,
  bandRefsArray, curlRef, castRef, backShadeRef,
}: {
  zIndex: number
  bg: string
  backBg: string
  front: React.ReactNode
  back: React.ReactNode
  initialAngle?: number
  banded: boolean
  bandRefsArray?: React.MutableRefObject<(HTMLDivElement | null)[]>
  curlRef?: React.RefObject<HTMLDivElement>
  castRef?: React.RefObject<HTMLDivElement>
  backShadeRef?: React.RefObject<HTMLDivElement>
}) {
  const bandCount = banded ? N_BANDS : 1

  return (
    <div className="np-sheet" style={{ position: 'absolute', inset: 0, zIndex }}>
      {Array.from({ length: bandCount }).map((_, i) => (
        <div
          key={i}
          ref={el => { if (bandRefsArray) bandRefsArray.current[i] = el }}
          className="np-band"
          style={{
            position: 'absolute', left: 0, right: 0,
            top: banded ? `${(i / N_BANDS) * 100}%` : 0,
            height: banded ? `${100 / N_BANDS}%` : '100%',
            transformOrigin: 'top center',
            transformStyle: 'preserve-3d',
            transform: `rotateX(${initialAngle}deg)`,
            willChange: 'transform',
          }}
        >
          <div className="np-band-face np-band-front" style={{ background: bg }}>
            <div className="np-band-content" style={{ height: `${bandCount * 100}%`, transform: `translateY(-${i * 100}%)` }}>
              {front}
            </div>
          </div>
          <div className="np-band-face np-band-back" style={{ background: backBg, transform: 'rotateX(180deg)' }}>
            <div className="np-band-content" style={{ height: `${bandCount * 100}%`, transform: `translateY(-${i * 100}%)` }}>
              {back}
            </div>
          </div>
        </div>
      ))}

      {/* Curvatura: ombra che attraversa il foglio mentre flette (picco a metà sfoglio). */}
      {curlRef && <div ref={curlRef} className="np-curl" />}
      {/* Ombra ricevuta da un foglio che si solleva sopra questo. */}
      {castRef && <div ref={castRef} className="np-cast" />}
      {/* Ombra sul retro mentre si scopre. */}
      {backShadeRef && <div ref={backShadeRef} className="np-back-shade" />}

      <style jsx>{`
        .np-band-face { position: absolute; inset: 0; overflow: hidden; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .np-band-content { position: absolute; left: 0; right: 0; top: 0; }
        .np-back-default { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(0,0,0,.03) 0, rgba(0,0,0,.03) 1px, transparent 1px, transparent 28px); }

        .np-curl, .np-cast, .np-back-shade { position: absolute; inset: 0; pointer-events: none; opacity: 0; z-index: 5; }
        .np-curl { background: linear-gradient(to top, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 42%, rgba(255,255,255,.10) 70%, rgba(0,0,0,0) 100%); }
        .np-cast { background: linear-gradient(to bottom, rgba(0,0,0,.6), rgba(0,0,0,0) 55%); }
        .np-back-shade { background: linear-gradient(to top, rgba(0,0,0,.4), rgba(0,0,0,0) 60%); }

        @keyframes np-bell-50 { 0% { opacity: 0; } 50% { opacity: .5; } 100% { opacity: 0; } }
        @keyframes np-bell-55 { 0% { opacity: 0; } 50% { opacity: .55; } 100% { opacity: 0; } }
        @keyframes np-ramp-40 { 0%, 50% { opacity: 0; } 100% { opacity: .4; } }
        .np-anim-bell-50 { animation: np-bell-50 ${FLIP_MS}ms ${FLIP_EASE} forwards; }
        .np-anim-bell-55 { animation: np-bell-55 ${FLIP_MS}ms ${FLIP_EASE} forwards; }
        .np-anim-ramp-40 { animation: np-ramp-40 ${FLIP_MS}ms ${FLIP_EASE} forwards; }
      `}</style>
    </div>
  )
}
