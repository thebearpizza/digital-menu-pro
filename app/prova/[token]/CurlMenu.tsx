'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Menu a tutto schermo con sfoglio "a cilindro" (prototipo).
//
// Due impaginazioni, come l'app Libri:
//   • pagina singola (telefono, tablet in verticale): il foglio è tutto lo
//     schermo, il dorso è il bordo sinistro;
//   • doppia pagina (tablet/schermo largo in orizzontale): due pagine
//     affiancate, il dorso è al centro; il foglio di destra gira attorno al
//     dorso e si posa sulla sinistra mostrando sul retro la pagina successiva.
//
// `index` = prima pagina visibile (in doppia pagina: la sinistra, sempre pari).
// Il foglio che si muove è afferrato sul bordo libero (P0, a destra, all'altezza
// del dito); F è il punto dove quel bordo deve trovarsi.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CurlRenderer, constrain, solveCurl, type Rect, type Scene, type Sheet, type Vec } from './curl'
import { useRouter } from 'next/navigation'
import { layoutMenu, FONT_FACES, PAPER, type Dish, type Layout, type MenuData, type Insets } from './typeset'
import { isLang, type Lang } from '@/lib/translations'
import DishCard from './DishCard'
import Chrome from './Chrome'
import { localize, type I18nData, type MenuChoice } from './i18n'

const LANG_KEY = 'dmp-menu-lang'   // stessa chiave del menu pubblico: la lingua scelta vale ovunque

interface Props {
  /** Menu in italiano (lingua base). */
  data:   MenuData
  i18n:   I18nData
  menus:  MenuChoice[]
  menuId: string
  token:  string
}

interface PageInfo { index: number; spread: boolean; starts: Layout['categoryStarts'] }

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
  /** Arco verticale (px): da tastiera la pagina si gira dall'angolo, non dritta. */
  arc:    number
}

export default function CurlMenu({ data: base, i18n, menus, menuId, token }: Props) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const probeRef  = useRef<HTMLDivElement>(null)
  const stageRef  = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'nogl'>('loading')

  // Lingua (ricordata sul dispositivo) e menu tradotto.
  const [lang, setLangState] = useState<Lang>('it')
  useEffect(() => {
    try { const saved = localStorage.getItem(LANG_KEY); if (isLang(saved)) setLangState(saved) } catch { /* memoria non disponibile */ }
  }, [])
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(LANG_KEY, l) } catch { /* memoria non disponibile */ }
  }, [])
  const data = useMemo(() => localize(base, i18n, lang), [base, i18n, lang])
  const dataRef = useRef(data)
  dataRef.current = data

  // Comandi (Menu, lingua, categorie): visibili all'apertura, spariscono
  // girando pagina, riappaiono toccando uno spazio vuoto della pagina.
  const [chrome, setChrome] = useState(true)
  const [pageInfo, setPageInfo] = useState<PageInfo>({ index: 0, spread: false, starts: [] })
  const apiRef = useRef<{ refresh: () => void; jump: (page: number) => void } | null>(null)
  const anchorRef = useRef<string | null>(null)   // primo piatto visto: resta lì cambiando lingua
  // Scheda del piatto aperta (il tocco su un piatto la apre).
  const [card, setCard] = useState<Dish | null>(null)
  const cardOpen = useRef(false)
  cardOpen.current = !!card

  useEffect(() => {
    const canvas = canvasRef.current!
    const probe  = probeRef.current!
    let disposed = false
    // Sotto le barre di Safari si vede lo sfondo della pagina: color carta.
    const html = document.documentElement
    const prevBg = html.style.backgroundColor
    html.style.backgroundColor = PAPER

    // ── Font: prima il foglio di stile (dichiara le facce), POI la richiesta
    // delle facce: chiesta prima, document.fonts.load risponde "pronto" a vuoto.
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
    // Comunica a React la pagina aperta (categoria attiva nella barra).
    const report = () => {
      if (!layout) return
      const a = layout.pages[index]?.anchor
      if (a) anchorRef.current = a
      setPageInfo({ index, spread, starts: layout.categoryStarts })
      peekIdle()
    }
    let dpr = 1
    let W = 0, H = 0
    let spread = false
    let pageW = 0, spineX = 0
    const textures = new Map<number, WebGLTexture>()
    const bitmaps  = new Map<number, HTMLCanvasElement>()   // solo ripiego 2D

    let drag: Drag | null = null
    let turn: Turn | null = null
    let anim: Anim | null = null
    let raf = 0

    const step = () => (spread ? 2 : 1)
    const pageCount = () => layout?.pages.length ?? 0
    const canForward = () => index + step() < pageCount()
    const canBack = () => index > 0

    const insets = (): Insets => {
      const cs = getComputedStyle(probe)
      return {
        top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0,
        bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0,
      }
    }

    const pageCanvas = (i: number): HTMLCanvasElement => {
      scratch.width = Math.round(pageW * dpr); scratch.height = Math.round(H * dpr)
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      layout!.paint(sctx, i)
      return scratch
    }

    // Pagine fuori intervallo (fine della doppia pagina) = carta vuota.
    const texture = (i: number): WebGLTexture | null => {
      if (!layout || !renderer || i < 0) return null
      const key = Math.min(i, pageCount())   // tutte le vuote condividono una texture
      let t = textures.get(key)
      if (!t) { t = renderer.createTexture(pageCanvas(key)); textures.set(key, t) }
      return t
    }
    const bitmap = (i: number): HTMLCanvasElement | null => {
      if (!layout || i < 0 || i >= pageCount()) return null
      let b = bitmaps.get(i)
      if (!b) {
        const src = pageCanvas(i)
        b = document.createElement('canvas'); b.width = src.width; b.height = src.height
        b.getContext('2d')!.drawImage(src, 0, 0)
        bitmaps.set(i, b)
      }
      return b
    }

    // Tiene in memoria solo le pagine vicine; prepara in anticipo quelle utili.
    const prune = () => {
      const keep = spread ? 4 : 2
      for (const [i, t] of Array.from(textures)) {
        if (i !== pageCount() && Math.abs(i - index) > keep) { renderer?.deleteTexture(t); textures.delete(i) }
      }
      for (const i of Array.from(bitmaps.keys())) if (Math.abs(i - index) > keep) bitmaps.delete(i)
    }
    let warmTimer = 0
    const warm = () => {
      clearTimeout(warmTimer)
      warmTimer = window.setTimeout(() => {
        const want = spread ? [index + 2, index + 3, index - 1, index - 2] : [index + 1, index - 1]
        for (const i of want) { if (i < 0 || i > pageCount()) continue; if (renderer) texture(i); else bitmap(i) }
        draw()
      }, 60)
    }

    // ── Scena
    const leftRect  = (): Rect => ({ x: 0, y: 0, w: pageW, h: H })
    const rightRect = (): Rect => ({ x: spineX, y: 0, w: pageW, h: H })
    const GUTTER_SINGLE = 0.06, GUTTER_SPREAD = 0.13

    const buildScene = (): Scene | null => {
      if (!layout || !renderer) return null
      const sheet = (rect: Rect, i: number, gutter: 'left' | 'right', kind: 0 | 1 | 2 = 0): Sheet | null => {
        const t = texture(i)
        return t ? { rect, front: t, gutter, gutterK: spread ? GUTTER_SPREAD : GUTTER_SINGLE, kind } : null
      }
      const only = <T,>(xs: (T | null)[]) => xs.filter((x): x is T => !!x)

      if (!turn) {
        const statics = spread
          ? only([sheet(leftRect(), index, 'right'), sheet(rightRect(), index + 1, 'left')])
          : only([sheet(rightRect(), index, 'left')])
        return { statics, moving: null, shadow: 0 }
      }

      const fwd = turn.kind === 'forward'
      const curl = solveCurl(turn.P0, turn.F, pageW)
      const prog = Math.max(0, Math.min(1, (turn.P0.x - turn.F.x) / (2 * pageW)))
      const shadow = Math.min(1, prog * 7, (1 - prog) * 7)
      // Il foglio che si muove: la destra che gira (avanti) o la sinistra che
      // torna (indietro). In doppia pagina il retro è la pagina vera.
      const frontIdx = fwd ? index + (spread ? 1 : 0) : index - 1
      const backIdx  = fwd ? index + 2 : index
      const movingSheet = sheet(rightRect(), frontIdx, 'left')
      if (!movingSheet) return null
      const moving = { ...movingSheet, back: spread ? texture(backIdx) : null, curl }

      const statics = spread
        ? only([
            sheet(leftRect(),  fwd ? index : index - 2, 'right', 2),
            sheet(rightRect(), fwd ? index + 3 : index + 1, 'left', 1),
          ])
        : only([sheet(rightRect(), fwd ? index + 1 : index, 'left', 1)])
      return { statics, moving, shadow }
    }

    // ── Disegno
    const draw = () => {
      raf = 0
      if (!layout) return
      if (renderer) {
        const scene = buildScene()
        if (scene) renderer.render(scene)
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

    // ── Misure, impaginazione, resize (mantiene il primo piatto visto)
    const relayout = () => {
      const anchor = layout?.pages[index]?.anchor ?? anchorRef.current
      W = window.innerWidth; H = window.innerHeight
      // Doppia pagina come Libri: schermo largo e in orizzontale (solo con WebGL).
      spread = !!renderer && W >= 700 && W / H >= 1.15
      pageW = spread ? W / 2 : W
      spineX = spread ? W / 2 : 0
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
      layout = layoutMenu(sctx, dataRef.current, { w: pageW, h: H, insets: insets() })
      const found = anchor ? layout.pages.findIndex(p => p.anchor === anchor) : -1
      index = found >= 0 ? found : Math.min(index, layout.pages.length - 1)
      if (spread) index -= index % 2
      peeking = false
      turn = null; anim = null; drag = null
      draw(); warm(); report()
    }

    // ── Animazione di rilascio
    const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)
    const tick = (now: number) => {
      if (!anim) return
      const k = Math.min(1, (now - anim.t0) / anim.dur)
      const e = easeOut(k)
      const raw = {
        x: anim.from.x + (anim.to.x - anim.from.x) * e,
        y: anim.from.y + (anim.to.y - anim.from.y) * e - Math.sin(Math.PI * e) * anim.arc,
      }
      anim.turn.F = constrain(anim.turn.P0, raw, spineX, H)
      turn = anim.turn
      if (k < 1) { draw(); requestAnimationFrame(tick); return }
      finish()
    }
    const finish = () => {
      if (!anim) return
      const { turn: t, commit } = anim
      if (commit) index += (t.kind === 'forward' ? 1 : -1) * step()
      anim = null; turn = null
      draw(); prune(); warm(); report()
    }
    const turnedX = () => 2 * spineX - W     // F.x con il foglio girato del tutto
    const animate = (t: Turn, commit: boolean, velocity = 0, arc = 0) => {
      const fullyTurned = { x: turnedX(), y: t.P0.y }
      const flat = { x: t.P0.x, y: t.P0.y }
      const target = (t.kind === 'forward') === commit ? fullyTurned : flat
      const dist = Math.hypot(target.x - t.F.x, target.y - t.F.y)
      // Durata: proporzionale alla strada, più breve se il dito era veloce.
      const base = Math.max(170, Math.min(560, (dist / pageW) * 430))
      const dur = Math.max(140, base / (1 + Math.min(2.5, Math.abs(velocity) * 0.9)))
      anim = { turn: t, from: { ...t.F }, to: target, t0: performance.now(), dur: arc ? Math.max(dur, 460) : dur, commit, arc }
      requestAnimationFrame(tick)
    }
    const skipAnim = () => {
      if (!anim) return
      anim.turn.F = { ...anim.to }
      finish()
    }

    // ── Invito a sfogliare: fermi da 2 s sulla prima pagina, il lato del foglio
    // si solleva appena e si riabbassa. Si ripete ogni 6 s (al massimo 3 volte)
    // finché non si gira la prima pagina; da lì non ricompare più. Qualsiasi
    // tocco lo interrompe subito.
    const PEEK_DUR = 1400, PEEK_MAX = 3
    let peekTimer = 0, peekT0 = 0, peeks = 0, peeking = false, turnedOnce = false
    const peekIdle = (delay = 2000) => {
      clearTimeout(peekTimer)
      if (index !== 0) turnedOnce = true
      if (turnedOnce || peeks >= PEEK_MAX || disposed) return
      peekTimer = window.setTimeout(startPeek, delay)
    }
    const startPeek = () => {
      if (!layout || index !== 0 || !canForward()) return
      // Occupato (dito sul foglio, animazione, scheda aperta, app in background): si riprova.
      if (drag || anim || cardOpen.current || document.hidden) { peekIdle(); return }
      peeks++; peeking = true; peekT0 = performance.now()
      requestAnimationFrame(peekTick)
    }
    const peekTick = (now: number) => {
      if (!peeking) return
      const u = Math.min(1, (now - peekT0) / PEEK_DUR)
      const a = Math.pow(Math.sin(Math.PI * u), 2)          // sale e scende, morbido ai capi
      // Si solleva il lato libero del foglio (appena inclinato, più in basso
      // che in alto), sopra la barra dei comandi.
      const lift = a * pageW * 0.12
      const P0 = { x: W, y: H * 0.62 }
      turn = { kind: 'forward', P0, F: constrain(P0, { x: W - lift, y: P0.y - lift * 0.18 }, spineX, H) }
      draw()
      if (u < 1) { requestAnimationFrame(peekTick); return }
      peeking = false; turn = null; draw()
      peekIdle(6000)
    }
    const cancelPeek = () => {
      clearTimeout(peekTimer)
      if (!peeking) return
      peeking = false; turn = null; draw()
    }

    // ── Gesti
    const pos = (e: PointerEvent): Vec => ({ x: e.clientX, y: e.clientY })

    // Il dito tiene la piega: la piega sta sotto il dito (F.x ≈ 2·dito − W) e
    // il foglio è girato del tutto quando il dito arriva al dorso / al bordo.
    // Il guadagno si adatta alla strada che il dito ha davanti (tetto 3×).
    const turnFromDrag = (d: Drag, p: Vec): Turn => {
      const y0 = Math.max(0, Math.min(H, d.start.y))
      const P0 = { x: W, y: y0 }
      const dx = p.x - d.start.x, dy = p.y - d.start.y
      const fx = d.mode === 'forward'
        ? W + dx * Math.min(3, (2 * pageW) / Math.max(1, d.start.x - spineX))
        : turnedX() + dx * Math.min(3, (2 * pageW) / Math.max(1, W - d.start.x))
      return { kind: d.mode === 'forward' ? 'forward' : 'back', P0, F: constrain(P0, { x: fx, y: y0 + dy }, spineX, H) }
    }

    // Presa in basso → l'angolo sale verso il centro (e viceversa).
    const tapArc = (y0: number) => (y0 > H / 2 ? 1 : -1) * H * 0.07
    const turnBy = (kind: 'forward' | 'back', y: number) => {
      const y0 = Math.max(H * 0.15, Math.min(H * 0.85, y))
      const F = kind === 'forward' ? { x: W - 1, y: y0 } : { x: turnedX() + 1, y: y0 }
      animate({ kind, P0: { x: W, y: y0 }, F }, true, 0, tapArc(y0))
    }

    const onDown = (e: PointerEvent) => {
      if (!layout || drag) return
      cancelPeek()
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
        if (dx < 0 && canForward()) drag.mode = 'forward'
        else if (dx > 0 && canBack()) drag.mode = 'back'
        else { drag.mode = 'none'; return }
        setChrome(false)   // si legge: i comandi si tolgono di mezzo
        // Il gesto riparte da qui (x E y): nessun salto, nessuna piega storta
        // nei primi fotogrammi.
        drag.start = { x: p.x, y: p.y }
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
      if (d.mode === 'undecided' && moved < 8 && e.timeStamp - d.startedAt < 500) {
        // Tocco: apre la scheda del piatto sotto il dito (la pagina si gira
        // solo trascinando o con uno swipe deciso).
        const right = spread && d.start.x >= spineX
        const page = spread ? index + (right ? 1 : 0) : index
        const dish = layout?.hit(page, d.start.x - (right ? spineX : 0), d.start.y)
        if (dish) {
          if (dish.image) { const im = new Image(); im.src = dish.image }
          setCard(dish)
        } else setChrome(c => !c)   // spazio vuoto: mostra/nasconde i comandi
        peekIdle()
        return
      }
      if (!turn || (d.mode !== 'forward' && d.mode !== 'back')) { turn = null; request(); peekIdle(); return }
      const v = velocityX(d)
      const prog = (turn.P0.x - turn.F.x) / (2 * pageW)   // 0 = piatta, 1 = girata
      const commit = turn.kind === 'forward'
        ? v < -0.35 || (prog > 0.33 && v < 0.25)
        : v > 0.35 || (prog < 0.67 && v > -0.25)
      animate(turn, commit, v)
    }

    const onCancel = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.pointerId) return
      drag = null
      if (turn) animate(turn, false)
      else peekIdle()
    }

    const onKey = (e: KeyboardEvent) => {
      if (anim || drag || cardOpen.current) return
      cancelPeek()
      if ((e.key === 'ArrowRight' || e.key === ' ') && canForward()) { setChrome(false); turnBy('forward', H * 0.7) }
      else if (e.key === 'ArrowLeft' && canBack()) { setChrome(false); turnBy('back', H * 0.7) }
    }

    // ── Contesto WebGL perso (es. app in background su iOS): si ricrea tutto.
    const onLost = (e: Event) => { e.preventDefault() }
    const onRestored = () => {
      try { renderer = new CurlRenderer(canvas, PAPER) } catch { renderer = null }
      textures.clear()
      relayout()
    }

    // Comandi da React: nuova lingua (si reimpagina restando sullo stesso
    // piatto) e salto alla pagina di una categoria (breve dissolvenza sulla carta).
    let jumpTimer = 0
    apiRef.current = {
      refresh: () => { if (layout) relayout() },
      jump: (page: number) => {
        if (!layout || anim || drag) return
        cancelPeek()
        const target = Math.max(0, Math.min(pageCount() - 1, spread ? page - (page % 2) : page))
        if (target === index) return
        const stage = stageRef.current
        if (stage) { stage.style.transition = 'opacity 120ms ease'; stage.style.opacity = '0' }
        clearTimeout(jumpTimer)
        jumpTimer = window.setTimeout(() => {
          index = target; turn = null
          draw(); prune(); warm(); report()
          if (stage) { stage.style.transition = 'opacity 220ms ease'; stage.style.opacity = '1' }
        }, 120)
      },
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
      html.style.backgroundColor = prevBg
      cancelAnimationFrame(raf)
      clearTimeout(warmTimer); clearTimeout(resizeTimer); clearTimeout(jumpTimer); clearTimeout(peekTimer)
      peeking = false
      apiRef.current = null
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
  }, [])

  // Cambio lingua: stesso impianto, testi nuovi.
  useEffect(() => { apiRef.current?.refresh() }, [data])

  // Piatti della stessa categoria del menu (per "Altro in …" nella scheda).
  const siblings = useCallback((d: Dish) => data.categories.find(c => c.dishes.some(x => x.id === d.id))?.dishes ?? [], [data])
  // Tutti i piatti in ordine di menu (swipe precedente/successivo nella scheda).
  const sequence = useMemo(() => data.categories.flatMap(c => c.dishes), [data])
  const onClosed = useCallback(() => setCard(null), [])
  // Categoria della pagina aperta (in doppia pagina conta anche la destra).
  const activeCategory = useMemo(() => {
    const last = pageInfo.index + (pageInfo.spread ? 1 : 0)
    let a = 0
    pageInfo.starts.forEach((c, i) => { if (c.page <= last) a = i })
    return a
  }, [pageInfo])

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: PAPER, overscrollBehavior: 'none' }}>
      <div ref={stageRef} className="absolute inset-0 overflow-hidden">
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
      {status !== 'loading' && (
        <Chrome shown={chrome} lang={lang} onLang={setLang} menus={menus} menuId={menuId}
          onMenu={id => router.replace(`/prova/${token}?menu=${id}`)}
          categories={pageInfo.starts} active={activeCategory} onJump={p => apiRef.current?.jump(p)} />
      )}
      {card && <DishCard key={card.id} dish={card} lang={lang} sequence={sequence} siblings={siblings} onClosed={onClosed} />}
    </div>
  )
}
