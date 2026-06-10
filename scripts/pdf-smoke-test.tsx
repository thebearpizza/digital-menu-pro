// Smoke test: renders MenuPDFDocument with extreme theme combinations.
// Run with: npx tsx --tsconfig scripts/tsconfig.json scripts/pdf-smoke-test.tsx
import React from 'react'
import { pdf } from '@react-pdf/renderer'
import { MenuPDFDocument, MOCK_MENU, MOCK_RESTAURANT } from '../app/m/[token]/MenuPDFDocument'
import { DEFAULT_THEME } from '../lib/theme'
import type { RestaurantTheme, DividerType, DishLayout } from '../lib/theme'

function themeWith(patch: (t: RestaurantTheme) => void): RestaurantTheme {
  const t = structuredClone(DEFAULT_THEME)
  patch(t)
  return t
}

const LONG_DESC = 'Descrizione estremamente lunga '.repeat(20)

const longMenu = {
  ...MOCK_MENU,
  dishes: [
    ...MOCK_MENU.dishes,
    ...Array.from({ length: 30 }, (_, i) => ({
      id: `x${i}`, name: `Piatto Extra ${i}`, description: i % 3 === 0 ? LONG_DESC : null,
      price: i % 5 === 0 ? null : 10 + i, category: `Categoria ${i % 4}`, allergens: i % 2 ? [1, 7] : [],
    })),
  ],
}

const cases: Array<[string, RestaurantTheme]> = [
  ['divider ornament',        themeWith(t => { t.menu.layout.divider.type = 'ornament' as DividerType })],
  ['divider wavy',            themeWith(t => { t.menu.layout.divider.type = 'wavy' as DividerType })],
  ['divider gradient',        themeWith(t => { t.menu.layout.divider.type = 'gradient' as DividerType })],
  ['divider double + spacing',themeWith(t => { t.menu.layout.divider.type = 'double'; t.menu.layout.dishSpacing = 40 })],
  ['flourish diamond',        themeWith(t => { t.menu.categories.flourish = 'diamond' })],
  ['flourish dots',           themeWith(t => { t.menu.categories.flourish = 'dots' })],
  ['alternating compact',     themeWith(t => { t.menu.pdfLayout = 'compact'; t.menu.compactMode = 'alternating'; t.menu.dishes.align = 'left' as const })],
  ['perPage=2 classic',       themeWith(t => { t.menu.layout.dishesPerPage = 2 })],
  ['perPage=3 compact',       themeWith(t => { t.menu.pdfLayout = 'compact'; t.menu.layout.dishesPerPage = 3 })],
  ['grid-2 perPage=4',        themeWith(t => { t.menu.layout.dishLayout = 'grid-2' as DishLayout; t.menu.layout.dishesPerPage = 4 })],
  ['grid-3',                  themeWith(t => { t.menu.layout.dishLayout = 'grid-3' as DishLayout })],
  ['boxed + ornament',        themeWith(t => { t.menu.layout.dishLayout = 'boxed-card' as DishLayout; t.menu.layout.divider.type = 'ornament' })],
  ['elegant + price above',   themeWith(t => { t.menu.layout.dishLayout = 'elegant' as DishLayout; t.menu.prices.position = 'above' })],
  ['minimal + wavy + right',  themeWith(t => { t.menu.layout.dishLayout = 'minimal-row' as DishLayout; t.menu.layout.divider.type = 'wavy'; t.menu.layout.dishAlignment = 'right' })],
  ['list + price above',      themeWith(t => { t.menu.prices.position = 'above' })],
  ['list + price below',      themeWith(t => { t.menu.prices.position = 'below' })],
  ['compact perPage=2 no-orphan', themeWith(t => { t.menu.pdfLayout = 'compact'; t.menu.layout.dishesPerPage = 2 })],
  ['page bg radial gradient',  themeWith(t => { t.menu.pageBackground = { color: '#fdf6ec', color2: '#e8c97a', effect: 'radial-gradient', effectOpacity: 80, effectStrength: 100, image: '', imageOpacity: 100 } })],
  ['page bg linear gradient',  themeWith(t => { t.menu.pageBackground = { color: '#101418', color2: '#3a4a5a', effect: 'linear-gradient', effectOpacity: 60, effectStrength: 80, image: '', imageOpacity: 100 } })],
]

async function main() {
  let failed = 0
  for (const [name, theme] of cases) {
    try {
      const blob = await pdf(
        React.createElement(MenuPDFDocument, { restaurant: MOCK_RESTAURANT, menu: longMenu, theme, registeredFonts: new Set<string>() }) as any
      ).toBlob()
      console.log(`✓ ${name} — ${(blob.size / 1024).toFixed(1)} KB`)
    } catch (e) {
      failed++
      console.error(`✗ ${name} — ${(e as Error).message}`)
    }
  }
  if (failed) { console.error(`\n${failed} case(s) FAILED`); process.exit(1) }
  console.log('\nAll cases passed.')
}

main()
