'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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

// ── Tipi ──────────────────────────────────────────────────────────────────────
export interface ScanRow {
  restaurantId:   string
  restaurantName: string
  today:          number
  last7d:         number
  last30d:        number
  total:          number
}

// ── Componente principale ─────────────────────────────────────────────────────
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
    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const ago7d  = new Date(now.getTime() - 7  * 86_400_000)
    const ago30d = new Date(now.getTime() - 30 * 86_400_000)
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

  // Polling fallback ogni 60 s
  useEffect(() => {
    if (!restaurantIds.length) return
    const supabase = createClient()
    const iv = setInterval(async () => {
      const { data } = await supabase.from('page_views').select('restaurant_id, created_at').in('restaurant_id', restaurantIds)
      if (data) { setRows(aggregate(data)); setUpdated(new Date()) }
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

        {/* Per ristorante */}
        {rows.length > 0 && (
          <div className="border-t border-gray-100 pt-4 space-y-2">
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
