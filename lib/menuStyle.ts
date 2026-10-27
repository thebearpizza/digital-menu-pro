// ─────────────────────────────────────────────────────────────────────────────
// Stile del nuovo menu (Lito): colori, caratteri, layout delle pagine.
// Salvato in restaurants.menu_style (JSONB); NULL = stile base.
//
// Condiviso da menu pubblico e Personalizzazione. Ogni opzione qui ha un
// effetto reale sul menu: niente impostazioni che non fanno nulla.
// parseStyle accetta qualsiasi valore salvato (anche parziale o vecchio) e
// riempie il resto con i valori base.
// ─────────────────────────────────────────────────────────────────────────────

export type Align = 'left' | 'center'
export type PriceStyle = 'dots' | 'plain' | 'below'
export type CategoryStyle = 'rules' | 'plain' | 'ornament'

export interface MenuStyle {
  colors: {
    paper:  string   // carta delle pagine
    ink:    string   // testo
    accent: string   // dettagli: categorie, ornamenti, allergeni, numeri
  }
  fonts: {
    display: string  // nomi dei piatti, titoli
    text:    string  // descrizioni, pagine di testo
    details: string  // categorie, allergeni, testatina, numeri di pagina
  }
  layout: {
    align:              Align
    textScale:          number   // 0.85 – 1.25
    dishSpacing:        number   // spazio tra i piatti (px a scala 1): 8 – 44
    price:              PriceStyle
    category:           CategoryStyle
    italicDescriptions: boolean
    showAllergens:      boolean
    pageNumbers:        boolean
  }
}

export const DEFAULT_STYLE: MenuStyle = {
  colors: { paper: '#fbf8f2', ink: '#1d1915', accent: '#9a8462' },
  fonts: { display: 'Cormorant Garamond', text: 'Cormorant Garamond', details: 'Inter' },
  layout: {
    align: 'left', textScale: 1, dishSpacing: 20, price: 'dots', category: 'rules',
    italicDescriptions: true, showAllergens: true, pageNumbers: true,
  },
}

// ── Caratteri ────────────────────────────────────────────────────────────────
// Lista curata: famiglie che hanno davvero gli spessori e i corsivi usati dal
// menu (400, 500, 600 e corsivo 400/500 per titoli e testi; 400–600 per i
// dettagli). Con una famiglia a caso, uno spessore mancante cambierebbe
// l'aspetto o farebbe fallire il caricamento.

export interface MenuFont { name: string; kind: 'serif' | 'sans'; fallback: string }

export const DISPLAY_FONTS: MenuFont[] = [
  { name: 'Cormorant Garamond', kind: 'serif', fallback: 'Georgia, serif' },
  { name: 'Playfair Display',   kind: 'serif', fallback: 'Georgia, serif' },
  { name: 'EB Garamond',        kind: 'serif', fallback: 'Georgia, serif' },
  { name: 'Lora',               kind: 'serif', fallback: 'Georgia, serif' },
  { name: 'Fraunces',           kind: 'serif', fallback: 'Georgia, serif' },
  { name: 'Bodoni Moda',        kind: 'serif', fallback: 'Georgia, serif' },
  { name: 'Montserrat',         kind: 'sans',  fallback: '-apple-system, Arial, sans-serif' },
  { name: 'Josefin Sans',       kind: 'sans',  fallback: '-apple-system, Arial, sans-serif' },
  { name: 'Raleway',            kind: 'sans',  fallback: '-apple-system, Arial, sans-serif' },
  { name: 'Jost',               kind: 'sans',  fallback: '-apple-system, Arial, sans-serif' },
  { name: 'Work Sans',          kind: 'sans',  fallback: '-apple-system, Arial, sans-serif' },
]
export const TEXT_FONTS: MenuFont[] = DISPLAY_FONTS
export const DETAIL_FONTS: MenuFont[] = [
  { name: 'Inter',        kind: 'sans', fallback: '-apple-system, Arial, sans-serif' },
  { name: 'Montserrat',   kind: 'sans', fallback: '-apple-system, Arial, sans-serif' },
  { name: 'Josefin Sans', kind: 'sans', fallback: '-apple-system, Arial, sans-serif' },
  { name: 'Raleway',      kind: 'sans', fallback: '-apple-system, Arial, sans-serif' },
  { name: 'Jost',         kind: 'sans', fallback: '-apple-system, Arial, sans-serif' },
  { name: 'Work Sans',    kind: 'sans', fallback: '-apple-system, Arial, sans-serif' },
  { name: 'Cormorant Garamond', kind: 'serif', fallback: 'Georgia, serif' },
]

const ALL_FONTS = [...DISPLAY_FONTS, ...DETAIL_FONTS]

/** Pila CSS/canvas per una famiglia ("Nome", riserve). */
export function fontStack(name: string): string {
  const f = ALL_FONTS.find(x => x.name === name)
  return `"${name}", ${f?.fallback ?? 'Georgia, serif'}`
}

/** Foglio di stile dei caratteri dello stile, dal nostro proxy (mai Google). */
export function styleFontsUrl(st: MenuStyle): string {
  const rich = 'ital,wght@0,400;0,500;0,600;1,400;1,500'
  const fams = new Map<string, string>()
  fams.set(st.fonts.display, rich)
  fams.set(st.fonts.text, rich)
  if (!fams.has(st.fonts.details)) fams.set(st.fonts.details, 'wght@400;500;600')
  const q = Array.from(fams).map(([n, axes]) => `family=${encodeURIComponent(n).replace(/%20/g, '+')}:${axes}`).join('&')
  return `/api/gfonts/css2?${q}&display=block`
}

// ── Lettura (con valori base e controlli) ────────────────────────────────────

const HEX = /^#[0-9a-f]{6}$/i
const pick = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (opts.includes(v as T) ? (v as T) : d)
const num = (v: unknown, min: number, max: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : d
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
const color = (v: unknown, d: string) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : d)
const font = (v: unknown, list: MenuFont[], d: string) => (list.some(f => f.name === v) ? (v as string) : d)

export function parseStyle(raw: unknown): MenuStyle {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, Record<string, unknown> | undefined>
  const c = r.colors ?? {}, f = r.fonts ?? {}, l = r.layout ?? {}
  const d = DEFAULT_STYLE
  return {
    colors: { paper: color(c.paper, d.colors.paper), ink: color(c.ink, d.colors.ink), accent: color(c.accent, d.colors.accent) },
    fonts: {
      display: font(f.display, DISPLAY_FONTS, d.fonts.display),
      text:    font(f.text, TEXT_FONTS, d.fonts.text),
      details: font(f.details, DETAIL_FONTS, d.fonts.details),
    },
    layout: {
      align:              pick(l.align, ['left', 'center'] as const, d.layout.align),
      textScale:          num(l.textScale, 0.85, 1.25, d.layout.textScale),
      dishSpacing:        num(l.dishSpacing, 8, 44, d.layout.dishSpacing),
      price:              pick(l.price, ['dots', 'plain', 'below'] as const, d.layout.price),
      category:           pick(l.category, ['rules', 'plain', 'ornament'] as const, d.layout.category),
      italicDescriptions: bool(l.italicDescriptions, d.layout.italicDescriptions),
      showAllergens:      bool(l.showAllergens, d.layout.showAllergens),
      pageNumbers:        bool(l.pageNumbers, d.layout.pageNumbers),
    },
  }
}

// ── Colori derivati ──────────────────────────────────────────────────────────

/** Mescola due colori #rrggbb (t = quota di b). */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t)
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}

/** Colori e caratteri pronti per disegnare. */
export function styleTokens(st: MenuStyle) {
  return {
    paper:      st.colors.paper,
    ink:        st.colors.ink,
    inkSoft:    mix(st.colors.ink, st.colors.paper, 0.32),
    accent:     st.colors.accent,
    accentSoft: mix(st.colors.accent, st.colors.paper, 0.45),
    display:    fontStack(st.fonts.display),
    text:       fontStack(st.fonts.text),
    details:    fontStack(st.fonts.details),
  }
}
export type StyleTokens = ReturnType<typeof styleTokens>
