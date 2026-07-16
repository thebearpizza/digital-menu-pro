import { createClient } from '@/lib/supabase/server'
import MenuStatsLive, {
  type MenuRow, type DishRow,
  type MenuCatalogEntry, type DishCatalogEntry,
} from './MenuStatsLive'

export default async function MenuStatsTable({
  restaurantIds,
  restaurantNames,
}: {
  restaurantIds:   string[]
  restaurantNames: Record<string, string>
}) {
  if (!restaurantIds.length) return null

  const supabase = await createClient()

  // Aggregazione lato database (RPC get_menu_event_stats): scaricare tutte le
  // righe grezze di menu_events e sommarle in JS troncava silenziosamente a
  // 1000 (default PostgREST) non appena gli eventi superavano quel numero.
  const [eventsRes, menusRes, dishesRes] = await Promise.all([
    supabase.rpc('get_menu_event_stats', { p_restaurant_ids: restaurantIds }),
    supabase
      .from('menus')
      .select('id, name, restaurant_id')
      .in('restaurant_id', restaurantIds)
      .eq('is_active', true),
    supabase
      .from('dishes')
      .select('id, name, menu_id, restaurant_id')
      .in('restaurant_id', restaurantIds)
      .eq('is_active', true),
  ])

  // RPC missing (migration not applied yet) — return null to avoid breaking the dashboard.
  if (eventsRes.error) return null

  type Counts = { today: number; last7d: number; last30d: number; total: number }
  const menuAgg = (eventsRes.data?.menu_rows ?? []) as (Counts & { menu_id: string })[]
  const dishAgg = (eventsRes.data?.dish_rows ?? []) as (Counts & { dish_id: string })[]
  const menus   = (menusRes.data   ?? []) as { id: string; name: string; restaurant_id: string }[]
  const dishes  = (dishesRes.data  ?? []) as { id: string; name: string; menu_id: string; restaurant_id: string }[]

  // Build lookup catalogs (passed as props so live client can do optimistic updates)
  const menuCatalog: Record<string, MenuCatalogEntry> = {}
  for (const m of menus) menuCatalog[m.id] = { name: m.name, restaurantId: m.restaurant_id }

  const dishCatalog: Record<string, DishCatalogEntry> = {}
  for (const d of dishes) dishCatalog[d.id] = { name: d.name, menuId: d.menu_id, restaurantId: d.restaurant_id }

  const menuMap = new Map<string, Counts>(menuAgg.map(r => [r.menu_id, { today: r.today, last7d: r.last7d, last30d: r.last30d, total: r.total }]))
  const dishMap = new Map<string, Counts>(dishAgg.map(r => [r.dish_id, { today: r.today, last7d: r.last7d, last30d: r.last30d, total: r.total }]))

  const initialMenuRows: MenuRow[] = Array.from(menuMap.entries())
    .filter(([id]) => menuCatalog[id])
    .map(([id, counts]) => ({
      menuId: id,
      menuName: menuCatalog[id].name,
      restaurantId: menuCatalog[id].restaurantId,
      restaurantName: restaurantNames[menuCatalog[id].restaurantId] ?? '',
      ...counts,
    }))
    .sort((a, b) => b.total - a.total)

  const initialDishRows: DishRow[] = Array.from(dishMap.entries())
    .filter(([id]) => dishCatalog[id])
    .map(([id, counts]) => {
      const info  = dishCatalog[id]
      const mInfo = menuCatalog[info.menuId]
      return {
        dishId: id,
        dishName: info.name,
        menuId: info.menuId,
        menuName: mInfo?.name ?? '',
        restaurantId: info.restaurantId,
        restaurantName: restaurantNames[info.restaurantId] ?? '',
        ...counts,
      }
    })
    .sort((a, b) => b.total - a.total)

  return (
    <div className="mt-8">
      <MenuStatsLive
        initialMenuRows={initialMenuRows}
        initialDishRows={initialDishRows}
        restaurantIds={restaurantIds}
        restaurantNames={restaurantNames}
        menuCatalog={menuCatalog}
        dishCatalog={dishCatalog}
      />
    </div>
  )
}
