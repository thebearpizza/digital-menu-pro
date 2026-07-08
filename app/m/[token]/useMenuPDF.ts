'use client'
// ─────────────────────────────────────────────────────────────────────────────
// useMenuPDF — generates a PDF blob URL from menu data.
//
// Architecture:
//   1. Dynamic-imports @react-pdf/renderer (never SSR-ed, avoids canvas errors).
//   2. Renders the MenuPDFDocument to a Blob and creates a URL.
//   3. Scans the generated PDF with PDF.js to detect on which page each
//      category section starts (robust to variable dish description lengths).
//   4. Returns { pdfUrl, categories, isGenerating, error }.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import type { PDFMenu, PDFRestaurant } from './MenuPDFDocument'
import { groupByCategory } from './MenuPDFDocument'
import type { RestaurantTheme } from '@/lib/theme'

// Same CDN as FlipbookViewer — script deduplication prevents double-loading.
const PDFJS_CDN    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

// Module-level dedup set (shared intent with FlipbookViewer's _loaded)
const _loaded = new Set<string>()
function requireScript(src: string): Promise<void> {
  if (_loaded.has(src)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { _loaded.add(src); resolve(); return }
    const s      = document.createElement('script')
    s.src        = src
    s.onload     = () => { _loaded.add(src); resolve() }
    s.onerror    = () => reject(new Error(`Script load failed: ${src}`))
    document.head.appendChild(s)
  })
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CategoryNav {
  label:      string
  targetPage: number
}

export interface UseMenuPDFResult {
  pdfUrl:      string | null
  categories:  CategoryNav[]
  isGenerating: boolean
  error:       string | null
}

// ── Diagnostica (overlay ?diag=1 sulla pagina pubblica) ──────────────────────
// Registra l'esito dell'ultima generazione: cosa ha trovato il rilevamento,
// quale percorso ha preso l'anello chiuso, eventuali errori catturati.
// Serve a diagnosticare i casi che si manifestano SOLO su certi dispositivi.
let lastDiag: Record<string, unknown> | null = null
export function getMenuPDFDiag(): Record<string, unknown> | null { return lastDiag }

// ── Category page detection ───────────────────────────────────────────────────

/**
 * Loads the generated PDF via PDF.js and finds the first page on which each
 * category title text appears.  Falls back to sequential estimation on error.
 *
 * Strategy: each category section is forced to start on a new page by the
 * <View break> in MenuPDFDocument, so the title is always at the top of its
 * page.  The cover is always page 1; category pages start at page 2+.
 */
async function detectCategoryPages(
  blobUrl:       string,
  categoryNames: string[],
  fallback:      CategoryNav[],
  startPage:     number,   // skip pages before this (embedded info/allergen pages)
  dishCatIdx:    Map<string, number>,  // dishId → indice categoria (ridondanza via marker piatto)
): Promise<{ categories: CategoryNav[], totalPages: number, confirmedIdx: Set<number>, error?: string }> {
  try {
    await requireScript(PDFJS_CDN)
    const lib = (window as any).pdfjsLib
    if (!lib) return { categories: fallback, totalPages: 0, confirmedIdx: new Set(), error: 'pdfjs assente' }
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER

    const pdfDoc   = await lib.getDocument(blobUrl).promise
    const numPages = pdfDoc.numPages as number

    const pageMap = new Map<number, number>()  // idx categoria → prima pagina (marker [[c:]])
    const dishMinPage = new Map<number, number>()  // idx categoria → pagina minima dei suoi piatti
    let pageErrors = 0

    // ── Passo 1: SOLO marker [[c:idx]] (Helvetica, vedi MenuPDFDocument) ──
    // I marker sono deterministici: estraibili anche quando il font custom del
    // titolo produce testo illeggibile, e presenti ESATTAMENTE sulla pagina
    // dell'header. Il match per nome NON va mai mescolato ai marker: un nome
    // di categoria può comparire nelle descrizioni dei piatti (o in estrazioni
    // sporche) di pagine precedenti e sposterebbe tutta la mappa etichette.
    const pageTexts: string[] = []   // testi (lowercased) per l'eventuale fallback nomi
    let anyMarker = false
    for (let p = startPage; p <= numPages && pageMap.size < categoryNames.length; p++) {
      // Una pagina illeggibile non deve far collassare TUTTO il rilevamento
      // sulle stime: si salta e si continua con le successive.
      try {
        const page = await pdfDoc.getPage(p)
        const tc   = await page.getTextContent()
        const text = (tc.items as any[]).map(i => i.str).join(' ').toLowerCase()
        pageTexts[p] = text
        // Versione senza spazi: @react-pdf spezza il marker in più item
        // ("[[" + "c:0]]") e il join(' ') inserirebbe uno spazio nel mezzo.
        const compact = text.replace(/\s+/g, '')
        const markerRe = /\[\[c:(\d+)\]\]/g
        let mm: RegExpExecArray | null
        while ((mm = markerRe.exec(compact)) !== null) {
          anyMarker = true
          const idx = Number(mm[1])
          if (idx >= 0 && idx < categoryNames.length && !pageMap.has(idx)) pageMap.set(idx, p)
        }
        // RIDONDANZA — marker dei PIATTI [[d:id]]: la pagina dell'header di una
        // categoria è per costruzione la pagina del suo primo piatto (l'header
        // e il primo piatto stanno sempre nello stesso blocco con break).
        // Su alcuni dispositivi singoli marker categoria possono non essere
        // estratti: la pagina MINIMA tra i piatti della categoria è una fonte
        // indipendente e statisticamente robusta (decine di marker per categoria).
        const dishRe = /\[\[d:([0-9a-fA-F-]{36})\]\]/g
        while ((mm = dishRe.exec(compact)) !== null) {
          anyMarker = true
          const cIdx = dishCatIdx.get(mm[1])
          if (cIdx !== undefined) {
            const prev = dishMinPage.get(cIdx)
            if (prev === undefined || p < prev) dishMinPage.set(cIdx, p)
          }
        }
      } catch { pageErrors++ }
    }

    // ── Passo 2: fallback per NOME — solo per documenti SENZA alcun marker ──
    // (PDF generati da versioni precedenti). In un documento con marker, una
    // categoria senza marker non esiste: meglio nessun match che un match falso.
    if (!anyMarker) {
      const pending = new Set(categoryNames.map((_, i) => i))
      for (let p = startPage; p <= numPages && pending.size > 0; p++) {
        const text = pageTexts[p] ?? (
          (await (await pdfDoc.getPage(p)).getTextContent()).items as any[]
        ).map((i: any) => i.str).join(' ').toLowerCase()
        Array.from(pending).forEach(idx => {
          if (text.includes(categoryNames[idx].toLowerCase())) {
            pageMap.set(idx, p)
            pending.delete(idx)
          }
        })
      }
    }

    // Fusione: dove il marker categoria manca, usa la pagina minima dei piatti
    // della categoria. Se entrambi presenti e discordi, vince la MINIMA (l'header
    // non può stare dopo il suo primo piatto).
    for (let i = 0; i < categoryNames.length; i++) {
      const fromDishes = dishMinPage.get(i)
      if (fromDishes === undefined) continue
      const fromMarker = pageMap.get(i)
      if (fromMarker === undefined || fromDishes < fromMarker) pageMap.set(i, fromDishes)
    }

    // Produci sempre una lista completa: pagina reale se trovata, stima se
    // mancante. Restituire result parziale (es. 1 su N categorie) nasconde le
    // tab rimanenti. Le stime sono clampate alla pagina della categoria
    // precedente: una tab non deve mai puntare prima della sezione che la precede.
    // confirmedIdx distingue le pagine REALI dalle stime: solo le prime possono
    // fare da confine per le etichette di continuazione.
    let lastPage = startPage
    const categories = categoryNames.map((name, i) => {
      const pg = pageMap.get(i) ?? Math.max(lastPage, fallback[i].targetPage)
      lastPage = pg
      return { label: name, targetPage: pg }
    })
    return {
      categories, totalPages: numPages, confirmedIdx: new Set(pageMap.keys()),
      error: pageErrors > 0 ? `${pageErrors} pagine illeggibili` : undefined,
    }
  } catch (e: any) {
    return { categories: fallback, totalPages: 0, confirmedIdx: new Set(), error: e?.message ?? 'detect fallita' }
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMenuPDF(
  restaurant: PDFRestaurant | null,
  menu:       PDFMenu | null,
  theme?:     RestaurantTheme,
): UseMenuPDFResult {
  const [result, setResult] = useState<UseMenuPDFResult>({
    pdfUrl: null, categories: [], isGenerating: false, error: null,
  })

  // Tracks the current active blob URL so we can revoke it at the right time.
  const activeUrlRef = useRef<string | null>(null)

  // Revoke the active URL on component unmount.
  useEffect(() => () => {
    if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current)
  }, [])

  // Stable string key for the custom-fonts map, so the regen effect below can
  // depend on a primitive instead of an inline expression (exhaustive-deps).
  const customFontsKey = theme?.customFonts ? JSON.stringify(theme.customFonts) : undefined

  useEffect(() => {
    // No menu or no dishes → show welcome screen.
    const hasContent = (menu?.dishes?.length ?? 0) > 0
    if (!menu || !restaurant || !hasContent) {
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current)
        activeUrlRef.current = null
      }
      setResult({ pdfUrl: null, categories: [], isGenerating: false, error: null })
      return
    }

    let cancelled = false
    setResult(r => ({ ...r, pdfUrl: null, isGenerating: true, error: null }))

    ;(async () => {
      try {
        // Dynamic imports — keeps @react-pdf/renderer out of the server bundle.
        const [{ createElement }, reactPdf, { MenuPDFDocument }, { registerThemeFonts }] = await Promise.all([
          import('react'),
          import('@react-pdf/renderer'),
          import('./MenuPDFDocument'),
          import('@/lib/pdfFonts'),
        ])
        if (cancelled) return
        const { pdf, Font } = reactPdf as any

        // Embed the real Google fonts chosen in the theme. Also register any
        // custom fonts used in embedded info/allergen pages.
        const extraPageFonts = [
          menu.extra_pages?.info?.enabled     ? (menu.extra_pages.info.font     ?? '') : '',
          menu.extra_pages?.allergen?.enabled ? (menu.extra_pages.allergen.font ?? '') : '',
        ]
        const registeredFonts = theme
          ? registerThemeFonts(Font, [
              theme.menu.dishes.titleFont,
              theme.menu.descriptions.font,
              theme.menu.prices.font,
              theme.menu.categories.font,
              ...extraPageFonts,
            ].filter(Boolean), theme.customFonts)
          : new Set<string>()

        // ── Generate PDF blob ──────────────────────────────────────────────────
        // Try with the embedded Google fonts first; if a font fails to load
        // (network/CORS), fall back to built-in fonts so the menu always renders.
        let blob: Blob
        let fontsUsed = registeredFonts
        try {
          blob = await (pdf as any)(
            createElement(MenuPDFDocument, { restaurant, menu, theme, registeredFonts: fontsUsed })
          ).toBlob()
        } catch {
          // Fallback ai font built-in. fontsUsed viene aggiornato COSÌ che anche
          // il secondo render (etichette) usi gli stessi font: font diversi tra
          // i due render = paginazione diversa = etichette sulle pagine sbagliate.
          fontsUsed = new Set<string>()
          blob = await (pdf as any)(
            createElement(MenuPDFDocument, { restaurant, menu, theme, registeredFonts: fontsUsed })
          ).toBlob()
        }
        if (cancelled) return

        const newUrl = URL.createObjectURL(blob)
        if (cancelled) { URL.revokeObjectURL(newUrl); return }

        // ── Rilevamento pagine categoria + etichette, ad ANELLO CHIUSO ────────
        // La mappa pagina→categoria viene costruita dalla scansione di un blob e
        // applicata a un ALTRO blob (il secondo render): qualsiasi deriva di
        // paginazione tra i due (font, ambiente, versioni) sposterebbe le
        // etichette sulle pagine sbagliate. Perciò NON si assume mai che i due
        // layout coincidano: dopo ogni render con etichette il blob prodotto
        // viene RI-SCANSIONATO e gli header verificati. Se non coincidono, la
        // mappa viene ricostruita dalla paginazione reale e si ri-renderizza
        // (converge, perché due render con le stesse prop sono deterministici).
        // Se anche il retry non converge: nessuna etichetta — mai etichette
        // sbagliate. Tab e navigazione usano SEMPRE la scansione del blob finale.
        const catGroups = groupByCategory(menu.dishes)
        const categoryNames = catGroups.map(c => c.name)
        // dishId → indice categoria: alimenta la ridondanza via marker piatto.
        const dishCatIdx = new Map<string, number>()
        catGroups.forEach((g, i) => { for (const d of g.dishes) dishCatIdx.set(d.id, i) })
        // Count embedded pages that appear BEFORE the dish categories (position:'first').
        // These pages occupy the first N pages of the PDF, so categories start at N+1.
        // The filter mirrors the logic in MenuPDFDocument's firstEmbedded array.
        const ep = menu.extra_pages
        const firstEmbedCount = [
          ep?.info?.enabled     && ep.info.position     === 'first' && ep.info.body?.trim(),
          ep?.allergen?.enabled && ep.allergen.position === 'first' && ep.allergen.body?.trim(),
        ].filter(Boolean).length
        const catStartPage = firstEmbedCount + 1
        const fallback: CategoryNav[] = categoryNames.map((name, i) => ({
          label: name, targetPage: catStartPage + i,
        }))
        const infoFirst     = !!(ep?.info?.enabled     && ep.info.position     === 'first' && ep.info.body?.trim())
        const allergenFirst = !!(ep?.allergen?.enabled && ep.allergen.position === 'first' && ep.allergen.body?.trim())
        const infoLast      = !!(ep?.info?.enabled     && ep.info.position     === 'last'  && ep.info.body?.trim())
        const allergenLast  = !!(ep?.allergen?.enabled && ep.allergen.position === 'last'  && ep.allergen.body?.trim())
        const alternating   =
          theme?.menu.pdfLayout === 'compact' && theme?.menu.compactMode === 'alternating'

        type Det = { categories: CategoryNav[]; totalPages: number; confirmedIdx: Set<number>; error?: string }
        const detectOn = (url: string): Promise<Det> =>
          detectCategoryPages(url, categoryNames, fallback, catStartPage, dishCatIdx)
        // Impronta della paginazione: pagine totali + pagina di OGNI header
        // confermato. Due blob con la stessa impronta hanno gli header negli
        // stessi punti → la mappa costruita sull'uno vale per l'altro.
        const headerKey = (d: Det): string =>
          d.totalPages + '|' + Array.from(d.confirmedIdx).sort((a, b) => a - b)
            .map(i => `${i}:${d.categories[i].targetPage}`).join(',')

        const buildContMap = (d: Det): Record<number, { label: string; flip: boolean }> | null => {
          if (d.totalPages <= 0 || d.categories.length === 0) return null
          const lastDishPage = d.totalPages - (infoLast ? 1 : 0) - (allergenLast ? 1 : 0)
          // Solo pagine di inizio CONFERMATE (marker) come confini: una stima
          // inietterebbe etichette della categoria sbagliata.
          const confirmedStarts = d.categories.filter((_, i) => d.confirmedIdx.has(i))
          const map: Record<number, { label: string; flip: boolean }> = {}
          for (let p = catStartPage; p <= lastDishPage; p++) {
            if (confirmedStarts.some(c => c.targetPage === p)) continue
            let active = -1
            d.categories.forEach((c, i) => {
              if (d.confirmedIdx.has(i) && c.targetPage <= p) active = i
            })
            if (active < 0) continue
            map[p] = { label: d.categories[active].label, flip: !!alternating && active % 2 === 1 }
          }
          return Object.keys(map).length > 0 ? map : null
        }
        const renderWithMap = async (map: Record<number, { label: string; flip: boolean }>): Promise<Blob> =>
          await (pdf as any)(
            createElement(MenuPDFDocument, { restaurant, menu, theme, registeredFonts: fontsUsed, contLabelMap: map })
          ).toBlob()

        let finalUrl = newUrl
        let det = await detectOn(newUrl)
        // Un fallimento TOTALE (totalPages=0 = eccezione catturata) produce
        // stime pure: tab sfasate e niente etichette. Vale un secondo tentativo
        // (su iOS il primo getDocument può fallire per pressione di memoria).
        if (det.totalPages === 0 && !cancelled) {
          det = await detectOn(newUrl)
        }
        if (cancelled) { URL.revokeObjectURL(newUrl); return }
        let diagPath = 'pass1'

        const map1 = buildContMap(det)
        if (map1) {
          try {
            const url2 = URL.createObjectURL(await renderWithMap(map1))
            if (cancelled) { URL.revokeObjectURL(url2); URL.revokeObjectURL(newUrl); return }
            const det2 = await detectOn(url2)
            if (cancelled) { URL.revokeObjectURL(url2); URL.revokeObjectURL(newUrl); return }

            if (headerKey(det2) === headerKey(det)) {
              // Verifica superata: gli header del blob etichettato coincidono
              // con la mappa applicata.
              finalUrl = url2
              det = det2
              diagPath = 'pass2-verificato'
              URL.revokeObjectURL(newUrl)
            } else {
              // Deriva di paginazione: ricostruisci la mappa dalla paginazione
              // REALE del blob etichettato e ri-renderizza.
              const map2 = buildContMap(det2)
              let converged = false
              if (map2) {
                const url3 = URL.createObjectURL(await renderWithMap(map2))
                if (cancelled) { URL.revokeObjectURL(url3); URL.revokeObjectURL(url2); URL.revokeObjectURL(newUrl); return }
                const det3 = await detectOn(url3)
                if (cancelled) { URL.revokeObjectURL(url3); URL.revokeObjectURL(url2); URL.revokeObjectURL(newUrl); return }
                if (headerKey(det3) === headerKey(det2)) {
                  finalUrl = url3
                  det = det3
                  diagPath = 'pass3-retry-convergente'
                  URL.revokeObjectURL(url2)
                  URL.revokeObjectURL(newUrl)
                  converged = true
                } else {
                  URL.revokeObjectURL(url3)
                }
              }
              if (!converged) {
                // Nessuna convergenza: meglio nessuna etichetta che etichette
                // sbagliate. Si usa il blob del primo render (det già = det1).
                diagPath = 'pass1-non-convergente'
                URL.revokeObjectURL(url2)
              }
            }
          } catch (e: any) { diagPath = 'pass1-errore-render2: ' + (e?.message ?? '?') }
        }

        // ── Tab categorie e pagine Info/Allergeni — dal blob FINALE ───────────
        const { categories: dishCats, totalPages } = det

        let infoPageNum:     number | null = null
        let allergenPageNum: number | null = null
        if (infoFirst)     infoPageNum     = 1
        if (allergenFirst) allergenPageNum = infoFirst ? 2 : 1
        if (infoLast && totalPages > 0)
          infoPageNum     = totalPages - (allergenLast ? 1 : 0)
        if (allergenLast && totalPages > 0)
          allergenPageNum = totalPages

        const categories: CategoryNav[] = []
        if (infoFirst     && infoPageNum     !== null) categories.push({ label: 'Info',      targetPage: infoPageNum })
        if (allergenFirst && allergenPageNum !== null) categories.push({ label: 'Allergeni', targetPage: allergenPageNum })
        categories.push(...dishCats)
        if (infoLast      && infoPageNum     !== null) categories.push({ label: 'Info',      targetPage: infoPageNum })
        if (allergenLast  && allergenPageNum !== null) categories.push({ label: 'Allergeni', targetPage: allergenPageNum })

        if (cancelled) { URL.revokeObjectURL(finalUrl); return }

        // Diagnostica per l'overlay ?diag=1 (vedi PublicMenuView).
        lastDiag = {
          menu: menu.name,
          percorso: diagPath,
          pagine: det.totalPages,
          headerConfermati: Array.from(det.confirmedIdx).sort((a, b) => a - b)
            .map(i => `${det.categories[i].label}→p${det.categories[i].targetPage}`),
          stime: det.categories.filter((_, i) => !det.confirmedIdx.has(i))
            .map(c => `${c.label}→p${c.targetPage}`),
          erroreDetect: det.error ?? null,
          fontFallback: fontsUsed !== registeredFonts,
          ts: new Date().toISOString(),
        }
        if (det.error || det.confirmedIdx.size < categoryNames.length) {
          try { console.warn('[DMP-diag]', JSON.stringify(lastDiag)) } catch {}
        }

        // Revoke the previous URL only after the new one is ready (no gap).
        if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current)
        activeUrlRef.current = finalUrl

        setResult({ pdfUrl: finalUrl, categories, isGenerating: false, error: null })
      } catch (err: any) {
        if (!cancelled) {
          setResult({
            pdfUrl: null, categories: [], isGenerating: false,
            error: err?.message ?? 'Errore nella generazione del menu.',
          })
        }
      }
    })()

    return () => { cancelled = true }
    // Regenerate whenever any PDF-affecting theme field changes, so the admin's
    // typography/layout/price sliders are reflected in the generated document.
  }, [
    menu?.id, menu?.lang, restaurant?.name,
    theme?.menu.accent, theme?.menu.pdfLayout,
    theme?.menu.pageBackground.color, theme?.menu.pageBackground.color2,
    theme?.menu.pageBackground.effect, theme?.menu.pageBackground.effectOpacity,
    theme?.menu.pageBackground.effectStrength, theme?.menu.pageBackground.image,
    theme?.menu.pageBackground.imageOpacity,
    theme?.menu.layout.dishLayout, theme?.menu.prices.format,
    theme?.menu.layout.divider.type, theme?.menu.layout.divider.color,
    theme?.menu.layout.dishSpacing,
    theme?.menu.dishes.titleSize, theme?.menu.descriptions.size, theme?.menu.prices.size,
    theme?.menu.categories.color, theme?.menu.categories.gapAfter, theme?.menu.dishes.titleColor,
    theme?.menu.descriptions.color, theme?.menu.prices.color,
    theme?.menu.dishes.titleFont, theme?.menu.descriptions.font,
    theme?.menu.prices.font, theme?.menu.categories.font,
    theme?.menu.categories.size,
    theme?.menu.layout.dishAlignment,
    // per-element alignment + price position/currency + allergen display
    theme?.menu.dishes.align, theme?.menu.descriptions.align,
    theme?.menu.prices.align, theme?.menu.categories.align,
    theme?.menu.prices.position, theme?.menu.prices.currency,
    theme?.menu.allergens.display, theme?.menu.allergens.separator,
    // new: allergen size/align, divider width, dishes-per-page, compact mode,
    // category flourishes
    theme?.menu.allergens.size, theme?.menu.allergens.align,
    theme?.menu.allergens.color,
    theme?.menu.layout.divider.width, theme?.menu.layout.divider.widthPercent, theme?.menu.layout.dishesPerPage,
    theme?.menu.compactMode,
    theme?.menu.categories.flourish, theme?.menu.categories.flourishColor,
    theme?.menu.categories.flourishWidth, theme?.menu.categories.flourishThickness,
    theme?.menu.layout.boxedBorderWidth,
    customFontsKey,
    // extra embedded pages — regenerate whenever content/formatting changes
    menu?.extra_pages?.info?.enabled,     menu?.extra_pages?.info?.body,
    menu?.extra_pages?.info?.font,        menu?.extra_pages?.info?.fontSize,
    menu?.extra_pages?.info?.align,       menu?.extra_pages?.info?.color,
    menu?.extra_pages?.info?.bold,        menu?.extra_pages?.info?.italic,
    menu?.extra_pages?.info?.lineHeight,  menu?.extra_pages?.info?.position,
    menu?.extra_pages?.allergen?.enabled, menu?.extra_pages?.allergen?.body,
    menu?.extra_pages?.allergen?.font,    menu?.extra_pages?.allergen?.fontSize,
    menu?.extra_pages?.allergen?.align,   menu?.extra_pages?.allergen?.color,
    menu?.extra_pages?.allergen?.bold,    menu?.extra_pages?.allergen?.italic,
    menu?.extra_pages?.allergen?.lineHeight, menu?.extra_pages?.allergen?.position,
  ]) // eslint-disable-line react-hooks/exhaustive-deps

  return result
}
