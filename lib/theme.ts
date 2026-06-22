// ─────────────────────────────────────────────────────────────────────────────
// Restaurant theme — nested compartments: landing and menu are fully independent.
// Stored as theme_config JSONB in the restaurants table.
// ─────────────────────────────────────────────────────────────────────────────

// ── Pagination ────────────────────────────────────────────────────────────────

export type PaginationStyle =
  | 'hidden' | 'prec_succ' | 'precedente_successivo' | 'indietro_avanti'
  | 'back_next' | 'angle' | 'arrow' | 'chevron' | 'guillemet' | 'bracket'

export const PAGINATION_OPTIONS: Record<PaginationStyle, { label: string; prev: string; next: string }> = {
  hidden:                 { label: 'Nascondi',                prev: '',            next: ''            },
  prec_succ:              { label: 'Prec. / Succ.',           prev: '‹ prec.',     next: 'succ. ›'     },
  precedente_successivo:  { label: 'Precedente / Successivo', prev: 'Precedente',  next: 'Successivo'  },
  indietro_avanti:        { label: 'Indietro / Avanti',       prev: 'Indietro',    next: 'Avanti'      },
  back_next:              { label: 'BACK / NEXT',             prev: 'BACK',        next: 'NEXT'        },
  angle:                  { label: '< / >',                   prev: '<',           next: '>'           },
  arrow:                  { label: '← / →',                   prev: '←',           next: '→'           },
  chevron:                { label: '⟨ / ⟩',                   prev: '⟨',           next: '⟩'           },
  guillemet:              { label: '≪ / ≫',                   prev: '≪',           next: '≫'           },
  bracket:                { label: '[ / ]',                   prev: '[',           next: ']'           },
}

// ── Menu background effects ───────────────────────────────────────────────────

export type MenuBgEffect =
  | 'none' | 'linear-gradient' | 'radial-gradient' | 'parchment' | 'vintage'
  | 'grunge' | 'slate' | 'carbon' | 'linen' | 'leather' | 'sepia'
  | 'minimal-noise' | 'retro-grid' | 'velvet' | 'gold-leaf'
  // ── New premium effects ──
  | 'aurora' | 'mesh-warm' | 'mesh-cool' | 'dots' | 'diagonal'
  | 'honeycomb' | 'waves' | 'spotlight' | 'emerald-mist' | 'fine-grain'

export const MENU_BG_EFFECTS: MenuBgEffect[] = [
  'none',
  // new premium set first — these are the recommended ones
  'aurora','mesh-warm','mesh-cool','spotlight','emerald-mist',
  'dots','diagonal','honeycomb','waves','fine-grain',
  // classic set
  'linear-gradient','radial-gradient','parchment','vintage',
  'grunge','slate','carbon','linen','leather','sepia',
  'minimal-noise','retro-grid','velvet','gold-leaf',
]

export const MENU_BG_EFFECT_LABELS: Record<MenuBgEffect, string> = {
  'none':            'Nessuno',
  'aurora':          'Aurora',
  'mesh-warm':       'Mesh caldo',
  'mesh-cool':       'Mesh freddo',
  'spotlight':       'Spotlight',
  'emerald-mist':    'Bruma smeraldo',
  'dots':            'Pois',
  'diagonal':        'Diagonali',
  'honeycomb':       'Favo',
  'waves':           'Onde',
  'fine-grain':      'Grana fine',
  'linear-gradient': 'Gradiente lineare',
  'radial-gradient': 'Gradiente radiale',
  'parchment':       'Pergamena',
  'vintage':         'Vintage',
  'grunge':          'Grunge',
  'slate':           'Ardesia',
  'carbon':          'Fibra di carbonio',
  'linen':           'Lino',
  'leather':         'Pelle',
  'sepia':           'Seppia',
  'minimal-noise':   'Rumore minimale',
  'retro-grid':      'Griglia retrò',
  'velvet':          'Velluto',
  'gold-leaf':       "Foglia d'oro",
}

// Color + effect + image background config, shared by the area around the
// flipbook (`menu.background`) and the page surface under the dishes
// (`menu.pageBackground`).
export interface MenuBgConfig {
  color: string; color2: string; effect: MenuBgEffect
  effectOpacity: number; effectStrength: number
  image: string; imageOpacity: number
}

// ── Shared option types ─────────────────────────────────────────────────────────

// Per-element alignment: 'inherit' uses the general dish alignment.
export type AlignOpt    = 'inherit' | 'left' | 'center' | 'right'
export type PriceFormat = 'symbol-left' | 'symbol-right' | 'no-symbol'
// Where the price sits relative to the dish name.
export type PricePosition = 'left' | 'right' | 'above' | 'below'

export type AllergenDisplay = 'full' | 'short' | 'number'

export const CURRENCY_OPTIONS = ['€', '$', '£', '¥', 'CHF', 'kr'] as const

// ── Card sub-theme ────────────────────────────────────────────────────────────

export interface CardTheme {
  bgColor:      string        // '#111111'
  accent:       string        // accento decorativo della card (separatori, frecce)
  align:        'left' | 'center' | 'right'  // allineamento testo della card
  borderRadius: 'none' | 'sm' | 'md'   // 0 / 8 / 16px
  layout:      'photo-top' | 'photo-side' | 'minimal'
  // Etichetta categoria in cima alla card — indipendente dal titolo categoria
  // del menu (menu.categories), che resta separato.
  category:    { color: string; size: number }
  title:       { font: string; size: number; color: string; weight: 'light' | 'normal' | 'bold' }
  description: { font: string; size: number; color: string }
  price:       { font: string; size: number; color: string; format: PriceFormat; currency: string }
  // labelColor: colore dell'etichetta "Allergeni"; color resta il colore dell'elenco.
  allergens:   { style: 'text' | 'badge'; color: string; bgColor: string; display: AllergenDisplay; separator: string; size: number; labelColor: string }
  // Box "Abbinamento consigliato": labelColor per l'etichetta, productColor
  // per il nome del prodotto consigliato.
  pairing:     { labelColor: string; productColor: string }
  // show: false nasconde del tutto la X (la card si chiude comunque con tap
  // sul backdrop o Esc). size: dimensione del glifo × in rem.
  closeButton: { color: string; position: 'top-right' | 'top-left'; shape: 'none' | 'circle' | 'square'; show: boolean; size: number }
}

// ── Landing sub-theme ─────────────────────────────────────────────────────────

export interface LandingBackground {
  type:                'color' | 'image' | 'video' | 'gif'
  value:               string       // hex (for color) or storage URL
  opacity:             number       // 0–100
  loopMode:            'loop' | 'once' | 'pingpong'
  texture:             'none' | 'noise' | 'grain' | 'wood' | 'marble'
  immersiveTransition: boolean
  poster?:             string
}

export interface LandingTheme {
  background:  LandingBackground
  accent:      string
  // image: custom logo upload — overrides restaurant.logo_url when set
  logo:        { size: number; mixBlend: 'normal' | 'multiply' | 'screen'; image: string; gapBottom: number }
  // text: override for the restaurant name — falls back to restaurant.name when empty.
  // text supports manual line breaks (\n); lineSizes[i] holds the font size (rem)
  // for line i+2 (line 1 uses `size`). Missing entries fall back to `size`.
  title:       { font: string; size: number; color: string; weight: 'light' | 'normal' | 'bold'; text: string; gapBottom: number; lineSizes: number[] }
  // text: override for the slogan — falls back to restaurant.description when empty.
  // Same multi-line / per-line size convention as `title`.
  description: { font: string; size: number; color: string; text: string; lineSizes: number[] }
  buttons: {
    shape:       'flat' | 'rounded' | 'pill'
    borderStyle: 'none' | 'solid' | 'dashed'
    borderWidth: number
    borderColor: string
    font:        string
    fontSize:    number
    textColor:   string
    bgColor:     string
    // Vertical gap (rem) between description (or title) and the menu buttons
    gapTop:      number
  }
  socials: { color: string; size: number; style: 'minimal' | 'circle' | 'box' | 'outline' }
}

// ── Menu sub-theme ────────────────────────────────────────────────────────────

export type DividerType = 'none' | 'solid' | 'dashed' | 'dotted' | 'double' | 'gradient' | 'ornament' | 'wavy'

// Decorative element drawn to the left/right of a category title.
export type CategoryFlourish = 'none' | 'lines' | 'dots' | 'diamond'

// Page layouts for the generated PDF menu.
export type DishLayout = 'list' | 'grid-2' | 'grid-3' | 'boxed-card' | 'minimal-row' | 'elegant'

export interface MenuTheme {
  accent:         string
  background:     MenuBgConfig
  pageBackground: MenuBgConfig
  pdfLayout:      'classic' | 'compact'
  compactMode:    'linear' | 'alternating'
  layout: {
    dishLayout:       DishLayout
    dishAlignment:    'left' | 'center' | 'right'
    dishSpacing:      number
    dishesPerPage:    number          // 0 = automatico (flusso naturale)
    boxedBorderWidth: number
    divider:          { type: DividerType; color: string; width: number; widthPercent: number }
  }
  dishes:       { titleFont: string; titleSize: number; titleColor: string; align: AlignOpt }
  descriptions: { font: string; size: number; color: string; align: AlignOpt }
  allergens:    { style: 'text' | 'badge'; color: string; bgColor: string; display: AllergenDisplay; separator: string; size: number; align: AlignOpt }
  prices:       { font: string; size: number; color: string; format: PriceFormat; currency: string; position: PricePosition; align: AlignOpt }
  categories:   { font: string; color: string; size: number; align: AlignOpt; flourish: CategoryFlourish; flourishColor: string; flourishWidth: number; flourishThickness: number }
  stickyCategories: {
    // Lo stile 'transparent-blur' (vetro) è stato rimosso: resa inaffidabile
    // (backdrop-filter + sticky). I temi salvati con quel valore ricadono su 'solid'.
    style:     'solid' | 'none'
    bgColor:   string
    textColor: string
    activeColor: string
    font:      string
    fontSize:  number
  }
  navigation: { style: PaginationStyle; color: string }
  banners:    { position: 'inline' | 'dedicated-page' }
  // Pop-up istruzioni mostrato al centro (sfondo sfocato) all'apertura del menu:
  // spiega che i piatti sono cliccabili e come girare pagina. showOnce: appare
  // una sola volta per dispositivo (localStorage). text supporta \n.
  hintPopup: {
    enabled:      boolean
    showOnce:     boolean
    title:        string
    text:         string
    font:         string
    titleSize:    number
    textSize:     number
    bgColor:      string
    titleColor:   string
    textColor:    string
    closeColor:   string
    borderRadius: 'none' | 'sm' | 'md'
  }
}

// ── Root ──────────────────────────────────────────────────────────────────────

// Pagine pubblicitarie iniettate nel flipbook (salvate in theme_config.ads).
export interface AdConfig {
  insertAfterPdfPage: number
  dishId:             string
  mode:               'custom_media' | 'auto_generated'
  mediaUrl?:          string
  backupImageUrl:     string
  dishName:           string
  badgeText?:         string
  price?:             string
}

export interface RestaurantTheme {
  landing: LandingTheme
  menu:    MenuTheme
  card:    CardTheme
  // Per-menu overrides: menuId → full MenuTheme override. Menus without an
  // entry here inherit `menu` ("Generale"). hintPopup is always taken from
  // `menu.hintPopup` regardless of overrides — see resolveMenuTheme().
  menuThemes?: Record<string, MenuTheme>
  // Custom uploaded font files: family name → public URL (TTF/OTF/WOFF/WOFF2).
  // Lets users pick a font that doesn't exist on Google Fonts. Any font.* field
  // can reference a key here by name; @font-face rules are injected at runtime
  // on the public pages (and in the admin preview) via customFontFaceCss().
  customFonts: Record<string, string>
  // Pagine pubblicitarie iniettate nel flipbook (Ken Burns / video). Vuoto = nessun ad.
  ads: AdConfig[]
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_THEME: RestaurantTheme = {
  landing: {
    background: {
      type: 'color', value: '#0d0d0d', opacity: 30,
      loopMode: 'loop', texture: 'none',
      immersiveTransition: false, poster: undefined,
    },
    accent:      '#c9a96e',
    logo:        { size: 3.5, mixBlend: 'normal', image: '', gapBottom: 1.5 },
    title:       { font: 'Cormorant Garamond', size: 2.0, color: '#ede8e0', weight: 'light', text: '', gapBottom: 0.6, lineSizes: [] },
    description: { font: 'DM Sans', size: 0.6, color: '#c9a96e80', text: '', lineSizes: [] },
    buttons: {
      shape: 'flat', borderStyle: 'solid', borderWidth: 1, borderColor: '#c9a96e',
      font: 'DM Sans', fontSize: 0.625, textColor: '#ede8e0', bgColor: 'transparent', gapTop: 2.5,
    },
    socials: { color: '#c9a96e', size: 1.25, style: 'minimal' },
  },
  menu: {
    accent:         '#c9a96e',
    background:     { color: '#0d0d0d', color2: '#1a1a1a', effect: 'none', effectOpacity: 100, effectStrength: 100, image: '', imageOpacity: 100 },
    pageBackground: { color: '#ffffff', color2: '#f0ece4', effect: 'none', effectOpacity: 100, effectStrength: 100, image: '', imageOpacity: 100 },
    pdfLayout:      'classic',
    compactMode:    'linear',
    layout: {
      dishLayout:       'list',
      dishAlignment:    'left',
      dishSpacing:      0,
      dishesPerPage:    0,
      boxedBorderWidth: 1,
      divider:          { type: 'solid', color: '#ece6da', width: 0.5, widthPercent: 100 },
    },
    dishes:       { titleFont: 'Cormorant Garamond', titleSize: 1.75, titleColor: '#ede8e0', align: 'inherit' },
    descriptions: { font: 'DM Sans', size: 0.875, color: '#a09080', align: 'inherit' },
    allergens:    { style: 'text', color: '#c9a96e', bgColor: '#181208', display: 'full', separator: ', ', size: 0.85, align: 'inherit' },
    prices:       { font: 'DM Sans', size: 1.1, color: '#c9a96e', format: 'symbol-left', currency: '€', position: 'right', align: 'inherit' },
    categories:   { font: 'Cormorant Garamond', color: '#1a1a1a', size: 1.3, align: 'inherit', flourish: 'none', flourishColor: '#c9a96e', flourishWidth: 40, flourishThickness: 1 },
    stickyCategories: {
      style: 'solid', bgColor: 'rgba(7,7,7,0.96)', textColor: '#4f4f4f', activeColor: '#c9a96e', font: 'DM Sans', fontSize: 0.625,
    },
    navigation: { style: 'prec_succ', color: '#4f4f4f' },
    banners:    { position: 'inline' },
    hintPopup: {
      enabled:  true,
      showOnce: true,
      title:    'Come sfogliare il menu',
      text:     'Tocca un piatto per scoprire i dettagli.\nPer girare pagina tocca o trascina gli angoli in basso del foglio.',
      font:     'DM Sans',
      titleSize: 1.1,
      textSize:  0.85,
      bgColor:    '#111111',
      titleColor: '#ede8e0',
      textColor:  '#a09080',
      closeColor: '#777777',
      borderRadius: 'sm',
    },
  },
  card: {
    bgColor:      '#111111',
    accent:       '#c9a96e',
    align:        'left',
    borderRadius: 'sm',
    layout:  'photo-top',
    category:    { color: '#c9a96e', size: 0.5625 },
    title:       { font: 'Cormorant Garamond', size: 1.75, color: '#ede8e0', weight: 'light' },
    description: { font: 'DM Sans', size: 0.875, color: '#a09080' },
    price:       { font: 'DM Sans', size: 1.1, color: '#c9a96e', format: 'symbol-left', currency: '€' },
    allergens:   { style: 'text', color: '#c9a96e', bgColor: '#181208', display: 'full', separator: ', ', size: 0.85, labelColor: '#c9a96e' },
    pairing:     { labelColor: '#c9a96e', productColor: '#8a8a8a' },
    closeButton: { color: '#555555', position: 'top-right', shape: 'none', show: true, size: 1.25 },
  },
  customFonts: {},
  ads: [],
}

// ── Parse helpers ─────────────────────────────────────────────────────────────

function str(v: unknown, fb: string): string { return typeof v === 'string' ? v : fb }
function num(v: unknown, fb: number): number { return typeof v === 'number' ? v : fb }
function numArray(v: unknown, fb: number[]): number[] {
  return Array.isArray(v) && v.every(x => typeof x === 'number') ? v as number[] : fb
}
function strRecord(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'string') out[k] = val
  }
  return out
}
function one<T extends string>(v: unknown, opts: readonly T[], fb: T): T {
  return (opts as readonly unknown[]).includes(v) ? v as T : fb
}
function sub(v: unknown): Record<string, unknown> {
  return (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
}
function parseMenuBg(raw: unknown, fb: MenuBgConfig): MenuBgConfig {
  // Older saves stored pageBackground as a plain hex string.
  if (typeof raw === 'string') return { ...fb, color: raw }
  const v = sub(raw)
  return {
    color:          str(v.color, fb.color),
    color2:         str(v.color2, fb.color2),
    effect:         one(v.effect, MENU_BG_EFFECTS as readonly MenuBgEffect[], fb.effect),
    effectOpacity:  num(v.effectOpacity, fb.effectOpacity),
    effectStrength: num(v.effectStrength, fb.effectStrength),
    image:          str(v.image, fb.image),
    imageOpacity:   num(v.imageOpacity, fb.imageOpacity),
  }
}

// Parses any MenuTheme (the "Generale" theme or a per-menu override), falling
// back field-by-field to `fb` — defaults for Generale, the parsed Generale for
// per-menu overrides.
export function parseMenuTheme(raw: unknown, fb: MenuTheme): MenuTheme {
  const m   = sub(raw)
  const ml  = sub(m.layout)
  const md  = sub(ml.divider)
  const mi  = sub(m.dishes)
  const me  = sub(m.descriptions)
  const ma  = sub(m.allergens)
  const mp  = sub(m.prices)
  const mc  = sub(m.categories)
  const ms  = sub(m.stickyCategories)
  const mn  = sub(m.navigation)
  const mbn = sub(m.banners)
  const mh  = sub(m.hintPopup)
  return {
    accent:         str(m.accent, fb.accent),
    background:     parseMenuBg(m.background, fb.background),
    pageBackground: parseMenuBg(m.pageBackground, fb.pageBackground),
    pdfLayout:      one(m.pdfLayout, ['classic','compact'] as const, fb.pdfLayout),
    compactMode:    one(m.compactMode, ['linear','alternating'] as const, fb.compactMode),
    layout: {
      dishLayout:       one(ml.dishLayout, ['list','grid-2','grid-3','boxed-card','minimal-row','elegant'] as const, fb.layout.dishLayout),
      dishAlignment:    one(ml.dishAlignment, ['left','center','right'] as const, fb.layout.dishAlignment),
      dishSpacing:      num(ml.dishSpacing, fb.layout.dishSpacing),
      dishesPerPage:    num(ml.dishesPerPage, fb.layout.dishesPerPage),
      boxedBorderWidth: num(ml.boxedBorderWidth, fb.layout.boxedBorderWidth),
      divider:          { type: one(md.type, ['none','solid','dashed','dotted','double','gradient','ornament','wavy'] as const, fb.layout.divider.type), color: str(md.color, fb.layout.divider.color), width: num(md.width, fb.layout.divider.width), widthPercent: num(md.widthPercent, fb.layout.divider.widthPercent) },
    },
    dishes:       { titleFont: str(mi.titleFont, fb.dishes.titleFont), titleSize: num(mi.titleSize, fb.dishes.titleSize), titleColor: str(mi.titleColor, fb.dishes.titleColor), align: one(mi.align, ['inherit','left','center','right'] as const, fb.dishes.align) },
    descriptions: { font: str(me.font, fb.descriptions.font), size: num(me.size, fb.descriptions.size), color: str(me.color, fb.descriptions.color), align: one(me.align, ['inherit','left','center','right'] as const, fb.descriptions.align) },
    allergens:    { style: one(ma.style, ['text','badge'] as const, fb.allergens.style), color: str(ma.color, fb.allergens.color), bgColor: str(ma.bgColor, fb.allergens.bgColor), display: one(ma.display, ['full','short','number'] as const, fb.allergens.display), separator: str(ma.separator, fb.allergens.separator), size: num(ma.size, fb.allergens.size), align: one(ma.align, ['inherit','left','center','right'] as const, fb.allergens.align) },
    prices:       { font: str(mp.font, fb.prices.font), size: num(mp.size, fb.prices.size), color: str(mp.color, fb.prices.color), format: one(mp.format, ['symbol-left','symbol-right','no-symbol'] as const, fb.prices.format), currency: str(mp.currency, fb.prices.currency), position: one(mp.position, ['left','right','above','below'] as const, fb.prices.position), align: one(mp.align, ['inherit','left','center','right'] as const, fb.prices.align) },
    categories:   { font: str(mc.font, fb.categories.font), color: str(mc.color, fb.categories.color), size: num(mc.size, fb.categories.size), align: one(mc.align, ['inherit','left','center','right'] as const, fb.categories.align), flourish: one(mc.flourish, ['none','lines','dots','diamond'] as const, fb.categories.flourish), flourishColor: str(mc.flourishColor, fb.categories.flourishColor), flourishWidth: num(mc.flourishWidth, fb.categories.flourishWidth), flourishThickness: num(mc.flourishThickness, fb.categories.flourishThickness) },
    stickyCategories: {
      style:       one(ms.style, ['solid','none'] as const, fb.stickyCategories.style),
      bgColor:     str(ms.bgColor, fb.stickyCategories.bgColor),
      textColor:   str(ms.textColor, fb.stickyCategories.textColor),
      activeColor: str(ms.activeColor, fb.stickyCategories.activeColor),
      font:        str(ms.font, fb.stickyCategories.font),
      fontSize:    num(ms.fontSize, fb.stickyCategories.fontSize),
    },
    navigation: {
      style: one(mn.style, Object.keys(PAGINATION_OPTIONS) as PaginationStyle[], fb.navigation.style),
      color: str(mn.color, fb.navigation.color),
    },
    banners: { position: one(mbn.position, ['inline','dedicated-page'] as const, fb.banners.position) },
    hintPopup: {
      enabled:      mh.enabled !== undefined ? mh.enabled !== false : fb.hintPopup.enabled,
      showOnce:     mh.showOnce !== undefined ? mh.showOnce !== false : fb.hintPopup.showOnce,
      title:        str(mh.title, fb.hintPopup.title),
      text:         str(mh.text, fb.hintPopup.text),
      font:         str(mh.font, fb.hintPopup.font),
      titleSize:    num(mh.titleSize, fb.hintPopup.titleSize),
      textSize:     num(mh.textSize, fb.hintPopup.textSize),
      bgColor:      str(mh.bgColor, fb.hintPopup.bgColor),
      titleColor:   str(mh.titleColor, fb.hintPopup.titleColor),
      textColor:    str(mh.textColor, fb.hintPopup.textColor),
      closeColor:   str(mh.closeColor, fb.hintPopup.closeColor),
      borderRadius: one(mh.borderRadius, ['none','sm','md'] as const, fb.hintPopup.borderRadius),
    },
  }
}

// Parses the optional per-menu override map (theme.menuThemes).
function parseMenuThemeOverrides(raw: unknown, generale: MenuTheme): Record<string, MenuTheme> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Record<string, MenuTheme> = {}
  for (const [id, val] of Object.entries(raw as Record<string, unknown>)) {
    if (val && typeof val === 'object') out[id] = parseMenuTheme(val, generale)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

// Effective MenuTheme for a given menu: per-menu override if present, otherwise
// "Generale". hintPopup is restaurant-wide and always comes from Generale.
export function resolveMenuTheme(theme: RestaurantTheme, menuId?: string | null): MenuTheme {
  const override = menuId ? theme.menuThemes?.[menuId] : undefined
  if (!override) return theme.menu
  return { ...override, hintPopup: theme.menu.hintPopup }
}

// ── parseTheme — handles both new nested format and old flat format ────────────

export function parseTheme(raw: unknown): RestaurantTheme {
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_THEME)
  const r = raw as Record<string, unknown>

  // Detect new nested format by checking for landing/menu sub-objects
  if (r.landing && typeof r.landing === 'object' && r.menu && typeof r.menu === 'object') {
    return parseNested(r)
  }

  // Fall through to old flat format migration
  return migrateFlat(r)
}

function parseNested(r: Record<string, unknown>): RestaurantTheme {
  const d   = DEFAULT_THEME
  const l   = sub(r.landing)
  const m   = sub(r.menu)
  const lb  = sub(l.background)
  const ll  = sub(l.logo)
  const lt  = sub(l.title)
  const ld  = sub(l.description)
  const bu  = sub(l.buttons)
  const ls  = sub(l.socials)
  const ml  = sub(m.layout)
  const ca  = sub(r.card)
  const cac = sub(ca.category)
  const cat = sub(ca.title)
  const cad = sub(ca.description)
  const cap = sub(ca.price)
  const caa = sub(ca.allergens)
  const cpr = sub(ca.pairing)
  const cab = sub(ca.closeButton)

  const parsedMenu = parseMenuTheme(r.menu, d.menu)

  return {
    landing: {
      background: {
        type:                one(lb.type, ['color','image','video','gif'] as const, d.landing.background.type),
        value:               str(lb.value, d.landing.background.value),
        opacity:             num(lb.opacity, d.landing.background.opacity),
        loopMode:            one(lb.loopMode, ['loop','once','pingpong'] as const, d.landing.background.loopMode),
        texture:             one(lb.texture, ['none','noise','grain','wood','marble'] as const, d.landing.background.texture),
        immersiveTransition: lb.immersiveTransition === true,
        poster:              str(lb.poster, '') || undefined,
      },
      accent:      str(l.accent, d.landing.accent),
      logo:        { size: num(ll.size, d.landing.logo.size), mixBlend: one(ll.mixBlend, ['normal','multiply','screen'] as const, d.landing.logo.mixBlend), image: str(ll.image, d.landing.logo.image), gapBottom: num(ll.gapBottom, d.landing.logo.gapBottom) },
      title:       { font: str(lt.font, d.landing.title.font), size: num(lt.size, d.landing.title.size), color: str(lt.color, d.landing.title.color), weight: one(lt.weight, ['light','normal','bold'] as const, d.landing.title.weight), text: str(lt.text, d.landing.title.text), gapBottom: num(lt.gapBottom, d.landing.title.gapBottom), lineSizes: numArray(lt.lineSizes, d.landing.title.lineSizes) },
      description: { font: str(ld.font, d.landing.description.font), size: num(ld.size, d.landing.description.size), color: str(ld.color, d.landing.description.color), text: str(ld.text, d.landing.description.text), lineSizes: numArray(ld.lineSizes, d.landing.description.lineSizes) },
      buttons: {
        shape:       one(bu.shape, ['flat','rounded','pill'] as const, d.landing.buttons.shape),
        borderStyle: one(bu.borderStyle, ['none','solid','dashed'] as const, d.landing.buttons.borderStyle),
        borderWidth: num(bu.borderWidth, d.landing.buttons.borderWidth),
        borderColor: str(bu.borderColor, d.landing.buttons.borderColor),
        font:        str(bu.font, d.landing.buttons.font),
        fontSize:    num(bu.fontSize, d.landing.buttons.fontSize),
        textColor:   str(bu.textColor, d.landing.buttons.textColor),
        bgColor:     str(bu.bgColor, d.landing.buttons.bgColor),
        gapTop:      num(bu.gapTop, d.landing.buttons.gapTop),
      },
      socials: {
        color: str(ls.color, d.landing.socials.color),
        size:  num(ls.size, d.landing.socials.size),
        style: one(ls.style, ['minimal','circle','box','outline'] as const, d.landing.socials.style),
      },
    },
    menu:       parsedMenu,
    menuThemes: parseMenuThemeOverrides(r.menuThemes, parsedMenu),
    card: {
      bgColor:      str(ca.bgColor, d.card.bgColor),
      // Back-compat: i temi salvati prima dell'introduzione di accent/align sulla card
      // ereditano i valori correnti del menu al primo parse, poi restano indipendenti.
      accent:       str(ca.accent, str(m.accent, d.menu.accent)),
      align:        one(ca.align, ['left','center','right'] as const,
                        one(ml.dishAlignment, ['left','center','right'] as const, d.menu.layout.dishAlignment)),
      borderRadius: one(ca.borderRadius, ['none','sm','md'] as const, d.card.borderRadius),
      layout:       one(ca.layout, ['photo-top','photo-side','minimal'] as const, d.card.layout),
      category: {
        // Back-compat: prima dell'introduzione di card.category il chip usava
        // il colore accento della card — i temi salvati mantengono quel look.
        color: str(cac.color, str(ca.accent, str(m.accent, d.menu.accent))),
        size:  num(cac.size, d.card.category.size),
      },
      title: {
        font:   str(cat.font, d.card.title.font),
        size:   num(cat.size, d.card.title.size),
        color:  str(cat.color, d.card.title.color),
        weight: one(cat.weight, ['light','normal','bold'] as const, d.card.title.weight),
      },
      description: {
        font:  str(cad.font, d.card.description.font),
        size:  num(cad.size, d.card.description.size),
        color: str(cad.color, d.card.description.color),
      },
      price: {
        font:     str(cap.font, d.card.price.font),
        size:     num(cap.size, d.card.price.size),
        color:    str(cap.color, d.card.price.color),
        format:   one(cap.format, ['symbol-left','symbol-right','no-symbol'] as const, d.card.price.format),
        currency: str(cap.currency, d.card.price.currency),
      },
      allergens: {
        style:     one(caa.style, ['text','badge'] as const, d.card.allergens.style),
        color:     str(caa.color, d.card.allergens.color),
        bgColor:   str(caa.bgColor, d.card.allergens.bgColor),
        display:   one(caa.display, ['full','short','number'] as const, d.card.allergens.display),
        separator: str(caa.separator, d.card.allergens.separator),
        size:      num(caa.size, d.card.allergens.size),
        // Back-compat: l'etichetta "Allergeni" usava lo stesso colore dell'elenco.
        labelColor: str(caa.labelColor, str(caa.color, d.card.allergens.color)),
      },
      pairing: {
        // Back-compat: l'etichetta usava l'accento della card, il prodotto un grigio fisso.
        labelColor:   str(cpr.labelColor, str(ca.accent, str(m.accent, d.menu.accent))),
        productColor: str(cpr.productColor, d.card.pairing.productColor),
      },
      closeButton: {
        color:    str(cab.color, d.card.closeButton.color),
        position: one(cab.position, ['top-right','top-left'] as const, d.card.closeButton.position),
        shape:    one(cab.shape, ['none','circle','square'] as const, d.card.closeButton.shape),
        show:     cab.show !== false,
        size:     num(cab.size, d.card.closeButton.size),
      },
    },
    customFonts: strRecord(r.customFonts),
    ads: Array.isArray(r.ads) ? (r.ads as AdConfig[]) : [],
  }
}

export function migrateFlat(r: Record<string, unknown>): RestaurantTheme {
  const d = DEFAULT_THEME
  const accent      = str(r.accent, d.landing.accent)
  const fontSerif   = str(r.fontSerif, d.landing.title.font)
  const fontSans    = str(r.fontSans, d.landing.buttons.font)
  const textPrimary = str(r.textPrimary, d.landing.title.color)
  const textMuted   = str(r.textMuted, d.menu.stickyCategories.textColor)
  const navBg       = str(r.navBg, d.menu.stickyCategories.bgColor)
  const appBg       = typeof r.appBg === 'string' ? r.appBg : typeof r.pageBg === 'string' ? r.pageBg : d.menu.background.color

  let bgType: LandingBackground['type']
  let bgValue: string
  if (typeof r.bgVideo === 'string') { bgType = 'video'; bgValue = r.bgVideo }
  else if (typeof r.bgImage === 'string') { bgType = 'image'; bgValue = r.bgImage }
  else { bgType = 'color'; bgValue = appBg }

  const fs = sub(r.fontSizes)

  const buttonShape: LandingTheme['buttons']['shape'] =
    r.borderRadius === 'md' ? 'pill' : r.borderRadius === 'sm' ? 'rounded' : 'flat'

  const priceFormat: MenuTheme['prices']['format'] =
    r.priceFormat === 'after' ? 'symbol-right' : r.priceFormat === 'minimal' ? 'no-symbol' : 'symbol-left'

  const dishLayout: MenuTheme['layout']['dishLayout'] =
    r.dishLayout === 'grid' ? 'grid-2' : r.dishLayout === 'boxed' ? 'boxed-card' : 'list'

  const dividerType: MenuTheme['layout']['divider']['type'] =
    r.dividerStyle === 'none' ? 'none' : r.dividerStyle === 'dashed' ? 'dashed' : 'solid'

  const stickyCatStyle: MenuTheme['stickyCategories']['style'] =
    r.stickyCategoryStyle === 'none' ? 'none' : 'solid'

  const dishAlignment: MenuTheme['layout']['dishAlignment'] =
    r.dishAlignment === 'center' ? 'center' : r.dishAlignment === 'right' ? 'right' : 'left'

  const paginationStyle: PaginationStyle =
    typeof r.paginationStyle === 'string' && r.paginationStyle in PAGINATION_OPTIONS
      ? r.paginationStyle as PaginationStyle : d.menu.navigation.style

  return {
    landing: {
      background: {
        type: bgType, value: bgValue,
        opacity: num(r.bgImageOpacity, 30),
        loopMode: 'loop', texture: 'none',
        immersiveTransition: r.immersiveTransition === true,
        poster: typeof r.bgVideoPoster === 'string' ? r.bgVideoPoster : undefined,
      },
      accent,
      logo:        { size: 3.5, mixBlend: 'normal', image: '', gapBottom: d.landing.logo.gapBottom },
      title:       { font: fontSerif, size: num(fs.title, d.landing.title.size), color: textPrimary, weight: 'light', text: '', gapBottom: d.landing.title.gapBottom, lineSizes: [] },
      description: { font: fontSans, size: 0.6, color: `${accent}80`, text: '', lineSizes: [] },
      buttons: {
        shape: buttonShape, borderStyle: 'solid', borderWidth: 1, borderColor: accent,
        font: fontSans, fontSize: 0.625, textColor: textPrimary, bgColor: 'transparent', gapTop: 2.5,
      },
      socials: { color: accent, size: 1.25, style: 'minimal' },
    },
    menu: {
      accent,
      background:     { color: appBg, color2: d.menu.background.color2, effect: 'none', effectOpacity: 100, effectStrength: 100, image: '', imageOpacity: 100 },
      pageBackground: parseMenuBg(r.pageBackground, d.menu.pageBackground),
      pdfLayout:      r.pdfLayout === 'compact' ? 'compact' : 'classic',
      compactMode:    'linear',
      layout: {
        dishLayout, dishAlignment, dishSpacing: 0, dishesPerPage: 0, boxedBorderWidth: 1,
        divider: { type: dividerType, color: '#ece6da', width: 0.5, widthPercent: 100 },
      },
      dishes:       { titleFont: fontSerif, titleSize: num(fs.title, d.menu.dishes.titleSize), titleColor: '#ede8e0', align: 'inherit' },
      descriptions: { font: fontSans, size: num(fs.base, d.menu.descriptions.size), color: '#a09080', align: 'inherit' },
      allergens:    { style: 'text', color: accent, bgColor: '#181208', display: 'full', separator: ', ', size: 0.85, align: 'inherit' },
      prices:       { font: fontSans, size: num(fs.price, d.menu.prices.size), color: accent, format: priceFormat, currency: '€', position: 'right', align: 'inherit' },
      categories:   { font: fontSerif, color: '#1a1a1a', size: 1.3, align: 'inherit', flourish: 'none', flourishColor: accent, flourishWidth: 40, flourishThickness: 1 },
      stickyCategories: { style: stickyCatStyle, bgColor: navBg, textColor: textMuted, activeColor: accent, font: fontSans, fontSize: 0.625 },
      navigation:   { style: paginationStyle, color: textMuted },
      banners:      { position: 'inline' },
      hintPopup:    structuredClone(d.menu.hintPopup),
    },
    card: {
      ...structuredClone(d.card), accent, align: dishAlignment,
      category: { ...d.card.category, color: accent },
      pairing:  { ...d.card.pairing, labelColor: accent },
    },
    customFonts: strRecord(r.customFonts),
    ads: Array.isArray(r.ads) ? (r.ads as AdConfig[]) : [],
  }
}

// ── Font catalog ──────────────────────────────────────────────────────────────

export const SERIF_FONTS = [
  'Cormorant Garamond', 'Playfair Display', 'Bodoni Moda',
  'EB Garamond', 'Lora', 'Libre Baskerville', 'Josefin Slab',
  'Crimson Text', 'Spectral', 'Della Respira', 'Cardo',
  'Merriweather', 'Sorts Mill Goudy',
]

export const SANS_FONTS = [
  'DM Sans', 'Inter', 'Montserrat', 'Poppins',
  'Raleway', 'Josefin Sans', 'Oswald', 'Roboto',
  'Nunito', 'Outfit', 'Syne', 'Barlow',
]

export const DISPLAY_FONTS = [
  'Abril Fatface', 'Bebas Neue', 'Anton', 'Righteous',
  'Cinzel', 'Yeseva One',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

export function allThemeFonts(theme: RestaurantTheme): string[] {
  const all = [
    theme.landing.title.font, theme.landing.buttons.font, theme.landing.description.font,
    theme.menu.dishes.titleFont, theme.menu.descriptions.font,
    theme.menu.prices.font, theme.menu.categories.font, theme.menu.stickyCategories.font,
    theme.menu.hintPopup.font,
    theme.card.title.font, theme.card.description.font, theme.card.price.font,
  ]
  for (const mt of Object.values(theme.menuThemes ?? {})) {
    all.push(mt.dishes.titleFont, mt.descriptions.font, mt.prices.font, mt.categories.font, mt.stickyCategories.font)
  }
  return all.filter((f, i, a) => f && a.indexOf(f) === i)
}

export function googleFontsUrl(fonts: string[]): string {
  const filtered = fonts.filter(Boolean)
  const unique = filtered.filter((f, i) => filtered.indexOf(f) === i)
  if (!unique.length) return ''
  const families = unique
    .map(f => `family=${encodeURIComponent(f)}:ital,wght@0,300;0,400;0,600;1,400`)
    .join('&')
  // display=block: meglio un breve istante di testo invisibile che un flash
  // del font di fallback seguito dallo "scatto" al font corretto (FOUT).
  return `https://fonts.googleapis.com/css2?${families}&display=block`
}

// Splits a (possibly multi-line) text into per-line { text, size } pairs.
// Line 1 uses `baseSize`; line N (N>=2) uses `lineSizes[N-2]`, falling back
// to `baseSize` when not set.
export function lineSizesFor(text: string, baseSize: number, lineSizes: number[]): { text: string; size: number }[] {
  return text.split('\n').map((line, i) => ({ text: line, size: i === 0 ? baseSize : (lineSizes[i - 1] ?? baseSize) }))
}

// Accepted custom font file extensions (uploaded via admin).
export const CUSTOM_FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2'] as const

function fontFileFormat(url: string): string {
  const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase()
  if (ext === 'woff2') return 'woff2'
  if (ext === 'woff')  return 'woff'
  if (ext === 'otf')   return 'opentype'
  return 'truetype'
}

// Generates @font-face rules for custom uploaded fonts, so `fontStack(name, …)`
// resolves to the uploaded file wherever it's referenced (landing, menu, card).
export function customFontFaceCss(customFonts: Record<string, string>): string {
  return Object.entries(customFonts)
    .map(([name, url]) => `@font-face { font-family: '${name}'; src: url('${url}') format('${fontFileFormat(url)}'); font-display: block; }`)
    .join('\n')
}

// CSS custom properties read by globals.css and the public viewer. Rendered
// server-side in /m/[token] so the very first paint already shows the final
// colors/sizes (ThemeInjector keeps them updated client-side for the preview).
export function themeRootCssVars(theme: RestaurantTheme, menuId?: string | null): string {
  const l = theme.landing, m = resolveMenuTheme(theme, menuId), c = theme.card
  return [
    ':root{',
    `--theme-accent:${l.accent};`,
    `--menu-accent:${m.accent};`,
    `--theme-accent-rgb:${hexToRgb(m.accent)};`,
    `--page-background:${m.pageBackground.color};`,
    `--font-size-title:${m.dishes.titleSize}rem;`,
    `--font-size-base:${m.descriptions.size}rem;`,
    `--font-size-price:${m.prices.size}rem;`,
    `--card-bg:${c.bgColor};`,
    `--card-title-color:${c.title.color};`,
    `--card-price-color:${c.price.color};`,
    '}',
  ].join('')
}

export function fontStack(name: string, category: 'serif' | 'sans'): string {
  const fb = category === 'serif' ? "'Georgia','Times New Roman',serif" : 'system-ui,sans-serif'
  return `'${name}',${fb}`
}

export function landingButtonRadius(shape: LandingTheme['buttons']['shape']): string {
  return shape === 'pill' ? '9999px' : shape === 'rounded' ? '8px' : '0px'
}

export function cardBorderRadius(shape: CardTheme['borderRadius']): string {
  return shape === 'md' ? '16px' : shape === 'sm' ? '8px' : '0px'
}

export function menuBackgroundCss(bg: MenuTheme['background']): Record<string, string> {
  const c  = bg.color
  const c2 = bg.color2 || lightenHex(c, 0.08)
  switch (bg.effect) {
    // ── New premium effects ──
    case 'aurora':           return { background: `linear-gradient(125deg,${c} 0%,${c} 30%,${c2} 55%,${c} 80%,${c2} 100%)`, backgroundImage: `radial-gradient(ellipse 80% 60% at 20% 0%,rgba(120,200,255,0.10) 0%,transparent 55%),radial-gradient(ellipse 70% 55% at 85% 25%,rgba(190,120,255,0.10) 0%,transparent 55%),radial-gradient(ellipse 90% 60% at 50% 100%,rgba(120,255,200,0.08) 0%,transparent 55%)` }
    case 'mesh-warm':        return { background: c, backgroundImage: `radial-gradient(at 18% 22%,rgba(255,180,120,0.14) 0px,transparent 50%),radial-gradient(at 82% 18%,rgba(255,120,140,0.12) 0px,transparent 50%),radial-gradient(at 40% 85%,rgba(255,210,140,0.10) 0px,transparent 50%)` }
    case 'mesh-cool':        return { background: c, backgroundImage: `radial-gradient(at 20% 20%,rgba(120,170,255,0.14) 0px,transparent 50%),radial-gradient(at 80% 25%,rgba(120,230,220,0.12) 0px,transparent 50%),radial-gradient(at 50% 90%,rgba(160,140,255,0.10) 0px,transparent 50%)` }
    case 'spotlight':        return { background: c, backgroundImage: `radial-gradient(ellipse 60% 50% at 50% 0%,${lightenHex(c,0.18)} 0%,${c} 60%)` }
    case 'emerald-mist':     return { background: c, backgroundImage: `radial-gradient(ellipse 70% 55% at 25% 20%,rgba(45,157,90,0.16) 0%,transparent 55%),radial-gradient(ellipse 60% 50% at 80% 80%,rgba(20,120,90,0.12) 0%,transparent 55%)` }
    case 'dots':             return { background: c, backgroundImage: `radial-gradient(rgba(255,255,255,0.07) 1.2px,transparent 1.2px)`, backgroundSize: '18px 18px' }
    case 'diagonal':         return { background: c, backgroundImage: `repeating-linear-gradient(45deg,rgba(255,255,255,0.03) 0,rgba(255,255,255,0.03) 1px,transparent 1px,transparent 11px)` }
    case 'honeycomb':        return { background: c, backgroundImage: `radial-gradient(circle at 50% 0,transparent 8px,rgba(255,255,255,0.04) 9px,transparent 10px),radial-gradient(circle at 0 14px,transparent 8px,rgba(255,255,255,0.04) 9px,transparent 10px),radial-gradient(circle at 100% 14px,transparent 8px,rgba(255,255,255,0.04) 9px,transparent 10px)`, backgroundSize: '28px 28px' }
    case 'waves':            return { background: c, backgroundImage: `repeating-radial-gradient(circle at 50% 120%,transparent 0,transparent 18px,rgba(255,255,255,0.03) 18px,rgba(255,255,255,0.03) 19px)` }
    case 'fine-grain':       return { background: c, backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.05 0 0 0 0'/></filter><rect width='160' height='160' filter='url(%23g)'/></svg>")`, backgroundSize: '160px 160px' }
    // ── Classic effects ──
    case 'linear-gradient':  return { background: `linear-gradient(155deg,${c} 0%,${c2} 100%)` }
    case 'radial-gradient':  return { background: `radial-gradient(ellipse at center,${c2} 0%,${c} 70%)` }
    case 'parchment':        return { background: c, backgroundImage: `radial-gradient(ellipse at 30% 30%,rgba(255,235,180,0.07) 0%,transparent 55%)` }
    case 'vintage':          return { background: c, filter: 'sepia(20%) brightness(80%)' }
    case 'grunge':           return { background: c, backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='6'><rect width='6' height='6' fill='none' stroke='rgba(255,255,255,0.025)' stroke-width='0.5'/></svg>")` }
    case 'slate':            return { background: `linear-gradient(150deg,${c2} 0%,${c} 50%,rgba(0,0,0,0.4) 100%)` }
    case 'carbon':           return { background: c, backgroundImage: `linear-gradient(45deg,rgba(255,255,255,0.03) 25%,transparent 25%),linear-gradient(-45deg,rgba(255,255,255,0.03) 25%,transparent 25%)`, backgroundSize: '4px 4px' }
    case 'linen':            return { background: c, backgroundImage: `repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.015) 2px,rgba(255,255,255,0.015) 4px)` }
    case 'leather':          return { background: `radial-gradient(ellipse at 30% 30%,${c2} 0%,${c} 50%,rgba(0,0,0,0.25) 100%)` }
    case 'sepia':            return { background: c, filter: 'sepia(30%) brightness(85%)' }
    case 'minimal-noise':    return { background: c, backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.04'/></svg>")` }
    case 'retro-grid':       return { background: c, backgroundImage: `linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)`, backgroundSize: '28px 28px' }
    case 'velvet':           return { background: `linear-gradient(135deg,${c2} 0%,${c} 35%,rgba(0,0,0,0.2) 100%)` }
    case 'gold-leaf':        return { background: c, backgroundImage: `radial-gradient(ellipse at 15% 50%,rgba(201,169,110,0.09) 0%,transparent 48%),radial-gradient(ellipse at 85% 20%,rgba(201,169,110,0.06) 0%,transparent 38%)` }
    default:                 return { background: c }
  }
}

export function landingTextureCss(texture: LandingBackground['texture']): Record<string,string> | null {
  // feColorMatrix row A = "0.18 0 0 0 0" → alpha = 0.18 × turbulence-R, producing
  // white pixels whose opacity varies with the noise → a visible grain on dark bgs.
  switch (texture) {
    case 'noise':
      return {
        backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.18 0 0 0 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>")`,
        backgroundSize: '200px 200px',
      }
    case 'grain':
      return {
        backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='turbulence' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.22 0 0 0 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>")`,
        backgroundSize: '200px 200px',
      }
    case 'wood':
      return {
        backgroundImage: `repeating-linear-gradient(92deg,transparent 0px,transparent 2px,rgba(180,130,50,0.06) 2px,rgba(180,130,50,0.06) 3px,transparent 3px,transparent 8px,rgba(180,130,50,0.04) 8px,rgba(180,130,50,0.04) 9px),repeating-linear-gradient(4deg,transparent 0,transparent 50px,rgba(180,130,50,0.03) 50px,rgba(180,130,50,0.03) 51px)`,
        backgroundSize: 'auto',
      }
    case 'marble':
      return {
        backgroundImage: `radial-gradient(ellipse 220% 70% at 18% 48%,rgba(255,255,255,0.09) 0%,transparent 48%),radial-gradient(ellipse 160% 55% at 82% 18%,rgba(255,255,255,0.07) 0%,transparent 42%),repeating-linear-gradient(34deg,transparent,transparent 12px,rgba(255,255,255,0.025) 12px,rgba(255,255,255,0.025) 13px)`,
        backgroundSize: 'auto',
      }
    default: return null
  }
}

export function formatPrice(price: number, format: PriceFormat, currency = '€'): string {
  const n = price.toFixed(2)
  if (format === 'symbol-right') return `${n} ${currency}`
  if (format === 'no-symbol')    return n
  return `${currency} ${n}`
}

/** Resolve a per-element alignment, falling back to the general dish alignment. */
export function resolveAlign(
  elementAlign: AlignOpt,
  general: MenuTheme['layout']['dishAlignment'],
): 'left' | 'center' | 'right' {
  return elementAlign === 'inherit' ? general : elementAlign
}

// Un valore non-hex (theme_config corrotto o modificato a mano) produrrebbe
// "NaN,NaN,NaN" nelle CSS var: meglio ripiegare sull'accent di default.
const isHex6 = (h: string) => /^[0-9a-f]{6}/i.test(h)

export function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  if (!isHex6(h)) return '201,169,110'
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`
}

export function lightenHex(hex: string, amount: number): string {
  const h = hex.replace('#','')
  if (!isHex6(h)) return hex
  const r = Math.round(parseInt(h.slice(0,2),16) + (255-parseInt(h.slice(0,2),16))*amount)
  const g = Math.round(parseInt(h.slice(2,4),16) + (255-parseInt(h.slice(2,4),16))*amount)
  const b = Math.round(parseInt(h.slice(4,6),16) + (255-parseInt(h.slice(4,6),16))*amount)
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}

// Strips alpha from a color so it can be used as a fully opaque "wall"
// background (e.g. behind sticky elements that must hide scrolling content).
export function toOpaqueColor(color: string): string {
  const rgba = color.match(/^rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)$/)
  if (rgba) return `rgb(${rgba[1]},${rgba[2]},${rgba[3]})`
  if (color.startsWith('#') && color.length === 9) return color.slice(0, 7)
  return color
}

function relativeLuminance(color: string): number {
  const parts = hexToRgb(color.startsWith('#') ? color : '#000000').split(',').map(Number)
  const [r, g, b] = parts.map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Neutral grayscale colors for prev/next nav and the page counter in the dish
// card, picked to keep enough contrast against the card background while
// staying within the same gray "tone" used by the rest of the card chrome.
export function cardNavColors(bgColor: string): { active: string; disabled: string; counter: string; divider: string } {
  const dark = relativeLuminance(bgColor) < 0.4
  return dark
    ? { active: '#9a9a9a', disabled: '#3c3c3c', counter: '#707070', divider: '#262626' }
    : { active: '#5c5c5c', disabled: '#c4c4c4', counter: '#7e7e7e', divider: '#dcdcdc' }
}
