import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import MenuFlipbook from './MenuFlipbook'

// The /m/[token] URL pattern is the printed QR contract — this path must never change.
// The page implementation can be rewritten freely.
// See CLAUDE.md → "URL del QR code stabile per sempre"

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Menu',
  robots: { index: false, follow: false },
}

export default async function PublicMenuPage({
  params,
}: {
  params: { token: string }
}) {
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, description')
    .eq('qr_public_token', params.token)
    .eq('is_active', true)
    .single()

  if (!restaurant) notFound()

  const { data: rawDishes } = await supabase
    .from('dishes')
    .select('id, name, description, price, category, image_url, sort_order')
    .eq('restaurant_id', restaurant.id)
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })

  const items = (rawDishes ?? []).map(d => ({
    id:          d.id as string,
    name:        d.name as string,
    description: d.description as string | null,
    price:       d.price as number | null,
    category:    (d.category as string | null) ?? 'Menu',
    photo_url:   d.image_url as string | null,
  }))

  return (
    <MenuFlipbook
      restaurantName={restaurant.name}
      restaurantDescription={(restaurant.description as string | null) ?? null}
      items={items}
    />
  )
}
