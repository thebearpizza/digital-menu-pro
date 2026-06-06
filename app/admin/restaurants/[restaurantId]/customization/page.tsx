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

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, logo_url, theme_config')
    .eq('id', params.restaurantId)
    .single()

  if (!restaurant) notFound()

  return (
    <CustomizationClient
      restaurantId={params.restaurantId}
      restaurantName={restaurant.name as string}
      restaurantLogo={(restaurant.logo_url ?? null) as string | null}
      initialTheme={parseTheme(restaurant.theme_config)}
    />
  )
}
