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
): Promise<CategoryNav[]> {
  try {
    await requireScript(PDFJS_CDN)
    const lib = (window as any).pdfjsLib
    if (!lib) return fallback
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER

    const pdfDoc   = await lib.getDocument(blobUrl).promise
    const numPages = pdfDoc.numPages as number

    const pageMap  = new Map<string, number>()
    const pending  = new Set(categoryNames)

    // Scan from page 1 forward — stop early once all found.
    for (let p = 1; p <= numPages && pending.size > 0; p++) {
      const page   = await pdfDoc.getPage(p)
      const tc     = await page.getTextContent()
      const text   = (tc.items as any[]).map(i => i.str).join(' ').toLowerCase()

      Array.from(pending).forEach(name => {
        if (text.includes(name.toLowerCase())) {
          pageMap.set(name, p)
          pending.delete(name)
        }
      })
    }

    const result: CategoryNav[] = []
    for (const name of categoryNames) {
      const pg = pageMap.get(name)
      if (pg !== undefined) result.push({ label: name, targetPage: pg })
    }
    // Produci sempre una lista completa: pagina reale se trovata, sequenziale se mancante.
    // Restituire result parziale (es. 1 su N categorie) nasconde le tab rimanenti.
    return categoryNames.map((name, i) => ({
      label:      name,
      targetPage: pageMap.get(name) ?? fallback[i].targetPage,
    }))
  } catch {
    return fallback
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
    // No menu → show nothing (welcome screen will render instead).
    if (!menu || !restaurant || !menu.dishes.length) {
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

        // Embed the real Google fonts chosen in the theme so the PDF typography
        // matches the editor. Falls back to built-ins for anything unavailable.
        const registeredFonts = theme
          ? registerThemeFonts(Font, [
              theme.menu.dishes.titleFont,
              theme.menu.descriptions.font,
              theme.menu.prices.font,
              theme.menu.categories.font,
            ], theme.customFonts)
          : new Set<string>()

        // ── Generate PDF blob ──────────────────────────────────────────────────
        // Try with the embedded Google fonts first; if a font fails to load
        // (network/CORS), fall back to built-in fonts so the menu always renders.
        let blob: Blob
        try {
          blob = await (pdf as any)(
            createElement(MenuPDFDocument, { restaurant, menu, theme, registeredFonts })
          ).toBlob()
        } catch {
          blob = await (pdf as any)(
            createElement(MenuPDFDocument, { restaurant, menu, theme, registeredFonts: new Set<string>() })
          ).toBlob()
        }
        if (cancelled) return

        const newUrl = URL.createObjectURL(blob)
        if (cancelled) { URL.revokeObjectURL(newUrl); return }

        // ── Detect exact category page numbers ─────────────────────────────────
        const categoryNames = groupByCategory(menu.dishes).map(c => c.name)
        // Sequential fallback: cat1=1, cat2=2, …
        const fallback: CategoryNav[] = categoryNames.map((name, i) => ({
          label: name, targetPage: i + 1,
        }))

        const categories = await detectCategoryPages(newUrl, categoryNames, fallback)
        if (cancelled) { URL.revokeObjectURL(newUrl); return }

        // Revoke the previous URL only after the new one is ready (no gap).
        if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current)
        activeUrlRef.current = newUrl

        setResult({ pdfUrl: newUrl, categories, isGenerating: false, error: null })
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
    menu?.id, restaurant?.name,
    theme?.menu.accent, theme?.menu.pdfLayout,
    theme?.menu.pageBackground.color, theme?.menu.pageBackground.color2,
    theme?.menu.pageBackground.effect, theme?.menu.pageBackground.effectOpacity,
    theme?.menu.pageBackground.effectStrength, theme?.menu.pageBackground.image,
    theme?.menu.pageBackground.imageOpacity,
    theme?.menu.layout.dishLayout, theme?.menu.prices.format,
    theme?.menu.layout.divider.type, theme?.menu.layout.divider.color,
    theme?.menu.layout.dishSpacing,
    theme?.menu.dishes.titleSize, theme?.menu.descriptions.size, theme?.menu.prices.size,
    theme?.menu.categories.color, theme?.menu.dishes.titleColor,
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
    theme?.menu.layout.divider.width, theme?.menu.layout.dishesPerPage,
    theme?.menu.compactMode,
    theme?.menu.categories.flourish, theme?.menu.categories.flourishColor,
    theme?.menu.categories.flourishWidth, theme?.menu.categories.flourishThickness,
    theme?.menu.layout.boxedBorderWidth,
    customFontsKey,
  ]) // eslint-disable-line react-hooks/exhaustive-deps

  return result
}
