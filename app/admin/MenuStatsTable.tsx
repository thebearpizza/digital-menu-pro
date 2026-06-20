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

  // Fetch all three datasets in parallel; gracefully handle missing table.
  const [eventsRes, menusRes, dishesRes] = await Promise.all([
    supabase
      .from('menu_events' as any)
      .select('menu_id, dish_id, event_type, created_at')
      .in('restaurant_id', restaurantIds),
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

  // Table might not exist yet — return null to avoid breaking the dashboard.
  if (eventsRes.error) return null

  const events  = (eventsRes.data  ?? []) as { menu_id: string; dish_id: string | null; event_type: string; created_at: string }[]
  const menus   = (menusRes.data   ?? []) as { id: string; name: string; restaurant_id: string }[]
  const dishes  = (dishesRes.data  ?? []) as { id: string; name: string; menu_id: string; restaurant_id: string }[]

  // Build lookup catalogs (passed as props so live client can do optimistic updates)
  const menuCatalog: Record<string, MenuCatalogEntry> = {}
  for (const m of menus) menuCatalog[m.id] = { name: m.name, restaurantId: m.restaurant_id }

  const dishCatalog: Record<string, DishCatalogEntry> = {}
  for (const d of dishes) dishCatalog[d.id] = { name: d.name, menuId: d.menu_id, restaurantId: d.restaurant_id }

  // Aggregate
  const now        = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const ago7d      = new Date(now.getTime() - 7  * 86_400_000)
  const ago30d     = new Date(now.getTime() - 30 * 86_400_000)

  const menuMap = new Map<string, { today: number; last7d: number; last30d: number; total: number }>()
  const dishMap = new Map<string, { today: number; last7d: number; last30d: number; total: number }>()

  for (const ev of events) {
    const ts = new Date(ev.created_at)
    const d  = { total: 1, last30d: ts >= ago30d ? 1 : 0, last7d: ts >= ago7d ? 1 : 0, today: ts >= todayStart ? 1 : 0 }

    if (ev.event_type === 'menu_open') {
      const prev = menuMap.get(ev.menu_id) ?? { today: 0, last7d: 0, last30d: 0, total: 0 }
      menuMap.set(ev.menu_id, {
        today: prev.today + d.today, last7d: prev.last7d + d.last7d,
        last30d: prev.last30d + d.last30d, total: prev.total + 1,
      })
    } else if (ev.event_type === 'dish_click' && ev.dish_id) {
      const prev = dishMap.get(ev.dish_id) ?? { today: 0, last7d: 0, last30d: 0, total: 0 }
      dishMap.set(ev.dish_id, {
        today: prev.today + d.today, last7d: prev.last7d + d.last7d,
        last30d: prev.last30d + d.last30d, total: prev.total + 1,
      })
    }
  }

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
