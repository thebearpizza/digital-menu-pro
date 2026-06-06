import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { parseTheme } from '@/lib/theme'
import CustomizationClient from './CustomizationClient'

export default async function CustomizationPage({
  params,
}: {
  params: { restaurantId: string }
}) {
  const supabase = await createClient()

  const [{ data: restaurant }, { data: rawBanners }] = await Promise.all([
    supabase
      .from('restaurants')
      .select('id, name, logo_url, theme_config, qr_public_token')
      .eq('id', params.restaurantId)
      .single(),
    supabase
      .from('restaurant_banners')
      .select('id, media_url, media_type, title, subtitle, sort_order, is_active')
      .eq('restaurant_id', params.restaurantId)
      .order('sort_order', { ascending: true }),
  ])

  if (!restaurant) notFound()

  return (
    <CustomizationClient
      restaurantId={params.restaurantId}
      restaurantName={restaurant.name as string}
      restaurantLogo={(restaurant.logo_url ?? null) as string | null}
      qrToken={(restaurant.qr_public_token ?? null) as string | null}
      initialTheme={parseTheme(restaurant.theme_config)}
      initialBanners={(rawBanners ?? []).map(b => ({
        id:         b.id as string,
        media_url:  b.media_url as string | null,
        media_type: b.media_type as string,
        title:      b.title as string | null,
        subtitle:   b.subtitle as string | null,
        sort_order: b.sort_order as number,
        is_active:  b.is_active as boolean,
      }))}
    />
  )
}
