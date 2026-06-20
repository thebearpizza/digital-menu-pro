import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import DashboardCounters from './DashboardCounters'
import InactiveDishesPanel from './InactiveDishesPanel'
import ScanStatsTable from './ScanStatsTable'
import MenuStatsTable from './MenuStatsTable'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, name, is_active')
    .eq('owner_id', user!.id)
    .order('name')

  const restaurantIds   = (restaurants ?? []).map(r => r.id)
  const restaurantNames = Object.fromEntries((restaurants ?? []).map(r => [r.id, r.name]))

  let activeDishCount   = 0
  let inactiveDishCount = 0
  let activeMenuCount   = 0
  let inactiveDishes:   any[] = []

  if (restaurantIds.length > 0) {
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from('dishes').select('id', { count: 'exact', head: true })
        .in('restaurant_id', restaurantIds).eq('is_active', true),
      supabase.from('dishes').select('id', { count: 'exact', head: true })
        .in('restaurant_id', restaurantIds).eq('is_active', false),
      supabase.from('menus').select('id', { count: 'exact', head: true })
        .in('restaurant_id', restaurantIds).eq('is_active', true),
      supabase.from('dishes')
        .select('id, name, price, category, restaurant_id, menu_id, menus(id, name)')
        .in('restaurant_id', restaurantIds)
        .eq('is_active', false)
        .order('category')
        .order('name'),
    ])
    activeDishCount   = r1.count ?? 0
    inactiveDishCount = r2.count ?? 0
    activeMenuCount   = r3.count ?? 0
    inactiveDishes    = r4.data ?? []
  }

  const groups = (restaurants ?? []).map(r => ({
    id:   r.id,
    name: r.name,
    dishes: inactiveDishes
      .filter((d: any) => d.restaurant_id === r.id)
      .map((d: any) => ({
        id:        d.id        as string,
        name:      d.name      as string,
        category:  (d.category ?? null) as string | null,
        price:     (d.price    ?? null) as number | null,
        menu_id:   ((d.menus as any)?.id   ?? d.menu_id) as string,
        menu_name: ((d.menus as any)?.name ?? 'Menu')    as string,
      })),
  }))

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Panoramica del gestionale</p>
      </div>

      <DashboardCounters
        restaurantCount={restaurantIds.length}
        activeMenuCount={activeMenuCount}
        activeDishCount={activeDishCount}
        inactiveDishCount={inactiveDishCount}
      />

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

      <InactiveDishesPanel groups={groups} />

      <ScanStatsTable
        restaurantIds={restaurantIds}
        restaurantNames={restaurantNames}
      />

      <MenuStatsTable
        restaurantIds={restaurantIds}
        restaurantNames={restaurantNames}
      />
    </div>
  )
}
