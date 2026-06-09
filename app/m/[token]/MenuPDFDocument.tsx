// ─────────────────────────────────────────────────────────────────────────────
// MenuPDFDocument — @react-pdf/renderer document for a single restaurant menu.
// Dynamically imported by useMenuPDF (never SSR-ed).
// ─────────────────────────────────────────────────────────────────────────────
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { formatAllergens } from '@/lib/allergens'
import type { RestaurantTheme } from '@/lib/theme'
import { DEFAULT_THEME, lightenHex, formatPrice, resolveAlign } from '@/lib/theme'

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

function makeStyles(theme: RestaurantTheme, registered: Set<string>) {
  const m         = theme.menu
  const compact   = m.pdfLayout === 'compact'
  const catLineColor = lightenHex(m.accent, 0.55)
  const divColor  = m.layout.divider.color
  const divWidth  = m.layout.divider.width || 0.5
  const bg        = m.pageBackground
  const spacing   = m.layout.dishSpacing || 0
  // General + per-element alignment ('inherit' falls back to the general value).
  const general   = m.layout.dishAlignment === 'center' ? 'center' : m.layout.dishAlignment === 'right' ? 'right' : 'left'
  const catAlign  = resolveAlign(m.categories.align, general)
  const nameAlign = resolveAlign(m.dishes.align,     general)
  // Description & allergens inherit from the DISH TITLE alignment (not the
  // general one) so they "follow the title" until explicitly overridden.
  const descAlign  = m.descriptions.align === 'inherit' ? nameAlign : m.descriptions.align
  const allgnAlign = m.allergens.align    === 'inherit' ? nameAlign : m.allergens.align
  const priceAlign = resolveAlign(m.prices.align, general)

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
    // Spacer between dishes when no divider is drawn.
    dishGap: { height: (compact ? 8 : 12) + spacing },
    // Bordered divider lines (solid / dashed / dotted).
    dividerLine: {
      height:         0,
      borderTopWidth: divWidth,
      borderTopColor: divColor,
      marginVertical: (compact ? 8 : 12) + spacing / 2,
    },
    // Double line.
    dividerDouble: {
      height:            divWidth * 3,
      borderTopWidth:    divWidth,
      borderTopColor:    divColor,
      borderBottomWidth: divWidth,
      borderBottomColor: divColor,
      marginVertical:    (compact ? 8 : 12) + spacing / 2,
    },
    // Gradient → centred short hairline (best effort, no CSS gradients in PDF).
    dividerGradient: {
      height:          divWidth,
      width:           '55%',
      marginHorizontal:'auto',
      backgroundColor: divColor,
      marginVertical:  (compact ? 8 : 12) + spacing / 2,
    },
    // Ornament / wavy → centred glyph string.
    dividerGlyphWrap: {
      marginVertical: (compact ? 7 : 11) + spacing / 2,
    },
    dividerGlyph: {
      fontFamily:    'Helvetica',
      fontSize:      compact ? 8 : 9,
      color:         divColor,
      textAlign:     'center',
      letterSpacing: 2,
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

export function MenuPDFDocument({ restaurant, menu, theme: themeProp, registeredFonts }: Props) {
  const theme      = themeProp ?? DEFAULT_THEME
  const m          = theme.menu
  const s          = makeStyles(theme, registeredFonts ?? new Set())
  const categories = groupByCategory(menu.dishes)
  const compact    = m.pdfLayout === 'compact'
  const alternating= compact && m.compactMode === 'alternating'
  const layout     = m.layout.dishLayout
  const isGrid2    = layout === 'grid-2'
  const isGrid3    = layout === 'grid-3'
  const isGrid     = isGrid2 || isGrid3
  const isBoxed    = layout === 'boxed-card'
  const isMinimal  = layout === 'minimal-row'
  const isElegant  = layout === 'elegant'

  const pos      = m.prices.position
  const dType    = m.layout.divider.type
  const perPage  = m.layout.dishesPerPage || 0

  // Global running dish index — drives the optional "N dishes per page" break.
  let dishCounter = 0

  const general  = m.layout.dishAlignment === 'center' ? 'center' : m.layout.dishAlignment === 'right' ? 'right' : 'left'

  // Name + price arranged per the price position setting.
  function namePriceBlock(dish: PDFDish, priceStr: string | null) {
    const nameEl  = <Text style={s.dishName}>{dish.name}</Text>
    const priceEl = priceStr ? <Text style={s.dishPrice}>{priceStr}</Text> : null
    if (!priceEl) return <View style={s.dishRow}>{nameEl}</View>
    if (pos === 'above') return <View style={s.dishStack}><Text style={[s.dishPrice, s.stackPrice]}>{priceStr}</Text>{nameEl}</View>
    if (pos === 'below') return <View style={s.dishStack}>{nameEl}<Text style={[s.dishPrice, s.stackPriceBelow]}>{priceStr}</Text></View>
    if (pos === 'left')  return <View style={s.dishRow}>{priceEl}{nameEl}</View>
    return <View style={s.dishRow}>{nameEl}{priceEl}</View>  // 'right' (default)
  }

  // Divider element — its shape genuinely changes per type.
  function divider(key: string) {
    if (dType === 'none') return <View key={key} style={s.dishGap} />
    if (dType === 'double')   return <View key={key} style={s.dividerDouble} />
    if (dType === 'gradient') return <View key={key} style={s.dividerGradient} />
    if (dType === 'ornament') return <View key={key} style={s.dividerGlyphWrap}><Text style={s.dividerGlyph}>✦  ✦  ✦</Text></View>
    if (dType === 'wavy')     return <View key={key} style={s.dividerGlyphWrap}><Text style={s.dividerGlyph}>～～～～～～～～</Text></View>
    // solid / dashed / dotted → a real border line with the chosen style.
    const borderStyle = dType === 'dashed' ? 'dashed' : dType === 'dotted' ? 'dotted' : 'solid'
    return <View key={key} style={[s.dividerLine, { borderStyle } as any]} />
  }

  function allergenText(dish: PDFDish): string | null {
    return dish.allergens.length > 0
      ? 'Allergeni: ' + formatAllergens(dish.allergens, m.allergens.display, m.allergens.separator)
      : null
  }

  function renderDish(dish: PDFDish, isLast: boolean) {
    const priceStr    = dish.price != null ? formatPrice(dish.price, m.prices.format, m.prices.currency) : null
    const allergenStr = allergenText(dish)
    // N-dishes-per-page: force a page break before the dish that starts a new page.
    const forceBreak  = perPage > 0 && dishCounter > 0 && dishCounter % perPage === 0
    dishCounter++

    if (isBoxed) {
      return (
        <View key={dish.id} style={s.boxedItem} wrap={false} break={forceBreak}>
          {namePriceBlock(dish, priceStr)}
          {dish.description ? <Text style={s.dishDesc}>{dish.description}</Text> : null}
          {allergenStr ? <Text style={s.dishAllergens}>{allergenStr}</Text> : null}
        </View>
      )
    }

    if (isElegant) {
      return (
        <View key={dish.id} style={s.elegantItem} wrap={false} break={forceBreak}>
          <Text style={[s.dishName, { textAlign: 'center', marginRight: 0 }]}>{dish.name}</Text>
          {priceStr ? <Text style={[s.dishPrice, { textAlign: 'center', marginTop: 2 }]}>{priceStr}</Text> : null}
          {dish.description ? <Text style={[s.dishDesc, { textAlign: 'center' }]}>{dish.description}</Text> : null}
          {allergenStr ? <Text style={[s.dishAllergens, { textAlign: 'center' }]}>{allergenStr}</Text> : null}
        </View>
      )
    }

    return (
      <View key={dish.id} wrap={false} break={forceBreak}>
        {namePriceBlock(dish, priceStr)}
        {!isMinimal && dish.description ? <Text style={s.dishDesc}>{dish.description}</Text> : null}
        {!isMinimal && allergenStr ? <Text style={s.dishAllergens}>{allergenStr}</Text> : null}
        {/* Divider under EVERY dish except the last of its category. */}
        {!isLast && divider(dish.id + '-div')}
      </View>
    )
  }

  // Category header: title, optionally wrapped with decorative flourishes.
  function categoryHeader(cat: { name: string }, catIdx: number) {
    const fl = m.categories.flourish
    // In alternating compact mode, flip the title alignment on odd categories.
    const flipped = alternating && catIdx % 2 === 1
    const align: 'left' | 'center' | 'right' = flipped
      ? (general === 'left' ? 'right' : general === 'right' ? 'left' : 'center')
      : resolveAlign(m.categories.align, general)

    if (fl !== 'none') {
      const left  = fl === 'lines'   ? <View style={s.flourishLine} />
                  : fl === 'dots'    ? <Text style={s.flourishGlyph}>• • •</Text>
                  :                    <Text style={s.flourishGlyph}>◆</Text>
      const right = fl === 'lines'   ? <View style={s.flourishLine} />
                  : fl === 'dots'    ? <Text style={s.flourishGlyph}>• • •</Text>
                  :                    <Text style={s.flourishGlyph}>◆</Text>
      return (
        <View style={s.catFlourishRow}>
          {left}
          <Text style={[s.catTitle, { textAlign: 'center' }]}>{cat.name}</Text>
          {right}
        </View>
      )
    }
    return (
      <View style={s.catTitleWrap}>
        <Text style={[s.catTitle, { textAlign: align }]}>{cat.name}</Text>
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
        {categories.map((cat, catIdx) => (
          <View key={cat.name} break={!compact && catIdx > 0}>

            {compact && catIdx > 0 && <View style={s.catSpacer} />}

            {categoryHeader(cat, catIdx)}
            <View style={s.catLine} />

            {isGrid ? (
              <View style={s.gridRow}>
                {cat.dishes.map((dish) => {
                  const priceStr    = dish.price != null ? formatPrice(dish.price, m.prices.format, m.prices.currency) : null
                  const allergenStr = allergenText(dish)
                  return (
                    <View key={dish.id} style={isGrid3 ? s.gridCell3 : s.gridCell2} wrap={false}>
                      <View style={s.dishRow}>
                        <Text style={s.dishName}>{dish.name}</Text>
                        {priceStr && <Text style={s.dishPrice}>{priceStr}</Text>}
                      </View>
                      {dish.description ? <Text style={s.dishDesc}>{dish.description}</Text> : null}
                      {allergenStr ? <Text style={s.dishAllergens}>{allergenStr}</Text> : null}
                    </View>
                  )
                })}
              </View>
            ) : (
              cat.dishes.map((dish, dishIdx) => renderDish(dish, dishIdx === cat.dishes.length - 1))
            )}

          </View>
        ))}
      </Page>
    </Document>
  )
}
