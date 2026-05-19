'use client'

import { useRef, useState, useEffect } from 'react'

type Menu = { id: string; name: string }

interface MenuViewerWithShortcutsProps {
  viewerUrl: string
  restaurantName: string
  menus: Menu[]
  categoriesByMenu: Record<string, string[]>
}

export function MenuViewerWithShortcuts({
  viewerUrl,
  restaurantName,
  menus,
  categoriesByMenu,
}: MenuViewerWithShortcutsProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [activeMenu, setActiveMenu] = useState(menus[0]?.id || '')
  const [allCategories, setAllCategories] = useState<string[]>([])

  useEffect(() => {
    if (activeMenu && categoriesByMenu[activeMenu]) {
      setAllCategories(categoriesByMenu[activeMenu])
    }
  }, [activeMenu, categoriesByMenu])

  const handleCategoryClick = (categoryName: string) => {
    if (iframeRef.current?.contentWindow) {
      // Naviga al PDF viewer tramite postMessage
      iframeRef.current.contentWindow.postMessage(
        { action: 'search', query: categoryName },
        '*'
      )
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#525659' }}>
      {/* Barra sticky con shortcut categorie */}
      {allCategories.length > 0 && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: 'rgba(45, 45, 45, 0.95)',
            backdropFilter: 'blur(4px)',
            padding: '10px 16px',
            overflowX: 'auto',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            borderBottom: '1px solid rgba(119, 119, 119, 0.3)',
          }}
        >
          {allCategories.map((category) => (
            <button
              key={category}
              onClick={() => handleCategoryClick(category)}
              style={{
                padding: '8px 14px',
                background: 'linear-gradient(135deg, #5a4a3a 0%, #6b5a4a 100%)',
                color: '#e8dcc8',
                border: '1px solid #8b7355',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #6b5a4a 0%, #7b6a5a 100%)'
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #5a4a3a 0%, #6b5a4a 100%)'
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)'
              }}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* PDF viewer */}
      <div style={{ flex: 1, position: 'relative' }}>
        <iframe
          ref={iframeRef}
          src={viewerUrl + '#toolbar=0&navpanes=0'}
          title={`Menu ${restaurantName}`}
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
          allow="fullscreen"
        />
      </div>
    </div>
  )
}
