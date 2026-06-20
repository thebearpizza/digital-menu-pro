'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// ── CSS keyframes ─────────────────────────────────────────────────────────────
const FLIP_CSS = `
@keyframes sflap {
  0%   { transform: perspective(6em) rotateX(0deg);   }
  40%  { transform: perspective(6em) rotateX(-88deg); }
  60%  { transform: perspective(6em) rotateX(88deg);  }
  100% { transform: perspective(6em) rotateX(0deg);   }
}
`

// ── Single flap card — sizing via em so parent font-size controls scale ───────
function Digit({ ch, seq, color = '#f5e4b0' }: { ch: string; seq: number; color?: string }) {
  const ref     = useRef<HTMLSpanElement>(null)
  const prevSeq = useRef(seq)

  useEffect(() => {
    if (seq === prevSeq.current || !ref.current) return
    prevSeq.current = seq
    const el = ref.current
    el.style.animation = 'none'
    void el.offsetWidth
    el.style.animation = 'sflap 160ms ease-in-out'
  }, [seq])

  return (
    <span
      ref={ref}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        width: '0.78em', height: '1.15em',
        fontSize: 'inherit',
        fontFamily: 'ui-monospace, "Courier New", monospace',
        fontWeight: 700,
        background: '#1c1c1e',
        color,
        borderRadius: '0.1em',
        boxShadow: '0 0.05em 0.2em rgba(0,0,0,0.6), inset 0 -0.05em 0 rgba(255,255,255,0.04)',
      }}
    >
      <span style={{
        position: 'absolute', left: 0, right: 0, top: '50%',
        height: '1px', background: 'rgba(0,0,0,0.55)', pointerEvents: 'none',
      }} />
      {ch}
    </span>
  )
}

// ── Number made of digit cards ────────────────────────────────────────────────
function FlipNumber({ value, color }: { value: number; color?: string }) {
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
    <span style={{ display: 'inline-flex', gap: '0.1em' }}>
      {String(disp).split('').map((ch, i) => (
        <Digit key={i} ch={ch} seq={seq} color={color} />
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
  const [rows,      setRows]    = useState<ScanRow[]>(initial)
  const [updatedAt, setUpdated] = useState<Date>(new Date())
  const [live,      setLive]    = useState(false)

  function aggregate(views: { restaurant_id: string; created_at: string }[]): ScanRow[] {
    const now        = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const ago7d      = new Date(now.getTime() - 7  * 86_400_000)
    const ago30d     = new Date(now.getTime() - 30 * 86_400_000)
    const map = new Map<string, { today: number; last7d: number; last30d: number; total: number }>()
    for (const id of restaurantIds) map.set(id, { today: 0, last7d: 0, last30d: 0, total: 0 })
    for (const v of views) {
      const row = map.get(v.restaurant_id); if (!row) continue
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

  function applyInsert(restaurantId: string, createdAt: string) {
    const now        = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const ago7d      = new Date(now.getTime() - 7  * 86_400_000)
    const ago30d     = new Date(now.getTime() - 30 * 86_400_000)
    const ts         = new Date(createdAt)
    const delta = {
      total:   1,
      last30d: ts >= ago30d     ? 1 : 0,
      last7d:  ts >= ago7d      ? 1 : 0,
      today:   ts >= todayStart ? 1 : 0,
    }
    setRows(prev => {
      const exists = prev.some(r => r.restaurantId === restaurantId)
      const next = exists
        ? prev.map(r => r.restaurantId !== restaurantId ? r : {
            ...r, total: r.total + 1,
            last30d: r.last30d + delta.last30d,
            last7d:  r.last7d  + delta.last7d,
            today:   r.today   + delta.today,
          })
        : [...prev, { restaurantId, restaurantName: restaurantNames[restaurantId] ?? restaurantId, ...delta }]
      return next.sort((a, b) => b.total - a.total)
    })
    setUpdated(new Date())
  }

  // Realtime subscription
  useEffect(() => {
    if (!restaurantIds.length) return
    const supabase = createClient()
    const ch = supabase
      .channel('scan-stats-live')
      .on('postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'page_views' },
        (payload: any) => {
          const rid = payload.new?.restaurant_id as string | undefined
          if (rid && restaurantIds.includes(rid)) applyInsert(rid, payload.new.created_at)
        })
      .subscribe(status => { if (status === 'SUBSCRIBED') setLive(true) })
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantIds.join(',')])

  // Polling fallback every 60 s
  useEffect(() => {
    if (!restaurantIds.length) return
    const supabase = createClient()
    const iv = setInterval(async () => {
      const { data } = await supabase
        .from('page_views').select('restaurant_id, created_at').in('restaurant_id', restaurantIds)
      if (data) { setRows(aggregate(data)); setUpdated(new Date()) }
    }, 60_000)
    return () => clearInterval(iv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantIds.join(',')])

  // ── Aggregated totals ─────────────────────────────────────────────────────
  const grandTotal  = rows.reduce((s, r) => s + r.total,  0)
  const grandToday  = rows.reduce((s, r) => s + r.today,  0)
  const grand7d     = rows.reduce((s, r) => s + r.last7d,  0)
  const grand30d    = rows.reduce((s, r) => s + r.last30d, 0)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{FLIP_CSS}</style>

      {/* ── Hero tabellone ── */}
      <div style={{ background: '#0a0a0a', border: '1px solid #222' }} className="p-6 mb-4">

        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <span style={{ color: '#444', fontSize: '0.65rem', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Scansioni QR
          </span>
          <span className="flex items-center gap-1.5" style={{ color: live ? '#4ade80' : '#555', fontSize: '0.65rem', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.12em' }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: live ? '#4ade80' : '#555',
              display: 'inline-block',
              animation: live ? 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' : 'none',
            }} />
            {live ? 'LIVE' : 'CONNECTING'}
          </span>
        </div>

        {/* Big total number */}
        <div className="mb-1" style={{ fontSize: grandTotal === 0 ? '2.8rem' : `${Math.max(1.6, 2.8 - Math.max(0, String(grandTotal).length - 3) * 0.3)}rem` }}>
          {grandTotal === 0
            ? <span style={{ color: '#333', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>—</span>
            : <FlipNumber value={grandTotal} color="#f5e4b0" />}
        </div>
        <div style={{ color: '#444', fontSize: '0.65rem', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2rem' }}>
          totali
        </div>

        {/* Period breakdown */}
        <div className="grid grid-cols-3 gap-6">
          {[
            { label: 'OGGI',      value: grandToday },
            { label: '7 GIORNI',  value: grand7d    },
            { label: '30 GIORNI', value: grand30d   },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ color: '#3a3a3a', fontSize: '0.6rem', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.15em', marginBottom: '0.4rem' }}>
                {label}
              </div>
              <div style={{ fontSize: '1.5rem' }}>
                {value === 0
                  ? <span style={{ color: '#2a2a2a', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>0</span>
                  : <FlipNumber value={value} color="#d4c49a" />}
              </div>
            </div>
          ))}
        </div>

        {/* Per-restaurant mini list */}
        {rows.length > 0 && (
          <div style={{ borderTop: '1px solid #1a1a1a', marginTop: '1.5rem', paddingTop: '1rem' }}>
            <div className="flex flex-col gap-1.5">
              {rows.map(r => (
                <div key={r.restaurantId} className="flex items-baseline justify-between">
                  <Link
                    href={`/admin/restaurants/${r.restaurantId}`}
                    style={{ color: '#555', fontSize: '0.72rem', fontFamily: 'ui-monospace, monospace' }}
                    className="hover:text-gray-300 transition-colors truncate max-w-[60%]"
                  >
                    {r.restaurantName}
                  </Link>
                  <span style={{ fontSize: '0.8rem' }}>
                    <FlipNumber value={r.total} color="#888" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timestamp */}
        <div style={{ marginTop: '1rem', color: '#2a2a2a', fontSize: '0.58rem', fontFamily: 'ui-monospace, monospace' }}>
          {updatedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>
    </>
  )
}
