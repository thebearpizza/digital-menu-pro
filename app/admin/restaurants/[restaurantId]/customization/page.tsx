import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import CustomizationClient from './CustomizationClient'

export default async function CustomizationPage({
  params,
}: {
  params: { restaurantId: string }
}) {
  const supabase = await createClient()

  const [{ data: restaurant }, { data: banners }, { data: info }] = await Promise.all([
    supabase
      .from('restaurants')
      .select('id, name, theme_config')
      .eq('id', params.restaurantId)
      .single(),
    supabase
      .from('restaurant_banners')
      .select('id, media_url, media_type, title, subtitle, transition, sort_order, is_active')
      .eq('restaurant_id', params.restaurantId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('restaurant_info')
      .select('id, title, content, is_active')
      .eq('restaurant_id', params.restaurantId)
      .maybeSingle(),
  ])

  if (!restaurant) notFound()

  return (
    <CustomizationClient
      restaurantId={params.restaurantId}
      initialTheme={restaurant.theme_config as any}
      initialBanners={banners ?? []}
      initialInfo={info}
    />
  )
}
