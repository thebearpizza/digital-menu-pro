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
  borderRadius: 'none' | 'sm' | 'md'   // 0 / 8 / 16px
  layout:      'photo-top' | 'photo-side' | 'minimal'
  title:       { font: string; size: number; color: string; weight: 'light' | 'normal' | 'bold' }
  description: { font: string; size: number; color: string }
  price:       { font: string; size: number; color: string; format: PriceFormat; currency: string }
  allergens:   { style: 'text' | 'badge'; color: string; bgColor: string; display: AllergenDisplay; separator: string }
  closeButton: { color: string; position: 'top-right' | 'top-left'; shape: 'none' | 'circle' | 'square' }
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
  logo:        { size: number; mixBlend: 'normal' | 'multiply' | 'screen' }
  title:       { font: string; size: number; color: string; weight: 'light' | 'normal' | 'bold' }
  description: { font: string; size: number; color: string }
  buttons: {
    shape:       'flat' | 'rounded' | 'pill'
    borderStyle: 'none' | 'solid' | 'dashed'
    borderWidth: number
    borderColor: string
    font:        string
    fontSize:    number
    textColor:   string
    bgColor:     string
  }
  socials: { color: string; size: number; style: 'minimal' | 'circle' | 'box' | 'outline' }
}

// ── Menu sub-theme ────────────────────────────────────────────────────────────

export type DividerType = 'none' | 'solid' | 'dashed' | 'dotted' | 'double' | 'gradient' | 'ornament'

export interface MenuTheme {
  accent:         string
  background:     { color: string; color2: string; effect: MenuBgEffect; image: string; imageOpacity: number }
  pageBackground: string
  pdfLayout:      'classic' | 'compact'
  layout: {
    dishLayout:       'list' | 'grid-2' | 'boxed-card' | 'minimal-row'
    dishAlignment:    'left' | 'center' | 'right'
    dishSpacing:      number
    boxedBorderWidth: number
    divider:          { type: DividerType; color: string }
  }
  dishes:       { titleFont: string; titleSize: number; titleColor: string; align: AlignOpt }
  descriptions: { font: string; size: number; color: string; align: AlignOpt }
  allergens:    { style: 'text' | 'badge'; color: string; bgColor: string; display: AllergenDisplay; separator: string }
  prices:       { font: string; size: number; color: string; format: PriceFormat; currency: string; position: PricePosition; align: AlignOpt }
  categories:   { font: string; color: string; size: number; align: AlignOpt }
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
  card:    CardTheme
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
      shape: 'flat', borderStyle: 'solid', borderWidth: 1, borderColor: '#c9a96e',
      font: 'DM Sans', fontSize: 0.625, textColor: '#ede8e0', bgColor: 'transparent',
    },
    socials: { color: '#c9a96e', size: 1.25, style: 'minimal' },
  },
  menu: {
    accent:         '#c9a96e',
    background:     { color: '#0d0d0d', color2: '#1a1a1a', effect: 'none', image: '', imageOpacity: 100 },
    pageBackground: '#ffffff',
    pdfLayout:      'classic',
    layout: {
      dishLayout:       'list',
      dishAlignment:    'left',
      dishSpacing:      0,
      boxedBorderWidth: 1,
      divider:          { type: 'solid', color: '#ece6da' },
    },
    dishes:       { titleFont: 'Cormorant Garamond', titleSize: 1.75, titleColor: '#ede8e0', align: 'inherit' },
    descriptions: { font: 'DM Sans', size: 0.875, color: '#a09080', align: 'inherit' },
    allergens:    { style: 'text', color: '#c9a96e', bgColor: '#181208', display: 'full', separator: ', ' },
    prices:       { font: 'DM Sans', size: 1.1, color: '#c9a96e', format: 'symbol-left', currency: '€', position: 'right', align: 'inherit' },
    categories:   { font: 'Cormorant Garamond', color: '#1a1a1a', size: 1.3, align: 'inherit' },
    stickyCategories: {
      style: 'solid', bgColor: 'rgba(7,7,7,0.96)', textColor: '#4f4f4f', font: 'DM Sans',
    },
    navigation: { style: 'prec_succ', color: '#4f4f4f' },
    banners:    { position: 'inline' },
  },
  card: {
    bgColor:      '#111111',
    borderRadius: 'sm',
    layout:  'photo-top',
    title:       { font: 'Cormorant Garamond', size: 1.75, color: '#ede8e0', weight: 'light' },
    description: { font: 'DM Sans', size: 0.875, color: '#a09080' },
    price:       { font: 'DM Sans', size: 1.1, color: '#c9a96e', format: 'symbol-left', currency: '€' },
    allergens:   { style: 'text', color: '#c9a96e', bgColor: '#181208', display: 'full', separator: ', ' },
    closeButton: { color: '#555555', position: 'top-right', shape: 'none' },
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
  const d   = DEFAULT_THEME
  const l   = sub(r.landing)
  const m   = sub(r.menu)
  const lb  = sub(l.background)
  const ll  = sub(l.logo)
  const lt  = sub(l.title)
  const ld  = sub(l.description)
  const bu  = sub(l.buttons)
  const ls  = sub(l.socials)
  const mb  = sub(m.background)
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
  const ca  = sub(r.card)
  const cat = sub(ca.title)
  const cad = sub(ca.description)
  const cap = sub(ca.price)
  const caa = sub(ca.allergens)
  const cab = sub(ca.closeButton)

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
      logo:        { size: num(ll.size, d.landing.logo.size), mixBlend: one(ll.mixBlend, ['normal','multiply','screen'] as const, d.landing.logo.mixBlend) },
      title:       { font: str(lt.font, d.landing.title.font), size: num(lt.size, d.landing.title.size), color: str(lt.color, d.landing.title.color), weight: one(lt.weight, ['light','normal','bold'] as const, d.landing.title.weight) },
      description: { font: str(ld.font, d.landing.description.font), size: num(ld.size, d.landing.description.size), color: str(ld.color, d.landing.description.color) },
      buttons: {
        shape:       one(bu.shape, ['flat','rounded','pill'] as const, d.landing.buttons.shape),
        borderStyle: one(bu.borderStyle, ['none','solid','dashed'] as const, d.landing.buttons.borderStyle),
        borderWidth: num(bu.borderWidth, d.landing.buttons.borderWidth),
        borderColor: str(bu.borderColor, d.landing.buttons.borderColor),
        font:        str(bu.font, d.landing.buttons.font),
        fontSize:    num(bu.fontSize, d.landing.buttons.fontSize),
        textColor:   str(bu.textColor, d.landing.buttons.textColor),
        bgColor:     str(bu.bgColor, d.landing.buttons.bgColor),
      },
      socials: {
        color: str(ls.color, d.landing.socials.color),
        size:  num(ls.size, d.landing.socials.size),
        style: one(ls.style, ['minimal','circle','box','outline'] as const, d.landing.socials.style),
      },
    },
    menu: {
      accent:         str(m.accent, d.menu.accent),
      background:     {
        color:  str(mb.color, d.menu.background.color),
        color2: str(mb.color2, d.menu.background.color2),
        effect: one(mb.effect, MENU_BG_EFFECTS as readonly MenuBgEffect[], d.menu.background.effect),
        image:  str(mb.image, d.menu.background.image),
        imageOpacity: num(mb.imageOpacity, d.menu.background.imageOpacity),
      },
      pageBackground: str(m.pageBackground, d.menu.pageBackground),
      pdfLayout:      one(m.pdfLayout, ['classic','compact'] as const, d.menu.pdfLayout),
      layout: {
        dishLayout:       one(ml.dishLayout, ['list','grid-2','boxed-card','minimal-row'] as const, d.menu.layout.dishLayout),
        dishAlignment:    one(ml.dishAlignment, ['left','center','right'] as const, d.menu.layout.dishAlignment),
        dishSpacing:      num(ml.dishSpacing, d.menu.layout.dishSpacing),
        boxedBorderWidth: num(ml.boxedBorderWidth, d.menu.layout.boxedBorderWidth),
        divider:          { type: one(md.type, ['none','solid','dashed','dotted','double','gradient','ornament'] as const, d.menu.layout.divider.type), color: str(md.color, d.menu.layout.divider.color) },
      },
      dishes:       { titleFont: str(mi.titleFont, d.menu.dishes.titleFont), titleSize: num(mi.titleSize, d.menu.dishes.titleSize), titleColor: str(mi.titleColor, d.menu.dishes.titleColor), align: one(mi.align, ['inherit','left','center','right'] as const, d.menu.dishes.align) },
      descriptions: { font: str(me.font, d.menu.descriptions.font), size: num(me.size, d.menu.descriptions.size), color: str(me.color, d.menu.descriptions.color), align: one(me.align, ['inherit','left','center','right'] as const, d.menu.descriptions.align) },
      allergens:    { style: one(ma.style, ['text','badge'] as const, d.menu.allergens.style), color: str(ma.color, d.menu.allergens.color), bgColor: str(ma.bgColor, d.menu.allergens.bgColor), display: one(ma.display, ['full','short','number'] as const, d.menu.allergens.display), separator: str(ma.separator, d.menu.allergens.separator) },
      prices:       { font: str(mp.font, d.menu.prices.font), size: num(mp.size, d.menu.prices.size), color: str(mp.color, d.menu.prices.color), format: one(mp.format, ['symbol-left','symbol-right','no-symbol'] as const, d.menu.prices.format), currency: str(mp.currency, d.menu.prices.currency), position: one(mp.position, ['left','right','above','below'] as const, d.menu.prices.position), align: one(mp.align, ['inherit','left','center','right'] as const, d.menu.prices.align) },
      categories:   { font: str(mc.font, d.menu.categories.font), color: str(mc.color, d.menu.categories.color), size: num(mc.size, d.menu.categories.size), align: one(mc.align, ['inherit','left','center','right'] as const, d.menu.categories.align) },
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
    card: {
      bgColor:      str(ca.bgColor, d.card.bgColor),
      borderRadius: one(ca.borderRadius, ['none','sm','md'] as const, d.card.borderRadius),
      layout:       one(ca.layout, ['photo-top','photo-side','minimal'] as const, d.card.layout),
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
      },
      closeButton: {
        color:    str(cab.color, d.card.closeButton.color),
        position: one(cab.position, ['top-right','top-left'] as const, d.card.closeButton.position),
        shape:    one(cab.shape, ['none','circle','square'] as const, d.card.closeButton.shape),
      },
    },
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
        shape: buttonShape, borderStyle: 'solid', borderWidth: 1, borderColor: accent,
        font: fontSans, fontSize: 0.625, textColor: textPrimary, bgColor: 'transparent',
      },
      socials: { color: accent, size: 1.25, style: 'minimal' },
    },
    menu: {
      accent,
      background:     { color: appBg, color2: d.menu.background.color2, effect: 'none', image: '', imageOpacity: 100 },
      pageBackground: str(r.pageBackground, d.menu.pageBackground),
      pdfLayout:      r.pdfLayout === 'compact' ? 'compact' : 'classic',
      layout: {
        dishLayout, dishAlignment, dishSpacing: 0, boxedBorderWidth: 1,
        divider: { type: dividerType, color: '#ece6da' },
      },
      dishes:       { titleFont: fontSerif, titleSize: num(fs.title, d.menu.dishes.titleSize), titleColor: '#ede8e0', align: 'inherit' },
      descriptions: { font: fontSans, size: num(fs.base, d.menu.descriptions.size), color: '#a09080', align: 'inherit' },
      allergens:    { style: 'text', color: accent, bgColor: '#181208', display: 'full', separator: ', ' },
      prices:       { font: fontSans, size: num(fs.price, d.menu.prices.size), color: accent, format: priceFormat, currency: '€', position: 'right', align: 'inherit' },
      categories:   { font: fontSerif, color: '#1a1a1a', size: 1.3, align: 'inherit' },
      stickyCategories: { style: stickyCatStyle, bgColor: navBg, textColor: textMuted, font: fontSans },
      navigation:   { style: paginationStyle, color: textMuted },
      banners:      { position: 'inline' },
    },
    card: structuredClone(d.card),
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
    theme.card.title.font, theme.card.description.font, theme.card.price.font,
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

// ── Theme Presets ─────────────────────────────────────────────────────────────

export interface ThemePreset { name: string; theme: RestaurantTheme }

function p(name: string, landing: Record<string,unknown> = {}, menu: Record<string,unknown> = {}, card: Record<string,unknown> = {}): ThemePreset {
  return { name, theme: parseTheme({ landing, menu, card }) }
}

export const THEME_PRESETS: ThemePreset[] = [
  // 1. Luxury Gold
  p('Luxury Gold',
    { accent: '#c9a96e', background: { type: 'color', value: '#0d0d0d' }, title: { font: 'Cormorant Garamond', color: '#ede8e0', weight: 'light' }, buttons: { shape: 'flat', borderStyle: 'solid', borderColor: '#c9a96e', bgColor: 'transparent', textColor: '#ede8e0' } },
    { accent: '#c9a96e', background: { color: '#0d0d0d', color2: '#1a1a1a', effect: 'none' } },
    { bgColor: '#111111', title: { color: '#ede8e0' }, price: { color: '#c9a96e' } }),

  // 2. Midnight Ocean
  p('Midnight Ocean',
    { accent: '#4a9abb', background: { type: 'color', value: '#0a1628' }, title: { font: 'Playfair Display', color: '#d0e8f0', weight: 'normal' }, buttons: { shape: 'rounded', borderStyle: 'solid', borderColor: '#4a9abb', bgColor: 'transparent', textColor: '#d0e8f0' } },
    { accent: '#4a9abb', background: { color: '#0a1628', color2: '#0d2040', effect: 'none' } },
    { bgColor: '#0e1f36', title: { color: '#d0e8f0' }, price: { color: '#4a9abb' } }),

  // 3. Minimal Nordic
  p('Minimal Nordic',
    { accent: '#333333', background: { type: 'color', value: '#f5f5f0' }, title: { font: 'Inter', color: '#111111', weight: 'normal' }, buttons: { shape: 'pill', borderStyle: 'solid', borderColor: '#333333', bgColor: 'transparent', textColor: '#111111' } },
    { accent: '#333333', background: { color: '#ffffff', color2: '#f5f5f0', effect: 'none' } },
    { bgColor: '#f5f5f0', title: { font: 'Inter', color: '#111111', weight: 'normal' }, price: { color: '#333333' } }),

  // 4. Rustic Trattoria
  p('Rustic Trattoria',
    { accent: '#8b4513', background: { type: 'color', value: '#1a0f08' }, title: { font: 'Lora', color: '#f0dfc0', weight: 'normal' }, buttons: { shape: 'rounded', borderStyle: 'solid', borderColor: '#8b4513', bgColor: 'transparent', textColor: '#f0dfc0' } },
    { accent: '#8b4513', background: { color: '#1a0f08', color2: '#2a1a0a', effect: 'leather' } },
    { bgColor: '#1e1208', title: { font: 'Lora', color: '#f0dfc0' }, price: { color: '#8b4513' } }),

  // 5. Cyberpunk Neon
  p('Cyberpunk Neon',
    { accent: '#00ff88', background: { type: 'color', value: '#050510' }, title: { font: 'Inter', color: '#00ff88', weight: 'bold' }, buttons: { shape: 'pill', borderStyle: 'solid', borderColor: '#00ff88', bgColor: 'transparent', textColor: '#00ff88' } },
    { accent: '#00ff88', background: { color: '#050510', color2: '#0a0a1e', effect: 'retro-grid' } },
    { bgColor: '#08081a', title: { font: 'Inter', color: '#00ff88', weight: 'bold' }, price: { color: '#00ff88' } }),

  // 6. Vintage Bistrot
  p('Vintage Bistrot',
    { accent: '#8b7355', background: { type: 'color', value: '#1c1510' }, title: { font: 'EB Garamond', color: '#e8d5b0', weight: 'normal' }, buttons: { shape: 'flat', borderStyle: 'dashed', borderColor: '#8b7355', bgColor: 'transparent', textColor: '#e8d5b0' } },
    { accent: '#8b7355', background: { color: '#1c1510', color2: '#2a1e10', effect: 'sepia' } },
    { bgColor: '#201508', title: { font: 'EB Garamond', color: '#e8d5b0' }, price: { color: '#8b7355' } }),

  // 7. Rose Romance
  p('Rose Romance',
    { accent: '#d4808b', background: { type: 'color', value: '#150a0d' }, title: { font: 'Bodoni Moda', color: '#f0d0d8', weight: 'light' }, buttons: { shape: 'rounded', borderStyle: 'solid', borderColor: '#d4808b', bgColor: 'transparent', textColor: '#f0d0d8' } },
    { accent: '#d4808b', background: { color: '#150a0d', color2: '#200d12', effect: 'velvet' } },
    { bgColor: '#1a0c10', title: { font: 'Bodoni Moda', color: '#f0d0d8' }, price: { color: '#d4808b' } }),

  // 8. Forest Escape
  p('Forest Escape',
    { accent: '#4a7c59', background: { type: 'color', value: '#0a1208' }, title: { font: 'Cormorant Garamond', color: '#c8e0c8', weight: 'light' }, buttons: { shape: 'flat', borderStyle: 'solid', borderColor: '#4a7c59', bgColor: 'transparent', textColor: '#c8e0c8' } },
    { accent: '#4a7c59', background: { color: '#0a1208', color2: '#101a0e', effect: 'none' } },
    { bgColor: '#0d160a', title: { color: '#c8e0c8' }, price: { color: '#4a7c59' } }),

  // 9. Mediterranean
  p('Mediterranean',
    { accent: '#2e8fd9', background: { type: 'color', value: '#0a1520' }, title: { font: 'Libre Baskerville', color: '#c8dff0', weight: 'normal' }, buttons: { shape: 'rounded', borderStyle: 'solid', borderColor: '#2e8fd9', bgColor: 'transparent', textColor: '#c8dff0' } },
    { accent: '#2e8fd9', background: { color: '#0a1520', color2: '#0d1e2e', effect: 'none' } },
    { bgColor: '#0e1c2e', title: { font: 'Libre Baskerville', color: '#c8dff0' }, price: { color: '#2e8fd9' } }),

  // 10. Tokyo Red
  p('Tokyo Red',
    { accent: '#e63946', background: { type: 'color', value: '#0f0f0f' }, title: { font: 'DM Sans', color: '#f0e8e8', weight: 'bold' }, buttons: { shape: 'flat', borderStyle: 'none', borderColor: '#e63946', bgColor: '#e63946', textColor: '#ffffff' } },
    { accent: '#e63946', background: { color: '#0f0f0f', color2: '#1a0808', effect: 'minimal-noise' } },
    { bgColor: '#141010', title: { font: 'DM Sans', color: '#f0e8e8', weight: 'bold' }, price: { color: '#e63946' } }),

  // 11. Dark Marble
  p('Dark Marble',
    { accent: '#d4af37', background: { type: 'color', value: '#111111' }, title: { font: 'Bodoni Moda', color: '#ede8e0', weight: 'light' }, buttons: { shape: 'flat', borderStyle: 'solid', borderColor: '#d4af37', bgColor: 'transparent', textColor: '#ede8e0' } },
    { accent: '#d4af37', background: { color: '#111111', color2: '#1c1c1c', effect: 'minimal-noise' } },
    { bgColor: '#151515', title: { font: 'Bodoni Moda', color: '#ede8e0' }, price: { color: '#d4af37' } }),

  // 12. Coral Summer
  p('Coral Summer',
    { accent: '#ff7f6e', background: { type: 'color', value: '#120806' }, title: { font: 'Playfair Display', color: '#ffe0d8', weight: 'normal' }, buttons: { shape: 'pill', borderStyle: 'solid', borderColor: '#ff7f6e', bgColor: 'transparent', textColor: '#ffe0d8' } },
    { accent: '#ff7f6e', background: { color: '#120806', color2: '#1e0e0a', effect: 'none' } },
    { bgColor: '#180a08', title: { font: 'Playfair Display', color: '#ffe0d8' }, price: { color: '#ff7f6e' } }),

  // 13. Autumn Harvest
  p('Autumn Harvest',
    { accent: '#c84b31', background: { type: 'color', value: '#140b08' }, title: { font: 'Lora', color: '#f0d8c0', weight: 'normal' }, buttons: { shape: 'rounded', borderStyle: 'solid', borderColor: '#c84b31', bgColor: 'transparent', textColor: '#f0d8c0' } },
    { accent: '#c84b31', background: { color: '#140b08', color2: '#200d08', effect: 'vintage' } },
    { bgColor: '#1a0c08', title: { font: 'Lora', color: '#f0d8c0' }, price: { color: '#c84b31' } }),

  // 14. Arctic White
  p('Arctic White',
    { accent: '#6b8cae', background: { type: 'color', value: '#0a0e14' }, title: { font: 'Montserrat', color: '#d0dde8', weight: 'normal' }, buttons: { shape: 'flat', borderStyle: 'solid', borderColor: '#6b8cae', bgColor: 'transparent', textColor: '#d0dde8' } },
    { accent: '#6b8cae', background: { color: '#0a0e14', color2: '#121820', effect: 'none' } },
    { bgColor: '#0e141c', title: { font: 'Montserrat', color: '#d0dde8' }, price: { color: '#6b8cae' } }),

  // 15. Venetian Gold
  p('Venetian Gold',
    { accent: '#9b59b6', background: { type: 'color', value: '#10080f' }, title: { font: 'Bodoni Moda', color: '#e8d0f0', weight: 'light' }, buttons: { shape: 'flat', borderStyle: 'solid', borderColor: '#9b59b6', bgColor: 'transparent', textColor: '#e8d0f0' } },
    { accent: '#9b59b6', background: { color: '#10080f', color2: '#1a0c1a', effect: 'velvet' } },
    { bgColor: '#150a18', title: { font: 'Bodoni Moda', color: '#e8d0f0' }, price: { color: '#9b59b6' } }),

  // 16. Sahara Dunes
  p('Sahara Dunes',
    { accent: '#d4a853', background: { type: 'color', value: '#12100a' }, title: { font: 'Cormorant Garamond', color: '#f0e0c0', weight: 'light' }, buttons: { shape: 'flat', borderStyle: 'solid', borderColor: '#d4a853', bgColor: 'transparent', textColor: '#f0e0c0' } },
    { accent: '#d4a853', background: { color: '#12100a', color2: '#1e1a0a', effect: 'leather' } },
    { bgColor: '#181408', title: { color: '#f0e0c0' }, price: { color: '#d4a853' } }),

  // 17. Neon Magenta
  p('Neon Magenta',
    { accent: '#ff00aa', background: { type: 'color', value: '#05000a' }, title: { font: 'Inter', color: '#ff80d4', weight: 'bold' }, buttons: { shape: 'pill', borderStyle: 'solid', borderColor: '#ff00aa', bgColor: 'transparent', textColor: '#ff80d4' } },
    { accent: '#ff00aa', background: { color: '#05000a', color2: '#0f0015', effect: 'retro-grid' } },
    { bgColor: '#0a0012', title: { font: 'Inter', color: '#ff80d4', weight: 'bold' }, price: { color: '#ff00aa' } }),

  // 18. Lavender Fields
  p('Lavender Fields',
    { accent: '#967bb6', background: { type: 'color', value: '#0c0a14' }, title: { font: 'Playfair Display', color: '#d8d0f0', weight: 'light' }, buttons: { shape: 'rounded', borderStyle: 'solid', borderColor: '#967bb6', bgColor: 'transparent', textColor: '#d8d0f0' } },
    { accent: '#967bb6', background: { color: '#0c0a14', color2: '#14101e', effect: 'none' } },
    { bgColor: '#100e1a', title: { font: 'Playfair Display', color: '#d8d0f0' }, price: { color: '#967bb6' } }),

  // 19. Monochrome
  p('Monochrome',
    { accent: '#ffffff', background: { type: 'color', value: '#000000' }, title: { font: 'Inter', color: '#ffffff', weight: 'normal' }, buttons: { shape: 'flat', borderStyle: 'solid', borderColor: '#ffffff', bgColor: 'transparent', textColor: '#ffffff' } },
    { accent: '#ffffff', background: { color: '#000000', color2: '#111111', effect: 'minimal-noise' } },
    { bgColor: '#0a0a0a', title: { font: 'Inter', color: '#ffffff', weight: 'normal' }, price: { color: '#ffffff' } }),

  // 20. Emerald Velvet
  p('Emerald Velvet',
    { accent: '#2d9d5a', background: { type: 'color', value: '#04100a' }, title: { font: 'Cormorant Garamond', color: '#b8f0d0', weight: 'light' }, buttons: { shape: 'flat', borderStyle: 'solid', borderColor: '#2d9d5a', bgColor: 'transparent', textColor: '#b8f0d0' } },
    { accent: '#2d9d5a', background: { color: '#04100a', color2: '#081a0e', effect: 'velvet' } },
    { bgColor: '#061410', title: { color: '#b8f0d0' }, price: { color: '#2d9d5a' } }),

  // 21. Crimson Luxe
  p('Crimson Luxe',
    { accent: '#e8c4b8', background: { type: 'color', value: '#1a0505' }, title: { font: 'Bodoni Moda', color: '#f0d8d0', weight: 'light' }, buttons: { shape: 'flat', borderStyle: 'solid', borderColor: '#e8c4b8', bgColor: 'transparent', textColor: '#f0d8d0' } },
    { accent: '#e8c4b8', background: { color: '#1a0505', color2: '#280a0a', effect: 'velvet' } },
    { bgColor: '#200808', title: { font: 'Bodoni Moda', color: '#f0d8d0' }, price: { color: '#e8c4b8' } }),

  // 22. Retro Americana
  p('Retro Americana',
    { accent: '#e63946', background: { type: 'color', value: '#0f0a00' }, title: { font: 'Josefin Slab', color: '#f5e6c8', weight: 'bold' }, buttons: { shape: 'flat', borderStyle: 'solid', borderColor: '#e63946', bgColor: 'transparent', textColor: '#f5e6c8' } },
    { accent: '#e63946', background: { color: '#0f0a00', color2: '#1a1000', effect: 'retro-grid' } },
    { bgColor: '#141008', title: { font: 'Josefin Slab', color: '#f5e6c8', weight: 'bold' }, price: { color: '#e63946' } }),

  // 23. Scandinavian Birch
  p('Scandinavian Birch',
    { accent: '#a08060', background: { type: 'color', value: '#f2ede8' }, title: { font: 'Libre Baskerville', color: '#2a2018', weight: 'normal' }, buttons: { shape: 'pill', borderStyle: 'solid', borderColor: '#a08060', bgColor: 'transparent', textColor: '#2a2018' } },
    { accent: '#a08060', background: { color: '#f2ede8', color2: '#e8e0d8', effect: 'linen' } },
    { bgColor: '#f0ebe4', title: { font: 'Libre Baskerville', color: '#2a2018' }, price: { color: '#a08060' } }),

  // 24. Steakhouse Dark
  p('Steakhouse Dark',
    { accent: '#c68642', background: { type: 'color', value: '#100a02' }, title: { font: 'Lora', color: '#f0dfc0', weight: 'normal' }, buttons: { shape: 'flat', borderStyle: 'solid', borderColor: '#c68642', bgColor: 'transparent', textColor: '#f0dfc0' } },
    { accent: '#c68642', background: { color: '#100a02', color2: '#1a1002', effect: 'leather' } },
    { bgColor: '#180e04', title: { font: 'Lora', color: '#f0dfc0' }, price: { color: '#c68642' } }),

  // 25. Tropical Azure
  p('Tropical Azure',
    { accent: '#00b4d8', background: { type: 'color', value: '#040e14' }, title: { font: 'Montserrat', color: '#c0f0ff', weight: 'normal' }, buttons: { shape: 'pill', borderStyle: 'solid', borderColor: '#00b4d8', bgColor: 'transparent', textColor: '#c0f0ff' } },
    { accent: '#00b4d8', background: { color: '#040e14', color2: '#081820', effect: 'none' } },
    { bgColor: '#061218', title: { font: 'Montserrat', color: '#c0f0ff' }, price: { color: '#00b4d8' } }),

  // 26. Oriental Jade
  p('Oriental Jade',
    { accent: '#c9a96e', background: { type: 'color', value: '#040c08' }, title: { font: 'Cormorant Garamond', color: '#e8d8b8', weight: 'light' }, buttons: { shape: 'flat', borderStyle: 'solid', borderColor: '#c9a96e', bgColor: 'transparent', textColor: '#e8d8b8' } },
    { accent: '#c9a96e', background: { color: '#040c08', color2: '#081408', effect: 'parchment' } },
    { bgColor: '#081008', title: { color: '#e8d8b8' }, price: { color: '#c9a96e' } }),

  // 27. Urban Yellow
  p('Urban Yellow',
    { accent: '#f4d03f', background: { type: 'color', value: '#0a0a0a' }, title: { font: 'Oswald', color: '#f4d03f', weight: 'bold' }, buttons: { shape: 'flat', borderStyle: 'solid', borderColor: '#f4d03f', bgColor: 'transparent', textColor: '#f4d03f' } },
    { accent: '#f4d03f', background: { color: '#0a0a0a', color2: '#141400', effect: 'retro-grid' } },
    { bgColor: '#0e0e08', title: { font: 'Oswald', color: '#f4d03f', weight: 'bold' }, price: { color: '#f4d03f' } }),

  // 28. Bordeaux Estate
  p('Bordeaux Estate',
    { accent: '#e8c4b8', background: { type: 'color', value: '#0f0407' }, title: { font: 'Playfair Display', color: '#f0d8d0', weight: 'light' }, buttons: { shape: 'rounded', borderStyle: 'solid', borderColor: '#e8c4b8', bgColor: 'transparent', textColor: '#f0d8d0' } },
    { accent: '#e8c4b8', background: { color: '#0f0407', color2: '#1a0810', effect: 'velvet' } },
    { bgColor: '#150610', title: { font: 'Playfair Display', color: '#f0d8d0' }, price: { color: '#e8c4b8' } }),

  // 29. Alpine Snow
  p('Alpine Snow',
    { accent: '#7cb9e8', background: { type: 'color', value: '#0a0f14' }, title: { font: 'Raleway', color: '#d0e8f8', weight: 'light' }, buttons: { shape: 'rounded', borderStyle: 'solid', borderColor: '#7cb9e8', bgColor: 'transparent', textColor: '#d0e8f8' } },
    { accent: '#7cb9e8', background: { color: '#0a0f14', color2: '#101820', effect: 'slate' } },
    { bgColor: '#0e1520', title: { font: 'Raleway', color: '#d0e8f8' }, price: { color: '#7cb9e8' } }),

  // 30. Art Deco Glam
  p('Art Deco Glam',
    { accent: '#ffd700', background: { type: 'color', value: '#000000' }, title: { font: 'Josefin Slab', color: '#ffd700', weight: 'bold' }, buttons: { shape: 'flat', borderStyle: 'solid', borderColor: '#ffd700', bgColor: 'transparent', textColor: '#ffd700' } },
    { accent: '#ffd700', background: { color: '#000000', color2: '#0a0800', effect: 'gold-leaf' } },
    { bgColor: '#0a0800', title: { font: 'Josefin Slab', color: '#ffd700', weight: 'bold' }, price: { color: '#ffd700' } }),
]
