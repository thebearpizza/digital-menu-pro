'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '@/components/admin/LogoutButton'

const NAV = [
  { href: '/admin',             label: 'Dashboard',  exact: true },
  { href: '/admin/restaurants', label: 'Ristoranti', exact: false },
  { href: '/admin/telegram',    label: 'Telegram',   exact: false },
]

export default function AdminShell({
  userEmail,
  children,
}: {
  userEmail: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Mobile top bar (hamburger) — visibile solo < md ───────────── */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-white border-b border-gray-200">
        <button
          onClick={() => setOpen(true)}
          aria-label="Apri menu"
          className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center text-gray-600"
        >
          {/* hamburger icon */}
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

      {/* ── Overlay scuro (solo mobile, quando il drawer è aperto) ─────── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          aria-hidden
        />
      )}

      {/* ── Sidebar / Drawer ──────────────────────────────────────────── */}
      <aside
        className={`fixed top-0 left-0 h-full w-60 md:w-52 bg-white border-r border-gray-200 flex flex-col z-50
          transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-blue-600">
            Digital Menu Pro
          </div>
          {/* Close (solo mobile) */}
          <button
            onClick={() => setOpen(false)}
            aria-label="Chiudi menu"
            className="md:hidden text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center px-3 min-h-[44px] text-sm transition-colors ${
                isActive(item.href, item.exact)
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-gray-100">
          <div className="text-[11px] text-gray-400 truncate mb-1.5">{userEmail}</div>
          <LogoutButton />
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main className="md:ml-52 min-h-screen">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
