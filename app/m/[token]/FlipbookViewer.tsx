'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import DishModal, { DishData } from './DishModal'
import { useIsMobilePreview } from './EditHandle'
import { fontStack, hexToRgb, toOpaqueColor, PAGINATION_OPTIONS, menuBackgroundCss } from '@/lib/theme'
import type { RestaurantTheme } from '@/lib/theme'
import { ALL_LANGS, LANG_FLAGS, LANG_LABELS, uiText, type Lang } from '@/lib/translations'
import VerticalNotepadMenu, { type NotepadPage } from '@/components/experimental/VerticalNotepadMenu'

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
// DISH HOTSPOT MATCHING — funzioni pure condivise fra il flipbook (pagina per
// pagina) e la vista elenco scrollabile (tutte le pagine in sequenza).
// ═══════════════════════════════════════════════════════════════════════════════

type DishAnchor = { dish: DishData; topPx: number }

// Normalizzazione condivisa: niente spazi, maiuscolo, niente accenti.
// Lo spacing del PDF produce spazi inaffidabili tra i glifi e, con alcuni
// font custom, i caratteri accentati (à, é, ü, ñ...) vengono estratti da
// PDF.js come lettera base + segno diacritico separato (forma NFD) invece
// che come carattere precomposto (NFC) — o non vengono affatto mappati
// correttamente se il font non li contiene. Normalizzare a NFD e rimuovere
// i segni diacritici rende il confronto indipendente sia dalla forma
// Unicode sia dalla copertura glifi del font.
const squashText = (s: string) => s
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .replace(/\s+/g, '')
  .toUpperCase()

/**
 * Pass 1: identifica i piatti presenti nella pagina ricostruendo le righe
 * visive (gli span PDF.js sono spezzati per letterSpacing) e confrontandole
 * coi nomi piatto normalizzati. Vince il nome più lungo che fa match
 * "inizia con" (così "Margherita" e "Margherita di bufala" non si confondono);
 * i pareggi vengono disambiguati con la categoria della pagina corrente.
 */
function findDishAnchors(
  textDivs:   HTMLElement[],
  dishes:     DishData[],
  categories: Array<{ label: string; targetPage: number }>,
  pageNum:    number,
): DishAnchor[] {
  const dishNorms = dishes
    .map(d => ({ dish: d, n: squashText(d.name) }))
    .filter(x => x.n.length > 0)

  type Line = { top: number; spans: HTMLElement[] }
  const lines: Line[] = []
  for (const div of textDivs) {
    if (!(div.textContent ?? '').trim()) continue
    const top = parseFloat(div.style.top) || 0
    const line = lines.find(l => Math.abs(l.top - top) <= 3)
    if (line) line.spans.push(div)
    else lines.push({ top, spans: [div] })
  }

  let currentCat: string | undefined
  for (let i = 0; i < categories.length; i++) {
    if (pageNum >= categories[i].targetPage) currentCat = categories[i].label
  }

  const anchors: DishAnchor[] = []
  for (const line of lines) {
    line.spans.sort((a, b) => (parseFloat(a.style.left) || 0) - (parseFloat(b.style.left) || 0))
    const lineText = squashText(line.spans.map(s => s.textContent ?? '').join(''))
    if (!lineText) continue

    // Match se la riga INIZIA col nome del piatto. La riga del titolo può
    // contenere, oltre al nome, il prezzo e — con alcuni font che alterano
    // l'estrazione del testo — l'inizio della descrizione accorpato: per
    // questo non pretendiamo che il resto sia un prezzo. Vince il nome più
    // lungo, così "Margherita" e "Margherita di bufala" restano distinti.
    let best: DishData | undefined
    let bestLen = 0
    let tie = false
    for (const { dish, n } of dishNorms) {
      if (n.length < 4 || n.length < bestLen) continue
      if (lineText === n || lineText.startsWith(n)) {
        if (n.length > bestLen) { best = dish; bestLen = n.length; tie = false }
        else if (n.length === bestLen && best && dish.id !== best.id) { tie = true }
      }
    }
    if (!best) continue
    // Nomi identici su categorie diverse: disambigua con la categoria della pagina.
    if (tie) {
      const byCat = dishNorms.find(x => x.n === squashText(best!.name) && x.dish.category === currentCat)
      if (byCat) best = byCat.dish
    }

    const topPx = parseFloat(line.spans[0].style.top) || 0
    line.spans[0].dataset.dishId = best.id  // CSS gold-highlight
    anchors.push({ dish: best, topPx })
  }

  return anchors
}

/**
 * Pass 2: per ogni span nel range verticale [anchor.top, nextAnchor.top) —
 * l'ultimo piatto fino al footer (10% inferiore della pagina) — estende lo
 * span a piena larghezza e collega i listener click/touch che aprono la card.
 * L'altezza non viene mai toccata: nessun "bleed" verticale su righe di altri piatti.
 */
function attachDishHotspots(
  textDivs:       HTMLElement[],
  anchors:        DishAnchor[],
  viewportHeight: number,
  onOpenDish:     (dish: DishData) => void,
): void {
  if (anchors.length === 0) return
  const sorted = [...anchors].sort((a, b) => a.topPx - b.topPx)
  const footerCutoff = viewportHeight * 0.90  // exclude bottom 10%

  const ranges = sorted.map((anchor, i) => ({
    dish:   anchor.dish,
    minTop: anchor.topPx,
    maxTop: i < sorted.length - 1 ? sorted[i + 1].topPx : footerCutoff,
  }))

  for (const span of textDivs) {
    const spanTop = parseFloat(span.style.top) || 0
    const range   = ranges.find(r => spanTop >= r.minTop && spanTop < r.maxTop)
    if (!range) continue

    const captured = range.dish
    span.style.width        = '100%'
    span.style.transform    = 'none'  // removes PDF.js scaleX; text is transparent
    span.style.pointerEvents = 'auto'
    if (!span.dataset.dishId) span.dataset.dishId = captured.id

    // Stop touch/mouse events from ever reaching the turn.js container.
    // touchstart passive:true keeps scroll intent intact on the span itself.
    let moved   = false
    let startX  = 0
    let startY  = 0

    span.addEventListener('touchstart', (evt) => {
      evt.stopPropagation()
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

    // Apertura su touchend = singolo tap garantito (niente attesa del
    // click sintetico, niente "primo tap assorbito dall'hover" su iOS).
    // preventDefault sopprime il ghost-click successivo → nessun doppio fire.
    span.addEventListener('touchend', (evt) => {
      evt.stopPropagation()
      if (moved) return            // era uno swipe, non un tap
      evt.preventDefault()
      onOpenDish(captured)
    }, { passive: false })

    span.addEventListener('mousedown', (evt) => { evt.stopPropagation() })

    // Desktop / fallback (mouse): nessun touchend → questo gestisce il click.
    span.addEventListener('click', (evt) => {
      evt.stopPropagation()
      evt.preventDefault()
      onOpenDish(captured)
    })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ICONS — toggle vista elenco / sfogliabile
// ═══════════════════════════════════════════════════════════════════════════════
function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
      <rect x="4" y="3" width="16" height="5" rx="1" />
      <rect x="4" y="10" width="16" height="5" rx="1" />
      <rect x="4" y="17" width="16" height="4" rx="1" />
    </svg>
  )
}
function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
      <path d="M12 5c-1.8-1-4-1.4-6-1.2v13c2-.2 4.2.2 6 1.2 1.8-1 4-1.4 6-1.2V3.8c-2-.2-4.2.2-6 1.2z" />
      <line x1="12" y1="5" x2="12" y2="18" />
    </svg>
  )
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
  const [modalStack, setModalStack] = useState<DishData[]>([])

  // ── Vista elenco scrollabile — toggle alternativo al flipbook ───────────────
  // 'flipbook' = sfogliabile (default, comportamento invariato).
  // 'list'     = tutte le pagine del PDF impilate, scrollabili verticalmente.
  const [viewMode, setViewMode] = useState<'flipbook' | 'list'>('flipbook')
  const [listReady, setListReady] = useState(false)
  const listContainerRef = useRef<HTMLDivElement>(null)
  // Popolato dall'effect principale dopo la FASE 1 — riusato dalla vista
  // elenco per renderizzare le stesse pagine a una scala diversa.
  const pdfPageObjectsRef = useRef<any[]>([])
  // Evita di ri-renderizzare l'elenco se pdfUrl/dimensioni non sono cambiati
  // dall'ultima volta (es. toggle avanti e indietro senza resize).
  const listRenderKeyRef = useRef<string>('')

  // ── Modalità sperimentale "blocco notes" verticale ──────────────────────────
  // Opt-in via query param ?notepad=1, così il menu QR stabile (/m/[token])
  // resta identico: nessun impatto quando il parametro è assente.
  const [notepadEnabled, setNotepadEnabled] = useState(false)
  const [notepadPages,   setNotepadPages]   = useState<NotepadPage[]>([])
  const [notepadReady,   setNotepadReady]   = useState(false)
  useEffect(() => {
    try { setNotepadEnabled(new URLSearchParams(window.location.search).has('notepad')) } catch { /* SSR */ }
  }, [])

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

      // ── Chirurgical hotspot — pass 1 ricostruisce le righe visive e
      // identifica i piatti; pass 2 estende gli span del range di ciascun
      // piatto a piena larghezza e collega i listener click/touch. Logica
      // condivisa con la vista elenco scrollabile (findDishAnchors /
      // attachDishHotspots, definite a livello di modulo).
      const anchors = findDishAnchors(textDivs, dishesRef.current, categoriesRef.current, pageNum)
      attachDishHotspots(textDivs, anchors, viewport.height, (dish) => setModalStack([dish]))

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
        // Esposti via ref per la vista elenco scrollabile, che renderizza le
        // stesse pagine a una scala diversa senza re-iniziare questo effect.
        pdfPageObjectsRef.current = pdfPageObjects

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

  // Il libro si sta rigenerando (cambio PDF/dimensioni): la lista, se mostrata,
  // torna in stato "loading" finché le pagine sono pronte di nuovo.
  useEffect(() => { if (!pagesReady) setListReady(false) }, [pagesReady])

  // ── Vista elenco scrollabile — render indipendente dal flipbook ─────────────
  // Riusa gli oggetti pagina già caricati dall'effect principale (pdfPageObjectsRef)
  // e li disegna su canvas dedicati, impilati verticalmente, con lo stesso text
  // layer interattivo (findDishAnchors/attachDishHotspots) per i click sui piatti.
  // Non tocca in alcun modo il DOM/stato del flipbook (bookRef, turn.js).
  useEffect(() => {
    if (viewMode !== 'list' || !pagesReady) return
    const container = listContainerRef.current
    const pages     = pdfPageObjectsRef.current
    if (!container || !pages.length) return

    const renderKey = `${pdfUrl}:${dims?.w}:${dims?.h}:${pages.length}`
    if (listRenderKeyRef.current === renderKey && container.childElementCount > 0) {
      setListReady(true)
      return
    }

    let cancelled = false
    setListReady(false)

    ;(async () => {
      const lib = window.pdfjsLib
      container.innerHTML = ''
      const dpr      = Math.min(window.devicePixelRatio || 1, 2)
      const maxWidth = Math.min(container.clientWidth - 24, 720)
      if (maxWidth <= 0) return

      for (let i = 0; i < pages.length; i++) {
        if (cancelled) return
        const pdfPage  = pages[i]
        const naturalVP = pdfPage.getViewport({ scale: 1 })
        const scale     = maxWidth / naturalVP.width
        const renderVp  = pdfPage.getViewport({ scale: scale * dpr })

        const wrapper = document.createElement('div')
        wrapper.style.cssText =
          `position:relative;width:${maxWidth}px;height:${Math.round(renderVp.height / dpr)}px;` +
          `margin:0 auto 16px;background:${pageBgColor};overflow:hidden;` +
          `box-shadow:0 8px 30px rgba(0,0,0,0.35);`

        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(renderVp.width)
        canvas.height = Math.round(renderVp.height)
        canvas.style.cssText = 'display:block;width:100%;height:100%;'
        wrapper.appendChild(canvas)
        container.appendChild(wrapper)

        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = pageBgColor
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        try {
          await pdfPage.render({ canvasContext: ctx, viewport: renderVp }).promise
        } catch (err: any) {
          if (err?.name !== 'RenderingCancelledException') {
            console.warn('[FlipbookViewer] list render p.' + (i + 1) + ':', err)
          }
        }
        if (cancelled) return

        if (dishesRef.current.length > 0 && lib?.renderTextLayer) {
          const textViewport = pdfPage.getViewport({ scale })
          const tc = await pdfPage.getTextContent()
          const layer = document.createElement('div')
          layer.className = 'pdf-text-layer'
          layer.style.cssText = `width:${textViewport.width}px;height:${textViewport.height}px;overflow:hidden;`
          const textDivs: HTMLElement[] = []
          try {
            const task = lib.renderTextLayer({ textContent: tc, container: layer, viewport: textViewport, textDivs })
            await (task.promise ?? task)
            if (!cancelled) {
              const anchors = findDishAnchors(textDivs, dishesRef.current, categoriesRef.current, i + 1)
              attachDishHotspots(textDivs, anchors, textViewport.height, (dish) => setModalStack([dish]))
              wrapper.appendChild(layer)
            }
          } catch (err: any) {
            if (err?.name !== 'RenderingCancelledException') {
              console.warn('[FlipbookViewer] list text layer p.' + (i + 1) + ':', err)
            }
          }
        }
      }

      if (!cancelled) {
        listRenderKeyRef.current = renderKey
        setListReady(true)
      }
    })()

    return () => { cancelled = true }
  }, [viewMode, pagesReady, pdfUrl, dims?.w, dims?.h, pageBgColor])

  // ── Vista "blocco notes" verticale — render indipendente (sperimentale) ─────
  // Riusa gli oggetti pagina già caricati (pdfPageObjectsRef): disegna ogni
  // pagina su un canvas a misura schermo, la converte in immagine e la passa a
  // VerticalNotepadMenu come contenuto di un foglio. Non tocca il flipbook.
  useEffect(() => {
    if (!notepadEnabled || !pagesReady) return
    const pages = pdfPageObjectsRef.current
    if (!pages.length || !dims) return

    let cancelled = false
    setNotepadReady(false)

    ;(async () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const built: NotepadPage[] = []

      for (let i = 0; i < pages.length; i++) {
        if (cancelled) return
        const pdfPage   = pages[i]
        const naturalVP = pdfPage.getViewport({ scale: 1 })
        // "contain": l'intera pagina entra nello schermo (nessun crop).
        const fit       = Math.min(dims.w / naturalVP.width, dims.h / naturalVP.height)
        const renderVp  = pdfPage.getViewport({ scale: fit * dpr })

        const canvas  = document.createElement('canvas')
        canvas.width  = Math.round(renderVp.width)
        canvas.height = Math.round(renderVp.height)
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = pageBgColor
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        try {
          await pdfPage.render({ canvasContext: ctx, viewport: renderVp }).promise
        } catch (err: any) {
          if (err?.name !== 'RenderingCancelledException') {
            console.warn('[FlipbookViewer] notepad render p.' + (i + 1) + ':', err)
          }
        }
        if (cancelled) return

        const url = canvas.toDataURL('image/jpeg', 0.92)
        built.push({
          id: 'np-' + i,
          background: pageBgColor,
          content: (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                draggable={false}
                style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
              />
            </div>
          ),
        })
      }

      if (!cancelled) {
        setNotepadPages(built)
        setNotepadReady(true)
      }
    })()

    return () => { cancelled = true }
  }, [notepadEnabled, pagesReady, pdfUrl, dims?.w, dims?.h, pageBgColor]) // eslint-disable-line react-hooks/exhaustive-deps

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
        // 'none' blocca lo scroll/zoom nativo durante lo sfoglio (turn.js gestisce
        // i gesti); in vista elenco serve invece lo scroll verticale nativo.
        touchAction: viewMode === 'list' ? 'pan-y' : 'none',
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
                className="sticky right-0 shrink-0 px-4 py-3 text-base leading-none self-stretch ml-auto transition-opacity duration-200 hover:opacity-70"
                style={{
                  background:  theme.navBgOpaque,
                  borderLeft: `1px solid ${theme.navColor}1a`,
                }}
              >
                {LANG_FLAGS[lang]}
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

      {/* ── Vista elenco scrollabile — overlay opaco che copre il flipbook ────
           senza smontarlo: turn.js resta inizializzato sotto, pronto a
           ricomparire al toggle. La barra categorie sticky non viene mostrata
           qui; la bandierina lingua ha un suo bottone flottante. ── */}
      {viewMode === 'list' && (
        <div
          className="absolute inset-0 z-[10010]"
          style={{ background: mn ? mn.background.color : theme.appBg, touchAction: 'pan-y' }}
        >
          <div
            ref={listContainerRef}
            className="absolute inset-0 overflow-y-auto"
            style={{ padding: '56px 12px 32px', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' } as React.CSSProperties}
          />

          {!listReady && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ background: '#0c0c0c' }}
            >
              <span className="text-xs" style={{ color: theme.textMuted }}>
                {uiText('loading', lang)}
              </span>
            </div>
          )}

          {/* Bandierina lingua — in vista elenco non c'è la barra sticky che la
               ospitava: bottone flottante in alto a sinistra, simmetrico al
               toggle elenco/sfogliabile. */}
          {onLangChange && (
            <button
              onClick={() => setLangMenuOpen(o => !o)}
              aria-label={`Lingua: ${LANG_LABELS[lang]}`}
              className="absolute top-3 left-3 z-10 flex items-center justify-center w-9 h-9 rounded-full shadow-lg text-base leading-none transition-opacity hover:opacity-80"
              style={{ background: theme.navBgOpaque, border: `1px solid ${theme.navColor}33` }}
            >
              {LANG_FLAGS[lang]}
            </button>
          )}
        </div>
      )}

      {/* ── Modalità "blocco notes" verticale (sperimentale, ?notepad=1) ──────
           Overlay opaco sopra il flipbook: le pagine del PDF diventano fogli
           sfogliabili verticalmente con swipe verso l'alto. Il flipbook resta
           montato sotto, intatto. ── */}
      {notepadEnabled && (
        <div
          className="absolute inset-0 z-[10030]"
          style={{ background: mn ? mn.background.color : theme.appBg }}
        >
          {notepadReady && notepadPages.length > 0 ? (
            <VerticalNotepadMenu
              pages={notepadPages}
              accent={mn?.accent ?? '#c9a96e'}
              pageBackground={pageBgColor}
              pageBackBackground={pageBgColor}
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ background: '#0c0c0c' }}
            >
              <span className="text-xs" style={{ color: theme.textMuted }}>
                {uiText('loading', lang)}
              </span>
            </div>
          )}

          {/* Torna alla landing */}
          <button
            onClick={onBack}
            className="absolute top-3 left-3 z-10 px-4 py-2 rounded-full shadow-lg text-[10px] uppercase tracking-[0.22em] transition-opacity hover:opacity-70"
            style={{
              color:      theme.navColor,
              fontFamily: theme.fontSans,
              background: theme.navBgOpaque,
              border:     `1px solid ${theme.navColor}33`,
            }}
          >
            {uiText('backToMenu', lang)}
          </button>
        </div>
      )}

      {/* ── Toggle flipbook ⇄ elenco — sempre visibile in alto a destra una
           volta pronto il libro. Diventa il tasto "torna allo sfogliabile"
           quando la vista elenco è attiva. Nascosto in modalità blocco notes. ── */}
      {pagesReady && !notepadEnabled && (
        <button
          onClick={() => setViewMode(v => v === 'flipbook' ? 'list' : 'flipbook')}
          aria-label={viewMode === 'flipbook' ? 'Vista elenco scorrevole' : 'Torna allo sfogliabile'}
          className="absolute top-3 right-3 z-[10020] flex items-center justify-center w-9 h-9 rounded-full shadow-lg transition-opacity hover:opacity-80"
          style={{
            background:  theme.navBgOpaque,
            color:       theme.navColor,
            border:      `1px solid ${theme.navColor}33`,
            touchAction: 'auto',
          }}
        >
          {viewMode === 'flipbook' ? <ListIcon /> : <BookIcon />}
        </button>
      )}

      {/* ── Selettore lingua — popover sopra la barra categorie (sfogliabile)
           o sopra la bandierina flottante (elenco). L'overlay trasparente
           chiude al tap fuori; touchAction auto perché il root, in modalità
           sfogliabile, ha touch-action:none. ── */}
      {langMenuOpen && onLangChange && (
        <>
          <div
            className="absolute inset-0"
            style={{ zIndex: viewMode === 'list' ? 10015 : 10000, touchAction: 'auto' }}
            onClick={() => setLangMenuOpen(false)}
          />
          <div
            className="absolute overflow-hidden shadow-2xl"
            style={{
              zIndex: viewMode === 'list' ? 10016 : 10001,
              ...(viewMode === 'list'
                ? { top: 52, left: 12 }
                : { right: 8, bottom: (catNavRef.current?.offsetHeight ?? 44) + 8 }),
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
                <span className="text-base leading-none">{LANG_FLAGS[l]}</span>
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
