import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import BackButton from './BackButton'
import FlipBook from './FlipBook'

export default async function PublicMenuPage({
  params,
}: {
  params: { token: string; menuId: string }
}) {
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('qr_public_token', params.token)
    .single()

  if (!restaurant) notFound()

  const { data: menu } = await supabase
    .from('menus')
    .select('*')
    .eq('id', params.menuId)
    .eq('restaurant_id', restaurant.id)
    .eq('is_active', true)
    .single()

  if (!menu) notFound()

  const { data: dishes } = await supabase
    .from('dishes')
    .select('*')
    .eq('menu_id', params.menuId)
    .order('category', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true })

  return (
    <div>
      <BackButton token={params.token} menuName={menu.name} restaurantName={restaurant.name} />
      <div className="pt-12">
        <FlipBook
          dishes={dishes ?? []}
          menuName={menu.name}
          restaurantName={restaurant.name}
        />
      </div>
    </div>
  )
}
