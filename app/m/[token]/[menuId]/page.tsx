import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Menu',
  robots: { index: false, follow: false },
}

const MenuBookClient = dynamic(() => import('./viewer/MenuBookClient'), { ssr: false })

export default async function MenuViewerPage({
  params,
}: {
  params: { token: string; menuId: string }
}) {
  try {
    const supabase = await createClient()

    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id,name,qr_public_token')
      .eq('qr_public_token', params.token)
      .single()

    if (restaurantError || !restaurant) {
      console.error('[Menu Viewer] Restaurant not found:', restaurantError)
      notFound()
    }

    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('id,name,description,restaurant_id')
      .eq('id', params.menuId)
      .eq('restaurant_id', restaurant.id)
      .single()

    if (menuError || !menu) {
      console.error('[Menu Viewer] Menu not found:', menuError)
      notFound()
    }

    const { data: dishes, error: dishesError } = await supabase
      .from('dishes')
      .select('id,name,description,price,allergens,category,sort_order')
      .eq('menu_id', menu.id)
      .order('sort_order', { ascending: true })

    if (dishesError) {
      console.error('[Menu Viewer] Dishes error:', dishesError)
    }

    return (
      <MenuBookClient
        token={params.token}
        menuId={params.menuId}
        menuData={{
          id: menu.id,
          name: menu.name,
          description: menu.description,
          dishes: dishes ?? [],
        }}
      />
    )
  } catch (error) {
    console.error('[Menu Viewer] Unexpected error:', error)
    notFound()
  }
}
