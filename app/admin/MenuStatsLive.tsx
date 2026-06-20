'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export interface MenuRow {
  menuId:         string
  menuName:       string
  restaurantId:   string
  restaurantName: string
  today:          number
  last7d:         number
  last30d:        number
  total:          number
}

export interface DishRow {
  dishId:         string
  dishName:       string
  menuId:         string
  menuName:       string
  restaurantId:   string
  restaurantName: string
  today:          number
  last7d:         number
  last30d:        number
  total:          number
}

export interface MenuCatalogEntry  { name: string; restaurantId: string }
export interface DishCatalogEntry  { name: string; menuId: string; restaurantId: string }

type Period = 'today' | 'last7d' | 'last30d' | 'total'

// ── Pill toggle ───────────────────────────────────────────────────────────────
function PeriodToggle({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const opts: { k: Period; label: string }[] = [
    { k: 'today',   label: 'Oggi'  },
    { k: 'last7d',  label: '7gg'   },
    { k: 'last30d', label: '30gg'  },
    { k: 'total',   label: 'Tutti' },
  ]
  return (
    <div className="flex gap-1">
      {opts.map(({ k, label }) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
            value === k ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Componente principale ─────────────────────────────────────────────────────
export default function MenuStatsLive({
  initialMenuRows,
  initialDishRows,
  restaurantIds,
  restaurantNames,
  menuCatalog,
  dishCatalog,
}: {
  initialMenuRows:  MenuRow[]
  initialDishRows:  DishRow[]
  restaurantIds:    string[]
  restaurantNames:  Record<string, string>
  menuCatalog:      Record<string, MenuCatalogEntry>
  dishCatalog:      Record<string, DishCatalogEntry>
}) {
  const [menuRows,   setMenuRows]   = useState<MenuRow[]>(initialMenuRows)
  const [dishRows,   setDishRows]   = useState<DishRow[]>(initialDishRows)
  const [menuPeriod, setMenuPeriod] = useState<Period>('total')
  const [dishPeriod, setDishPeriod] = useState<Period>('total')
  const [live,       setLive]       = useState(false)
  const multiRest = restaurantIds.length > 1

  function applyInsert(eventType: string, menuId: string, dishId: string | null, createdAt: string) {
    const now        = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const ago7d      = new Date(now.getTime() - 7  * 86_400_000)
    const ago30d     = new Date(now.getTime() - 30 * 86_400_000)
    const ts         = new Date(createdAt)
    const delta = {
      total: 1,
      last30d: ts >= ago30d ? 1 : 0,
      last7d:  ts >= ago7d  ? 1 : 0,
      today:   ts >= todayStart ? 1 : 0,
    }

    if (eventType === 'menu_open') {
      setMenuRows(prev => {
        const exists = prev.some(r => r.menuId === menuId)
        const info   = menuCatalog[menuId]
        if (!exists && !info) return prev
        const next = exists
          ? prev.map(r => r.menuId !== menuId ? r
              : { ...r, total: r.total + delta.total, last30d: r.last30d + delta.last30d, last7d: r.last7d + delta.last7d, today: r.today + delta.today })
          : [...prev, {
              menuId, menuName: info!.name,
              restaurantId: info!.restaurantId,
              restaurantName: restaurantNames[info!.restaurantId] ?? info!.restaurantId,
              ...delta,
            }]
        return next.sort((a, b) => b.total - a.total)
      })
    } else if (eventType === 'dish_click' && dishId) {
      setDishRows(prev => {
        const exists = prev.some(r => r.dishId === dishId)
        const info   = dishCatalog[dishId]
        if (!exists && !info) return prev
        const mInfo  = menuCatalog[info!.menuId]
        const next = exists
          ? prev.map(r => r.dishId !== dishId ? r
              : { ...r, total: r.total + delta.total, last30d: r.last30d + delta.last30d, last7d: r.last7d + delta.last7d, today: r.today + delta.today })
          : [...prev, {
              dishId, dishName: info!.name,
              menuId: info!.menuId, menuName: mInfo?.name ?? '',
              restaurantId: info!.restaurantId,
              restaurantName: restaurantNames[info!.restaurantId] ?? info!.restaurantId,
              ...delta,
            }]
        return next.sort((a, b) => b.total - a.total)
      })
    }
  }

  // Realtime
  useEffect(() => {
    if (!restaurantIds.length) return
    const supabase = createClient()
    const ch = supabase
      .channel('menu-stats-live')
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'menu_events' }, (payload: any) => {
        const rid = payload.new?.restaurant_id as string | undefined
        if (rid && restaurantIds.includes(rid))
          applyInsert(payload.new.event_type, payload.new.menu_id, payload.new.dish_id ?? null, payload.new.created_at)
      })
      .subscribe(s => { if (s === 'SUBSCRIBED') setLive(true) })
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantIds.join(',')])

  const totalMenuOpens = menuRows.reduce((s, r) => s + r.total, 0)
  const totalDishClicks = dishRows.reduce((s, r) => s + r.total, 0)

  return (
    <div className="bg-white border border-gray-200 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Interazioni menu</span>
        <span className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: live ? '#16a34a' : '#9ca3af' }}>
          <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
          {live ? 'LIVE' : 'CONNESSIONE…'}
        </span>
      </div>

      {/* Sommario totali */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Aperture menu</p>
          <p className="text-2xl font-semibold text-gray-900">{totalMenuOpens > 0 ? totalMenuOpens.toLocaleString('it-IT') : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Clic sui piatti</p>
          <p className="text-2xl font-semibold text-gray-900">{totalDishClicks > 0 ? totalDishClicks.toLocaleString('it-IT') : '—'}</p>
        </div>
      </div>

      {/* ── Tabella aperture menu ─────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Aperture per menu</span>
          <PeriodToggle value={menuPeriod} onChange={setMenuPeriod} />
        </div>
        {menuRows.length === 0 ? (
          <p className="text-xs text-gray-300 py-2">Nessuna apertura ancora registrata.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Menu</th>
                  {multiRest && <th className="pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Ristorante</th>}
                  <th className="pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Aperture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {menuRows.slice(0, 10).map(r => (
                  <tr key={r.menuId} className="hover:bg-gray-50">
                    <td className="py-2 text-gray-700">
                      <Link
                        href={`/admin/restaurants/${r.restaurantId}/menus/${r.menuId}`}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {r.menuName}
                      </Link>
                    </td>
                    {multiRest && (
                      <td className="py-2 text-gray-400 text-xs">{r.restaurantName}</td>
                    )}
                    <td className="py-2 text-right font-semibold text-gray-800">{r[menuPeriod].toLocaleString('it-IT')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Tabella clic sui piatti ───────────────────────────────────────── */}
      <div className="border-t border-gray-100 pt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Piatti più cliccati</span>
          <PeriodToggle value={dishPeriod} onChange={setDishPeriod} />
        </div>
        {dishRows.length === 0 ? (
          <p className="text-xs text-gray-300 py-2">Nessun clic ancora registrato.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Piatto</th>
                  <th className="pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Menu</th>
                  {multiRest && <th className="pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Ristorante</th>}
                  <th className="pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Clic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dishRows.slice(0, 10).map(r => (
                  <tr key={r.dishId} className="hover:bg-gray-50">
                    <td className="py-2 text-gray-700">{r.dishName}</td>
                    <td className="py-2 text-gray-400 text-xs">
                      <Link
                        href={`/admin/restaurants/${r.restaurantId}/menus/${r.menuId}`}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {r.menuName}
                      </Link>
                    </td>
                    {multiRest && (
                      <td className="py-2 text-gray-400 text-xs">{r.restaurantName}</td>
                    )}
                    <td className="py-2 text-right font-semibold text-gray-800">{r[dishPeriod].toLocaleString('it-IT')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
