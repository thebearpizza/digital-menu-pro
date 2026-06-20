'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// ── CSS keyframes for split-flap effect ──────────────────────────────────────
const FLIP_CSS = `
@keyframes sflap {
  0%   { transform: perspective(80px) rotateX(0deg);   }
  40%  { transform: perspective(80px) rotateX(-88deg); }
  60%  { transform: perspective(80px) rotateX(88deg);  }
  100% { transform: perspective(80px) rotateX(0deg);   }
}
`

// ── Single character "flap" card ──────────────────────────────────────────────
function Digit({ ch, seq }: { ch: string; seq: number }) {
  const ref      = useRef<HTMLSpanElement>(null)
  const prevSeq  = useRef(seq)

  useEffect(() => {
    if (seq === prevSeq.current || !ref.current) return
    prevSeq.current = seq
    const el = ref.current
    el.style.animation = 'none'
    void el.offsetWidth          // force reflow to restart animation
    el.style.animation = 'sflap 155ms ease-in-out'
  }, [seq])

  return (
    <span
      ref={ref}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        width: '0.72rem', height: '1.08rem',
        background: '#1c1c1e', color: '#f5f0e8',
        fontFamily: 'ui-monospace, "Courier New", monospace',
        fontWeight: 700, fontSize: '0.78rem',
        borderRadius: '2px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.45)',
      }}
    >
      {/* hinge line */}
      <span style={{
        position: 'absolute', left: 0, right: 0, top: '50%',
        height: '1px', background: 'rgba(0,0,0,0.45)',
        pointerEvents: 'none',
      }} />
      {ch}
    </span>
  )
}

// ── Number split into individual digit cards ──────────────────────────────────
function FlipNumber({ value }: { value: number }) {
  const prevRef = useRef(value)
  const ivRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const [disp, setDisp] = useState(value)
  const [seq,  setSeq]  = useState(0)

  useEffect(() => {
    const from = prevRef.current
    prevRef.current = value
    if (from === value) return

    if (ivRef.current) clearInterval(ivRef.current)

    let cur = from
    ivRef.current = setInterval(() => {
      cur += value > from ? 1 : -1
      setDisp(cur)
      setSeq(s => s + 1)
      if (cur === value) { clearInterval(ivRef.current!); ivRef.current = null }
    }, 80)

    return () => { if (ivRef.current) clearInterval(ivRef.current) }
  }, [value])

  return (
    <span style={{ display: 'inline-flex', gap: '2px' }}>
      {String(disp).split('').map((ch, i) => (
        <Digit key={i} ch={ch} seq={seq} />
      ))}
    </span>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ScanRow {
  restaurantId:   string
  restaurantName: string
  today:          number
  last7d:         number
  last30d:        number
  total:          number
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ScanStatsLive({
  initial,
  restaurantIds,
  restaurantNames,
}: {
  initial:         ScanRow[]
  restaurantIds:   string[]
  restaurantNames: Record<string, string>
}) {
  const [rows,     setRows]     = useState<ScanRow[]>(initial)
  const [updatedAt, setUpdated] = useState<Date>(new Date())

  // ── Aggregate raw views into ScanRow[] ────────────────────────────────────
  function aggregate(views: { restaurant_id: string; created_at: string }[]): ScanRow[] {
    const now        = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const ago7d      = new Date(now.getTime() - 7  * 86_400_000)
    const ago30d     = new Date(now.getTime() - 30 * 86_400_000)

    const map = new Map<string, { today: number; last7d: number; last30d: number; total: number }>()
    for (const id of restaurantIds) map.set(id, { today: 0, last7d: 0, last30d: 0, total: 0 })

    for (const v of views) {
      const row = map.get(v.restaurant_id)
      if (!row) continue
      const ts = new Date(v.created_at)
      row.total++
      if (ts >= ago30d)     row.last30d++
      if (ts >= ago7d)      row.last7d++
      if (ts >= todayStart) row.today++
    }

    return restaurantIds
      .map(id => ({ restaurantId: id, restaurantName: restaurantNames[id] ?? id, ...map.get(id)! }))
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total)
  }

  // ── Apply a single new INSERT to current rows ─────────────────────────────
  function applyInsert(restaurantId: string, createdAt: string) {
    const now        = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const ago7d      = new Date(now.getTime() - 7  * 86_400_000)
    const ago30d     = new Date(now.getTime() - 30 * 86_400_000)
    const ts         = new Date(createdAt)

    setRows(prev => {
      const existing = prev.find(r => r.restaurantId === restaurantId)
      const delta = {
        total:  1,
        last30d: ts >= ago30d     ? 1 : 0,
        last7d:  ts >= ago7d      ? 1 : 0,
        today:   ts >= todayStart ? 1 : 0,
      }
      if (existing) {
        return prev
          .map(r => r.restaurantId !== restaurantId ? r : {
            ...r,
            total:   r.total   + delta.total,
            last30d: r.last30d + delta.last30d,
            last7d:  r.last7d  + delta.last7d,
            today:   r.today   + delta.today,
          })
          .sort((a, b) => b.total - a.total)
      }
      // New restaurant appearing in stats
      return [
        ...prev,
        {
          restaurantId,
          restaurantName: restaurantNames[restaurantId] ?? restaurantId,
          ...delta,
        },
      ].sort((a, b) => b.total - a.total)
    })
    setUpdated(new Date())
  }

  // ── Supabase Realtime subscription ────────────────────────────────────────
  useEffect(() => {
    if (!restaurantIds.length) return
    const supabase = createClient()

    const channel = supabase
      .channel('scan-stats-live')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'page_views' },
        (payload: any) => {
          const rid = payload.new?.restaurant_id as string | undefined
          if (rid && restaurantIds.includes(rid)) {
            applyInsert(rid, payload.new.created_at)
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantIds.join(',')])

  // ── Polling fallback every 60 s (covers realtime gaps) ───────────────────
  useEffect(() => {
    if (!restaurantIds.length) return
    const supabase = createClient()

    const iv = setInterval(async () => {
      const { data } = await supabase
        .from('page_views')
        .select('restaurant_id, created_at')
        .in('restaurant_id', restaurantIds)
      if (data) { setRows(aggregate(data)); setUpdated(new Date()) }
    }, 60_000)

    return () => clearInterval(iv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantIds.join(',')])

  // ── Render ────────────────────────────────────────────────────────────────
  const grandTotal = rows.reduce((s, r) => s + r.total, 0)

  if (!rows.length) {
    return (
      <p className="text-sm text-gray-400 mt-1">Nessuna scansione ancora registrata.</p>
    )
  }

  return (
    <>
      <style>{FLIP_CSS}</style>

      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm text-gray-500 flex items-center gap-1.5">
          <FlipNumber value={grandTotal} />
          <span className="text-gray-400 ml-1">totali</span>
        </span>
        <span className="text-[10px] text-gray-300">
          · {updatedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
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
                <td className="px-4 py-3 text-right">
                  {r.today > 0
                    ? <FlipNumber value={r.today} />
                    : <span className="text-gray-300 text-sm">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.last7d > 0
                    ? <FlipNumber value={r.last7d} />
                    : <span className="text-gray-300 text-sm">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.last30d > 0
                    ? <FlipNumber value={r.last30d} />
                    : <span className="text-gray-300 text-sm">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <FlipNumber value={r.total} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
