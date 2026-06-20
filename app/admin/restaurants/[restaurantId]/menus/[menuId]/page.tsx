import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DishList from './DishList'
import TextPagesPanel from './TextPagesPanel'
import DownloadPDFButton from './DownloadPDFButton'
import { defaultExtraPages } from '../menuExtraPages'
import { parseTheme } from '@/lib/theme'
import type { MenuExtraPages } from '../menuExtraPages'

export default async function MenuDishesPage({
  params,
}: {
  params: { restaurantId: string; menuId: string }
}) {
  const supabase = await createClient()

  const [{ data: menu }, { data: dishes }, { data: allDishes }, { data: allMenus }, { data: restaurant }] = await Promise.all([
    supabase
      .from('menus').select('id, name, restaurant_id, category_order, text_content')
      .eq('id', params.menuId).eq('restaurant_id', params.restaurantId).single(),
    supabase
      .from('dishes')
      .select('id, name, description, price, category, image_url, allergens, sort_order, is_active, pairing_dish_id, pairing_label, master_dish_id')
      .eq('menu_id', params.menuId)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('dishes')
      .select('id, name, category')
      .eq('restaurant_id', params.restaurantId)
      .eq('is_active', true)
      .order('category').order('sort_order'),
    supabase
      .from('menus')
      .select('id, name')
      .eq('restaurant_id', params.restaurantId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('restaurants')
      .select('name, theme_config')
      .eq('id', params.restaurantId)
      .single(),
  ])

  if (!menu) notFound()

  const rawPages = (menu as any).text_content
  const extraPages: MenuExtraPages = (rawPages?.info || rawPages?.allergen)
    ? rawPages as MenuExtraPages
    : defaultExtraPages()

  const theme = parseTheme((restaurant as any)?.theme_config ?? null)

  // Only active dishes are included in the PDF (mirrors the public menu).
  const pdfDishes = (dishes ?? [])
    .filter((d: any) => d.is_active)
    .map((d: any) => ({
      id:          d.id as string,
      name:        d.name as string,
      description: (d.description ?? null) as string | null,
      price:       (d.price ?? null) as number | null,
      category:    d.category as string,
      allergens:   (d.allergens ?? []) as number[],
    }))

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

        <DownloadPDFButton
          restaurantName={(restaurant as any)?.name ?? ''}
          menuId={menu.id}
          menuName={menu.name}
          dishes={pdfDishes}
          extraPages={extraPages}
          theme={theme}
        />
      </div>

      <DishList
        restaurantId={params.restaurantId}
        menuId={params.menuId}
        initialDishes={(dishes ?? []) as any[]}
        allDishes={(allDishes ?? []) as any[]}
        allMenus={(allMenus ?? []) as any[]}
        initialCategoryOrder={(menu.category_order as string[] | null) ?? null}
      />

      <TextPagesPanel
        restaurantId={params.restaurantId}
        menuId={params.menuId}
        initialPages={extraPages}
        customFonts={theme.customFonts}
      />
    </div>
  )
}
