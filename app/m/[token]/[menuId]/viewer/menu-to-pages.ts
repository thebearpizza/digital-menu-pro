export type ViewerSettings = {
  theme?: {
    background?: string
    pageTone?: string
    fontHeading?: string
    fontBody?: string
  }
  layout?: {
    productsPerPage?: number
    showCategoryCover?: boolean
    paginateByCategory?: boolean
    showCategoryName?: boolean
    showDescription?: boolean
    showPrice?: boolean
    showAllergens?: boolean
    showImage?: boolean
  }
  viewer?: {
    fixedFrontal?: boolean
    showBottomTabs?: boolean
  }
}

export type MenuDish = {
  id: string
  name: string
  description: string | null
  price: number | null
  allergens: string[] | null
  category: string | null
  sort_order: number | null
}

export type MenuPayload = {
  id: string
  name: string
  description: string | null
  viewer_settings: ViewerSettings | null
  restaurant: {
    id: string
    name: string
    theme_config?: Record<string, unknown> | null
  } | null
  dishes: MenuDish[]
}

export type ViewerPage = {
  id: string
  label: string
  kind: 'cover' | 'category' | 'items' | 'back'
  title: string
  subtitle?: string
  category?: string
  items?: Array<{
    id: string
    name: string
    description?: string | null
    price?: number | null
    allergens?: string[] | null
  }>
}

function groupByCategory(dishes: MenuDish[]) {
  const map = new Map<string, MenuDish[]>()

  for (const dish of dishes) {
    const key = dish.category?.trim() || 'Menu'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(dish)
  }

  return Array.from(map.entries()).map(([category, items]) => ({
    category,
    items: [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  }))
}

export function buildViewerPages(menu: MenuPayload): ViewerPage[] {
  const settings = menu.viewer_settings ?? {}
  const layout = settings.layout ?? {}
  const productsPerPage = Math.max(1, layout.productsPerPage ?? 6)
  const paginateByCategory = layout.paginateByCategory ?? true
  const showCategoryCover = layout.showCategoryCover ?? true

  const grouped = groupByCategory(menu.dishes)
  const pages: ViewerPage[] = []

  pages.push({
    id: 'cover',
    label: 'Cover',
    kind: 'cover',
    title: menu.name,
    subtitle: menu.restaurant?.name || menu.description || 'Digital Menu',
  })

  if (paginateByCategory) {
    for (const group of grouped) {
      if (showCategoryCover) {
        pages.push({
          id: `category-${group.category}`,
          label: group.category,
          kind: 'category',
          title: group.category,
          subtitle: `${group.items.length} prodotti`,
          category: group.category,
        })
      }

      for (let i = 0; i < group.items.length; i += productsPerPage) {
        const chunk = group.items.slice(i, i + productsPerPage)

        pages.push({
          id: `items-${group.category}-${i / productsPerPage + 1}`,
          label: group.category,
          kind: 'items',
          title: group.category,
          subtitle: `Pagina ${Math.floor(i / productsPerPage) + 1}`,
          category: group.category,
          items: chunk.map((dish) => ({
            id: dish.id,
            name: dish.name,
            description: dish.description,
            price: dish.price,
            allergens: dish.allergens,
          })),
        })
      }
    }
  } else {
    const allItems = grouped.flatMap((group) => group.items)

    for (let i = 0; i < allItems.length; i += productsPerPage) {
      const chunk = allItems.slice(i, i + productsPerPage)

      pages.push({
        id: `items-all-${i / productsPerPage + 1}`,
        label: `Page ${Math.floor(i / productsPerPage) + 1}`,
        kind: 'items',
        title: menu.name,
        subtitle: `Pagina ${Math.floor(i / productsPerPage) + 1}`,
        items: chunk.map((dish) => ({
          id: dish.id,
          name: dish.name,
          description: dish.description,
          price: dish.price,
          allergens: dish.allergens,
        })),
      })
    }
  }

  pages.push({
    id: 'back',
    label: 'Back',
    kind: 'back',
    title: menu.restaurant?.name || 'Back Cover',
    subtitle: 'Grazie',
  })

  return pages
}
