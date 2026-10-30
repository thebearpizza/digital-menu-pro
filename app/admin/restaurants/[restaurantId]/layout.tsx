import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TabNav from './components/TabNav'
import RestaurantSwitcher from './components/RestaurantSwitcher'

export default async function RestaurantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { restaurantId: string }
}) {
  const supabase = await createClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('id', params.restaurantId)
    .single()

  if (!restaurant) notFound()

  // Gli altri ristoranti dell'account, per cambiare al volo dal percorso in alto.
  const { data: { user } } = await supabase.auth.getUser()
  const { data: others } = user
    ? await supabase.from('restaurants').select('id, name').eq('owner_id', user.id).order('name')
    : { data: null }

  return (
    <div className="max-w-5xl mx-auto px-0 sm:px-6 py-2 sm:py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
        <Link href="/admin/restaurants" className="hover:text-gray-600">Ristoranti</Link>
        <span>/</span>
        <RestaurantSwitcher currentId={restaurant.id} currentName={restaurant.name} restaurants={others ?? []} />
      </div>

      <TabNav restaurantId={params.restaurantId} />
      {children}
    </div>
  )
}
