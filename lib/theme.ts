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

export const MENU_BG_EFFECTS: MenuBgEffect[] = [
  'none','linear-gradient','radial-gradient','parchment','vintage',
  'grunge','slate','carbon','linen','leather','sepia',
  'minimal-noise','retro-grid','velvet','gold-leaf',
]

export const MENU_BG_EFFECT_LABELS: Record<MenuBgEffect, string> = {
  'none':            'Nessuno',
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

// ── Landing sub-theme ─────────────────────────────────────────────────────────

export interface LandingBackground {
  type:                'color' | 'image' | 'video' | 'gif'
  value:               string       // hex (for color) or storage URL
  opacity:             number       // 0–100
  loopMode:            'loop' | 'once'
  texture:             'none' | 'noise' | 'grain' | 'wood' | 'marble'
  immersiveTransition: boolean
  poster?:             string
}

export interface LandingTheme {
  background:  LandingBackground
  accent:      string
  logo:        { size: number; mixBlend: 'normal' | 'multiply' | 'screen' }
  title:       { font: string; size: number; color: string; weight: 'light' | 'normal' | 'bold' }
  description: { font: string; size: number; color: string }
  buttons: {
    shape:       'flat' | 'rounded' | 'pill'
    borderStyle: 'none' | 'solid' | 'dashed'
    borderColor: string
    font:        string
    fontSize:    number
    textColor:   string
    bgColor:     string
  }
  socials: { color: string }
}

// ── Menu sub-theme ────────────────────────────────────────────────────────────

export interface MenuTheme {
  accent:         string
  background:     { color: string; effect: MenuBgEffect }
  pageBackground: string
  pdfLayout:      'classic' | 'compact'
  layout: {
    dishLayout:    'list' | 'grid-2' | 'boxed-card' | 'minimal-row'
    dishAlignment: 'left' | 'center' | 'right'
    dishSpacing:   number
    divider:       { type: 'none' | 'solid' | 'dashed' | 'dotted' | 'double'; color: string }
  }
  dishes:       { titleFont: string; titleSize: number; titleColor: string }
  descriptions: { font: string; size: number; color: string }
  allergens:    { style: 'text' | 'badge'; color: string; bgColor: string }
  prices:       { font: string; size: number; color: string; format: 'symbol-left' | 'symbol-right' | 'no-symbol' }
  categories:   { font: string; color: string }
  stickyCategories: {
    style:     'transparent-blur' | 'solid' | 'none'
    bgColor:   string
    textColor: string
    font:      string
  }
  navigation: { style: PaginationStyle; color: string }
  banners:    { position: 'inline' | 'dedicated-page' }
}

// ── Root ──────────────────────────────────────────────────────────────────────

export interface RestaurantTheme {
  landing: LandingTheme
  menu:    MenuTheme
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
    logo:        { size: 3.5, mixBlend: 'normal' },
    title:       { font: 'Cormorant Garamond', size: 2.0, color: '#ede8e0', weight: 'light' },
    description: { font: 'DM Sans', size: 0.6, color: '#c9a96e80' },
    buttons: {
      shape: 'flat', borderStyle: 'solid', borderColor: '#c9a96e',
      font: 'DM Sans', fontSize: 0.625, textColor: '#ede8e0', bgColor: 'transparent',
    },
    socials: { color: '#c9a96e' },
  },
  menu: {
    accent:         '#c9a96e',
    background:     { color: '#0d0d0d', effect: 'none' },
    pageBackground: '#ffffff',
    pdfLayout:      'classic',
    layout: {
      dishLayout:    'list',
      dishAlignment: 'left',
      dishSpacing:   0,
      divider:       { type: 'solid', color: '#ece6da' },
    },
    dishes:       { titleFont: 'Cormorant Garamond', titleSize: 1.75, titleColor: '#ede8e0' },
    descriptions: { font: 'DM Sans', size: 0.875, color: '#a09080' },
    allergens:    { style: 'text', color: '#c9a96e', bgColor: '#181208' },
    prices:       { font: 'DM Sans', size: 1.1, color: '#c9a96e', format: 'symbol-left' },
    categories:   { font: 'Cormorant Garamond', color: '#1a1a1a' },
    stickyCategories: {
      style: 'solid', bgColor: 'rgba(7,7,7,0.96)', textColor: '#4f4f4f', font: 'DM Sans',
    },
    navigation: { style: 'prec_succ', color: '#4f4f4f' },
    banners:    { position: 'inline' },
  },
}

// ── Parse helpers ─────────────────────────────────────────────────────────────

function str(v: unknown, fb: string): string { return typeof v === 'string' ? v : fb }
function num(v: unknown, fb: number): number { return typeof v === 'number' ? v : fb }
function one<T extends string>(v: unknown, opts: readonly T[], fb: T): T {
  return (opts as readonly unknown[]).includes(v) ? v as T : fb
}
function sub(v: unknown): Record<string, unknown> {
  return (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
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
  const d  = DEFAULT_THEME
  const l  = sub(r.landing)
  const m  = sub(r.menu)
  const lb = sub(l.background)
  const ll = sub(l.logo)
  const lt = sub(l.title)
  const ld = sub(l.description)
  const bu = sub(l.buttons)
  const ls = sub(l.socials)
  const mb = sub(m.background)
  const ml = sub(m.layout)
  const md = sub(ml.divider)
  const mi = sub(m.dishes)
  const me = sub(m.descriptions)
  const ma = sub(m.allergens)
  const mp = sub(m.prices)
  const mc = sub(m.categories)
  const ms = sub(m.stickyCategories)
  const mn = sub(m.navigation)
  const mbn = sub(m.banners)

  return {
    landing: {
      background: {
        type:                one(lb.type, ['color','image','video','gif'] as const, d.landing.background.type),
        value:               str(lb.value, d.landing.background.value),
        opacity:             num(lb.opacity, d.landing.background.opacity),
        loopMode:            one(lb.loopMode, ['loop','once'] as const, d.landing.background.loopMode),
        texture:             one(lb.texture, ['none','noise','grain','wood','marble'] as const, d.landing.background.texture),
        immersiveTransition: lb.immersiveTransition === true,
        poster:              str(lb.poster, '') || undefined,
      },
      accent:      str(l.accent, d.landing.accent),
      logo:        { size: num(ll.size, d.landing.logo.size), mixBlend: one(ll.mixBlend, ['normal','multiply','screen'] as const, d.landing.logo.mixBlend) },
      title:       { font: str(lt.font, d.landing.title.font), size: num(lt.size, d.landing.title.size), color: str(lt.color, d.landing.title.color), weight: one(lt.weight, ['light','normal','bold'] as const, d.landing.title.weight) },
      description: { font: str(ld.font, d.landing.description.font), size: num(ld.size, d.landing.description.size), color: str(ld.color, d.landing.description.color) },
      buttons: {
        shape:       one(bu.shape, ['flat','rounded','pill'] as const, d.landing.buttons.shape),
        borderStyle: one(bu.borderStyle, ['none','solid','dashed'] as const, d.landing.buttons.borderStyle),
        borderColor: str(bu.borderColor, d.landing.buttons.borderColor),
        font:        str(bu.font, d.landing.buttons.font),
        fontSize:    num(bu.fontSize, d.landing.buttons.fontSize),
        textColor:   str(bu.textColor, d.landing.buttons.textColor),
        bgColor:     str(bu.bgColor, d.landing.buttons.bgColor),
      },
      socials: { color: str(ls.color, d.landing.socials.color) },
    },
    menu: {
      accent:         str(m.accent, d.menu.accent),
      background:     { color: str(mb.color, d.menu.background.color), effect: one(mb.effect, MENU_BG_EFFECTS as readonly MenuBgEffect[], d.menu.background.effect) },
      pageBackground: str(m.pageBackground, d.menu.pageBackground),
      pdfLayout:      one(m.pdfLayout, ['classic','compact'] as const, d.menu.pdfLayout),
      layout: {
        dishLayout:    one(ml.dishLayout, ['list','grid-2','boxed-card','minimal-row'] as const, d.menu.layout.dishLayout),
        dishAlignment: one(ml.dishAlignment, ['left','center','right'] as const, d.menu.layout.dishAlignment),
        dishSpacing:   num(ml.dishSpacing, d.menu.layout.dishSpacing),
        divider:       { type: one(md.type, ['none','solid','dashed','dotted','double'] as const, d.menu.layout.divider.type), color: str(md.color, d.menu.layout.divider.color) },
      },
      dishes:       { titleFont: str(mi.titleFont, d.menu.dishes.titleFont), titleSize: num(mi.titleSize, d.menu.dishes.titleSize), titleColor: str(mi.titleColor, d.menu.dishes.titleColor) },
      descriptions: { font: str(me.font, d.menu.descriptions.font), size: num(me.size, d.menu.descriptions.size), color: str(me.color, d.menu.descriptions.color) },
      allergens:    { style: one(ma.style, ['text','badge'] as const, d.menu.allergens.style), color: str(ma.color, d.menu.allergens.color), bgColor: str(ma.bgColor, d.menu.allergens.bgColor) },
      prices:       { font: str(mp.font, d.menu.prices.font), size: num(mp.size, d.menu.prices.size), color: str(mp.color, d.menu.prices.color), format: one(mp.format, ['symbol-left','symbol-right','no-symbol'] as const, d.menu.prices.format) },
      categories:   { font: str(mc.font, d.menu.categories.font), color: str(mc.color, d.menu.categories.color) },
      stickyCategories: {
        style:     one(ms.style, ['transparent-blur','solid','none'] as const, d.menu.stickyCategories.style),
        bgColor:   str(ms.bgColor, d.menu.stickyCategories.bgColor),
        textColor: str(ms.textColor, d.menu.stickyCategories.textColor),
        font:      str(ms.font, d.menu.stickyCategories.font),
      },
      navigation: {
        style: one(mn.style, Object.keys(PAGINATION_OPTIONS) as PaginationStyle[], d.menu.navigation.style),
        color: str(mn.color, d.menu.navigation.color),
      },
      banners: { position: one(mbn.position, ['inline','dedicated-page'] as const, d.menu.banners.position) },
    },
  }
}

function migrateFlat(r: Record<string, unknown>): RestaurantTheme {
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
    r.stickyCategoryStyle === 'transparent-blur' ? 'transparent-blur'
    : r.stickyCategoryStyle === 'none' ? 'none' : 'solid'

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
      logo:        { size: 3.5, mixBlend: 'normal' },
      title:       { font: fontSerif, size: num(fs.title, d.landing.title.size), color: textPrimary, weight: 'light' },
      description: { font: fontSans, size: 0.6, color: `${accent}80` },
      buttons: {
        shape: buttonShape, borderStyle: 'solid', borderColor: accent,
        font: fontSans, fontSize: 0.625, textColor: textPrimary, bgColor: 'transparent',
      },
      socials: { color: accent },
    },
    menu: {
      accent,
      background:     { color: appBg, effect: 'none' },
      pageBackground: str(r.pageBackground, d.menu.pageBackground),
      pdfLayout:      r.pdfLayout === 'compact' ? 'compact' : 'classic',
      layout: {
        dishLayout, dishAlignment, dishSpacing: 0,
        divider: { type: dividerType, color: '#ece6da' },
      },
      dishes:       { titleFont: fontSerif, titleSize: num(fs.title, d.menu.dishes.titleSize), titleColor: '#ede8e0' },
      descriptions: { font: fontSans, size: num(fs.base, d.menu.descriptions.size), color: '#a09080' },
      allergens:    { style: 'text', color: accent, bgColor: '#181208' },
      prices:       { font: fontSans, size: num(fs.price, d.menu.prices.size), color: accent, format: priceFormat },
      categories:   { font: fontSerif, color: '#1a1a1a' },
      stickyCategories: { style: stickyCatStyle, bgColor: navBg, textColor: textMuted, font: fontSans },
      navigation:   { style: paginationStyle, color: textMuted },
      banners:      { position: 'inline' },
    },
  }
}

// ── Font catalog ──────────────────────────────────────────────────────────────

export const SERIF_FONTS = [
  'Cormorant Garamond', 'Playfair Display', 'Bodoni Moda',
  'EB Garamond', 'Lora', 'Libre Baskerville', 'Josefin Slab',
]

export const SANS_FONTS = [
  'DM Sans', 'Inter', 'Montserrat', 'Poppins',
  'Raleway', 'Josefin Sans', 'Oswald', 'Roboto',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

export function allThemeFonts(theme: RestaurantTheme): string[] {
  const all = [
    theme.landing.title.font, theme.landing.buttons.font,
    theme.landing.description.font,
    theme.menu.dishes.titleFont, theme.menu.descriptions.font,
    theme.menu.prices.font, theme.menu.categories.font,
    theme.menu.stickyCategories.font,
  ]
  return all.filter((f, i, a) => f && a.indexOf(f) === i)
}

export function googleFontsUrl(fonts: string[]): string {
  const filtered = fonts.filter(Boolean)
  const unique = filtered.filter((f, i) => filtered.indexOf(f) === i)
  if (!unique.length) return ''
  const families = unique
    .map(f => `family=${encodeURIComponent(f)}:ital,wght@0,300;0,400;0,600;1,400`)
    .join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

export function fontStack(name: string, category: 'serif' | 'sans'): string {
  const fb = category === 'serif' ? "'Georgia','Times New Roman',serif" : 'system-ui,sans-serif'
  return `'${name}',${fb}`
}

export function landingButtonRadius(shape: LandingTheme['buttons']['shape']): string {
  return shape === 'pill' ? '9999px' : shape === 'rounded' ? '8px' : '0px'
}

export function menuBackgroundCss(bg: MenuTheme['background']): Record<string, string> {
  const c = bg.color
  switch (bg.effect) {
    case 'linear-gradient':  return { background: `linear-gradient(155deg,${c} 0%,${lightenHex(c,0.08)} 100%)` }
    case 'radial-gradient':  return { background: `radial-gradient(ellipse at center,${lightenHex(c,0.12)} 0%,${c} 70%)` }
    case 'parchment':        return { background: c, backgroundImage: `radial-gradient(ellipse at 30% 30%,rgba(255,235,180,0.07) 0%,transparent 55%)` }
    case 'vintage':          return { background: c, filter: 'sepia(20%) brightness(80%)' }
    case 'grunge':           return { background: c, backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='6'><rect width='6' height='6' fill='none' stroke='rgba(255,255,255,0.025)' stroke-width='0.5'/></svg>")` }
    case 'slate':            return { background: `linear-gradient(150deg,#2a3142 0%,${c} 50%,#1c2130 100%)` }
    case 'carbon':           return { background: c, backgroundImage: `linear-gradient(45deg,rgba(255,255,255,0.03) 25%,transparent 25%),linear-gradient(-45deg,rgba(255,255,255,0.03) 25%,transparent 25%)`, backgroundSize: '4px 4px' }
    case 'linen':            return { background: c, backgroundImage: `repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.015) 2px,rgba(255,255,255,0.015) 4px)` }
    case 'leather':          return { background: `radial-gradient(ellipse at 30% 30%,${lightenHex(c,0.1)} 0%,${c} 50%,rgba(0,0,0,0.25) 100%)` }
    case 'sepia':            return { background: c, filter: 'sepia(30%) brightness(85%)' }
    case 'minimal-noise':    return { background: c, backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.04'/></svg>")` }
    case 'retro-grid':       return { background: c, backgroundImage: `linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)`, backgroundSize: '28px 28px' }
    case 'velvet':           return { background: `linear-gradient(135deg,${lightenHex(c,0.06)} 0%,${c} 35%,rgba(0,0,0,0.2) 100%)` }
    case 'gold-leaf':        return { background: c, backgroundImage: `radial-gradient(ellipse at 15% 50%,rgba(201,169,110,0.09) 0%,transparent 48%),radial-gradient(ellipse at 85% 20%,rgba(201,169,110,0.06) 0%,transparent 38%)` }
    default:                 return { background: c }
  }
}

export function landingTextureCss(texture: LandingBackground['texture']): string {
  switch (texture) {
    case 'noise':  return `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.65' numOctaves='3'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.06'/></svg>")`
    case 'grain':  return `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.05'/></svg>")`
    case 'wood':   return `repeating-linear-gradient(95deg,transparent,transparent 1px,rgba(255,200,100,0.02) 1px,rgba(255,200,100,0.02) 3px)`
    case 'marble': return `radial-gradient(ellipse at 20% 50%,rgba(255,255,255,0.04) 0%,transparent 40%),radial-gradient(ellipse at 80% 20%,rgba(255,255,255,0.03) 0%,transparent 35%)`
    default:       return ''
  }
}

export function formatPrice(price: number, format: MenuTheme['prices']['format']): string {
  const n = price.toFixed(2)
  if (format === 'symbol-right') return `${n} €`
  if (format === 'no-symbol')    return n
  return `€ ${n}`
}

export function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length < 6) return '201,169,110'
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`
}

export function lightenHex(hex: string, amount: number): string {
  const h = hex.replace('#','')
  if (h.length < 6) return hex
  const r = Math.round(parseInt(h.slice(0,2),16) + (255-parseInt(h.slice(0,2),16))*amount)
  const g = Math.round(parseInt(h.slice(2,4),16) + (255-parseInt(h.slice(2,4),16))*amount)
  const b = Math.round(parseInt(h.slice(4,6),16) + (255-parseInt(h.slice(4,6),16))*amount)
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}
