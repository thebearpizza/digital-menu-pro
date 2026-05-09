'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getMenu(menuId: string, restaurantId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('menus')
    .select('*')
    .eq('id', menuId)
    .eq('restaurant_id', restaurantId)
    .single()

  return data
}

export async function updateMenu(
  menuId: string,
  restaurantId: string,
  form: { name: string; description: string; banner_type: 'image' | 'video'; banner_url: string; is_active: boolean }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { error } = await supabase
    .from('menus')
    .update({
      name: form.name.trim(),
      description: form.description.trim() || null,
      banner_type: form.banner_type,
      banner_url: form.banner_url.trim() || null,
      is_active: form.is_active,
    })
    .eq('id', menuId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/restaurants/${restaurantId}`)
  return { success: true }
}

export async function deleteMenu(menuId: string, restaurantId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { error } = await supabase
    .from('menus')
    .delete()
    .eq('id', menuId)
    .eq('restaurant_id', restaurantId)

  if (error) return { error: error.message }
  return { success: true }
}
