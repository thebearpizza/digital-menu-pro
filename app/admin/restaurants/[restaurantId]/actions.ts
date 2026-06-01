'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function verifyOwnership(supabase: any, restaurantId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')
  const { data: r } = await supabase
    .from('restaurants').select('id').eq('id', restaurantId).eq('owner_id', user.id).single()
  if (!r) throw new Error('Ristorante non trovato')
}

export async function updateRestaurant(restaurantId: string, data: {
  name: string
  description?: string | null
  logo_url?: string | null
  instagram_url?: string | null
  facebook_url?: string | null
  website_url?: string | null
  tripadvisor_url?: string | null
  google_maps_url?: string | null
}) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { error } = await supabase
    .from('restaurants')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', restaurantId)

  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${restaurantId}`)
}

export async function deleteRestaurant(restaurantId: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase.from('restaurants').delete().eq('id', restaurantId)
  if (error) throw new Error(error.message)
  redirect('/admin/restaurants')
}
