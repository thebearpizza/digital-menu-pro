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

  // Calcola il menu attivo basato sulla pagina corrente
  const updateActiveMenu = useCallback((page: number) => {
    let accumulatedPages = 1 // Pagina 1 = scelta menu

    for (const menu of menus) {
      const categories = categoriesByMenu[menu.id] || []
      const menuPages = 1 + categories.length // Copertina + categorie

      if (page <= accumulatedPages + menuPages) {
        setActiveMenu(menu.id)
        return
      }
      accumulatedPages += menuPages
    }
  }, [menus, categoriesByMenu])

  // Aggiorna categorie quando cambia activeMenu
  useEffect(() => {
    if (activeMenu && categoriesByMenu[activeMenu]) {
      setAllCategories(categoriesByMenu[activeMenu])
    }
  }, [activeMenu, categoriesByMenu])

  // Aggiorna activeMenu quando cambia currentPage
  useEffect(() => {
    updateActiveMenu(currentPage)
  }, [currentPage, updateActiveMenu])

  const navigateToPage = useCallback((page: number) => {
    // Aggiorna lo stato IMMEDIATAMENTE per istantaneo feedback UI
    setCurrentPage(page)

    // Poi naviga nel PDF
    if (iframeRef.current) {
      const win = iframeRef.current.contentWindow as any
      if (win?.PDFViewerApplication) {
        win.PDFViewerApplication.page = page
      } else {
        const baseUrl = iframeRef.current.src.split('#')[0]
        iframeRef.current.src = `${baseUrl}#page=${page}`
      }
    }
  }, [])

  const handleCategoryClick = (categoryName: string) => {
    const categoryKey = `${activeMenu}:${categoryName}`
    const pageNum = pageNumberByCategory[categoryKey]
    if (pageNum) navigateToPage(pageNum)
  }

  const handlePageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    navigateToPage(parseInt(e.target.value))
  }

  // Ascolta gli eventi dal PDF viewer
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return

      if (event.data.type === 'pagechanging') {
        // pagechanging è sparato all'INIZIO del cambio, non alla fine
        setCurrentPage(event.data.pageNumber)
      } else if (event.data.type === 'pagesloaded') {
        // PDF.js ha finito di caricare le pagine
        setIsLoading(false)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleIframeLoad = () => {
    try {
      const iframeDoc = iframeRef.current?.contentDocument
      const iframeWin = iframeRef.current?.contentWindow as any
      if (!iframeDoc || !iframeWin) return

      // Nasconde la toolbar
      const style = iframeDoc.createElement('style')
      style.textContent = `
        #toolbarContainer { display: none !important; }
        #toolbar { display: none !important; }
        #toolbarSidebar { display: none !important; }
        #secondaryToolbar { display: none !important; }
        .toolbarButtonOpenFile { display: none !important; }
      `
      iframeDoc.head.appendChild(style)

      // Inietta script che ascolta eventi di PDF.js DIRETTAMENTE (no polling)
      const script = iframeDoc.createElement('script')
      script.textContent = `
        (function() {
          function attachListeners() {
            if (!window.PDFViewerApplication || !window.PDFViewerApplication.eventBus) {
              setTimeout(attachListeners, 50);
              return;
            }

            const eventBus = window.PDFViewerApplication.eventBus;

            // pagechanging: sparato all'INIZIO del cambio pagina (istantaneo)
            eventBus.on('pagechanging', (evt) => {
              window.parent.postMessage({
                type: 'pagechanging',
                pageNumber: evt.pageNumber
              }, '*');
            });

            // pagesloaded: tutte le pagine sono pronte
            eventBus.on('pagesloaded', () => {
              window.parent.postMessage({ type: 'pagesloaded' }, '*');
            });

            // Se le pagine sono già caricate
            if (window.PDFViewerApplication.pdfDocument) {
              window.parent.postMessage({ type: 'pagesloaded' }, '*');
            }
          }
          attachListeners();
        })();
      `
      iframeDoc.body.appendChild(script)
    } catch (e) {
      // CORS error - fallback: nascondi loading dopo 2s
      setTimeout(() => setIsLoading(false), 2000)
    }
  }

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
            style={{
              width: '100%',
              height: '100%',
              border: 0,
              display: 'block',
              opacity: isLoading ? 0 : 1,
              transition: 'opacity 0.3s ease',
            }}
            allow="fullscreen"
            onLoad={handleIframeLoad}
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
