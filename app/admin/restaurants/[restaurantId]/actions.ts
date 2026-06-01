'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateRestaurant(
  restaurantId: string,
  form: { name: string; description: string }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { error } = await supabase
    .from('restaurants')
    .update({
      name: form.name.trim(),
      description: form.description.trim() || null,
    })
    .eq('id', restaurantId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }
  revalidatePath(`/admin/restaurants/${restaurantId}`)
  return { success: true }
}

export async function deleteRestaurant(restaurantId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { error } = await supabase
    .from('restaurants')
    .delete()
    .eq('id', restaurantId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/admin/restaurants')
  return { success: true }
}
