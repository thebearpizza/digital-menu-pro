'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function verifyOwnership(supabase: any, restaurantId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')
  const { data: r } = await supabase
    .from('restaurants').select('id').eq('id', restaurantId).eq('owner_id', user.id).single()
  if (!r) throw new Error('Non autorizzato')
  return user
}

function revalidate(restaurantId: string) {
  revalidatePath(`/admin/restaurants/${restaurantId}/menus`)
}

export async function createMenu(restaurantId: string, name: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: last } = await supabase
    .from('menus').select('sort_order').eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: false }).limit(1).single()

  const { data, error } = await supabase
    .from('menus')
    .insert({ restaurant_id: restaurantId, name, sort_order: (last?.sort_order ?? -1) + 1 })
    .select('id, name, sort_order, is_active').single()

  if (error) throw new Error(error.message)
  revalidate(restaurantId)
  return data
}

export async function updateMenuName(restaurantId: string, menuId: string, name: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { error } = await supabase
    .from('menus').update({ name }).eq('id', menuId).eq('restaurant_id', restaurantId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId)
}

export async function deleteMenu(restaurantId: string, menuId: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { error } = await supabase
    .from('menus').delete().eq('id', menuId).eq('restaurant_id', restaurantId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId)
}

export async function duplicateMenu(restaurantId: string, menuId: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: source } = await supabase
    .from('menus').select('name, sort_order').eq('id', menuId).single()
  if (!source) throw new Error('Menu non trovato')

  const { data: newMenu, error: menuErr } = await supabase
    .from('menus')
    .insert({ restaurant_id: restaurantId, name: `${source.name} (Copia)`, sort_order: source.sort_order + 1 })
    .select('id, name, sort_order, is_active').single()
  if (menuErr) throw new Error(menuErr.message)

  // Duplicate dishes
  const { data: dishes } = await supabase
    .from('dishes')
    .select('name, description, price, category, image_url, allergens, sort_order, pairing_label')
    .eq('menu_id', menuId)

  if (dishes?.length) {
    await supabase.from('dishes').insert(
      dishes.map(d => ({
        ...d,
        id: undefined,
        restaurant_id: restaurantId,
        menu_id: newMenu!.id,
        master_dish_id: null,
      }))
    )
  }

  revalidate(restaurantId)
  return newMenu
}

export async function toggleMenuActive(restaurantId: string, menuId: string, active: boolean) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase
    .from('menus').update({ is_active: active }).eq('id', menuId).eq('restaurant_id', restaurantId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId)
}

export async function reorderMenus(restaurantId: string, orderedIds: string[]) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('menus').update({ sort_order: index }).eq('id', id).eq('restaurant_id', restaurantId)
    )
  )
  revalidate(restaurantId)
}
