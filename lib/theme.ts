// ─────────────────────────────────────────────────────────────────────────────
// Restaurant theme — single source of truth for all visual customization.
// Stored as theme_config JSONB in the restaurants table.
// ─────────────────────────────────────────────────────────────────────────────

export interface RestaurantTheme {
  // Brand color — affects accent lines, button borders, social icons, PDF
  accent:       string
  // Landing page dark background (CSS color or gradient)
  pageBg:       string
  // Category nav bar background
  navBg:        string
  // Optional background image URL (Supabase storage)
  bgImage?:     string
  bgImageOpacity: number  // 0–100
  // Primary text (restaurant name, dish titles)
  textPrimary:  string
  // Secondary / muted text (hints, labels, page counter)
  textMuted:    string
  // Google Font name for serif headings (restaurant name, dish names)
  fontSerif:    string
  // Google Font name for sans-serif body / labels
  fontSans:     string
  // Border radius token applied to buttons and modals
  borderRadius: 'none' | 'sm' | 'md'
  // PDF dish layout
  pdfLayout:    'classic' | 'compact'
}

export const DEFAULT_THEME: RestaurantTheme = {
  accent:           '#c9a96e',
  pageBg:           '#0d0d0d',
  navBg:            'rgba(7,7,7,0.96)',
  bgImage:          undefined,
  bgImageOpacity:   30,
  textPrimary:      '#ede8e0',
  textMuted:        '#4f4f4f',
  fontSerif:        'Cormorant Garamond',
  fontSans:         'DM Sans',
  borderRadius:     'none',
  pdfLayout:        'classic',
}

export function parseTheme(raw: unknown): RestaurantTheme {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_THEME }
  const r = raw as Record<string, unknown>
  return {
    accent:          typeof r.accent === 'string'       ? r.accent       : DEFAULT_THEME.accent,
    pageBg:          typeof r.pageBg === 'string'        ? r.pageBg       : DEFAULT_THEME.pageBg,
    navBg:           typeof r.navBg === 'string'         ? r.navBg        : DEFAULT_THEME.navBg,
    bgImage:         typeof r.bgImage === 'string'       ? r.bgImage      : undefined,
    bgImageOpacity:  typeof r.bgImageOpacity === 'number'? r.bgImageOpacity: DEFAULT_THEME.bgImageOpacity,
    textPrimary:     typeof r.textPrimary === 'string'   ? r.textPrimary  : DEFAULT_THEME.textPrimary,
    textMuted:       typeof r.textMuted === 'string'     ? r.textMuted    : DEFAULT_THEME.textMuted,
    fontSerif:       typeof r.fontSerif === 'string'     ? r.fontSerif    : DEFAULT_THEME.fontSerif,
    fontSans:        typeof r.fontSans === 'string'      ? r.fontSans     : DEFAULT_THEME.fontSans,
    borderRadius:    r.borderRadius === 'sm' || r.borderRadius === 'md' ? r.borderRadius : 'none',
    pdfLayout:       r.pdfLayout === 'compact'           ? 'compact'      : 'classic',
  }
}

export function borderRadiusPx(token: RestaurantTheme['borderRadius']): string {
  return token === 'sm' ? '6px' : token === 'md' ? '14px' : '0px'
}

// Builds a Google Fonts stylesheet URL for the two selected font families.
// Handles both curated names and arbitrary custom names.
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

// Curated font lists shown in the admin dropdown.
// Users can also type any Google Font name freely.
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

// Returns "r, g, b" string for use in rgba(var(--theme-accent-rgb), alpha) CSS.
export function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

// Blends hex color with white at `amount` (0 = original, 1 = white).
export function lightenHex(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  const r = Math.round(parseInt(h.slice(0, 2), 16) + (255 - parseInt(h.slice(0, 2), 16)) * amount)
  const g = Math.round(parseInt(h.slice(2, 4), 16) + (255 - parseInt(h.slice(2, 4), 16)) * amount)
  const b = Math.round(parseInt(h.slice(4, 6), 16) + (255 - parseInt(h.slice(4, 6), 16)) * amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
