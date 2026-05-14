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
      {
        id: 'dolci',
        label: 'Dolci',
        emoji: '🍮',
        page: 4,
        dishes: [
          { id: 'd1', name: 'Tiramisu della Casa', description: 'Ricetta tradizionale con savoiardi, mascarpone e caffe espresso', price: 7, allergens: ['glutine', 'uova', 'lattosio'], page: 4 },
          { id: 'd2', name: 'Panna Cotta ai Frutti di Bosco', description: 'Panna cotta vaniglia con coulis di frutti di bosco freschi', price: 6, allergens: ['lattosio'], tags: ['senza glutine'], page: 4 },
        ],
      },
    ],
  },
  {
    id: 'cena',
    label: 'Cena',
    emoji: '🌙',
    categories: [
      {
        id: 'antipasti-c',
        label: 'Antipasti',
        emoji: '🫒',
        page: 1,
        dishes: [
          { id: 'ca1', name: 'Burrata Pugliese', description: 'Burrata fresca con pomodorini datterini e pesto di basilico', price: 11, allergens: ['lattosio'], tags: ['vegetariano', 'senza glutine'], page: 1 },
          { id: 'ca2', name: 'Gamberi in Guazzetto', description: 'Gamberi rossi di Mazara con pomodorino e bottarga di muggine', price: 18, allergens: ['pesce'], tags: ['chef'], page: 1 },
        ],
      },
      {
        id: 'primi-c',
        label: 'Primi',
        emoji: '🍝',
        page: 2,
        dishes: [
          { id: 'cp1', name: 'Pasta alla Carbonara', description: 'Rigatoni con guanciale croccante, uovo, pecorino e pepe', price: 15, allergens: ['glutine', 'uova', 'lattosio'], page: 2 },
          { id: 'cp2', name: 'Zuppa di Pesce', description: 'Brodetto con crostoni di pane casereccio', price: 22, allergens: ['pesce', 'glutine'], tags: ['chef'], page: 2 },
        ],
      },
      {
        id: 'secondi-c',
        label: 'Secondi',
        emoji: '🥩',
        page: 3,
        dishes: [
          { id: 'cs1', name: 'Costata alla Fiorentina', description: 'Chianina certificata 400g con sale Maldon e olio EVO', price: 38, allergens: [], tags: ['chef', 'senza glutine'], page: 3 },
          { id: 'cs2', name: 'Orata alla Griglia', description: 'Orata del Mediterraneo con verdure di stagione grigliate', price: 24, allergens: ['pesce'], tags: ['senza glutine'], page: 3 },
        ],
      },
    ],
  },
  {
    id: 'speciale',
    label: 'Degustazione',
    emoji: '⭐',
    categories: [
      {
        id: 'deg',
        label: 'Degustazione',
        emoji: '⭐',
        page: 1,
        dishes: [
          { id: 'dg1', name: 'Amuse-bouche dello Chef', description: 'Tre piccoli assaggi della tradizione reinterpretata', price: 0, allergens: [], tags: ['chef'], page: 1 },
          { id: 'dg2', name: '5 Portate dello Chef', description: 'Percorso degustazione con abbinamento vini su richiesta', price: 65, allergens: ['glutine', 'lattosio', 'pesce', 'uova'], tags: ['chef'], page: 2 },
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

export const viewerPagesAtom = atom((get) => {
  const selectedMenu = get(selectedMenuAtom)
  const menu = menus.find((m) => m.id === selectedMenu) ?? menus[0]
  return buildViewerPages(toMenuPayload(menu))
})
