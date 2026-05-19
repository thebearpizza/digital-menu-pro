import { atom } from 'jotai'
import { buildViewerPages, type MenuPayload } from './menu-to-pages'

export const pageAtom = atom(0)

export type Allergen =
  | 'glutine'
  | 'lattosio'
  | 'noci'
  | 'uova'
  | 'pesce'
  | 'soia'
  | 'sedano'
  | 'senape'

export type Dish = {
  id: string
  name: string
  description: string
  price: number
  image?: string
  allergens: Allergen[]
  page: number
  tags?: ('vegano' | 'vegetariano' | 'piccante' | 'senza glutine' | 'chef')[]
}

export type Category = {
  id: string
  label: string
  emoji: string
  page: number
  dishes: Dish[]
}

export type Menu = {
  id: string
  label: string
  emoji: string
  categories: Category[]
}

export const menus: Menu[] = [
  {
    id: 'pranzo',
    label: 'Pranzo',
    emoji: '☀️',
    categories: [
      {
        id: 'antipasti',
        label: 'Antipasti',
        emoji: '🫒',
        page: 1,
        dishes: [
          { id: 'a1', name: 'Bruschetta al Pomodoro', description: 'Pane casereccio tostato con pomodori freschi, basilico e olio EVO', price: 7, allergens: ['glutine'], tags: ['vegetariano'], page: 1 },
          { id: 'a2', name: 'Carpaccio di Polpo', description: 'Polpo verace con rucola, limone e scaglie di parmigiano', price: 12, allergens: ['pesce'], tags: ['chef'], page: 1 },
          { id: 'a3', name: 'Tagliere Misto', description: 'Selezione di salumi e formaggi locali con miele di castagno', price: 16, allergens: ['lattosio', 'glutine'], page: 1 },
        ],
      },
      {
        id: 'primi',
        label: 'Primi',
        emoji: '🍝',
        page: 2,
        dishes: [
          { id: 'p1', name: 'Cacio e Pepe', description: 'Tonnarelli al cacio di pecora romano e pepe nero in grani', price: 14, allergens: ['glutine', 'lattosio'], tags: ['vegetariano'], page: 2 },
          { id: 'p2', name: 'Amatriciana', description: 'Bucatini con guanciale, pomodoro San Marzano e pecorino', price: 14, allergens: ['glutine', 'lattosio'], page: 2 },
          { id: 'p3', name: 'Risotto ai Funghi Porcini', description: 'Riso Carnaroli con porcini freschi, burro di montagna e parmigiano', price: 16, allergens: ['lattosio'], tags: ['vegetariano', 'chef'], page: 2 },
        ],
      },
      {
        id: 'secondi',
        label: 'Secondi',
        emoji: '🥩',
        page: 3,
        dishes: [
          { id: 's1', name: 'Tagliata di Manzo', description: 'Controfiletto alla brace con rucola e grana a scaglie', price: 24, allergens: ['lattosio'], tags: ['senza glutine'], page: 3 },
          { id: 's2', name: 'Branzino al Forno', description: 'Branzino intero con patate al rosmarino e olive taggiasche', price: 22, allergens: ['pesce'], tags: ['senza glutine', 'chef'], page: 3 },
        ],
      },
    ],
  },
]

function toMenuPayload(menu: Menu): MenuPayload {
  return {
    id: menu.id,
    name: menu.label,
    description: `${menu.label} digitale`,
    viewer_settings: {
      layout: {
        productsPerPage: 6,
        showCategoryCover: true,
        paginateByCategory: true,
        showCategoryName: true,
        showDescription: true,
        showPrice: true,
        showAllergens: true,
        showImage: false,
      },
      viewer: {
        fixedFrontal: false,
        showBottomTabs: false,
      },
    },
    restaurant: {
      id: 'resto-demo',
      name: 'The Bear Pizza',
      theme_config: null,
    },
    dishes: menu.categories.flatMap((category, categoryIndex) =>
      category.dishes.map((dish, dishIndex) => ({
        id: dish.id,
        name: dish.name,
        description: dish.description,
        price: dish.price,
        allergens: dish.allergens,
        category: category.label,
        sort_order: dish.page * 100 + categoryIndex * 10 + dishIndex,
      }))
    ),
  }
}

export const selectedMenuAtom = atom<string>('pranzo')
export const selectedCategoryAtom = atom<string>('antipasti')
export const selectedDishAtom = atom<Dish | null>(null)

export const externalMenuPayloadAtom = atom<MenuPayload | null>(null)

export const viewerPagesAtom = atom((get) => {
  const externalPayload = get(externalMenuPayloadAtom)
  if (externalPayload) {
    return buildViewerPages(externalPayload)
  }

  const selectedMenu = get(selectedMenuAtom)
  const menu = menus.find((m) => m.id === selectedMenu) ?? menus[0]
  return buildViewerPages(toMenuPayload(menu))
})
