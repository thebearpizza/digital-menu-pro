import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DishList from './DishList'

export default async function MenuDishesPage({
  params,
}: {
  params: { restaurantId: string; menuId: string }
}) {
  const supabase = await createClient()

  const [{ data: menu }, { data: dishes }, { data: allDishes }] = await Promise.all([
    supabase
      .from('menus').select('id, name, restaurant_id, category_order')
      .eq('id', params.menuId).eq('restaurant_id', params.restaurantId).single(),
    supabase
      .from('dishes')
      .select('id, name, description, price, category, image_url, allergens, sort_order, is_active, pairing_dish_id, pairing_label, master_dish_id')
      .eq('menu_id', params.menuId)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true }),
    // All dishes of this restaurant for pairing selector
    supabase
      .from('dishes')
      .select('id, name, category')
      .eq('restaurant_id', params.restaurantId)
      .eq('is_active', true)
      .order('category').order('sort_order'),
  ])

  if (!menu) notFound()

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Link href={`/admin/restaurants/${params.restaurantId}/menus`}
              className="hover:text-gray-600">← Menu</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">{menu.name}</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">{menu.name}</h1>
        </div>
      </div>

      <DishList
        restaurantId={params.restaurantId}
        menuId={params.menuId}
        initialDishes={(dishes ?? []) as any[]}
        allDishes={(allDishes ?? []) as any[]}
        initialCategoryOrder={(menu.category_order as string[] | null) ?? null}
      />
    </div>
  )
}
