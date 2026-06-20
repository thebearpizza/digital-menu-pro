import { createClient } from '@/lib/supabase/server'
import ScanStatsLive, { type ScanRow } from './ScanStatsLive'

export default async function ScanStatsTable({
  restaurantIds,
  restaurantNames,
}: {
  restaurantIds:   string[]
  restaurantNames: Record<string, string>
}) {
  if (!restaurantIds.length) return null

  const supabase = await createClient()

  const { data: views } = await supabase
    .from('page_views')
    .select('restaurant_id, created_at')
    .in('restaurant_id', restaurantIds)

  const now        = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const ago7d      = new Date(now.getTime() - 7  * 86_400_000)
  const ago30d     = new Date(now.getTime() - 30 * 86_400_000)

  const map = new Map<string, { today: number; last7d: number; last30d: number; total: number }>()
  for (const id of restaurantIds) map.set(id, { today: 0, last7d: 0, last30d: 0, total: 0 })

  for (const v of (views ?? [])) {
    const row = map.get(v.restaurant_id)
    if (!row) continue
    const ts = new Date(v.created_at)
    row.total++
    if (ts >= ago30d)     row.last30d++
    if (ts >= ago7d)      row.last7d++
    if (ts >= todayStart) row.today++
  }

  const initial: ScanRow[] = restaurantIds
    .map(id => ({ restaurantId: id, restaurantName: restaurantNames[id] ?? id, ...map.get(id)! }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)

  return (
    <div className="mt-8">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Scansioni QR
      </h2>
      <ScanStatsLive
        initial={initial}
        restaurantIds={restaurantIds}
        restaurantNames={restaurantNames}
      />
    </div>
  )
}
