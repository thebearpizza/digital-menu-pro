'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/Spinner'

interface Props {
  restaurantId:   string
  restaurantName: string
}

export default function DownloadAllPDFButton({ restaurantId, restaurantName }: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleDownload() {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()

      // 1. Load restaurant theme
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('theme_config')
        .eq('id', restaurantId)
        .single()

      // 2. Load all active menus
      const { data: menus } = await supabase
        .from('menus')
        .select('id, name, text_content')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (!menus?.length) {
        setError('Nessun menu attivo trovato.')
        return
      }

      // 3. Load dishes for each menu
      const dishPromises = menus.map(m =>
        supabase
          .from('dishes')
          .select('id, name, description, price, category, allergens, sort_order, is_active')
          .eq('menu_id', m.id)
          .eq('is_active', true)
          .order('category')
          .order('sort_order')
      )
      const dishResults = await Promise.all(dishPromises)

      // 4. Lazy-load heavy deps
      const [{ createElement }, reactPdf, { MenuPDFDocument }, { registerThemeFonts }, { parseTheme }, { PDFDocument }] = await Promise.all([
        import('react'),
        import('@react-pdf/renderer'),
        import('@/app/m/[token]/MenuPDFDocument'),
        import('@/lib/pdfFonts'),
        import('@/lib/theme'),
        import('pdf-lib').then(m => ({ PDFDocument: m.PDFDocument })),
      ])
      const { pdf, Font } = reactPdf as any

      const theme = parseTheme((restaurant as any)?.theme_config ?? null)

      // 5. Generate a PDF blob per menu, then merge
      const pdfBytes: Uint8Array[] = []

      for (let i = 0; i < menus.length; i++) {
        const menu   = menus[i]
        const dishes = (dishResults[i].data ?? []).map((d: any) => ({
          id:          d.id as string,
          name:        d.name as string,
          description: (d.description ?? null) as string | null,
          price:       (d.price ?? null) as number | null,
          category:    d.category as string,
          allergens:   (d.allergens ?? []) as number[],
        }))

        const rawPages = (menu as any).text_content
        const { defaultExtraPages } = await import('@/app/admin/restaurants/[restaurantId]/menus/menuExtraPages')
        const extraPages = (rawPages?.info || rawPages?.allergen)
          ? rawPages
          : defaultExtraPages()

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

        const menuObj = { id: menu.id, name: menu.name, lang: 'it' as const, dishes, extra_pages: extraPages }
        const restObj = { name: restaurantName }

        let blob: Blob
        try {
          blob = await pdf(createElement(MenuPDFDocument, { restaurant: restObj, menu: menuObj, theme, registeredFonts })).toBlob()
        } catch {
          blob = await pdf(createElement(MenuPDFDocument, { restaurant: restObj, menu: menuObj, theme, registeredFonts: new Set<string>() })).toBlob()
        }

        pdfBytes.push(new Uint8Array(await blob.arrayBuffer()))
      }

      // 6. Merge all PDFs into one
      const merged = await PDFDocument.create()
      for (const bytes of pdfBytes) {
        const src   = await PDFDocument.load(bytes)
        const pages = await merged.copyPages(src, src.getPageIndices())
        pages.forEach(p => merged.addPage(p))
      }
      const mergedBytes = await merged.save()

      // 7. Trigger download
      const blob = new Blob([mergedBytes], { type: 'application/pdf' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${restaurantName} - tutti i menu.pdf`
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

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-red-500 max-w-[160px] truncate" title={error}>
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        title="Scarica PDF unico con tutti i menu"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <Spinner size={4} />
        ) : (
          <svg width="13" height="15" viewBox="0 0 13 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 1v9M3 7l3.5 3.5L10 7"/>
            <path d="M1 12.5h11" strokeWidth="1.8"/>
          </svg>
        )}
        <span>PDF</span>
      </button>
    </div>
  )
}
