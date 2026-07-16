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

  // Aggregazione lato database (RPC get_scan_stats): scaricare tutte le righe
  // grezze e sommarle in JS troncava silenziosamente a 1000 (default
  // PostgREST) non appena il ristorante superava 1000 scansioni totali.
  const { data: stats } = await supabase.rpc('get_scan_stats', { p_restaurant_ids: restaurantIds })
  const statsRows = (stats?.rows  ?? []) as { restaurant_id: string; today: number; last7d: number; last30d: number; total: number }[]
  const chartData = (stats?.chart ?? []) as ChartPoint[]

  const map = new Map<string, { today: number; last7d: number; last30d: number; total: number }>()
  for (const id of restaurantIds) map.set(id, { today: 0, last7d: 0, last30d: 0, total: 0 })
  for (const r of statsRows) map.set(r.restaurant_id, { today: r.today, last7d: r.last7d, last30d: r.last30d, total: r.total })

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
