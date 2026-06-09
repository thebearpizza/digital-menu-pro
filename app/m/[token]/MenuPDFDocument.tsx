// ─────────────────────────────────────────────────────────────────────────────
// MenuPDFDocument — @react-pdf/renderer document for a single restaurant menu.
// Dynamically imported by useMenuPDF (never SSR-ed).
// ─────────────────────────────────────────────────────────────────────────────
import { Document, Page, Text, View, StyleSheet, Svg, Path } from '@react-pdf/renderer'
import { formatAllergens } from '@/lib/allergens'
import type { RestaurantTheme } from '@/lib/theme'
import { DEFAULT_THEME, lightenHex, formatPrice, resolveAlign } from '@/lib/theme'

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

export interface PDFMenu {
  id: string
  name: string
  dishes: PDFDish[]
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

// ── Dynamic styles ────────────────────────────────────────────────────────────

// Mirror an alignment horizontally — used by the alternating compact mode so a
// flipped category flips its dishes too, not just the category title.
function flipAlign(a: 'left' | 'center' | 'right'): 'left' | 'center' | 'right' {
  return a === 'left' ? 'right' : a === 'right' ? 'left' : 'center'
}

function makeStyles(theme: RestaurantTheme, registered: Set<string>, flipped = false) {
  const m         = theme.menu
  const compact   = m.pdfLayout === 'compact'
  const catLineColor = lightenHex(m.accent, 0.55)
  const divColor  = m.layout.divider.color
  const divWidth  = m.layout.divider.width || 0.5
  const divWidthPct = m.layout.divider.widthPercent || 100
  const bg        = m.pageBackground
  const spacing   = m.layout.dishSpacing || 0
  // Inter-dish gap: identical TOTAL distance whatever the divider type, so the
  // spacing slider behaves uniformly (gapBase + spacing between any two dishes).
  const gapBase   = compact ? 16 : 24
  const gapTotal  = gapBase + spacing
  // General + per-element alignment ('inherit' falls back to the general value).
  const general   = m.layout.dishAlignment === 'center' ? 'center' : m.layout.dishAlignment === 'right' ? 'right' : 'left'
  const maybeFlip = (a: 'left' | 'center' | 'right') => flipped ? flipAlign(a) : a
  const catAlign  = maybeFlip(resolveAlign(m.categories.align, general))
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
    catTitleWrap: { marginBottom: compact ? 5 : 8 },
    // Flourish row: [line] TITLE [line] centred.
    catFlourishRow: {
      flexDirection: 'row',
      alignItems:    'center',
      justifyContent:'center',
      marginBottom:  compact ? 5 : 8,
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

export function MenuPDFDocument({ restaurant, menu, theme: themeProp, registeredFonts }: Props) {
  const theme      = themeProp ?? DEFAULT_THEME
  const m          = theme.menu
  const reg        = registeredFonts ?? new Set<string>()
  const compact    = m.pdfLayout === 'compact'
  const alternating= compact && m.compactMode === 'alternating'
  // Two style sets: base and horizontally mirrored. The alternating compact
  // mode applies the mirrored set to ODD categories so the WHOLE category
  // (title + dish names + descriptions + allergens + prices) flips coherently.
  const s          = makeStyles(theme, reg, false)
  const sFlip      = alternating ? makeStyles(theme, reg, true) : s
  const categories = groupByCategory(menu.dishes)
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

  // Running dish index on the CURRENT page — drives the "N dishes per page"
  // break. In classic mode each category already starts a fresh page, so the
  // counter resets per category; in compact mode the flow is continuous and
  // the counter runs globally (it resets implicitly at every forced break).
  let dishCounter = 0

  // Name + price arranged per the price position setting.
  function namePriceBlock(dish: PDFDish, priceStr: string | null, st: typeof s) {
    const nameEl  = <Text style={st.dishName}>{dish.name}</Text>
    const priceEl = priceStr ? <Text style={st.dishPrice}>{priceStr}</Text> : null
    if (!priceEl) return <View style={st.dishRow}>{nameEl}</View>
    if (pos === 'above') return <View style={st.dishStack}><Text style={[st.dishPrice, st.stackPrice]}>{priceStr}</Text>{nameEl}</View>
    if (pos === 'below') return <View style={st.dishStack}>{nameEl}<Text style={[st.dishPrice, st.stackPriceBelow]}>{priceStr}</Text></View>
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
    return dish.allergens.length > 0
      ? 'Allergeni: ' + formatAllergens(dish.allergens, m.allergens.display, m.allergens.separator)
      : null
  }

  function renderDish(dish: PDFDish, isLast: boolean, st: typeof s) {
    const priceStr    = dish.price != null ? formatPrice(dish.price, m.prices.format, m.prices.currency) : null
    const allergenStr = allergenText(dish)
    // N-dishes-per-page: force a page break before the dish that starts a new page.
    const forceBreak  = perPage > 0 && dishCounter > 0 && dishCounter % perPage === 0
    dishCounter++

    if (isBoxed) {
      return (
        <View key={dish.id} style={st.boxedItem} wrap={false} break={forceBreak}>
          {namePriceBlock(dish, priceStr, st)}
          {dish.description ? <Text style={st.dishDesc}>{dish.description}</Text> : null}
          {allergenStr ? <Text style={st.dishAllergens}>{allergenStr}</Text> : null}
        </View>
      )
    }

    if (isElegant) {
      return (
        <View key={dish.id} style={st.elegantItem} wrap={false} break={forceBreak}>
          <Text style={[st.dishName, { textAlign: 'center', marginRight: 0 }]}>{dish.name}</Text>
          {priceStr ? <Text style={[st.dishPrice, { textAlign: 'center', marginTop: 2 }]}>{priceStr}</Text> : null}
          {dish.description ? <Text style={[st.dishDesc, { textAlign: 'center' }]}>{dish.description}</Text> : null}
          {allergenStr ? <Text style={[st.dishAllergens, { textAlign: 'center' }]}>{allergenStr}</Text> : null}
        </View>
      )
    }

    return (
      <View key={dish.id} wrap={false} break={forceBreak}>
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

  return (
    <Document
      title={`${restaurant.name} — ${menu.name}`}
      author={restaurant.name}
      creator="Digital Menu Pro"
    >
      <Page size="A4" style={s.page} wrap>
        {categories.map((cat, catIdx) => {
          const flipped = alternating && catIdx % 2 === 1
          const st      = flipped ? sFlip : s
          // Classic mode starts every category on a fresh page → reset the
          // per-page dish counter so "N per pagina" counts from that page.
          if (!compact) dishCounter = 0

          return (
            <View key={cat.name} break={!compact && catIdx > 0}>

              {compact && catIdx > 0 && <View style={s.catSpacer} />}

              {categoryHeader(cat, st)}
              <View style={s.catLine} />

              {isGrid ? (
                // Grids honour "N per pagina" too: cells are chunked and every
                // chunk after the first starts on a new page.
                chunk(cat.dishes, perPage).map((dishes, ci) => (
                  <View key={ci} style={s.gridRow} break={ci > 0}>
                    {dishes.map((dish) => {
                      const priceStr    = dish.price != null ? formatPrice(dish.price, m.prices.format, m.prices.currency) : null
                      const allergenStr = allergenText(dish)
                      return (
                        <View key={dish.id} style={isGrid3 ? st.gridCell3 : st.gridCell2} wrap={false}>
                          <View style={st.dishRow}>
                            <Text style={st.dishName}>{dish.name}</Text>
                            {priceStr && <Text style={st.dishPrice}>{priceStr}</Text>}
                          </View>
                          {dish.description ? <Text style={st.dishDesc}>{dish.description}</Text> : null}
                          {allergenStr ? <Text style={st.dishAllergens}>{allergenStr}</Text> : null}
                        </View>
                      )
                    })}
                  </View>
                ))
              ) : (
                cat.dishes.map((dish, dishIdx) => renderDish(dish, dishIdx === cat.dishes.length - 1, st))
              )}

            </View>
          )
        })}
      </Page>
    </Document>
  )
}
