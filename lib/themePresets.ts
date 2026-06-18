// ─────────────────────────────────────────────────────────────────────────────
// Theme presets + "base" cascade helpers.
//
// Questi NON sono i vecchi preset (rimossi perché cambiavano solo accento e
// colore titolo, lasciando bianco il foglio del menu e invariati layout/
// divisori/categorie → "blandi"). Qui ogni preset è un tema COMPLETO che
// trasforma tutte le superfici: landing, sfondo del foglio piatti, colori del
// testo, layout dei piatti, divisori, decori delle categorie, prezzi, card.
//
// Le stesse funzioni di cascata (applyBaseFont/Surface/Text/Accent) alimentano
// sia la costruzione dei preset sia la "personalizzazione base", dove un singolo
// font/colore si propaga su tutto il menu in un colpo solo.
// ─────────────────────────────────────────────────────────────────────────────

import {
  DEFAULT_THEME, lightenHex,
  type RestaurantTheme, type MenuTheme,
  type DishLayout, type DividerType, type CategoryFlourish,
  type PricePosition, type MenuBgEffect,
} from './theme'

// ── Color helpers ──────────────────────────────────────────────────────────────

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
const hex2 = (n: number) => clamp(n).toString(16).padStart(2, '0')
const isHex6 = (h: string) => /^#?[0-9a-f]{6}$/i.test(h)

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

// Blend a→b di una frazione t (0 = a, 1 = b). Usato per derivare il colore
// "muted" (descrizioni, testi secondari) avvicinando il testo allo sfondo.
export function mixHex(a: string, b: string, t: number): string {
  if (!isHex6(a) || !isHex6(b)) return a
  const [r1, g1, b1] = toRgb(a)
  const [r2, g2, b2] = toRgb(b)
  return `#${hex2(r1 + (r2 - r1) * t)}${hex2(g1 + (g2 - g1) * t)}${hex2(b1 + (b2 - b1) * t)}`
}

// ── Cascade helpers ─────────────────────────────────────────────────────────────
// Ognuna ritorna un NUOVO tema (deep clone) con il valore propagato su tutti i
// campi pertinenti — menu "Generale" + eventuali override per-menu inclusi.

function allMenus(t: RestaurantTheme): MenuTheme[] {
  return [t.menu, ...Object.values(t.menuThemes ?? {})]
}

/** Un solo font su tutto: landing, piatti, descrizioni, prezzi, categorie, card. */
export function applyBaseFont(theme: RestaurantTheme, font: string): RestaurantTheme {
  const t = structuredClone(theme)
  t.landing.title.font = font
  t.landing.description.font = font
  t.landing.buttons.font = font
  for (const m of allMenus(t)) {
    m.dishes.titleFont = font
    m.descriptions.font = font
    m.prices.font = font
    m.categories.font = font
    m.stickyCategories.font = font
    m.hintPopup.font = font
  }
  t.card.title.font = font
  t.card.description.font = font
  t.card.price.font = font
  return t
}

/**
 * Un solo colore di sfondo per tutte le superfici: landing, area attorno al
 * flipbook, foglio del menu (dove stanno i piatti), card, sticky bar, pop-up.
 * `page` opzionale distingue il foglio dall'area circostante.
 */
export function applyBaseSurface(theme: RestaurantTheme, around: string, page = around): RestaurantTheme {
  const t = structuredClone(theme)
  t.landing.background.type  = 'color'
  t.landing.background.value = around
  // Popup bgColor: on dark themes the page is also dark, so the popup box would
  // be invisible against the rgba(0,0,0,0.62) backdrop unless we lighten it.
  const [pr, pg, pb] = toRgb(page)
  const pageLum = (0.299 * pr + 0.587 * pg + 0.114 * pb) / 255
  const popupBg = pageLum < 0.5 ? lightenHex(page, 0.18) : page
  for (const m of allMenus(t)) {
    m.background.color      = around
    m.background.color2     = lightenHex(around, 0.07)
    m.pageBackground.color  = page
    m.pageBackground.color2 = lightenHex(page, 0.05)
    m.stickyCategories.bgColor = around
    m.hintPopup.bgColor     = popupBg
  }
  t.card.bgColor = page
  return t
}

/**
 * Un solo colore di testo. Deriva un "muted" avvicinando il testo allo sfondo
 * del foglio, così descrizioni e testi secondari restano leggibili ma in
 * secondo piano. `bg` è la superficie su cui il testo poggia (foglio del menu).
 */
export function applyBaseText(theme: RestaurantTheme, text: string, bg: string): RestaurantTheme {
  const t = structuredClone(theme)
  const muted = isHex6(text) && isHex6(bg) ? mixHex(text, bg, 0.42) : text
  t.landing.title.color       = text
  t.landing.description.color = muted
  t.landing.buttons.textColor = text
  for (const m of allMenus(t)) {
    m.dishes.titleColor          = text
    m.descriptions.color         = muted
    m.categories.color           = text
    m.navigation.color           = muted
    m.stickyCategories.textColor = muted
    // Derive popup text colors from the popup bgColor (not the page bg), so they
    // always contrast correctly whether the popup is dark or light.
    const [hbr, hbg, hbb] = toRgb(m.hintPopup.bgColor)
    const popupBgLum = (0.299 * hbr + 0.587 * hbg + 0.114 * hbb) / 255
    m.hintPopup.titleColor = popupBgLum > 0.5 ? '#1a1a1a' : '#f0ece4'
    m.hintPopup.textColor  = popupBgLum > 0.5 ? '#4a4a4a' : '#a09080'
    // divisori: una linea discreta, derivata dalla coppia testo/sfondo.
    m.layout.divider.color = isHex6(text) && isHex6(bg) ? mixHex(text, bg, 0.72) : m.layout.divider.color
  }
  t.card.title.color       = text
  t.card.description.color = muted
  return t
}

/** Un solo colore accento: prezzi, decori categorie, bordi, evidenziazioni, card. */
export function applyBaseAccent(theme: RestaurantTheme, accent: string): RestaurantTheme {
  const t = structuredClone(theme)
  // Allergen badge background: inverted relative to accent luminance so the
  // accent-coloured text is always readable against its chip background.
  const [ar, ag, ab] = toRgb(accent)
  const accentLum = (0.299 * ar + 0.587 * ag + 0.114 * ab) / 255
  const allergenBg = accentLum > 0.35 ? '#1a1a1a' : '#e8e8e8'
  t.landing.accent              = accent
  t.landing.buttons.borderColor = accent
  t.landing.socials.color       = accent
  for (const m of allMenus(t)) {
    m.accent                       = accent
    m.prices.color                 = accent
    m.categories.flourishColor     = accent
    m.stickyCategories.activeColor = accent
    m.allergens.color              = accent
    m.allergens.bgColor            = allergenBg
  }
  t.card.accent               = accent
  t.card.price.color          = accent
  t.card.category.color       = accent
  t.card.pairing.labelColor   = accent
  t.card.allergens.color      = accent
  t.card.allergens.labelColor = accent
  t.card.allergens.bgColor    = allergenBg
  return t
}

// ── Preset builder ──────────────────────────────────────────────────────────────

export interface PresetSpec {
  name: string
  mood: string                 // sottotitolo descrittivo mostrato nella card
  font: string                 // font dei titoli (e default ovunque)
  bodyFont?: string            // font opzionale per testi/descrizioni/prezzi
  around: string               // sfondo dell'area attorno al menu + landing
  page?: string                // sfondo del foglio piatti (default = around)
  text: string                 // colore testo principale
  accent: string               // colore accento
  dishLayout: DishLayout
  dishAlign?: 'left' | 'center' | 'right'
  divider: DividerType
  flourish?: CategoryFlourish
  pricePosition?: PricePosition
  aroundEffect?: MenuBgEffect
  pageEffect?: MenuBgEffect
  buttonShape?: 'flat' | 'rounded' | 'pill'
  radius?: 'none' | 'sm' | 'md'
  titleWeight?: 'light' | 'normal' | 'bold'
  cardLayout?: 'photo-top' | 'photo-side' | 'minimal'
}

export interface ThemePreset { name: string; mood: string; theme: RestaurantTheme }

function buildPreset(s: PresetSpec): ThemePreset {
  const page = s.page ?? s.around
  let t = structuredClone(DEFAULT_THEME)

  // 1. Cascate base (font + tutte le superfici + testo + accento).
  t = applyBaseFont(t, s.font)
  t = applyBaseSurface(t, s.around, page)
  t = applyBaseText(t, s.text, page)
  t = applyBaseAccent(t, s.accent)

  // 2. Font del corpo opzionale (descrizioni/prezzi/sticky/bottoni/pop-up).
  if (s.bodyFont) {
    for (const m of allMenus(t)) {
      m.descriptions.font     = s.bodyFont
      m.prices.font           = s.bodyFont
      m.stickyCategories.font = s.bodyFont
      m.hintPopup.font        = s.bodyFont
    }
    t.landing.description.font = s.bodyFont
    t.landing.buttons.font     = s.bodyFont
    t.card.description.font    = s.bodyFont
    t.card.price.font          = s.bodyFont
  }

  // 3. Identità strutturale — è qui che ogni tema "stravolge" il menu.
  const weight = s.titleWeight ?? 'light'
  const align  = s.dishAlign ?? 'left'
  t.landing.title.weight = weight
  t.landing.buttons.shape = s.buttonShape ?? 'flat'
  t.landing.background.value = s.around

  for (const m of allMenus(t)) {
    m.layout.dishLayout    = s.dishLayout
    m.layout.dishAlignment = align
    m.layout.divider.type  = s.divider
    m.layout.divider.width = s.divider === 'double' || s.divider === 'gradient' ? 1 : 0.5
    m.categories.flourish  = s.flourish ?? 'none'
    m.categories.align     = align === 'center' ? 'center' : 'inherit'
    m.dishes.align         = align === 'center' ? 'center' : 'inherit'
    m.prices.position      = s.pricePosition ?? 'right'
    m.background.effect    = s.aroundEffect ?? 'none'
    m.pageBackground.effect = s.pageEffect ?? 'none'
    m.background.color2    = lightenHex(s.around, 0.08)
  }

  t.card.borderRadius = s.radius ?? 'sm'
  t.card.layout       = s.cardLayout ?? 'photo-top'
  t.card.title.weight = weight
  t.card.align        = align

  return { name: s.name, mood: s.mood, theme: t }
}

// ── Presets ──────────────────────────────────────────────────────────────────
// Ogni voce è un'identità visiva completa e distinta. Mix di temi scuri e
// chiari, serif/display/sans, layout a lista/griglia/elegante, decori diversi.

export const PRESETS: ThemePreset[] = [
  buildPreset({
    name: 'Notte Oro', mood: 'Lusso scuro, oro caldo',
    font: 'Cormorant Garamond', bodyFont: 'DM Sans',
    around: '#0c0b09', page: '#100e0b', text: '#efe7d6', accent: '#c9a227',
    dishLayout: 'elegant', dishAlign: 'center', divider: 'gradient', flourish: 'diamond',
    aroundEffect: 'gold-leaf', radius: 'sm', titleWeight: 'light',
  }),
  buildPreset({
    name: 'Bianco Sartoriale', mood: 'Minimal editoriale, luce piena',
    font: 'Bodoni Moda', bodyFont: 'Inter',
    around: '#f3f1ec', page: '#ffffff', text: '#16140f', accent: '#1a1a1a',
    dishLayout: 'minimal-row', dishAlign: 'left', divider: 'solid', flourish: 'none',
    buttonShape: 'flat', radius: 'none', titleWeight: 'normal', cardLayout: 'photo-side',
  }),
  buildPreset({
    name: 'Trattoria Toscana', mood: 'Rustico caldo, terracotta',
    font: 'Lora', bodyFont: 'Lora',
    around: '#231509', page: '#2c1c0e', text: '#f1dcb6', accent: '#cf7a2c',
    dishLayout: 'list', dishAlign: 'left', divider: 'dotted', flourish: 'lines',
    aroundEffect: 'leather', pageEffect: 'parchment', radius: 'sm', titleWeight: 'normal',
  }),
  buildPreset({
    name: 'Bistrot Smeraldo', mood: 'Verde profondo, oro elegante',
    font: 'Playfair Display', bodyFont: 'DM Sans',
    around: '#06140d', page: '#0a1c12', text: '#e7f0e2', accent: '#d8b35a',
    dishLayout: 'elegant', dishAlign: 'center', divider: 'ornament', flourish: 'diamond',
    aroundEffect: 'emerald-mist', radius: 'md', titleWeight: 'normal',
  }),
  buildPreset({
    name: 'Neon Tokyo', mood: 'Notte urbana, neon acido',
    font: 'Oswald', bodyFont: 'DM Sans',
    around: '#07070e', page: '#0c0c16', text: '#f0ecff', accent: '#00ffa3',
    dishLayout: 'grid-2', dishAlign: 'left', divider: 'none', flourish: 'none',
    aroundEffect: 'retro-grid', pricePosition: 'below', buttonShape: 'pill',
    radius: 'md', titleWeight: 'bold',
  }),
  buildPreset({
    name: 'Riviera', mood: 'Mediterraneo chiaro, blu mare',
    font: 'Libre Baskerville', bodyFont: 'Montserrat',
    around: '#eef0ea', page: '#ffffff', text: '#163a4c', accent: '#1f7fb8',
    dishLayout: 'list', dishAlign: 'center', divider: 'wavy', flourish: 'dots',
    buttonShape: 'rounded', radius: 'md', titleWeight: 'normal',
  }),
  buildPreset({
    name: 'Carbone', mood: 'Industriale, contrasto netto',
    font: 'Bebas Neue', bodyFont: 'Inter',
    around: '#0a0a0a', page: '#121212', text: '#fafafa', accent: '#f2f2f2',
    dishLayout: 'boxed-card', dishAlign: 'left', divider: 'solid', flourish: 'none',
    aroundEffect: 'carbon', buttonShape: 'flat', radius: 'none', titleWeight: 'bold',
    cardLayout: 'minimal',
  }),
  buildPreset({
    name: 'Rosa Cipria', mood: 'Romantico chiaro, rosa antico',
    font: 'Bodoni Moda', bodyFont: 'DM Sans',
    around: '#f8edee', page: '#fffafa', text: '#5a2630', accent: '#c25b72',
    dishLayout: 'elegant', dishAlign: 'center', divider: 'gradient', flourish: 'diamond',
    buttonShape: 'pill', radius: 'md', titleWeight: 'light',
  }),
  buildPreset({
    name: 'Bordeaux Riserva', mood: 'Cantina, rosso vino',
    font: 'EB Garamond', bodyFont: 'EB Garamond',
    around: '#16060a', page: '#1d090f', text: '#f0d6cf', accent: '#d99a5b',
    dishLayout: 'list', dishAlign: 'left', divider: 'double', flourish: 'lines',
    aroundEffect: 'velvet', radius: 'sm', titleWeight: 'normal',
  }),
  buildPreset({
    name: 'Aurora', mood: 'Moderno freddo, sfumature notturne',
    font: 'Montserrat', bodyFont: 'Montserrat',
    around: '#090d1a', page: '#0e1426', text: '#dfe7f5', accent: '#7aa2ff',
    dishLayout: 'minimal-row', dishAlign: 'left', divider: 'solid', flourish: 'none',
    aroundEffect: 'aurora', buttonShape: 'rounded', radius: 'md', titleWeight: 'normal',
  }),
  buildPreset({
    name: 'Sahara', mood: 'Sabbia calda, luce naturale',
    font: 'Cormorant Garamond', bodyFont: 'Outfit',
    around: '#ece1cd', page: '#f7efe1', text: '#3a2c18', accent: '#b6842f',
    dishLayout: 'list', dishAlign: 'center', divider: 'dashed', flourish: 'lines',
    buttonShape: 'flat', radius: 'sm', titleWeight: 'normal',
  }),
  buildPreset({
    name: "Foglia d'Oro", mood: 'Art déco, nero e oro',
    font: 'Cinzel', bodyFont: 'DM Sans',
    around: '#000000', page: '#080706', text: '#ffd76a', accent: '#ffd76a',
    dishLayout: 'elegant', dishAlign: 'center', divider: 'ornament', flourish: 'diamond',
    aroundEffect: 'gold-leaf', radius: 'none', titleWeight: 'bold',
  }),
]
