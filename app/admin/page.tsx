import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

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

      <div className="grid grid-cols-2 gap-4 max-w-sm mb-8">
        <div className="bg-white border border-gray-200 p-5">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
            Ristoranti
          </div>
          <div className="text-3xl font-semibold text-gray-900">{restaurantIds.length}</div>
        </div>
        <div className="bg-white border border-gray-200 p-5">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
            Piatti attivi
          </div>
          <div className="text-3xl font-semibold text-gray-900">{dishCount ?? 0}</div>
        </div>
      </div>

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
