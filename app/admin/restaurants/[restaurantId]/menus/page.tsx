import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import MenuList from './MenuList'

export default async function MenusPage({ params }: { params: { restaurantId: string } }) {
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants').select('id, name').eq('id', params.restaurantId).single()
  if (!restaurant) notFound()

  const { data: menus } = await supabase
    .from('menus')
    .select('id, name, sort_order, is_active, schedule_enabled, schedule_from, schedule_until')
    .eq('restaurant_id', params.restaurantId)
    .order('sort_order', { ascending: true })

  return (
    <MenuList
      restaurantId={params.restaurantId}
      initialMenus={menus ?? []}
    />
  )
}
