// ─────────────────────────────────────────────────────────────────────────────
// Stile del nuovo menu (Lito), salvato in restaurants.menu_style (JSONB).
// NULL = stile base (l'aspetto di partenza del menu).
//
// Personalizzazione per elemento: ogni testo del menu (copertina, testatina,
// categorie, nome, prezzo, descrizione, allergeni, numeri di pagina, pagine di
// testo) ha il suo stile completo; poi carta, separatori, scheda del piatto,
// barra dei comandi ed effetto sfoglio. Ogni opzione ha un effetto reale.
// parseStyle accetta qualsiasi valore salvato (anche parziale o della prima
// versione) e riempie il resto con i valori base.
// ─────────────────────────────────────────────────────────────────────────────

// ── Caratteri ────────────────────────────────────────────────────────────────
// Catalogo con gli spessori (w) e i corsivi (i) che esistono DAVVERO per ogni
// famiglia (verificati su Google Fonts): il menu usa solo facce reali, mai
// grassetti o corsivi simulati dal browser.

export type FontCat = 'serif' | 'sans' | 'script'
export interface MenuFont { name: string; cat: FontCat; w: number[]; i: number[] }

export const FONTS: MenuFont[] = [
  { name: 'Cormorant Garamond', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Playfair Display', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'EB Garamond', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Lora', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Fraunces', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Bodoni Moda', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Cormorant', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Cormorant Infant', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Newsreader', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Literata', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Source Serif 4', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Crimson Pro', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Spectral', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Alegreya', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Libre Bodoni', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Gilda Display', cat: 'serif', w: [400], i: [] },
  { name: 'Petrona', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Gelasio', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Noto Serif Display', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Brygada 1918', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Instrument Serif', cat: 'serif', w: [400], i: [400] },
  { name: 'Young Serif', cat: 'serif', w: [400], i: [] },
  { name: 'DM Serif Display', cat: 'serif', w: [400], i: [400] },
  { name: 'Italiana', cat: 'serif', w: [400], i: [] },
  { name: 'Cinzel', cat: 'serif', w: [400, 500, 600, 700], i: [] },
  { name: 'Marcellus', cat: 'serif', w: [400], i: [] },
  { name: 'IBM Plex Serif', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Prata', cat: 'serif', w: [400], i: [] },
  { name: 'Old Standard TT', cat: 'serif', w: [400, 700], i: [400] },
  { name: 'Cardo', cat: 'serif', w: [400, 700], i: [400] },
  { name: 'Libre Caslon Text', cat: 'serif', w: [400, 700], i: [400] },
  { name: 'Libre Baskerville', cat: 'serif', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Forum', cat: 'serif', w: [400], i: [] },
  { name: 'Yeseva One', cat: 'serif', w: [400], i: [] },
  { name: 'Abril Fatface', cat: 'serif', w: [400], i: [] },
  { name: 'Inter', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Montserrat', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Josefin Sans', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Raleway', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Jost', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Work Sans', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'DM Sans', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Poppins', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Nunito Sans', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Figtree', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Plus Jakarta Sans', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Karla', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Outfit', cat: 'sans', w: [400, 500, 600, 700], i: [] },
  { name: 'Manrope', cat: 'sans', w: [400, 500, 600, 700], i: [] },
  { name: 'Lexend', cat: 'sans', w: [400, 500, 600, 700], i: [] },
  { name: 'Urbanist', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Sora', cat: 'sans', w: [400, 500, 600, 700], i: [] },
  { name: 'Red Hat Display', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Archivo', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Barlow', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'IBM Plex Sans', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Inter Tight', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Lato', cat: 'sans', w: [400, 700], i: [400] },
  { name: 'Open Sans', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Mulish', cat: 'sans', w: [400, 500, 600, 700], i: [400, 500, 600] },
  { name: 'Quicksand', cat: 'sans', w: [400, 500, 600, 700], i: [] },
  { name: 'Space Grotesk', cat: 'sans', w: [400, 500, 600, 700], i: [] },
  { name: 'Syne', cat: 'sans', w: [400, 500, 600, 700], i: [] },
  { name: 'Tenor Sans', cat: 'sans', w: [400], i: [] },
  { name: 'Oswald', cat: 'sans', w: [400, 500, 600, 700], i: [] },
  { name: 'League Spartan', cat: 'sans', w: [400, 500, 600, 700], i: [] },
  { name: 'Bebas Neue', cat: 'sans', w: [400], i: [] },
  { name: 'Anton', cat: 'sans', w: [400], i: [] },
  { name: 'Caveat', cat: 'script', w: [400, 500, 600, 700], i: [] },
  { name: 'Dancing Script', cat: 'script', w: [400, 500, 600, 700], i: [] },
  { name: 'Great Vibes', cat: 'script', w: [400], i: [] },
  { name: 'Allura', cat: 'script', w: [400], i: [] },
  { name: 'Pinyon Script', cat: 'script', w: [400], i: [] },
  { name: 'Parisienne', cat: 'script', w: [400], i: [] },
  { name: 'Sacramento', cat: 'script', w: [400], i: [] },
  { name: 'Amatic SC', cat: 'script', w: [400, 700], i: [] },
]

export const FONT_CATS: { cat: FontCat; label: string }[] = [
  { cat: 'serif', label: 'Con grazie' }, { cat: 'sans', label: 'Senza grazie' }, { cat: 'script', label: 'Calligrafici' },
]

const FALLBACK: Record<FontCat, string> = {
  serif: 'Georgia, serif', sans: '-apple-system, "Helvetica Neue", Arial, sans-serif', script: 'cursive',
}

// ── Caratteri caricati dal ristoratore ───────────────────────────────────────
// Una famiglia con le sue facce: un file per ogni spessore/corsivo (Aurel
// Light, Aurel Bold Italic…). Nello stile il carattere si chiama
// "custom:<id>"; nel browser la famiglia è "lito-<id>" (nessun conflitto con
// i nomi del catalogo). Il nome scelto dal ristoratore serve da etichetta.

export interface CustomFace { url: string; weight: number; italic: boolean }
export interface CustomFont { id: string; name: string; cat: FontCat; faces: CustomFace[] }
export const CUSTOM_PREFIX = 'custom:'
export const isCustomFont = (name: string) => name.startsWith(CUSTOM_PREFIX)
export const customFamily = (id: string) => `lito-${id}`
// Registro dei caratteri caricati incontrati (parseStyle li registra): serve
// a fontInfo/fontStack, che non ricevono lo stile.
const CUSTOM = new Map<string, MenuFont & { label: string }>()
/** Spessori in tondo (w) e in corsivo (i) di una famiglia caricata. */
export function customWeights(f: CustomFont): { w: number[]; i: number[] } {
  const uniq = (xs: number[]) => Array.from(new Set(xs)).sort((a, b) => a - b)
  const w = uniq(f.faces.filter(x => !x.italic).map(x => x.weight))
  const i = uniq(f.faces.filter(x => x.italic).map(x => x.weight))
  // Solo corsivi: il "tondo" usa gli stessi file (resta sempre almeno uno spessore).
  return { w: w.length ? w : i.length ? i : [400], i }
}
function registerCustom(f: CustomFont) {
  CUSTOM.set(CUSTOM_PREFIX + f.id, { name: CUSTOM_PREFIX + f.id, label: f.name, cat: f.cat, ...customWeights(f) })
}
/** Registra i caratteri caricati (fontInfo/fontStack/fontLabel li riconoscono). */
export const registerCustomFonts = (list: CustomFont[]) => list.forEach(registerCustom)

export const fontInfo = (name: string): MenuFont =>
  FONTS.find(f => f.name === name) ?? CUSTOM.get(name) ?? FONTS[0]
/** Nome da mostrare (per i caratteri caricati, quello scelto dal ristoratore). */
export const fontLabel = (name: string) => CUSTOM.get(name)?.label ?? name
/** Pila CSS/canvas per una famiglia ("Nome", riserve). */
export const fontStack = (name: string) =>
  `"${isCustomFont(name) ? customFamily(name.slice(CUSTOM_PREFIX.length)) : name}", ${FALLBACK[fontInfo(name).cat]}`

/** Faccia reale più vicina a quella chiesta (spessore e corsivo). */
export function resolveFace(name: string, weight: number, italic: boolean): { weight: number; italic: boolean } {
  const f = fontInfo(name)
  const it = italic && f.i.length > 0
  const list = it ? f.i : f.w
  const w = list.reduce((best, x) => (Math.abs(x - weight) < Math.abs(best - weight) ? x : best), list[0])
  return { weight: w, italic: it }
}

// ── Stile ────────────────────────────────────────────────────────────────────

/** Colore: uno dei colori della carta ('ink' testo, 'soft' testo secondario,
 *  'accent') oppure un colore libero #rrggbb. */
export type ColorRef = 'ink' | 'soft' | 'accent' | string
/** Spessori: 400–700 nel catalogo; i caratteri caricati possono avere anche
 *  100–300 (sottili) e 800–900 (nerissimi). */
export type Weight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
export const WEIGHTS: Weight[] = [100, 200, 300, 400, 500, 600, 700, 800, 900]

export interface TextStyle {
  font:     string
  size:     number    // px a scala 1
  weight:   Weight
  italic:   boolean
  color:    ColorRef
  upper:    boolean   // tutto maiuscolo
  tracking: number    // spaziatura tra le lettere, in em (0 – 0.5)
}

export const ORNAMENTS = [
  'diamond', 'star', 'circle', 'cross', 'leaf', 'flourish', 'asterism', 'line', 'double', 'wave', 'dots', 'none',
] as const
export type Ornament = typeof ORNAMENTS[number]
export type Divider = 'none' | 'line' | 'short' | 'dots' | 'ornament'

/** Sfondo delle pagine (immagine caricata dal ristoratore). */
export interface PageBackground {
  url:     string | null
  opacity: number                         // 0.05 – 1
  fit:     'cover' | 'tile'
  pages:   'all' | 'first' | 'others'
}

export interface MenuStyle {
  version: 2
  page: {
    paper: string; ink: string; soft: string; accent: string
    texture: 'none' | 'grain' | 'linen'
    textureStrength: number   // 0 – 1
    light: number             // luce al centro e bordi più scuri: 0 – 1
    margin: number            // margine laterale (px): 12 – 64
    marginV: number           // margine in alto e in basso (px): 14 – 70
    maxWidth: number          // larghezza massima del testo (px): 340 – 760
    scale: number             // scala generale dei testi: 0.8 – 1.3
    background: PageBackground
  }
  head: {
    showRestaurant: boolean
    restaurant: TextStyle
    title: TextStyle
    titleGap: number          // spazio in più tra nome del ristorante e titolo: -10 – 40
    ornament: Ornament
    ornamentSize: number      // 0.6 – 2
    ornamentGap: number       // distanza tra titolo e ornamento: 10 – 60
    space: number             // spazio sotto il titolo prima dei piatti: 0 – 80
  }
  runningHead: { show: boolean; content: 'both' | 'restaurant' | 'menu'; text: TextStyle }
  category: {
    text: TextStyle
    style: 'rules' | 'ornament' | 'underline' | 'frame' | 'plain'
    ornament: Ornament        // quello sotto il titolo, con lo stile 'ornament'
    align: 'center' | 'left'
    before: number            // spazio prima: 0 – 80
    after: number             // spazio dopo: 0 – 60
    continued: boolean        // "segue" quando la categoria continua
  }
  dish: {
    align: 'left' | 'center'
    spacing: number           // spazio tra i piatti: 0 – 60
    divider: Divider
    dividerOrnament: Ornament // con il separatore 'ornament'
    name: TextStyle
    nameLineHeight: number    // 1 – 1.6
    description: TextStyle
    descGap: number           // spazio tra nome e descrizione: 0 – 24
    descLineHeight: number    // 1.05 – 1.8
    descWidth: number         // quota della colonna: 0.55 – 1
    allergenGap: number       // spazio prima degli allergeni: 0 – 30
    price: TextStyle
    pricePosition: 'right' | 'below' | 'inline'
    priceGap: number          // spazio tra nome e prezzo (sotto o in riga): 0 – 30
    leader: 'dots' | 'line' | 'none'
    priceSymbol: 'after' | 'before' | 'none'
    priceDecimals: 'always' | 'auto'   // auto: 12 invece di 12,00 (12,50 resta)
  }
  allergens: { show: boolean; label: boolean; text: TextStyle }
  pageNumber: { show: boolean; format: 'of' | 'plain' | 'dashes'; text: TextStyle }
  textPages: { title: TextStyle; body: TextStyle; lineHeight: number; paraGap: number }   // 0.85 – 1.4, 0 – 30
  card: {
    photo: 'square' | 'landscape' | 'portrait' | 'circle'
    photoWidth: number        // % della larghezza: 50 – 100
    radius: number            // angoli della foto: 0 – 32
    titleSize: number         // 22 – 48
    glass: number             // trasparenza della scheda: 0 (piena) – 1 (molto trasparente)
    showCategory: boolean
    showSummary: boolean      // riquadro prezzo/allergeni
    showMore: boolean         // "Altro in …"
  }
  chrome: { tint: 'light' | 'dark'; peek: boolean; hints: boolean }
  effects: { shadow: number; speed: number }   // ombre dello sfoglio 0 – 1.6, velocità 0.6 – 1.6
  customFonts: CustomFont[]
}

const T = (font: string, size: number, weight: Weight, color: ColorRef, o: Partial<TextStyle> = {}): TextStyle =>
  ({ font, size, weight, italic: false, color, upper: false, tracking: 0, ...o })

const SERIF = 'Cormorant Garamond', SANS = 'Inter'

export const DEFAULT_STYLE: MenuStyle = {
  version: 2,
  page: { paper: '#fbf8f2', ink: '#1d1915', soft: '#5f574d', accent: '#9a8462', texture: 'grain', textureStrength: 0.4, light: 1, margin: 30, marginV: 30, maxWidth: 560, scale: 1,
    background: { url: null, opacity: 0.35, fit: 'cover', pages: 'all' } },
  head: {
    showRestaurant: true,
    restaurant: T(SANS, 10.5, 500, 'accent', { upper: true, tracking: 0.32 }),
    title: T(SERIF, 38, 500, 'ink'),
    titleGap: 0,
    ornament: 'diamond',
    ornamentSize: 1,
    ornamentGap: 24,
    space: 0,
  },
  runningHead: { show: true, content: 'both', text: T(SANS, 9.5, 500, 'accent', { upper: true, tracking: 0.25 }) },
  category: { text: T(SANS, 11, 600, 'accent', { upper: true, tracking: 0.25 }), style: 'rules', ornament: 'diamond', align: 'center', before: 30, after: 18, continued: true },
  dish: {
    align: 'left', spacing: 20, divider: 'none', dividerOrnament: 'diamond',
    name: T(SERIF, 19.5, 600, 'ink'), nameLineHeight: 1.18,
    description: T(SERIF, 16.5, 400, 'soft', { italic: true }),
    descGap: 4, descLineHeight: 1.28, descWidth: 1, allergenGap: 8,
    price: T(SERIF, 19.5, 600, 'ink'),
    pricePosition: 'right', priceGap: 2, leader: 'dots', priceSymbol: 'after', priceDecimals: 'always',
  },
  allergens: { show: true, label: true, text: T(SANS, 9.5, 500, 'accent', { upper: true, tracking: 0.14 }) },
  pageNumber: { show: true, format: 'of', text: T(SANS, 9.5, 500, 'accent', { tracking: 0.17 }) },
  textPages: { title: T(SERIF, 25, 500, 'ink'), body: T(SERIF, 16.5, 400, 'ink'), lineHeight: 1, paraGap: 6 },
  card: { photo: 'square', photoWidth: 84, radius: 14, titleSize: 34, glass: 0.5, showCategory: true, showSummary: true, showMore: true },
  chrome: { tint: 'light', peek: true, hints: true },
  effects: { shadow: 1, speed: 1 },
  customFonts: [],
}

// ── Lettura (con valori base e controlli) ────────────────────────────────────

type Raw = Record<string, unknown>
const obj = (v: unknown): Raw => (v && typeof v === 'object' ? (v as Raw) : {})
const HEX = /^#[0-9a-f]{6}$/i
const pick = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (opts.includes(v as T) ? (v as T) : d)
const num = (v: unknown, min: number, max: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : d
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
const hex = (v: unknown, d: string) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : d)
const colorRef = (v: unknown, d: ColorRef): ColorRef =>
  v === 'ink' || v === 'soft' || v === 'accent' ? v : typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : d

function text(v: unknown, d: TextStyle, custom: Set<string>): TextStyle {
  const r = obj(v)
  const font = typeof r.font === 'string' && (FONTS.some(f => f.name === r.font) || custom.has(r.font)) ? r.font : d.font
  return {
    font,
    size:     num(r.size, 6, 80, d.size),
    weight:   WEIGHTS.includes(r.weight as Weight) ? (r.weight as Weight) : d.weight,
    italic:   bool(r.italic, d.italic),
    color:    colorRef(r.color, d.color),
    upper:    bool(r.upper, d.upper),
    tracking: num(r.tracking, 0, 0.5, d.tracking),
  }
}

export function parseStyle(raw: unknown): MenuStyle {
  const r0 = obj(raw)
  const r = r0.version === 2 ? r0 : fromV1(r0)
  const d = DEFAULT_STYLE
  const pg = obj(r.page), hd = obj(r.head), rh = obj(r.runningHead), ct = obj(r.category), ds = obj(r.dish)
  const al = obj(r.allergens), pn = obj(r.pageNumber), tp = obj(r.textPages), cd = obj(r.card), ch = obj(r.chrome), ef = obj(r.effects)
  const bg = obj(pg.background)
  // Caratteri caricati: prima si leggono (e si registrano), poi i testi che li usano.
  const isUrl = (u: unknown): u is string => typeof u === 'string' && /^https:\/\//.test(u)
  const customFonts: CustomFont[] = (Array.isArray(r.customFonts) ? r.customFonts : [])
    .map(obj)
    .filter(f => typeof f.id === 'string' && /^[a-z0-9-]{1,40}$/i.test(f.id))
    .map(f => {
      // Prima versione: un solo file (url) = faccia normale.
      const rawFaces = Array.isArray(f.faces) ? f.faces.map(obj) : isUrl(f.url) ? [{ url: f.url, weight: 400, italic: false }] : []
      const faces: CustomFace[] = rawFaces
        .filter(x => isUrl(x.url))
        .slice(0, 18)
        .map(x => ({
          url: x.url as string,
          weight: WEIGHTS.includes(x.weight as Weight) ? (x.weight as number) : 400,
          italic: bool(x.italic, false),
        }))
      return {
        id: f.id as string, faces,
        name: typeof f.name === 'string' && f.name.trim() ? f.name.trim().slice(0, 40) : 'Carattere',
        cat: pick(f.cat, ['serif', 'sans', 'script'] as const, 'serif'),
      }
    })
    .filter(f => f.faces.length > 0)
    .slice(0, 30)
  customFonts.forEach(registerCustom)
  const custom = new Set(customFonts.map(f => CUSTOM_PREFIX + f.id))
  const tx = (v: unknown, dd: TextStyle) => text(v, dd, custom)
  const orn = (v: unknown, dd: Ornament) => pick(v, ORNAMENTS, dd)
  // Formato del prezzo della versione precedente (un solo campo).
  const oldFmt = ds.priceFormat
  return {
    version: 2,
    page: {
      paper: hex(pg.paper, d.page.paper), ink: hex(pg.ink, d.page.ink), soft: hex(pg.soft, d.page.soft), accent: hex(pg.accent, d.page.accent),
      texture: pick(pg.texture, ['none', 'grain', 'linen'] as const, d.page.texture),
      textureStrength: num(pg.textureStrength, 0, 1, d.page.textureStrength),
      light: num(pg.light, 0, 1, d.page.light),
      margin: num(pg.margin, 12, 64, d.page.margin),
      marginV: num(pg.marginV, 14, 70, d.page.marginV),
      maxWidth: num(pg.maxWidth, 340, 760, d.page.maxWidth),
      scale: num(pg.scale, 0.8, 1.3, d.page.scale),
      background: {
        url: typeof bg.url === 'string' && /^https:\/\//.test(bg.url) ? bg.url : null,
        opacity: num(bg.opacity, 0.05, 1, d.page.background.opacity),
        fit: pick(bg.fit, ['cover', 'tile'] as const, d.page.background.fit),
        pages: pick(bg.pages, ['all', 'first', 'others'] as const, d.page.background.pages),
      },
    },
    head: {
      showRestaurant: bool(hd.showRestaurant, d.head.showRestaurant),
      restaurant: tx(hd.restaurant, d.head.restaurant),
      title: tx(hd.title, d.head.title),
      titleGap: num(hd.titleGap, -10, 40, d.head.titleGap),
      ornament: orn(hd.ornament, d.head.ornament),
      ornamentSize: num(hd.ornamentSize, 0.6, 2, d.head.ornamentSize),
      ornamentGap: num(hd.ornamentGap, 10, 60, d.head.ornamentGap),
      space: num(hd.space, 0, 80, d.head.space),
    },
    runningHead: {
      show: bool(rh.show, d.runningHead.show),
      content: pick(rh.content, ['both', 'restaurant', 'menu'] as const, d.runningHead.content),
      text: tx(rh.text, d.runningHead.text),
    },
    category: {
      text: tx(ct.text, d.category.text),
      style: pick(ct.style, ['rules', 'ornament', 'underline', 'frame', 'plain'] as const, d.category.style),
      ornament: orn(ct.ornament, d.category.ornament),
      align: pick(ct.align, ['center', 'left'] as const, d.category.align),
      before: num(ct.before, 0, 80, d.category.before),
      after: num(ct.after, 0, 60, d.category.after),
      continued: bool(ct.continued, d.category.continued),
    },
    dish: {
      align: pick(ds.align, ['left', 'center'] as const, d.dish.align),
      spacing: num(ds.spacing, 0, 60, d.dish.spacing),
      divider: pick(ds.divider, ['none', 'line', 'short', 'dots', 'ornament'] as const, d.dish.divider),
      dividerOrnament: orn(ds.dividerOrnament, d.dish.dividerOrnament),
      name: tx(ds.name, d.dish.name),
      nameLineHeight: num(ds.nameLineHeight, 1, 1.6, d.dish.nameLineHeight),
      description: tx(ds.description, d.dish.description),
      descGap: num(ds.descGap, 0, 24, d.dish.descGap),
      descLineHeight: num(ds.descLineHeight, 1.05, 1.8, d.dish.descLineHeight),
      descWidth: num(ds.descWidth, 0.55, 1, d.dish.descWidth),
      allergenGap: num(ds.allergenGap, 0, 30, d.dish.allergenGap),
      price: tx(ds.price, d.dish.price),
      pricePosition: pick(ds.pricePosition, ['right', 'below', 'inline'] as const, d.dish.pricePosition),
      priceGap: num(ds.priceGap, 0, 30, d.dish.priceGap),
      leader: pick(ds.leader, ['dots', 'line', 'none'] as const, d.dish.leader),
      priceSymbol: pick(ds.priceSymbol, ['after', 'before', 'none'] as const,
        oldFmt === 'euro-before' ? 'before' : oldFmt === 'number' ? 'none' : d.dish.priceSymbol),
      priceDecimals: pick(ds.priceDecimals, ['always', 'auto'] as const, oldFmt === 'compact' ? 'auto' : d.dish.priceDecimals),
    },
    allergens: { show: bool(al.show, d.allergens.show), label: bool(al.label, d.allergens.label), text: tx(al.text, d.allergens.text) },
    pageNumber: {
      show: bool(pn.show, d.pageNumber.show),
      format: pick(pn.format, ['of', 'plain', 'dashes'] as const, d.pageNumber.format),
      text: tx(pn.text, d.pageNumber.text),
    },
    textPages: {
      title: tx(tp.title, d.textPages.title), body: tx(tp.body, d.textPages.body),
      lineHeight: num(tp.lineHeight, 0.85, 1.4, d.textPages.lineHeight),
      paraGap: num(tp.paraGap, 0, 30, d.textPages.paraGap),
    },
    card: {
      photo: pick(cd.photo, ['square', 'landscape', 'portrait', 'circle'] as const, d.card.photo),
      photoWidth: num(cd.photoWidth, 50, 100, d.card.photoWidth),
      radius: num(cd.radius, 0, 32, d.card.radius),
      titleSize: num(cd.titleSize, 22, 48, d.card.titleSize),
      glass: num(cd.glass, 0, 1, d.card.glass),
      showCategory: bool(cd.showCategory, d.card.showCategory),
      showSummary: bool(cd.showSummary, d.card.showSummary),
      showMore: bool(cd.showMore, d.card.showMore),
    },
    chrome: { tint: pick(ch.tint, ['light', 'dark'] as const, d.chrome.tint), peek: bool(ch.peek, d.chrome.peek), hints: bool(ch.hints, d.chrome.hints) },
    effects: { shadow: num(ef.shadow, 0, 1.6, d.effects.shadow), speed: num(ef.speed, 0.6, 1.6, d.effects.speed) },
    customFonts,
  }
}

/** Prima versione (colori/caratteri/layout in tre gruppi) → seconda. */
function fromV1(r: Raw): Raw {
  if (!r.colors && !r.fonts && !r.layout) return r
  const c = obj(r.colors), f = obj(r.fonts), l = obj(r.layout), d = DEFAULT_STYLE
  const disp = typeof f.display === 'string' ? f.display : undefined
  const txt = typeof f.text === 'string' ? f.text : undefined
  const det = typeof f.details === 'string' ? f.details : undefined
  const withFont = (t: TextStyle, font?: string) => (font ? { ...t, font } : t)
  const center = l.align === 'center'
  return {
    version: 2,
    page: { ...d.page, paper: c.paper ?? d.page.paper, ink: c.ink ?? d.page.ink, accent: c.accent ?? d.page.accent, scale: l.textScale ?? 1 },
    head: { ...d.head, restaurant: withFont(d.head.restaurant, det), title: withFont(d.head.title, disp) },
    runningHead: { ...d.runningHead, text: withFont(d.runningHead.text, det) },
    category: {
      ...d.category, text: withFont(d.category.text, det),
      style: l.category === 'ornament' ? 'ornament' : l.category === 'plain' ? 'plain' : 'rules',
    },
    dish: {
      ...d.dish, align: center ? 'center' : 'left', spacing: l.dishSpacing ?? d.dish.spacing,
      name: withFont(d.dish.name, disp), price: withFont(d.dish.price, disp),
      description: { ...withFont(d.dish.description, txt), italic: l.italicDescriptions !== false },
      pricePosition: center || l.price === 'below' ? 'below' : 'right',
      leader: l.price === 'plain' ? 'none' : 'dots',
    },
    allergens: { ...d.allergens, show: l.showAllergens !== false, text: withFont(d.allergens.text, det) },
    pageNumber: { ...d.pageNumber, show: l.pageNumbers !== false, text: withFont(d.pageNumber.text, det) },
    textPages: { title: withFont(d.textPages.title, disp), body: withFont(d.textPages.body, txt) },
  }
}

// ── Uso ──────────────────────────────────────────────────────────────────────

/** Tutti gli stili di testo del menu (per caricare solo le facce usate). */
export function textStyles(st: MenuStyle): TextStyle[] {
  return [
    st.head.restaurant, st.head.title, st.runningHead.text, st.category.text,
    st.dish.name, st.dish.description, st.dish.price, st.allergens.text, st.pageNumber.text,
    st.textPages.title, st.textPages.body,
    // Pagine di testo: sottotitoli e corsivi del corpo.
    { ...st.textPages.title, weight: 500 }, { ...st.textPages.body, italic: true }, { ...st.textPages.body, weight: 600 },
    // "Segue" delle categorie (corsivo del carattere delle descrizioni).
    { ...st.dish.description, italic: true, weight: 400 },
    // Scheda del piatto: nomi in tondo, testi minori nel carattere degli allergeni.
    { ...st.dish.name, italic: false }, { ...st.allergens.text, weight: 400, italic: false }, { ...st.allergens.text, weight: 600, italic: false },
  ]
}

/** Foglio di stile con le sole facce usate, dal nostro proxy (mai Google). */
export function styleFontsUrl(st: MenuStyle): string {
  const fams = new Map<string, Set<string>>()
  for (const t of textStyles(st)) {
    if (isCustomFont(t.font)) continue   // caricati dal ristoratore: FontFace (loadStyleAssets)
    const face = resolveFace(t.font, t.weight, t.italic)
    if (!fams.has(t.font)) fams.set(t.font, new Set())
    fams.get(t.font)!.add(`${face.italic ? 1 : 0},${face.weight}`)
  }
  const q = Array.from(fams).map(([n, set]) => {
    const tuples = Array.from(set).sort((a, b) => (a < b ? -1 : 1)).join(';')
    return `family=${encodeURIComponent(n).replace(/%20/g, '+')}:ital,wght@${tuples}`
  }).join('&')
  return q ? `/api/gfonts/css2?${q}&display=block` : ''
}

/** Facce da caricare prima di impaginare (le misure dipendono dal font reale). */
export function styleFaces(st: MenuStyle): string[] {
  const out = new Set<string>()
  for (const t of textStyles(st)) {
    const f = resolveFace(t.font, t.weight, t.italic)
    out.add(`${f.italic ? 'italic ' : ''}${f.weight} 20px ${fontStack(t.font)}`)
  }
  return Array.from(out)
}

/** Mescola due colori #rrggbb (t = quota di b). */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t)
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}

/** Colore effettivo di un riferimento. */
export function resolveColor(ref: ColorRef, st: MenuStyle): string {
  return ref === 'ink' ? st.page.ink : ref === 'soft' ? st.page.soft : ref === 'accent' ? st.page.accent : ref
}

/** Stringa font canvas/CSS di uno stile di testo (faccia reale, px = size × scala). */
export function cssFont(t: TextStyle, scale = 1): string {
  const f = resolveFace(t.font, t.weight, t.italic)
  return `${f.italic ? 'italic ' : ''}${f.weight} ${(t.size * scale).toFixed(2)}px ${fontStack(t.font)}`
}

/** Prezzo nel formato scelto: simbolo dopo/prima/nessuno, decimali sempre
 *  o solo quando servono (12 invece di 12,00; 12,50 resta). */
export function formatPrice(p: number | null, symbol: MenuStyle['dish']['priceSymbol'], decimals: MenuStyle['dish']['priceDecimals']): string {
  if (p === null || p === undefined || Number.isNaN(p)) return ''
  const whole = Math.round(p * 100) % 100 === 0
  const n = new Intl.NumberFormat('it-IT', { minimumFractionDigits: decimals === 'auto' && whole ? 0 : 2, maximumFractionDigits: 2 }).format(p)
  return symbol === 'before' ? `€ ${n}` : symbol === 'none' ? n : `${n} €`
}
