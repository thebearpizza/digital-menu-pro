'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'

// ── Keyframes ─────────────────────────────────────────────────────────────────
const FLIP_CSS = `
@keyframes sflapDown {
  from { transform: perspective(12em) rotateX(0deg);   }
  to   { transform: perspective(12em) rotateX(-90deg); }
}
@keyframes sflapUp {
  from { transform: perspective(12em) rotateX(90deg);  }
  to   { transform: perspective(12em) rotateX(0deg);   }
}
`

// ── Singolo carattere split-flap ──────────────────────────────────────────────
//
//  Ogni layer è un elemento full-size (inset:0) con il carattere centrato
//  via flex. clip-path: inset() taglia top o bottom half in coordinate LOCALI,
//  prima di qualsiasi transform — nessun calcolo di offset a percentuale
//  (evita il bug CSS: margin-top% è relativo alla larghezza, non all'altezza).
//
//  Il flap usa transformOrigin:'50% 50%' = centro del card = cerniera.
//  clip-path viene applicato prima del rotateX, quindi la linguetta ruota
//  come una scheda fisica che si piega attorno alla cerniera.
//
function Digit({ char, prevChar }: { char: string; prevChar: string }) {
  const shouldAnim = char !== prevChar && char !== '' && prevChar !== ''
  const [topChar,   setTopChar]   = useState(char)
  const [flapChar,  setFlapChar]  = useState(char)
  const [flapPhase, setFlapPhase] = useState<0 | 1 | 2>(0)

  useEffect(() => {
    if (!shouldAnim) { setTopChar(char); return }
    setTopChar(prevChar)
    setFlapChar(prevChar)
    setFlapPhase(1)
    const t1 = setTimeout(() => { setTopChar(char); setFlapChar(char); setFlapPhase(2) }, 210)
    const t2 = setTimeout(() => setFlapPhase(0), 440)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [char, prevChar]) // eslint-disable-line react-hooks/exhaustive-deps

  const BG   = '#2563eb'
  const TEXT = '#ffffff'
  const FONT = 'ui-monospace,"Courier New",monospace'

  // Stile base condiviso da tutti i layer: full-size, carattere centrato
  const layer: React.CSSProperties = {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: BG, color: TEXT,
    fontFamily: FONT, fontWeight: 700, fontSize: 'inherit', lineHeight: 1,
  }

  return (
    <span style={{
      display: 'inline-block', position: 'relative',
      width: '0.88em', height: '1.32em',
      fontSize: 'inherit', userSelect: 'none',
    }}>

      {/* Top half statico — clip taglia via la metà inferiore */}
      <span style={{
        ...layer,
        clipPath: 'inset(0 0 50% 0 round 0.12em 0.12em 0 0)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)',
      }}>
        {topChar || char}
      </span>

      {/* Bottom half statico — mostra il NUOVO char, visibile sotto il flap */}
      <span style={{
        ...layer,
        clipPath: 'inset(50% 0 0 0 round 0 0 0.12em 0.12em)',
      }}>
        {char}
      </span>

      {/* Cerniera */}
      <span style={{
        position: 'absolute', inset: '50% 0 auto',
        height: '2px', background: 'rgba(0,0,0,0.22)',
        transform: 'translateY(-50%)', zIndex: 20,
      }} />

      {/* Linguetta animata — bottom half che ruota attorno alla cerniera */}
      {flapPhase > 0 && (
        <span style={{
          ...layer,
          clipPath: 'inset(50% 0 0 0 round 0 0 0.12em 0.12em)',
          transformOrigin: '50% 50%',   // centro card = cerniera
          animation: flapPhase === 1
            ? 'sflapDown 210ms ease-in  forwards'
            : 'sflapUp   225ms ease-out forwards',
          zIndex: 15,
          boxShadow: '0 0.5em 1em rgba(0,0,0,0.22)',
        }}>
          {flapChar}
        </span>
      )}
    </span>
  )
}

// ── Numero composto da digit card ─────────────────────────────────────────────
function FlipNumber({ value }: { value: number }) {
  const prevRef = useRef(value)
  const [curr, setCurr] = useState(String(value))
  const [prev, setPrev] = useState(String(value))

  useEffect(() => {
    if (value === prevRef.current) return
    setPrev(String(prevRef.current))
    prevRef.current = value
    setCurr(String(value))
  }, [value])

  const len     = Math.max(curr.length, prev.length)
  const currPad = curr.padStart(len, ' ')
  const prevPad = prev.padStart(len, ' ')

  return (
    <span style={{ display: 'inline-flex', gap: '0.1em' }}>
      {currPad.split('').map((ch, i) => (
        <Digit
          key={`d${i}`}
          char={ch.trim()}
          prevChar={(prevPad[i] ?? ' ').trim()}
        />
      ))}
    </span>
  )
}

// ── Tooltip personalizzato per il grafico ─────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const date = new Date(label + 'T00:00:00')
  const formatted = date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: '0.375rem', padding: '0.5rem 0.75rem',
      fontSize: '0.75rem', color: '#374151',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <p style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{formatted}</p>
      <p style={{ color: '#2563eb' }}>{payload[0].value} scansioni</p>
    </div>
  )
}

// ── Grafico trend ─────────────────────────────────────────────────────────────
function ScanChart({ data }: { data: ChartPoint[] }) {
  const [period, setPeriod] = useState<7 | 30>(30)
  const displayed = period === 7 ? data.slice(-7) : data

  // X-axis tick: show only a few evenly-spaced labels to avoid crowding
  const tickFormatter = (day: string) => {
    const d = new Date(day + 'T00:00:00')
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
  }

  const ticks = period === 7
    ? displayed.map(p => p.date)
    : displayed.filter((_, i) => i % 5 === 0 || i === displayed.length - 1).map(p => p.date)

  const maxVal = Math.max(...displayed.map(p => p.scans), 1)

  return (
    <div className="mt-6">
      {/* Period toggle */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Andamento</span>
        <div className="flex gap-1">
          {([7, 30] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {p}g
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={displayed} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={tickFormatter}
            tick={{ fontSize: 9, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, maxVal + 1]}
            tick={{ fontSize: 9, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="scans"
            stroke="#2563eb"
            strokeWidth={2}
            fill="url(#scanGrad)"
            dot={false}
            activeDot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Tipi ──────────────────────────────────────────────────────────────────────
export interface ScanRow {
  restaurantId:   string
  restaurantName: string
  today:          number
  last7d:         number
  last30d:        number
  total:          number
}

export interface ChartPoint {
  date:  string  // 'YYYY-MM-DD'
  scans: number
}

// ── Componente principale ─────────────────────────────────────────────────────
export default function ScanStatsLive({
  initial,
  restaurantIds,
  restaurantNames,
  chartData: initialChartData,
}: {
  initial:          ScanRow[]
  restaurantIds:    string[]
  restaurantNames:  Record<string, string>
  chartData:        ChartPoint[]
}) {
  const [rows,      setRows]      = useState<ScanRow[]>(initial)
  const [chartData, setChartData] = useState<ChartPoint[]>(initialChartData)
  const [updatedAt, setUpdated]   = useState<Date>(new Date())
  const [live,      setLive]      = useState(false)

  function applyInsert(restaurantId: string, createdAt: string) {
    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const ago7d  = new Date(now.getTime() - 7  * 86_400_000)
    const ago30d = new Date(now.getTime() - 30 * 86_400_000)
    const ts     = new Date(createdAt)
    const delta  = { total: 1, last30d: ts >= ago30d ? 1 : 0, last7d: ts >= ago7d ? 1 : 0, today: ts >= todayStart ? 1 : 0 }
    setRows(prev => {
      const exists = prev.some(r => r.restaurantId === restaurantId)
      const next = exists
        ? prev.map(r => r.restaurantId !== restaurantId ? r : { ...r, total: r.total + delta.total, last30d: r.last30d + delta.last30d, last7d: r.last7d + delta.last7d, today: r.today + delta.today })
        : [...prev, { restaurantId, restaurantName: restaurantNames[restaurantId] ?? restaurantId, ...delta }]
      return next.sort((a, b) => b.total - a.total)
    })
    // Increment today's chart bucket
    if (ts >= ago30d) {
      const day = ts.toISOString().slice(0, 10)
      setChartData(prev => prev.map(p => p.date === day ? { ...p, scans: p.scans + 1 } : p))
    }
    setUpdated(new Date())
  }

  // Realtime
  useEffect(() => {
    if (!restaurantIds.length) return
    const supabase = createClient()
    const ch = supabase
      .channel('scan-stats-live')
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'page_views' }, (payload: any) => {
        const rid = payload.new?.restaurant_id as string | undefined
        if (rid && restaurantIds.includes(rid)) applyInsert(rid, payload.new.created_at)
      })
      .subscribe(s => { if (s === 'SUBSCRIBED') setLive(true) })
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantIds.join(',')])

  // Polling fallback ogni 60 s — aggregazione lato database (RPC
  // get_scan_stats): scaricare le righe grezze e sommarle in JS troncava
  // silenziosamente a 1000 (default PostgREST) oltre le 1000 scansioni.
  useEffect(() => {
    if (!restaurantIds.length) return
    const supabase = createClient()
    const iv = setInterval(async () => {
      const { data: stats } = await supabase.rpc('get_scan_stats', { p_restaurant_ids: restaurantIds })
      const statsRows = (stats?.rows  ?? []) as { restaurant_id: string; today: number; last7d: number; last30d: number; total: number }[]
      const chart     = (stats?.chart ?? []) as ChartPoint[]
      const next: ScanRow[] = statsRows
        .map(r => ({ restaurantId: r.restaurant_id, restaurantName: restaurantNames[r.restaurant_id] ?? r.restaurant_id, today: r.today, last7d: r.last7d, last30d: r.last30d, total: r.total }))
        .filter(r => r.total > 0)
        .sort((a, b) => b.total - a.total)
      setRows(next)
      setChartData(chart)
      setUpdated(new Date())
    }, 60_000)
    return () => clearInterval(iv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantIds.join(',')])

  const grandTotal = rows.reduce((s, r) => s + r.total,  0)
  const grandToday = rows.reduce((s, r) => s + r.today,  0)
  const grand7d    = rows.reduce((s, r) => s + r.last7d,  0)
  const grand30d   = rows.reduce((s, r) => s + r.last30d, 0)

  const totalFontSize = `${Math.max(1.8, 3 - Math.max(0, String(grandTotal).length - 3) * 0.35)}rem`

  return (
    <>
      <style>{FLIP_CSS}</style>

      <div className="bg-white border border-gray-200 p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Scansioni QR</span>
          <span className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: live ? '#16a34a' : '#9ca3af' }}>
            <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
            {live ? 'LIVE' : 'CONNESSIONE…'}
          </span>
        </div>

        {/* Totale grande */}
        <div className="mb-1" style={{ fontSize: grandTotal === 0 ? '3rem' : totalFontSize }}>
          {grandTotal === 0
            ? <span className="text-gray-200" style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 700 }}>—</span>
            : <FlipNumber value={grandTotal} />}
        </div>
        <p className="text-xs text-gray-400 mb-8">scansioni totali</p>

        {/* Periodo */}
        <div className="grid grid-cols-3 gap-6 mb-6" style={{ fontSize: '1.55rem' }}>
          {[
            { label: 'Oggi',      value: grandToday },
            { label: '7 giorni',  value: grand7d    },
            { label: '30 giorni', value: grand30d   },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
              {value === 0
                ? <span className="text-gray-200" style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 700, fontSize: '1.55rem' }}>0</span>
                : <FlipNumber value={value} />}
            </div>
          ))}
        </div>

        {/* Grafico andamento */}
        <ScanChart data={chartData} />

        {/* Per ristorante */}
        {rows.length > 0 && (
          <div className="border-t border-gray-100 pt-4 mt-6 space-y-2">
            {rows.map(r => (
              <div key={r.restaurantId} className="flex items-center justify-between gap-4">
                <Link
                  href={`/admin/restaurants/${r.restaurantId}`}
                  className="text-sm text-gray-500 hover:text-blue-600 hover:underline truncate"
                >
                  {r.restaurantName}
                </Link>
                <span style={{ fontSize: '0.95rem', flexShrink: 0 }}>
                  <FlipNumber value={r.total} />
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className="text-[10px] text-gray-300 mt-4">
          aggiornato {updatedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      </div>
    </>
  )
}
