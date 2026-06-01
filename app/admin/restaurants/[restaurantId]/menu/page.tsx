import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DishList from './DishList'

export default async function MenuPage({
  params,
}: {
  params: { restaurantId: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('id', params.restaurantId)
    .eq('owner_id', user!.id)
    .single()

  if (!restaurant) notFound()

  const { data: dishes } = await supabase
    .from('dishes')
    .select('id, name, description, price, category, image_url, sort_order, is_active')
    .eq('restaurant_id', params.restaurantId)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/admin/restaurants/${params.restaurantId}`}
          className="text-xs text-blue-600 hover:underline"
        >
          ← {restaurant.name}
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-2">Gestione piatti</h1>
        <p className="text-sm text-gray-500 mt-0.5">{dishes?.length ?? 0} piatti totali</p>
      </div>

      <DishList restaurantId={params.restaurantId} initialDishes={dishes ?? []} />
    </div>
  )
}
