'use client'

/**
 * VerticalNotepadMenu — prototipo sperimentale.
 *
 * Sfogliabile verticale "a blocco notes": ogni pagina è ancorata in alto
 * (transform-origin: top center) e si solleva ruotando sull'asse X quando
 * l'utente esegue uno swipe verso l'alto, rivelando il retro del foglio,
 * un'ombra dinamica proiettata sulla pagina sottostante e la pagina successiva.
 *
 * Componente isolato e autonomo: nessuna dipendenza da PublicMenuView /
 * FlipbookViewer. Pensato per essere montato in un contenitore con altezza
 * fissa (es. 100dvh su mobile).
 */

import { useEffect, useRef, useState } from 'react'

export interface NotepadPage {
  id: string
  /** Contenuto del fronte della pagina. */
  content: React.ReactNode
  /** Contenuto del retro (facoltativo). Se omesso, viene mostrato un retro neutro. */
  back?: React.ReactNode
  /** Colore/texture di sfondo di questa pagina (default: pageBackground). */
  background?: string
}

interface VerticalNotepadMenuProps {
  pages: NotepadPage[]
  /** Colore accento (indicatori, hint). */
  accent?: string
  /** Sfondo di default delle pagine. */
  pageBackground?: string
  /** Sfondo del retro pagina, se una pagina non specifica `back`. */
  pageBackBackground?: string
  onPageChange?: (index: number) => void
}

const ONBOARDING_DELAY_MS = 5000
const PEEK_ANGLE          = -18   // gradi del "nudge" di onboarding
const PEEK_HOLD_MS        = 650
const FLIP_THRESHOLD      = -90   // oltre questa rotazione lo swipe si completa
const MAX_ANGLE           = -180
const SETTLE_MS           = 380   // durata animazione di completamento/rientro

export default function VerticalNotepadMenu({
  pages,
  accent = '#c9a96e',
  pageBackground = '#f7f3ea',
  pageBackBackground = '#e8e1d2',
  onPageChange,
}: VerticalNotepadMenuProps) {
  const [index, setIndex]         = useState(0)
  const [angle, setAngle]         = useState(0)       // rotazione corrente del foglio attivo: 0 → -180
  const [dragging, setDragging]   = useState(false)
  const [animating, setAnimating] = useState(false)
  const [peeking, setPeeking]     = useState(false)
  const [interacted, setInteracted] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const startYRef    = useRef(0)
  const dragAngleRef = useRef(0)

  const total = pages.length
  const atEnd = index >= total - 1

  // ── Onboarding nudge ──────────────────────────────────────────────
  // Se l'utente non interagisce entro 5s, il foglio corrente si solleva
  // di qualche grado (rivelando retro/ombra/pagina sotto) per poi ricadere.
  useEffect(() => {
    if (interacted || atEnd || animating) return
    const timer = setTimeout(() => {
      setPeeking(true)
      const fall = setTimeout(() => setPeeking(false), PEEK_HOLD_MS)
      return () => clearTimeout(fall)
    }, ONBOARDING_DELAY_MS)
    return () => clearTimeout(timer)
  }, [interacted, atEnd, animating, index])

  // ── Swipe detector ───────────────────────────────────────────────
  function handleTouchStart(e: React.TouchEvent) {
    if (atEnd || animating) return
    setInteracted(true)
    setPeeking(false)
    setDragging(true)
    startYRef.current = e.touches[0].clientY
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragging) return
    const deltaY = startYRef.current - e.touches[0].clientY // positivo = dito verso l'alto
    const h = containerRef.current?.clientHeight || 600
    const next = Math.max(MAX_ANGLE, Math.min(0, -(deltaY / h) * 180))
    dragAngleRef.current = next
    setAngle(next)
  }

  function handleTouchEnd() {
    if (!dragging) return
    setDragging(false)
    if (dragAngleRef.current <= FLIP_THRESHOLD) {
      completeFlip()
    } else {
      snapBack()
    }
  }

  function completeFlip() {
    setAnimating(true)
    setAngle(MAX_ANGLE)
    setTimeout(() => {
      setIndex((i) => {
        const next = Math.min(i + 1, total - 1)
        onPageChange?.(next)
        return next
      })
      setAngle(0)
      dragAngleRef.current = 0
      setAnimating(false)
    }, SETTLE_MS)
  }

  function snapBack() {
    setAnimating(true)
    setAngle(0)
    dragAngleRef.current = 0
    setTimeout(() => setAnimating(false), SETTLE_MS)
  }

  const activeAngle  = peeking ? PEEK_ANGLE : angle
  // 0 → 1: quanto il foglio attivo si è alzato, usato per ombre/opacità dinamiche
  const liftProgress = Math.min(Math.abs(activeAngle) / 90, 1)

  return (
    <div
      ref={containerRef}
      className="np-root"
      style={{ perspective: '1400px' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pagina sotto-sotto (statica, solo per dare profondità allo stack) */}
      {index + 2 < total && (
        <NotepadFace
          page={pages[index + 2]}
          zIndex={1}
          angle={0}
          pageBackground={pageBackground}
          pageBackBackground={pageBackBackground}
          transition="none"
        />
      )}

      {/* Pagina successiva — riceve l'ombra dinamica del foglio che si alza */}
      {index + 1 < total && (
        <NotepadFace
          page={pages[index + 1]}
          zIndex={2}
          angle={0}
          pageBackground={pageBackground}
          pageBackBackground={pageBackBackground}
          transition="none"
          shadowOpacity={liftProgress * 0.45}
        />
      )}

      {/* Foglio attivo — quello che l'utente sta sfogliando */}
      <NotepadFace
        page={pages[index]}
        zIndex={3}
        angle={activeAngle}
        pageBackground={pageBackground}
        pageBackBackground={pageBackBackground}
        transition={dragging ? 'none' : `transform ${SETTLE_MS}ms cubic-bezier(.22,.61,.36,1)`}
        active
        liftProgress={liftProgress}
      />

      {/* Indicatori laterali di progresso */}
      <div className="np-progress">
        {pages.map((_, i) => (
          <span
            key={i}
            className="np-dot"
            style={{ background: i === index ? accent : 'rgba(255,255,255,0.25)' }}
          />
        ))}
      </div>

      {/* Hint "swipe up" — chevron pulsante, scompare all'ultima pagina */}
      {!atEnd && (
        <div className="np-hint" aria-hidden="true">
          <ChevronUpIcon color={accent} />
        </div>
      )}

      <style jsx>{`
        .np-root {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          touch-action: none;
          -webkit-tap-highlight-color: transparent;
        }
        .np-progress {
          position: absolute;
          top: 50%;
          right: 10px;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 6px;
          z-index: 20;
        }
        .np-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          transition: background 0.25s ease;
        }
        .np-hint {
          position: absolute;
          left: 50%;
          bottom: 18px;
          transform: translateX(-50%);
          z-index: 20;
          animation: np-pulse 1.8s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes np-pulse {
          0%, 100% { opacity: 0.35; transform: translateX(-50%) translateY(0); }
          50%      { opacity: 1;    transform: translateX(-50%) translateY(-6px); }
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Foglio singolo: fronte + retro, con ombra dinamica facoltativa.
// ─────────────────────────────────────────────────────────────────────────
function NotepadFace({
  page,
  zIndex,
  angle,
  pageBackground,
  pageBackBackground,
  transition,
  active = false,
  liftProgress = 0,
  shadowOpacity,
}: {
  page: NotepadPage
  zIndex: number
  angle: number
  pageBackground: string
  pageBackBackground: string
  transition: string
  active?: boolean
  liftProgress?: number
  shadowOpacity?: number
}) {
  return (
    <div
      className="np-card"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex,
        transformOrigin: 'top center',
        transformStyle: 'preserve-3d',
        transform: `rotateX(${angle}deg)`,
        transition,
        willChange: active ? 'transform' : undefined,
      }}
    >
      {/* ── Fronte ── */}
      <div
        className="np-face"
        style={{ background: page.background ?? pageBackground }}
      >
        {page.content}

        {/* Ombra ricevuta dal foglio che si solleva sopra questa pagina */}
        {shadowOpacity !== undefined && shadowOpacity > 0 && (
          <div
            className="np-incoming-shadow"
            style={{
              opacity: shadowOpacity,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0) 55%)',
            }}
          />
        )}
      </div>

      {/* ── Retro ── visibile solo quando il foglio supera i 90° */}
      <div
        className="np-face np-face-back"
        style={{ background: page.background ?? pageBackBackground }}
      >
        {page.back ?? <div className="np-back-default" />}

        {/* Ombra interna sul retro: si intensifica verso il bordo inferiore
            (la "piega" del foglio) man mano che la rotazione avanza. */}
        <div
          className="np-back-shade"
          style={{ opacity: active ? liftProgress : 0 }}
        />
      </div>

      <style jsx>{`
        .np-face {
          position: absolute;
          inset: 0;
          overflow: hidden;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
        }
        .np-face-back {
          transform: rotateX(180deg);
        }
        .np-back-default {
          position: absolute;
          inset: 0;
          background:
            repeating-linear-gradient(
              0deg,
              rgba(0, 0, 0, 0.03) 0px,
              rgba(0, 0, 0, 0.03) 1px,
              transparent 1px,
              transparent 28px
            );
        }
        .np-back-shade {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0) 60%);
          transition: opacity 0.1s linear;
          pointer-events: none;
        }
        .np-incoming-shadow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          transition: opacity 0.1s linear;
        }
      `}</style>
    </div>
  )
}

function ChevronUpIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 15 12 9 18 15" />
    </svg>
  )
}
