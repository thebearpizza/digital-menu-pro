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

import { forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CurlRenderer, constrain, solveCurl, type Rect, type Scene, type Sheet, type Vec } from './curl'
import AdminReturn from './AdminReturn'
import FpsMeter from './FpsMeter'
import { useRouter } from 'next/navigation'
import { layoutMenu, mediaViews, SANS, type Dish, type Layout, type MenuData, type MediaView, type Insets } from './typeset'
import { parseMedia } from '@/lib/menuMedia'
import { parseStyle, registerCustomFonts, type MenuStyle } from '@/lib/menuStyle'
import { isLang, type Lang } from '@/lib/translations'
import DishCard from './DishCard'
import { loadStyleAssets } from './fonts'
import { warmImage } from './preload'
import Chrome, { BAR_HIDE } from './Chrome'
import { localize, t, type I18nData } from './i18n'
import { GlassSheen, LiquidOn, glassSurface } from './Glass'
import { readGlassRects } from './GlassStage'

const LANG_KEY = 'dmp-menu-lang'   // stessa chiave del menu pubblico: la lingua scelta vale ovunque
const HINT_KEY = 'lito-swipe-hint'  // istruzioni dei gesti già viste: non tornano più
const BAR_TRAVEL = 72               // px di gesto per aprire/chiudere del tutto la barra

interface Props {
  /** Menu in italiano (lingua base). */
  data:   MenuData
  /** Stile del ristorante (colori, caratteri, layout). */
  style:  MenuStyle
  /** Anteprima della Personalizzazione: lo stile arriva in tempo reale. */
  preview?: boolean
  i18n:   I18nData
  token:  string
  /** Indirizzo di partenza dei collegamenti: '/m' (QR) o '/prova'. */
  base?:  '/m' | '/prova'
  /** Menu vero sul QR: aperture del menu e dei piatti nelle statistiche. */
  track?: { restaurantId: string; menuId: string } | null
}

/** Statistiche (come il vecchio menu): invio senza attendere risposta. */
function sendEvent(t: { restaurantId: string; menuId: string }, event_type: 'menu_open' | 'dish_click', dish_id?: string) {
  try {
    void fetch('/api/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ restaurant_id: t.restaurantId, menu_id: t.menuId, dish_id: dish_id ?? null, event_type }),
    }).catch(() => {})
  } catch { /* statistiche non essenziali */ }
}

interface PageInfo { index: number; spread: boolean; starts: Layout['categoryStarts'] }


type Drag = {
  pointerId: number
  start:     Vec
  last:      Vec
  samples:   { x: number; y: number; t: number }[]
  /** bar = scorrimento verticale che apre/chiude la barra dei comandi. */
  mode:      'undecided' | 'forward' | 'back' | 'bar' | 'none'
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

export default function CurlMenu({ data: base, style: initialStyle, preview = false, i18n, token, base: basePath = '/prova', track = null }: Props) {
  const router = useRouter()
  const trackRef = useRef(track)
  trackRef.current = track
  // Una sola apertura per menu mostrato (anche se l'effetto si ripete).
  const openedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!track || openedRef.current === track.menuId) return
    openedRef.current = track.menuId
    sendEvent(track, 'menu_open')
  }, [track?.menuId])   // eslint-disable-line react-hooks/exhaustive-deps
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
  // Anteprima della Personalizzazione: pagine foto/video in modifica.
  const [mediaOverride, setMediaOverride] = useState<MediaView[] | null>(null)
  const data = useMemo(() => localize(mediaOverride ? { ...base, media: mediaOverride } : base, i18n, lang), [base, i18n, lang, mediaOverride])
  const dataRef = useRef(data)
  dataRef.current = data

  // Stile: fisso nel menu pubblico; nell'anteprima della Personalizzazione
  // arriva a ogni modifica dalla pagina che la contiene.
  const [style, setStyle] = useState(initialStyle)
  const previewRef = useRef(preview)
  // Caratteri caricati dal ristoratore: riconosciuti da fontStack/resolveFace.
  registerCustomFonts(style.customFonts)
  const styleRef = useRef(style)
  styleRef.current = style
  // Sfondo delle pagine già caricato (serve all'impaginazione).
  const assetsRef = useRef<{ background: HTMLImageElement | null }>({ background: null })
  const mediaFocus = useRef<string | null>(null)
  useEffect(() => {
    if (!preview) return
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const msg = e.data as { type?: string; style?: MenuStyle; open?: boolean; pages?: unknown; focus?: string | null }
      if (msg?.type === 'lito-style' && msg.style) setStyle(parseStyle(msg.style))   // ripulito; registra i caratteri caricati
      // Pagine foto/video in modifica: si vedono subito; `focus` = quella
      // aperta nel pannello, su cui si va.
      if (msg?.type === 'lito-media') {
        setMediaOverride(mediaViews(parseMedia(msg.pages), base.categories.flatMap(c => c.dishes)))
        mediaFocus.current = msg.focus ?? null
      }
      // Pannello "Scheda del piatto" della Personalizzazione: mostra la scheda
      // di un piatto (meglio se con foto e descrizione).
      if (msg?.type === 'lito-card') {
        const all = dataRef.current.categories.flatMap(c => c.dishes)
        setCard(msg.open ? all.find(d => d.image && d.description) ?? all.find(d => d.image) ?? all[0] ?? null : null)
      }
    }
    window.addEventListener('message', onMsg)
    window.parent?.postMessage({ type: 'lito-preview-ready' }, window.location.origin)
    return () => window.removeEventListener('message', onMsg)
    // Solo al montaggio: "pronta" una volta (rimandata a ogni cambio di dati,
    // farebbe rimandare stile e pagine all'infinito).
  }, [preview, base])

  // Barra dei comandi (Menu, categorie, lingua): nascosta; si apre scorrendo
  // verso l'alto e segue il dito; si chiude scorrendo in giù, girando pagina o
  // toccando il foglio. Durante il gesto lo stile si scrive direttamente.
  const [chrome, setChrome] = useState(false)
  // Vetro liquido disponibile (WebGL2): i comandi lasciano il fondo al motore.
  const [liquid, setLiquid] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const chromeOpen = useRef(false)
  const barRef = useRef<HTMLDivElement>(null)
  // Istruzioni dei gesti sulla prima pagina: svaniscono durante il primo
  // swipe (di qualunque tipo) e, a gesto compiuto, non tornano più.
  const [hint, setHint] = useState(false)
  const hintRef = useRef<HTMLDivElement>(null)
  const hintDone = useRef(true)
  useEffect(() => {
    let seen = false
    try { seen = localStorage.getItem(HINT_KEY) === '1' } catch { /* memoria non disponibile */ }
    hintDone.current = seen
    if (!seen) setHint(true)
  }, [])
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
    html.style.backgroundColor = styleRef.current.page.paper

    // ── Font: prima il foglio di stile (dichiara le facce), POI la richiesta
    // delle facce: chiesta prima, document.fonts.load risponde "pronto" a vuoto.
    // Anche i caratteri caricati e lo sfondo delle pagine.
    const fontsReady = Promise.race([
      loadStyleAssets(styleRef.current),
      new Promise(r => setTimeout(r, 6000)),
    ])

    let renderer: CurlRenderer | null = null
    let ctx2d: CanvasRenderingContext2D | null = null   // ripiego senza WebGL
    try { renderer = new CurlRenderer(canvas, styleRef.current.page.paper) } catch { ctx2d = canvas.getContext('2d') }
    setLiquid(!!renderer?.liquid)

    // Canvas di lavoro per comporre una pagina alla volta.
    const scratch = document.createElement('canvas')
    const sctx = scratch.getContext('2d')!

    let layout: Layout | null = null
    let index = 0
    // Comunica a React la pagina aperta (categoria attiva nella barra).
    // Foto dei piatti: pagina aperta e successiva (in doppia pagina le due
    // doppie vicine); le altre arrivano quando si gira verso di loro.
    const warmPhotos = () => {
      if (!layout) return
      const span = spread ? 4 : 2
      for (let p = index; p < index + span; p++) for (const d of layout.dishesOn(p)) warmImage(d.image, p > index + (spread ? 1 : 0))
    }
    const report = () => {
      if (!layout) return
      warmPhotos()
      const a = layout.pages[index]?.anchor
      if (a) anchorRef.current = a
      setPageInfo({ index, spread, starts: layout.categoryStarts })
      playback()
      peekIdle()
    }
    let dpr = 1
    let W = 0, H = 0
    let spread = false
    let pageW = 0, spineX = 0
    const textures = new Map<number, WebGLTexture>()
    const bitmaps  = new Map<number, HTMLCanvasElement>()   // solo ripiego 2D

    // ── Pagine foto/video: foto e video caricati una volta (con CORS: vanno
    // nelle texture). Il video gira solo quando la sua pagina è a vista; il
    // fotogramma va direttamente nella sua texture, sotto la pagina.
    const mediaEls = new Map<string, HTMLImageElement | HTMLVideoElement>()
    const videoTex = new Map<string, WebGLTexture>()
    const isVideoUrl = (mp: MediaView, url: string) => mp.video && url === mp.url
    const getMedia = (url: string): HTMLImageElement | HTMLVideoElement | null => {
      const el = mediaEls.get(url)
      if (!el) return null
      if (el instanceof HTMLVideoElement) return renderer && el.readyState >= 2 ? el : null
      return el.complete && el.naturalWidth ? el : null
    }
    /** Ridisegna le pagine che usano `url` (foto o video appena pronti). */
    const invalidate = (url: string) => {
      if (!layout) return
      layout.pages.forEach((p, i) => {
        const mp = p.media
        if (!mp || ((mp.url ?? mp.dish?.image) !== url && mp.poster !== url)) return
        const t = textures.get(i)
        if (t) { renderer?.deleteTexture(t); textures.delete(i) }
        bitmaps.delete(i)
      })
      request()
    }
    const syncMedia = () => {
      if (!layout) return
      for (const p of layout.pages) {
        const mp = p.media
        if (!mp) continue
        const src = mp.url ?? mp.dish?.image ?? null
        const want: { url: string; video: boolean }[] = []
        // Senza WebGL il video non si può mostrare: resta l'immagine d'attesa.
        if (src && !(isVideoUrl(mp, src) && !renderer)) want.push({ url: src, video: isVideoUrl(mp, src) })
        if (mp.poster) want.push({ url: mp.poster, video: false })
        for (const w of want) {
          if (mediaEls.has(w.url)) continue
          if (w.video) {
            const v = document.createElement('video')
            v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous'
            v.setAttribute('playsinline', ''); v.setAttribute('muted', '')
            v.addEventListener('loadeddata', () => invalidate(w.url), { once: true })
            v.src = w.url
            mediaEls.set(w.url, v)
          } else {
            const im = new Image()
            im.crossOrigin = 'anonymous'; im.decoding = 'async'
            im.onload = () => invalidate(w.url)
            im.onerror = () => { mediaEls.delete(w.url) }   // si riprova alla prossima impaginazione
            im.src = w.url
            mediaEls.set(w.url, im)
          }
        }
      }
    }
    /** Video a vista: in riproduzione; gli altri in pausa. */
    const playback = () => {
      if (!layout) return
      const near = new Set<string>()
      for (let i = index - 1; i <= index + (spread ? 3 : 1); i++) {
        const mp = layout.pages[i]?.media
        if (mp?.video && mp.url) near.add(mp.url)
      }
      mediaEls.forEach((el, url) => {
        if (!(el instanceof HTMLVideoElement)) return
        if (near.has(url)) { if (el.paused) el.play().catch(() => undefined) }
        else if (!el.paused) el.pause()
      })
    }
    let liveVideo = false
    /** Video sotto la pagina i (se è una pagina video pronta): texture
     *  aggiornata al fotogramma attuale e ritaglio "cover". */
    const videoFor = (i: number, rect: Rect): Sheet['video'] => {
      const mp = layout?.pages[i]?.media
      if (!mp?.video || !mp.url || !renderer) return null
      const v = getMedia(mp.url)
      if (!(v instanceof HTMLVideoElement)) return null
      let t = videoTex.get(mp.url)
      if (!t) { t = renderer.createVideoTexture(); videoTex.set(mp.url, t) }
      renderer.updateVideo(t, v)
      if (!v.paused) liveVideo = true
      const A = rect.w / rect.h, va = v.videoWidth / v.videoHeight
      const map: [number, number, number, number] = va > A ? [A / va, 1, (1 - A / va) / 2, 0] : [1, va / A, 0, (1 - va / A) / 2]
      return { tex: t, map }
    }

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
        return t ? { rect, front: t, gutter, gutterK: spread ? GUTTER_SPREAD : GUTTER_SINGLE, kind, video: videoFor(i, rect) } : null
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
      const shadow = Math.min(1, prog * 7, (1 - prog) * 7) * styleRef.current.effects.shadow
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
      return { statics, moving, shadow, through: styleRef.current.effects.showThrough }
    }

    // ── Barra dei comandi e istruzioni (stile scritto direttamente durante i gesti)
    const barHide = () => BAR_HIDE + insets().bottom
    const setBar = (p: number) => {
      const el = barRef.current
      if (!el) return
      el.style.transition = 'none'
      el.style.transform = `translate3d(0, ${((1 - p) * barHide()).toFixed(1)}px, 0)`
    }
    const settleBar = (open: boolean) => {
      const el = barRef.current
      if (el) {
        el.style.transition = 'transform 420ms cubic-bezier(0.2, 0.9, 0.25, 1)'
        el.style.transform = open ? 'translate3d(0, 0, 0)' : `translate3d(0, ${barHide()}px, 0)`
      }
      chromeOpen.current = open
      setChrome(open)
    }
    /** f = 0 istruzioni piene → 1 sparite (segue il gesto). */
    const fadeHint = (f: number) => {
      const el = hintRef.current
      if (!el || hintDone.current) return
      el.style.transition = 'none'
      el.style.opacity = (1 - Math.max(0, Math.min(1, f))).toFixed(3)
    }
    const restoreHint = () => {
      const el = hintRef.current
      if (!el || hintDone.current) return
      el.style.transition = 'opacity 260ms ease'
      el.style.opacity = '1'
    }
    const finishHint = () => {
      if (hintDone.current) return
      hintDone.current = true
      try { localStorage.setItem(HINT_KEY, '1') } catch { /* memoria non disponibile */ }
      const el = hintRef.current
      if (el) { el.style.transition = 'opacity 260ms ease'; el.style.opacity = '0' }
      window.setTimeout(() => setHint(false), 300)
    }

    // ── Disegno
    const draw = () => {
      raf = 0
      if (!layout) return
      // Il primo giro di pagina fa svanire le istruzioni insieme al foglio.
      if (!hintDone.current && index === 0 && !peeking) {
        if (turn?.kind === 'forward') fadeHint(((turn.P0.x - turn.F.x) / (2 * pageW)) * 4)
        else if (!turn) restoreHint()
      }
      if (renderer) {
        liveVideo = false
        const scene = buildScene()
        if (scene) renderer.render(scene)
        // Un video a vista: si continua a disegnare a ogni fotogramma.
        if (liveVideo) request()
      } else if (ctx2d) {
        // Ripiego: la pagina scorre via orizzontalmente, senza 3D.
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx2d.fillStyle = styleRef.current.page.paper; ctx2d.fillRect(0, 0, W, H)
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
      renderer?.setPaper(styleRef.current.page.paper)
      html.style.backgroundColor = styleRef.current.page.paper
      layout = layoutMenu(sctx, dataRef.current, { w: pageW, h: H, insets: insets() }, styleRef.current, { ...assetsRef.current, media: getMedia })
      syncMedia()
      // Anteprima: la pagina foto/video aperta nel pannello si mostra subito.
      const focusIdx = mediaFocus.current ? layout.pages.findIndex(p => p.anchor === `media:${mediaFocus.current}`) : -1
      mediaFocus.current = null
      const found = focusIdx >= 0 ? focusIdx : anchor ? layout.pages.findIndex(p => p.anchor === anchor) : -1
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
      if (index !== 0) finishHint()
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
      // Velocità dello sfoglio scelta nella Personalizzazione.
      const dur = Math.max(140, base / (1 + Math.min(2.5, Math.abs(velocity) * 0.9))) / styleRef.current.effects.speed
      anim = { turn: t, from: { ...t.F }, to: target, t0: performance.now(), dur: arc ? Math.max(dur, 460) : dur, commit, arc }
      requestAnimationFrame(tick)
    }
    const skipAnim = () => {
      if (!anim) return
      anim.turn.F = { ...anim.to }
      finish()
    }

    // ── Invito a sfogliare: fermi da 2 s sulla prima pagina, il lato del foglio
    // si solleva piano, resta un attimo e si riabbassa (2,8 s). Si ripete ogni 6 s (al massimo 3 volte)
    // finché non si gira la prima pagina; da lì non ricompare più. Qualsiasi
    // tocco lo interrompe subito.
    const PEEK_DUR = 2800, PEEK_MAX = 3
    let peekTimer = 0, peekT0 = 0, peeks = 0, peeking = false, turnedOnce = false
    const peekIdle = (delay = 2000) => {
      clearTimeout(peekTimer)
      if (previewRef.current) return   // nell'anteprima del gestionale darebbe fastidio
      if (!styleRef.current.chrome.peek) return
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
      // Sale piano (40%), resta un attimo sollevato (20%), ridiscende (40%).
      const a = u < 0.4 ? Math.pow(Math.sin((Math.PI / 2) * (u / 0.4)), 2)
        : u < 0.6 ? 1
        : Math.pow(Math.cos((Math.PI / 2) * ((u - 0.6) / 0.4)), 2)
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
      drag = { pointerId: e.pointerId, start: p, last: p, samples: [{ x: p.x, y: p.y, t: e.timeStamp }], mode: 'undecided', startedAt: e.timeStamp }
    }

    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.pointerId) return
      const p = pos(e)
      drag.last = p
      drag.samples.push({ x: p.x, y: p.y, t: e.timeStamp })
      if (drag.samples.length > 6) drag.samples.shift()
      if (drag.mode === 'undecided') {
        const dx = p.x - drag.start.x, dy = p.y - drag.start.y
        if (Math.hypot(dx, dy) < 8) return
        if (Math.abs(dy) > Math.abs(dx) * 1.4) {
          // Verticale: in su apre la barra, in giù la chiude.
          drag.mode = (dy < 0) !== chromeOpen.current ? 'bar' : 'none'
          drag.start = { x: p.x, y: p.y }
          return
        }
        if (dx < 0 && canForward()) drag.mode = 'forward'
        else if (dx > 0 && canBack()) drag.mode = 'back'
        else { drag.mode = 'none'; return }
        if (chromeOpen.current) settleBar(false)   // si legge: i comandi si tolgono di mezzo
        // Il gesto riparte da qui (x E y): nessun salto, nessuna piega storta
        // nei primi fotogrammi.
        drag.start = { x: p.x, y: p.y }
      }
      if (drag.mode === 'bar') {
        const dy = p.y - drag.start.y
        const prog = chromeOpen.current ? 1 - Math.max(0, Math.min(1, dy / BAR_TRAVEL)) : Math.max(0, Math.min(1, -dy / BAR_TRAVEL))
        setBar(prog)
        if (!chromeOpen.current) fadeHint(prog)
        return
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
        const px = d.start.x - (right ? spineX : 0)
        // Anteprima della Personalizzazione: il tocco dice al gestionale che
        // cosa si vuole modificare (niente scheda del piatto).
        if (previewRef.current && layout) {
          window.parent?.postMessage({ type: 'lito-pick', target: layout.pick(page, px, d.start.y) }, window.location.origin)
          return
        }
        const dish = layout?.hit(page, px, d.start.y)
        if (dish) {
          warmImage(dish.image)
          setCard(dish)
          if (trackRef.current) sendEvent(trackRef.current, 'dish_click', dish.id)
        } else if (chromeOpen.current) settleBar(false)   // spazio vuoto: chiude i comandi
        peekIdle()
        return
      }
      if (d.mode === 'bar') {
        // Rilascio: si apre/chiude secondo la strada fatta e la velocità.
        const s = d.samples, a = s[0], b = s[s.length - 1]
        const vy = b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0     // px/ms, negativo = in su
        const dy = d.last.y - d.start.y
        const prog = chromeOpen.current ? 1 - Math.max(0, Math.min(1, dy / BAR_TRAVEL)) : Math.max(0, Math.min(1, -dy / BAR_TRAVEL))
        const open = vy < -0.3 || (prog > 0.45 && vy < 0.3)
        settleBar(open)
        if (open) finishHint()
        else restoreHint()
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
      const d = drag
      drag = null
      if (d.mode === 'bar') { settleBar(chromeOpen.current); restoreHint() }
      if (turn) animate(turn, false)
      else peekIdle()
    }

    const onKey = (e: KeyboardEvent) => {
      if (anim || drag || cardOpen.current) return
      cancelPeek()
      if ((e.key === 'ArrowRight' || e.key === ' ') && canForward()) { settleBar(false); turnBy('forward', H * 0.7) }
      else if (e.key === 'ArrowLeft' && canBack()) { settleBar(false); turnBy('back', H * 0.7) }
      else if (e.key === 'ArrowUp') { settleBar(true); finishHint() }
      else if (e.key === 'ArrowDown') settleBar(false)
    }

    // ── Contesto WebGL perso (es. app in background su iOS): si ricrea tutto.
    const onLost = (e: Event) => { e.preventDefault() }
    const onRestored = () => {
      try { renderer = new CurlRenderer(canvas, styleRef.current.page.paper) } catch { renderer = null }
      setLiquid(!!renderer?.liquid)
      glassSig = ''
      textures.clear()
      videoTex.clear()
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

    // ── Vetro liquido dei comandi (barra, categorie, lingua, istruzioni): il
    // motore del giro pagina lo disegna sopra la pagina. Qui si seguono gli
    // elementi in vetro: quando si muovono (barra che sale, menu che si apre,
    // indicatore che scivola) si ridisegna solo il vetro.
    const press = new Map<Element, number>()
    let glassSig = '', glassRaf = 0
    const glassTick = () => {
      glassRaf = requestAnimationFrame(glassTick)
      const root = rootRef.current
      if (!renderer?.liquid || !root || !layout) return
      const { rects, moving } = readGlassRects(root, press, true, window.innerHeight)
      const look = styleRef.current.chrome.glass
      const sig = JSON.stringify([rects, look])
      if (sig === glassSig && !moving) return
      glassSig = sig
      renderer.setGlass(rects, look)
      renderer.composite()
    }
    glassRaf = requestAnimationFrame(glassTick)

    fontsReady
      // Lo stile può essere cambiato nel frattempo (anteprima): si impagina
      // con le risorse dello stile attuale (già in memoria se pronte).
      .then(() => Promise.race([loadStyleAssets(styleRef.current), new Promise<null>(r => setTimeout(() => r(null), 4000))]))
      .then(a => {
        if (disposed) return
        if (a) assetsRef.current = a
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
      cancelAnimationFrame(glassRaf)
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
      for (const t of Array.from(videoTex.values())) renderer?.deleteTexture(t)
      mediaEls.forEach(el => { if (el instanceof HTMLVideoElement) { el.pause(); el.removeAttribute('src'); el.load() } })
    }
  }, [token])

  // Cambio lingua: stesso impianto, testi nuovi.
  useEffect(() => { apiRef.current?.refresh() }, [data])

  // Cambio di stile (anteprima): prima i caratteri nuovi, poi si reimpagina.
  const firstStyle = useRef(true)
  useEffect(() => {
    if (firstStyle.current) { firstStyle.current = false; return }
    let stale = false
    loadStyleAssets(style)
      .then(a => { if (!stale) { assetsRef.current = a; apiRef.current?.refresh() } })
      .catch(() => undefined)
    return () => { stale = true }
  }, [style])

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
    <div ref={rootRef} className="fixed inset-0 overflow-hidden" style={{ background: style.page.paper, overscrollBehavior: 'none' }}>
      {!preview && <AdminReturn />}
      <FpsMeter />
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
            <span className="text-[10px] uppercase tracking-[0.35em]" style={{ color: style.page.accent }}>{data.restaurantName}</span>
          </div>
        )}
      </div>
      {status !== 'loading' && (
        <LiquidOn.Provider value={liquid}>
        <Chrome shown={chrome} barRef={barRef} lang={lang} onLang={setLang}
          onMenus={() => router.push(`${basePath}/${token}?from=menu`)}   // ritorno: non è una nuova visita
          categories={pageInfo.starts} active={activeCategory} onJump={p => apiRef.current?.jump(p)}
          tint={style.chrome.tint} accent={style.page.accent} />
        </LiquidOn.Provider>
      )}
      {hint && style.chrome.hints && !preview && status !== 'loading' && pageInfo.index === 0 && (
        <LiquidOn.Provider value={liquid}>
          <SwipeHint ref={hintRef} up={t('swipeUp', lang)} side={t('swipeSide', lang)} />
        </LiquidOn.Provider>
      )}
      {card && <DishCard key={card.id} dish={card} style={style} lang={lang} sequence={sequence} siblings={siblings} onClosed={onClosed} />}
    </div>
  )
}

// ── Istruzioni dei gesti (solo prima pagina, finché non si fa il primo swipe) ──

const SwipeHint = forwardRef<HTMLDivElement, { up: string; side: string }>(function SwipeHint({ up, side }, ref) {
  // L'opacità sta sulla capsula stessa (un antenato semitrasparente spegnerebbe
  // la sfocatura del vetro); entra con una dissolvenza, poi la guida il gesto.
  const [shown, setShown] = useState(false)
  const liquid = useContext(LiquidOn)
  useEffect(() => { const tm = window.setTimeout(() => setShown(true), 500); return () => clearTimeout(tm) }, [])
  return (
    <div className="fixed left-0 right-0 flex justify-center pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)', zIndex: 39, padding: '0 16px' }}>
      <style>{`
        @keyframes lito-hint-up { 0%, 100% { transform: translate3d(0, 3px, 0); opacity: .55 } 50% { transform: translate3d(0, -4px, 0); opacity: 1 } }
        @keyframes lito-hint-side { 0%, 100% { transform: translate3d(3px, 0, 0); opacity: .55 } 50% { transform: translate3d(-4px, 0, 0); opacity: 1 } }
      `}</style>
      <div ref={ref} className="relative flex flex-col items-center" data-glass={liquid ? '' : undefined} data-radius="22" data-panel="1"
        style={{ ...(liquid ? {} : glassSurface()), borderRadius: 22, padding: '10px 18px 11px', gap: 5, maxWidth: 360, opacity: shown ? 1 : 0, transition: 'opacity 700ms ease' }}>
        {!liquid && <GlassSheen />}
        <HintRow anim="lito-hint-up" icon={<path d="M2 9l6-6 6 6" />} text={up} />
        <HintRow anim="lito-hint-side" icon={<path d="M10 2L4 8l6 6" />} text={side} soft />
      </div>
    </div>
  )
})

function HintRow({ anim, icon, text, soft }: { anim: string; icon: React.ReactNode; text: string; soft?: boolean }) {
  return (
    <div className="relative flex items-center" style={{ gap: 9 }}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0"
        style={{ animation: `${anim} 1.6s ease-in-out infinite`, fill: 'none', stroke: '#1d1915', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        {icon}
      </svg>
      <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: soft ? 500 : 600, letterSpacing: '0.01em', color: soft ? 'rgba(29,25,21,0.6)' : '#1d1915' }}>{text}</span>
    </div>
  )
}
