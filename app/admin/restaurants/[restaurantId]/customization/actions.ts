'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function verifyOwnership(supabase: any, restaurantId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')
  const { data: r } = await supabase
    .from('restaurants').select('id').eq('id', restaurantId).eq('owner_id', user.id).single()
  if (!r) throw new Error('Non autorizzato')
}

function revalidate(restaurantId: string) {
  revalidatePath(`/admin/restaurants/${restaurantId}/customization`)
}

export async function saveTheme(restaurantId: string, themeConfig: object) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase
    .from('restaurants').update({ theme_config: themeConfig }).eq('id', restaurantId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId)
}

export async function createBanner(restaurantId: string, data: {
  media_url: string
  media_type: string
  title?: string
  subtitle?: string
  transition?: string
  sort_order: number
}) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { data: banner, error } = await supabase
    .from('restaurant_banners')
    .insert({ restaurant_id: restaurantId, ...data })
    .select('id, media_url, media_type, title, subtitle, transition, sort_order, is_active')
    .single()
  if (error) throw new Error(error.message)
  revalidate(restaurantId)
  return banner
}

export async function deleteBanner(restaurantId: string, bannerId: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase
    .from('restaurant_banners').delete().eq('id', bannerId).eq('restaurant_id', restaurantId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId)
}

export async function saveInfo(restaurantId: string, data: {
  title: string
  content: string
  is_active: boolean
}) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase
    .from('restaurant_info')
    .upsert({ restaurant_id: restaurantId, ...data, updated_at: new Date().toISOString() },
      { onConflict: 'restaurant_id' })
  if (error) throw new Error(error.message)
  revalidate(restaurantId)
}
