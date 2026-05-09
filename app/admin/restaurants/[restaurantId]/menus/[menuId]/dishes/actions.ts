'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getDishes(menuId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('dishes')
    .select('*')
    .eq('menu_id', menuId)
    .order('category', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true })
  return data ?? []
}

export async function createDish(menuId: string, restaurantId: string, form: {
  name: string
  description: string
  price: string
  image_url: string
  allergens: string[]
  is_available: boolean
  category: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { count } = await supabase
    .from('dishes')
    .select('*', { count: 'exact', head: true })
    .eq('menu_id', menuId)

  const { data, error } = await supabase
    .from('dishes')
    .insert({
      menu_id: menuId,
      restaurant_id: restaurantId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: form.price !== '' ? parseFloat(form.price) : null,
      image_url: form.image_url.trim() || null,
      allergens: form.allergens,
      is_available: form.is_available,
      category: form.category.trim() || null,
      sort_order: count ?? 0,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/admin/restaurants/${restaurantId}/menus/${menuId}`)
  return { id: data.id }
}

export async function updateDish(dishId: string, menuId: string, restaurantId: string, form: {
  name: string
  description: string
  price: string
  image_url: string
  allergens: string[]
  is_available: boolean
  category: string
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('dishes')
    .update({
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: form.price !== '' ? parseFloat(form.price) : null,
      image_url: form.image_url.trim() || null,
      allergens: form.allergens,
      is_available: form.is_available,
      category: form.category.trim() || null,
    })
    .eq('id', dishId)
    .eq('menu_id', menuId)
  if (error) return { error: error.message }
  revalidatePath(`/admin/restaurants/${restaurantId}/menus/${menuId}`)
  return { success: true }
}

export async function deleteDish(dishId: string, menuId: string, restaurantId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('dishes')
    .delete()
    .eq('id', dishId)
    .eq('menu_id', menuId)
  if (error) return { error: error.message }
  revalidatePath(`/admin/restaurants/${restaurantId}/menus/${menuId}`)
  return { success: true }
}
