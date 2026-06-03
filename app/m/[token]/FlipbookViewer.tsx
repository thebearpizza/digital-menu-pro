'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════════════════
// ⚙️  MENU CONFIG
// Modifica qui ogni aspetto visivo e comportamentale — nessun'altra modifica
// necessaria nel codice sotto.
// ═══════════════════════════════════════════════════════════════════════════════
const menuConfig = {

  // ── 🎨 Theme ─────────────────────────────────────────────────────────────────
  theme: {
    // Sfondi
    pageBg:        '#0c0c0c',           // sfondo schermo esterno al libro
    landingBg:     'linear-gradient(155deg, #0d0d0d 0%, #131313 60%, #0f0e0e 100%)',
    // Colori
    accent:        '#c9a96e',           // dorato — tono dominante brand
    textPrimary:   '#ede8e0',           // testo principale (landing title)
    textMuted:     '#4f4f4f',           // hint, labels, torna
    // Navigazione categorie
    navBg:         'rgba(7,7,7,0.96)',
    navActive:     '#c9a96e',
    navInactive:   '#3e3e3e',
    // Font tokens (applicati via style={{ fontFamily }})
    fontSerif:     "'Cormorant Garamond', 'Georgia', 'Times New Roman', serif",
    fontSans:      "'DM Sans', 'Inter', system-ui, sans-serif",
  },

  // ── 📖 Flipbook ───────────────────────────────────────────────────────────────
  flipbook: {
    duration:            600,        // ms animazione sfoglio turn.js
    elevation:           50,         // shadow depth — identico al repo di riferimento
    pageRatio:           210 / 297,  // A4 portrait (width / height)
    marginX:             12,         // px margine laterale minimo per lato
    marginY:             108,        // px area riservata a header + category bar
    landingFadeDuration: 850,        // ms fade landing → flipbook (e viceversa)
    pageBackground:      '#ffffff',  // sfondo pagine — usato anche come prefill canvas
  },

  // ── 📂 Categorie ──────────────────────────────────────────────────────────────
  // targetPage: prima pagina del PDF in cui inizia la sezione.
  // Calibra questi valori sulla struttura reale del tuo PDF.
  categories: [
    { label: 'Antipasti', targetPage: 1 },
    { label: 'Primi',     targetPage: 3 },
    { label: 'Secondi',   targetPage: 5 },
    { label: 'Dessert',   targetPage: 7 },
  ] as Array<{ label: string; targetPage: number }>,
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRIPT LOADER — deduplication identica al repo di riferimento
// ═══════════════════════════════════════════════════════════════════════════════
const _loaded = new Set<string>()
function requireScript(src: string): Promise<void> {
  if (_loaded.has(src)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { _loaded.add(src); resolve(); return }
    const s = document.createElement('script')
    s.src     = src
    s.onload  = () => { _loaded.add(src); resolve() }
    s.onerror = () => reject(new Error(`Script load failed: ${src}`))
    document.head.appendChild(s)
  })
}

declare global { interface Window { $: any; jQuery: any; pdfjsLib: any } }

const PDFJS_SRC    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

// ═══════════════════════════════════════════════════════════════════════════════
// VIEWPORT SIZING
// ═══════════════════════════════════════════════════════════════════════════════
function computeDims() {
  const { pageRatio, marginX, marginY } = menuConfig.flipbook
  const availW = window.innerWidth  - marginX * 2
  const availH = window.innerHeight - marginY
  let w = Math.min(availW, Math.floor(availH * pageRatio))
  let h = Math.floor(w / pageRatio)
  if (h > availH) { h = availH; w = Math.floor(h * pageRatio) }
  return { w: Math.max(200, w), h: Math.max(280, h) }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════════════════════════════
interface Props {
  /** URL del PDF da visualizzare (prop stringa, backend-agnostic) */
  pdfUrl:          string
  restaurantName?: string
  /** URL logo ristorante (opzionale — se assente usa il nome testuale) */
  restaurantLogo?: string | null
  /** Callback "esci dal viewer" (es. torna alla WelcomeView) */
  onBack:          () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function FlipbookViewer({
  pdfUrl,
  restaurantName,
  restaurantLogo,
  onBack,
}: Props) {
  const bookRef = useRef<HTMLDivElement>(null)

  const [dims,          setDims]         = useState<{ w: number; h: number } | null>(null)
  const [loadPhase,     setLoadPhase]    = useState<'loading' | 'ready' | 'error'>('loading')
  const [currentPage,   setCurrentPage]  = useState(1)
  const [totalPages,    setTotalPages]   = useState(0)
  // Landing overlay
  const [showLanding,   setShowLanding]  = useState(true)
  const [landingFading, setLandingFading]= useState(false)
  // FIX 3: categoria attiva come state diretto — aggiornata immediatamente al click
  const [activeCatIdx,  setActiveCatIdx] = useState(0)
  // Blocco hard: diventa true SOLO dopo Promise.all + turn.js init + Phase 3.5
  const [pagesReady,    setPagesReady]   = useState(false)

  const { theme, categories, flipbook } = menuConfig

  // FIX 3: sincronizza activeCatIdx quando currentPage cambia (sfoglio manuale)
  useEffect(() => {
    let idx = 0
    for (let i = 0; i < categories.length; i++) {
      if (currentPage >= categories[i].targetPage) idx = i
    }
    setActiveCatIdx(idx)
  }, [currentPage]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll-lock (disabilita scroll e overscroll su tutto il documento) ────────
  useEffect(() => {
    document.documentElement.classList.add('menu-locked')
    document.body.classList.add('menu-locked')
    return () => {
      document.documentElement.classList.remove('menu-locked')
      document.body.classList.remove('menu-locked')
    }
  }, [])

  // ── Viewport sizing + resize / orientation change ────────────────────────────
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

  // ── PDF.js + turn.js init ─────────────────────────────────────────────────────
  // Carica in background mentre la landing è visibile.
  //
  // PROBLEMA RADICE: turn.js riorganizza il DOM dopo .turn() (re-parenting).
  // Quando un <canvas> viene spostato in un nuovo nodo padre, Chrome/Safari
  // ne azzerano il contenuto. Soluzione in 4 fasi:
  //
  //  FASE 1 — carica tutti gli oggetti pagina PDF in memoria (nessun render)
  //  FASE 2 — crea placeholder <div>+<canvas> già dimensionati, con data-page
  //  FASE 3 — inizializza turn.js (il DOM viene riorganizzato; i canvas si
  //            svuotano ma restano identificabili tramite data-page)
  //  FASE 4 — RE-RENDER dopo turn.js: le pagine 1-3 subito (bloccante,
  //            per garantire i contenuti prima del primo click), poi tutte
  //            le restanti in background (non blocca il loader)
  useEffect(() => {
    if (!dims) return
    const el = bookRef.current
    if (!el)  return

    let cancelled = false
    setLoadPhase('loading')
    setPagesReady(false)

    const pdfPageObjects: any[] = []
    const renderTasks   = new Map<number, { cancel(): void }>()
    // Doppio cache: ImageBitmap (GPU, browser moderni) + canvas offscreen
    // (fallback universale). Entrambi sopravvivono a qualsiasi DOM manipulation
    // di turn.js (reparenting, display toggle, rimozione temporanea).
    const bitmapCache   = new Map<number, ImageBitmap>()
    const offscreenCache = new Map<number, HTMLCanvasElement>()
    let scale = 1

    function findCanvas(pageNum: number): HTMLCanvasElement | null {
      return el!.querySelector(`canvas[data-page="${pageNum}"]`) as HTMLCanvasElement | null
    }

    // Restore sincrono dal cache (drawImage = GPU blit, <1ms).
    // Funziona anche se il canvas è appena stato aggiunto al DOM da turn.js
    // (canvas vergine): il draw sovrascrive prima che l'utente lo veda.
    function restoreFromCache(pageNum: number): boolean {
      const canvas = findCanvas(pageNum)
      if (!canvas) return false
      try {
        const bitmap = bitmapCache.get(pageNum)
        if (bitmap) { canvas.getContext('2d')!.drawImage(bitmap, 0, 0); return true }
        const offscreen = offscreenCache.get(pageNum)
        if (offscreen) { canvas.getContext('2d')!.drawImage(offscreen, 0, 0); return true }
      } catch (_) {}
      return false
    }

    // Renderizza una pagina via PDF.js e aggiorna entrambi i cache.
    async function renderPage(pageNum: number): Promise<void> {
      if (cancelled) return
      const canvas = findCanvas(pageNum)
      if (!canvas) return
      const pdfPage = pdfPageObjects[pageNum - 1]
      if (!pdfPage) return

      try { renderTasks.get(pageNum)?.cancel() } catch (_) {}

      const viewport = pdfPage.getViewport({ scale })
      const ctx      = canvas.getContext('2d')!
      canvas.style.backgroundColor = flipbook.pageBackground
      ctx.fillStyle  = flipbook.pageBackground
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const task = pdfPage.render({ canvasContext: ctx, viewport })
      renderTasks.set(pageNum, task)
      try {
        await task.promise
        if (cancelled) return
        // Aggiorna cache GPU (o offscreen canvas come fallback)
        if (typeof createImageBitmap !== 'undefined') {
          const bitmap = await createImageBitmap(canvas)
          bitmapCache.set(pageNum, bitmap)
        } else {
          const offscreen    = document.createElement('canvas')
          offscreen.width    = canvas.width
          offscreen.height   = canvas.height
          offscreen.getContext('2d')!.drawImage(canvas, 0, 0)
          offscreenCache.set(pageNum, offscreen)
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('[FlipbookViewer] render p.' + pageNum + ':', err)
        }
      } finally {
        renderTasks.delete(pageNum)
      }
    }

    ;(async () => {
      try {
        await requireScript('/jquery.min.js')
        await requireScript('/turn.min.js')
        await requireScript(PDFJS_SRC)
        if (cancelled) return

        const lib = window.pdfjsLib
        if (!lib) throw new Error('pdfjsLib non disponibile sul window')
        lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER

        const pdf = await lib.getDocument(pdfUrl).promise
        if (cancelled) return

        const numPages: number = pdf.numPages

        // ── FASE 1: carica oggetti pagina in memoria ────────────────────────
        for (let i = 1; i <= numPages; i++) {
          if (cancelled) return
          pdfPageObjects.push(await pdf.getPage(i))
        }

        const naturalVP = pdfPageObjects[0].getViewport({ scale: 1 })
        scale = Math.min(dims.w / naturalVP.width, dims.h / naturalVP.height)
        const vp0 = pdfPageObjects[0].getViewport({ scale })
        const cw  = Math.round(vp0.width)
        const ch  = Math.round(vp0.height)

        // ── FASE 2: placeholder div+canvas dimensionati, con data-page ──────
        el.innerHTML = ''
        for (let i = 1; i <= numPages; i++) {
          const pageDiv = document.createElement('div')
          pageDiv.style.cssText =
            `width:${dims.w}px;height:${dims.h}px;overflow:hidden;` +
            `background:${flipbook.pageBackground};` +
            `backface-visibility:hidden;-webkit-backface-visibility:hidden;`

          const canvas = document.createElement('canvas')
          canvas.width  = cw
          canvas.height = ch
          canvas.dataset.page = String(i)
          canvas.style.cssText =
            `display:block;` +
            `background-color:${flipbook.pageBackground};` +
            `transform:translateZ(0);will-change:transform;`

          const ctx = canvas.getContext('2d')!
          ctx.fillStyle = flipbook.pageBackground
          ctx.fillRect(0, 0, cw, ch)

          pageDiv.appendChild(canvas)
          el.appendChild(pageDiv)
        }
        if (cancelled) return

        // ── FASE 2.5: RENDER-THEN-INIT — Promise.all prima di turn.js ───────
        // Tutti i canvas vengono dipinti da PDF.js e salvati in cache PRIMA
        // che turn.js tocchi il DOM. La pipeline è rigorosa:
        //   PDF.js renders → cache GPU → turn.js init
        // In questo modo il cache esiste anche se turn.js rimuove temporaneamente
        // dal DOM elementi che non sono la pagina corrente.
        await Promise.all(
          Array.from({ length: numPages }, (_, i) => renderPage(i + 1))
        )
        if (cancelled) return

        if (!window.jQuery?.fn?.turn) {
          throw new Error('turn.js non disponibile — controlla /public/turn.min.js')
        }

        // ── FASE 3: init turn.js — riorganizza il DOM ───────────────────────
        // Avviene DOPO il Promise.all: il cache è già completo.
        // Il reparenting dei canvas da parte di turn.js li azzera, ma
        // Fase 3.5 li ripristina immediatamente prima dello sblocco UI.
        window.$(el).turn({
          width:        dims.w,
          height:       dims.h,
          autoCenter:   false,
          display:      'single',
          duration:     flipbook.duration,
          gradients:    true,
          acceleration: true,
          elevation:    flipbook.elevation,
          when: {
            // All'inizio di ogni flip: restore sincrono dal cache GPU.
            // Se turn.js ha rimosso/ricreato un elemento (display single),
            // il canvas appare vergine → restore istantaneo, nessun flash.
            turning(_evt: Event, page: number) {
              ;[page - 1, page, page + 1, page + 2]
                .filter(p => p >= 1 && p <= numPages)
                .forEach(p => restoreFromCache(p))
            },
            turned(_evt: Event, page: number) {
              setCurrentPage(page)
              ;[page, page + 1, page + 2]
                .filter(p => p >= 1 && p <= numPages)
                .forEach(p => restoreFromCache(p))
            },
          },
        })

        // ── FASE 3.5: restore immediato post-init ───────────────────────────
        // turn.js ha appena azzerato i canvas (reparenting). Li ridipingiamo
        // tutti in <10ms totali via drawImage dal cache GPU, prima di
        // sbloccare l'UI. L'utente non vede mai una pagina bianca.
        for (let i = 1; i <= numPages; i++) {
          restoreFromCache(i)
        }
        if (cancelled) return

        setCurrentPage(1)
        setTotalPages(numPages)
        setPagesReady(true)   // sblocca UI solo quando cache è completo e turn.js è pronto
        setLoadPhase('ready')
        console.log('[FlipbookViewer] pronto —', numPages, 'pagine', dims)
      } catch (err) {
        console.error('[FlipbookViewer] init fallito:', err)
        if (!cancelled) setLoadPhase('error')
      }
    })()

    return () => {
      cancelled = true
      renderTasks.forEach(t => { try { t.cancel() } catch (_) {} })
      bitmapCache.forEach(b => { try { b.close() } catch (_) {} })
      offscreenCache.clear()
      try { if (el && window.$?.fn?.turn) window.$(el).turn('destroy') } catch (_) {}
      if (el) el.innerHTML = ''
    }
  }, [pdfUrl, dims?.w, dims?.h]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Callbacks ────────────────────────────────────────────────────────────────

  /** Attiva il flipbook: fade-out landing + reset alla copertina (safety net) */
  const enterFlipbook = useCallback(() => {
    setLandingFading(true)
    // Reset alla pagina 1 mentre la landing copre il libro (nessun flash visibile).
    // Necessario per il caso in cui l'utente ritorni dopo aver sfogliato.
    const el = bookRef.current
    if (el && window.$?.fn?.turn) {
      try {
        window.$(el).turn('stop')
        window.$(el).turn('page', 1)
        setCurrentPage(1)
        setActiveCatIdx(0)
      } catch (_) {}
    }
    setTimeout(() => setShowLanding(false), flipbook.landingFadeDuration)
  }, [flipbook.landingFadeDuration])

  /**
   * FIX 2 — "← torna": ritorna alla landing con fade-in animato.
   * Usa rAF doppio per assicurarsi che il div sia nel DOM prima di triggerare
   * la transizione CSS (altrimenti l'opacity parte già a 1, niente animazione).
   *
   * RESET STATO: turn.js conserva l'ultima pagina visitata nella sua istanza
   * jQuery. Riportiamo il libro alla pagina 1 mentre la landing lo copre, così
   * al rientro l'utente trova sempre la copertina (nessuna memoria residua).
   */
  const goToLanding = useCallback(() => {
    setLandingFading(true)   // opacity: 0 — landing parte invisibile
    setShowLanding(true)     // monta il div
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setLandingFading(false)) // trigger fade-in
    )
    // Reset del flipbook alla copertina, nascosto dietro la landing.
    const el = bookRef.current
    if (el && window.$?.fn?.turn) {
      try {
        window.$(el).turn('stop')      // interrompe eventuali animazioni in corso
        window.$(el).turn('page', 1)   // torna alla pagina 1
        setCurrentPage(1)
        setActiveCatIdx(0)
      } catch (_) {}
    }
  }, [])

  /**
   * FIX 3 — Salta a una categoria: aggiorna activeCatIdx IMMEDIATAMENTE (visual
   * feedback istantaneo), poi ordina a turn.js di girare alla pagina target.
   */
  const handleCategoryClick = useCallback((targetPage: number, catIdx: number) => {
    setActiveCatIdx(catIdx)   // risposta visiva immediata, non aspetta l'evento turned
    const el = bookRef.current
    if (!el || !window.$?.fn?.turn) return
    window.$(el).turn('page', targetPage)
  }, [])

  const atFirst = currentPage <= 1
  const atLast  = totalPages > 0 && currentPage >= totalPages

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="fixed inset-0 h-[100dvh] overflow-hidden select-none"
      style={{
        background:  theme.pageBg,
        touchAction: 'none',    // disabilita pan, pinch-to-zoom, scroll verticale
        fontFamily:  theme.fontSans,
      }}
    >

      {/* ──────────────────────────────────────────────────────────────────────
       *  FLIPBOOK LAYOUT
       *  bookRef è sempre nel DOM — garantisce che il ref sia valido prima
       *  ancora che la landing svanisca, e permette il preload del PDF.
       * ──────────────────────────────────────────────────────────────────────*/}
      <div className="absolute inset-0 flex flex-col">

        {/* ── A. Header minimale ────────────────────────────────────────────── */}
        <div
          className="shrink-0 flex items-center justify-between px-4 py-3"
          style={{ background: theme.pageBg }}
        >
          {/* FIX 2: torna alla landing con fade-in, non esce dal viewer */}
          <button
            onClick={goToLanding}
            className="text-xs transition-opacity duration-200 hover:opacity-50"
            style={{ color: theme.textMuted }}
          >
            ← torna
          </button>
          <span
            className="text-xs truncate max-w-[50%] text-center"
            style={{ color: theme.textMuted }}
          >
            {restaurantName ?? ''}
          </span>
          <span
            className="text-xs tabular-nums w-10 text-right"
            style={{ color: theme.textMuted }}
          >
            {totalPages > 0 ? `${currentPage}/${totalPages}` : ''}
          </span>
        </div>

        {/* ── B. Book stage — occupa lo spazio rimasto tra header e nav bar ── */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div
            style={{
              position:   'relative',
              width:      dims?.w ?? 0,
              height:     dims?.h ?? 0,
              visibility: dims ? 'visible' : 'hidden',
            }}
          >
            {/* turn.js mount target — always in DOM, fv-book per CSS targeting */}
            <div
              ref={bookRef}
              className="fv-book"
              style={{ width: dims?.w ?? 0, height: dims?.h ?? 0 }}
            />

            {/* Overlay caricamento */}
            {loadPhase === 'loading' && dims && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: '#141414' }}
              >
                <span className="text-xs" style={{ color: theme.textMuted }}>
                  Caricamento…
                </span>
              </div>
            )}

            {/* Overlay errore */}
            {loadPhase === 'error' && dims && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ background: '#141414' }}
              >
                <p className="text-xs text-center px-6 text-red-400">
                  Impossibile caricare il menu PDF.
                </p>
                <button
                  onClick={onBack}
                  className="text-xs underline underline-offset-2"
                  style={{ color: theme.textMuted }}
                >
                  torna indietro
                </button>
              </div>
            )}

            {/* ── Hint angolari — z-50 per stare sopra il libro, pointer-events-none
                 perché i click/swipe devono raggiungere gli angoli nativi di turn.js.
                 Nascosti sulla landing (showLanding) e finché le pagine non sono pronte. */}
            {!showLanding && pagesReady && (
              <>
                <span
                  className="pointer-events-none absolute bottom-3 left-2 z-50 text-[10px] uppercase tracking-[0.2em] select-none"
                  style={{
                    color:      theme.textMuted,
                    opacity:    atFirst ? 0 : 0.6,
                    transition: 'opacity 0.25s ease',
                    fontFamily: theme.fontSans,
                  }}
                >
                  ‹ prec.
                </span>
                <span
                  className="pointer-events-none absolute bottom-3 right-2 z-50 text-[10px] uppercase tracking-[0.2em] select-none"
                  style={{
                    color:      theme.textMuted,
                    opacity:    atLast ? 0 : 0.6,
                    transition: 'opacity 0.25s ease',
                    fontFamily: theme.fontSans,
                  }}
                >
                  succ. ›
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── C. Barra delle Categorie — sticky in fondo ────────────────────── */}
        <nav
          className="shrink-0 flex items-stretch overflow-x-auto"
          style={{
            background:    theme.navBg,
            borderTop:     `1px solid ${theme.textMuted}1a`,
            scrollbarWidth:'none',
            WebkitOverflowScrolling: 'touch',
          } as React.CSSProperties}
          aria-label="Navigazione categorie menu"
        >
          {categories.map((cat, idx) => (
            <button
              key={cat.label}
              onClick={() => handleCategoryClick(cat.targetPage, idx)}
              className="shrink-0 px-5 py-3 text-[10px] uppercase tracking-[0.22em] transition-all duration-200"
              style={{
                color:        idx === activeCatIdx ? theme.navActive : theme.navInactive,
                borderBottom: `2px solid ${idx === activeCatIdx ? theme.navActive : 'transparent'}`,
                fontFamily:   theme.fontSans,
                background:   'transparent',
              }}
            >
              {cat.label}
            </button>
          ))}
        </nav>

      </div>

      {/* ──────────────────────────────────────────────────────────────────────
       *  LANDING PAGE OVERLAY
       *  Flotta sopra il flipbook (z-20). Svanisce e si smonta al click CTA.
       * ──────────────────────────────────────────────────────────────────────*/}
      {showLanding && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-20"
          style={{
            background:    theme.landingBg,
            opacity:       landingFading ? 0 : 1,
            // FIX 1: transizione lenta e raffinata — valore da menuConfig.flipbook.landingFadeDuration
            transition:    `opacity ${flipbook.landingFadeDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            pointerEvents: landingFading ? 'none' : 'auto',
          }}
        >
          {/* Filo decorativo superiore */}
          <div
            className="absolute top-0 inset-x-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${theme.accent}55, transparent)`,
            }}
          />

          {/* ── Contenuto centrale ──────────────────────────────────────────── */}
          <div className="flex flex-col items-center text-center px-10 max-w-xs">

            {restaurantLogo ? (
              <img
                src={restaurantLogo}
                alt={restaurantName}
                className="h-14 mb-10 object-contain"
                style={{ opacity: 0.88 }}
              />
            ) : (
              <>
                <div
                  className="w-10 h-px mb-7"
                  style={{ background: theme.accent }}
                />
                <h1
                  className="font-light uppercase leading-none"
                  style={{
                    color:         theme.textPrimary,
                    fontFamily:    theme.fontSerif,
                    fontSize:      'clamp(1.6rem, 5vw, 2.4rem)',
                    letterSpacing: '0.22em',
                  }}
                >
                  {restaurantName ?? 'Menu'}
                </h1>
                <div
                  className="w-10 h-px mt-7"
                  style={{ background: theme.accent }}
                />
              </>
            )}

            {/* ── Call to Action ───────────────────────────────────────────── */}
            <button
              onClick={enterFlipbook}
              className="group relative mt-10 px-10 py-3 overflow-hidden"
              style={{
                color:      theme.textPrimary,
                border:     `1px solid ${theme.accent}50`,
                fontFamily: theme.fontSans,
                fontSize:   '0.625rem',        // 10px
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
              }}
            >
              {/* hover shimmer */}
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `${theme.accent}14` }}
              />
              <span className="relative">Sfoglia il Menu</span>
            </button>

          </div>

          {/* Watermark */}
          <p
            className="absolute bottom-6 text-[8px] uppercase tracking-[0.35em]"
            style={{ color: theme.textMuted }}
          >
            menu digitale
          </p>

          {/* Filo decorativo inferiore */}
          <div
            className="absolute bottom-0 inset-x-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${theme.accent}55, transparent)`,
            }}
          />
        </div>
      )}

    </div>
  )
}
