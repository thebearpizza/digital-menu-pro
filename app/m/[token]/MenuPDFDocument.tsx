// ─────────────────────────────────────────────────────────────────────────────
// MenuPDFDocument — @react-pdf/renderer document for a single restaurant menu.
// Dynamically imported by useMenuPDF (never SSR-ed).
// ─────────────────────────────────────────────────────────────────────────────
import { Document, Page, Text, View, Image, StyleSheet, Svg, Path, Defs, LinearGradient, RadialGradient, Stop, Rect } from '@react-pdf/renderer'
import { formatAllergens } from '@/lib/allergens'
import { uiText, isLang } from '@/lib/translations'
import type { RestaurantTheme, MenuBgConfig } from '@/lib/theme'
import { DEFAULT_THEME, lightenHex, formatPrice, resolveAlign } from '@/lib/theme'

// Effects rendered as a radial gradient (glow from a point); everything else
// falls back to a diagonal linear gradient. A pragmatic v1 approximation of
// the richer CSS effects available on the web landing/menu backgrounds.
const RADIAL_PAGE_EFFECTS = new Set(['radial-gradient', 'spotlight', 'aurora', 'mesh-warm', 'mesh-cool', 'emerald-mist', 'gold-leaf'])

// Page-background color/gradient/image layer, rendered behind all content on
// every page (the actual "page" surface under the dishes).
function PageBackgroundLayer({ bg, compact }: { bg: MenuBgConfig; compact: boolean }) {
  if (bg.effect === 'none' && !bg.image) return null
  const top    = compact ? 38 : 52
  const bottom = compact ? 64 : 56
  const sides  = compact ? 44 : 54
  const layerStyle = { position: 'absolute' as const, top: -top, left: -sides, right: -sides, bottom: -bottom }
  const opacity = (bg.effectOpacity / 100) * (bg.effectStrength / 100)
  const isRadial = RADIAL_PAGE_EFFECTS.has(bg.effect)
  const gradient = isRadial
    ? <RadialGradient id="pageBg" cx="50%" cy="30%" r="75%"><Stop offset="0" stopColor={bg.color2} stopOpacity={opacity} /><Stop offset="1" stopColor={bg.color2} stopOpacity={0} /></RadialGradient>
    : <LinearGradient id="pageBg" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={bg.color2} stopOpacity={opacity} /><Stop offset="1" stopColor={bg.color2} stopOpacity={0} /></LinearGradient>
  return (
    <View style={layerStyle} fixed>
      {bg.effect !== 'none' && (
        <Svg style={{ width: '100%', height: '100%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>{gradient}</Defs>
          <Rect width="100" height="100" fill="url(#pageBg)" />
        </Svg>
      )}
      {bg.image ? (
        <Image src={bg.image} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: bg.imageOpacity / 100, objectFit: 'cover' }} />
      ) : null}
    </View>
  )
}

// A smooth repeating sine-like wave across a 240×10 viewBox (12 full periods
// of 20 units each), used for the "wavy" divider — a true vector wave instead
// of relying on a glyph (built-in PDF fonts are WinAnsi-encoded and can't
// render ～/∿ characters).
const WAVE_PATH = Array.from({ length: 12 })
  .map((_, i) => `${i === 0 ? 'M0,5' : ''} q5,-5 10,0 q5,5 10,0`)
  .join(' ')

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PDFDish {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string
  allergens: number[]
}

export interface EmbeddedPageContent {
  enabled:    boolean
  position:   'first' | 'last'
  body:       string
  font:       string
  fontSize:   number
  align:      'left' | 'center' | 'right'
  color:      string
  bold:       boolean
  italic:     boolean
  lineHeight: number
}

export interface MenuExtraPages {
  info:     EmbeddedPageContent
  allergen: EmbeddedPageContent
}

export interface PDFMenu {
  id: string
  name: string
  dishes: PDFDish[]
  // Lingua del menu già tradotto (nomi/descrizioni/categorie arrivano tradotti
  // dal chiamante): serve solo per le etichette fisse, es. gli allergeni.
  lang?: string
  extra_pages?: MenuExtraPages | null
}

export interface PDFRestaurant {
  name: string
}

export const MOCK_RESTAURANT: PDFRestaurant = { name: 'Ristorante Da Marco' }

export const MOCK_MENU: PDFMenu = {
  id: 'mock-1',
  name: 'Menu Estivo 2025',
  dishes: [
    { id: 'd1', name: 'Bruschetta al Pomodoro', description: 'Pane tostato, pomodoro fresco, basilico, olio EVO', price: 6.50, category: 'Antipasti', allergens: [1] },
    { id: 'd2', name: 'Carpaccio di Manzo', description: 'Manzo crudo, rucola, parmigiano, limone', price: 12.00, category: 'Antipasti', allergens: [7] },
    { id: 'd3', name: 'Tagliatelle al Ragù', description: 'Pasta fresca all\'uovo, ragù bolognese', price: 14.00, category: 'Primi', allergens: [1, 3] },
    { id: 'd4', name: 'Risotto ai Porcini', description: 'Carnaroli, porcini, parmigiano 24 mesi', price: 15.50, category: 'Primi', allergens: [7] },
    { id: 'd5', name: 'Filetto di Branzino', description: 'Branzino, patate al forno, olive taggiasche', price: 22.00, category: 'Secondi', allergens: [4] },
    { id: 'd6', name: 'Tiramisù della Casa', description: 'Savoiardi, mascarpone, caffè, cacao', price: 7.00, category: 'Dessert', allergens: [1, 3, 7] },
  ],
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function groupByCategory(dishes: PDFDish[]): Array<{ name: string; dishes: PDFDish[] }> {
  const map = new Map<string, PDFDish[]>()
  for (const d of dishes) {
    const cat = d.category || 'Menu'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(d)
  }
  return Array.from(map.entries()).map(([name, dishes]) => ({ name, dishes }))
}

// ── Colour helpers ──────────────────────────────────────────────────────────
// The theme's default text colours are tuned for the dark card/landing, but the
// PDF page defaults to white paper. These helpers keep text legible: a colour is
// used as-is when it has enough contrast with the page, otherwise it is swapped
// for near-black/near-white. User-chosen colours with real contrast always win.

function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (h.length === 8) h = h.slice(0, 6)
  if (h.length !== 6) return null
  const n = parseInt(h, 16)
  if (Number.isNaN(n)) return null
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const rgb = parseHex(hex)
  if (!rgb) return 0.5
  const [r, g, b] = rgb.map(v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function readableOn(textColor: string, bgColor: string): string {
  const lt = luminance(textColor)
  const lb = luminance(bgColor)
  const ratio = (Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05)
  if (ratio >= 1.8) return textColor          // enough contrast → honour it
  return lb > 0.5 ? '#1a1a1a' : '#ede8e0'     // otherwise stay legible
}

// Blend two hex colours: t=0 → c1, t=1 → c2.
function mixColors(c1: string, c2: string, t: number): string {
  const p1 = parseHex(c1); const p2 = parseHex(c2)
  if (!p1 || !p2) return c1
  return `#${[0, 1, 2].map(i => Math.round(p1[i] + (p2[i] - p1[i]) * t).toString(16).padStart(2, '0')).join('')}`
}

// ── Dynamic styles ────────────────────────────────────────────────────────────

// Mirror an alignment horizontally — used by the alternating compact mode so a
// flipped category flips its dishes too, not just the category title.
function flipAlign(a: 'left' | 'center' | 'right'): 'left' | 'center' | 'right' {
  return a === 'left' ? 'right' : a === 'right' ? 'left' : 'center'
}

function makeStyles(theme: RestaurantTheme, registered: Set<string>, flipped = false) {
  const m         = theme.menu
  const compact   = m.pdfLayout === 'compact'
  const catLineColor  = lightenHex(m.accent, 0.55)
  const divColor  = m.layout.divider.color
  const divWidth  = m.layout.divider.width || 0.5
  const divWidthPct = m.layout.divider.widthPercent || 100
  const bg        = m.pageBackground.color
  // Muted category colour for the continuation reference header (50% blend to bg).
  const catContColor = readableOn(mixColors(m.categories.color, bg, 0.52), bg)
  const spacing   = m.layout.dishSpacing || 0
  // Inter-dish gap: identical TOTAL distance whatever the divider type, so the
  // spacing slider behaves uniformly (gapBase + spacing between any two dishes).
  const gapBase   = compact ? 16 : 24
  const gapTotal  = gapBase + spacing
  // General + per-element alignment ('inherit' falls back to the general value).
  const general   = m.layout.dishAlignment === 'center' ? 'center' : m.layout.dishAlignment === 'right' ? 'right' : 'left'
  const maybeFlip = (a: 'left' | 'center' | 'right') => flipped ? flipAlign(a) : a
  const catAlign  = maybeFlip(resolveAlign(m.categories.align, general))
  const contLineAlignSelf = catAlign === 'center' ? 'center' as const : catAlign === 'right' ? 'flex-end' as const : 'flex-start' as const
  const nameAlign = maybeFlip(resolveAlign(m.dishes.align,     general))
  // Description & allergens inherit from the DISH TITLE alignment (not the
  // general one) so they "follow the title" until explicitly overridden.
  const descAlign  = m.descriptions.align === 'inherit' ? nameAlign : maybeFlip(m.descriptions.align)
  const allgnAlign = m.allergens.align    === 'inherit' ? nameAlign : maybeFlip(m.allergens.align)
  const priceAlign = maybeFlip(resolveAlign(m.prices.align, general))

  // Real font if it registered successfully, otherwise a built-in fallback.
  const titleFamily = registered.has(m.dishes.titleFont)   ? m.dishes.titleFont   : 'Helvetica-Bold'
  const descFamily  = registered.has(m.descriptions.font)  ? m.descriptions.font  : 'Helvetica'
  const priceFamily = registered.has(m.prices.font)        ? m.prices.font        : 'Helvetica-Bold'
  const catFamily   = registered.has(m.categories.font)    ? m.categories.font    : 'Times-Bold'
  const titleBold   = registered.has(m.dishes.titleFont)   ? 700 : undefined
  const priceBold   = registered.has(m.prices.font)        ? 700 : undefined
  const catBold     = registered.has(m.categories.font)    ? 700 : undefined

  const titleScale = m.dishes.titleSize   / DEFAULT_THEME.menu.dishes.titleSize
  const baseScale  = m.descriptions.size  / DEFAULT_THEME.menu.descriptions.size
  const priceScale = m.prices.size        / DEFAULT_THEME.menu.prices.size
  const catScale   = m.categories.size    / DEFAULT_THEME.menu.categories.size
  const alrgScale  = m.allergens.size     / DEFAULT_THEME.menu.allergens.size

  return StyleSheet.create({
    page: {
      backgroundColor:   bg,
      paddingTop:        compact ? 38 : 52,
      // Compact packs more rows in — keep a generous bottom margin so dishes
      // never collide with the flipbook's page-turn corner hints.
      paddingBottom:     compact ? 64 : 56,
      paddingHorizontal: compact ? 44 : 54,
    },
    catTitle: {
      fontFamily:    catFamily,
      fontWeight:    catBold,
      fontSize:      (compact ? 13 : 18) * catScale,
      color:         readableOn(m.categories.color, bg),
      textTransform: 'uppercase',
      letterSpacing: compact ? 1.5 : 2,
      textAlign:     catAlign,
    },
    catTitleWrap: { marginBottom: m.categories.gapAfter ?? (compact ? 5 : 8) },
    // Flourish row: [line] TITLE [line] centred.
    catFlourishRow: {
      flexDirection: 'row',
      alignItems:    'center',
      justifyContent:'center',
      marginBottom:  m.categories.gapAfter ?? (compact ? 5 : 8),
    },
    flourishLine: {
      width:           m.categories.flourishWidth || 40,
      height:          m.categories.flourishThickness || 1,
      backgroundColor: m.categories.flourishColor,
      marginHorizontal: 8,
    },
    flourishGlyph: {
      fontFamily:    'Helvetica',
      fontSize:      (compact ? 11 : 14) * catScale,
      color:         m.categories.flourishColor,
      marginHorizontal: 8,
    },
    // Vector diamond flourish — ◆ is not WinAnsi-encodable in built-in fonts.
    flourishDiamond: {
      width:            (compact ? 6 : 7) * catScale,
      height:           (compact ? 6 : 7) * catScale,
      backgroundColor:  m.categories.flourishColor,
      transform:        'rotate(45deg)',
      marginHorizontal: 8,
    },
    catLine: {
      height:          0.5,
      backgroundColor: catLineColor,
      marginBottom:    compact ? 12 : 18,
    },
    // Continuation reference header — shown at the top of 2nd+ pages of the
    // same category: category name in smaller/muted text + a short accent line.
    catContinuationWrap: {
      marginBottom: compact ? 5 : 8,
    },
    catContinuationLabel: {
      fontFamily:    catFamily,
      fontWeight:    catBold,
      fontSize:      (compact ? 7 : 8.5) * catScale,
      color:         catContColor,
      textTransform: 'uppercase',
      letterSpacing: compact ? 1 : 1.5,
      textAlign:     catAlign,
    },
    catContinuationLine: {
      height:          0.4,
      width:           '30%',
      alignSelf:       contLineAlignSelf,
      backgroundColor: catLineColor,
      opacity:         0.55,
      marginTop:       compact ? 2 : 3,
      marginBottom:    compact ? 6 : 10,
    },
    // ── List layout ─────────────────────────────────────────────────────────
    dishRow: {
      flexDirection:  'row',
      justifyContent: nameAlign === 'center' ? 'center' : nameAlign === 'right' ? 'flex-end' : 'space-between',
      alignItems:     'flex-start',
      marginBottom:   compact ? 2 : 3,
    },
    // Stacked rows (price above/below the name) follow the name alignment.
    dishStack: {
      flexDirection: 'column',
      alignItems:    nameAlign === 'center' ? 'center' : nameAlign === 'right' ? 'flex-end' : 'flex-start',
      marginBottom:  compact ? 2 : 3,
    },
    // Spacing between the stacked price and name so they never touch.
    stackPrice: { marginBottom: 2 },
    stackPriceBelow: { marginTop: 2 },
    // dishName normally uses flex:1 to push the price to the row's far edge,
    // but inside a column (price above/below) flex:1 + flexBasis:0 collapses
    // the name's height to 0, making the description overlap/merge with it.
    stackName: { flex: 0, flexGrow: 0, flexShrink: 0, marginRight: 0 },
    dishName: {
      fontFamily:    titleFamily,
      fontWeight:    titleBold,
      fontSize:      (compact ? 9 : 10) * titleScale,
      color:         readableOn(m.dishes.titleColor, bg),
      textTransform: 'uppercase',
      letterSpacing: compact ? 0.4 : 0.6,
      flex:          nameAlign === 'left' ? 1 : undefined,
      marginRight:   nameAlign === 'left' ? 14 : 8,
    },
    dishPrice: {
      fontFamily: priceFamily,
      fontWeight: priceBold,
      fontSize:   (compact ? 9 : 10) * priceScale,
      color:      readableOn(m.prices.color, bg),
      textAlign:  priceAlign,
    },
    dishDesc: {
      fontFamily:   descFamily,
      fontSize:     (compact ? 7.5 : 8.5) * baseScale,
      color:        readableOn(m.descriptions.color, bg),
      lineHeight:   1.55,
      marginBottom: compact ? 2 : 3,
      textAlign:    descAlign,
    },
    dishAllergens: {
      fontFamily:    'Helvetica',
      fontSize:      (compact ? 6.5 : 7) * alrgScale,
      color:         readableOn(m.allergens.color, bg),
      letterSpacing: 0.2,
      textAlign:     allgnAlign,
    },
    // Spacer between dishes when no divider is drawn — same TOTAL gap as the
    // divider variants so switching divider type never changes the rhythm.
    dishGap: { height: gapTotal },
    // Bordered divider lines (solid / dashed / dotted). width controls the
    // horizontal extent (independent from thickness/color), centred on the page.
    dividerLine: {
      height:         0,
      width:          `${divWidthPct}%`,
      alignSelf:      'center',
      borderTopWidth: divWidth,
      borderTopColor: divColor,
      marginVertical: gapTotal / 2,
    },
    // Double line.
    dividerDouble: {
      height:            divWidth * 3,
      width:             `${divWidthPct}%`,
      alignSelf:         'center',
      borderTopWidth:    divWidth,
      borderTopColor:    divColor,
      borderBottomWidth: divWidth,
      borderBottomColor: divColor,
      marginVertical:    gapTotal / 2,
    },
    // Gradient → centred hairline, width controls the horizontal extent.
    dividerGradient: {
      height:          divWidth,
      width:           `${divWidthPct}%`,
      alignSelf:       'center',
      backgroundColor: divColor,
      marginVertical:  gapTotal / 2,
    },
    // Ornament / wavy → centred decorative row, width controls the horizontal extent.
    dividerGlyphWrap: {
      marginVertical: gapTotal / 2,
      width:          `${divWidthPct}%`,
      alignSelf:      'center',
      flexDirection:  'row',
      justifyContent: 'center',
      alignItems:     'center',
    },
    // ASCII-only glyph text: built-in PDF fonts are WinAnsi-encoded, exotic
    // glyphs (✦ ～ ◆) render as missing glyphs — never use them here.
    dividerGlyph: {
      fontFamily:    'Helvetica',
      fontSize:      compact ? 8 : 9,
      color:         divColor,
      textAlign:     'center',
      letterSpacing: 2,
    },
    // True wavy line, drawn as an SVG path (vector — no font/glyph issues).
    dividerWave: {
      height: compact ? 6 : 8,
      width:  '100%',
    },
    // Vector diamond (rotated square) — WinAnsi-safe replacement for ✦ / ◆.
    diamondShape: {
      width:            compact ? 4 : 5,
      height:           compact ? 4 : 5,
      backgroundColor:  divColor,
      transform:        'rotate(45deg)',
      marginHorizontal: 6,
    },
    // ── Grid layout ───────────────────────────────────────────────────────────
    gridRow: {
      flexDirection: 'row',
      flexWrap:      'wrap',
      marginBottom:  compact ? 4 : 6,
    },
    gridCell2: {
      width:        '50%',
      paddingRight: 12,
      marginBottom: (compact ? 8 : 12) + spacing,
    },
    gridCell3: {
      width:        '33.33%',
      paddingRight: 10,
      marginBottom: (compact ? 7 : 10) + spacing,
    },
    // ── Boxed layout ─────────────────────────────────────────────────────────
    boxedItem: {
      border:        `${m.layout.boxedBorderWidth ?? 1}pt solid ${divColor}`,
      padding:       compact ? 7 : 10,
      marginBottom:  (compact ? 6 : 10) + spacing,
    },
    // ── Elegant layout (centred, generous) ────────────────────────────────────
    elegantItem: {
      alignItems:   'center',
      marginBottom: (compact ? 10 : 16) + spacing,
    },
    catSpacer: {
      marginTop: compact ? 20 : 0,
    },
  })
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  restaurant:      PDFRestaurant
  menu:            PDFMenu
  theme?:          RestaurantTheme
  registeredFonts?: Set<string>
}

// Split an array into chunks of n (n<=0 → single chunk).
function chunk<T>(arr: T[], n: number): T[][] {
  if (n <= 0) return [arr]
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// ── Embedded text block (info / allergen page) — HTML-aware renderer ─────────

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ')
}

function boldVariant(family: string, registered: Set<string>): string {
  if (registered.has(family)) return family   // Google Font: use fontWeight
  if (family === 'Times-Roman') return 'Times-Bold'
  if (family === 'Courier')     return 'Courier-Bold'
  return 'Helvetica-Bold'                     // default or Helvetica
}

type InlineStyle = { fontFamily: string; fontWeight?: number; fontStyle?: 'normal' | 'italic' | 'oblique'; fontSize: number; color: string; lineHeight: number }

// Parse inline HTML marks (<strong>, <em>, <span style="color:...">) and
// return an array of Text nodes (strings or nested <Text> elements).
function parseInline(
  html: string,
  base: InlineStyle,
  registered: Set<string>,
  keyPrefix: string,
): React.ReactNode[] {
  const result: React.ReactNode[] = []
  const re = /<(strong|em|span)\b([^>]*)>([\s\S]*?)<\/\1>|<br\s*\/?>|([^<]+)/g
  let m
  while ((m = re.exec(html)) !== null) {
    const [, tag, attrs, inner, text] = m
    if (text !== undefined) {
      const decoded = decodeEntities(text)
      if (decoded) result.push(decoded)
      continue
    }
    if (!tag) { result.push('\n'); continue }

    let style: typeof base = { ...base }
    if (tag === 'strong') {
      style = { ...style, fontFamily: boldVariant(base.fontFamily, registered), fontWeight: 700 }
    } else if (tag === 'em') {
      style = { ...style, fontStyle: 'italic' as const }
    } else if (tag === 'span') {
      const cm = attrs.match(/color:\s*([^;"']+)/)
      if (cm) style = { ...style, color: cm[1].trim() }
    }
    result.push(
      <Text key={`${keyPrefix}-${result.length}`} style={style}>
        {parseInline(inner, style, registered, `${keyPrefix}-${result.length}`)}
      </Text>
    )
  }
  return result
}

// Render an EmbeddedPageContent body (HTML or plain text) as react-pdf nodes.
// Each block element (h1–h3, p) becomes a separate <Text> with its own style.
function EmbeddedTextBlock({
  page, bg, registered,
}: {
  page:       EmbeddedPageContent
  bg:         string
  registered: Set<string>
}) {
  const baseFontFamily = registered.has(page.font) ? page.font : 'Helvetica'
  const baseFontSize   = Math.max(8, Math.min(36, page.fontSize))
  const defaultColor   = readableOn(page.color, bg)
  const body           = page.body ?? ''

  // Detect HTML body vs legacy plain text
  const isHtml = body.trimStart().startsWith('<')

  if (!isHtml) {
    // Legacy plain text: render as single Text block
    return (
      <Text style={{
        fontFamily:  baseFontFamily,
        fontWeight:  page.bold   ? 700 : 400,
        fontStyle:   page.italic ? 'italic' : 'normal',
        fontSize:    baseFontSize,
        color:       defaultColor,
        textAlign:   page.align,
        lineHeight:  page.lineHeight,
      }}>
        {body}
      </Text>
    )
  }

  // Parse HTML blocks and render as react-pdf Text elements
  const blockRe = /<(h[1-3]|p)([^>]*)>([\s\S]*?)<\/\1>/g
  const blocks: React.ReactNode[] = []
  let m: RegExpExecArray | null
  let blockIdx = 0

  while ((m = blockRe.exec(body)) !== null) {
    const [, tag, attrs, inner] = m
    const isH1 = tag === 'h1', isH2 = tag === 'h2', isH3 = tag === 'h3'
    const isHeading = isH1 || isH2 || isH3

    // Paragraph-level alignment from Tiptap style attribute
    const alignM = attrs.match(/text-align:\s*(left|center|right)/)
    const textAlign = (alignM ? alignM[1] : page.align) as 'left' | 'center' | 'right'

    const scale     = isH1 ? 2.2 : isH2 ? 1.6 : isH3 ? 1.25 : 1.0
    const fontSize  = baseFontSize * scale
    const fontWeight= isHeading ? 700 : (page.bold ? 700 : 400)
    const fontFamily= (isHeading || fontWeight === 700)
      ? boldVariant(baseFontFamily, registered)
      : baseFontFamily

    const fontStyleVal = ((!isHeading && page.italic) ? 'italic' : 'normal') as 'normal' | 'italic'
    const blockStyle = {
      fontFamily,
      fontWeight,
      fontStyle:    fontStyleVal,
      fontSize,
      color:        defaultColor,
      textAlign,
      lineHeight:   page.lineHeight,
      marginBottom: isH1 ? 6 : isH2 ? 5 : isH3 ? 4 : 3,
    }

    // Empty <p></p> → add spacing
    if (!inner.trim()) {
      blocks.push(<Text key={blockIdx++} style={{ ...blockStyle, fontSize: baseFontSize * 0.45 }}>{' '}</Text>)
      continue
    }

    const inlineBase: InlineStyle = { fontFamily, fontWeight, fontStyle: fontStyleVal, fontSize, color: defaultColor, lineHeight: page.lineHeight }
    blocks.push(
      <Text key={blockIdx++} style={blockStyle}>
        {parseInline(inner, inlineBase, registered, String(blockIdx))}
      </Text>
    )
  }

  // Fallback: no blocks matched → render raw
  if (blocks.length === 0) {
    return (
      <Text style={{ fontFamily: baseFontFamily, fontSize: baseFontSize, color: defaultColor, lineHeight: page.lineHeight, textAlign: page.align }}>
        {decodeEntities(body.replace(/<[^>]+>/g, ' '))}
      </Text>
    )
  }

  return <>{blocks}</>
}

// ── Dish menu ─────────────────────────────────────────────────────────────────

export function MenuPDFDocument({ restaurant, menu, theme: themeProp, registeredFonts }: Props) {
  const theme      = themeProp ?? DEFAULT_THEME
  const m          = theme.menu
  const reg        = registeredFonts ?? new Set<string>()
  const compact    = m.pdfLayout === 'compact'
  const bg         = m.pageBackground.color
  const alternating= compact && m.compactMode === 'alternating'
  // Two style sets: base and horizontally mirrored. The alternating compact
  // mode applies the mirrored set to ODD categories so the WHOLE category
  // (title + dish names + descriptions + allergens + prices) flips coherently.
  const s          = makeStyles(theme, reg, false)
  const sFlip      = alternating ? makeStyles(theme, reg, true) : s
  const categories = groupByCategory(menu.dishes)

  // Collect enabled embedded pages sorted into 'first' and 'last' groups.
  // Info precedes allergen within each group (natural document order).
  const ep = menu.extra_pages
  const firstEmbedded: EmbeddedPageContent[] = [
    ep?.info?.enabled     && ep.info.position     === 'first' ? ep.info     : null,
    ep?.allergen?.enabled && ep.allergen.position === 'first' ? ep.allergen : null,
  ].filter((x): x is EmbeddedPageContent => !!x && !!x.body.trim())
  const lastEmbedded: EmbeddedPageContent[] = [
    ep?.info?.enabled     && ep.info.position     === 'last'  ? ep.info     : null,
    ep?.allergen?.enabled && ep.allergen.position === 'last'  ? ep.allergen : null,
  ].filter((x): x is EmbeddedPageContent => !!x && !!x.body.trim())
  const layout     = m.layout.dishLayout
  const isGrid2    = layout === 'grid-2'
  const isGrid3    = layout === 'grid-3'
  const isGrid     = isGrid2 || isGrid3
  const isBoxed    = layout === 'boxed-card'
  const isMinimal  = layout === 'minimal-row'
  const isElegant  = layout === 'elegant'

  const pos      = m.prices.position
  const dType    = m.layout.divider.type
  const divColor = m.layout.divider.color
  const divWidth = m.layout.divider.width || 0.5
  const perPage  = m.layout.dishesPerPage || 0

  // Name + price arranged per the price position setting.
  function namePriceBlock(dish: PDFDish, priceStr: string | null, st: typeof s) {
    const nameEl  = <Text style={st.dishName}>{dish.name}</Text>
    const priceEl = priceStr ? <Text style={st.dishPrice}>{priceStr}</Text> : null
    if (!priceEl) return <View style={st.dishRow}>{nameEl}</View>
    if (pos === 'above' || pos === 'below') {
      const stackNameEl = <Text style={[st.dishName, st.stackName]}>{dish.name}</Text>
      return pos === 'above'
        ? <View style={st.dishStack}><Text style={[st.dishPrice, st.stackPrice]}>{priceStr}</Text>{stackNameEl}</View>
        : <View style={st.dishStack}>{stackNameEl}<Text style={[st.dishPrice, st.stackPriceBelow]}>{priceStr}</Text></View>
    }
    if (pos === 'left')  return <View style={st.dishRow}>{priceEl}{nameEl}</View>
    return <View style={st.dishRow}>{nameEl}{priceEl}</View>  // 'right' (default)
  }

  // Divider element — its shape genuinely changes per type.
  // Built-in PDF fonts are WinAnsi-encoded: ornament/wavy use vector shapes and
  // ASCII glyphs only (✦ ～ ◆ would render as missing glyphs and break layout).
  function divider(key: string) {
    if (dType === 'none') return <View key={key} style={s.dishGap} />
    if (dType === 'double')   return <View key={key} style={s.dividerDouble} />
    if (dType === 'gradient') return <View key={key} style={s.dividerGradient} />
    if (dType === 'ornament') return (
      <View key={key} style={s.dividerGlyphWrap}>
        <View style={s.diamondShape} /><View style={s.diamondShape} /><View style={s.diamondShape} />
      </View>
    )
    if (dType === 'wavy') return (
      <View key={key} style={s.dividerGlyphWrap}>
        <Svg style={s.dividerWave} viewBox="0 0 240 10" preserveAspectRatio="none">
          <Path d={WAVE_PATH} stroke={divColor} strokeWidth={divWidth * 4} fill="none" />
        </Svg>
      </View>
    )
    // solid / dashed / dotted → a real border line with the chosen style.
    const borderStyle = dType === 'dashed' ? 'dashed' : dType === 'dotted' ? 'dotted' : 'solid'
    return <View key={key} style={[s.dividerLine, { borderStyle } as any]} />
  }

  function allergenText(dish: PDFDish): string | null {
    const lang = menu.lang ?? 'it'
    return dish.allergens.length > 0
      ? uiText('allergens', isLang(lang) ? lang : 'it') + ': ' +
        formatAllergens(dish.allergens, m.allergens.display, m.allergens.separator, lang)
      : null
  }

  function renderDish(dish: PDFDish, isLast: boolean, st: typeof s) {
    const priceStr    = dish.price != null ? formatPrice(dish.price, m.prices.format, m.prices.currency) : null
    const allergenStr = allergenText(dish)

    if (isBoxed) {
      return (
        <View key={dish.id} style={st.boxedItem} wrap={false}>
          {namePriceBlock(dish, priceStr, st)}
          {dish.description ? <Text style={st.dishDesc}>{dish.description}</Text> : null}
          {allergenStr ? <Text style={st.dishAllergens}>{allergenStr}</Text> : null}
        </View>
      )
    }

    if (isElegant) {
      return (
        <View key={dish.id} style={st.elegantItem} wrap={false}>
          <Text style={[st.dishName, { textAlign: 'center', marginRight: 0 }]}>{dish.name}</Text>
          {priceStr ? <Text style={[st.dishPrice, { textAlign: 'center', marginTop: 2 }]}>{priceStr}</Text> : null}
          {dish.description ? <Text style={[st.dishDesc, { textAlign: 'center' }]}>{dish.description}</Text> : null}
          {allergenStr ? <Text style={[st.dishAllergens, { textAlign: 'center' }]}>{allergenStr}</Text> : null}
        </View>
      )
    }

    return (
      <View key={dish.id} wrap={false}>
        {namePriceBlock(dish, priceStr, st)}
        {!isMinimal && dish.description ? <Text style={st.dishDesc}>{dish.description}</Text> : null}
        {!isMinimal && allergenStr ? <Text style={st.dishAllergens}>{allergenStr}</Text> : null}
        {/* Divider under EVERY dish except the last of its category. */}
        {!isLast && divider(dish.id + '-div')}
      </View>
    )
  }

  // Category header: title, optionally wrapped with decorative flourishes.
  // Alignment (incl. the alternating flip) is baked into the style set.
  function categoryHeader(cat: { name: string }, st: typeof s) {
    const fl = m.categories.flourish
    if (fl !== 'none') {
      const deco = fl === 'lines' ? <View style={st.flourishLine} />
                 : fl === 'dots'  ? <Text style={st.flourishGlyph}>• • •</Text>
                 :                   <View style={st.flourishDiamond} />
      return (
        <View style={st.catFlourishRow}>
          {deco}
          <Text style={[st.catTitle, { textAlign: 'center' }]}>{cat.name}</Text>
          {fl === 'lines' ? <View style={st.flourishLine} />
           : fl === 'dots' ? <Text style={st.flourishGlyph}>• • •</Text>
           : <View style={st.flourishDiamond} />}
        </View>
      )
    }
    return (
      <View style={st.catTitleWrap}>
        <Text style={st.catTitle}>{cat.name}</Text>
      </View>
    )
  }

  // ── Page blocks ────────────────────────────────────────────────────────────
  // react-pdf only honours `break` on a node when its parent's children are
  // actually re-evaluated for pagination — which only happens when the parent
  // doesn't fit on the current page. Nesting "N dishes per page" breaks inside
  // a per-category wrapper meant the break was silently ignored whenever the
  // whole category happened to fit on the page. To make `dishesPerPage` work
  // reliably, every group that may need its own page is a DIRECT child of
  // <Page>, pre-chunked here.
  interface Block {
    key:         string
    breakBefore: boolean
    catIdx:      number
    cat:         { name: string }
    st:          typeof s
    showHeader:  boolean
    isGrid:      boolean
    dishes:      PDFDish[]
    lastFlags:   boolean[]   // per dish: true if it's the last dish of its category
  }

  const blocks: Block[] = []
  // Compact mode: dishes flow continuously, so a running counter (reset only
  // by the orphan-avoidance rule below) lets later categories fill the
  // remaining slots of the current page.
  let compactCounter = 0

  categories.forEach((cat, catIdx) => {
    const flipped = alternating && catIdx % 2 === 1
    const st      = flipped ? sFlip : s
    const n       = cat.dishes.length
    const lastFlags = (dishes: PDFDish[], offset: number) => dishes.map((_, i) => offset + i === n - 1)

    if (perPage <= 0) {
      if (!compact) {
        // Non-compact auto mode: always split into layout-tuned chunks so that
        // continuation pages are explicit blocks and always get a reference header.
        // The chunk size is a conservative per-page estimate for each layout; single-
        // chunk categories (n ≤ autoSize) produce one block — no forced page break.
        const autoSize = isElegant ? 6 : isBoxed ? 5 : isGrid2 ? 8 : isGrid3 ? 12 : isMinimal ? 14 : 8
        chunk(cat.dishes, autoSize).forEach((dishes, ci) => {
          blocks.push({
            key: `${cat.name}-${ci}`,
            breakBefore: ci > 0 || catIdx > 0,
            catIdx, cat, st,
            showHeader: ci === 0,
            isGrid,
            dishes,
            lastFlags: isGrid ? dishes.map(() => false) : lastFlags(dishes, ci * autoSize),
          })
        })
        return
      }
      // Compact mode: natural continuous flow — no per-category page break.
      blocks.push({ key: cat.name, breakBefore: false, catIdx, cat, st, showHeader: true, isGrid, dishes: cat.dishes, lastFlags: lastFlags(cat.dishes, 0) })
      return
    }

    if (isGrid) {
      // Grids honour "N per pagina" too: cells are chunked and every chunk
      // after the first starts on a new page.
      chunk(cat.dishes, perPage).forEach((dishes, ci) => {
        blocks.push({ key: `${cat.name}-${ci}`, breakBefore: ci > 0 || (!compact && catIdx > 0), catIdx, cat, st, showHeader: ci === 0, isGrid: true, dishes, lastFlags: dishes.map(() => false) })
      })
      return
    }

    if (!compact) {
      // Classic mode: each category already starts a fresh page, so chunks
      // are counted from 0 within the category.
      chunk(cat.dishes, perPage).forEach((dishes, ci) => {
        blocks.push({ key: `${cat.name}-${ci}`, breakBefore: ci > 0 || catIdx > 0, catIdx, cat, st, showHeader: ci === 0, isGrid: false, dishes, lastFlags: lastFlags(dishes, ci * perPage) })
      })
      return
    }

    // Compact mode: fill the remaining slots on the current page first
    // (a new category's dishes can top up the previous category's last
    // page), then chunk the rest into full pages.
    let idx = 0
    let firstChunk = true
    while (idx < n) {
      const room        = perPage - (compactCounter % perPage)
      const breakBefore = compactCounter > 0 && compactCounter % perPage === 0
      const take        = Math.min(room, n - idx)
      const dishes      = cat.dishes.slice(idx, idx + take)
      blocks.push({ key: `${cat.name}-${idx}`, breakBefore, catIdx, cat, st, showHeader: firstChunk, isGrid: false, dishes, lastFlags: lastFlags(dishes, idx) })
      compactCounter += take
      idx += take
      firstChunk = false
    }
  })

  return (
    <Document
      title={`${restaurant.name} — ${menu.name}`}
      author={restaurant.name}
      creator="Digital Menu Pro"
    >
      <Page size="A4" style={s.page} wrap>
        <PageBackgroundLayer bg={m.pageBackground} compact={compact} />

        {/* Embedded pages that appear before all dish categories */}
        {firstEmbedded.map((page, i) => (
          <View key={`first-${i}`} break={i > 0}>
            <EmbeddedTextBlock page={page} bg={bg} registered={reg} />
          </View>
        ))}

        {blocks.map((b, i) => (
          <View key={b.key} break={b.breakBefore || (i === 0 && firstEmbedded.length > 0)}>

            {/* Full category header on the first block of each category. */}
            {b.showHeader && compact && b.catIdx > 0 && <View style={s.catSpacer} />}
            {b.showHeader && categoryHeader(b.cat, b.st)}
            {b.showHeader && <View style={s.catLine} />}

            {/* Compact continuation reference on 2nd+ pages of the same category:
                category name in smaller/muted text so the reader always knows
                which section they're in, without cluttering the page. */}
            {!b.showHeader && (
              <View style={b.st.catContinuationWrap}>
                <Text style={b.st.catContinuationLabel}>{b.cat.name}</Text>
                <View style={b.st.catContinuationLine} />
              </View>
            )}

            {b.isGrid ? (
              <View style={s.gridRow}>
                {b.dishes.map((dish) => {
                  const priceStr    = dish.price != null ? formatPrice(dish.price, m.prices.format, m.prices.currency) : null
                  const allergenStr = allergenText(dish)
                  return (
                    <View key={dish.id} style={isGrid3 ? b.st.gridCell3 : b.st.gridCell2} wrap={false}>
                      <View style={b.st.dishRow}>
                        <Text style={b.st.dishName}>{dish.name}</Text>
                        {priceStr && <Text style={b.st.dishPrice}>{priceStr}</Text>}
                      </View>
                      {dish.description ? <Text style={b.st.dishDesc}>{dish.description}</Text> : null}
                      {allergenStr ? <Text style={b.st.dishAllergens}>{allergenStr}</Text> : null}
                    </View>
                  )
                })}
              </View>
            ) : (
              b.dishes.map((dish, i) => renderDish(dish, b.lastFlags[i], b.st))
            )}

          </View>
        ))}

        {/* Embedded pages that appear after all dish categories */}
        {lastEmbedded.map((page, i) => (
          <View key={`last-${i}`} break>
            <EmbeddedTextBlock page={page} bg={bg} registered={reg} />
          </View>
        ))}
      </Page>
    </Document>
  )
}
