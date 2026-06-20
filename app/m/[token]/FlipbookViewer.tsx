'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import DishModal, { DishData } from './DishModal'
import { useIsMobilePreview } from './EditHandle'
import { fontStack, hexToRgb, toOpaqueColor, PAGINATION_OPTIONS, menuBackgroundCss } from '@/lib/theme'
import type { RestaurantTheme } from '@/lib/theme'
import { ALL_LANGS, LANG_FLAGS, LANG_LABELS, uiText, type Lang } from '@/lib/translations'
import { FlagIcon } from '@/components/ui/FlagIcon'

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
    duration:            1200,       // ms animazione sfoglio turn.js
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
  pdfUrl:          string
  restaurantName?: string
  restaurantLogo?: string | null
  onBack:          () => void
  categories?:   Array<{ label: string; targetPage: number }>
  dishes?:       DishData[]
  theme?:        RestaurantTheme
  editMode?:     boolean
  onEditTarget?: (target: string) => void
  onDishOpen?:   (dishId: string) => void
  // Lingua corrente + cambio lingua: se onLangChange è presente, la barra
  // categorie mostra la bandierina al posto del contatore pagine.
  lang?:         Lang
  onLangChange?: (l: Lang) => void
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
  theme: themeProp,
  editMode,
  onEditTarget,
  onDishOpen,
  lang: langProp,
  onLangChange,
}: Props) {
  const lang = langProp ?? 'it'
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  // Merge incoming theme over menuConfig defaults so existing callers without
  // a theme prop keep working with the hardcoded palette.
  const mn           = themeProp?.menu      ?? null
  const pageBgColor  = mn?.pageBackground.color ?? menuConfig.flipbook.pageBackground
  const catStyle     = mn?.stickyCategories.style ?? 'solid'
  const navBgComputed = mn?.stickyCategories.bgColor ?? menuConfig.theme.navBg
  // Tasto "Menù" e contatore pagine appartengono allo stesso gruppo visivo delle
  // categorie sticky: condividono il colore testo (stickyCategories.textColor)
  // e uno sfondo OPACO ("muro"), così i nomi categoria che scorrono sotto non
  // risultano mai visibili attraverso di essi.
  const navColorComputed = mn?.stickyCategories.textColor ?? menuConfig.theme.textMuted
  const navBgOpaque = toOpaqueColor(navBgComputed)
  const theme = {
    ...menuConfig.theme,
    appBg:       mn?.background.color          ?? menuConfig.theme.pageBg,
    accent:      mn?.accent                    ?? menuConfig.theme.accent,
    textPrimary: themeProp?.landing.title.color ?? menuConfig.theme.textPrimary,
    textMuted:   mn?.stickyCategories.textColor ?? menuConfig.theme.textMuted,
    navBg:       navBgComputed,
    navBgOpaque,
    navActive:   mn?.stickyCategories.activeColor ?? mn?.accent ?? menuConfig.theme.navActive,
    navInactive: mn?.stickyCategories.textColor ?? menuConfig.theme.navInactive,
    navColor:    navColorComputed,
    fontSerif:   fontStack(mn?.dishes.titleFont       ?? 'Cormorant Garamond', 'serif'),
    fontSans:    fontStack(mn?.stickyCategories.font  ?? 'DM Sans', 'sans'),
  }
  // Sticky category tab font size (rem) — own control, falls back to a sane default.
  const navFontSize = `${mn?.stickyCategories.fontSize ?? 0.625}rem`
  const bookRef = useRef<HTMLDivElement>(null)

  const [dims,          setDims]         = useState<{ w: number; h: number } | null>(null)
  const [loadPhase,     setLoadPhase]    = useState<'loading' | 'ready' | 'error'>('loading')
  const [currentPage,   setCurrentPage]  = useState(1)
  const [totalPages,    setTotalPages]   = useState(0)
  // categoria attiva come state diretto — aggiornata immediatamente al click
  const [activeCatIdx,  setActiveCatIdx] = useState(0)
  const catNavRef  = useRef<HTMLElement>(null)
  const catBtnRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Auto-scroll: porta il tab attivo al centro della barra quando cambia categoria
  useEffect(() => {
    const btn = catBtnRefs.current[activeCatIdx]
    if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeCatIdx])
  // Blocco hard: diventa true SOLO dopo Promise.all + turn.js init
  const [pagesReady,    setPagesReady]   = useState(false)
  const isMobilePreview = useIsMobilePreview()

  const { flipbook } = menuConfig
  // Le categorie vengono ESCLUSIVAMENTE dal menu selezionato tramite useMenuPDF.
  // Nessun fallback hardcoded — ogni menu ha le sue categorie dinamiche.
  const categories = categoriesProp ?? EMPTY_CATEGORIES

  // Ref sempre aggiornato con i piatti correnti — letto dai click listener sul text layer
  // senza richiedere il re-init del flipbook quando i piatti cambiano.
  const dishesRef = useRef<DishData[]>(dishes ?? [])
  useEffect(() => { dishesRef.current = dishes ?? [] }, [dishes])
  // Stesso pattern per le categorie: servono al text layer per disambiguare
  // piatti con lo stesso nome in categorie diverse (match per pagina corrente).
  const categoriesRef = useRef(categories)
  useEffect(() => { categoriesRef.current = categories }, [categories])
  const onDishOpenRef = useRef(onDishOpen)
  useEffect(() => { onDishOpenRef.current = onDishOpen }, [onDishOpen])
  const [modalStack, setModalStack] = useState<DishData[]>([])

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

    // Tracks where the last touch began so the 'start' handler can reject
    // any flip that originated in the top 40% of the viewport.
    let lastTouchStartY = Infinity
    const onBookTouchStart = (e: TouchEvent) => {
      lastTouchStartY = e.touches[0]?.clientY ?? Infinity
    }

    async function renderPageToCanvas(pageNum: number): Promise<void> {
      if (cancelled) return
      const pdfPage = pdfPageObjects[pageNum - 1]
      if (!pdfPage) return

      try { renderTasks.get(pageNum)?.cancel() } catch (_) {}

      const viewport = pdfPage.getViewport({ scale })
      const canvas = el!.querySelector(`canvas[data-page="${pageNum}"]`) as HTMLCanvasElement | null
      if (!canvas || cancelled) return

      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = pageBgColor
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

    // Builds a transparent text layer over pageDiv and wires dish-name spans to setModalStack.
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
      layer.style.cssText = `width:${viewport.width}px;height:${viewport.height}px;overflow:hidden;`

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

      // ── Chirurgical hotspot — two-pass, zero vertical bleed ─────────────────
      //
      // Pass 1: identify dish-name lines → build sorted (dish, topPx) anchors.
      //
      //   With standard fonts PDF.js produces one span per dish name → direct
      //   text match works. With custom/subset fonts PDF.js may split each
      //   glyph into its own span on the same baseline. We therefore GROUP all
      //   spans whose style.top values are within LINE_TOLERANCE px, sort them
      //   left→right, concatenate their text, and match the full line string.
      //   Both cases are handled by the same code path.
      //
      // Pass 2: for EVERY span whose style.top falls inside a dish's vertical
      //   range [dishName.top, nextDishName.top), extend it to full page width
      //   (width:100%, transform:none) and attach a click handler.
      //   Height is NEVER changed — it stays at PDF.js's exact font-size,
      //   so no vertical bleed onto lines of other dishes.
      //
      // Footer exclusion: the bottom 10% of the page (restaurant name +
      //   page number text items) is capped out of the last dish's range.

      // style.top from PDF.js 3.x can be either px ("120px") or % ("14.1%").
      // Detect the unit from the first span and set tolerance accordingly:
      //   px → 6 px is a safe same-line tolerance
      //   %  → 1.5 percentage-points (6% would span multiple visual lines)
      const topIsPct  = (textDivs[0]?.style.top ?? '').includes('%')
      const LINE_TOL  = topIsPct ? 1.5 : 6

      type LineGroup  = { topPx: number; spans: HTMLElement[] }
      type DishAnchor = { dish: DishData; topPx: number }

      function spanTopVal(div: HTMLElement): number {
        const t = parseFloat(div.style.top)
        if (!isNaN(t) && t > 0) return t
        // Fallback: extract ty from CSS matrix(a,b,c,d,tx,ty)
        const m = (div.style.transform ?? '').match(/matrix\(([^)]+)\)/)
        if (m) {
          const parts = m[1].split(',').map(Number)
          if (parts.length >= 6 && parts[5] > 0) return parts[5]
        }
        return t || 0
      }

      // Step A: bucket spans into lines by their top value
      const lineGroups: LineGroup[] = []
      for (const div of textDivs) {
        const topPx = spanTopVal(div)
        const grp   = lineGroups.find(g => Math.abs(g.topPx - topPx) < LINE_TOL)
        if (grp) grp.spans.push(div)
        else      lineGroups.push({ topPx, spans: [div] })
      }

      // Step B: sort each line left → right (reading order)
      for (const g of lineGroups) {
        g.spans.sort((a, b) => (parseFloat(a.style.left) || 0) - (parseFloat(b.style.left) || 0))
      }

      // Returns false for allergen-label spans ("(Allergeni): …"), pure-number
      // allergen codes ("2 - 4 14"), price spans ("€ 20.00"), and empty spans.
      // Everything else (dish name words, descriptions) returns true.
      function isDishText(text: string): boolean {
        const t = text.trim()
        if (!t) return false
        if (/\(allergeni\)/i.test(t)) return false
        if (/^\s*€/.test(t)) return false
        // Pure numbers or number-dash-number sequences: "4", "2 - 4 14", "14"
        if (/^\s*\d+(\s*[-–]\s*\d+)*\s*$/.test(t)) return false
        return /[a-zA-ZÀ-ÿ]/.test(t)  // must contain at least one real letter
      }

      // Disambiguate: when multiple dishes share the same name, pick by
      // the category whose PDF section contains the current page number.
      // When stripSpaces=true, compare dish names without spaces (handles
      // custom fonts that lose word-separator spaces during extraction).
      function pickDish(norm: string, stripSpaces = false): DishData | undefined {
        const all = dishesRef.current.filter(d => {
          const dn = d.name.trim().toUpperCase()
          return stripSpaces ? dn.replace(/[-\s]+/g, '') === norm : dn === norm
        })
        if (!all.length) return undefined
        if (all.length === 1) return all[0]
        const cats = categoriesRef.current ?? []
        let currentCat: string | undefined
        for (let i = 0; i < cats.length; i++) {
          if (pageNum >= cats[i].targetPage) currentCat = cats[i].label
        }
        return all.find(d => d.category === currentCat) ?? all[0]
      }

      // Step C: match dish names against line groups.
      // Sorted once by topPx so consecutive-group matching works in reading order.
      const sortedGroups = [...lineGroups].sort((a, b) => a.topPx - b.topPx)

      const anchors: DishAnchor[] = []
      const matchedIdx = new Set<number>()  // indices into sortedGroups

      function tryMatch(dishSpans: HTMLElement[]): DishData | undefined {
        if (!dishSpans.length) return undefined
        const raw  = dishSpans.map(s => s.textContent ?? '').join('').trim().replace(/\s+/g, ' ')
        // Strip both spaces and end-of-line hyphens (PDF hyphenation artifact: "MILLE-\nFOGLIE")
        const noSp = raw.replace(/[-\s]+/g, '').toUpperCase()
        return pickDish(raw.toUpperCase())
          ?? (noSp.length > 2 ? pickDish(noSp, true) : undefined)
      }

      // Pass 1a: single-group matching (standard and custom fonts)
      for (let i = 0; i < sortedGroups.length; i++) {
        const { topPx, spans } = sortedGroups[i]
        const dish = tryMatch(spans.filter(s => isDishText(s.textContent ?? '')))
        if (dish) {
          for (const span of spans) { span.dataset.dishId = dish.id }
          anchors.push({ dish, topPx })
          matchedIdx.add(i)
        }
      }

      // Pass 1b: multi-group matching for dishes whose name wraps to 2+ lines.
      // Tries combining 2–6 consecutive unmatched groups within 10 topPx-units,
      // stopping early at already-matched groups (clear dish-boundary markers).
      for (let i = 0; i < sortedGroups.length; i++) {
        if (matchedIdx.has(i)) continue
        // Don't start from a pure allergen/price row (no dish text to anchor on)
        if (!sortedGroups[i].spans.some(s => isDishText(s.textContent ?? ''))) continue

        for (let len = 2; len <= 6; len++) {
          const lastIdx = i + len - 1
          if (lastIdx >= sortedGroups.length) break
          // Stop if the window spans more than 10 units — inter-dish spacing
          if (sortedGroups[lastIdx].topPx - sortedGroups[i].topPx > 10) break
          // Stop if any intermediate group is already matched (= next dish started)
          let crossesMatch = false
          for (let k = i + 1; k <= lastIdx; k++) {
            if (matchedIdx.has(k)) { crossesMatch = true; break }
          }
          if (crossesMatch) break

          const combined: HTMLElement[] = []
          for (let k = i; k < i + len; k++) {
            combined.push(...sortedGroups[k].spans.filter(s => isDishText(s.textContent ?? '')))
          }
          const dish = tryMatch(combined)
          if (dish) {
            for (let k = i; k < i + len; k++) {
              for (const span of sortedGroups[k].spans) { span.dataset.dishId = dish.id }
            }
            anchors.push({ dish, topPx: sortedGroups[i].topPx })
            matchedIdx.add(i)
            break
          }
        }
      }

      if (anchors.length > 0) {
        anchors.sort((a, b) => a.topPx - b.topPx)

        const footerCutoff = viewport.height * 0.90  // exclude bottom 10%

        const ranges = anchors.map((anchor, i) => ({
          dish:   anchor.dish,
          minTop: anchor.topPx,
          maxTop: i < anchors.length - 1
            ? anchors[i + 1].topPx   // exclusive: next dish name starts here
            : footerCutoff,           // last dish: up to footer safe-zone
        }))

        // Build a map from every span to its line-group's representative topPx.
        // This prevents individual spans whose style.top deviates slightly from
        // the group representative (e.g. price span at 19.9% vs dish name at
        // 20.3%) from falling into the PRECEDING dish's range in Pass 2.
        const spanGroupTop = new Map<HTMLElement, number>()
        for (const { topPx, spans: gSpans } of lineGroups) {
          for (const s of gSpans) { spanGroupTop.set(s, topPx) }
        }

        // Pass 2: extend every span inside a dish range.
        for (const span of textDivs) {
          // Use the group's representative topPx — not the span's own style.top —
          // so all spans in the same line group get the same range lookup result.
          const spanTop = spanGroupTop.get(span) ?? (spanTopVal(span))
          const range   = ranges.find(r => spanTop >= r.minTop && spanTop < r.maxTop)
          if (!range) continue

          const captured = range.dish
          span.style.width        = '100%'
          span.style.transform    = 'none'  // removes PDF.js scaleX; text is transparent
          span.style.pointerEvents = 'auto'
          if (!span.dataset.dishId) span.dataset.dishId = captured.id

          let moved  = false
          let startX = 0
          let startY = 0

          // Do NOT stopPropagation on touchstart: turn.js needs to receive the
          // event to detect swipe gestures (page turns). Taps are handled on
          // touchend after verifying the `moved` flag — a tap never triggers
          // a turn.js page flip because it has no displacement.
          span.addEventListener('touchstart', (evt) => {
            moved = false
            const t = evt.touches[0]
            if (t) { startX = t.clientX; startY = t.clientY }
          }, { passive: true })

          span.addEventListener('touchmove', (evt) => {
            const t = evt.touches[0]
            if (t && (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10)) {
              moved = true
            }
          }, { passive: true })

          // Tap confirmed on touchend: preventDefault stops the ghost-click.
          span.addEventListener('touchend', (evt) => {
            if (moved) return
            evt.preventDefault()
            evt.stopPropagation()
            onDishOpenRef.current?.(captured.id)
            setModalStack([captured])
          }, { passive: false })

          span.addEventListener('mousedown', (evt) => { evt.stopPropagation() })

          // Desktop / fallback (mouse): handled by click event.
          span.addEventListener('click', (evt) => {
            evt.stopPropagation()
            evt.preventDefault()
            onDishOpenRef.current?.(captured.id)
            setModalStack([captured])
          })
        }
      }

      pageDiv.style.position = 'relative'
      pageDiv.style.overflow = 'hidden'
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
            `background:${pageBgColor};` +
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
              // Disabilita SOLO gli angoli superiori: nessun giro pagina da tl/tr.
              // preventDefault è il meccanismo nativo di turn.js per annullare la
              // piega — gli angoli inferiori (bl/br) e lo swipe restano intatti.
              if (corner === 'tl' || corner === 'tr') {
                (_evt as any).preventDefault?.()
                return
              }
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
        el.addEventListener('touchstart', onBookTouchStart, { passive: true })
      } catch (err) {
        console.error('[FlipbookViewer] init fallito:', err)
        if (!cancelled) setLoadPhase('error')
      }
    })()

    return () => {
      cancelled = true
      el.removeEventListener('touchstart', onBookTouchStart)
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
  const pagOpt  = PAGINATION_OPTIONS[mn?.navigation.style ?? 'prec_succ']

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="fixed inset-0 h-[100dvh] overflow-hidden select-none outline-none [-webkit-tap-highlight-color:transparent] [&_*]:[-webkit-tap-highlight-color:transparent]"
      style={{
        background:  mn ? mn.background.color : theme.appBg,
        touchAction: 'none',
        fontFamily:  theme.fontSans,
        '--theme-accent-rgb': hexToRgb(mn?.accent ?? '#c9a96e'),
      } as React.CSSProperties}
    >

      {/* Menu background EFFECT layer — separate so its opacity & intensity are
          independently controllable; fades into the base colour beneath. */}
      {mn && mn.background.effect !== 'none' && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            ...menuBackgroundCss(mn.background),
            opacity: (mn.background.effectOpacity ?? 100) / 100,
            filter:  `contrast(${(mn.background.effectStrength ?? 100) / 100})`,
          }}
        />
      )}

      {/* Menu background image layer — sits behind the book, above the effect bg */}
      {mn?.background.image && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:    `url(${mn.background.image})`,
            backgroundSize:     'cover',
            backgroundPosition: 'center',
            opacity:            (mn.background.imageOpacity ?? 100) / 100,
          }}
        />
      )}

      {/* ──────────────────────────────────────────────────────────────────────
       *  FLIPBOOK LAYOUT
       *  bookRef è sempre nel DOM — garantisce che il ref sia valido prima
       *  ancora che la landing svanisca, e permette il preload del PDF.
       * ──────────────────────────────────────────────────────────────────────*/}
      <div className="absolute inset-0 flex flex-col">

        {/* ── A. Book stage — occupa tutto lo spazio fino alla nav bar ── */}
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
                  {uiText('loading', lang)}
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

            {/* ── Hint angolari — driven by theme.paginationStyle.
                 pointer-events-none: i click devono raggiungere gli angoli turn.js. */}
            {pagesReady && pagOpt.prev && (
              <span
                className="pointer-events-none absolute bottom-3 left-2 z-50 text-[10px] uppercase tracking-[0.2em] select-none"
                style={{
                  color:      theme.navColor,
                  opacity:    atFirst ? 0 : 0.6,
                  transition: 'opacity 0.25s ease',
                  fontFamily: theme.fontSans,
                }}
              >
                {pagOpt.prev}
              </span>
            )}
            {pagesReady && pagOpt.next && (
              <span
                className="pointer-events-none absolute bottom-3 right-2 z-50 text-[10px] uppercase tracking-[0.2em] select-none"
                style={{
                  color:      theme.navColor,
                  opacity:    atLast ? 0 : 0.6,
                  transition: 'opacity 0.25s ease',
                  fontFamily: theme.fontSans,
                }}
              >
                {pagOpt.next}
              </span>
            )}

            {/* ── Numero pagina — centrato tra prec. e succ., SOLO TESTO.
                 CATEGORICO: pointer-events-none e nessun handler — non deve mai
                 intercettare un tap, i click devono raggiungere i piatti e gli
                 angoli di turn.js sottostanti. ── */}
            {pagesReady && totalPages > 0 && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-50 text-[10px] tabular-nums select-none"
                style={{
                  color:      theme.navColor,
                  opacity:    0.6,
                  fontFamily: theme.fontSans,
                }}
              >
                {currentPage}/{totalPages}
              </span>
            )}

          </div>
        </div>

        {/* ── Edit toolbar — admin preview only, between book and category nav.
             Hidden on mobile: the chip bar already exposes these same targets. ── */}
        {editMode && pagesReady && !isMobilePreview && (
          <div
            className="shrink-0 flex items-center gap-2 px-3 overflow-x-auto"
            style={{
              height: 36,
              background: 'rgba(2,6,18,0.94)',
              borderTop: '1px solid rgba(96,165,250,0.25)',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            } as React.CSSProperties}
          >
            {([
              ['category-title',   'Categoria'],
              ['dish-title',       'Titolo'],
              ['dish-description', 'Descrizione'],
              ['dish-price',       'Prezzi'],
              ['allergens',        'Allergeni'],
              ['sticky-categories','Barra cat.'],
              ['background-layout','Sfondo & Layout'],
            ] as [string, string][]).map(([target, label]) => (
              <button
                key={target}
                className="shrink-0 px-3 py-1 text-[10px] uppercase tracking-widest transition-colors"
                style={{
                  border:       '1.5px dashed rgba(96,165,250,0.6)',
                  color:        'rgba(147,197,253,0.9)',
                  background:   'rgba(30,58,138,0.25)',
                  borderRadius: 3,
                  whiteSpace:   'nowrap',
                  touchAction:  'auto',
                }}
                onClick={() => onEditTarget?.(target)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ── B. Barra Categorie — sempre visibile quando il libro è pronto.
             Il tasto ← Menù è il primo elemento (sticky a sinistra) e il
             contatore pagine è l'ultimo (sticky a destra). Entrambi fanno
             parte del nav così condividono il medesimo z-[9999] blindato. ── */}
        {pagesReady && catStyle !== 'none' && (
          <nav
            ref={catNavRef}
            className="relative z-[9999] shrink-0 flex items-stretch overflow-x-auto pointer-events-auto"
            style={{
              background:    navBgComputed,
              borderTop:     `1px solid ${theme.textMuted}1a`,
              scrollbarWidth:'none',
              WebkitOverflowScrolling: 'touch',
            }}
            aria-label="Navigazione categorie menu"
          >
            {/* Tasto torna — sticky a sinistra, fuori dallo scroll orizzontale */}
            <button
              onClick={onBack}
              className="sticky left-0 shrink-0 px-4 py-3 text-[10px] uppercase tracking-[0.22em] transition-opacity duration-200 hover:opacity-50"
              style={{
                color:      theme.navColor,
                fontFamily: theme.fontSans,
                background: theme.navBgOpaque,
                borderRight:`1px solid ${theme.navColor}1a`,
              }}
            >
              {uiText('backToMenu', lang)}
            </button>

            {categories.map((cat, idx) => (
              <button
                key={cat.label}
                ref={el => { catBtnRefs.current[idx] = el }}
                onClick={() => handleCategoryClick(cat.targetPage, idx)}
                className="shrink-0 px-5 py-3 uppercase tracking-[0.22em] transition-all duration-200"
                style={{
                  color:        idx === activeCatIdx ? theme.navActive : theme.navInactive,
                  borderBottom: `2px solid ${idx === activeCatIdx ? theme.navActive : 'transparent'}`,
                  fontFamily:   theme.fontSans,
                  fontSize:     navFontSize,
                  background:   'transparent',
                }}
              >
                {cat.label}
              </button>
            ))}

            {/* Bandierina lingua — sticky a destra, al posto del vecchio
                 contatore pagine (ora in basso al centro, solo testuale). */}
            {onLangChange ? (
              <button
                onClick={() => setLangMenuOpen(o => !o)}
                aria-label={`Lingua: ${LANG_LABELS[lang]}`}
                className="sticky right-0 shrink-0 px-3.5 py-2.5 self-stretch ml-auto flex items-center transition-opacity duration-200 hover:opacity-70"
                style={{
                  background:  theme.navBgOpaque,
                  borderLeft: `1px solid ${theme.navColor}1a`,
                }}
              >
                <FlagIcon lang={lang} className="w-6 h-4" />
              </button>
            ) : totalPages > 0 ? (
              <span
                className="sticky right-0 shrink-0 px-4 py-3 text-[10px] tabular-nums self-center ml-auto"
                style={{
                  color:       theme.navColor,
                  fontFamily:  theme.fontSans,
                  background:  theme.navBgOpaque,
                  borderLeft: `1px solid ${theme.navColor}1a`,
                }}
              >
                {currentPage}/{totalPages}
              </span>
            ) : null}
          </nav>
        )}

      </div>

      {/* ── Selettore lingua — popover sopra la barra categorie ──────────────
           L'overlay trasparente chiude al tap fuori; touchAction auto perché il
           root ha touch-action:none. ── */}
      {langMenuOpen && onLangChange && (
        <>
          <div
            className="absolute inset-0 z-[10000]"
            style={{ touchAction: 'auto' }}
            onClick={() => setLangMenuOpen(false)}
          />
          <div
            className="absolute right-2 z-[10001] overflow-hidden shadow-2xl"
            style={{
              bottom:     (catNavRef.current?.offsetHeight ?? 44) + 8,
              background: theme.navBgOpaque,
              border:     `1px solid ${theme.navColor}33`,
              borderRadius: 6,
              touchAction: 'auto',
            }}
          >
            {ALL_LANGS.map(l => (
              <button
                key={l}
                onClick={() => { onLangChange(l); setLangMenuOpen(false) }}
                className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] transition-opacity hover:opacity-70"
                style={{
                  color:      l === lang ? theme.navActive : theme.navInactive,
                  fontFamily: theme.fontSans,
                }}
              >
                <FlagIcon lang={l} className="w-6 h-4 shrink-0" />
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Schermo scuro a tutto schermo durante caricamento — impedisce flash bianchi */}
      {!pagesReady && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ background: '#0c0c0c' }}
        >
          <span className="text-xs" style={{ color: theme.textMuted }}>
            {uiText('loading', lang)}
          </span>
        </div>
      )}

      {/* Dish modal — rendered outside the flipbook DOM to avoid z-index conflicts.
          modalStack[last] = currently visible dish; closing pops the stack. */}
      {modalStack.length > 0 && (
        <DishModal
          activeDish={modalStack[modalStack.length - 1]}
          allDishes={dishesRef.current}
          isNested={modalStack.length > 1}
          onClose={() => setModalStack([])}
          onBack={modalStack.length > 1 ? () => setModalStack(s => s.slice(0, -1)) : undefined}
          onOpenDish={(dish) => setModalStack(s => [...s, dish])}
          theme={themeProp}
          lang={lang}
        />
      )}


    </div>
  )
}
