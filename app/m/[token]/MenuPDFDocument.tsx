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
  const dType     = m.layout.divider.type
  const noDivider = dType === 'none'
  const divColor  = m.layout.divider.color
  const bg        = m.pageBackground
  // General + per-element alignment ('inherit' falls back to the general value).
  const general   = m.layout.dishAlignment === 'center' ? 'center' : m.layout.dishAlignment === 'right' ? 'right' : 'left'
  const catAlign  = resolveAlign(m.categories.align,   general)
  const nameAlign = resolveAlign(m.dishes.align,       general)
  const descAlign = resolveAlign(m.descriptions.align, general)
  const priceAlign= resolveAlign(m.prices.align,       general)

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

  return StyleSheet.create({
    page: {
      backgroundColor:   bg,
      paddingTop:        compact ? 36 : 52,
      paddingBottom:     compact ? 24 : 40,
      paddingHorizontal: compact ? 42 : 54,
    },
    catTitle: {
      fontFamily:    catFamily,
      fontWeight:    catBold,
      fontSize:      (compact ? 13 : 18) * catScale,
      color:         readableOn(m.categories.color, bg),
      textTransform: 'uppercase',
      letterSpacing: compact ? 1.5 : 2,
      marginBottom:  compact ? 5 : 8,
      textAlign:     catAlign,
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
      fontSize:      compact ? 6.5 : 7,
      color:         '#9a9a9a',
      letterSpacing: 0.2,
      textAlign:     descAlign,
    },
    dishDivider: noDivider ? { height: compact ? 8 + m.layout.dishSpacing : 12 + m.layout.dishSpacing } : {
      // double → two stacked hairlines; dotted/dashed → border style; ornament →
      // dashed thicker; gradient → solid (react-pdf has no CSS gradient support).
      height:          dType === 'double' ? 2.5 : 0.5,
      borderTopWidth:  dType === 'double' ? 0.5 : 0,
      borderTopColor:  divColor,
      borderBottomWidth: dType === 'double' ? 0.5 : 0,
      borderBottomColor: divColor,
      backgroundColor: dType === 'double' ? undefined : divColor,
      borderStyle:     dType === 'dotted' ? 'dotted' : (dType === 'dashed' || dType === 'ornament') ? 'dashed' : 'solid',
      marginVertical:  compact ? 8 + m.layout.dishSpacing / 2 : 12 + m.layout.dishSpacing / 2,
    },
    // ── Grid layout (2-column) ───────────────────────────────────────────────
    gridRow: {
      flexDirection: 'row',
      flexWrap:      'wrap',
      gap:           10,
      marginBottom:  compact ? 4 : 6,
    },
    gridCell: {
      width:       '47%',
      marginBottom: compact ? 8 : 12,
    },
    // ── Boxed layout ─────────────────────────────────────────────────────────
    boxedItem: {
      border:        `${m.layout.boxedBorderWidth ?? 1}pt solid ${divColor}`,
      padding:       compact ? 7 : 10,
      marginBottom:  compact ? 6 : 10,
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
  const isGrid     = m.layout.dishLayout === 'grid-2'
  const isBoxed    = m.layout.dishLayout === 'boxed-card'
  const isMinimal  = m.layout.dishLayout === 'minimal-row'

  const pos = m.prices.position

  // Name + price arranged per the price position setting.
  function namePriceBlock(dish: PDFDish, priceStr: string | null) {
    const nameEl  = <Text style={s.dishName}>{dish.name}</Text>
    const priceEl = priceStr ? <Text style={s.dishPrice}>{priceStr}</Text> : null
    if (!priceEl) return <View style={s.dishRow}>{nameEl}</View>
    if (pos === 'above') return <View style={s.dishStack}>{priceEl}{nameEl}</View>
    if (pos === 'below') return <View style={s.dishStack}>{nameEl}{priceEl}</View>
    if (pos === 'left')  return <View style={s.dishRow}>{priceEl}{nameEl}</View>
    return <View style={s.dishRow}>{nameEl}{priceEl}</View>  // 'right' (default)
  }

  function renderDish(dish: PDFDish, isLast: boolean) {
    const priceStr    = dish.price != null ? formatPrice(dish.price, m.prices.format, m.prices.currency) : null
    const allergenStr = dish.allergens.length > 0 ? 'Allergeni: ' + formatAllergens(dish.allergens, m.allergens.display, m.allergens.separator) : null
    // Divider under EVERY dish (not just between) — except the very last one.
    const showDivider = !isLast && m.layout.divider.type !== 'none'

    if (isBoxed) {
      return (
        <View key={dish.id} style={s.boxedItem} wrap={false}>
          {namePriceBlock(dish, priceStr)}
          {dish.description ? <Text style={s.dishDesc}>{dish.description}</Text> : null}
          {allergenStr ? <Text style={s.dishAllergens}>{allergenStr}</Text> : null}
        </View>
      )
    }

    return (
      <View key={dish.id} wrap={false}>
        {namePriceBlock(dish, priceStr)}
        {!isMinimal && dish.description ? <Text style={s.dishDesc}>{dish.description}</Text> : null}
        {!isMinimal && allergenStr ? <Text style={s.dishAllergens}>{allergenStr}</Text> : null}
        {showDivider && <View style={s.dishDivider} />}
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

            <Text style={s.catTitle}>{cat.name}</Text>
            <View style={s.catLine} />

            {isGrid ? (
              // 2-column grid: pairs of dishes side by side
              <View style={s.gridRow}>
                {cat.dishes.map((dish) => {
                  const priceStr    = dish.price != null ? formatPrice(dish.price, m.prices.format, m.prices.currency) : null
                  const allergenStr = dish.allergens.length > 0 ? 'Allergeni: ' + formatAllergens(dish.allergens, m.allergens.display, m.allergens.separator) : null
                  return (
                    <View key={dish.id} style={s.gridCell} wrap={false}>
                      <View style={s.dishRow}>
                        <Text style={[s.dishName, { fontSize: compact ? 8 : 9 }]}>{dish.name}</Text>
                        {priceStr && <Text style={[s.dishPrice, { fontSize: compact ? 8 : 9 }]}>{priceStr}</Text>}
                      </View>
                      {dish.description ? <Text style={[s.dishDesc, { fontSize: compact ? 7 : 8 }]}>{dish.description}</Text> : null}
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
