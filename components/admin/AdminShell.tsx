'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NavigationProgress from '@/components/admin/NavigationProgress'
import { AllergenCatalogProvider } from '@/components/AllergenCatalog'
import LitoMark from '@/components/LitoMark'
import type { AllergenCatalog } from '@/lib/allergens'

type IconName = 'home' | 'book' | 'eye' | 'gear'

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
    case 'eye':
      return <svg {...common}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
    case 'gear':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      )
  }
}

interface DockItem {
  key: string
  label: string
  icon: IconName
  href?: string
  external?: boolean
  active: boolean
  popover?: 'preview'
}

export interface PreviewMenu { name: string; token: string }

export default function AdminShell({
  children,
  dockAccessory,
  previewMenus = [],
  allergenCatalog = null,
}: {
  children:    React.ReactNode
  // Pillola separata accanto al dock (es. assistente IA).
  dockAccessory?: React.ReactNode
  // Menu pubblici apribili dal tasto "Anteprima" del dock.
  previewMenus?: PreviewMenu[]
  // Allergeni personalizzati dell'account (nomi/numeri).
  allergenCatalog?: AllergenCatalog
}) {
  const pathname = usePathname()
  const [popover, setPopover] = useState<'preview' | null>(null)
  const dockRef  = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<string, HTMLElement | null>>({})
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)

  // Tema avorio/oro su tutta la pagina (anche finestre montate fuori dallo shell).
  useEffect(() => {
    document.documentElement.classList.add('lito-admin')
    return () => document.documentElement.classList.remove('lito-admin')
  }, [])

  useEffect(() => { setPopover(null) }, [pathname])

  // Apertura anteprima: la pagina del menu impiega un attimo ad arrivare dal
  // server; nel frattempo mostriamo subito la L in loop come negli altri caricamenti.
  const [openingPreview, setOpeningPreview] = useState(false)
  // Safari smette di ridisegnare la pagina appena parte la navigazione: prima
  // mostriamo la L, poi (dopo due frame) navighiamo.
  function openPreview(e: React.MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    const href = e.currentTarget.href
    setPopover(null)
    setOpeningPreview(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => { window.location.href = href }, 60)))
  }
  useEffect(() => {
    // Tornando indietro (cache del browser) la pagina viene ripristinata così com'era.
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setOpeningPreview(false) }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

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

  const singlePreview = previewMenus.length === 1 ? previewMenus[0] : null
  const items: DockItem[] = [
    { key: 'dashboard',   label: 'Dashboard',  icon: 'home', href: '/admin', active: pathname === '/admin' },
    { key: 'restaurants', label: 'Ristoranti', icon: 'book', href: '/admin/restaurants', active: pathname.startsWith('/admin/restaurants') },
    singlePreview
      ? { key: 'preview', label: 'Anteprima', icon: 'eye', href: `/m/${singlePreview.token}?from=admin`, external: true, active: false }
      : { key: 'preview', label: 'Anteprima', icon: 'eye', active: false, popover: 'preview' },
    { key: 'settings',    label: 'Impostazioni', icon: 'gear', href: '/admin/settings',
      active: ['/admin/settings', '/admin/telegram', '/admin/users'].some(p => pathname.startsWith(p)) },
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
          <AllergenCatalogProvider catalog={allergenCatalog}>
            {children}
          </AllergenCatalogProvider>
        </div>
      </main>

      {openingPreview && (
        // L intera e ferma, senza dissolvenza: Safari smette di ridisegnare
        // appena parte la navigazione, un'animazione resterebbe al primo fotogramma.
        <div className="lito-nav-loading" style={{ animation: 'none' }} role="status" aria-label="Apertura anteprima">
          <LitoMark progress={1} className="w-20 h-20" />
        </div>
      )}

      {/* ── Dock ──────────────────────────────────────────────────────── */}
      <div className={`lito-dock-wrap${modalOpen ? ' is-hidden' : ''}`} aria-hidden={modalOpen || undefined}>
        <div className="lito-dock-main">
        {popover === 'preview' && (
          <div className="lito-dock-pop" role="dialog" aria-label="Anteprima menu">
            {previewMenus.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">Nessun ristorante ancora.</div>
            ) : previewMenus.map(m => (
              <a key={m.token} href={`/m/${m.token}?from=admin`} className="lito-dock-pop-row" onClick={openPreview}>
                <span className="truncate">{m.name}</span>
              </a>
            ))}
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
            if (item.href && item.external) {
              return (
                <a key={item.key} ref={setRef} href={item.href} className={cls} onClick={openPreview}>
                  {content}
                </a>
              )
            }
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
