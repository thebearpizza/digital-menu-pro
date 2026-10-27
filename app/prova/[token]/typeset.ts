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
  /** Numero mostrato (personalizzabile per account) e nome per esteso. */
  allergens:   { n: number; name: string }[]
  image:       string | null
  category:    string
  /** Abbinamento consigliato (anche da un altro menu del ristorante). */
  pairing:     { label: string | null; dish: Dish } | null
}

export interface Category { name: string; dishes: Dish[] }

export interface MenuData {
  restaurantName: string
  menuName:       string
  categories:     Category[]
}

export interface Insets { top: number; right: number; bottom: number; left: number }

export interface Viewport { w: number; h: number; insets: Insets }

// ── Stile ────────────────────────────────────────────────────────────────────

export const PAPER   = '#fbf8f2'
const INK            = '#1d1915'
const INK_SOFT       = '#5f574d'
const ACCENT         = '#9a8462'
const ACCENT_SOFT    = '#c9bba2'

export const SERIF = '"Cormorant Garamond", "Iowan Old Style", Georgia, serif'
export const SANS  = '"Inter", -apple-system, "Helvetica Neue", Arial, sans-serif'

// Facce da caricare prima di impaginare (le misure dipendono dal font reale).
export const FONT_FACES = [
  `600 20px ${SERIF}`, `500 20px ${SERIF}`, `italic 400 20px ${SERIF}`, `italic 500 20px ${SERIF}`,
  `500 12px ${SANS}`, `600 12px ${SANS}`,
]

interface Metrics {
  s:         number   // fattore di scala tipografico
  x0:        number   // margine sinistro del testo
  cw:        number   // larghezza del testo
  top:       number   // primo y utile (sotto la testatina)
  bottom:    number   // ultimo y utile (sopra il numero di pagina)
  headY:     number   // baseline della testatina
  footY:     number   // baseline del numero di pagina
}

function metrics(vp: Viewport): Metrics {
  const { w, h, insets } = vp
  // Scala: telefono ≈ 1, tablet fino a 1.45; contenuto mai più largo di ~34em.
  const s     = Math.max(0.86, Math.min(1.45, Math.min(w, h * 0.62) / 390))
  const side  = Math.max(insets.left, insets.right) + 30 * s
  const cw    = Math.min(w - side * 2, 560 * s)
  const x0    = (w - cw) / 2
  const headY = insets.top + 30 * s
  const footY = h - insets.bottom - 24 * s
  return { s, x0, cw, top: headY + 30 * s, bottom: footY - 30 * s, headY, footY }
}

// ── Testo ────────────────────────────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D

function font(style: string, size: number, family: string) {
  return `${style} ${size.toFixed(2)}px ${family}`
}

/** Larghezza di un testo con spaziatura lettere manuale (canvas letterSpacing
 *  non è affidabile su tutti i Safari). */
function spacedWidth(ctx: Ctx, text: string, spacing: number): number {
  if (!text) return 0
  return ctx.measureText(text).width + spacing * (Array.from(text).length - 1)
}

function drawSpaced(ctx: Ctx, text: string, x: number, y: number, spacing: number, align: 'left' | 'center' | 'right') {
  const total = spacedWidth(ctx, text, spacing)
  let cx = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total
  ctx.textAlign = 'left'
  for (const ch of Array.from(text)) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + spacing
  }
}

/** A capo per parole; le parole più larghe della riga vengono spezzate. */
function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split(/\r?\n/)) {
    const words = para.trim().split(/\s+/).filter(Boolean)
    if (!words.length) continue
    let line = ''
    for (const word of words) {
      const cand = line ? `${line} ${word}` : word
      if (ctx.measureText(cand).width <= maxW) { line = cand; continue }
      if (line) out.push(line)
      if (ctx.measureText(word).width <= maxW) { line = word; continue }
      // Parola più larga della riga: si spezza carattere per carattere.
      let chunk = ''
      for (const ch of Array.from(word)) {
        if (ctx.measureText(chunk + ch).width > maxW && chunk) { out.push(chunk); chunk = ch }
        else chunk += ch
      }
      line = chunk
    }
    if (line) out.push(line)
  }
  return out
}

const priceFmt = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function formatPrice(p: number | null): string {
  return p === null || p === undefined || isNaN(p) ? '' : `${priceFmt.format(p)} €`
}

// ── Blocchi ──────────────────────────────────────────────────────────────────

interface DishBlock {
  kind:      'dish'
  dish:      Dish
  nameLines: string[]
  price:     string
  descLines: string[]
  allergens: string
  /** Se il piatto è stato spezzato: righe di descrizione già usate. */
  descFrom:  number
  descTo:    number
  showHead:  boolean
}
interface CatBlock { kind: 'cat'; name: string; cont: boolean }
interface HeadBlock { kind: 'head' }
type Block = DishBlock | CatBlock | HeadBlock

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
}

// Misure verticali (in unità s).
const NAME_SIZE = 19.5, NAME_LH = 1.18
const DESC_SIZE = 16.5, DESC_LH = 1.28
const ALG_SIZE  = 9.5
const CAT_SIZE  = 11
const GAP_DISH  = 20, GAP_CAT_BEFORE = 30, GAP_CAT_AFTER = 18

export function layoutMenu(ctx: Ctx, data: MenuData, vp: Viewport): Layout {
  const m = metrics(vp)
  const s = m.s

  // ── Misura dei piatti
  ctx.font = font('600', NAME_SIZE * s, SERIF)
  const measureDish = (dish: Dish): DishBlock => {
    const price = formatPrice(dish.price)
    ctx.font = font('600', NAME_SIZE * s, SERIF)
    const priceW = price ? ctx.measureText(price).width + 22 * s : 0
    const nameLines = wrap(ctx, dish.name, m.cw - priceW)
    ctx.font = font('italic 400', DESC_SIZE * s, SERIF)
    const descLines = dish.description ? wrap(ctx, dish.description, m.cw - Math.max(priceW, 18 * s)) : []
    const allergens = dish.allergens?.length ? `ALLERGENI  ${dish.allergens.map(a => a.n).join(' · ')}` : ''
    return { kind: 'dish', dish, nameLines, price, descLines, allergens, descFrom: 0, descTo: descLines.length, showHead: true }
  }
  const dishHeight = (b: DishBlock) => {
    let hh = 0
    if (b.showHead) hh += b.nameLines.length * NAME_SIZE * NAME_LH * s
    const n = b.descTo - b.descFrom
    if (n) hh += 4 * s + n * DESC_SIZE * DESC_LH * s
    if (b.allergens && b.descTo === b.descLines.length) hh += 8 * s + ALG_SIZE * 1.4 * s
    return hh
  }
  const HEAD_H = 118 * s
  const CAT_H  = CAT_SIZE * 1.4 * s

  // ── Impaginazione
  const pages: Page[] = []
  let cur: Placed[] = []
  let y = m.top
  const newPage = () => { pages.push({ index: pages.length, items: cur, anchor: null }); cur = []; y = m.top }
  const room = () => m.bottom - y

  cur.push({ block: { kind: 'head' }, y, h: HEAD_H }); y += HEAD_H

  for (const cat of data.categories) {
    if (!cat.dishes.length) continue
    const dishes = cat.dishes.map(measureDish)
    // Titolo + primo piatto devono stare insieme.
    const firstH = dishes.length ? dishHeight(dishes[0]) : 0
    const before = cur.length && cur[cur.length - 1].block.kind !== 'head' ? GAP_CAT_BEFORE * s : 0
    if (before + CAT_H + GAP_CAT_AFTER * s + Math.min(firstH, m.bottom - m.top - CAT_H - GAP_CAT_AFTER * s) > room()) newPage()
    y += cur.length ? (cur[cur.length - 1].block.kind === 'head' ? 0 : GAP_CAT_BEFORE * s) : 0
    cur.push({ block: { kind: 'cat', name: cat.name, cont: false }, y, h: CAT_H }); y += CAT_H + GAP_CAT_AFTER * s

    for (let i = 0; i < dishes.length; i++) {
      let b = dishes[i]
      let h = dishHeight(b)
      const gap = cur.length && cur[cur.length - 1].block.kind === 'dish' ? GAP_DISH * s : 0
      if (gap + h <= room()) { y += gap; cur.push({ block: b, y, h }); y += h; continue }

      const full = m.bottom - m.top - CAT_H - GAP_CAT_AFTER * s
      if (h <= full) {
        newPage()
        cur.push({ block: { kind: 'cat', name: cat.name, cont: true }, y, h: CAT_H }); y += CAT_H + GAP_CAT_AFTER * s
        cur.push({ block: b, y, h }); y += h
        continue
      }
      // Piatto più alto di una pagina intera: si spezza tra le righe di descrizione.
      let from = 0
      while (from < b.descLines.length || from === 0) {
        if (room() < NAME_SIZE * 2 * s) {
          newPage()
          cur.push({ block: { kind: 'cat', name: cat.name, cont: true }, y, h: CAT_H }); y += CAT_H + GAP_CAT_AFTER * s
        } else y += gap
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
        cur.push({ block: { kind: 'cat', name: cat.name, cont: true }, y, h: CAT_H }); y += CAT_H + GAP_CAT_AFTER * s
      }
      b = dishes[i]
    }
  }
  if (cur.length) newPage()
  for (const p of pages) {
    const d = p.items.find(it => it.block.kind === 'dish')
    p.anchor = d ? (d.block as DishBlock).dish.id : null
  }

  // ── Grana della carta: rumore fisso, generato una volta.
  const grain = makeGrain()

  /** Disegna la pagina `index`; fuori dall'intervallo disegna carta vuota
   *  (es. la destra dell'ultima doppia pagina quando le pagine sono dispari). */
  const paint = (c: Ctx, index: number) => {
    const page = pages[index] as Page | undefined
    const { w, h } = vp
    // Carta: tinta calda, luce appena più chiara al centro, grana finissima.
    c.fillStyle = PAPER
    c.fillRect(0, 0, w, h)
    const g = c.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.hypot(w, h) * 0.62)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(232,224,208,0.35)')
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    if (grain) {
      const pat = c.createPattern(grain, 'repeat')
      if (pat) { c.globalAlpha = 0.05; c.fillStyle = pat; c.fillRect(0, 0, w, h); c.globalAlpha = 1 }
    }
    c.textBaseline = 'alphabetic'
    if (!page) return

    // Testatina (dalla seconda pagina) e numero di pagina.
    c.fillStyle = ACCENT
    c.font = font('500', 9.5 * s, SANS)
    if (index > 0) {
      drawSpaced(c, `${data.restaurantName} · ${data.menuName}`.toUpperCase(), w / 2, m.headY, 2.4 * s, 'center')
    }
    drawSpaced(c, `${index + 1}  /  ${pages.length}`, w / 2, m.footY, 1.6 * s, 'center')

    for (const it of page.items) {
      const b = it.block
      if (b.kind === 'head') paintHead(c, it.y)
      else if (b.kind === 'cat') paintCat(c, b, it.y)
      else paintDish(c, b, it.y)
    }
  }

  function paintHead(c: Ctx, top: number) {
    const cx = vp.w / 2
    c.fillStyle = ACCENT
    c.font = font('500', 10.5 * s, SANS)
    drawSpaced(c, data.restaurantName.toUpperCase(), cx, top + 14 * s, 3.4 * s, 'center')
    c.fillStyle = INK
    c.font = font('500', 38 * s, SERIF)
    // Nome del menu: se troppo largo, si riduce fino a starci.
    let size = 38 * s
    while (c.measureText(data.menuName).width > m.cw && size > 22 * s) { size -= 1; c.font = font('500', size, SERIF) }
    c.textAlign = 'center'
    c.fillText(data.menuName, cx, top + 60 * s)
    ornament(c, cx, top + 84 * s)
  }

  function ornament(c: Ctx, cx: number, cy: number) {
    c.strokeStyle = ACCENT_SOFT
    c.lineWidth = Math.max(0.6, 0.75 * s)
    c.beginPath()
    c.moveTo(cx - 46 * s, cy); c.lineTo(cx - 9 * s, cy)
    c.moveTo(cx + 9 * s, cy);  c.lineTo(cx + 46 * s, cy)
    c.stroke()
    c.fillStyle = ACCENT
    const r = 3.2 * s
    c.beginPath()
    c.moveTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy); c.closePath()
    c.fill()
  }

  function paintCat(c: Ctx, b: CatBlock, top: number) {
    const cx = m.x0 + m.cw / 2
    const base = top + CAT_SIZE * s
    c.font = font('600', CAT_SIZE * s, SANS)
    c.fillStyle = ACCENT
    const label = b.name.toUpperCase()
    const spacing = 2.8 * s
    const tw = spacedWidth(c, label, spacing)
    drawSpaced(c, label, cx, base, spacing, 'center')
    // Filetti ai lati del titolo.
    c.strokeStyle = ACCENT_SOFT
    c.lineWidth = Math.max(0.5, 0.7 * s)
    const ly = base - CAT_SIZE * s * 0.36
    const pad = 12 * s
    c.beginPath()
    c.moveTo(m.x0, ly); c.lineTo(cx - tw / 2 - pad, ly)
    c.moveTo(cx + tw / 2 + pad, ly); c.lineTo(m.x0 + m.cw, ly)
    c.stroke()
    if (b.cont) {
      c.font = font('italic 400', 12 * s, SERIF)
      c.fillStyle = ACCENT
      c.textAlign = 'center'
      c.fillText('segue', cx, base + 14 * s)
    }
  }

  function paintDish(c: Ctx, b: DishBlock, top: number) {
    let y = top
    const right = m.x0 + m.cw
    if (b.showHead) {
      c.font = font('600', NAME_SIZE * s, SERIF)
      c.fillStyle = INK
      b.nameLines.forEach((line, i) => {
        const base = y + NAME_SIZE * s * (0.92 + i * NAME_LH)
        c.textAlign = 'left'
        c.fillText(line, m.x0, base)
        if (i === 0 && b.price) {
          c.textAlign = 'right'
          c.fillText(b.price, right, base)
          // Puntini guida tra nome e prezzo, solo se c'è spazio vero.
          const from = m.x0 + c.measureText(line).width + 8 * s
          const to = right - c.measureText(b.price).width - 8 * s
          if (b.nameLines.length === 1 && to - from > 14 * s) {
            c.fillStyle = ACCENT_SOFT
            const step = 5 * s
            for (let x = Math.ceil(from / step) * step; x <= to; x += step) {
              c.beginPath(); c.arc(x, base - 1.2 * s, 0.75 * s, 0, Math.PI * 2); c.fill()
            }
            c.fillStyle = INK
          }
        }
      })
      y += b.nameLines.length * NAME_SIZE * NAME_LH * s
    }
    const n = b.descTo - b.descFrom
    if (n) {
      y += 4 * s
      c.font = font('italic 400', DESC_SIZE * s, SERIF)
      c.fillStyle = INK_SOFT
      c.textAlign = 'left'
      for (let i = b.descFrom; i < b.descTo; i++) {
        c.fillText(b.descLines[i], m.x0, y + DESC_SIZE * s * 0.95)
        y += DESC_SIZE * DESC_LH * s
      }
    }
    if (b.allergens && b.descTo === b.descLines.length) {
      y += 8 * s
      c.font = font('500', ALG_SIZE * s, SANS)
      c.fillStyle = ACCENT
      drawSpaced(c, b.allergens, m.x0, y + ALG_SIZE * s, 1.3 * s, 'left')
    }
  }

  // Il bersaglio del tocco è tutto il blocco del piatto, allargato di metà
  // dello spazio tra un piatto e l'altro (nessun buco tra due piatti vicini).
  const hit = (pageIndex: number, x: number, y: number): Dish | null => {
    const page = pages[pageIndex]
    if (!page || x < m.x0 - 16 * s || x > m.x0 + m.cw + 16 * s) return null
    const pad = (GAP_DISH * s) / 2
    for (const it of page.items) {
      if (it.block.kind !== 'dish') continue
      if (y >= it.y - pad && y <= it.y + it.h + pad) return it.block.dish
    }
    return null
  }

  return { vp, pages, paint, hit }
}

let _grain: HTMLCanvasElement | null = null
function makeGrain(): HTMLCanvasElement | null {
  if (_grain) return _grain
  if (typeof document === 'undefined') return null
  const g = document.createElement('canvas')
  g.width = g.height = 160
  const c = g.getContext('2d')
  if (!c) return null
  const img = c.createImageData(160, 160)
  let seed = 7
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647
    const v = 110 + (seed % 120)
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  c.putImageData(img, 0, 0)
  _grain = g
  return g
}
