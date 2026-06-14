import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import DashboardCounters from './DashboardCounters'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user!.id)

  const restaurantIds = (restaurants ?? []).map(r => r.id)

  const { count: dishCount } = restaurantIds.length > 0
    ? await supabase
        .from('dishes')
        .select('id', { count: 'exact', head: true })
        .in('restaurant_id', restaurantIds)
        .eq('is_active', true)
    : { count: 0 }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Panoramica del gestionale</p>
      </div>

      <DashboardCounters restaurantCount={restaurantIds.length} dishCount={dishCount ?? 0} />

      {restaurantIds.length === 0 && (
        <div className="bg-white border border-gray-200 p-8 max-w-md">
          <p className="text-sm text-gray-600 mb-4">
            Nessun ristorante configurato. Crea il primo per iniziare.
          </p>
          <Link
            href="/admin/restaurants/new"
            className="inline-block bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 transition-colors"
          >
            + Crea ristorante
          </Link>
        </div>
      )}
    </div>
  )
}
