'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Vetro liquido della X e della freccia della scheda del piatto.
//
// Sotto i tasti c'è HTML (la scheda), che i browser non lasciano leggere: lo
// sfondo delle lenti viene quindi ricostruito a ogni cambio su una piccola
// tela 2D, con ciò che si sa disegnare con esattezza: il colore del vetro
// della scheda (più velato dove c'è la parte bassa, che si opacizza) e le
// foto dei piatti, nella loro posizione e forma attuali. I testi che passano
// sotto i tasti restano coperti dalla smerigliatura.
// La tela WebGL è trasparente fuori dalle lenti (solo lenti e ombre) e sta
// sotto le icone. Senza WebGL2 avvisa e i tasti usano il vetro dei browser.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react'
import { LiquidGlass, type GlassParams } from './liquidGlass'
import { readGlassRects } from './GlassStage'

type Rect = { x: number; y: number; w: number; h: number }

export default function CardGlass({ barRef, cardRef, base, frosted, glass, onState }: {
  /** Contiene i tasti (data-glass) e la tela. */
  barRef:  React.RefObject<HTMLElement>
  /** La scheda: foto (img[data-card-photo]) e parti basse (data-card-section). */
  cardRef: React.RefObject<HTMLElement>
  /** Colore della scheda sotto i tasti (vetro sopra il menu). */
  base:    string
  /** Colore della parte bassa a tutto schermo (si mescola con --frost). */
  frosted: string
  glass:   GlassParams
  onState: (ok: boolean) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const props = useRef({ base, frosted, glass, onState })
  props.current = { base, frosted, glass, onState }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let gl: LiquidGlass
    try { gl = new LiquidGlass(canvas, { transparent: true }) } catch (e) {
      console.warn('Vetro liquido della scheda non disponibile:', e)
      props.current.onState(false); return
    }
    const bg = document.createElement('canvas')
    const ctx = bg.getContext('2d')
    if (!ctx) { gl.dispose(); props.current.onState(false); return }
    let raf = 0, last = '', first = true, dead = false, version = 0
    const press = new Map<Element, number>()
    const onLost = (e: Event) => { e.preventDefault(); dead = true; canvas.style.opacity = '0'; props.current.onState(false) }
    canvas.addEventListener('webglcontextlost', onLost)

    // Si legge la scheda solo quando qualcosa cambia (scorrimento, tocchi,
    // animazioni che scrivono lo stile, foto caricate) e per qualche
    // fotogramma dopo: da ferma non pesa sul telefono mentre si scorre.
    let busy = 60
    const wake = () => { busy = 24 }
    const host = cardRef.current
    const mo = new MutationObserver(wake)
    if (host) {
      mo.observe(host, { attributes: true, attributeFilter: ['style'], subtree: true })
      host.addEventListener('scroll', wake, { capture: true, passive: true })
      host.addEventListener('pointerdown', wake, { passive: true })
      host.addEventListener('pointerup', wake, { passive: true })
      host.addEventListener('load', wake, { capture: true })
    }
    window.addEventListener('resize', wake)

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const bar = barRef.current, card = cardRef.current
      if (dead || !bar || !card) return
      if (busy <= 0 && !first) return
      busy--
      const cr = canvas.getBoundingClientRect()
      const W = cr.width, H = cr.height
      if (W < 2 || H < 2) return
      // La scheda è scalata (transform): misure dello schermo → della tela.
      const k = canvas.offsetWidth ? W / canvas.offsetWidth : 1
      const { rects, moving } = readGlassRects(bar, press, true, window.innerHeight)
      if (moving) wake()   // la lente si sta gonfiando/sgonfiando
      for (const r of rects) { r.x -= cr.left; r.y -= cr.top; r.radius *= k }

      // Cosa c'è sotto: parti basse della scheda e foto, in ordine di pagina.
      const frost = parseFloat(card.style.getPropertyValue('--frost')) || 0
      const { base, frosted, glass } = props.current
      // Foto: `x..h` è la foto intera (più grande del riquadro quando è
      // inquadrata), `clip` il riquadro che la ritaglia (con i suoi angoli).
      type Item = { img: HTMLImageElement | null; x: number; y: number; w: number; h: number; clip: Rect | null; rad: number; a: number }
      const under: Item[] = []
      const pageAlpha = (el: Element) => {
        const pg = el.closest<HTMLElement>('[data-card-page]')
        if (!pg || pg.style.visibility === 'hidden') return 0
        return pg.style.opacity === '' ? 1 : parseFloat(pg.style.opacity) || 0
      }
      card.querySelectorAll<HTMLElement>('[data-card-section], img[data-card-photo]').forEach(el => {
        const r = el.getBoundingClientRect()
        const box = el instanceof HTMLImageElement ? el.parentElement!.getBoundingClientRect() : r
        if (box.bottom <= cr.top || box.top >= cr.bottom || box.right <= cr.left || box.left >= cr.right) return
        let a = pageAlpha(el)
        const it: Item = { img: null, x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height, clip: null, rad: 0, a }
        if (el instanceof HTMLImageElement) {
          if (!el.complete || !el.naturalWidth) return
          const br = getComputedStyle(el.parentElement!).borderTopLeftRadius
          it.clip = { x: box.left - cr.left, y: box.top - cr.top, w: box.width, h: box.height }
          it.rad = br.endsWith('%') ? (Math.min(box.width, box.height) * parseFloat(br)) / 100 : (parseFloat(br) || 0) * k
          it.img = el
          a *= parseFloat(getComputedStyle(el).opacity) || 0
        } else {
          a *= frost
        }
        it.a = a
        // Parti basse: conta solo il pezzo sotto la tela (che copra tutta la
        // tela o quasi non cambia nulla mentre scorre: niente ridisegno).
        if (!it.img) {
          const x0 = Math.max(0, it.x), y0 = Math.max(0, it.y)
          const x1 = Math.min(W, it.x + it.w), y1 = Math.min(H, it.y + it.h)
          it.x = Math.round(x0); it.y = Math.round(y0); it.w = Math.round(x1 - x0); it.h = Math.round(y1 - y0)
        }
        if (a > 0.01) under.push(it)
      })
      const sig = JSON.stringify([W, H, rects, under.map(u => [u.img?.src ?? 0, u.x, u.y, u.w, u.h, u.clip, u.rad, u.a.toFixed(3)]), base, frosted, glass])
      if (!moving && sig === last && !first) return
      last = sig

      // Sfondo ricostruito.
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const bw = Math.round(W * dpr), bh = Math.round(H * dpr)
      if (bg.width !== bw || bg.height !== bh) { bg.width = bw; bg.height = bh }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalAlpha = 1
      ctx.fillStyle = base
      ctx.fillRect(0, 0, W, H)
      for (const u of under) {
        ctx.globalAlpha = u.a
        if (!u.img || !u.clip) { ctx.fillStyle = frosted; ctx.fillRect(u.x, u.y, u.w, u.h); continue }
        // Riempimento "cover" della scatola della foto (identico quando la
        // foto è già alle sue proporzioni), ritagliato dal riquadro.
        const iw = u.img.naturalWidth, ih = u.img.naturalHeight
        const sc = Math.max(u.w / iw, u.h / ih)
        const c = u.clip
        ctx.save()
        roundRect(ctx, c.x, c.y, c.w, c.h, Math.min(u.rad, c.w / 2, c.h / 2))
        ctx.clip()
        ctx.drawImage(u.img, u.x + (u.w - iw * sc) / 2, u.y + (u.h - ih * sc) / 2, iw * sc, ih * sc)
        ctx.restore()
      }
      version++

      try {
        gl.render({ width: W, height: H, base, layers: [{ source: bg, alpha: 1, scale: 1, cover: false, dynamic: false, version }],
          veil: 0, blur: 0, rects, glass }, dpr)
      } catch (e) {
        console.warn('Vetro liquido della scheda interrotto:', e)
        dead = true; canvas.style.opacity = '0'; props.current.onState(false); return
      }
      if (first) {
        first = false
        canvas.style.opacity = '1'
        props.current.onState(true)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('webglcontextlost', onLost)
      mo.disconnect()
      if (host) {
        host.removeEventListener('scroll', wake, { capture: true })
        host.removeEventListener('pointerdown', wake)
        host.removeEventListener('pointerup', wake)
        host.removeEventListener('load', wake, { capture: true })
      }
      window.removeEventListener('resize', wake)
      gl.dispose()
    }
  }, [barRef, cardRef])

  // Più alta della fila dei tasti: c'è anche l'ombra sotto.
  return (
    <canvas ref={canvasRef} aria-hidden className="absolute left-0 right-0 top-0 pointer-events-none"
      style={{ width: '100%', height: 'calc(100% + 32px)', opacity: 0 }} />
  )
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
