'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Palco del vetro liquido: una tela WebGL a tutto schermo, sopra lo sfondo e
// sotto i testi, che disegna lo sfondo e tutti gli elementi in vetro della
// pagina (quelli con data-glass: pulsanti dei menu, lingua, social).
//
// A ogni fotogramma legge posizione, forma (data-radius), trasparenza e
// pressione (data-pressed) degli elementi, e chiede lo sfondo attuale (strati,
// velo, sfocatura) a chi lo gestisce. Se lo sfondo è fermo e nulla si muove
// non ridisegna. Senza WebGL2 (o se qualcosa va storto) avvisa e la pagina
// usa il vetro normale dei browser.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { LiquidGlass, type BgLayer, type GlassParams } from './liquidGlass'

export interface StageBackground { layers: BgLayer[]; veil: number; blur: number; base: string }

export default function GlassStage({ rootRef, background, glass, liquidPress, onState }: {
  rootRef:     React.RefObject<HTMLElement>
  /** Sfondo attuale (chiamato a ogni fotogramma). */
  background:  React.MutableRefObject<(() => StageBackground) | null>
  glass:       GlassParams
  /** Alla pressione la lente si gonfia (altrimenti nessun effetto nel vetro). */
  liquidPress: boolean
  onState:     (ok: boolean) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [shown, setShown] = useState(false)
  const glassRef = useRef(glass)
  glassRef.current = glass
  const pressRef = useRef(liquidPress)
  pressRef.current = liquidPress
  const onStateRef = useRef(onState)
  onStateRef.current = onState

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let gl: LiquidGlass
    try { gl = new LiquidGlass(canvas) } catch (e) {
      console.warn('Vetro liquido non disponibile:', e)
      onStateRef.current(false); return
    }
    let raf = 0, last = '', first = true, dead = false
    const press = new Map<Element, number>()
    const onLost = (e: Event) => { e.preventDefault(); dead = true; onStateRef.current(false) }
    canvas.addEventListener('webglcontextlost', onLost)

    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (dead) return
      const bg = background.current?.()
      const root = rootRef.current
      if (!bg || !root) return
      const W = window.innerWidth, H = window.innerHeight
      const rects = []
      let moving = false
      for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-glass]'))) {
        const r = el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2 || r.bottom < -40 || r.top > H + 40) continue
        const alpha = parseFloat(getComputedStyle(el).opacity) || 0
        if (alpha <= 0.002) continue
        // Pressione morbida: la lente si gonfia e si sgonfia con una molla.
        const target = pressRef.current && el.dataset.pressed === '1' ? 1 : 0
        const cur = press.get(el) ?? 0
        const next = cur + (target - cur) * 0.25
        press.set(el, Math.abs(next - target) < 0.002 ? target : next)
        if (next !== target) moving = true
        rects.push({ x: r.left, y: r.top, w: r.width, h: r.height, radius: parseFloat(el.dataset.radius ?? '20'), alpha, press: press.get(el)! })
      }
      const dynamic = bg.layers.some(l => l.dynamic && l.alpha > 0)
      // Una foto che finisce di caricarsi cambia la firma (va ridisegnata).
      const ready = (l: BgLayer) => (l.source instanceof HTMLImageElement ? l.source.complete && l.source.naturalWidth > 0
        : l.source instanceof HTMLVideoElement ? l.source.readyState >= 2 : true)
      const sig = JSON.stringify([W, H, rects, bg.layers.map(l => [l.alpha.toFixed(3), l.scale.toFixed(4), l.version ?? 0, ready(l)]), bg.veil.toFixed(3), bg.blur, glassRef.current])
      if (!dynamic && !moving && sig === last && !first) return
      last = sig
      try {
        gl.render({ width: W, height: H, base: bg.base, layers: bg.layers, veil: bg.veil, blur: bg.blur, rects, glass: glassRef.current })
      } catch (e) { console.warn('Vetro liquido interrotto:', e); dead = true; onStateRef.current(false); return }
      if (first) {
        // Mostrata solo dopo il primo disegno riuscito (niente lampo nero).
        first = false
        setShown(true)
        onStateRef.current(true)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('webglcontextlost', onLost)
      gl.dispose()
    }
  }, [background, rootRef])

  return (
    <canvas ref={canvasRef} aria-hidden className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1, opacity: shown ? 1 : 0 }} />
  )
}
