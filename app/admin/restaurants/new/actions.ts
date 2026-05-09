'use server'

import { createClient } from '@/lib/supabase/server'

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    + '-' + Math.random().toString(36).substring(2, 7)
}

export async function createRestaurant(form: {
  name: string
  description: string
  instagram_url: string
  facebook_url: string
  website_url: string
  tripadvisor_url: string
  google_maps_url: string
}) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Sessione scaduta. Rieffettua il login.' }
  }

  const { data, error } = await supabase
    .from('restaurants')
    .insert({
      owner_id: user.id,
      name: form.name.trim(),
      slug: generateSlug(form.name),
      description: form.description.trim() || null,
      instagram_url: form.instagram_url.trim() || null,
      facebook_url: form.facebook_url.trim() || null,
      website_url: form.website_url.trim() || null,
      tripadvisor_url: form.tripadvisor_url.trim() || null,
      google_maps_url: form.google_maps_url.trim() || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { id: data.id }
}
