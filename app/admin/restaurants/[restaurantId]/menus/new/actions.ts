'use server'

import { createClient } from '@/lib/supabase/server'

export async function createMenu(
  restaurantId: string,
  form: {
    name: string
    description: string
    banner_type: 'image' | 'video'
    banner_url: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  // Verifica che il ristorante appartenga all'utente
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .single()

  if (!restaurant) return { error: 'Ristorante non trovato' }

  // Conta menu esistenti per il sort_order
  const { count } = await supabase
    .from('menus')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)

  const { data, error } = await supabase
    .from('menus')
    .insert({
      restaurant_id: restaurantId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      banner_type: form.banner_type,
      banner_url: form.banner_url.trim() || null,
      sort_order: count ?? 0,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { id: data.id }
}
