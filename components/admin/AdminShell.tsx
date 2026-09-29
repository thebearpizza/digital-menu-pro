'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '@/components/admin/LogoutButton'
import NavigationProgress from '@/components/admin/NavigationProgress'

type IconName = 'home' | 'book' | 'send' | 'users' | 'user'

function Icon({ name }: { name: IconName }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'home':
      return <svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></svg>
    case 'book':
      // Menu chiuso: copertina con "Menù", costa, bordo pagine e nastrino segnapagina.
      return (
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 2.5h11a1.5 1.5 0 0 1 1.5 1.5v14.5H6.5A1.5 1.5 0 0 1 5 17V4a1.5 1.5 0 0 1 1.5-1.5z" />
          <path d="M8 2.5v16" />
          <path d="M5 17a1.5 1.5 0 0 0 1.5 1.5H19v2H6.5A1.5 1.5 0 0 1 5 19" />
          <path d="M15 18.5v4.5l1.1-.9 1.1.9v-4.5" />
          <text x="13.5" y="11.6" textAnchor="middle" fontSize="4.1" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Georgia, 'Times New Roman', serif" letterSpacing=".1">Menù</text>
        </svg>
      )
    case 'send':
      return <svg {...common}><path d="M21 3 10 14" /><path d="M21 3 14.5 21l-4.5-7-7-4.5z" /></svg>
    case 'users':
      return <svg {...common}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></svg>
    case 'user':
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
  }
}

interface DockItem {
  key: string
  label: string
  icon: IconName
  href?: string
  active: boolean
  popover?: 'account'
}

export default function AdminShell({
  userEmail,
  children,
  isSuperAdmin = false,
  dockAccessory,
}: {
  userEmail:   string
  children:    React.ReactNode
  // Pillola separata accanto al dock (es. assistente vocale).
  dockAccessory?: React.ReactNode
  // Solo l'account padre vede la tab "Utenti". È una scelta di interfaccia,
  // NON una misura di sicurezza: la protezione vera sta nella pagina e in
  // ogni server action (vedi app/admin/users/).
  isSuperAdmin?: boolean
}) {
  const pathname = usePathname()
  const [popover, setPopover] = useState<'account' | null>(null)
  const dockRef  = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<string, HTMLElement | null>>({})
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)

  // Tema avorio/oro su tutta la pagina (anche finestre montate fuori dallo shell).
  useEffect(() => {
    document.documentElement.classList.add('lito-admin')
    return () => document.documentElement.classList.remove('lito-admin')
  }, [])

  useEffect(() => { setPopover(null) }, [pathname])

  // Con una finestra aperta (overlay .fixed.inset-0) il dock scende e libera i bottoni.
  const [modalOpen, setModalOpen] = useState(false)
  useEffect(() => {
    const check = () => setModalOpen(!!document.querySelector('.fixed.inset-0'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!popover) return
    const onDown = (e: PointerEvent) => {
      if (!dockRef.current?.parentElement?.contains(e.target as Node)) setPopover(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPopover(null) }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [popover])

  const items: DockItem[] = [
    { key: 'dashboard',   label: 'Dashboard', icon: 'home', href: '/admin', active: pathname === '/admin' },
    { key: 'restaurants', label: 'Ristoranti', icon: 'book', href: '/admin/restaurants', active: pathname.startsWith('/admin/restaurants') },
    { key: 'telegram',    label: 'Telegram',  icon: 'send', href: '/admin/telegram', active: pathname.startsWith('/admin/telegram') },
    ...(isSuperAdmin
      ? [{ key: 'users', label: 'Utenti', icon: 'users' as const, href: '/admin/users', active: pathname.startsWith('/admin/users') }]
      : []),
    { key: 'account',     label: 'Account',   icon: 'user', active: false, popover: 'account' },
  ]
  const activeKey = (popover && items.find(i => i.popover === popover)?.key) ?? items.find(i => i.active)?.key

  useLayoutEffect(() => {
    const measure = () => {
      const el = activeKey ? itemRefs.current[activeKey] : null
      const dock = dockRef.current
      if (!el || !dock) { setPill(null); return }
      setPill({ left: el.offsetLeft, width: el.offsetWidth })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [activeKey, items.length])

  return (
    <div className="min-h-screen">
      <NavigationProgress />

      <main className="min-h-screen pb-36">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* ── Dock ──────────────────────────────────────────────────────── */}
      <div className={`lito-dock-wrap${modalOpen ? ' is-hidden' : ''}`} aria-hidden={modalOpen || undefined}>
        <div className="lito-dock-main">
        {popover === 'account' && (
          <div className="lito-dock-pop lito-dock-pop-right" role="dialog" aria-label="Account">
            <div className="px-3 pt-1 pb-2 text-[11px] text-gray-500 truncate">{userEmail}</div>
            <div className="lito-dock-pop-sep" />
            <div className="px-3 py-2"><LogoutButton /></div>
          </div>
        )}

        <nav ref={dockRef} className="lito-dock" aria-label="Navigazione">
          {pill && <span className="lito-dock-pill" style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} aria-hidden />}
          {items.map(item => {
            const isActive = item.key === activeKey
            const content = (
              <>
                <span className="lito-dock-icon"><Icon name={item.icon} /></span>
                <span className="lito-dock-label">{item.label}</span>
              </>
            )
            const cls = `lito-dock-item${isActive ? ' is-active' : ''}`
            const setRef = (el: HTMLElement | null) => { itemRefs.current[item.key] = el }
            return item.href ? (
              <Link key={item.key} ref={setRef} href={item.href} className={cls} aria-current={isActive ? 'page' : undefined}>
                {content}
              </Link>
            ) : (
              <button
                key={item.key}
                ref={setRef}
                type="button"
                className={cls}
                aria-expanded={popover === item.popover}
                onClick={() => setPopover(p => (p === item.popover ? null : item.popover!))}
              >
                {content}
              </button>
            )
          })}
        </nav>
        </div>
        {dockAccessory}
      </div>
    </div>
  )
}
