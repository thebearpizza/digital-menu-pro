// ─────────────────────────────────────────────────────────────────────────────
// Restaurant theme — single source of truth for all visual customization.
// Stored as theme_config JSONB in the restaurants table.
// ─────────────────────────────────────────────────────────────────────────────

export interface RestaurantTheme {
  // ── Dual background ────────────────────────────────────────────────────────
  // The dark space behind/around everything: landing, flipbook container
  appBg:          string
  // The physical "paper" color of the PDF pages (and flipbook page faces)
  pageBackground: string
  // Category nav bar background
  navBg:          string
  // Optional texture/pattern overlaid on appBg
  bgImage?:       string
  bgImageOpacity: number   // 0–100
  // Optional landing background video (mp4/webm). When immersiveTransition is
  // off it loops muted as a living wallpaper; when on it stays paused until a
  // menu button is tapped, then plays once and reveals the menu on `ended`.
  bgVideo?:            string
  immersiveTransition: boolean

  // ── Colors ────────────────────────────────────────────────────────────────
  accent:      string
  textPrimary: string
  textMuted:   string

  // ── Typography ────────────────────────────────────────────────────────────
  fontSerif:   string
  fontSans:    string
  fontSizes: {
    title: number   // rem — headings (restaurant name, dish names)
    base:  number   // rem — descriptions, labels
    price: number   // rem — price labels
  }

  // ── Style ─────────────────────────────────────────────────────────────────
  borderRadius: 'none' | 'sm' | 'md'

  // ── PDF ───────────────────────────────────────────────────────────────────
  pdfLayout:    'classic' | 'compact'
  dishLayout:   'list' | 'grid' | 'boxed'
  priceFormat:  'before' | 'after' | 'minimal'
  dividerStyle: 'none' | 'thin' | 'dashed'
}

export const DEFAULT_THEME: RestaurantTheme = {
  appBg:          '#0d0d0d',
  pageBackground: '#ffffff',
  navBg:          'rgba(7,7,7,0.96)',
  bgImage:        undefined,
  bgImageOpacity: 30,
  bgVideo:             undefined,
  immersiveTransition: false,
  accent:         '#c9a96e',
  textPrimary:    '#ede8e0',
  textMuted:      '#4f4f4f',
  fontSerif:      'Cormorant Garamond',
  fontSans:       'DM Sans',
  fontSizes:      { title: 1.75, base: 0.875, price: 1.1 },
  borderRadius:   'none',
  pdfLayout:      'classic',
  dishLayout:     'list',
  priceFormat:    'before',
  dividerStyle:   'thin',
}

export function parseTheme(raw: unknown): RestaurantTheme {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_THEME, fontSizes: { ...DEFAULT_THEME.fontSizes } }
  const r  = raw as Record<string, unknown>
  const fs = r.fontSizes && typeof r.fontSizes === 'object' ? r.fontSizes as Record<string, unknown> : {}
  return {
    // appBg backward-compat: also accepts old key 'pageBg'
    appBg:          typeof r.appBg  === 'string' ? r.appBg  :
                    typeof r.pageBg === 'string' ? r.pageBg : DEFAULT_THEME.appBg,
    pageBackground: typeof r.pageBackground === 'string' ? r.pageBackground : DEFAULT_THEME.pageBackground,
    navBg:          typeof r.navBg      === 'string' ? r.navBg      : DEFAULT_THEME.navBg,
    bgImage:        typeof r.bgImage    === 'string' ? r.bgImage    : undefined,
    bgImageOpacity: typeof r.bgImageOpacity === 'number' ? r.bgImageOpacity : DEFAULT_THEME.bgImageOpacity,
    bgVideo:             typeof r.bgVideo === 'string' ? r.bgVideo : undefined,
    immersiveTransition: r.immersiveTransition === true,
    accent:         typeof r.accent     === 'string' ? r.accent     : DEFAULT_THEME.accent,
    textPrimary:    typeof r.textPrimary === 'string' ? r.textPrimary : DEFAULT_THEME.textPrimary,
    textMuted:      typeof r.textMuted  === 'string' ? r.textMuted  : DEFAULT_THEME.textMuted,
    fontSerif:      typeof r.fontSerif  === 'string' ? r.fontSerif  : DEFAULT_THEME.fontSerif,
    fontSans:       typeof r.fontSans   === 'string' ? r.fontSans   : DEFAULT_THEME.fontSans,
    fontSizes: {
      title: typeof fs.title === 'number' ? fs.title : DEFAULT_THEME.fontSizes.title,
      base:  typeof fs.base  === 'number' ? fs.base  : DEFAULT_THEME.fontSizes.base,
      price: typeof fs.price === 'number' ? fs.price : DEFAULT_THEME.fontSizes.price,
    },
    borderRadius:  r.borderRadius === 'sm' || r.borderRadius === 'md' ? r.borderRadius : 'none',
    pdfLayout:     r.pdfLayout === 'compact' ? 'compact' : 'classic',
    dishLayout:    r.dishLayout === 'grid' || r.dishLayout === 'boxed' ? r.dishLayout : 'list',
    priceFormat:   r.priceFormat === 'after' || r.priceFormat === 'minimal' ? r.priceFormat : 'before',
    dividerStyle:  r.dividerStyle === 'none' || r.dividerStyle === 'dashed' ? r.dividerStyle : 'thin',
  }
}

export function borderRadiusPx(token: RestaurantTheme['borderRadius']): string {
  return token === 'sm' ? '6px' : token === 'md' ? '14px' : '0px'
}

export function googleFontsUrl(fontSerif: string, fontSans: string): string {
  const families = [fontSerif, fontSans]
    .filter(Boolean)
    .map(f => `family=${encodeURIComponent(f)}:ital,wght@0,300;0,400;0,600;1,400`)
    .join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

export function fontStack(name: string, category: 'serif' | 'sans'): string {
  const fallback = category === 'serif'
    ? "'Georgia', 'Times New Roman', serif"
    : "system-ui, sans-serif"
  return `'${name}', ${fallback}`
}

export function formatPrice(price: number, format: RestaurantTheme['priceFormat']): string {
  const num = price.toFixed(2)
  if (format === 'after')   return `${num} €`
  if (format === 'minimal') return num
  return `€ ${num}`
}

export function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

export function lightenHex(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  const r = Math.round(parseInt(h.slice(0, 2), 16) + (255 - parseInt(h.slice(0, 2), 16)) * amount)
  const g = Math.round(parseInt(h.slice(2, 4), 16) + (255 - parseInt(h.slice(2, 4), 16)) * amount)
  const b = Math.round(parseInt(h.slice(4, 6), 16) + (255 - parseInt(h.slice(4, 6), 16)) * amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export const SERIF_FONTS = [
  'Cormorant Garamond',
  'Playfair Display',
  'EB Garamond',
  'Lora',
  'Libre Baskerville',
]

export const SANS_FONTS = [
  'DM Sans',
  'Inter',
  'Raleway',
  'Josefin Sans',
  'Montserrat',
]
