import {
  DEFAULT_STYLE, cssFont, fontStack, formatPrice, mix, resolveColor, styleFaces,
  type MenuStyle, type Ornament, type TextStyle,
} from '@/lib/menuStyle'
import { paintPaper } from './paper'

// ─────────────────────────────────────────────────────────────────────────────
// Impaginazione del menu (prototipo "pageCurl").
//
// Le pagine NON sono un PDF: vengono composte qui, per la misura esatta dello
// schermo, e disegnate su un canvas 2D che poi diventa la texture della pagina
// 3D (curl.ts). Tutto in pixel CSS; il canvas finale è moltiplicato per il dpr.
//
// Struttura: misura → blocchi (testata, categoria, piatto) → pagine → disegno.
// Regole di impaginazione:
//  • un piatto non si spezza tra due pagine (salvo che da solo superi la pagina:
//    allora si spezza tra le righe della descrizione);
//  • un titolo di categoria non resta mai da solo in fondo alla pagina;
//  • una categoria che continua nella pagina dopo ripete il titolo con "segue".
// ─────────────────────────────────────────────────────────────────────────────

export interface Dish {
  id:          string
  name:        string
  description: string | null
  price:       number | null
  /** id ufficiale (1–14), numero mostrato (personalizzabile per account) e nome per esteso. */
  allergens:   { id: number; n: number; name: string }[]
  /** Foto originale (intera); la parte da mostrare la decide `frame`. */
  image:       string | null
  /** Inquadratura scelta per il nuovo menu, e centro del vecchio ritaglio
   *  16:9 come ripiego (vedi lib/photoFrame). */
  frame?:      import('@/lib/photoFrame').PhotoFrame | null
  focus?:      import('@/lib/photoFrame').Rect | null
  category:    string
  /** Abbinamento consigliato (anche da un altro menu del ristorante). */
  pairing:     { label: string | null; dish: Dish } | null
}

export interface Category { name: string; dishes: Dish[] }

/** Testo ricco delle pagine informative: titoli, paragrafi, grassetto, corsivo. */
export interface TextRun { text: string; bold?: boolean; italic?: boolean }
export interface TextBlock { kind: 'h1' | 'h2' | 'h3' | 'p' | 'gap'; align: 'left' | 'center' | 'right'; runs: TextRun[] }

export interface MenuData {
  restaurantName: string
  menuName:       string
  categories:     Category[]
  /** Pagina informativa del ristoratore (in testa o in fondo al menu). */
  info?:          { position: 'first' | 'last'; blocks: TextBlock[] } | null
  /** Legenda allergeni in fondo al menu (generata dall'elenco del ristorante). */
  allergenLegend?: { id: number; n: number; name: string }[] | null
  /** Parole stampate sulle pagine, nella lingua scelta. */
  labels:         { allergens: string; cont: string; allergenNote: string }
}

export interface Insets { top: number; right: number; bottom: number; left: number }

export interface Viewport { w: number; h: number; insets: Insets }

// ── Stile ────────────────────────────────────────────────────────────────────

// Colori e caratteri arrivano dallo stile del ristorante (lib/menuStyle).
// Queste costanti sono i valori base, per chi disegna fuori dalle pagine.
export const PAPER = DEFAULT_STYLE.page.paper
export const SERIF = fontStack(DEFAULT_STYLE.dish.name.font)
export const SANS  = fontStack(DEFAULT_STYLE.category.text.font)

/** Facce da caricare prima di impaginare (le misure dipendono dal font reale). */
export const fontFaces = styleFaces

interface Metrics {
  s:         number   // fattore di scala tipografico
  x0:        number   // margine sinistro del testo
  cw:        number   // larghezza del testo
  top:       number   // primo y utile (sotto la testatina)
  bottom:    number   // ultimo y utile (sopra il numero di pagina)
  headY:     number   // baseline della testatina
  footY:     number   // baseline del numero di pagina
}

function metrics(vp: Viewport, st: MenuStyle): Metrics {
  const { w, h, insets } = vp
  // Scala: telefono ≈ 1, tablet fino a 1.45; moltiplicata per la scala dei
  // testi scelta nella Personalizzazione. Margini e larghezza massima del
  // testo dallo stile.
  const s     = Math.max(0.86, Math.min(1.45, Math.min(w, h * 0.62) / 390)) * st.page.scale
  const side  = Math.max(insets.left, insets.right) + st.page.margin * s
  const cw    = Math.max(160, Math.min(w - side * 2, st.page.maxWidth * s))
  const x0    = (w - cw) / 2
  // Margine verticale: testatina e numero di pagina si spostano con lui.
  const mv    = st.page.marginV
  const headY = insets.top + mv * s
  const footY = h - insets.bottom - mv * 0.8 * s
  // Senza testatina il testo può salire.
  const top   = st.runningHead.show ? headY + 30 * s : insets.top + mv * s
  return { s, x0, cw, top, bottom: footY - 30 * s, headY, footY }
}

// ── Testo ────────────────────────────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D

/** Stile di testo pronto per il canvas (px, colore effettivo, spaziatura px). */
interface RT { font: string; size: number; color: string; upper: boolean; track: number }

/** Larghezza di un testo con spaziatura lettere manuale (canvas letterSpacing
 *  non è affidabile su tutti i Safari). */
function spacedWidth(ctx: Ctx, text: string, spacing: number): number {
  if (!text) return 0
  if (!spacing) return ctx.measureText(text).width
  return ctx.measureText(text).width + spacing * (Array.from(text).length - 1)
}

function drawSpaced(ctx: Ctx, text: string, x: number, y: number, spacing: number, align: 'left' | 'center' | 'right') {
  if (!spacing) { ctx.textAlign = align; ctx.fillText(text, x, y); ctx.textAlign = 'left'; return }
  const total = spacedWidth(ctx, text, spacing)
  let cx = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total
  ctx.textAlign = 'left'
  for (const ch of Array.from(text)) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + spacing
  }
}

/** A capo per parole; le parole più larghe della riga vengono spezzate. */
function wrap(text: string, maxW: number, measure: (t: string) => number): string[] {
  const out: string[] = []
  for (const para of text.split(/\r?\n/)) {
    const words = para.trim().split(/\s+/).filter(Boolean)
    if (!words.length) continue
    let line = ''
    for (const word of words) {
      const cand = line ? `${line} ${word}` : word
      if (measure(cand) <= maxW) { line = cand; continue }
      if (line) out.push(line)
      if (measure(word) <= maxW) { line = word; continue }
      // Parola più larga della riga: si spezza carattere per carattere.
      let chunk = ''
      for (const ch of Array.from(word)) {
        if (measure(chunk + ch) > maxW && chunk) { out.push(chunk); chunk = ch }
        else chunk += ch
      }
      line = chunk
    }
    if (line) out.push(line)
  }
  return out
}

// ── Blocchi ──────────────────────────────────────────────────────────────────

interface DishBlock {
  kind:      'dish'
  dish:      Dish
  nameLines: string[]
  price:     string
  /** Posizione effettiva del prezzo (in riga diventa "sotto" se non ci sta). */
  priceAt:   'right' | 'below' | 'inline'
  descLines: string[]
  allergens: string
  /** Se il piatto è stato spezzato: righe di descrizione già usate. */
  descFrom:  number
  descTo:    number
  showHead:  boolean
}
interface CatBlock { kind: 'cat'; name: string; cont: boolean }
interface HeadBlock { kind: 'head'; titleSize: number }
/** Una riga di testo ricco già spezzata (pagine informative). */
interface TextLineBlock {
  kind:  'tline'
  segs:  { text: string; font: string; color: string; w: number }[]
  width: number
  size:  number
  align: TextBlock['align']
  from:  'info' | 'legend'
}
interface LegendBlock { kind: 'legend'; n: number; name: string; col: number }
type Block = DishBlock | CatBlock | HeadBlock | TextLineBlock | LegendBlock

interface Placed { block: Block; y: number; h: number }

export interface Page {
  index:   number
  items:   Placed[]
  /** Primo piatto della pagina: serve a ritrovare la pagina dopo un resize. */
  anchor:  string | null
}

export interface Layout {
  vp:     Viewport
  pages:  Page[]
  paint:  (ctx: Ctx, pageIndex: number) => void
  /** Piatto sotto il punto (x, y) della pagina, in coordinate della pagina. */
  hit:    (pageIndex: number, x: number, y: number) => Dish | null
  /** Pagina in cui inizia ogni categoria (index = posizione in data.categories). */
  categoryStarts: { index: number; name: string; page: number }[]
  /** Elemento sotto il punto (anteprima della Personalizzazione). */
  pick:   (pageIndex: number, x: number, y: number) => PickTarget
  /** Piatti di una pagina (e i loro abbinamenti): per precaricarne le foto. */
  dishesOn: (pageIndex: number) => Dish[]
}

/** Elementi del menu che si possono toccare nell'anteprima per modificarli. */
export type PickTarget =
  | 'paper' | 'restaurant' | 'title' | 'runningHead' | 'category' | 'name' | 'price'
  | 'description' | 'allergens' | 'pageNumber' | 'text'

const TEXT_GAP = 14

export interface Assets { background: HTMLImageElement | null }

export function layoutMenu(ctx: Ctx, data: MenuData, vp: Viewport, style: MenuStyle = DEFAULT_STYLE, assets: Assets = { background: null }): Layout {
  const st = style
  const D = st.dish
  const NAME_LH = D.nameLineHeight
  const DARK_PAPER = luminance(st.page.paper) < 0.45
  const ACCENT_SOFT = mix(st.page.accent, st.page.paper, 0.45)
  const m = metrics(vp, st)
  const s = m.s
  const rt = (t: TextStyle, k = 1): RT => ({
    font: cssFont(t, s * k), size: t.size * s * k, color: resolveColor(t.color, st), upper: t.upper, track: t.tracking * t.size * s * k,
  })
  const tx = (r: RT, text: string) => (r.upper ? text.toLocaleUpperCase('it-IT') : text)
  const measure = (c: Ctx, r: RT, text: string) => { c.font = r.font; return spacedWidth(c, text, r.track) }
  const draw = (c: Ctx, r: RT, text: string, x: number, y: number, align: 'left' | 'center' | 'right') => {
    c.font = r.font; c.fillStyle = r.color; drawSpaced(c, text, x, y, r.track, align)
  }
  /** Riduce un testo su una riga finché non sta nella larghezza (fino al 55%). */
  const fit = (t: TextStyle, text: string, maxW: number): RT => {
    let k = 1, r = rt(t)
    while (measure(ctx, r, tx(r, text)) > maxW && k > 0.55) { k -= 0.04; r = rt(t, k) }
    return r
  }

  const NAME = rt(D.name), DESC = rt(D.description), PRICE = rt(D.price), ALG = rt(st.allergens.text)
  const CAT = rt(st.category.text), RUN = rt(st.runningHead.text), PNUM = rt(st.pageNumber.text)
  const REST = rt(st.head.restaurant)
  const CENTER = D.align === 'center'
  // Centrato: il prezzo a destra non avrebbe un allineamento, va sotto.
  const PRICE_POS = CENTER && D.pricePosition === 'right' ? 'below' : D.pricePosition
  const DESC_LH = D.descLineHeight
  // Spazio tra i piatti: con un separatore serve almeno lo spazio per disegnarlo.
  const GAP = Math.max(D.spacing, D.divider === 'none' ? 0 : 16) * s
  const CAT_BEFORE = st.category.before * s, CAT_AFTER = st.category.after * s
  const DESC_GAP = D.descGap * s, ALG_GAP = D.allergenGap * s, INLINE_GAP = (10 + D.priceGap) * s

  // ── Misura dei piatti
  const measureDish = (dish: Dish): DishBlock => {
    const price = formatPrice(dish.price, D.priceSymbol, D.priceDecimals)
    const priceW = price ? measure(ctx, PRICE, price) : 0
    // Prezzo a destra: il nome e la descrizione gli lasciano spazio.
    const reserve = price && PRICE_POS === 'right' ? priceW + 22 * s : 0
    const nameLines = wrap(tx(NAME, dish.name), m.cw - reserve, t => measure(ctx, NAME, t))
    let priceAt: DishBlock['priceAt'] = PRICE_POS
    if (price && PRICE_POS === 'inline') {
      const last = nameLines[nameLines.length - 1] ?? ''
      if (measure(ctx, NAME, last) + INLINE_GAP + priceW > m.cw) priceAt = 'below'
    }
    const descW = Math.min(PRICE_POS === 'right' ? m.cw - Math.max(reserve, 18 * s) : m.cw, m.cw * D.descWidth)
    const descLines = dish.description ? wrap(tx(DESC, dish.description), descW, t => measure(ctx, DESC, t)) : []
    const nums = dish.allergens?.map(a => a.n).join(' · ') ?? ''
    const allergens = st.allergens.show && nums
      ? tx(ALG, st.allergens.label ? `${data.labels.allergens}  ${nums}` : nums)
      : ''
    return { kind: 'dish', dish, nameLines, price, priceAt, descLines, allergens, descFrom: 0, descTo: descLines.length, showHead: true }
  }
  const nameH = (b: DishBlock) => b.nameLines.length * NAME.size * NAME_LH
  const priceBelowH = () => D.priceGap * s + PRICE.size * 1.25
  const dishHeight = (b: DishBlock) => {
    let hh = 0
    if (b.showHead) hh += nameH(b)
    if (b.showHead && b.price && b.priceAt === 'below') hh += priceBelowH()
    const n = b.descTo - b.descFrom
    if (n) hh += DESC_GAP + n * DESC.size * DESC_LH
    if (b.allergens && b.descTo === b.descLines.length) hh += ALG_GAP + ALG.size * 1.4
    return hh
  }

  // ── Testata della prima pagina: nome del ristorante, titolo, ornamento.
  const H = st.head
  const TITLE_FIT = fit(H.title, data.menuName, m.cw)
  const restBase = H.showRestaurant ? REST.size + 3.5 * s : 0
  const titleBase = restBase + (H.showRestaurant ? TITLE_FIT.size * 1.21 + H.titleGap * s : TITLE_FIT.size * 0.95)
  const ornY = titleBase + H.ornamentGap * s
  const HEAD_H = (H.ornament === 'none' ? titleBase + 30 * s : ornY + (24 + 10 * H.ornamentSize) * s) + H.space * s

  // ── Titolo di categoria
  const CS = st.category.style
  const CAT_PAD = CS === 'frame' ? 8 * s : 0
  const CAT_H = CAT.size * 1.4 + CAT_PAD * 2 + (CS === 'underline' ? 7 * s : 0)
  const CONT = rt({ ...D.description, size: 12, italic: true, color: st.category.text.color, upper: false, tracking: 0 })

  // ── Testo ricco → righe (a capo per parole, con caratteri diversi nella riga)
  const TP = st.textPages
  const LHK = TP.lineHeight, PG = TP.paraGap
  const textStyleOf = (k: Exclude<TextBlock['kind'], 'gap'>): { t: TextStyle; lh: number; after: number } =>
    k === 'h1' ? { t: TP.title, lh: 1.18 * LHK, after: PG + 4 }
    : k === 'h2' ? { t: { ...TP.title, size: TP.title.size * 0.78 }, lh: 1.25 * LHK, after: PG + 2 }
    : k === 'h3' ? { t: { ...TP.body, italic: true, color: 'soft' }, lh: 1.32 * LHK, after: PG }
    : { t: TP.body, lh: 1.36 * LHK, after: PG }
  type Piece = { block: Block | null; h: number }   // null = spazio vuoto
  const textPieces = (blocks: TextBlock[], from: TextLineBlock['from']): Piece[] => {
    const out: Piece[] = []
    for (const b of blocks) {
      if (b.kind === 'gap') { out.push({ block: null, h: TEXT_GAP * s }); continue }
      const ts = textStyleOf(b.kind)
      const base = rt(ts.t)
      const size = base.size
      const fontOf = (r: TextRun) => cssFont({ ...ts.t, italic: ts.t.italic || !!r.italic, weight: r.bold ? 700 : ts.t.weight }, s)
      // Parole con il loro carattere; '\n' = a capo forzato.
      const words: { text: string; font: string; br: boolean; space: boolean }[] = []
      for (const r of b.runs) {
        const f = fontOf(r)
        const parts = tx(base, r.text).split(/(\n|\s+)/)
        for (const part of parts) {
          if (!part) continue
          if (part === '\n') { words.push({ text: '', font: f, br: true, space: false }); continue }
          if (/^\s+$/.test(part)) { if (words.length) words[words.length - 1].space = true; continue }
          words.push({ text: part, font: f, br: false, space: false })
        }
      }
      let line: TextLineBlock['segs'] = []
      let lw = 0
      const flush = () => {
        if (!line.length) return
        out.push({ block: { kind: 'tline', segs: line, width: lw, size, align: b.align, from }, h: size * ts.lh })
        line = []; lw = 0
      }
      let pendingSpace = 0
      for (let i = 0; i < words.length; i++) {
        const wd = words[i]
        if (wd.br) { flush(); pendingSpace = 0; continue }
        ctx.font = wd.font
        const w = ctx.measureText(wd.text).width
        const sp = line.length ? pendingSpace : 0
        if (line.length && lw + sp + w > m.cw) { flush() }
        const lead = line.length ? pendingSpace : 0
        line.push({ text: wd.text, font: wd.font, color: base.color, w: lead + w })
        lw += lead + w
        ctx.font = wd.font
        pendingSpace = wd.space ? ctx.measureText(' ').width : 0
      }
      flush()
      if (out.length) out[out.length - 1].h += ts.after * s
    }
    // Niente spazi vuoti in testa o in coda.
    while (out.length && !out[0].block) out.shift()
    while (out.length && !out[out.length - 1].block) out.pop()
    return out
  }
  const piecesHeight = (ps: Piece[]) => ps.reduce((a, p) => a + p.h, 0)

  // ── Impaginazione
  const pages: Page[] = []
  let cur: Placed[] = []
  let y = m.top
  const newPage = () => { pages.push({ index: pages.length, items: cur, anchor: null }); cur = []; y = m.top }
  const room = () => m.bottom - y
  const contHead = (name: string) => {
    cur.push({ block: { kind: 'cat', name, cont: st.category.continued }, y, h: CAT_H }); y += CAT_H + CAT_AFTER
  }

  cur.push({ block: { kind: 'head', titleSize: TITLE_FIT.size }, y, h: HEAD_H }); y += HEAD_H

  /** Mette i pezzi di testo a partire da y; se stanno nello spazio rimasto li
   *  centra (un po' più in alto del centro), altrimenti continua sulle pagine
   *  successive senza lasciare spazi vuoti in cima. */
  const placeText = (ps: Piece[]) => {
    if (!ps.length) return
    const total = piecesHeight(ps)
    if (total <= room()) y += (room() - total) * 0.42
    for (const pc of ps) {
      if (pc.h > room() && cur.length) { newPage(); if (!pc.block) continue }
      if (pc.block) cur.push({ block: pc.block, y, h: pc.h })
      y += pc.h
    }
  }

  // Pagina informativa in testa: sotto il titolo del menu, poi i piatti da
  // una pagina nuova.
  const infoPieces = data.info?.blocks.length ? textPieces(data.info.blocks, 'info') : []
  if (infoPieces.length && data.info!.position === 'first') {
    y += 10 * s
    placeText(infoPieces)
    newPage()
  }

  const categoryStarts: Layout['categoryStarts'] = []
  for (let ci = 0; ci < data.categories.length; ci++) {
    const cat = data.categories[ci]
    if (!cat.dishes.length) continue
    const dishes = cat.dishes.map(measureDish)
    // Titolo + primo piatto devono stare insieme.
    const firstH = dishes.length ? dishHeight(dishes[0]) : 0
    const afterHead = !cur.length || cur[cur.length - 1].block.kind === 'head'
    const before = afterHead ? 0 : CAT_BEFORE
    if (before + CAT_H + CAT_AFTER + Math.min(firstH, m.bottom - m.top - CAT_H - CAT_AFTER) > room()) newPage()
    y += cur.length && cur[cur.length - 1].block.kind !== 'head' ? CAT_BEFORE : 0
    categoryStarts.push({ index: ci, name: cat.name, page: pages.length })
    cur.push({ block: { kind: 'cat', name: cat.name, cont: false }, y, h: CAT_H }); y += CAT_H + CAT_AFTER

    for (let i = 0; i < dishes.length; i++) {
      const b = dishes[i]
      let h = dishHeight(b)
      const gap = cur.length && cur[cur.length - 1].block.kind === 'dish' ? GAP : 0
      if (gap + h <= room()) { y += gap; cur.push({ block: b, y, h }); y += h; continue }

      const full = m.bottom - m.top - CAT_H - CAT_AFTER
      if (h <= full) {
        newPage()
        contHead(cat.name)
        cur.push({ block: b, y, h }); y += h
        continue
      }
      // Piatto più alto di una pagina intera: si spezza tra le righe di descrizione.
      let from = 0
      while (from < b.descLines.length || from === 0) {
        if (room() < NAME.size * 2) { newPage(); contHead(cat.name) }
        else y += gap
        const part: DishBlock = { ...b, descFrom: from, showHead: from === 0, descTo: from }
        while (part.descTo < b.descLines.length) {
          const next = { ...part, descTo: part.descTo + 1 }
          if (dishHeight(next) > room()) break
          part.descTo++
        }
        if (part.descTo === from && from !== 0) part.descTo++ // garantisce avanzamento
        h = dishHeight(part)
        cur.push({ block: part, y, h }); y += h
        from = part.descTo
        if (from >= b.descLines.length) break
        newPage()
        contHead(cat.name)
      }
    }
  }
  // Pagina informativa in fondo.
  if (infoPieces.length && data.info!.position === 'last') {
    if (cur.length) newPage()
    placeText(infoPieces)
  }

  // Legenda degli allergeni: ultima pagina, numeri e nomi in colonna centrata.
  const legend = data.allergenLegend ?? []
  const LEG_NAME = rt({ ...TP.body, size: TP.body.size * 1.03 })
  const LEG_NUM = rt({ ...st.allergens.text, size: st.allergens.text.size * 1.16, weight: 600 })
  const LEG_LH = 1.62
  if (legend.length) {
    if (cur.length) newPage()
    cur.push({ block: { kind: 'cat', name: data.labels.allergens, cont: false }, y, h: CAT_H }); y += CAT_H + CAT_AFTER
    placeLegendNote()
    const nameW = Math.max(...legend.map(a => measure(ctx, LEG_NAME, tx(LEG_NAME, a.name))))
    const col = Math.min(m.cw, nameW + 34 * s)
    for (const a of legend) {
      const h = LEG_NAME.size * LEG_LH
      if (h > room()) { newPage(); contHead(data.labels.allergens) }
      cur.push({ block: { kind: 'legend', n: a.n, name: a.name, col }, y, h }); y += h
    }
  }
  function placeLegendNote() {
    if (!data.labels.allergenNote) return
    const note = textPieces([{ kind: 'h3', align: 'center', runs: [{ text: data.labels.allergenNote }] }], 'legend')
    for (const pc of note) { if (pc.block) cur.push({ block: pc.block, y, h: pc.h }); y += pc.h }
    y += 14 * s
  }

  if (cur.length) newPage()
  for (const p of pages) {
    const d = p.items.find(it => it.block.kind === 'dish')
    // Àncora per ritrovare la pagina (resize, lingua): primo piatto, oppure
    // il tipo di pagina di testo.
    p.anchor = d ? (d.block as DishBlock).dish.id
      : p.items.some(it => it.block.kind === 'legend') ? 'allergens'
      : p.items.some(it => it.block.kind === 'tline') ? 'info'
      : null
  }

  // ── Testatina e numeri di pagina
  const RUN_TEXT = tx(RUN, st.runningHead.content === 'restaurant' ? data.restaurantName
    : st.runningHead.content === 'menu' ? data.menuName
    : `${data.restaurantName} · ${data.menuName}`)
  const pageLabel = (i: number) => {
    const n = String(i + 1)
    return st.pageNumber.format === 'plain' ? n : st.pageNumber.format === 'dashes' ? `— ${n} —` : `${n}  /  ${pages.length}`
  }

  /** Disegna la pagina `index`; fuori dall'intervallo disegna carta vuota
   *  (es. la destra dell'ultima doppia pagina quando le pagine sono dispari). */
  const paint = (c: Ctx, index: number) => {
    const page = pages[index] as Page | undefined
    const { w, h } = vp
    // Carta: tinta scelta, luce appena più chiara al centro, superficie.
    c.fillStyle = st.page.paper
    c.fillRect(0, 0, w, h)
    const L = st.page.light
    if (L > 0) {
      // Su carta scura la luce bianca la sbiadirebbe: luce appena accennata e
      // bordi un filo più scuri.
      const g = c.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.hypot(w, h) * 0.62)
      if (DARK_PAPER) {
        g.addColorStop(0, `rgba(255,255,255,${0.06 * L})`)
        g.addColorStop(1, `rgba(0,0,0,${0.22 * L})`)
      } else {
        g.addColorStop(0, `rgba(255,255,255,${0.55 * L})`)
        g.addColorStop(1, `rgba(150,130,100,${0.12 * L})`)
      }
      c.fillStyle = g
      c.fillRect(0, 0, w, h)
    }
    paintPaper(c, st.page.texture, st.page.textureStrength, w, h)
    // Sfondo scelto dal ristoratore, sopra la carta e sotto il testo.
    const BG = st.page.background
    const bgOn = BG.pages === 'all' || (BG.pages === 'first' ? index === 0 : index > 0)
    if (assets.background && BG.url && bgOn) {
      const im = assets.background
      c.globalAlpha = BG.opacity
      if (BG.fit === 'tile') {
        // Motivo ripetuto, alla scala del telefono (~ 240 px di lato).
        const k = (240 * s) / Math.max(im.naturalWidth, im.naturalHeight)
        const tw = im.naturalWidth * k, th = im.naturalHeight * k
        for (let ty = 0; ty < h; ty += th) for (let tx0 = 0; tx0 < w; tx0 += tw) c.drawImage(im, tx0, ty, tw, th)
      } else {
        const k = Math.max(w / im.naturalWidth, h / im.naturalHeight)
        const iw = im.naturalWidth * k, ih = im.naturalHeight * k
        c.drawImage(im, (w - iw) / 2, (h - ih) / 2, iw, ih)
      }
      c.globalAlpha = 1
    }
    c.textBaseline = 'alphabetic'
    if (!page) return

    // Testatina (dalla seconda pagina) e numero di pagina.
    if (index > 0 && st.runningHead.show) {
      const r = measure(c, RUN, RUN_TEXT) > m.cw ? fit(st.runningHead.text, RUN_TEXT, m.cw) : RUN
      draw(c, r, RUN_TEXT, w / 2, m.headY, 'center')
    }
    if (st.pageNumber.show) draw(c, PNUM, tx(PNUM, pageLabel(index)), w / 2, m.footY, 'center')

    let prev: Placed | null = null
    for (const it of page.items) {
      const b = it.block
      if (b.kind === 'head') paintHead(c, b, it.y)
      else if (b.kind === 'cat') paintCat(c, b, it.y)
      else if (b.kind === 'tline') paintTextLine(c, b, it.y)
      else if (b.kind === 'legend') paintLegend(c, b, it.y)
      else {
        if (prev?.block.kind === 'dish' && b.showHead) paintDivider(c, (prev.y + prev.h + it.y) / 2)
        paintDish(c, b, it.y)
      }
      prev = it
    }
  }

  function paintTextLine(c: Ctx, b: TextLineBlock, top: number) {
    let x = b.align === 'left' ? m.x0 : b.align === 'right' ? m.x0 + m.cw - b.width : m.x0 + (m.cw - b.width) / 2
    const base = top + b.size * 0.95
    c.textAlign = 'right'
    for (const sg of b.segs) {
      c.font = sg.font
      c.fillStyle = sg.color
      x += sg.w
      c.fillText(sg.text, x, base)   // allineata a destra: lo spazio iniziale resta a sinistra
    }
    c.textAlign = 'left'
  }

  function paintLegend(c: Ctx, b: LegendBlock, top: number) {
    const left = m.x0 + (m.cw - b.col) / 2
    const base = top + LEG_NAME.size * 0.95
    draw(c, LEG_NUM, String(b.n), left + 20 * s, base - 1 * s, 'right')
    draw(c, LEG_NAME, tx(LEG_NAME, b.name), left + 34 * s, base, 'left')
  }

  function paintHead(c: Ctx, b: HeadBlock, top: number) {
    const cx = vp.w / 2
    if (H.showRestaurant) {
      const name = tx(REST, data.restaurantName)
      const r = measure(c, REST, name) > m.cw ? fit(H.restaurant, data.restaurantName, m.cw) : REST
      draw(c, r, name, cx, top + restBase, 'center')
    }
    draw(c, TITLE_FIT, tx(TITLE_FIT, data.menuName), cx, top + titleBase, 'center')
    if (H.ornament !== 'none') ornament(c, H.ornament, cx, top + ornY, H.ornamentSize)
  }

  const ornament = (c: Ctx, kind: Ornament, cx: number, cy: number, k: number) =>
    drawOrnament(c, kind, cx, cy, s * k, st.page.accent, ACCENT_SOFT)

  function paintCat(c: Ctx, b: CatBlock, top: number) {
    const left = st.category.align === 'left'
    const cx = m.x0 + m.cw / 2
    const label = tx(CAT, b.name)
    const r = measure(c, CAT, label) > m.cw - 24 * s ? fit(st.category.text, b.name, m.cw - 24 * s) : CAT
    const base = top + CAT_PAD + r.size
    const tw = measure(c, r, label)
    const tx0 = left ? m.x0 + CAT_PAD * 1.5 : cx - tw / 2
    draw(c, r, label, left ? tx0 : cx, base, left ? 'left' : 'center')
    c.strokeStyle = ACCENT_SOFT
    c.lineWidth = Math.max(0.5, 0.7 * s)
    const ly = base - r.size * 0.36
    const pad = 12 * s
    if (CS === 'rules') {
      // Filetti ai lati del titolo (a destra soltanto, se allineato a sinistra).
      c.beginPath()
      if (!left) { c.moveTo(m.x0, ly); c.lineTo(tx0 - pad, ly) }
      c.moveTo(tx0 + tw + pad, ly); c.lineTo(m.x0 + m.cw, ly)
      c.stroke()
    } else if (CS === 'underline') {
      c.beginPath(); c.moveTo(tx0, base + 7 * s); c.lineTo(tx0 + tw, base + 7 * s); c.stroke()
    } else if (CS === 'frame') {
      const fx = tx0 - CAT_PAD * 1.5, fw = tw + CAT_PAD * 3
      c.strokeRect(fx, top + 0.5, fw, CAT_H - 1)
    } else if (CS === 'ornament' && !b.cont) {
      // Ornamento piccolo sotto il titolo (a sinistra: sotto l'inizio).
      ornament(c, st.category.ornament, left ? tx0 + 46 * 0.55 * s : cx, base + 9 * s, 0.55)
    }
    if (b.cont) draw(c, CONT, data.labels.cont, left ? tx0 : cx, top + CAT_H + 12 * s, left ? 'left' : 'center')
  }

  function paintDivider(c: Ctx, yy: number) {
    const kind = D.divider
    if (kind === 'none') return
    const cx = m.x0 + m.cw / 2
    c.strokeStyle = ACCENT_SOFT
    c.fillStyle = ACCENT_SOFT
    c.lineWidth = Math.max(0.5, 0.6 * s)
    if (kind === 'line' || kind === 'short') {
      const half = kind === 'line' ? m.cw / 2 : 22 * s
      const x0 = CENTER || kind === 'short' ? cx - half : m.x0
      const x1 = CENTER || kind === 'short' ? cx + half : m.x0 + m.cw
      c.beginPath(); c.moveTo(x0, yy); c.lineTo(x1, yy); c.stroke()
    } else if (kind === 'dots') {
      for (const dx of [-10, 0, 10]) { c.beginPath(); c.arc(cx + dx * s, yy, 1.1 * s, 0, Math.PI * 2); c.fill() }
    } else ornament(c, D.dividerOrnament, cx, yy, 0.65)
  }

  function paintDish(c: Ctx, b: DishBlock, top: number) {
    let y = top
    const right = m.x0 + m.cw
    const x = CENTER ? m.x0 + m.cw / 2 : m.x0
    const align = CENTER ? 'center' : 'left'
    if (b.showHead) {
      b.nameLines.forEach((line, i) => {
        const base = y + NAME.size * (0.92 + i * NAME_LH)
        const inline = i === b.nameLines.length - 1 && !!b.price && b.priceAt === 'inline'
        // Centrato con prezzo in riga: nome e prezzo si centrano insieme (sotto).
        if (!(inline && CENTER)) draw(c, NAME, line, x, base, align)
        const lw = measure(c, NAME, line)
        if (i === 0 && b.price && b.priceAt === 'right') {
          draw(c, PRICE, b.price, right, base, 'right')
          // Guida tra nome e prezzo, solo se c'è spazio vero.
          const from = m.x0 + lw + 8 * s
          const to = right - measure(c, PRICE, b.price) - 8 * s
          if (D.leader !== 'none' && b.nameLines.length === 1 && to - from > 14 * s) {
            c.fillStyle = ACCENT_SOFT
            c.strokeStyle = ACCENT_SOFT
            if (D.leader === 'dots') {
              const step = 5 * s
              for (let px = Math.ceil(from / step) * step; px <= to; px += step) {
                c.beginPath(); c.arc(px, base - 1.2 * s, 0.75 * s, 0, Math.PI * 2); c.fill()
              }
            } else {
              c.lineWidth = Math.max(0.5, 0.6 * s)
              c.beginPath(); c.moveTo(from, base - 1.4 * s); c.lineTo(to, base - 1.4 * s); c.stroke()
            }
          }
        }
        if (inline) {
          // Prezzo in riga, subito dopo il nome.
          const gap = INLINE_GAP
          const pw = measure(c, PRICE, b.price)
          if (CENTER) {
            const start = x - (lw + gap + pw) / 2
            draw(c, NAME, line, start, base, 'left')
            draw(c, PRICE, b.price, start + lw + gap, base, 'left')
          } else draw(c, PRICE, b.price, x + lw + gap, base, 'left')
        }
      })
      y += nameH(b)
      if (b.price && b.priceAt === 'below') {
        y += D.priceGap * s
        draw(c, PRICE, b.price, x, y + PRICE.size * 0.92, align)
        y += PRICE.size * 1.25
      }
    }
    const n = b.descTo - b.descFrom
    if (n) {
      y += DESC_GAP
      for (let i = b.descFrom; i < b.descTo; i++) {
        draw(c, DESC, b.descLines[i], x, y + DESC.size * 0.95, align)
        y += DESC.size * DESC_LH
      }
    }
    if (b.allergens && b.descTo === b.descLines.length) {
      y += ALG_GAP
      draw(c, ALG, b.allergens, x, y + ALG.size, align)
    }
  }

  // Il bersaglio del tocco è tutto il blocco del piatto, allargato di metà
  // dello spazio tra un piatto e l'altro (nessun buco tra due piatti vicini).
  const hit = (pageIndex: number, x: number, y: number): Dish | null => {
    const page = pages[pageIndex]
    if (!page || x < m.x0 - 16 * s || x > m.x0 + m.cw + 16 * s) return null
    const pad = GAP / 2
    for (const it of page.items) {
      if (it.block.kind !== 'dish') continue
      if (y >= it.y - pad && y <= it.y + it.h + pad) return it.block.dish
    }
    return null
  }

  // Anteprima: che cosa c'è sotto il dito (parti del piatto comprese).
  const pick = (pageIndex: number, x: number, y: number): PickTarget => {
    const page = pages[pageIndex]
    if (!page) return 'paper'
    if (st.pageNumber.show && Math.abs(y - m.footY + PNUM.size * 0.4) < 14 * s) return 'pageNumber'
    if (pageIndex > 0 && st.runningHead.show && Math.abs(y - m.headY + RUN.size * 0.4) < 14 * s) return 'runningHead'
    const pad = GAP / 2
    for (const it of page.items) {
      const b = it.block
      if (y < it.y - (b.kind === 'dish' ? pad : 4 * s) || y > it.y + it.h + (b.kind === 'dish' ? pad : 4 * s)) continue
      if (b.kind === 'head') return H.showRestaurant && y < it.y + restBase + 6 * s ? 'restaurant' : 'title'
      if (b.kind === 'cat') return 'category'
      if (b.kind === 'tline' || b.kind === 'legend') return 'text'
      let yy = it.y
      if (b.showHead) {
        const nh = nameH(b)
        if (y <= yy + nh) {
          if (b.price && b.priceAt === 'right' && x > m.x0 + m.cw - measure(ctx, PRICE, b.price) - 12 * s) return 'price'
          if (b.price && b.priceAt === 'inline' && y > yy + nh - NAME.size * NAME_LH) {
            const lw = measure(ctx, NAME, b.nameLines[b.nameLines.length - 1])
            const px = CENTER ? m.x0 + m.cw / 2 + lw / 2 : m.x0 + lw
            if (x > px) return 'price'
          }
          return 'name'
        }
        yy += nh
        if (b.price && b.priceAt === 'below') {
          yy += priceBelowH()
          if (y <= yy) return 'price'
        }
      }
      const n = b.descTo - b.descFrom
      if (n) {
        yy += DESC_GAP + n * DESC.size * DESC_LH
        if (y <= yy) return 'description'
      }
      return b.allergens ? 'allergens' : 'description'
    }
    return 'paper'
  }

  const dishesOn = (pageIndex: number): Dish[] => {
    const out: Dish[] = []
    for (const it of pages[pageIndex]?.items ?? []) {
      if (it.block.kind !== 'dish') continue
      out.push(it.block.dish)
      if (it.block.dish.pairing) out.push(it.block.dish.pairing.dish)
    }
    return out
  }

  return { vp, pages, paint, hit, categoryStarts, pick, dishesOn }
}

// ── Ornamenti ────────────────────────────────────────────────────────────────

function diamond(c: Ctx, cx: number, cy: number, r: number) {
  c.beginPath()
  c.moveTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy); c.closePath()
  c.fill()
}

function star(c: Ctx, cx: number, cy: number, R: number, r: number) {
  c.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R
    c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  }
  c.closePath(); c.fill()
}

/** Ornamento centrato in (cx, cy), largo ~92·u: u = unità in px (scala ×
 *  grandezza). Accento pieno per i motivi, accento tenue per i filetti.
 *  Usato dalle pagine e dalle miniature della Personalizzazione. */
export function drawOrnament(c: Ctx, kind: Ornament, cx: number, cy: number, u: number, accent: string, soft: string) {
  c.strokeStyle = soft
  c.fillStyle = accent
  c.lineWidth = Math.max(0.6, 0.75 * u)
  const line = (x0: number, x1: number, yy = cy) => { c.beginPath(); c.moveTo(cx + x0 * u, yy); c.lineTo(cx + x1 * u, yy); c.stroke() }
  // Filetti ai lati di un motivo centrale largo 2·gap.
  const wings = (gap: number) => { line(-46, -gap); line(gap, 46) }
  switch (kind) {
    case 'line': line(-40, 40); break
    case 'double': line(-40, 40, cy - 1.8 * u); line(-40, 40, cy + 1.8 * u); break
    case 'dots':
      for (const dx of [-12, 0, 12]) { c.beginPath(); c.arc(cx + dx * u, cy, 1.6 * u, 0, Math.PI * 2); c.fill() }
      break
    case 'wave': {
      c.beginPath()
      for (let x = -40; x <= 40; x += 1) {
        const yy = cy + Math.sin((x / 10) * Math.PI) * 2.4 * u
        if (x === -40) c.moveTo(cx + x * u, yy); else c.lineTo(cx + x * u, yy)
      }
      c.stroke()
      break
    }
    case 'star': wings(12); star(c, cx, cy, 5 * u, 2 * u); break
    case 'circle':
      wings(9)
      c.beginPath(); c.arc(cx, cy, 3.4 * u, 0, Math.PI * 2); c.lineWidth = Math.max(0.7, 1 * u); c.strokeStyle = accent; c.stroke()
      break
    case 'cross':
      wings(10)
      c.strokeStyle = accent; c.lineWidth = Math.max(0.8, 1.1 * u)
      c.beginPath(); c.moveTo(cx - 4 * u, cy); c.lineTo(cx + 4 * u, cy); c.moveTo(cx, cy - 4 * u); c.lineTo(cx, cy + 4 * u); c.stroke()
      break
    case 'leaf':
      // Rametto: due foglie dal centro, poi i filetti.
      line(-46, -24); line(24, 46)
      for (const sd of [-1, 1]) {
        c.beginPath()
        c.moveTo(cx + sd * 3 * u, cy)
        c.quadraticCurveTo(cx + sd * 12 * u, cy - 6.5 * u, cx + sd * 21 * u, cy)
        c.quadraticCurveTo(cx + sd * 12 * u, cy + 6.5 * u, cx + sd * 3 * u, cy)
        c.fill()
      }
      c.beginPath(); c.arc(cx, cy, 1.5 * u, 0, Math.PI * 2); c.fill()
      break
    case 'flourish':
      // Ricciolo simmetrico (svolazzo calligrafico) con un punto al centro.
      c.strokeStyle = accent
      c.lineWidth = Math.max(0.7, 0.9 * u)
      for (const sd of [-1, 1]) {
        c.beginPath()
        c.moveTo(cx + sd * 4 * u, cy)
        c.bezierCurveTo(cx + sd * 14 * u, cy - 9 * u, cx + sd * 24 * u, cy + 8 * u, cx + sd * 34 * u, cy)
        c.bezierCurveTo(cx + sd * 40 * u, cy - 5 * u, cx + sd * 44 * u, cy - 1 * u, cx + sd * 40 * u, cy + 2.5 * u)
        c.stroke()
      }
      c.beginPath(); c.arc(cx, cy, 1.7 * u, 0, Math.PI * 2); c.fill()
      break
    case 'asterism':
      for (const [dx, dy] of [[0, -3.4], [-4.2, 3], [4.2, 3]]) star(c, cx + dx * u, cy + dy * u, 2.7 * u, 1.1 * u)
      break
    case 'diamond':
      wings(9); diamond(c, cx, cy, 3.2 * u)
      break
    case 'none': break
  }
}

/** Luminosità relativa (0 nero – 1 bianco) di un colore #rrggbb. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}

