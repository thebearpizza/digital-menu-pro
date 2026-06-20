'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function activateDishFromDashboard(
  restaurantId: string,
  menuId: string,
  dishId: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  const { data: r } = await supabase
    .from('restaurants').select('id').eq('id', restaurantId).eq('owner_id', user.id).single()
  if (!r) throw new Error('Non autorizzato')

  const { error } = await supabase
    .from('dishes').update({ is_active: true }).eq('id', dishId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath(`/admin/restaurants/${restaurantId}/menus/${menuId}`)
}
