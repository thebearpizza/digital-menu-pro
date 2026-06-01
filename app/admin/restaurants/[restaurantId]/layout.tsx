import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TabNav from './components/TabNav'

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

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
        <Link href="/admin/restaurants" className="hover:text-gray-600">Ristoranti</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{restaurant.name}</span>
      </div>

      <TabNav restaurantId={params.restaurantId} />
      {children}
    </div>
  )
}
