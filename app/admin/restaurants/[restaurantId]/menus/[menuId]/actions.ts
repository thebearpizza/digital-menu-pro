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

function revalidate(restaurantId: string, menuId: string) {
  revalidatePath(`/admin/restaurants/${restaurantId}/menus/${menuId}`)
}

export async function createDish(
  restaurantId: string,
  menuId: string,
  data: {
    name: string
    description: string
    price: string
    category: string
    image_url: string
    allergens: number[]
    pairing_dish_id: string | null
  }
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const price = data.price ? parseFloat(data.price) : null

  const { data: last } = await supabase
    .from('dishes').select('sort_order').eq('menu_id', menuId)
    .order('sort_order', { ascending: false }).limit(1).single()

  const { data: dish, error } = await supabase
    .from('dishes')
    .insert({
      restaurant_id: restaurantId,
      menu_id:       menuId,
      name:          data.name,
      description:   data.description || null,
      price:         price !== null && !isNaN(price) ? price : null,
      category:      data.category || null,
      image_url:     data.image_url || null,
      allergens:     data.allergens,
      pairing_dish_id: data.pairing_dish_id || null,
      is_active:     true,
      sort_order:    (last?.sort_order ?? -1) + 1,
    })
    .select('id, name, description, price, category, image_url, allergens, sort_order, is_active, pairing_dish_id, pairing_label')
    .single()

  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
  return dish
}

export async function updateDish(
  restaurantId: string,
  menuId: string,
  dishId: string,
  data: {
    name: string
    description: string
    price: string
    category: string
    image_url: string
    allergens: number[]
    pairing_dish_id: string | null
  }
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const price = data.price ? parseFloat(data.price) : null

  const { data: dish, error } = await supabase
    .from('dishes')
    .update({
      name:          data.name,
      description:   data.description || null,
      price:         price !== null && !isNaN(price) ? price : null,
      category:      data.category || null,
      image_url:     data.image_url || null,
      allergens:     data.allergens,
      pairing_dish_id: data.pairing_dish_id || null,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', dishId)
    .select('id, name, description, price, category, image_url, allergens, sort_order, is_active, pairing_dish_id, pairing_label')
    .single()

  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
  return dish
}

export async function deleteDish(restaurantId: string, menuId: string, dishId: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase.from('dishes').delete().eq('id', dishId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
}

export async function reorderCategories(
  restaurantId: string,
  menuId: string,
  categoryOrder: string[]
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase
    .from('menus')
    .update({ category_order: categoryOrder })
    .eq('id', menuId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
}

export async function syncDishToMasters(
  restaurantId: string,
  dishId: string,
  masterDishId: string,
  fields: string[]
) {
  const supabase = await createClient()
  const user = await verifyOwnership(supabase, restaurantId)

  const { data: source } = await supabase
    .from('dishes').select('name, description, price, image_url, allergens').eq('id', dishId).single()
  if (!source) throw new Error('Piatto non trovato')

  const { data: targets } = await supabase
    .from('dishes').select('id').eq('master_dish_id', masterDishId).neq('id', dishId)
  if (!targets?.length) return

  const patch: Record<string, any> = {}
  if (fields.includes('name'))        patch.name        = source.name
  if (fields.includes('description')) patch.description = source.description
  if (fields.includes('price'))       patch.price       = source.price
  if (fields.includes('image_url'))   patch.image_url   = source.image_url
  if (fields.includes('allergens'))   patch.allergens   = source.allergens

  if (Object.keys(patch).length === 0) return

  await supabase
    .from('dishes').update(patch)
    .in('id', targets.map(t => t.id))

  // Log sync
  await supabase.from('sync_logs').insert({
    restaurant_id: restaurantId,
    source_dish_id: dishId,
    target_dish_id: targets[0].id,
    synced_fields: fields,
    performed_by: user.id,
  })
}
