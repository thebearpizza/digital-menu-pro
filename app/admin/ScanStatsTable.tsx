import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface ScanRow {
  restaurantId:   string
  restaurantName: string
  today:          number
  last7d:         number
  last30d:        number
  total:          number
}

export default async function ScanStatsTable({
  restaurantIds,
  restaurantNames,
}: {
  restaurantIds:   string[]
  restaurantNames: Record<string, string>
}) {
  if (!restaurantIds.length) return null

  const supabase = await createClient()

  const now        = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const ago7d      = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
  const ago30d     = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Pull all views for this owner's restaurants — RLS enforces ownership
  const { data: views } = await supabase
    .from('page_views')
    .select('restaurant_id, created_at')
    .in('restaurant_id', restaurantIds)

  if (!views?.length) {
    return (
      <div className="mt-8">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Scansioni QR
        </h2>
        <p className="text-sm text-gray-400">Nessuna scansione ancora registrata.</p>
      </div>
    )
  }

  // Aggregate client-side (volumes are small per owner)
  const map = new Map<string, { today: number; last7d: number; last30d: number; total: number }>()
  for (const id of restaurantIds) {
    map.set(id, { today: 0, last7d: 0, last30d: 0, total: 0 })
  }
  for (const v of views) {
    const row = map.get(v.restaurant_id)
    if (!row) continue
    const ts = new Date(v.created_at)
    row.total++
    if (ts >= ago30d)     row.last30d++
    if (ts >= ago7d)      row.last7d++
    if (ts >= todayStart) row.today++
  }

  const rows: ScanRow[] = restaurantIds
    .map(id => ({
      restaurantId:   id,
      restaurantName: restaurantNames[id] ?? id,
      ...map.get(id)!,
    }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)

  if (!rows.length) {
    return (
      <div className="mt-8">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Scansioni QR
        </h2>
        <p className="text-sm text-gray-400">Nessuna scansione ancora registrata.</p>
      </div>
    )
  }

  const grandTotal = rows.reduce((s, r) => s + r.total, 0)

  return (
    <div className="mt-8">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Scansioni QR
        </h2>
        <span className="text-xs text-gray-400">{grandTotal} totali</span>
      </div>

      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="border-b border-gray-100 text-left bg-gray-50">
              <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Ristorante</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Oggi</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">7 giorni</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">30 giorni</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Totale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(r => (
              <tr key={r.restaurantId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/restaurants/${r.restaurantId}`}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
                  >
                    {r.restaurantName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 text-right tabular-nums">
                  {r.today > 0 ? r.today : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 text-right tabular-nums">
                  {r.last7d > 0 ? r.last7d : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 text-right tabular-nums">
                  {r.last30d > 0 ? r.last30d : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right tabular-nums">
                  {r.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
