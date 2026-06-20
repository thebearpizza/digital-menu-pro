'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '@/components/admin/LogoutButton'
import NavigationProgress from '@/components/admin/NavigationProgress'

interface Restaurant { id: string; name: string }

function ChevronRight({ className = '' }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <polyline points="4,2 8,6 4,10" />
    </svg>
  )
}

const RESTAURANT_TABS = [
  { label: 'Informazioni',     segment: ''               },
  { label: 'Menu',             segment: '/menus'         },
  { label: 'Personalizzazione', segment: '/customization' },
]

export default function AdminShell({
  userEmail,
  children,
  restaurants = [],
}: {
  userEmail:   string
  children:    React.ReactNode
  restaurants?: Restaurant[]
}) {
  const [drawerOpen,       setDrawerOpen]       = useState(false)
  const [restaurantsOpen,  setRestaurantsOpen]  = useState(false)
  const [openRestaurantId, setOpenRestaurantId] = useState<string | null>(null)
  const pathname = usePathname()

  // Auto-expand sidebar sections that match the current route
  useEffect(() => {
    if (pathname.startsWith('/admin/restaurants')) {
      setRestaurantsOpen(true)
      const m = pathname.match(/\/admin\/restaurants\/([^/]+)/)
      if (m) setOpenRestaurantId(m[1])
    }
  }, [pathname])

  function close() { setDrawerOpen(false) }

  function tabActive(restaurantId: string, segment: string) {
    const base = `/admin/restaurants/${restaurantId}`
    if (segment === '') return pathname === base
    return pathname.startsWith(base + segment)
  }

  const restaurantsActive = pathname.startsWith('/admin/restaurants')
  const dashboardActive   = pathname === '/admin'
  const telegramActive    = pathname.startsWith('/admin/telegram')

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationProgress />

      {/* ── Mobile top bar ─────────────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-white border-b border-gray-200">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Apri menu"
          className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center text-gray-600"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6"  x2="21" y2="6"  />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-blue-600">
          Digital Menu Pro
        </span>
      </header>

      {/* ── Overlay (mobile) ───────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          onClick={close}
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          aria-hidden
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside
        className={`fixed top-0 left-0 h-full w-60 md:w-52 bg-white border-r border-gray-200 flex flex-col z-50
          transition-transform duration-200 ease-out
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-blue-600">
            Digital Menu Pro
          </div>
          <button
            onClick={close}
            aria-label="Chiudi menu"
            className="md:hidden text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">

          {/* Dashboard */}
          <Link
            href="/admin"
            onClick={close}
            className={`flex items-center px-3 min-h-[44px] text-sm transition-colors ${
              dashboardActive
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Dashboard
          </Link>

          {/* ── Ristoranti (split: text = link, arrow = toggle) ─────────── */}
          <div>
            <div className={`flex items-center min-h-[44px] transition-colors ${
              restaurantsActive ? 'text-blue-700' : 'text-gray-700'
            }`}>
              <Link
                href="/admin/restaurants"
                onClick={close}
                className={`flex-1 flex items-center px-3 h-full text-sm font-[inherit] transition-colors ${
                  restaurantsActive ? 'font-medium' : 'hover:bg-gray-100'
                }`}
              >
                Ristoranti
              </Link>
              <button
                onClick={() => setRestaurantsOpen(o => !o)}
                aria-label={restaurantsOpen ? 'Chiudi ristoranti' : 'Espandi ristoranti'}
                className="flex items-center justify-center w-9 h-full flex-shrink-0 hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className={`transition-transform duration-200 ${restaurantsOpen ? 'rotate-90' : ''}`} />
              </button>
            </div>

            {/* Lista ristoranti */}
            {restaurantsOpen && restaurants.length > 0 && (
              <div className="mt-0.5 space-y-0.5">
                {restaurants.map(r => {
                  const rActive  = pathname.startsWith(`/admin/restaurants/${r.id}`)
                  const rOpen    = openRestaurantId === r.id

                  return (
                    <div key={r.id}>
                      {/* Riga ristorante */}
                      <button
                        onClick={() => setOpenRestaurantId(id => id === r.id ? null : r.id)}
                        className={`w-full flex items-center justify-between pl-5 pr-2 min-h-[38px] text-sm transition-colors ${
                          rActive
                            ? 'text-blue-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate text-left">{r.name}</span>
                        <ChevronRight className={`flex-shrink-0 ml-1 transition-transform duration-200 ${rOpen ? 'rotate-90' : ''}`} />
                      </button>

                      {/* Tab del ristorante */}
                      {rOpen && (
                        <div className="mt-0.5 mb-1">
                          {RESTAURANT_TABS.map(({ label, segment }) => {
                            const href    = `/admin/restaurants/${r.id}${segment}`
                            const active  = tabActive(r.id, segment)
                            return (
                              <Link
                                key={segment}
                                href={href}
                                onClick={close}
                                className={`flex items-center gap-2 pl-8 pr-3 min-h-[34px] text-xs transition-colors ${
                                  active
                                    ? 'text-blue-700 font-semibold bg-blue-50'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                                }`}
                              >
                                <span className={`w-1 h-1 rounded-full flex-shrink-0 ${active ? 'bg-blue-600' : 'bg-gray-300'}`} />
                                {label}
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Telegram */}
          <Link
            href="/admin/telegram"
            onClick={close}
            className={`flex items-center px-3 min-h-[44px] text-sm transition-colors ${
              telegramActive
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Telegram
          </Link>

        </nav>

        <div className="px-5 py-4 border-t border-gray-100">
          <div className="text-[11px] text-gray-400 truncate mb-1.5">{userEmail}</div>
          <LogoutButton />
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="md:ml-52 min-h-screen">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
