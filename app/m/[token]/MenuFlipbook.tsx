'use client'

import { useEffect, useRef, useState, useCallback, memo } from 'react'
import DishModal from './DishModal'

interface Dish {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string
  image_url: string | null
  allergens: number[]
  pairing_dish_id: string | null
  pairing_label: string | null
}

interface Props {
  menuName: string
  restaurantName: string
  items: Dish[]
  /**
   * When provided, PDF.js renders the PDF and turn.js animates it.
   * Dish clickability is driven by link annotations in the PDF —
   * the backend should embed URLs in the form  dish://<dish-uuid>
   * on each dish row, and PDF.js will extract them as hitboxes.
   *
   * When absent, the component falls back to HTML-rendered pages
   * (current mode) with full React interactivity on dish buttons.
   */
  pdfUrl?: string | null
  infoTitle?: string | null
  infoContent?: string | null
  onBack: () => void
}

declare global {
  interface Window { jQuery: any; $: any; pdfjsLib: any }
}

// ── Deduped script loader ─────────────────────────────────────────────────────
const _loaded = new Set<string>()
function requireScript(src: string): Promise<void> {
  if (_loaded.has(src)) return Promise.resolve()
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { _loaded.add(src); res(); return }
    const s = document.createElement('script')
    s.src     = src
    s.onload  = () => { _loaded.add(src); res() }
    s.onerror = () => rej(new Error(`Failed to load: ${src}`))
    document.head.appendChild(s)
  })
}

// ────────────────────────────────────────────────────────────────────────────
// HTML MODE — TurnBook
// ────────────────────────────────────────────────────────────────────────────
// After turn.js calls .turn({...}) it completely restructures the DOM:
// every child div is wrapped, absolutely-positioned and given z-indexes.
// React must never diff those nodes again or it will fight the library.
//
// Solution: memo(() => true) is a permanent render bail-out.
// The outer component passes key={`html-${w}-${h}`} so that a viewport
// resize triggers a full remount — the only way to give turn.js a clean DOM.

interface TurnBookProps {
  dims:           { w: number; h: number }
  catData:        { name: string; items: Dish[] }[]
  restaurantName: string
  menuName:       string
  hasInfo:        boolean
  infoTitle?:     string | null
  infoContent?:   string | null
  onDishClick:    (dish: Dish) => void
  onPageChange:   (page: number, total: number) => void
}

const TurnBook = memo(function TurnBook({
  dims, catData, restaurantName, menuName, hasInfo, infoTitle, infoContent,
  onDishClick, onPageChange,
}: TurnBookProps) {
  const bookRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    const el  = bookRef.current
    if (!el) return

    // jQuery and turn.js are served from /public/ — same origin, no CDN dependency.
    requireScript('/jquery.min.js')
      .then(() => requireScript('/turn.min.js'))
      .then(() => {
        if (!alive || !el || !window.jQuery?.fn?.turn) {
          console.error('[MenuFlipbook] turn.js not available — check /public/turn.min.js')
          return
        }
        const total = el.children.length
        window.$(el).turn({
          width:        dims.w,
          height:       dims.h,
          autoCenter:   false,   // outer flex handles centering
          display:      'single',
          duration:     900,     // ms — slightly slower than the 600ms default
          gradients:    true,
          acceleration: true,
          elevation:    50,      // shadow z-elevation (matches reference repo)
          when: {
            turned(_evt: Event, page: number) {
              onPageChange(page, total)
            },
          },
        })
        onPageChange(1, total)
        console.log('[MenuFlipbook] HTML mode ready', dims, total, 'pages')
      })
      .catch(err => console.error('[MenuFlipbook]', err))

    return () => {
      alive = false
      try { if (el && window.$?.fn?.turn) window.$(el).turn('destroy') } catch (_) {}
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // empty deps: one init per mount; key forces remount on resize

  const pg = 'overflow-hidden'  // turn.js requires overflow:hidden on every page

  return (
    <div ref={bookRef} style={{ width: dims.w, height: dims.h }}>

      {/* 0 — cover left */}
      <div className={`${pg} bg-zinc-800 w-full h-full flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-px h-16 bg-zinc-600 mx-auto mb-4" />
          <p className="text-[9px] uppercase tracking-[0.35em] text-zinc-500">benvenuto</p>
          <div className="w-px h-16 bg-zinc-600 mx-auto mt-4" />
        </div>
      </div>

      {/* 1 — cover right */}
      <div className={`${pg} bg-stone-50 w-full h-full flex flex-col items-center justify-center p-10 text-center`}>
        <div className="text-[10px] uppercase tracking-[0.3em] text-stone-400 mb-3">il nostro menu</div>
        <h1 className="text-2xl font-light text-stone-800 leading-snug">{restaurantName}</h1>
        {menuName !== restaurantName && (
          <p className="mt-2 text-sm text-stone-400 italic">{menuName}</p>
        )}
        {catData.length > 0 && (
          <p className="mt-8 text-xs text-stone-400">
            {catData.length} {catData.length === 1 ? 'categoria' : 'categorie'}&nbsp;·&nbsp;sfoglia per scoprire
          </p>
        )}
        <div className="mt-4 text-[9px] font-mono text-stone-300">1</div>
      </div>

      {/* category page pairs */}
      {catData.flatMap((cat, i) => [

        /* category left — title card */
        <div
          key={`cl-${cat.name}`}
          className={`${pg} w-full h-full flex flex-col`}
          style={{ background: 'linear-gradient(160deg,#18181b 0%,#27272a 100%)' }}
        >
          <div className="flex-1 flex flex-col items-center justify-center px-10 text-center">
            <div className="w-8 h-px bg-zinc-500 mx-auto mb-6" />
            <h2 className="text-xl font-light uppercase tracking-[0.18em] text-white">{cat.name}</h2>
            <p className="mt-3 text-xs text-zinc-500">{cat.items.length} piatti</p>
            <div className="w-8 h-px bg-zinc-500 mx-auto mt-6" />
          </div>
          <div className="pb-3 pr-4 text-[9px] font-mono text-zinc-600 self-end">{(i + 1) * 2}</div>
        </div>,

        /* category right — dish list */
        <div key={`cr-${cat.name}`} className={`${pg} bg-stone-50 w-full h-full flex flex-col`}>
          <div className="px-5 pt-4 pb-2 border-b border-stone-200 shrink-0">
            <h3 className="text-sm font-light uppercase tracking-widest text-stone-600 truncate">{cat.name}</h3>
          </div>
          <ul className="flex-1 overflow-hidden divide-y divide-stone-100 px-5 py-1.5">
            {cat.items.map(dish => (
              <li key={dish.id}>
                <button
                  type="button"
                  onClick={() => onDishClick(dish)}
                  className="w-full text-left py-2.5 group cursor-pointer"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium text-stone-800 group-hover:text-stone-500 group-hover:underline underline-offset-2 transition-colors leading-snug line-clamp-1">
                      {dish.name}
                    </span>
                    {dish.price != null && (
                      <span className="text-[12px] text-stone-500 shrink-0 tabular-nums whitespace-nowrap">
                        €&nbsp;{Number(dish.price).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {dish.description && (
                    <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-1 text-left leading-snug">
                      {dish.description}
                    </p>
                  )}
                  {dish.allergens?.length > 0 && (
                    <span className="text-[9px] text-stone-300 tabular-nums">
                      [{dish.allergens.join(', ')}]
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="px-5 py-1.5 border-t border-stone-200 text-right shrink-0">
            <span className="text-[9px] font-mono text-stone-400">{(i + 1) * 2 + 1}</span>
          </div>
        </div>,
      ])}

      {/* back left — info */}
      <div className={`${pg} bg-stone-100 w-full h-full flex flex-col items-center justify-center p-8 text-center`}>
        {hasInfo ? (
          <>
            <div className="w-6 h-px bg-stone-400 mb-4" />
            <h3 className="text-sm font-semibold uppercase tracking-widest text-stone-700 mb-3">
              {infoTitle ?? 'Informazioni'}
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line max-w-xs overflow-hidden">
              {infoContent}
            </p>
            <div className="w-6 h-px bg-stone-400 mt-4" />
          </>
        ) : (
          <div className="text-xs text-stone-400">—</div>
        )}
      </div>

      {/* back right — thank you */}
      <div className={`${pg} bg-zinc-800 w-full h-full flex flex-col items-center justify-center p-10 text-center`}>
        <div className="w-px h-12 bg-zinc-600 mx-auto mb-4" />
        <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">grazie</p>
        <h2 className="text-xl font-light text-white mt-3">{restaurantName}</h2>
        <div className="w-px h-12 bg-zinc-600 mx-auto mt-4" />
      </div>

    </div>
  )
}, () => true) // permanent bail — turn.js owns this DOM subtree after init


// ────────────────────────────────────────────────────────────────────────────
// PDF MODE — PdfBook
// ────────────────────────────────────────────────────────────────────────────
// Used when pdfUrl is provided. All pages are built imperatively —
// no React VirtualDOM inside the book container — so there is zero
// React/turn.js conflict. Dish hitboxes are created from PDF link annotations
// whose URL follows the convention  dish://<dish-uuid>.

interface PdfBookProps {
  pdfUrl:       string
  dims:         { w: number; h: number }
  items:        Dish[]
  onDishClick:  (dish: Dish) => void
  onPageChange: (page: number, total: number) => void
}

function PdfBook({ pdfUrl, dims, items, onDishClick, onPageChange }: PdfBookProps) {
  const bookRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    const el  = bookRef.current
    if (!el) return

    const PDFJS_VER = '3.11.174'
    const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}`

    Promise.all([
      requireScript(`${PDFJS_CDN}/pdf.min.js`),
      requireScript('/jquery.min.js'),
    ])
      .then(() => requireScript('/turn.min.js'))
      .then(async () => {
        if (!alive || !el) return
        const lib = window.pdfjsLib
        if (!lib) { console.error('[MenuFlipbook] pdfjsLib not on window'); return }
        lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`

        const pdf = await lib.getDocument(pdfUrl).promise
        if (!alive) return

        el.innerHTML = ''  // clear stale pages from previous render
        const numPages = pdf.numPages

        for (let p = 1; p <= numPages; p++) {
          const page     = await pdf.getPage(p)
          if (!alive) return

          const scale    = dims.w / page.getViewport({ scale: 1 }).width
          const viewport = page.getViewport({ scale })

          // render page to canvas
          const canvas    = document.createElement('canvas')
          canvas.width    = Math.round(viewport.width)
          canvas.height   = Math.round(viewport.height)
          canvas.style.cssText = 'display:block;width:100%;height:100%;'
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
          if (!alive) return

          // page wrapper
          const pageDiv = document.createElement('div')
          pageDiv.style.cssText = 'overflow:hidden;background:#fff;position:relative;'
          pageDiv.appendChild(canvas)

          // dish hitboxes from link annotations (url: dish://<id>)
          const annots: any[] = await page.getAnnotations()
          for (const annot of annots) {
            if (annot.subtype !== 'Link' || !annot.url) continue
            const m = annot.url.match(/^dish:\/\/(.+)$/)
            if (!m) continue
            const dish = items.find(d => d.id === m[1])
            if (!dish) continue

            // convertToViewportPoint handles PDF→CSS coordinate flip (Y-axis inversion)
            const [ax1, ay1] = viewport.convertToViewportPoint(annot.rect[0], annot.rect[1])
            const [ax2, ay2] = viewport.convertToViewportPoint(annot.rect[2], annot.rect[3])
            const btn = document.createElement('button')
            btn.style.cssText = [
              'position:absolute',
              `left:${Math.min(ax1,ax2)}px`,
              `top:${Math.min(ay1,ay2)}px`,
              `width:${Math.abs(ax2-ax1)}px`,
              `height:${Math.abs(ay2-ay1)}px`,
              'background:transparent;border:none;cursor:pointer;z-index:2;',
            ].join(';')
            btn.addEventListener('click', () => onDishClick(dish))
            pageDiv.appendChild(btn)
          }

          el.appendChild(pageDiv)
        }

        if (!alive) return
        if (!window.jQuery?.fn?.turn) { console.error('[MenuFlipbook] turn.js not found'); return }

        const total = el.children.length
        window.$(el).turn({
          width:        dims.w,
          height:       dims.h,
          autoCenter:   false,
          display:      'single',
          duration:     900,
          gradients:    true,
          acceleration: true,
          elevation:    50,
          when: {
            turned(_evt: Event, page: number) {
              onPageChange(page, total)
            },
          },
        })
        onPageChange(1, total)
        console.log('[MenuFlipbook] PDF mode ready', dims, total, 'pages')
      })
      .catch(err => console.error('[MenuFlipbook] PDF load error:', err))

    return () => {
      alive = false
      try { if (el && window.$?.fn?.turn) window.$(el).turn('destroy') } catch (_) {}
    }
  }, [pdfUrl, dims.w, dims.h]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={bookRef} style={{ width: dims.w, height: dims.h }} />
}


// ────────────────────────────────────────────────────────────────────────────
// Public component
// ────────────────────────────────────────────────────────────────────────────
export default function MenuFlipbook({
  menuName, restaurantName, items, pdfUrl, infoTitle, infoContent, onBack,
}: Props) {
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null)
  const [dims, setDims]                 = useState<{ w: number; h: number } | null>(null)
  const [currentPage, setCurrentPage]   = useState(1)
  const [totalPages, setTotalPages]     = useState(0)

  const catData = Array.from(new Set(items.map(i => i.category))).map(cat => ({
    name:  cat,
    items: items.filter(i => i.category === cat),
  }))
  const hasInfo = !!(infoContent || infoTitle)

  // stable callbacks — safe to close over in turn.js `when.turned`
  const handleDishClick  = useCallback((dish: Dish) => setSelectedDish(dish), [])
  const handlePageChange = useCallback((page: number, total: number) => {
    setCurrentPage(page); setTotalPages(total)
  }, [])

  // body scroll-lock + pinch-zoom block
  useEffect(() => {
    document.documentElement.classList.add('menu-locked')
    document.body.classList.add('menu-locked')
    return () => {
      document.documentElement.classList.remove('menu-locked')
      document.body.classList.remove('menu-locked')
    }
  }, [])

  // viewport-aware sizing
  // PDF mode uses A4 portrait ratio (210/297); HTML mode uses the menu page ratio
  useEffect(() => {
    const RATIO = pdfUrl ? 210 / 297 : 360 / 520
    const calc  = () => {
      const vw = Math.min(window.innerWidth, 460), vh = window.innerHeight
      const availW = vw - 24, availH = vh - 120
      let w = availW, h = w / RATIO
      if (h > availH) { h = availH; w = h * RATIO }
      setDims({ w: Math.max(240, Math.round(w)), h: Math.max(340, Math.round(h)) })
    }
    calc()
    window.addEventListener('resize', calc)
    window.addEventListener('orientationchange', calc)
    return () => { window.removeEventListener('resize', calc); window.removeEventListener('orientationchange', calc) }
  }, [pdfUrl])

  const atFirst = currentPage <= 1
  const atLast  = totalPages > 0 && currentPage >= totalPages

  return (
    <div className="fixed inset-0 h-[100dvh] bg-zinc-900 flex flex-col items-center overflow-hidden select-none">

      {/* header */}
      <div className="shrink-0 flex items-center gap-4 w-full max-w-4xl px-4 py-3">
        <button onClick={onBack} className="text-xs text-zinc-400 hover:text-white transition-colors">
          ← Torna
        </button>
        <div className="flex-1 text-center min-w-0">
          <p className="text-sm font-light text-white tracking-wide truncate">{restaurantName}</p>
          {menuName !== restaurantName && (
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{menuName}</p>
          )}
        </div>
        <div className="w-10 shrink-0" />
      </div>

      {/* book area */}
      <div className="flex-1 w-full flex items-center justify-center min-h-0">
        {dims && (
          <div style={{ position: 'relative', width: dims.w, height: dims.h }}>

            {pdfUrl ? (
              // PDF mode: imperatively-built pages, no React VirtualDOM inside book
              <PdfBook
                key={`pdf-${dims.w}-${dims.h}`}
                pdfUrl={pdfUrl}
                dims={dims}
                items={items}
                onDishClick={handleDishClick}
                onPageChange={handlePageChange}
              />
            ) : (
              // HTML mode: React JSX pages, memo() prevents post-init reconciliation
              <TurnBook
                key={`html-${dims.w}-${dims.h}`}
                dims={dims}
                catData={catData}
                restaurantName={restaurantName}
                menuName={menuName}
                hasInfo={hasInfo}
                infoTitle={infoTitle}
                infoContent={infoContent}
                onDishClick={handleDishClick}
                onPageChange={handlePageChange}
              />
            )}

            {/* page counter */}
            {totalPages > 0 && !selectedDish && (
              <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-10">
                <span className="text-[9px] text-zinc-600 tabular-nums select-none">
                  {currentPage}&thinsp;/&thinsp;{totalPages}
                </span>
              </div>
            )}

            {/* visual nav hints — turn.js handles tap-on-corners natively */}
            {!selectedDish && (
              <>
                <span className={`pointer-events-none absolute bottom-4 left-3 z-10 text-[11px] uppercase tracking-[0.18em] select-none transition-opacity duration-200 ${atFirst ? 'opacity-0' : 'text-zinc-500'}`}>
                  ‹ prec.
                </span>
                <span className={`pointer-events-none absolute bottom-4 right-3 z-10 text-[11px] uppercase tracking-[0.18em] select-none transition-opacity duration-200 ${atLast ? 'opacity-0' : 'text-zinc-500'}`}>
                  succ. ›
                </span>
              </>
            )}

          </div>
        )}
      </div>

      {/* dish modal — preserved intact */}
      {selectedDish && (
        <DishModal
          item={selectedDish}
          allDishes={items}
          onClose={() => setSelectedDish(null)}
          onOpenDish={dish => setSelectedDish(dish)}
        />
      )}
    </div>
  )
}
