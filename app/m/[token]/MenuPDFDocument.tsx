// ─────────────────────────────────────────────────────────────────────────────
// MenuPDFDocument — @react-pdf/renderer document for a single restaurant menu.
// Dynamically imported by useMenuPDF (never SSR-ed).
// ─────────────────────────────────────────────────────────────────────────────
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { formatAllergensShort } from '@/lib/allergens'
import type { RestaurantTheme } from '@/lib/theme'
import { DEFAULT_THEME, lightenHex, formatPrice, fontStack } from '@/lib/theme'

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

// ── Dynamic styles ────────────────────────────────────────────────────────────

function makeStyles(theme: RestaurantTheme) {
  const m         = theme.menu
  const compact   = m.pdfLayout === 'compact'
  const catLineColor = lightenHex(m.accent, 0.55)
  const isDashed  = m.layout.divider.type === 'dashed' || m.layout.divider.type === 'dotted'
  const noDivider = m.layout.divider.type === 'none'
  const divColor  = m.layout.divider.color

  const titleScale = m.dishes.titleSize   / DEFAULT_THEME.menu.dishes.titleSize
  const baseScale  = m.descriptions.size  / DEFAULT_THEME.menu.descriptions.size
  const priceScale = m.prices.size        / DEFAULT_THEME.menu.prices.size

  return StyleSheet.create({
    page: {
      backgroundColor:   m.pageBackground,
      paddingTop:        compact ? 36 : 52,
      paddingBottom:     compact ? 24 : 40,
      paddingHorizontal: compact ? 42 : 54,
    },
    catTitle: {
      fontFamily:    'Times-Bold',
      fontSize:      (compact ? 13 : 18) * titleScale,
      color:         m.categories.color,
      textTransform: 'uppercase',
      letterSpacing: compact ? 1.5 : 2,
      marginBottom:  compact ? 5 : 8,
    },
    catLine: {
      height:          0.5,
      backgroundColor: catLineColor,
      marginBottom:    compact ? 12 : 18,
    },
    // ── List layout ─────────────────────────────────────────────────────────
    dishRow: {
      flexDirection:  'row',
      justifyContent: 'space-between',
      alignItems:     'flex-start',
      marginBottom:   compact ? 2 : 3,
    },
    dishName: {
      fontFamily:    'Helvetica-Bold',
      fontSize:      (compact ? 9 : 10) * titleScale,
      color:         m.dishes.titleColor === '#ede8e0' ? '#1a1a1a' : m.dishes.titleColor,
      textTransform: 'uppercase',
      letterSpacing: compact ? 0.4 : 0.6,
      flex:          1,
      marginRight:   14,
    },
    dishPrice: {
      fontFamily: 'Helvetica-Bold',
      fontSize:   (compact ? 9 : 10) * priceScale,
      color:      '#1a1a1a',
    },
    dishDesc: {
      fontFamily:   'Helvetica-Oblique',
      fontSize:     (compact ? 7.5 : 8.5) * baseScale,
      color:        '#4a4a4a',  // descriptions always dark in print
      lineHeight:   1.55,
      marginBottom: compact ? 2 : 3,
    },
    dishAllergens: {
      fontFamily:    'Helvetica',
      fontSize:      compact ? 6.5 : 7,
      color:         '#9a9a9a',
      letterSpacing: 0.2,
    },
    dishDivider: noDivider ? { height: compact ? 8 + m.layout.dishSpacing : 12 + m.layout.dishSpacing } : {
      height:          0.3,
      backgroundColor: divColor,
      borderStyle:     isDashed ? 'dashed' : 'solid',
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
  restaurant: PDFRestaurant
  menu:       PDFMenu
  theme?:     RestaurantTheme
}

export function MenuPDFDocument({ restaurant, menu, theme: themeProp }: Props) {
  const theme      = themeProp ?? DEFAULT_THEME
  const m          = theme.menu
  const s          = makeStyles(theme)
  const categories = groupByCategory(menu.dishes)
  const compact    = m.pdfLayout === 'compact'
  const isGrid     = m.layout.dishLayout === 'grid-2'
  const isBoxed    = m.layout.dishLayout === 'boxed-card'
  const isMinimal  = m.layout.dishLayout === 'minimal-row'

  function renderDish(dish: PDFDish, isLast: boolean) {
    const priceStr    = dish.price != null ? formatPrice(dish.price, m.prices.format) : null
    const allergenStr = dish.allergens.length > 0 ? 'Allergeni: ' + formatAllergensShort(dish.allergens) : null
    const showDivider = !isLast && m.layout.divider.type !== 'none'

    if (isBoxed) {
      return (
        <View key={dish.id} style={s.boxedItem} wrap={false}>
          <View style={s.dishRow}>
            <Text style={s.dishName}>{dish.name}</Text>
            {priceStr && <Text style={s.dishPrice}>{priceStr}</Text>}
          </View>
          {dish.description ? <Text style={s.dishDesc}>{dish.description}</Text> : null}
          {allergenStr ? <Text style={s.dishAllergens}>{allergenStr}</Text> : null}
        </View>
      )
    }

    return (
      <View key={dish.id} wrap={false}>
        <View style={s.dishRow}>
          <Text style={s.dishName}>{dish.name}</Text>
          {priceStr && <Text style={s.dishPrice}>{priceStr}</Text>}
        </View>
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
                  const priceStr    = dish.price != null ? formatPrice(dish.price, m.prices.format) : null
                  const allergenStr = dish.allergens.length > 0 ? 'Allergeni: ' + formatAllergensShort(dish.allergens) : null
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
