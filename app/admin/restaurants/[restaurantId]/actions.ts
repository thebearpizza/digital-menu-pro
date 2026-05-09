'use server'

import { createClient } from '@/lib/supabase/server'

export async function updateRestaurant(
  restaurantId: string,
  form: {
    name: string
    description: string
    instagram_url: string
    facebook_url: string
    website_url: string
    tripadvisor_url: string
    google_maps_url: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { error } = await supabase
    .from('restaurants')
    .update({
      name: form.name.trim(),
      description: form.description.trim() || null,
      instagram_url: form.instagram_url.trim() || null,
      facebook_url: form.facebook_url.trim() || null,
      website_url: form.website_url.trim() || null,
      tripadvisor_url: form.tripadvisor_url.trim() || null,
      google_maps_url: form.google_maps_url.trim() || null,
    })
    .eq('id', restaurantId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}
