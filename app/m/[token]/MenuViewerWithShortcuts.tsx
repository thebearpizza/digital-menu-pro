'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

type Menu = { id: string; name: string }

interface MenuViewerWithShortcutsProps {
  viewerUrl: string
  restaurantName: string
  menus: Menu[]
  categoriesByMenu: Record<string, string[]>
  pageNumberByCategory: Record<string, number>
  totalPages: number
}

export function MenuViewerWithShortcuts({
  viewerUrl,
  restaurantName,
  menus,
  categoriesByMenu,
  pageNumberByCategory,
  totalPages: initialTotalPages,
}: MenuViewerWithShortcutsProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [activeMenu, setActiveMenu] = useState(menus[0]?.id || '')
  const [allCategories, setAllCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages] = useState(initialTotalPages)
  const lastPageRef = useRef(1)

  // Calcola quale menu è attivo basato sulla pagina corrente
  const updateActiveMenu = useCallback(() => {
    let pageNum = currentPage
    let accumulatedPages = 1

    for (const menu of menus) {
      const categories = categoriesByMenu[menu.id] || []
      const menuPages = 1 + categories.length

      if (pageNum <= accumulatedPages + menuPages) {
        setActiveMenu(menu.id)
        break
      }

      accumulatedPages += menuPages
    }
  }, [currentPage, menus, categoriesByMenu])

  useEffect(() => {
    updateActiveMenu()
  }, [updateActiveMenu])

  useEffect(() => {
    if (activeMenu && categoriesByMenu[activeMenu]) {
      setAllCategories(categoriesByMenu[activeMenu])
    }
  }, [activeMenu, categoriesByMenu])

  const handleCategoryClick = (categoryName: string) => {
    const categoryKey = `${activeMenu}:${categoryName}`
    const pageNum = pageNumberByCategory[categoryKey]

    if (pageNum && iframeRef.current) {
      setCurrentPage(pageNum)
      const currentUrl = iframeRef.current.src
      const baseUrl = currentUrl.split('#')[0]
      iframeRef.current.src = `${baseUrl}#page=${pageNum}`
    }
  }

  const handlePageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(e.target.value)
    setCurrentPage(page)
    if (iframeRef.current) {
      const currentUrl = iframeRef.current.src
      const baseUrl = currentUrl.split('#')[0]
      iframeRef.current.src = `${baseUrl}#page=${page}`
    }
  }

  // Ascolta gli eventi dal PDF viewer per sincronizzare la pagina corrente
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'pagechange') {
        const newPage = event.data.pageNumber || 1
        if (newPage !== lastPageRef.current) {
          lastPageRef.current = newPage
          setCurrentPage(newPage)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#525659' }}>
      {/* Loading spinner */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#525659',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(255, 255, 255, 0.3)',
              borderTop: '3px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Barra sticky con shortcut categorie */}
      {!isLoading && allCategories.length > 0 && (
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
      <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', maxWidth: 'calc(100% - 4px)', margin: '0 2px' }}>
          <iframe
            ref={iframeRef}
            src={viewerUrl + '#zoom=page-width&pagemode=none'}
            title={`Menu ${restaurantName}`}
            style={{ width: '100%', height: '100%', border: 0, display: 'block', opacity: isLoading ? 0 : 1, transition: 'opacity 0.3s ease' }}
            allow="fullscreen"
            onLoad={() => {
              try {
                const iframeDoc = iframeRef.current?.contentDocument
                if (iframeDoc) {
                  const style = iframeDoc.createElement('style')
                  style.textContent = `
                    #toolbarContainer { display: none !important; }
                    #toolbar { display: none !important; }
                    .toolbarButtonOpenFile { display: none !important; }
                    #toolbarSidebar { display: none !important; }
                  `
                  iframeDoc.head.appendChild(style)

                  const script = iframeDoc.createElement('script')
                  script.textContent = `
                    (function() {
                      let lastPage = PDFViewerApplication?.page || 1;
                      const interval = setInterval(() => {
                        const currentPage = PDFViewerApplication?.page || 1;
                        if (currentPage !== lastPage) {
                          lastPage = currentPage;
                          window.parent.postMessage({ type: 'pagechange', pageNumber: currentPage }, '*');
                        }
                      }, 200);
                    })();
                  `
                  iframeDoc.body.appendChild(script)
                }
              } catch (e) {
                // Ignore CORS errors
              }

              setIsLoading(false)
            }}
          />
        </div>
      </div>

      {/* Barra scorrevole pagine */}
      {!isLoading && (
        <div
          style={{
            background: 'rgba(45, 45, 45, 0.95)',
            borderTop: '1px solid rgba(119, 119, 119, 0.3)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ color: '#aaa', fontSize: '12px', minWidth: '40px' }}>
            {currentPage}
          </span>
          <input
            type="range"
            min="1"
            max={totalPages}
            value={currentPage}
            onChange={handlePageChange}
            style={{
              flex: 1,
              height: '4px',
              background: '#555',
              borderRadius: '2px',
              outline: 'none',
              WebkitAppearance: 'slider-horizontal',
              cursor: 'pointer',
            }}
          />
          <span style={{ color: '#aaa', fontSize: '12px', minWidth: '40px', textAlign: 'right' }}>
            {totalPages}
          </span>
        </div>
      )}
    </div>
  )
}
