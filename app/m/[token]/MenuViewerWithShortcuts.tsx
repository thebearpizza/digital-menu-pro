'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { DishCard } from './DishCard'
import { ALLERGENS_EU } from '@/lib/allergens'
import type { DishPosition } from '@/lib/pdf/generateMenuPdf'

type Menu = { id: string; name: string }

interface DishInfo {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string | null
  image_url: string | null
  allergens: string[] | null
}

interface MenuViewerWithShortcutsProps {
  viewerUrl: string
  restaurantName: string
  menus: Menu[]
  categoriesByMenu: Record<string, string[]>
  pageNumberByCategory: Record<string, number>
  totalPages: number
  dishPositions: DishPosition[]
  dishesInfo: Record<string, DishInfo>
}

export function MenuViewerWithShortcuts({
  viewerUrl,
  restaurantName,
  menus,
  categoriesByMenu,
  pageNumberByCategory,
  totalPages: initialTotalPages,
  dishPositions,
  dishesInfo,
}: MenuViewerWithShortcutsProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages] = useState(initialTotalPages)
  const [selectedDishId, setSelectedDishId] = useState<string | null>(null)

  // Derivato direttamente da currentPage: evita catene di setState+useEffect.
  const activeMenu = useMemo(() => {
    let accumulatedPages = 1
    for (const menu of menus) {
      const menuPages = 1 + (categoriesByMenu[menu.id]?.length ?? 0)
      if (currentPage <= accumulatedPages + menuPages) return menu.id
      accumulatedPages += menuPages
    }
    return menus[0]?.id || ''
  }, [currentPage, menus, categoriesByMenu])

  const allCategories = useMemo(
    () => categoriesByMenu[activeMenu] ?? [],
    [activeMenu, categoriesByMenu]
  )

  const navigateToPage = useCallback((page: number) => {
    // Aggiorna lo stato IMMEDIATAMENTE per istantaneo feedback UI
    setCurrentPage(page)

    // Naviga nel PDF saltando l'animazione di turn.js
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'jumpToPage', page }, '*')
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

      // Nasconde la toolbar e centra il PDF
      const style = iframeDoc.createElement('style')
      style.textContent = `
        #toolbarContainer { display: none !important; }
        #toolbar { display: none !important; }
        #toolbarSidebar { display: none !important; }
        #secondaryToolbar { display: none !important; }
        .toolbarButtonOpenFile { display: none !important; }
        #viewerContainer { top: 0 !important; left: 0 !important; right: 0 !important; }
        #viewer { margin: 0 auto !important; }
        #viewer.bookViewer { margin: 0 auto !important; position: relative !important; left: 0 !important; right: 0 !important; }
        .pdfViewer { display: flex !important; flex-direction: column !important; align-items: center !important; }
        .pdfViewer .page { margin: 0 auto !important; }
        body { background: #525659 !important; }
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

            // Ascolta i messaggi dal parent per jump senza animazione
            window.addEventListener('message', (event) => {
              if (event.data && event.data.type === 'jumpToPage') {
                const targetPage = event.data.page;

                // Salta l'animazione di turn.js temporaneamente
                if (window.$ && window.$('#viewer').data('turn')) {
                  const turnInstance = window.$('#viewer').data('turn');
                  const originalDuration = turnInstance.opts.duration;
                  turnInstance.opts.duration = 0;
                  window.PDFViewerApplication.page = targetPage;
                  setTimeout(() => {
                    if (turnInstance.opts) turnInstance.opts.duration = originalDuration;
                  }, 50);
                } else {
                  window.PDFViewerApplication.page = targetPage;
                }
              }
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

  // Overlay hit-box invisibili sopra i piatti (solo sulla pagina corrente).
  // Memo per evitare filter() ad ogni re-render su pagine senza piatti che cambiano.
  const dishesOnCurrentPage = useMemo(
    () => dishPositions.filter((pos) => pos.pageNumber === currentPage),
    [dishPositions, currentPage]
  )

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#525659' }}
    >
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
      {allCategories.length > 0 && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: 'rgba(45, 45, 45, 0.95)',
            backdropFilter: 'blur(4px)',
            padding: '12px 16px',
            overflowX: 'auto',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            borderBottom: '1px solid rgba(119, 119, 119, 0.3)',
          }}
        >
          {allCategories.map((category) => {
            const categoryKey = `${activeMenu}:${category}`
            const categoryPageNum = pageNumberByCategory[categoryKey]
            const isActive = categoryPageNum === currentPage

            return (
              <button
                key={category}
                onClick={() => handleCategoryClick(category)}
                style={{
                  padding: '8px 14px',
                  background: isActive
                    ? 'linear-gradient(135deg, #8b6f47 0%, #a0825c 100%)'
                    : 'linear-gradient(135deg, #5a4a3a 0%, #6b5a4a 100%)',
                  color: isActive ? '#fff' : '#e8dcc8',
                  border: isActive ? '1px solid #c9a961' : '1px solid #8b7355',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: isActive ? '600' : '500',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive
                    ? '0 0 12px rgba(201, 169, 97, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3)'
                    : '0 2px 4px rgba(0, 0, 0, 0.2)',
                }}
              >
                {category}
              </button>
            )
          })}
        </div>
      )}

      {/* PDF viewer + Slider container */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
        {/* PDF viewer container con overlay hit-box */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', overflow: 'hidden' }} role="main">
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

            {/* Corner blocks: disabilita il tap di turn.js sui due angoli SUPERIORI
                (mantiene solo i corner inferiori per girare pagina).
                WebkitTapHighlightColor: rimuove il flash grigio iOS al tap. */}
            <div
              onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
              style={{
                position: 'absolute', top: 0, left: 0, width: '25%', height: '12%',
                zIndex: 5, cursor: 'default',
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none',
              }}
            />
            <div
              onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
              style={{
                position: 'absolute', top: 0, right: 0, width: '25%', height: '12%',
                zIndex: 5, cursor: 'default',
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none',
              }}
            />

            {/* Overlay hit-box invisibili sopra i piatti.
                Larghezza: tutta la pagina (no banda morta laterale per il turn). */}
            {dishesOnCurrentPage.map((pos) => {
              const dish = dishesInfo[pos.id]
              if (!dish) return null

              const yTop = pos.yTopPercent * 100
              const yBottom = pos.yBottomPercent * 100
              const height = yBottom - yTop

              return (
                <button
                  key={pos.id}
                  onClick={() => setSelectedDishId(pos.id)}
                  style={{
                    position: 'absolute',
                    top: `${yTop}%`,
                    left: '0',
                    right: '0',
                    height: `${height}%`,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    zIndex: 10,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  aria-label={`View details for ${dish.name}`}
                />
              )
            })}
          </div>
        </div>

        {/* Barra scorrevole pagine - modernizzata */}
        {!isLoading && (
          <div
            style={{
              background: 'rgba(45, 45, 45, 0.95)',
              borderTop: '1px solid rgba(119, 119, 119, 0.3)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span style={{ color: '#999', fontSize: '11px', minWidth: '32px', fontWeight: '500' }}>
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
                height: '5px',
                background: 'linear-gradient(to right, #555 0%, #666 50%, #555 100%)',
                borderRadius: '3px',
                outline: 'none',
                WebkitAppearance: 'none',
                appearance: 'none',
                cursor: 'pointer',
                WebkitSliderThumb: {
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #c9a961 0%, #d4b896 100%)',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(201, 169, 97, 0.5)',
                  border: 'none',
                },
              } as any}
            />
            <style>{`
              input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: linear-gradient(135deg, #c9a961 0%, #d4b896 100%);
                cursor: pointer;
                box-shadow: 0 2px 6px rgba(201, 169, 97, 0.5);
                border: none;
                transition: all 0.2s ease;
              }
              input[type="range"]::-webkit-slider-thumb:hover {
                transform: scale(1.2);
                box-shadow: 0 0 12px rgba(201, 169, 97, 0.7);
              }
              input[type="range"]::-moz-range-thumb {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: linear-gradient(135deg, #c9a961 0%, #d4b896 100%);
                cursor: pointer;
                box-shadow: 0 2px 6px rgba(201, 169, 97, 0.5);
                border: none;
                transition: all 0.2s ease;
              }
              input[type="range"]::-moz-range-thumb:hover {
                transform: scale(1.2);
                box-shadow: 0 0 12px rgba(201, 169, 97, 0.7);
              }
            `}</style>
            <span style={{ color: '#999', fontSize: '11px', minWidth: '32px', textAlign: 'right', fontWeight: '500' }}>
              {totalPages}
            </span>
          </div>
        )}
      </div>

      {/* Card di dettaglio piatto - espansione inline */}
      {selectedDishId && dishesInfo[selectedDishId] && (
        <DishCard dish={dishesInfo[selectedDishId]} allergensList={ALLERGENS_EU} onClose={() => setSelectedDishId(null)} />
      )}
    </div>
  )
}
