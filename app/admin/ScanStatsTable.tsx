import { createClient } from '@/lib/supabase/server'
import ScanStatsLive, { type ScanRow, type ChartPoint } from './ScanStatsLive'

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

  // 30-day daily buckets: key = 'YYYY-MM-DD'
  const dailyMap = new Map<string, number>()

  for (const v of (views ?? [])) {
    const row = map.get(v.restaurant_id)
    if (!row) continue
    const ts = new Date(v.created_at)
    row.total++
    if (ts >= ago30d) {
      row.last30d++
      const day = ts.toISOString().slice(0, 10)
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1)
    }
    if (ts >= ago7d)      row.last7d++
    if (ts >= todayStart) row.today++
  }

  // Fill all 30 days (including zeros) so the chart has a continuous x-axis
  const chartData: ChartPoint[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000)
    const day = d.toISOString().slice(0, 10)
    chartData.push({ date: day, scans: dailyMap.get(day) ?? 0 })
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
        chartData={chartData}
      />
    </div>
  )
}
