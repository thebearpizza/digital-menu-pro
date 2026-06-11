'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function deleteRestaurant(restaurantId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  const { data: r } = await supabase
    .from('restaurants').select('id').eq('id', restaurantId).eq('owner_id', user.id).single()
  if (!r) throw new Error('Non autorizzato')

  const { error } = await supabase.from('restaurants').delete().eq('id', restaurantId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/restaurants')
  revalidatePath('/admin') // i contatori della dashboard includono questo ristorante
  redirect('/admin/restaurants')
}
