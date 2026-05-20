'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { DishCard } from './DishCard'
import { ALLERGENS_EU } from '@/lib/allergens'

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

interface DishPosition {
  id: string
  pageNumber: number
  yTopPercent: number
  yBottomPercent: number
}

interface MenuViewerWithShortcutsProps {
  viewerUrl: string
  restaurantName: string
  menus: Menu[]
  categoriesByMenu: Record<string, string[]>
  pageNumberByCategory: Record<string, number>
  totalPages: number
  dishesInfo: Record<string, DishInfo>
  dishPositions: DishPosition[]
}

export function MenuViewerWithShortcuts({
  viewerUrl,
  restaurantName,
  menus,
  categoriesByMenu,
  pageNumberByCategory,
  totalPages: initialTotalPages,
  dishesInfo,
  dishPositions,
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
      } else if (event.data.type === 'dishClick') {
        // Click su una link annotation 'dish:<id>' intercettato dall'iframe.
        setSelectedDishId(event.data.dishId)
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
        /* Link annotation invisibili ma cliccabili (sono le hit-area sui piatti) */
        .linkAnnotation, .linkAnnotation a, .annotationLayer .linkAnnotation > a {
          border: none !important;
          background: transparent !important;
          -webkit-tap-highlight-color: transparent !important;
        }
      `
      iframeDoc.head.appendChild(style)

      // Inietta script che ascolta eventi di PDF.js DIRETTAMENTE (no polling).
      // Le hit-area cliccabili dei piatti sono div HTML iniettati DENTRO l'elemento
      // .page di PDF.js: questa div ha la dimensione esatta della pagina PDF, quindi
      // le percentuali in dishPositions corrispondono alla posizione reale dei piatti.
      const dishPositionsJson = JSON.stringify(dishPositions)
      const script = iframeDoc.createElement('script')
      script.textContent = `
        (function() {
          var DISH_POSITIONS = ${dishPositionsJson};
          // Indicizza per pageNumber per lookup veloce
          var byPage = {};
          for (var i = 0; i < DISH_POSITIONS.length; i++) {
            var dp = DISH_POSITIONS[i];
            if (!byPage[dp.pageNumber]) byPage[dp.pageNumber] = [];
            byPage[dp.pageNumber].push(dp);
          }

          function addOverlaysToPage(pageEl, pageNumber) {
            if (!pageEl) return;
            var dishes = byPage[pageNumber];
            if (!dishes || dishes.length === 0) return;

            // Evita doppi inserimenti se pagerendered viene rifirato
            var existing = pageEl.querySelectorAll('.dish-hit-area');
            for (var k = 0; k < existing.length; k++) existing[k].remove();

            // Assicura position:relative sulla .page (è già impostato da PDF.js)
            for (var j = 0; j < dishes.length; j++) {
              var d = dishes[j];
              var overlay = document.createElement('div');
              overlay.className = 'dish-hit-area';
              overlay.setAttribute('data-dish-id', d.id);
              overlay.style.position = 'absolute';
              overlay.style.left = '0';
              overlay.style.right = '0';
              overlay.style.top = (d.yTopPercent * 100) + '%';
              overlay.style.height = ((d.yBottomPercent - d.yTopPercent) * 100) + '%';
              overlay.style.cursor = 'pointer';
              overlay.style.zIndex = '50';
              overlay.style.background = 'transparent';
              overlay.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var id = this.getAttribute('data-dish-id');
                window.parent.postMessage({ type: 'dishClick', dishId: id }, '*');
              });
              pageEl.appendChild(overlay);
            }
          }

          function attachListeners() {
            if (!window.PDFViewerApplication || !window.PDFViewerApplication.eventBus) {
              setTimeout(attachListeners, 50);
              return;
            }

            var eventBus = window.PDFViewerApplication.eventBus;

            // pagechanging: sparato all'INIZIO del cambio pagina (istantaneo)
            eventBus.on('pagechanging', function(evt) {
              window.parent.postMessage({
                type: 'pagechanging',
                pageNumber: evt.pageNumber
              }, '*');
            });

            // pagesloaded: tutte le pagine sono pronte
            eventBus.on('pagesloaded', function() {
              window.parent.postMessage({ type: 'pagesloaded' }, '*');
            });

            // pagerendered: ogni volta che una pagina è renderizzata,
            // aggiungiamo gli overlay cliccabili sui piatti di quella pagina.
            eventBus.on('pagerendered', function(evt) {
              var pageNumber = evt.pageNumber;
              var pageEl = document.querySelector('.pdfViewer .page[data-page-number="' + pageNumber + '"]');
              if (!pageEl) {
                // Fallback: prendi tutte le .page e scegli per indice
                var allPages = document.querySelectorAll('.pdfViewer .page');
                pageEl = allPages[pageNumber - 1];
              }
              addOverlaysToPage(pageEl, pageNumber);
            });

            // Ascolta i messaggi dal parent per jump senza animazione
            window.addEventListener('message', function(event) {
              if (event.data && event.data.type === 'jumpToPage') {
                var targetPage = event.data.page;

                // Salta l'animazione di turn.js temporaneamente
                if (window.$ && window.$('#viewer').data('turn')) {
                  var turnInstance = window.$('#viewer').data('turn');
                  var originalDuration = turnInstance.opts.duration;
                  turnInstance.opts.duration = 0;
                  window.PDFViewerApplication.page = targetPage;
                  setTimeout(function() {
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
              // Aggiungi overlay alle pagine già renderizzate
              var renderedPages = document.querySelectorAll('.pdfViewer .page[data-loaded="true"]');
              for (var p = 0; p < renderedPages.length; p++) {
                var pn = parseInt(renderedPages[p].getAttribute('data-page-number'), 10);
                if (pn) addOverlaysToPage(renderedPages[p], pn);
              }
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

            {/* Angolo in alto a sinistra — blocca turn.js sul corner */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '30%', height: '30%', zIndex: 5 }} />
            {/* Angolo in alto a destra — blocca turn.js sul corner */}
            <div style={{ position: 'absolute', top: 0, right: 0, width: '30%', height: '30%', zIndex: 5 }} />
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
