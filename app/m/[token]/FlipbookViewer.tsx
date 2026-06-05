'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import DishModal, { DishData } from './DishModal'

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

// Array vuoto con riferimento stabile — usato come fallback di categories per
// evitare ri-render infiniti nell'effect che dipende da [currentPage, categories].
const EMPTY_CATEGORIES: Array<{ label: string; targetPage: number }> = []

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
  /** Sovrascrive le categorie di navigazione hardcoded in menuConfig.
   *  Passato da useMenuPDF con i targetPage reali estratti dal PDF generato. */
  categories?: Array<{ label: string; targetPage: number }>
  dishes?:     DishData[]
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function FlipbookViewer({
  pdfUrl,
  restaurantName,
  restaurantLogo,
  onBack,
  categories: categoriesProp,
  dishes,
}: Props) {
  const bookRef = useRef<HTMLDivElement>(null)

  const [dims,          setDims]         = useState<{ w: number; h: number } | null>(null)
  const [loadPhase,     setLoadPhase]    = useState<'loading' | 'ready' | 'error'>('loading')
  const [currentPage,   setCurrentPage]  = useState(1)
  const [totalPages,    setTotalPages]   = useState(0)
  // categoria attiva come state diretto — aggiornata immediatamente al click
  const [activeCatIdx,  setActiveCatIdx] = useState(0)
  // Blocco hard: diventa true SOLO dopo Promise.all + turn.js init
  const [pagesReady,    setPagesReady]   = useState(false)

  const { theme, flipbook } = menuConfig
  // Le categorie vengono ESCLUSIVAMENTE dal menu selezionato tramite useMenuPDF.
  // Nessun fallback hardcoded — ogni menu ha le sue categorie dinamiche.
  const categories = categoriesProp ?? EMPTY_CATEGORIES

  // Ref sempre aggiornato con i piatti correnti — letto dai click listener sul text layer
  // senza richiedere il re-init del flipbook quando i piatti cambiano.
  const dishesRef = useRef<DishData[]>(dishes ?? [])
  useEffect(() => { dishesRef.current = dishes ?? [] }, [dishes])
  const [activeDish, setActiveDish] = useState<DishData | null>(null)

  // Sincronizza activeCatIdx quando currentPage cambia (sfoglio manuale)
  // o quando le categorie cambiano (cambio menu).
  useEffect(() => {
    if (!categories.length) return
    let idx = 0
    for (let i = 0; i < categories.length; i++) {
      if (currentPage >= categories[i].targetPage) idx = i
    }
    setActiveCatIdx(idx)
  }, [currentPage, categories])

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
  // Architettura: Static Pre-rendering & Hand-off
  //   FASE 1   — carica oggetti pagina PDF in memoria
  //   FASE 2   — crea div+canvas nel DOM (attr width/height fissi, mai resettati)
  //   FASE 2.5 — render tutte le pagine in parallelo su canvas con scala dpr-aware;
  //              data URL pre-computata una volta per il trick "revealed area"
  //   FASE 3   — init turn.js: canvas già dipinti, turn.js scala via CSS transform
  useEffect(() => {
    if (!dims) return
    const el = bookRef.current
    if (!el)  return

    let cancelled = false
    setLoadPhase('loading')
    setPagesReady(false)

    const pdfPageObjects: any[] = []
    const renderTasks  = new Map<number, { cancel(): void }>()
    const pageDataUrls = new Map<number, string>()

    // devicePixelRatio: buffer fisicamente grande → testo nitido su retina.
    // Cappato a 3 per evitare allocazioni eccessive su display ultra-HiDPI.
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    let scale = 1
    let cw = 0
    let ch = 0

    async function renderPageToCanvas(pageNum: number): Promise<void> {
      if (cancelled) return
      const pdfPage = pdfPageObjects[pageNum - 1]
      if (!pdfPage) return

      try { renderTasks.get(pageNum)?.cancel() } catch (_) {}

      const viewport = pdfPage.getViewport({ scale })
      const canvas = el!.querySelector(`canvas[data-page="${pageNum}"]`) as HTMLCanvasElement | null
      if (!canvas || cancelled) return

      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = flipbook.pageBackground
      ctx.fillRect(0, 0, cw, ch)

      const task = pdfPage.render({ canvasContext: ctx, viewport })
      renderTasks.set(pageNum, task)
      try {
        await task.promise
        if (cancelled) return
        // Pre-computa data URL per il background "revealed area" di turn.js.
        // Fatto qui una volta — mai chiamato di nuovo durante la navigazione.
        pageDataUrls.set(pageNum, canvas.toDataURL('image/png'))
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('[FlipbookViewer] render p.' + pageNum + ':', err)
        }
      } finally {
        renderTasks.delete(pageNum)
      }
    }

    // Builds a transparent text layer over pageDiv and wires dish-name spans to setActiveDish.
    // Called AFTER canvas rendering and BEFORE turn.js init (FASE 2.7).
    async function renderTextLayer(pageNum: number, logicalScale: number): Promise<void> {
      if (cancelled) return
      const pdfPage = pdfPageObjects[pageNum - 1]
      if (!pdfPage) return

      const pageDiv = el!.children[pageNum - 1] as HTMLElement | null
      if (!pageDiv || cancelled) return

      const lib = window.pdfjsLib
      if (!lib?.renderTextLayer) return

      const viewport = pdfPage.getViewport({ scale: logicalScale })
      const tc       = await pdfPage.getTextContent()
      if (cancelled) return

      const layer     = document.createElement('div')
      layer.className = 'pdf-text-layer'
      layer.style.cssText = `width:${viewport.width}px;height:${viewport.height}px;`

      const textDivs: HTMLElement[] = []
      try {
        const task = lib.renderTextLayer({ textContent: tc, container: layer, viewport, textDivs })
        await (task.promise ?? task)
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('[FlipbookViewer] text layer p.' + pageNum + ':', err)
        }
        return
      }
      if (cancelled) return

      // Attach click handlers to spans whose text matches a dish name.
      for (const div of textDivs) {
        const text = div.textContent?.trim() ?? ''
        if (!text) continue
        const match = dishesRef.current.find(
          d => d.name.trim().toUpperCase() === text.toUpperCase()
        )
        if (match) {
          const captured = match
          div.dataset.dishId = captured.id
          div.style.pointerEvents = 'auto'
          div.addEventListener('click', (evt) => {
            evt.stopPropagation()
            setActiveDish(captured)
          })
        }
      }

      pageDiv.style.position = 'relative'
      pageDiv.appendChild(layer)
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
        scale = Math.min(dims.w / naturalVP.width, dims.h / naturalVP.height) * dpr
        const vp0 = pdfPageObjects[0].getViewport({ scale })
        cw = Math.round(vp0.width)
        ch = Math.round(vp0.height)

        // ── FASE 2: div + canvas nel DOM ─────────────────────────────────────
        // canvas.width / canvas.height = dimensioni pixel FISSE (mai cambiate).
        // canvas CSS width:100%;height:100% → turn.js scala via transform CSS,
        // senza mai toccare gli attributi → il context 2D non viene mai resettato.
        el.innerHTML = ''
        for (let i = 1; i <= numPages; i++) {
          const pageDiv = document.createElement('div')
          pageDiv.style.cssText =
            `width:${dims.w}px;height:${dims.h}px;overflow:hidden;` +
            `background:${flipbook.pageBackground};` +
            `backface-visibility:hidden;-webkit-backface-visibility:hidden;`

          const canvas = document.createElement('canvas')
          canvas.width        = cw
          canvas.height       = ch
          canvas.dataset.page = String(i)
          canvas.style.cssText = `display:block;width:100%;height:100%;`

          pageDiv.appendChild(canvas)
          el.appendChild(pageDiv)
        }
        if (cancelled) return

        // ── FASE 2.5: render tutte le pagine in parallelo ────────────────────
        // Ogni canvas viene dipinto una volta sola e non viene mai più toccato.
        await Promise.all(
          Array.from({ length: numPages }, (_, i) => renderPageToCanvas(i + 1))
        )
        if (cancelled) return

        // ── FASE 2.7: text layer interattivo sopra i canvas ──────────────────
        // Aggiunge span trasparenti con coordinate PDF.js sui piatti riconosciuti.
        // Eseguito solo se ci sono piatti — dopo i canvas, prima di turn.js.
        if (dishesRef.current.length > 0) {
          await Promise.all(
            Array.from({ length: numPages }, (_, i) => renderTextLayer(i + 1, scale / dpr))
          )
        }
        if (cancelled) return

        if (!window.jQuery?.fn?.turn) {
          throw new Error('turn.js non disponibile — controlla /public/turn.min.js')
        }

        // ── FASE 3: init turn.js ─────────────────────────────────────────────
        // I canvas sono già fisicamente dipinti nel DOM prima che turn.js li
        // avvolga nei suoi wrapper. Durante lo swipe, turn.js applica solo
        // CSS transform ai wrapper — il buffer del canvas non viene mai toccato.
        //
        // Trick "revealed area": in display:'single' la pagina che si piega
        // (currentPage) sta SOPRA (z alto) e ha sfondo bianco opaco (CSS
        // .fv-book > div), che copre la pagina di destinazione sottostante.
        // Dipingendo pageWrap[currentPage].backgroundImage con il contenuto
        // della destinazione, la zona "scoperta" dalla piega lo mostra subito.
        //
        // TIMING CRITICO: il paint DEVE avvenire nell'evento `start` (inizio
        // piega), NON in `turning`. Per il DRAG, `turning` scatta solo al
        // rilascio → durante il trascinamento si vedrebbe bianco. `start`
        // scatta all'inizio sia per drag che per navigazione a tasti.

        // Dipinge la pagina `dest` sotto la pagina che si piega (`cur`).
        const paintReveal = (cur: number, dest: number): void => {
          const data = window.$(el!).turn('data') as any
          const wrap = data?.pageWrap?.[cur]
          const src  = pageDataUrls.get(dest)
          if (wrap && src) {
            window.$(wrap).css({
              backgroundImage:    `url("${src}")`,
              backgroundSize:     '100% 100%',
              backgroundRepeat:   'no-repeat',
              backgroundPosition: '0 0',
            })
          }
        }
        // Rimuove gli sfondi di reveal da tutti i pageWrap a piega conclusa.
        const clearReveal = (): void => {
          const data = window.$(el!).turn('data') as any
          if (data?.pageWrap) {
            Object.values(data.pageWrap).forEach((wrap: any) => {
              window.$(wrap).css({ backgroundImage: '' })
            })
          }
        }

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
            // `start(evt, opts, corner)` — opts.page = pagina che si piega.
            // DRAG: turn.js passa l'angolo ('bl'/'tl' = indietro, 'br'/'tr' =
            //       avanti in direzione ltr) → ricaviamo la destinazione.
            // TASTI: corner è null, ma opts.next è già impostato e affidabile.
            start(_evt: Event, opts: any, corner: any) {
              try {
                const cur = opts?.page as number
                if (!cur) return
                let dest: number
                if (typeof corner === 'string' &&
                    (corner.charAt(1) === 'l' || corner.charAt(1) === 'r')) {
                  dest = corner.charAt(1) === 'l' ? cur - 1 : cur + 1
                } else if (typeof opts?.next === 'number') {
                  dest = opts.next
                } else {
                  return
                }
                paintReveal(cur, dest)
              } catch (_) {}
            },
            turned(_evt: Event, page: number) {
              setCurrentPage(page)
              try { clearReveal() } catch (_) {}
            },
          },
        })

        setCurrentPage(1)
        setTotalPages(numPages)
        setPagesReady(true)
        setLoadPhase('ready')
      } catch (err) {
        console.error('[FlipbookViewer] init fallito:', err)
        if (!cancelled) setLoadPhase('error')
      }
    })()

    return () => {
      cancelled = true
      renderTasks.forEach(t => { try { t.cancel() } catch (_) {} })
      try { if (el && window.$?.fn?.turn) window.$(el).turn('destroy') } catch (_) {}
      if (el) el.innerHTML = ''
    }
  }, [pdfUrl, dims?.w, dims?.h]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Callbacks ────────────────────────────────────────────────────────────────


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
          <button
            onClick={onBack}
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
                 perché i click/swipe devono raggiungere gli angoli nativi di turn.js. */}
            {pagesReady && (
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

        {/* ── C. Barra delle Categorie — visibile solo quando il libro è pronto ── */}
        {pagesReady && (
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
        )}

      </div>

      {/* Schermo scuro a tutto schermo durante caricamento — impedisce flash bianchi */}
      {!pagesReady && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ background: '#0c0c0c' }}
        >
          <span className="text-xs" style={{ color: theme.textMuted }}>
            Caricamento…
          </span>
        </div>
      )}

      {/* Dish modal — rendered outside the flipbook DOM to avoid z-index conflicts */}
      {activeDish && (
        <DishModal
          activeDish={activeDish}
          allDishes={dishesRef.current}
          onClose={() => setActiveDish(null)}
        />
      )}

    </div>
  )
}
