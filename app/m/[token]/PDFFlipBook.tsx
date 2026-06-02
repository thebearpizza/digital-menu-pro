'use client'

import { useEffect, useRef, useState } from 'react'

// ── Script loader — deduped across all imports in the same page ───────────────
const _loaded = new Set<string>()
function requireScript(src: string): Promise<void> {
  if (_loaded.has(src)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      _loaded.add(src)
      resolve()
      return
    }
    const s = document.createElement('script')
    s.src     = src
    s.onload  = () => { _loaded.add(src); resolve() }
    s.onerror = () => reject(new Error(`Failed to load: ${src}`))
    document.head.appendChild(s)
  })
}

declare global {
  interface Window { jQuery: any; $: any; pdfjsLib: any }
}

const PDFJS_CDN    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

function computeDims(): { w: number; h: number } {
  const A4 = 210 / 297
  const availW = window.innerWidth  - 24
  const availH = window.innerHeight - 120
  let w = Math.min(availW, Math.floor(availH * A4))
  let h = Math.floor(w / A4)
  if (h > availH) { h = availH; w = Math.floor(h * A4) }
  return { w: Math.max(220, w), h: Math.max(310, h) }
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  pdfUrl:          string
  restaurantName?: string
  menuName?:       string
  onBack:          () => void
}

export default function PDFFlipBook({ pdfUrl, restaurantName, menuName, onBack }: Props) {
  const bookRef = useRef<HTMLDivElement>(null)
  const [dims,        setDims]        = useState<{ w: number; h: number } | null>(null)
  const [phase,       setPhase]       = useState<'loading' | 'ready' | 'error'>('loading')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages,  setTotalPages]  = useState(0)

  // Scroll-lock
  useEffect(() => {
    document.documentElement.classList.add('menu-locked')
    document.body.classList.add('menu-locked')
    return () => {
      document.documentElement.classList.remove('menu-locked')
      document.body.classList.remove('menu-locked')
    }
  }, [])

  // Viewport sizing + resize
  useEffect(() => {
    setDims(computeDims())
    const onResize = () => setDims(computeDims())
    window.addEventListener('resize',            onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize',            onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  // PDF load + turn.js init
  useEffect(() => {
    if (!dims) return
    const el = bookRef.current
    if (!el)  return

    let cancelled = false
    setPhase('loading')

    ;(async () => {
      try {
        // Load deps in order: jQuery → turn.js (requires jQuery) → PDF.js (independent)
        await requireScript('/jquery.min.js')
        await requireScript('/turn.min.js')
        await requireScript(PDFJS_CDN)
        if (cancelled) return

        const lib = window.pdfjsLib
        if (!lib) throw new Error('pdfjsLib not on window after script load')
        lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER

        const pdf = await lib.getDocument(pdfUrl).promise
        if (cancelled) return

        const numPages: number = pdf.numPages
        setTotalPages(numPages)

        // Scale: fit page width, preserve aspect ratio
        const firstPage   = await pdf.getPage(1)
        const naturalVP   = firstPage.getViewport({ scale: 1 })
        const scale       = Math.min(
          dims.w / naturalVP.width,
          dims.h / naturalVP.height,
        )

        el.innerHTML = '' // clear stale pages from a previous render pass

        for (let i = 1; i <= numPages; i++) {
          if (cancelled) return
          const page     = await pdf.getPage(i)
          const viewport = page.getViewport({ scale })

          const canvas   = document.createElement('canvas')
          canvas.width   = Math.round(viewport.width)
          canvas.height  = Math.round(viewport.height)
          canvas.style.cssText = 'display:block;'

          await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
          if (cancelled) return

          const pageDiv = document.createElement('div')
          pageDiv.style.cssText =
            `width:${dims.w}px;height:${dims.h}px;` +
            'overflow:hidden;background:#fff;position:relative;'
          pageDiv.appendChild(canvas)
          el.appendChild(pageDiv)
        }

        if (cancelled) return
        if (!window.jQuery?.fn?.turn) throw new Error('turn.js not available — check /public/turn.min.js')

        const total = el.children.length
        window.$(el).turn({
          width:        dims.w,
          height:       dims.h,
          autoCenter:   false,
          display:      'single',
          duration:     600,
          gradients:    true,
          acceleration: true,
          elevation:    50,
          when: {
            turned(_evt: Event, page: number) {
              setCurrentPage(page)
            },
          },
        })

        setCurrentPage(1)
        setTotalPages(total)
        setPhase('ready')
        console.log('[PDFFlipBook] ready —', total, 'pages', dims)
      } catch (err) {
        console.error('[PDFFlipBook] init failed:', err)
        if (!cancelled) setPhase('error')
      }
    })()

    return () => {
      cancelled = true
      try {
        if (el && window.$?.fn?.turn) window.$(el).turn('destroy')
      } catch (_) {}
      if (el) el.innerHTML = ''
    }
  }, [pdfUrl, dims?.w, dims?.h]) // key-based remount handles resize

  const atFirst = currentPage <= 1
  const atLast  = totalPages > 0 && currentPage >= totalPages

  return (
    <div
      className="fixed inset-0 h-[100dvh] bg-zinc-900 flex flex-col items-center overflow-hidden select-none"
      style={{ touchAction: 'none' }}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center gap-4 w-full max-w-4xl px-4 py-3">
        <button
          onClick={onBack}
          className="text-xs text-zinc-400 hover:text-white transition-colors"
        >
          ← Torna
        </button>
        <div className="flex-1 text-center min-w-0">
          {restaurantName && (
            <p className="text-sm font-light text-white tracking-wide truncate">{restaurantName}</p>
          )}
          {menuName && menuName !== restaurantName && (
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{menuName}</p>
          )}
        </div>
        {/* page counter — right-aligned, fixed width to keep header balanced */}
        <div className="w-10 shrink-0 text-right">
          {totalPages > 0 && (
            <span className="text-[9px] text-zinc-600 tabular-nums">
              {currentPage}&thinsp;/&thinsp;{totalPages}
            </span>
          )}
        </div>
      </div>

      {/* Book stage — bookRef always in DOM so the ref is always valid */}
      <div className="flex-1 w-full flex items-center justify-center min-h-0">
        <div
          style={{
            position:   'relative',
            width:      dims?.w ?? 0,
            height:     dims?.h ?? 0,
            visibility: dims ? 'visible' : 'hidden',
          }}
        >
          {/* turn.js target */}
          <div
            ref={bookRef}
            style={{ width: dims?.w ?? 0, height: dims?.h ?? 0 }}
          />

          {/* Loading overlay */}
          {phase === 'loading' && dims && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 rounded">
              <p className="text-zinc-400 text-sm">Caricamento menu…</p>
            </div>
          )}

          {/* Error overlay */}
          {phase === 'error' && dims && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-800 rounded gap-3">
              <p className="text-red-400 text-sm text-center px-6">
                Impossibile caricare il menu PDF.
              </p>
              <button
                onClick={onBack}
                className="text-xs text-zinc-400 underline underline-offset-2"
              >
                Torna indietro
              </button>
            </div>
          )}

          {/* Visual nav hints — pointer-events-none, purely decorative */}
          {phase === 'ready' && (
            <>
              <span
                className={`pointer-events-none absolute bottom-4 left-3 z-10 text-[11px] uppercase tracking-[0.18em] select-none transition-opacity duration-200 ${atFirst ? 'opacity-0' : 'text-zinc-500'}`}
              >
                ‹ prec.
              </span>
              <span
                className={`pointer-events-none absolute bottom-4 right-3 z-10 text-[11px] uppercase tracking-[0.18em] select-none transition-opacity duration-200 ${atLast ? 'opacity-0' : 'text-zinc-500'}`}
              >
                succ. ›
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
