import dynamic from 'next/dynamic'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildViewerPages, type MenuPayload } from './viewer/menu-to-pages'

const MenuBookClient = dynamic(() => import('./viewer/MenuBookClient'), {
  ssr: false,
})

type PageProps = {
  params: Promise<{
    token: string
    menuId: string
  }>
}

export default async function MenuViewerPage({ params }: PageProps) {
  const { menuId } = await params
  const supabase = await createClient()

  const { data: menu, error: menuError } = await supabase
    .from('menus')
    .select(`
      id,
      name,
      description,
      viewer_settings,
      restaurant:restaurants (
        id,
        name,
        theme_config
      )
    `)
    .eq('id', menuId)
    .eq('is_public', true)
    .eq('is_active', true)
    .maybeSingle()

  if (menuError || !menu) {
    notFound()
  }

  const { data: dishes, error: dishesError } = await supabase
    .from('dishes')
    .select(`
      id,
      name,
      description,
      price,
      allergens,
      category,
      sort_order
    `)
    .eq('menu_id', menuId)
    .eq('is_active', true)
    .eq('is_available', true)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })

  if (dishesError) {
    notFound()
  }

  const restaurantRaw = (menu as any).restaurant
  const restaurant = Array.isArray(restaurantRaw)
    ? (restaurantRaw[0] ?? null)
    : (restaurantRaw ?? null)

  const payload: MenuPayload = {
    id: menu.id,
    name: menu.name,
    description: menu.description,
    viewer_settings: menu.viewer_settings,
    restaurant: restaurant
      ? {
          id: restaurant.id,
          name: restaurant.name,
          theme_config: restaurant.theme_config ?? null,
        }
      : null,
    dishes: (dishes ?? []).map((dish) => ({
      id: dish.id,
      name: dish.name,
      description: dish.description,
      price: dish.price,
      allergens: dish.allergens,
      category: dish.category,
      sort_order: dish.sort_order,
    })),
  }

  const pages = buildViewerPages(payload)

  return <MenuBookClient pages={pages} />
}
