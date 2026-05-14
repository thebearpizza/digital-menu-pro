import dynamic from 'next/dynamic'

const MenuBookClient = dynamic(() => import('./viewer/MenuBookClient'), { ssr: false })

export default function MenuViewerPage() {
  return (
    <div data-debug-route='MENU_ROUTE_OK' style={{ minHeight: '100vh' }}>
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 99999, background: '#111', color: '#fff', padding: '8px 12px', borderRadius: 12 }}>
        ROUTE FILE ATTIVA
      </div>
      <MenuBookClient />
    </div>
  )
}
