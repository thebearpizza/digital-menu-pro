// ─────────────────────────────────────────────────────────────────────────────
// MenuPDFDocument — @react-pdf/renderer document for a single restaurant menu.
//
// Dynamically imported by useMenuPDF (never SSR-ed).
// Layout: content pages only (no cover), one section per category with forced
// page-break between categories (classic) or flowing layout (compact).
// ─────────────────────────────────────────────────────────────────────────────
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { formatAllergensShort } from '@/lib/allergens'
import type { RestaurantTheme } from '@/lib/theme'
import { DEFAULT_THEME, lightenHex } from '@/lib/theme'

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

// ── Mock data ─────────────────────────────────────────────────────────────────

export const MOCK_RESTAURANT: PDFRestaurant = { name: 'Ristorante Da Marco' }

export const MOCK_MENU: PDFMenu = {
  id: 'mock-1',
  name: 'Menu Estivo 2025',
  dishes: [
    { id: 'd1', name: 'Bruschetta al Pomodoro', description: 'Pane tostato, pomodoro fresco, basilico, olio extravergine d\'oliva', price: 6.50, category: 'Antipasti', allergens: [1] },
    { id: 'd2', name: 'Carpaccio di Manzo', description: 'Fettine di manzo crudo, rucola, scaglie di parmigiano, limone e olio EVO', price: 12.00, category: 'Antipasti', allergens: [7] },
    { id: 'd3', name: 'Tagliatelle al Ragù', description: 'Pasta fresca all\'uovo con ragù di carne tradizionale bolognese', price: 14.00, category: 'Primi', allergens: [1, 3] },
    { id: 'd4', name: 'Risotto ai Funghi Porcini', description: 'Riso Carnaroli, porcini freschi di stagione, parmigiano reggiano 24 mesi', price: 15.50, category: 'Primi', allergens: [7] },
    { id: 'd5', name: 'Filetto di Branzino', description: 'Branzino mediterraneo con patate al forno, olive taggiasche e capperi di Pantelleria', price: 22.00, category: 'Secondi', allergens: [4] },
    { id: 'd6', name: 'Tagliata di Manzo', description: 'Controfiletto di Chianina grigliato, rucola, ciliegini, grana padano a scaglie', price: 26.00, category: 'Secondi', allergens: [7] },
    { id: 'd7', name: 'Tiramisù della Casa', description: 'Ricetta originale con savoiardi, mascarpone, caffè espresso e cacao amaro', price: 7.00, category: 'Dessert', allergens: [1, 3, 7] },
    { id: 'd8', name: 'Panna Cotta ai Frutti di Bosco', description: 'Crema di panna fresca con coulis di lamponi, mirtilli e ribes', price: 6.50, category: 'Dessert', allergens: [7] },
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

function fmtPrice(p: number | null): string {
  if (p == null) return ''
  return `€ ${p.toFixed(2)}`
}

// ── Dynamic styles (theme-aware) ──────────────────────────────────────────────

function makeStyles(theme: RestaurantTheme) {
  const compact   = theme.pdfLayout === 'compact'
  const catLineColor = lightenHex(theme.accent, 0.55)  // soft tint of accent for separator

  return StyleSheet.create({
    page: {
      backgroundColor:   '#ffffff',
      paddingTop:        compact ? 36 : 52,
      paddingBottom:     compact ? 24 : 40,
      paddingHorizontal: compact ? 42 : 54,
    },
    catTitle: {
      fontFamily:    'Times-Bold',
      fontSize:      compact ? 13 : 18,
      color:         '#1a1a1a',
      textTransform: 'uppercase',
      letterSpacing: compact ? 1.5 : 2,
      marginBottom:  compact ? 5 : 8,
    },
    catLine: {
      height:          0.5,
      backgroundColor: catLineColor,
      marginBottom:    compact ? 12 : 18,
    },
    dishRow: {
      flexDirection:  'row',
      justifyContent: 'space-between',
      alignItems:     'flex-start',
      marginBottom:   compact ? 2 : 3,
    },
    dishName: {
      fontFamily:    'Helvetica-Bold',
      fontSize:      compact ? 9 : 10,
      color:         '#1a1a1a',
      textTransform: 'uppercase',
      letterSpacing: compact ? 0.4 : 0.6,
      flex:          1,
      marginRight:   14,
    },
    dishPrice: {
      fontFamily: 'Helvetica-Bold',
      fontSize:   compact ? 9 : 10,
      color:      '#1a1a1a',
    },
    dishDesc: {
      fontFamily:   'Helvetica-Oblique',
      fontSize:     compact ? 7.5 : 8.5,
      color:        '#4a4a4a',
      lineHeight:   1.55,
      marginBottom: compact ? 2 : 3,
    },
    dishAllergens: {
      fontFamily:    'Helvetica',
      fontSize:      compact ? 6.5 : 7,
      color:         '#9a9a9a',
      letterSpacing: 0.2,
    },
    dishDivider: {
      height:          0.3,
      backgroundColor: '#ece6da',
      marginVertical:  compact ? 8 : 12,
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
  const s          = makeStyles(theme)
  const categories = groupByCategory(menu.dishes)
  const compact    = theme.pdfLayout === 'compact'

  return (
    <Document
      title={`${restaurant.name} — ${menu.name}`}
      author={restaurant.name}
      creator="Digital Menu Pro"
    >
      <Page size="A4" style={s.page} wrap>
        {categories.map((cat, catIdx) => (
          // Classic: forced page break per category.
          // Compact: categories flow naturally; spacer separates sections.
          <View key={cat.name} break={!compact && catIdx > 0}>

            {compact && catIdx > 0 && <View style={s.catSpacer} />}

            <Text style={s.catTitle}>{cat.name}</Text>
            <View style={s.catLine} />

            {cat.dishes.map((dish, dishIdx) => {
              const allergenStr = dish.allergens.length > 0
                ? 'Allergeni: ' + formatAllergensShort(dish.allergens)
                : null

              return (
                <View key={dish.id} wrap={false}>
                  <View style={s.dishRow}>
                    <Text style={s.dishName}>{dish.name}</Text>
                    {dish.price != null && (
                      <Text style={s.dishPrice}>{fmtPrice(dish.price)}</Text>
                    )}
                  </View>
                  {dish.description ? (
                    <Text style={s.dishDesc}>{dish.description}</Text>
                  ) : null}
                  {allergenStr ? (
                    <Text style={s.dishAllergens}>{allergenStr}</Text>
                  ) : null}
                  {dishIdx < cat.dishes.length - 1 && (
                    <View style={s.dishDivider} />
                  )}
                </View>
              )
            })}
          </View>
        ))}
      </Page>
    </Document>
  )
}
