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
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: '#2d2d2d',
          borderBottom: '1px solid #444',
          padding: '8px 12px',
          overflowX: 'auto',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#aaa', fontSize: '12px', whiteSpace: 'nowrap', marginRight: '8px' }}>
          Categorie:
        </span>
        {allCategories.map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryClick(category)}
            style={{
              padding: '6px 12px',
              background: '#555',
              color: '#fff',
              border: '1px solid #777',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              whiteSpace: 'nowrap',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#777')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#555')}
          >
            {category}
          </button>
        ))}
      </div>

      {/* PDF viewer */}
      <div style={{ flex: 1, position: 'relative' }}>
        <iframe
          ref={iframeRef}
          src={viewerUrl}
          title={`Menu ${restaurantName}`}
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
          allow="fullscreen"
        />
      </div>
    </div>
  )
}
