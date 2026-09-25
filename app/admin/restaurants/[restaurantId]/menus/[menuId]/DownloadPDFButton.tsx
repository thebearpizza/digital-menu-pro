'use client'

import { useState } from 'react'
import type { RestaurantTheme } from '@/lib/theme'
import type { MenuExtraPages } from '../menuExtraPages'
import { Spinner } from '@/components/ui/Spinner'

interface PDFDishMin {
  id:          string
  name:        string
  description: string | null
  price:       number | null
  category:    string
  allergens:   number[]
}

interface Props {
  restaurantName: string
  menuId:         string
  menuName:       string
  dishes:         PDFDishMin[]
  extraPages:     MenuExtraPages | null
  theme:          RestaurantTheme
  // true quando il bottone è annegato nella riga azioni unificata di
  // DishList (tablet/desktop): riempie la cella flex che lo ospita invece
  // di restare dimensionato al proprio contenuto come nel posizionamento
  // originale accanto al breadcrumb (mobile, invariato — vedi page.tsx).
  fill?: boolean
}

export default function DownloadPDFButton({
  restaurantName, menuId, menuName, dishes, extraPages, theme, fill,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleDownload() {
    if (!dishes.length) return
    setLoading(true)
    setError(null)
    try {
      const [{ createElement }, reactPdf, { MenuPDFDocument }, { registerThemeFonts }] = await Promise.all([
        import('react'),
        import('@react-pdf/renderer'),
        import('@/app/m/[token]/MenuPDFDocument'),
        import('@/lib/pdfFonts'),
      ])
      const { pdf, Font } = reactPdf as any

      const extraFonts = [
        extraPages?.info?.enabled     ? (extraPages.info.font     ?? '') : '',
        extraPages?.allergen?.enabled ? (extraPages.allergen.font ?? '') : '',
      ]
      const registeredFonts = registerThemeFonts(
        Font,
        [
          theme.menu.dishes.titleFont,
          theme.menu.descriptions.font,
          theme.menu.prices.font,
          theme.menu.categories.font,
          ...extraFonts,
        ].filter(Boolean),
        theme.customFonts,
      )

      const restaurant = { name: restaurantName }
      const menu = { id: menuId, name: menuName, lang: 'it' as const, dishes, extra_pages: extraPages }

      let blob: Blob
      try {
        blob = await pdf(createElement(MenuPDFDocument, { restaurant, menu, theme, registeredFonts })).toBlob()
      } catch {
        blob = await pdf(createElement(MenuPDFDocument, { restaurant, menu, theme, registeredFonts: new Set<string>() })).toBlob()
      }

      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `${restaurantName} - ${menuName}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.message ?? 'Errore nella generazione del PDF.')
    } finally {
      setLoading(false)
    }
  }

  // fill=false (default): posizionamento originale accanto al breadcrumb
  // (mobile) — stile e dimensionamento invariati. fill=true: annegato nella
  // riga azioni unificata di DishList (tablet/desktop) — stessa identica
  // classe flex-1 min-w-[140px] degli altri bottoni della riga, e lo stesso
  // stile uniforme (bordo grigio, non più il proprio look leggermente
  // diverso) per non essere "il bottone diverso dagli altri" nella riga.
  return (
    <div className={fill ? 'flex-1 min-w-[140px] flex items-center gap-2' : 'flex items-center gap-2'}>
      {error && <span className="text-xs text-red-500 max-w-[200px] truncate" title={error}>{error}</span>}
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading || !dishes.length}
        title={!dishes.length ? 'Aggiungi piatti per scaricare il PDF' : 'Scarica PDF del menu'}
        className={
          fill
            ? 'w-full flex items-center justify-center gap-1.5 text-sm font-medium border border-gray-300 text-gray-700 px-4 py-2 hover:bg-blue-600 hover:text-white hover:border-blue-600 active:bg-blue-700 active:border-blue-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-700 disabled:hover:border-gray-300 transition-colors'
            : 'flex items-center gap-1.5 text-sm border border-gray-300 text-gray-600 px-3 py-1.5 hover:border-gray-500 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
        }
      >
        {loading ? (
          <><Spinner size={4} /><span>Generando…</span></>
        ) : (
          <>
            <svg width="13" height="15" viewBox="0 0 13 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.5 1v9M3 7l3.5 3.5L10 7"/>
              <path d="M1 12.5h11" strokeWidth="1.8"/>
            </svg>
            <span>Scarica PDF</span>
          </>
        )}
      </button>
    </div>
  )
}
