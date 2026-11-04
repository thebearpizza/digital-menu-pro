import { parseStyle } from '@/lib/menuStyle'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DishList from './DishList'
import DownloadPDFButton from './DownloadPDFButton'

export default async function MenuDishesPage({
  params,
}: {
  params: { restaurantId: string; menuId: string }
}) {
  const supabase = await createClient()

  const [{ data: menu }, { data: dishes }, { data: allDishes }, { data: allMenus }, { data: restaurant }] = await Promise.all([
    supabase
      .from('menus').select('id, name, restaurant_id, category_order, text_content, category_schedules, menu_style')
      .eq('id', params.menuId).eq('restaurant_id', params.restaurantId).single(),
    supabase
      .from('dishes')
      .select('id, name, description, price, category, image_url, image_original_url, image_crop, photo_frame, allergens, sort_order, is_active, pairing_dish_id, pairing_label, master_dish_id, schedule_enabled, schedule_from, schedule_until, schedule_days')
      .eq('menu_id', params.menuId)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('dishes')
      .select('id, name, category, menu_id')
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
      .select('name, menu_style')
      .eq('id', params.restaurantId)
      .single(),
  ])

  if (!menu) notFound()

  // Formato della foto nella scheda del piatto (stile del menu o del
  // ristorante): decide il riquadro di "Inquadra".
  const photoFormat = {
    shape:   parseStyle((menu as any).menu_style ?? (restaurant as any)?.menu_style).card.photo,
    newMenu: true,
  }

  // Il PDF comprende i piatti attivi (come il menu sul telefono).
  const hasActive = (dishes ?? []).some((d: any) => d.is_active)

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

        {/* Solo mobile: su tablet/desktop lo stesso bottone è annegato
            nella riga azioni unificata di DishList (prop pdfButton sotto),
            non serve più qui separato — era la posizione "disordinata"
            segnalata. */}
        <div className="sm:hidden">
          <DownloadPDFButton
            restaurantId={params.restaurantId}
            restaurantName={(restaurant as any)?.name ?? ''}
            menuId={menu.id}
            menuName={menu.name}
            hasDishes={hasActive}
          />
        </div>
      </div>

      <DishList
        restaurantId={params.restaurantId}
        menuId={params.menuId}
        initialDishes={(dishes ?? []) as any[]}
        allDishes={(allDishes ?? []) as any[]}
        allMenus={(allMenus ?? []) as any[]}
        initialCategoryOrder={(menu.category_order as string[] | null) ?? null}
        initialCategorySchedules={((menu as any).category_schedules ?? {}) as Record<string, { enabled?: boolean; from?: string | null; until?: string | null }>}
        photoFormat={photoFormat}
        pdfButton={
          <DownloadPDFButton
            fill
            restaurantId={params.restaurantId}
            restaurantName={(restaurant as any)?.name ?? ''}
            menuId={menu.id}
            menuName={menu.name}
            hasDishes={hasActive}
          />
        }
      />

      {/* Pagina informativa e pagina allergeni: si scrivono e si impaginano
          nella Personalizzazione, con l'anteprima del menu accanto. */}
      <div className="mt-6 border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600" style={{ borderRadius: 12 }}>
        Pagina informativa e pagina allergeni ora si modificano in{' '}
        <Link href={`/admin/restaurants/${params.restaurantId}/stile`} className="font-medium text-gray-900 underline underline-offset-2">
          Personalizzazione
        </Link>
        , con l&apos;anteprima del menu accanto.
      </div>
    </div>
  )
}
