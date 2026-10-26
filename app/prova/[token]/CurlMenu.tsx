'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Menu a tutto schermo con sfoglio "a cilindro" (prototipo).
//
// Stato: pagina corrente `index`. Durante uno sfoglio:
//   avanti   → la pagina `index` si arrotola e scopre `index + 1`;
//   indietro → la pagina `index − 1` (già girata) torna giù sopra `index`.
// In entrambi i casi la pagina che si muove è afferrata sul bordo libero
// (P0 = destra, all'altezza del dito) e il punto F segue il dito.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { CurlRenderer, constrain, solveCurl, type Vec } from './curl'
import { layoutMenu, FONT_FACES, PAPER, type Layout, type MenuData, type Insets } from './typeset'

const FONTS_CSS = '/api/gfonts/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600&display=block'

type Drag = {
  pointerId: number
  start:     Vec
  last:      Vec
  samples:   { x: number; t: number }[]
  mode:      'undecided' | 'forward' | 'back' | 'none'
  startedAt: number
}

type Turn = {
  kind:  'forward' | 'back'
  P0:    Vec
  F:     Vec
}

type Anim = {
  turn:   Turn
  from:   Vec
  to:     Vec
  t0:     number
  dur:    number
  commit: boolean
  /** Arco verticale (px): il tocco gira la pagina dall'angolo, non dritta. */
  arc:    number
}

export default function CurlMenu({ data }: { data: MenuData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const probeRef  = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'nogl'>('loading')

  useEffect(() => {
    const canvas = canvasRef.current!
    const probe  = probeRef.current!
    let disposed = false

    // ── Font: CSS dal nostro dominio (proxy), poi attesa delle facce usate.
    // Prima il foglio di stile (dichiara le facce), POI la richiesta delle facce:
    // chiesta prima, document.fonts.load risponde "pronto" senza aver caricato.
    const cssReady = new Promise<void>(resolve => {
      let link = document.querySelector<HTMLLinkElement>('link[data-curl-fonts]')
      if (link?.dataset.loaded) { resolve(); return }
      if (!link) {
        link = document.createElement('link')
        link.rel = 'stylesheet'; link.href = FONTS_CSS; link.dataset.curlFonts = '1'
        document.head.appendChild(link)
      }
      const done = () => { link!.dataset.loaded = '1'; resolve() }
      link.addEventListener('load', done, { once: true })
      link.addEventListener('error', () => resolve(), { once: true })
    })
    const fontsReady = Promise.race([
      cssReady.then(() => Promise.all(FONT_FACES.map(f => document.fonts.load(f)))),
      new Promise(r => setTimeout(r, 6000)),
    ])

    let renderer: CurlRenderer | null = null
    let ctx2d: CanvasRenderingContext2D | null = null   // ripiego senza WebGL
    try { renderer = new CurlRenderer(canvas, PAPER) } catch { ctx2d = canvas.getContext('2d') }

    // Canvas di lavoro per comporre una pagina alla volta.
    const scratch = document.createElement('canvas')
    const sctx = scratch.getContext('2d')!

    let layout: Layout | null = null
    let index = 0
    let dpr = 1
    let W = 0, H = 0
    const textures = new Map<number, WebGLTexture>()
    const bitmaps  = new Map<number, HTMLCanvasElement>()   // solo ripiego 2D

    let drag: Drag | null = null
    let turn: Turn | null = null
    let anim: Anim | null = null
    let raf = 0

    const insets = (): Insets => {
      const cs = getComputedStyle(probe)
      return {
        top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0,
        bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0,
      }
    }

    const pageCanvas = (i: number): HTMLCanvasElement => {
      scratch.width = Math.round(W * dpr); scratch.height = Math.round(H * dpr)
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      layout!.paint(sctx, i)
      return scratch
    }

    const texture = (i: number): WebGLTexture | null => {
      if (!layout || i < 0 || i >= layout.pages.length || !renderer) return null
      let t = textures.get(i)
      if (!t) { t = renderer.createTexture(pageCanvas(i)); textures.set(i, t) }
      return t
    }
    const bitmap = (i: number): HTMLCanvasElement | null => {
      if (!layout || i < 0 || i >= layout.pages.length) return null
      let b = bitmaps.get(i)
      if (!b) {
        const src = pageCanvas(i)
        b = document.createElement('canvas'); b.width = src.width; b.height = src.height
        b.getContext('2d')!.drawImage(src, 0, 0)
        bitmaps.set(i, b)
      }
      return b
    }

    // Tiene in memoria solo le pagine vicine; prepara in anticipo le adiacenti.
    const prune = () => {
      for (const [i, t] of Array.from(textures)) if (Math.abs(i - index) > 2) { renderer?.deleteTexture(t); textures.delete(i) }
      for (const i of Array.from(bitmaps.keys())) if (Math.abs(i - index) > 2) bitmaps.delete(i)
    }
    let warmTimer = 0
    const warm = () => {
      clearTimeout(warmTimer)
      warmTimer = window.setTimeout(() => {
        for (const i of [index + 1, index - 1]) { if (renderer) texture(i); else bitmap(i) }
        draw()
      }, 60)
    }

    // ── Disegno
    const draw = () => {
      raf = 0
      if (!layout) return
      if (renderer) {
        if (turn) {
          const front = texture(turn.kind === 'forward' ? index : index - 1)
          const bottom = texture(turn.kind === 'forward' ? index + 1 : index)
          const c = solveCurl(turn.P0, turn.F, W)
          const prog = Math.max(0, Math.min(1, (turn.P0.x - turn.F.x) / (2 * W)))
          const shadow = Math.min(1, prog * 7, (1 - prog) * 7)
          if (front) renderer.render({ front, bottom, curl: c, shadow })
        } else {
          const front = texture(index)
          if (front) renderer.render({ front, bottom: null, curl: null, shadow: 0 })
        }
      } else if (ctx2d) {
        // Ripiego: la pagina scorre via orizzontalmente, senza 3D.
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx2d.fillStyle = PAPER; ctx2d.fillRect(0, 0, W, H)
        if (turn) {
          const prog = Math.max(0, Math.min(1, (turn.P0.x - turn.F.x) / (2 * W)))
          const under = bitmap(turn.kind === 'forward' ? index + 1 : index)
          const over  = bitmap(turn.kind === 'forward' ? index : index - 1)
          if (under) ctx2d.drawImage(under, 0, 0, W, H)
          if (over) {
            ctx2d.save(); ctx2d.shadowColor = 'rgba(0,0,0,0.25)'; ctx2d.shadowBlur = 24
            ctx2d.drawImage(over, -prog * W, 0, W, H); ctx2d.restore()
          }
        } else {
          const b = bitmap(index)
          if (b) ctx2d.drawImage(b, 0, 0, W, H)
        }
      }
    }
    const request = () => { if (!raf) raf = requestAnimationFrame(draw) }

    // ── Misure, impaginazione, resize (mantiene la pagina del primo piatto visto)
    const relayout = () => {
      const anchor = layout?.pages[index]?.anchor ?? null
      W = window.innerWidth; H = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 3)
      if (renderer) {
        const max = renderer.maxTexture
        dpr = Math.min(dpr, max / W, max / H)
      }
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`
      renderer?.resize(W, H, canvas.width, canvas.height)
      for (const t of Array.from(textures.values())) renderer?.deleteTexture(t)
      textures.clear(); bitmaps.clear()
      layout = layoutMenu(sctx, data, { w: W, h: H, insets: insets() })
      const found = anchor ? layout.pages.findIndex(p => p.anchor === anchor) : -1
      index = found >= 0 ? found : Math.min(index, layout.pages.length - 1)
      turn = null; anim = null; drag = null
      draw(); warm()
    }

    // ── Animazione di rilascio
    const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)
    const step = (now: number) => {
      if (!anim) return
      const k = Math.min(1, (now - anim.t0) / anim.dur)
      const e = easeOut(k)
      const raw = {
        x: anim.from.x + (anim.to.x - anim.from.x) * e,
        y: anim.from.y + (anim.to.y - anim.from.y) * e - Math.sin(Math.PI * e) * anim.arc,
      }
      anim.turn.F = constrain(anim.turn.P0, raw, H)
      turn = anim.turn
      if (k < 1) { draw(); requestAnimationFrame(step); return }
      finish()
    }
    const finish = () => {
      if (!anim) return
      const { turn: t, commit } = anim
      if (commit) index += t.kind === 'forward' ? 1 : -1
      anim = null; turn = null
      draw(); prune(); warm()
    }
    const animate = (t: Turn, commit: boolean, velocity = 0, arc = 0) => {
      const fullyTurned = { x: -t.P0.x, y: t.P0.y }
      const flat = { x: t.P0.x, y: t.P0.y }
      const target = (t.kind === 'forward') === commit ? fullyTurned : flat
      const dist = Math.hypot(target.x - t.F.x, target.y - t.F.y)
      // Durata: proporzionale alla strada, più breve se il dito era veloce.
      const base = Math.max(170, Math.min(520, (dist / W) * 430))
      const dur = Math.max(140, base / (1 + Math.min(2.5, Math.abs(velocity) * 0.9)))
      anim = { turn: t, from: { ...t.F }, to: target, t0: performance.now(), dur: arc ? Math.max(dur, 420) : dur, commit, arc }
      requestAnimationFrame(step)
    }
    const skipAnim = () => {
      if (!anim) return
      anim.turn.F = { ...anim.to }
      finish()
    }

    // ── Gesti
    const pos = (e: PointerEvent): Vec => ({ x: e.clientX, y: e.clientY })
    const pageCount = () => layout?.pages.length ?? 0
    // Il dito tiene la piega: arrivato al bordo opposto dello schermo la pagina
    // è girata del tutto, qualunque sia il punto da cui è partito il gesto.
    // (Piega sotto il dito ⇔ F.x ≈ 2·dito − W; il guadagno si adatta alla
    // distanza che il dito ha davanti, con un tetto per i gesti a metà pagina.)
    const turnFromDrag = (d: Drag, p: Vec): Turn => {
      const y0 = Math.max(0, Math.min(H, d.start.y))
      const P0 = { x: W, y: y0 }
      const dx = p.x - d.start.x, dy = p.y - d.start.y
      const fx = d.mode === 'forward'
        ? W + dx * Math.min(3, (2 * W) / Math.max(1, d.start.x))
        : -W + dx * Math.min(3, (2 * W) / Math.max(1, W - d.start.x))
      return { kind: d.mode === 'forward' ? 'forward' : 'back', P0, F: constrain(P0, { x: fx, y: y0 + dy }, H) }
    }

    // Presa in basso → l'angolo sale verso il centro (e viceversa).
    const tapArc = (y0: number) => (y0 > H / 2 ? 1 : -1) * H * 0.07

    const onDown = (e: PointerEvent) => {
      if (!layout || drag) return
      skipAnim()
      canvas.setPointerCapture(e.pointerId)
      const p = pos(e)
      drag = { pointerId: e.pointerId, start: p, last: p, samples: [{ x: p.x, t: e.timeStamp }], mode: 'undecided', startedAt: e.timeStamp }
    }

    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.pointerId) return
      const p = pos(e)
      drag.last = p
      drag.samples.push({ x: p.x, t: e.timeStamp })
      if (drag.samples.length > 6) drag.samples.shift()
      if (drag.mode === 'undecided') {
        const dx = p.x - drag.start.x, dy = p.y - drag.start.y
        if (Math.hypot(dx, dy) < 8) return
        if (Math.abs(dy) > Math.abs(dx) * 1.4) { drag.mode = 'none'; return }
        if (dx < 0 && index < pageCount() - 1) drag.mode = 'forward'
        else if (dx > 0 && index > 0) drag.mode = 'back'
        else { drag.mode = 'none'; return }
        // Il gesto riparte da qui: niente salto iniziale.
        drag.start = { x: p.x, y: drag.start.y }
      }
      if (drag.mode === 'none') return
      turn = turnFromDrag(drag, p)
      request()
    }

    const velocityX = (d: Drag) => {
      const s = d.samples
      if (s.length < 2) return 0
      const a = s[0], b = s[s.length - 1]
      const dt = b.t - a.t
      return dt > 0 ? (b.x - a.x) / dt : 0   // px/ms, negativo = verso sinistra
    }

    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.pointerId) return
      const d = drag
      drag = null
      const moved = Math.hypot(d.last.x - d.start.x, d.last.y - d.start.y)
      if (d.mode === 'undecided' && moved < 8 && e.timeStamp - d.startedAt < 400) {
        // Tocco: destra = avanti, sinistra = indietro (il centro non fa nulla).
        const y0 = Math.max(H * 0.15, Math.min(H * 0.85, d.start.y))
        if (d.start.x > W * 0.6 && index < pageCount() - 1) {
          animate({ kind: 'forward', P0: { x: W, y: y0 }, F: { x: W - 1, y: y0 } }, true, 0, tapArc(y0))
        } else if (d.start.x < W * 0.4 && index > 0) {
          animate({ kind: 'back', P0: { x: W, y: y0 }, F: { x: -W + 1, y: y0 } }, true, 0, tapArc(y0))
        }
        return
      }
      if (!turn || (d.mode !== 'forward' && d.mode !== 'back')) { turn = null; request(); return }
      const v = velocityX(d)
      const prog = (turn.P0.x - turn.F.x) / (2 * W)   // 0 = piatta, 1 = girata
      const commit = turn.kind === 'forward'
        ? v < -0.35 || (prog > 0.33 && v < 0.25)
        : v > 0.35 || (prog < 0.67 && v > -0.25)
      animate(turn, commit, v)
    }

    const onCancel = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.pointerId) return
      drag = null
      if (turn) animate(turn, false)
    }

    const onKey = (e: KeyboardEvent) => {
      if (anim || drag) return
      const y0 = H * 0.7
      if ((e.key === 'ArrowRight' || e.key === ' ') && index < pageCount() - 1) {
        animate({ kind: 'forward', P0: { x: W, y: y0 }, F: { x: W - 1, y: y0 } }, true, 0, tapArc(y0))
      } else if (e.key === 'ArrowLeft' && index > 0) {
        animate({ kind: 'back', P0: { x: W, y: y0 }, F: { x: -W + 1, y: y0 } }, true, 0, tapArc(y0))
      }
    }

    // ── Contesto WebGL perso (es. app in background su iOS): si ricrea tutto.
    const onLost = (e: Event) => { e.preventDefault() }
    const onRestored = () => {
      try { renderer = new CurlRenderer(canvas, PAPER) } catch { renderer = null }
      textures.clear()
      relayout()
    }

    let resizeTimer = 0
    const onResize = () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(relayout, 120) }

    fontsReady.then(() => {
      if (disposed) return
      relayout()
      setStatus(renderer ? 'ready' : 'nogl')
    })

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onCancel)
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      clearTimeout(warmTimer); clearTimeout(resizeTimer)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
      for (const t of Array.from(textures.values())) renderer?.deleteTexture(t)
    }
  }, [data])

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: PAPER, overscrollBehavior: 'none' }}>
      {/* Sonda invisibile: legge le aree sicure (notch, barra home) in px. */}
      <div ref={probeRef} aria-hidden className="pointer-events-none fixed inset-0 invisible"
        style={{ padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }} />
      <canvas
        ref={canvasRef}
        className="block select-none"
        style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', opacity: status === 'loading' ? 0 : 1, transition: 'opacity 0.35s ease' }}
        aria-label={`${data.restaurantName} — ${data.menuName}`}
      />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.35em]" style={{ color: '#9a8462' }}>{data.restaurantName}</span>
        </div>
      )}
    </div>
  )
}
