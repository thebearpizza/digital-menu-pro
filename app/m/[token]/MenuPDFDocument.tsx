// ─────────────────────────────────────────────────────────────────────────────
// MenuPDFDocument — @react-pdf/renderer document for a single restaurant menu.
//
// Dynamically imported by useMenuPDF (never SSR-ed).
// Layout: content pages only (no cover), one section per category with forced
// page-break between categories, wrap={false} per dish to avoid mid-dish splits.
// ─────────────────────────────────────────────────────────────────────────────
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { formatAllergensShort } from '@/lib/allergens'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PDFDish {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string
  allergens: number[]   // IDs from lib/allergens.ts
}

export interface PDFMenu {
  id: string
  name: string
  dishes: PDFDish[]
}

export interface PDFRestaurant {
  name: string
}

// ── Mock data (for testing without Supabase) ──────────────────────────────────

export const MOCK_RESTAURANT: PDFRestaurant = { name: 'Ristorante Da Marco' }

export const MOCK_MENU: PDFMenu = {
  id: 'mock-1',
  name: 'Menu Estivo 2025',
  dishes: [
    { id: 'd1', name: 'Bruschetta al Pomodoro', description: 'Pane tostato, pomodoro fresco, basilico, olio extravergine d\'oliva', price: 6.50, category: 'Antipasti', allergens: [1] },
    { id: 'd2', name: 'Carpaccio di Manzo', description: 'Fettine di manzo crudo, rucola, scaglie di parmigiano, limone e olio EVO', price: 12.00, category: 'Antipasti', allergens: [7] },
    { id: 'd3', name: 'Tagliatelle al Ragù', description: 'Pasta fresca all\'uovo con ragù di carne tradizionale bolognese', price: 14.00, category: 'Primi', allergens: [1, 3] },
    { id: 'd4', name: 'Risotto ai Funghi Porcini', description: 'Riso Carnaroli, porcini freschi di stagione, parmigiano reggiano 24 mesi', price: 15.50, category: 'Primi', allergens: [7] },
    { id: 'd5', name: 'Gnocchi alla Sorrentina', description: 'Gnocchi di patate fatti in casa, pomodoro San Marzano, mozzarella di bufala', price: 13.00, category: 'Primi', allergens: [1, 3, 7] },
    { id: 'd6', name: 'Filetto di Branzino', description: 'Branzino mediterraneo con patate al forno, olive taggiasche e capperi di Pantelleria', price: 22.00, category: 'Secondi', allergens: [4] },
    { id: 'd7', name: 'Tagliata di Manzo', description: 'Controfiletto di Chianina grigliato, rucola, ciliegini, grana padano a scaglie', price: 26.00, category: 'Secondi', allergens: [7] },
    { id: 'd8', name: 'Pollo alla Cacciatora', description: 'Coscetta di pollo ruspante con olive, pomodori pelati, rosmarino fresco e vino bianco', price: 18.00, category: 'Secondi', allergens: [] },
    { id: 'd9', name: 'Tiramisù della Casa', description: 'Ricetta originale con savoiardi, mascarpone, caffè espresso e cacao amaro', price: 7.00, category: 'Dessert', allergens: [1, 3, 7] },
    { id: 'd10', name: 'Panna Cotta ai Frutti di Bosco', description: 'Crema di panna fresca con coulis di lamponi, mirtilli e ribes', price: 6.50, category: 'Dessert', allergens: [7] },
  ],
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns ordered list of category sections from flat dish array. */
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

// ── Styles ─────────────────────────────────────────────────────────────────────

const ACCENT    = '#c9a96e'   // gold — matches flipbook theme
const DARK_TXT  = '#1a1a1a'
const MED_TXT   = '#4a4a4a'
const LIGHT_TXT = '#9a9a9a'

const s = StyleSheet.create({
  // ── Content page ───────────────────────────────────────────────────────────
  page: {
    backgroundColor:  '#ffffff',
    paddingTop:       52,
    paddingBottom:    40,
    paddingHorizontal: 54,
  },

  // Category header
  catTitle: {
    fontFamily:    'Times-Bold',
    fontSize:      18,
    color:         DARK_TXT,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom:  8,
  },
  catLine: {
    height:          0.5,
    backgroundColor: '#d4c5a2',
    marginBottom:    18,
  },

  // Dish block
  dishRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'flex-start',
    marginBottom:    3,
  },
  dishName: {
    fontFamily:    'Helvetica-Bold',
    fontSize:      10,
    color:         DARK_TXT,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flex:          1,
    marginRight:   14,
  },
  dishPrice: {
    fontFamily: 'Helvetica-Bold',
    fontSize:   10,
    color:      DARK_TXT,
  },
  dishDesc: {
    fontFamily:  'Helvetica-Oblique',
    fontSize:    8.5,
    color:       MED_TXT,
    lineHeight:  1.55,
    marginBottom: 3,
  },
  dishAllergens: {
    fontFamily:    'Helvetica',
    fontSize:      7,
    color:         LIGHT_TXT,
    letterSpacing: 0.2,
  },
  dishDivider: {
    height:          0.3,
    backgroundColor: '#ece6da',
    marginVertical:  12,
  },

})

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  restaurant: PDFRestaurant
  menu:       PDFMenu
}

export function MenuPDFDocument({ restaurant, menu }: Props) {
  const categories = groupByCategory(menu.dishes)

  return (
    <Document
      title={`${restaurant.name} — ${menu.name}`}
      author={restaurant.name}
      creator="Digital Menu Pro"
    >
      {/* ── CONTENT PAGES — no cover, first category starts on page 1 ──── */}
      <Page size="A4" style={s.page} wrap>

        {categories.map((cat, catIdx) => (
          // break={catIdx > 0}: each category (except the first) starts on a new page.
          // This makes category page numbers stable and detectable via PDF.js text scan.
          <View key={cat.name} break={catIdx > 0}>

            <Text style={s.catTitle}>{cat.name}</Text>
            <View style={s.catLine} />

            {cat.dishes.map((dish, dishIdx) => {
              const allergenStr = dish.allergens.length > 0
                ? 'Allergeni: ' + formatAllergensShort(dish.allergens)
                : null

              return (
                // wrap={false}: never split a single dish item across pages
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
