'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Scheda del piatto, come la scheda di un libro nell'app Libri.
//
//  • Si apre salendo dal basso: una scheda quasi a tutto schermo (staccata ai
//    lati e in alto, prosegue sotto il fondo dello schermo), il menu si scurisce.
//  • Scorrendo verso il basso la scheda si allarga fino a tutto schermo;
//    scorrendo verso l'alto si rimpicciolisce subito, ovunque si sia nel testo
//    (come le barre di Safari): un solo movimento, nessun doppio passaggio.
//  • In cima, tirando ancora verso il basso la scheda segue il dito e, lasciata
//    oltre la soglia (o con un gesto deciso), si chiude.
//  • Swipe orizzontale: piatto precedente/successivo del menu, con l'effetto
//    "Scivola" di Libri (la pagina sopra scorre con angoli tondi e ombra, quella
//    sotto è scurita).
//  • Abbinamento e "Altro in …" aprono una nuova scheda sopra (cronologia):
//    la freccia a sinistra torna alla scheda da cui si è arrivati; dalla prima
//    scheda torna al menu. La X a destra chiude sempre.
//
// La scheda è sempre larga quanto lo schermo: la misura "staccata" si ottiene
// con transform (scala + spostamento), così lo scorrimento resta nativo e il
// testo non viene mai reimpaginato mentre la scheda cambia misura. Le
// animazioni scrivono lo stile direttamente (niente render React per fotogramma).
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, forwardRef, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Dish } from './typeset'
import { readyImages, warmImage } from './preload'
import { DEFAULT_STYLE, fontStack, formatPrice, mix, resolveColor, resolveFace, type MenuStyle, type TextStyle } from '@/lib/menuStyle'
import { GlassButton, GlassTint, LiquidOn, glassSheet } from './Glass'
import CardGlass from './CardGlass'
import { t } from './i18n'
import type { Lang } from '@/lib/translations'

const EXPAND = 96          // px di scorrimento per passare da staccata a tutto schermo
const CLOSE_PULL = 110     // px di trascinamento oltre la cima per chiudere
const DIM = 0.22           // scurimento della pagina sotto durante lo "Scivola"
const VEIL = 0.55          // velo della pagina che scorre sopra un'altra (resta vetro)

// Caratteri e colori del testo della scheda: quelli del menu (stile del
// ristorante) o, a scelta, colori propri della scheda; letti da tutte le parti
// della scheda tramite contesto. Con i colori del menu, uno che si leggerebbe
// male sul vetro della scheda (es. carta scura e scheda chiara) torna al testo
// base, scuro o chiaro secondo la scheda.
const DARK_INK = '#1d1915', DARK_SOFT = '#5f574d', LIGHT_INK = '#f6f1e8', LIGHT_SOFT = '#cfc6b8'
function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}
/** Luminanza relativa (WCAG) e contrasto tra due colori. */
function relLum(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
  return 0.2126 * c((n >> 16) & 255) + 0.7152 * c((n >> 8) & 255) + 0.0722 * c(n & 255)
}
const contrast = (a: string, b: string) => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
const rgba = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})` }
/** Colore con l'alfa = allargamento della scheda (--frost). */
const rgbaVar = (hex: string) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},var(--frost, 0))` }

function cardStyleOf(st: MenuStyle) {
  const c = st.card
  const alpha = 0.92 - 0.8 * c.glass                 // velo del vetro della scheda
  // Colore che si vede davvero sotto il testo: vetro sopra la carta del menu.
  const seen = mix(st.page.paper, c.surface, Math.min(1, alpha + 0.1))
  // La leggibilità si misura sul colore della scheda: è quello a cui tende
  // (la parte bassa si opacizza allargandola).
  const lightCard = lum(c.surface) > 0.5
  const custom = c.textColors === 'custom'
  const fix = (col: string, kind: 'ink' | 'soft') => (custom || contrast(col, c.surface) >= 2.6 ? col
    : kind === 'ink' ? (lightCard ? DARK_INK : LIGHT_INK) : (lightCard ? DARK_SOFT : LIGHT_SOFT))
  const sw = custom ? { ...st, page: { ...st.page, ink: c.ink, soft: c.soft, accent: c.accent } } : st
  /** Carattere, spessore, corsivo, maiuscolo e spaziatura di uno stile (CSS). */
  const css = (t: TextStyle, kind: 'ink' | 'soft' = 'ink'): React.CSSProperties => {
    const f = resolveFace(t.font, t.weight, t.italic)
    return {
      fontFamily: fontStack(t.font), fontWeight: f.weight, fontStyle: f.italic ? 'italic' : 'normal',
      textTransform: t.upper ? 'uppercase' : 'none', letterSpacing: `${t.tracking}em`,
      color: fix(resolveColor(t.color, sw), kind),
    }
  }
  const plain = (t: TextStyle): React.CSSProperties => ({ ...css(t), textTransform: 'none', letterSpacing: 0, fontStyle: 'normal' })
  const INK = fix(sw.page.ink, 'ink')
  // Colore di X e freccia: scelto, o adatto al vetro dei tasti (bianco sul vetro scuro).
  const b = c.buttons
  const darkButtons = lum(mix(seen, b.tint, b.tintAmount)) < 0.42
  return {
    NAME: css(st.dish.name), DESC: css(st.dish.description, 'soft'), PRICE: css(st.dish.price),
    LABEL: css(st.category.text), DETAIL: css(st.allergens.text, 'soft'), DETAIL_PLAIN: plain(st.allergens.text),
    NAME_PLAIN: plain(st.dish.name),
    INK, SOFT: fix(sw.page.soft, 'soft'), ACCENT: fix(sw.page.accent, 'soft'),
    ICON: c.icon !== 'auto' ? c.icon : darkButtons ? '#ffffff' : INK,
    buttonTint: (darkButtons ? 'dark' : 'light') as 'dark' | 'light',
    card: c,
    price: (p: number | null) => formatPrice(p, st.dish.priceSymbol, st.dish.priceDecimals),
    alpha,
    SURFACE: c.surface,
    lightCard,
    // Colore della scheda sotto i tasti in vetro, e della parte bassa opacizzata.
    seen, frosted: mix(seen, c.surface, c.fill),
    STAT_BG: rgba(c.box, c.boxOpacity),             // riquadro prezzo/allergeni
    TILE:    rgba(c.box, c.boxOpacity * 0.76),      // riquadri appoggiati sul vetro
    LINE:    rgba(INK, 0.09),
    SHINE:   lightCard ? 0.7 : 0.14,                // filo di luce dei riquadri
  }
}
const CardStyle = createContext(cardStyleOf(DEFAULT_STYLE))
const useCardStyle = () => useContext(CardStyle)
const PHOTO_RATIO: Record<MenuStyle['card']['photo'], string> = { square: '1 / 1', landscape: '4 / 3', portrait: '4 / 5', circle: '1 / 1' }


const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t) }
const smoothRange = (a: number, b: number, x: number) => smooth((x - a) / (b - a))
const easeOutQuint = (x: number) => 1 - Math.pow(1 - x, 5)
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)
const easeOutQuad = (x: number) => 1 - (1 - x) * (1 - x)
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

/** Una pagina della scheda (un piatto). key univoca anche se il piatto si ripete. */
interface Layer { key: string; dish: Dish }
/** Voce della cronologia: dove era arrivato lo scorrimento e quanto era allargata. */
interface Entry extends Layer { scroll: number; q: number }

type TransKind = 'next' | 'prev' | 'push' | 'pop' | 'rubber'
interface Trans {
  kind:   TransKind
  top:    string          // pagina che scorre (sopra)
  under:  string | null   // pagina scoperta/coperta (sotto)
  r:      number          // 0 = partenza, 1 = arrivo
  qFrom:  number
  qTo:    number
  dest:   Entry | null
  offset: number          // solo 'rubber': spostamento elastico (px della scheda)
}
interface Tween { from: number; to: number; t0: number; dur: number; ease: (x: number) => number; set: (v: number) => void; done?: () => void }


let keySeq = 0
const entryFor = (dish: Dish): Entry => ({ key: `p${++keySeq}`, dish, scroll: 0, q: 0 })

interface Props {
  dish:     Dish
  style:    MenuStyle
  lang:     Lang
  /** Tutti i piatti del menu in ordine (swipe precedente/successivo). */
  sequence: Dish[]
  /** Altri piatti della stessa categoria (per "Altro in …"). */
  siblings: (d: Dish) => Dish[]
  onClosed: () => void
}

export default function DishCard({ dish: first, style, lang, sequence, siblings, onClosed }: Props) {
  const cs = useMemo(() => cardStyleOf(style), [style])
  const { ICON, SURFACE, buttonTint, seen, frosted, card: cardSt } = cs
  // X e freccia in vetro liquido (WebGL) quando disponibile; prima del primo
  // disegno, o senza WebGL2, vetro dei browser.
  const [liquid, setLiquid] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)
  const cardRef     = useRef<HTMLDivElement>(null)
  const barRef      = useRef<HTMLDivElement>(null)
  const probeRef    = useRef<HTMLDivElement>(null)
  const pages = useRef(new Map<string, { root: HTMLDivElement; scroller: HTMLDivElement; dim: HTMLDivElement; veil: HTMLDivElement; rubbed?: boolean }>())

  const [initial] = useState<Entry>(() => entryFor(first))
  const stack = useRef<Entry[]>([initial])
  const [layers, setLayers] = useState<Layer[]>([initial])
  // Profondità della cronologia: la freccia "indietro" c'è solo dentro un collegamento.
  const [depth, setDepth] = useState(1)

  // Stato delle animazioni (fuori da React).
  const st = useRef({
    o: 0,              // presenza 0..1 (apertura/chiusura)
    pull: 0,           // trascinamento verso il basso oltre la cima (px)
    q: 0,              // allargamento 0 staccata → 1 tutto schermo
    lastTop: 0,        // ultimo scrollTop visto (per la direzione)
    closing: false,
    raf: 0,
    tweens: new Map<string, Tween>(),
    trans: null as Trans | null,
    geo: { scale: 1, cardW: 1 },
  })

  // Solo ref: identità stabile, utilizzabili da tutti i callback.
  const current = useCallback(() => stack.current[stack.current.length - 1], [])
  const activeScroller = useCallback(() => pages.current.get(current().key)?.scroller ?? null, [current])

  // Foto dei piatti raggiungibili da qui (swipe, abbinamento): già pronte
  // quando la pagina arriva, così non compaiono a scatti.
  const warmAround = useCallback(() => {
    const d = current().dish
    const i = sequence.findIndex(x => x.id === d.id)
    if (i >= 0) { warmImage(sequence[i + 1]?.image); warmImage(sequence[i - 1]?.image) }
    warmImage(d.pairing?.dish.image)
  }, [current, sequence])

  // ── Geometria: applica presenza, allargamento, trascinamento e pagine allo stile.
  const apply = useCallback(() => {
    const card = cardRef.current, bd = backdropRef.current, bar = barRef.current, probe = probeRef.current
    if (!card || !bd || !bar || !probe) return
    const s = st.current
    const W = window.innerWidth, H = window.innerHeight
    const cs = getComputedStyle(probe)
    const safeTop = parseFloat(cs.paddingTop) || 0
    const wide = W >= 700
    const p = smooth(s.q)
    const cardW = wide ? Math.min(760, W - 64) : W
    const s0 = wide ? 1 : (W - 20) / W
    const top0 = safeTop + (wide ? 36 : 10)
    const scale = s0 + (1 - s0) * p
    const top = top0 * (1 - p)
    // La scheda staccata prosegue oltre il fondo dello schermo (nessuno stacco
    // in basso); il contenuto ha in fondo lo stesso margine, così a tutto
    // schermo l'ultima riga resta visibile.
    const extra = Math.ceil(Math.max(0, (H - top0) / s0 - H)) + 24
    // Mai esattamente 0: se gli angoli passano da squadrati a tondi mentre il
    // dito scorre, Safari ricostruisce il ritaglio e perde il gesto in corso
    // (lo scorrimento verso l'alto "si bloccava" al primo tentativo).
    const r = wide ? 22 : Math.max(1, 30 * (1 - p))
    const enter = (1 - s.o) * (H + 40)
    card.style.width = `${cardW}px`
    card.style.left = `${(W - cardW) / 2}px`
    card.style.height = `${H + extra}px`
    card.style.setProperty('--extra', `${extra}px`)
    card.style.setProperty('--frost', p.toFixed(3))
    card.style.transform = `translate3d(0, ${(top + enter + s.pull).toFixed(2)}px, 0) scale(${scale.toFixed(5)})`
    card.style.borderRadius = `${(r / scale).toFixed(2)}px ${(r / scale).toFixed(2)}px 0 0`
    card.style.boxShadow = `0 -2px 30px rgba(20,14,8,${(0.16 * (1 - p)).toFixed(3)})`
    s.geo = { scale, cardW }
    // I tasti scendono sotto la barra di stato quando la scheda tocca il bordo.
    bar.style.transform = `translate3d(0, ${(safeTop * p).toFixed(2)}px, 0)`
    const fade = 1 - Math.min(1, s.pull / (CLOSE_PULL * 2.2))
    bd.style.opacity = (s.o * fade).toFixed(3)

    // Pagine: "Scivola".
    const t = s.trans
    pages.current.forEach((el, key) => {
      let tx = 0, dim = 0
      const moving = !!t && key === t.top
      // Rimbalzo (nessun piatto da quella parte): si spostano solo i contenuti,
      // il vetro resta fermo, così non si apre una fessura sul menu dietro.
      const rub = t && moving && t.kind === 'rubber' ? t.offset : 0
      if (rub || el.rubbed) {
        el.root.querySelectorAll<HTMLElement>('[data-rubber]').forEach(n => {
          n.style.transform = rub ? `translate3d(${rub.toFixed(2)}px, 0, 0)` : ''
        })
        el.rubbed = !!rub
      }
      if (t && moving && t.kind !== 'rubber') {
        tx = t.kind === 'next' ? -t.r * cardW
          : t.kind === 'prev' ? -(1 - t.r) * cardW
          : t.kind === 'push' ? (1 - t.r) * cardW
          : t.r * cardW   // pop
      } else if (t && key === t.under) {
        dim = t.kind === 'next' || t.kind === 'pop' ? (1 - t.r) * DIM : t.r * DIM
      }
      // Angoli tondi e ombra crescono con lo spostamento (nessuno scatto al via).
      const lift = moving && t.kind !== 'rubber' ? Math.min(1, Math.abs(tx) / 40) : 0
      el.root.style.transform = tx ? `translate3d(${tx.toFixed(2)}px, 0, 0)` : ''
      el.root.style.borderRadius = lift ? `${((30 * lift) / scale).toFixed(2)}px` : ''
      el.root.style.boxShadow = lift ? `0 0 34px rgba(20,14,8,${(0.30 * lift).toFixed(3)})` : ''
      el.dim.style.opacity = dim.toFixed(3)
      // Velo della lastra che scorre sopra un'altra e presenza della pagina
      // sotto vanno insieme al movimento, senza cambi improvvisi:
      //  • se ne va (next/pop): all'inizio la pagina sotto compare mentre
      //    questa si vela (niente foto che spuntano di colpo nel vetro);
      //  • arriva (prev/push): perde il velo mentre si posa e la pagina sotto
      //    svanisce, così a fine movimento è già vetro (niente dissolvenza dopo).
      let veil = 0, presence = 1
      if (t && t.kind !== 'rubber' && t.under) {
        const arriving = t.kind === 'prev' || t.kind === 'push'
        const k = arriving ? 1 - smoothRange(0.5, 1, t.r) : smoothRange(0, 0.15, t.r)
        if (moving) veil = VEIL * k
        else if (key === t.under) presence = arriving ? 1 - smoothRange(0.6, 1, t.r) : k
      }
      el.veil.style.opacity = veil.toFixed(3)
      el.root.style.opacity = presence < 1 ? presence.toFixed(3) : ''
    })
  }, [])

  const loop = useCallback(() => {
    const s = st.current
    s.raf = 0
    const now = performance.now()
    const finished: Tween[] = []
    s.tweens.forEach((tw, name) => {
      const k = Math.min(1, (now - tw.t0) / tw.dur)
      tw.set(tw.from + (tw.to - tw.from) * tw.ease(k))
      if (k >= 1) { s.tweens.delete(name); finished.push(tw) }
    })
    apply()
    for (const tw of finished) tw.done?.()
    if (s.tweens.size && !s.raf) s.raf = requestAnimationFrame(loop)
  }, [apply])

  const schedule = useCallback(() => {
    const s = st.current
    if (!s.raf) s.raf = requestAnimationFrame(loop)
  }, [loop])

  const tween = useCallback((name: string, from: number, to: number, dur: number, ease: (x: number) => number, set: (v: number) => void, done?: () => void) => {
    st.current.tweens.set(name, { from, to, t0: performance.now(), dur, ease, set, done })
    schedule()
  }, [schedule])

  const close = useCallback((velocity = 0) => {
    const s = st.current
    if (s.closing) return
    s.closing = true
    // Dopo un gesto deciso parte già veloce; dal tasto accelera e frena.
    const flick = Math.abs(velocity) > 0.3
    const dur = flick ? Math.max(200, 320 - Math.min(120, Math.abs(velocity) * 90)) : 380
    tween('o', s.o, 0, dur, flick ? easeOutQuad : easeInOut, v => { s.o = v }, () => onClosed())
  }, [onClosed, tween])

  // ── Cambi di pagina
  const startTrans = useCallback((kind: Exclude<TransKind, 'rubber'>, dest: Entry) => {
    const s = st.current
    const cur = current()
    const sc = activeScroller()
    cur.scroll = sc?.scrollTop ?? 0
    cur.q = s.q
    const topKey = kind === 'next' || kind === 'pop' ? cur.key : dest.key
    const underKey = topKey === cur.key ? dest.key : cur.key
    s.trans = { kind, top: topKey, under: underKey, r: 0, qFrom: s.q, qTo: dest.q, dest, offset: 0 }
    if (kind === 'push') setDepth(stack.current.length + 1)
    if (kind === 'pop') setDepth(stack.current.length - 1)
    const byKey = (k: string): Layer => (k === cur.key ? cur : dest)
    setLayers([byKey(underKey), byKey(topKey)])   // sotto prima, sopra dopo
  }, [activeScroller, current])

  const finishTrans = useCallback((commit: boolean) => {
    const s = st.current
    const t = s.trans
    if (!t) return
    s.trans = null
    if (commit && t.dest) {
      if (t.kind === 'push') stack.current.push(t.dest)
      else if (t.kind === 'pop') stack.current.pop()
      else stack.current[stack.current.length - 1] = t.dest
      s.q = t.qTo
    } else {
      s.q = t.qFrom
    }
    // Ritorno annullato a metà gesto: la freccia "indietro" deve ricomparire.
    setDepth(stack.current.length)
    const cur = current()
    // Le pagine che escono spariscono subito: altrimenti, finché React non le
    // toglie, tornerebbero al loro posto per un fotogramma (sfarfallio).
    pages.current.forEach((el, key) => { if (key !== cur.key) el.root.style.visibility = 'hidden' })
    setLayers([cur])
    warmAround()
    const sc = pages.current.get(cur.key)?.scroller
    s.lastTop = sc ? Math.max(0, sc.scrollTop) : 0
    apply()
  }, [apply, current, warmAround])

  const setR = useCallback((v: number) => {
    const t = st.current.trans
    if (!t) return
    t.r = v
    st.current.q = t.qFrom + (t.qTo - t.qFrom) * v
  }, [])

  const runTrans = useCallback((to: 0 | 1, dur: number, ease: (x: number) => number) => {
    const t = st.current.trans
    if (!t) return
    tween('r', t.r, to, dur, ease, setR, () => finishTrans(to === 1))
  }, [finishTrans, setR, tween])

  const back = useCallback(() => {
    const s = st.current
    if (s.trans || s.closing) return
    if (stack.current.length > 1) {
      startTrans('pop', stack.current[stack.current.length - 2])
      runTrans(1, 440, easeOutQuint)
    } else close()
  }, [close, runTrans, startTrans])

  const link = useCallback((d: Dish) => {
    const s = st.current
    if (s.trans || s.closing || d.id === current().dish.id) return
    warmImage(d.image)
    startTrans('push', entryFor(d))
    runTrans(1, 460, easeOutQuint)
  }, [current, runTrans, startTrans])

  const neighbour = useCallback((dir: 1 | -1): Dish | null => {
    const i = sequence.findIndex(d => d.id === current().dish.id)
    return i < 0 ? null : sequence[i + dir] ?? null
  }, [current, sequence])

  // Pagine: registrazione degli elementi (ripristina lo scorrimento tornando indietro).
  const register = useCallback((key: string, el: HTMLDivElement | null) => {
    const map = pages.current
    if (!el) { map.delete(key); return }
    if (map.get(key)?.root === el) return
    const scroller = el.querySelector<HTMLDivElement>('[data-scroller]')!
    const dim = el.querySelector<HTMLDivElement>('[data-dim]')!
    const veil = el.querySelector<HTMLDivElement>('[data-veil]')!
    map.set(key, { root: el, scroller, dim, veil })
    const entry = [...stack.current, st.current.trans?.dest].find(e => e?.key === key)
    if (entry?.scroll) scroller.scrollTop = entry.scroll
    apply()
  }, [apply])

  // ── Apertura (e colore sotto la barra di Safari uguale alla scheda)
  useLayoutEffect(() => {
    const s = st.current
    const html = document.documentElement
    const prevBg = html.style.backgroundColor
    apply()
    warmAround()
    tween('o', 0, 1, 520, easeOutQuint, v => { s.o = v })
    return () => {
      cancelAnimationFrame(s.raf); s.raf = 0
      s.tweens.clear()
      html.style.backgroundColor = prevBg
    }
  }, [apply, tween, warmAround])
  // Colore sotto la barra di Safari uguale alla scheda (ripristinato alla chiusura, sopra).
  useLayoutEffect(() => { document.documentElement.style.backgroundColor = SURFACE }, [SURFACE])
  useLayoutEffect(() => { apply() }, [layers, apply])

  // ── Gesti
  useEffect(() => {
    const card = cardRef.current!
    const s = st.current
    let touch: null | { x0: number; y0: number; armed: boolean; pulling: boolean; last: { y: number; t: number }[]; bounceClose: boolean } = null
    let sw: null | { id: number; x0: number; y0: number; mode: 'undecided' | 'h' | 'v'; samples: { x: number; t: number }[] } = null

    // Scorrimento: la direzione allarga/rimpicciolisce (mai oltre quanto
    // permette la distanza dalla cima: in cima la scheda è sempre staccata).
    let lastDir = 0, settleTimer = 0
    const onScroll = (e: Event) => {
      const sc = activeScroller()
      if (!sc || e.target !== sc) return
      if (touch && sc.scrollTop < -CLOSE_PULL * 0.6) touch.bounceClose = true
      if (s.trans) return
      const max = Math.max(0, sc.scrollHeight - sc.clientHeight)
      const top = Math.max(0, Math.min(max, sc.scrollTop))   // ignora i rimbalzi
      const d = top - s.lastTop
      s.lastTop = top
      if (s.tweens.has('snap')) return                       // la calamita guida da sola
      if (d) lastDir = Math.sign(d)
      s.q = Math.min(clamp01(s.q + d / EXPAND), top / EXPAND)
      schedule()
      clearTimeout(settleTimer); settleTimer = window.setTimeout(settle, 110)
    }

    // Calamita (come Libri): lasciata a metà dell'allargamento, la scheda
    // finisce il movimento da sola, nella direzione in cui si stava andando.
    const settle = () => {
      const sc = activeScroller()
      if (!sc || touch || s.trans || s.closing || s.tweens.has('snap')) return
      if (s.q <= 0.001 || s.q >= 0.999) return
      const open = lastDir ? lastDir > 0 : s.q > 0.5
      const q0 = s.q, top0 = Math.max(0, sc.scrollTop)
      // Vicino alla cima si scorre anche il contenuto (in cima = staccata,
      // da EXPAND in giù = tutto schermo); più in basso cambia solo la scheda.
      const topTo = top0 < EXPAND ? (open ? EXPAND : 0) : top0
      const dur = 260 + 160 * (open ? 1 - q0 : q0)
      tween('snap', 0, 1, dur, easeOutCubic, v => {
        if (topTo !== top0) sc.scrollTop = top0 + (topTo - top0) * v
        s.q = q0 + ((open ? 1 : 0) - q0) * v
      })
    }

    // ── Trascinamento verso il basso dalla cima: chiusura.
    const onTouchStart = (e: TouchEvent) => {
      if (s.closing || s.trans || e.touches.length > 1) return
      const sc = activeScroller()
      const t0 = e.touches[0]
      touch = { x0: t0.clientX, y0: t0.clientY, armed: !!sc && sc.scrollTop <= 0, pulling: false, last: [{ y: t0.clientY, t: e.timeStamp }], bounceClose: false }
      s.tweens.delete('pull')
      s.tweens.delete('snap')   // il dito riprende la scheda
      clearTimeout(settleTimer)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!touch || s.closing) return
      const t0 = e.touches[0]
      touch.last.push({ y: t0.clientY, t: e.timeStamp }); if (touch.last.length > 5) touch.last.shift()
      const dy = t0.clientY - touch.y0
      if (!touch.pulling) {
        const sc = activeScroller()
        if (!touch.armed || !sc || sc.scrollTop > 0 || sw?.mode === 'h') return
        if (dy < 0) { touch.armed = false; return }       // verso l'alto: scorrimento normale
        if (dy < 4) return
        if (Math.abs(t0.clientX - touch.x0) > dy) { touch.armed = false; return }   // gesto orizzontale
        touch.pulling = true
        touch.y0 = t0.clientY
      }
      if (e.cancelable) e.preventDefault()
      s.pull = Math.max(0, t0.clientY - touch.y0)
      schedule()
    }
    const onTouchEnd = () => {
      if (!touch) return
      const t = touch
      touch = null
      // Dito lasciato fermo a metà (nessuno scorrimento dopo): calamita.
      clearTimeout(settleTimer); settleTimer = window.setTimeout(settle, 110)
      if (t.bounceClose) { close(0.8); return }
      if (!t.pulling) return
      const a = t.last[0], b = t.last[t.last.length - 1]
      const v = b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0       // px/ms, positivo = in giù
      if ((s.pull > CLOSE_PULL && v > -0.1) || v > 0.65) close(v)
      else tween('pull', s.pull, 0, 340, easeOutQuint, x => { s.pull = x })
    }

    // ── Swipe orizzontale: piatto precedente/successivo.
    const onPointerDown = (e: PointerEvent) => {
      if (s.closing || s.trans || sw) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if ((e.target as Element).closest('[data-noswipe]')) return
      sw = { id: e.pointerId, x0: e.clientX, y0: e.clientY, mode: 'undecided', samples: [{ x: e.clientX, t: e.timeStamp }] }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!sw || e.pointerId !== sw.id) return
      sw.samples.push({ x: e.clientX, t: e.timeStamp }); if (sw.samples.length > 5) sw.samples.shift()
      if (sw.mode === 'undecided') {
        const dx = e.clientX - sw.x0, dy = e.clientY - sw.y0
        if (Math.hypot(dx, dy) < 10) return
        if (touch?.pulling || s.trans || Math.abs(dx) < Math.abs(dy) * 1.2) { sw.mode = 'v'; return }
        sw.mode = 'h'
        sw.x0 = e.clientX   // si parte da qui: nessun salto
        try { card.setPointerCapture(e.pointerId) } catch { /* già rilasciato */ }
        // Dentro un collegamento: verso destra si torna alla scheda che l'ha
        // aperto (segue il dito); verso sinistra solo il rimbalzo.
        const inLink = stack.current.length > 1
        const next = inLink ? null : dx < 0 ? neighbour(1) : neighbour(-1)
        if (inLink && dx > 0) {
          startTrans('pop', stack.current[stack.current.length - 2])
        } else if (next) {
          warmImage(next.image)
          startTrans(dx < 0 ? 'next' : 'prev', entryFor(next))
        } else {
          const cur = current()
          s.trans = { kind: 'rubber', top: cur.key, under: null, r: 0, qFrom: s.q, qTo: s.q, dest: null, offset: 0 }
        }
      }
      if (sw.mode !== 'h' || !s.trans) return
      const t = s.trans
      const dx = e.clientX - sw.x0
      const w = s.geo.cardW * s.geo.scale
      if (t.kind === 'rubber') t.offset = (dx * 0.28) / s.geo.scale
      else setR(clamp01(t.kind === 'next' ? -dx / w : dx / w))   // prev e pop: verso destra
      schedule()
    }
    const endSwipe = (e: PointerEvent, cancelled: boolean) => {
      if (!sw || e.pointerId !== sw.id) return
      const g = sw
      sw = null
      if (g.mode !== 'h' || !s.trans) return
      // Il tocco che chiude lo swipe non deve "cliccare" un pulsante sotto il dito.
      const stop = (ev: Event) => { ev.stopPropagation(); ev.preventDefault() }
      card.addEventListener('click', stop, { capture: true, once: true })
      window.setTimeout(() => card.removeEventListener('click', stop, { capture: true }), 350)
      const t = s.trans
      if (t.kind === 'rubber') {
        tween('r', t.offset, 0, 320, easeOutQuint, v => { t.offset = v }, () => { if (s.trans === t) { s.trans = null; apply() } })
        return
      }
      const a = g.samples[0], b = g.samples[g.samples.length - 1]
      const v = b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0
      const vd = t.kind === 'next' ? -v : v                     // velocità verso l'arrivo
      const commit = !cancelled && ((t.r > 0.35 && vd > -0.2) || (vd > 0.35 && t.r > 0.02))
      const rest = commit ? 1 - t.r : t.r
      // Minimo 220 ms: velo e pagina sotto sfumano negli ultimi istanti e
      // devono avere il tempo di farlo per gradi anche dopo uno swipe veloce.
      const dur = Math.max(220, Math.min(380, rest * 440) / (1 + Math.min(1.5, Math.abs(v) * 0.6)))
      runTrans(commit ? 1 : 0, dur, easeOutCubic)
    }
    const onPointerUp = (e: PointerEvent) => endSwipe(e, false)
    const onPointerCancel = (e: PointerEvent) => endSwipe(e, true)

    // Rotella/trackpad: in cima, una spinta decisa verso l'alto chiude.
    let wheelAcc = 0, wheelTimer = 0
    const onWheel = (e: WheelEvent) => {
      s.tweens.delete('snap')
      const sc = activeScroller()
      if (!sc || sc.scrollTop > 0 || e.deltaY >= 0) { wheelAcc = 0; return }
      wheelAcc += -e.deltaY
      clearTimeout(wheelTimer); wheelTimer = window.setTimeout(() => { wheelAcc = 0 }, 220)
      if (wheelAcc > 160) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return }
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !s.trans && !s.closing) {
        const fwd = e.key === 'ArrowRight'
        if (stack.current.length > 1) { if (!fwd) back(); return }   // come lo swipe
        const next = neighbour(fwd ? 1 : -1)
        if (!next) return
        startTrans(fwd ? 'next' : 'prev', entryFor(next))
        runTrans(1, 420, easeOutCubic)
      }
    }
    const onResize = () => apply()

    card.addEventListener('scroll', onScroll, { capture: true, passive: true })
    card.addEventListener('touchstart', onTouchStart, { passive: true })
    card.addEventListener('touchmove', onTouchMove, { passive: false })
    card.addEventListener('touchend', onTouchEnd)
    card.addEventListener('touchcancel', onTouchEnd)
    card.addEventListener('pointerdown', onPointerDown)
    card.addEventListener('pointermove', onPointerMove)
    card.addEventListener('pointerup', onPointerUp)
    card.addEventListener('pointercancel', onPointerCancel)
    card.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(wheelTimer); clearTimeout(settleTimer)
      card.removeEventListener('scroll', onScroll, { capture: true })
      card.removeEventListener('touchstart', onTouchStart)
      card.removeEventListener('touchmove', onTouchMove)
      card.removeEventListener('touchend', onTouchEnd)
      card.removeEventListener('touchcancel', onTouchEnd)
      card.removeEventListener('pointerdown', onPointerDown)
      card.removeEventListener('pointermove', onPointerMove)
      card.removeEventListener('pointerup', onPointerUp)
      card.removeEventListener('pointercancel', onPointerCancel)
      card.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [activeScroller, apply, back, close, current, neighbour, runTrans, schedule, setR, startTrans, tween])

  return (
    <CardStyle.Provider value={cs}>
      <div className="fixed inset-0 z-50">
        <div ref={probeRef} aria-hidden className="pointer-events-none fixed inset-0 invisible"
          style={{ padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }} />
        {/* Fondo: scurisce il menu; un tocco fuori dalla scheda la chiude. */}
        <div ref={backdropRef} className="absolute inset-0" style={{ background: `rgba(24,18,12,${cardSt.dim})`, opacity: 0 }}
          onClick={() => close()} />

        <div ref={cardRef} role="dialog" aria-modal="true" aria-label={layers[layers.length - 1].dish.name}
          className="absolute top-0 overflow-hidden select-none"
          style={{ height: '100%', background: 'transparent', transformOrigin: '50% 0', willChange: 'transform', transform: 'translate3d(0,120vh,0)', WebkitUserSelect: 'none' }}>

          {layers.map(l => (
            <Page key={l.key} layer={l} lang={lang} siblings={siblings} onLink={link} register={register} />
          ))}

          <div ref={barRef} className="absolute left-0 right-0 top-0 flex justify-between pointer-events-none" style={{ padding: 14, zIndex: 5 }}>
            <CardGlass barRef={barRef} cardRef={cardRef} base={seen} frosted={frosted} glass={cardSt.buttons} onState={setLiquid} />
            <GlassTint.Provider value={buttonTint}>
              <LiquidOn.Provider value={liquid}>
                <GlassButton label={t('back', lang)} onClick={back} hidden={depth <= 1}>
                  <svg width="11" height="18" viewBox="0 0 11 18" aria-hidden><path d="M9 1.8L2 9l7 7.2" fill="none" stroke={ICON} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </GlassButton>
                <GlassButton label={t('close', lang)} onClick={() => close()}>
                  <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden><path d="M1.6 1.6l9.8 9.8M11.4 1.6l-9.8 9.8" stroke={ICON} strokeWidth="2" strokeLinecap="round" /></svg>
                </GlassButton>
              </LiquidOn.Provider>
            </GlassTint.Provider>
          </div>
        </div>
      </div>
    </CardStyle.Provider>
  )
}

// ── Pagina della scheda ──────────────────────────────────────────────────────

function Page({ layer, lang, siblings, onLink, register }: {
  layer:    Layer
  lang:     Lang
  siblings: (d: Dish) => Dish[]
  onLink:   (d: Dish) => void
  register: (key: string, el: HTMLDivElement | null) => void
}) {
  const { NAME_PLAIN, DESC, DETAIL, DETAIL_PLAIN, ACCENT, card, price, alpha, SURFACE, TILE, LINE, SHINE } = useCardStyle()
  const { dish } = layer
  const ref = useCallback((el: HTMLDivElement | null) => register(layer.key, el), [layer.key, register])
  const others = siblings(dish).filter(d => d.id !== dish.id)
  const pairing = dish.pairing
  return (
    // Due lastre di vetro per pagina (la pagina in sé è trasparente, così
    // entrambe vedono il menu dietro): in alto (foto, nome, prezzo) e da
    // "Descrizione" in giù, che si opacizza mentre la scheda si allarga. Nello "Scivola" vedono anche la
    // pagina sotto; il velo (data-veil) la copre mentre questa scorre.
    <div ref={ref} data-card-page className="absolute inset-0 overflow-hidden">
      <div data-veil aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: SURFACE, opacity: 0 }} />
      {/* Sfondo fermo sul fondo dell'area (sfumato, solo quanto arriva il
          rimbalzo): copre il rimbalzo in fondo, dove un vetro sotto il
          contenuto allungherebbe lo scorrimento. */}
      <div data-scroller className="absolute inset-0 overflow-y-auto"
        style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y',
          background: `linear-gradient(180deg, transparent calc(100% - 150px), ${rgbaVar(SURFACE)} calc(100% - 40px))` }}>
        <div style={{ position: 'relative', minHeight: `calc(100% + ${EXPAND}px)`, display: 'flex', flexDirection: 'column' }}>
          {/* Vetro sopra la cima: nel rimbalzo di iOS si vede la stessa lastra e
              non il menu scurito dietro (sopra l'inizio non si può scorrere,
              quindi non allunga la pagina). */}
          <div aria-hidden className="absolute left-0 right-0 pointer-events-none"
            style={{ ...glassSheet(alpha, SURFACE), background: rgba(SURFACE, alpha), bottom: '100%', height: '100vh' }} />
          <div style={glassSheet(alpha, SURFACE)}>
            <Header dish={dish} lang={lang} />
          </div>
          <section data-card-section className="relative" style={{ ...glassSheet(alpha, SURFACE), boxShadow: `inset 0 1px 0 rgba(255,255,255,${SHINE})`, flex: 1, paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px + var(--extra, 0px))' }}>
            {/* Come in Libri: parte vetro come la zona sopra e si opacizza
                mentre la scheda si allarga (--frost = allargamento 0..1). */}
            <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: rgba(SURFACE, card.fill), opacity: 'var(--frost, 0)' }} />
            <div data-rubber className="relative mx-auto" style={{ maxWidth: 560, padding: '30px 24px 0' }}>
              {dish.description && (
                <Block title={t('description', lang)}>
                  <p style={{ ...DESC, fontSize: 20, lineHeight: 1.45, whiteSpace: 'pre-line' }}>
                    {dish.description}
                  </p>
                </Block>
              )}

              {pairing && (
                <Block title={pairing.label || t('pairing', lang)}>
                  <button type="button" onClick={() => onLink(pairing.dish)}
                    className="w-full flex items-center text-left active:opacity-60 transition-opacity"
                    style={{ gap: 14, background: TILE, borderRadius: 16, padding: 12, border: `1px solid ${LINE}` }}>
                    <Thumb dish={pairing.dish} size={56} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate" style={{ ...NAME_PLAIN, fontSize: 19 }}>{pairing.dish.name}</span>
                      <span className="block" style={{ ...DETAIL_PLAIN, fontWeight: 400, fontSize: 12, color: DETAIL.color, marginTop: 2 }}>
                        {[pairing.dish.category, price(pairing.dish.price)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <Chevron />
                  </button>
                </Block>
              )}

              {dish.allergens.length > 0 && (
                <Block title={t('allergens', lang)}>
                  <ul style={{ display: 'grid', gap: 10 }}>
                    {dish.allergens.map(a => (
                      <li key={a.n} className="flex items-center" style={{ gap: 12 }}>
                        <span className="inline-flex items-center justify-center shrink-0"
                          style={{ ...DETAIL_PLAIN, width: 26, height: 26, borderRadius: 13, border: `1px solid ${ACCENT}`, color: ACCENT, fontSize: 11, fontWeight: 600 }}>
                          {a.n}
                        </span>
                        <span style={{ ...DETAIL_PLAIN, fontWeight: 400, fontSize: 15, color: NAME_PLAIN.color }}>{a.name}</span>
                      </li>
                    ))}
                  </ul>
                </Block>
              )}

              {card.showMore && others.length > 0 && (
                <Block title={`${t('moreIn', lang)} ${dish.category}`}>
                  {/* data-noswipe: qui lo scorrimento orizzontale è della fila, non cambia piatto. */}
                  <div data-noswipe className="flex items-start overflow-x-auto"
                    style={{ gap: 12, margin: '0 -24px', padding: '2px 24px 6px', scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain' }}>
                    {others.map(o => (
                      <button key={o.id} type="button" onClick={() => onLink(o)}
                        className="shrink-0 flex flex-col items-stretch justify-start text-left active:opacity-60 transition-opacity"
                        style={{ width: 132, scrollSnapAlign: 'start' }}>
                        <Thumb dish={o} size={132} />
                        <span className="block" style={{ ...NAME_PLAIN, fontSize: 16, lineHeight: 1.2, marginTop: 8 }}>{o.name}</span>
                        {o.price !== null && <span className="block" style={{ ...DETAIL_PLAIN, fontWeight: 400, fontSize: 12, color: DETAIL.color, marginTop: 2 }}>{price(o.price)}</span>}
                      </button>
                    ))}
                  </div>
                </Block>
              )}
            </div>
          </section>
        </div>
      </div>
      {/* Scurimento della pagina quando un'altra le scorre sopra. */}
      <div data-dim aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: '#000', opacity: 0 }} />
    </div>
  )
}

function Header({ dish, lang }: { dish: Dish; lang: Lang }) {
  const { NAME, PRICE, LABEL, DETAIL, card, price, TILE, STAT_BG, LINE, SHINE } = useCardStyle()
  const [ready] = useState(() => !!dish.image && readyImages.has(dish.image))
  const [loaded, setLoaded] = useState(ready)
  return (
    <header data-rubber className="mx-auto w-full text-center" style={{ maxWidth: 560, padding: '64px 24px 30px' }}>
      {dish.image && (
        <div className="mx-auto" style={{ width: `min(${card.photoWidth}%, ${Math.round(card.photoWidth * 4.3)}px)`, marginBottom: 28 }}>
          <div style={{ position: 'relative', aspectRatio: PHOTO_RATIO[card.photo], borderRadius: card.photo === 'circle' ? '50%' : card.radius, overflow: 'hidden', background: TILE, boxShadow: '0 18px 40px rgba(40,28,14,0.20), 0 2px 6px rgba(40,28,14,0.10)' }}>
            <CardImg src={dish.image} onLoad={() => { readyImages.add(dish.image!); setLoaded(true) }}
              ref={el => { if (el?.complete && el.naturalWidth && !loaded) setLoaded(true) }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: loaded ? 1 : 0, transition: ready ? 'none' : 'opacity 300ms ease' }} />
          </div>
        </div>
      )}
      {card.showCategory && (
        <p style={{ ...LABEL, fontSize: 10.5 }}>
          {dish.category}
        </p>
      )}
      <h2 style={{ ...NAME, fontSize: card.titleSize, lineHeight: 1.1, margin: card.showCategory ? '10px 0 0' : 0 }}>
        {dish.name}
      </h2>
      {card.showSummary && (dish.price !== null || dish.allergens.length > 0) && (
        <div className="mx-auto flex" style={{ marginTop: 24, maxWidth: 380, borderRadius: 18, background: STAT_BG, boxShadow: `inset 0 0 0 1px rgba(255,255,255,${SHINE}), 0 1px 3px rgba(20,14,8,0.06)`, padding: '14px 6px' }}>
          {dish.price !== null && <Stat label={t('price', lang)} value={price(dish.price)} valueStyle={PRICE} labelStyle={DETAIL} />}
          {dish.price !== null && dish.allergens.length > 0 && <span style={{ width: 1, background: LINE, margin: '4px 0' }} />}
          {dish.allergens.length > 0 && <Stat label={t('allergens', lang)} value={dish.allergens.map(a => a.n).join(' · ')} valueStyle={{ ...PRICE, textTransform: 'none', letterSpacing: 0 }} labelStyle={DETAIL} />}
        </div>
      )}
    </header>
  )
}

function Stat({ label, value, valueStyle, labelStyle }: { label: string; value: string; valueStyle: React.CSSProperties; labelStyle: React.CSSProperties }) {
  return (
    <div className="flex-1 min-w-0" style={{ padding: '0 10px' }}>
      <div style={{ ...labelStyle, fontSize: 9.5 }}>{label}</div>
      {/* Valori lunghi (molti allergeni): carattere più piccolo e a capo, mai tagliati. */}
      <div style={{ ...valueStyle, fontSize: value.length > 10 ? 17 : 22, lineHeight: 1.2, marginTop: 4, textWrap: 'balance' } as React.CSSProperties}>{value}</div>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  const { LABEL } = useCardStyle()
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ ...LABEL, fontSize: 10.5, marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  )
}

function Thumb({ dish, size }: { dish: Dish; size: number }) {
  const { NAME_PLAIN, ACCENT, card, TILE, LINE } = useCardStyle()
  return (
    <span className="block shrink-0 overflow-hidden" style={{ width: size, height: size, borderRadius: card.photo === 'circle' ? '50%' : Math.min(card.radius, size > 80 ? 12 : 10), background: TILE, boxShadow: `inset 0 0 0 1px ${LINE}` }}>
      {dish.image
        ? <CardImg src={dish.image} lazy style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span className="flex items-center justify-center h-full" style={{ fontFamily: NAME_PLAIN.fontFamily, fontStyle: 'italic', fontSize: size * 0.42, color: ACCENT }}>{dish.name.trim().charAt(0)}</span>}
    </span>
  )
}

/** Foto della scheda, chiesta con CORS (il vetro liquido dei tasti la può
 *  ridisegnare). Se il sito della foto non lo permette si ricarica normale:
 *  si vede lo stesso, solo la lente non la mostra. */
const CardImg = forwardRef<HTMLImageElement, { src: string; lazy?: boolean; onLoad?: () => void; style: React.CSSProperties }>(
  function CardImg({ src, lazy, onLoad, style }, ref) {
    const [cors, setCors] = useState(true)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img ref={ref} key={cors ? 'c' : 'n'} data-card-photo={cors ? '' : undefined} crossOrigin={cors ? 'anonymous' : undefined}
        src={src} alt="" loading={lazy ? 'lazy' : undefined} draggable={false} onLoad={onLoad}
        onError={() => { if (cors) setCors(false) }} style={style} />
    )
  })

function Chevron() {
  const { SOFT } = useCardStyle()
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden className="shrink-0" style={{ marginRight: 4 }}>
      <path d="M1 1l6 6-6 6" fill="none" stroke={SOFT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
