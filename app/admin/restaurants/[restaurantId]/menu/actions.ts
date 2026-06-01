'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function verifyOwnership(restaurantId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  const { data: r } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .single()

  if (!r) throw new Error('Ristorante non trovato')
  return { supabase }
}

export async function createDish(
  restaurantId: string,
  data: { name: string; description: string; price: string; category: string; image_url: string }
) {
  const { supabase } = await verifyOwnership(restaurantId)
  const price = data.price ? parseFloat(data.price) : null

  const { data: dish, error } = await supabase
    .from('dishes')
    .insert({
      restaurant_id: restaurantId,
      name:         data.name,
      description:  data.description || null,
      price:        price !== null && !isNaN(price) ? price : null,
      category:     data.category || null,
      image_url:    data.image_url || null,
      is_active:    true,
      sort_order:   0,
    })
    .select('id, name, description, price, category, image_url, sort_order, is_active')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${restaurantId}/menu`)
  return dish
}

export async function updateDish(
  restaurantId: string,
  dishId: string,
  data: { name: string; description: string; price: string; category: string; image_url: string }
) {
  const { supabase } = await verifyOwnership(restaurantId)
  const price = data.price ? parseFloat(data.price) : null

  const { data: dish, error } = await supabase
    .from('dishes')
    .update({
      name:        data.name,
      description: data.description || null,
      price:       price !== null && !isNaN(price) ? price : null,
      category:    data.category || null,
      image_url:   data.image_url || null,
    })
    .eq('id', dishId)
    .select('id, name, description, price, category, image_url, sort_order, is_active')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${restaurantId}/menu`)
  return dish
}

export async function deleteDish(restaurantId: string, dishId: string) {
  const { supabase } = await verifyOwnership(restaurantId)
  const { error } = await supabase.from('dishes').delete().eq('id', dishId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${restaurantId}/menu`)
}
