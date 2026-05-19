import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MenuViewerWithShortcuts } from './MenuViewerWithShortcuts'
import { buildMenuPdfPayload } from '@/lib/pdf/buildPayload'
import { ensureMenuPdfCached } from '@/lib/pdf/getMenuPdfData'

// L'endpoint pubblico /m/[token] è il contratto stampato sui QR.
// Vedi CLAUDE.md → "URL del QR code stabile per sempre".
// Questa pagina deve sempre rispondere all'URL /m/[token] esistente.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Menu',
  robots: { index: false, follow: false },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
}

export default async function PublicMenuPage({
  params,
}: {
  params: { token: string }
}) {
  const supabase = await createClient()

  const result = await buildMenuPdfPayload(supabase, params.token)
  if ('error' in result) {
    notFound()
  }

  const { payload, restaurantId, cacheKey, dishesById, menus, categoriesByMenu } = result

  // Garantisce PDF + posizioni in cache, le riusa se già esistenti.
  // Fallback senza overlay/positions se l'env del service role manca (es. preview deploy).
  let dishPositions: import('@/lib/pdf/generateMenuPdf').DishPosition[] = []
  let totalPages = 1
  try {
    const cached = await ensureMenuPdfCached(payload, restaurantId, cacheKey)
    dishPositions = cached.dishPositions
    totalPages = cached.totalPages
  } catch (err) {
    console.error('[m/token] ensureMenuPdfCached failed:', err)
    // Stima totalPages a priori: 1 (scelta) + ogni menu (copertina + categorie).
    totalPages = 1
    for (const menu of menus) {
      totalPages += 1 + (categoriesByMenu[menu.id]?.length ?? 0)
    }
  }

  // pageNumberByCategory: ricavato dalle posizioni reali del PDF (più preciso del calcolo a priori).
  const pageNumberByCategory: Record<string, number> = {}
  for (const pos of dishPositions) {
    const dish = dishesById[pos.id]
    if (!dish || !dish.category) continue
    const key = `${dish.menu_id}:${dish.category}`
    if (!pageNumberByCategory[key] || pos.pageNumber < pageNumberByCategory[key]) {
      pageNumberByCategory[key] = pos.pageNumber
    }
  }

  // Fallback per pageNumberByCategory se non abbiamo posizioni dal PDF.
  if (dishPositions.length === 0) {
    let pageNum = 2
    for (const menu of menus) {
      pageNum++ // copertina menu
      for (const category of categoriesByMenu[menu.id] ?? []) {
        pageNumberByCategory[`${menu.id}:${category}`] = pageNum
        pageNum++
      }
    }
  }

  // Info piatti per la card di dettaglio (id → dati completi).
  const dishesInfo: Record<string, {
    id: string
    name: string
    description: string | null
    price: number | null
    category: string | null
    image_url: string | null
    allergens: string[] | null
  }> = {}
  for (const id in dishesById) {
    const d = dishesById[id]
    dishesInfo[id] = {
      id: d.id,
      name: d.name,
      description: d.description,
      price: d.price,
      category: d.category,
      image_url: d.image_url,
      allergens: d.allergens,
    }
  }

  const pdfUrl = `/api/menu-pdf/${encodeURIComponent(params.token)}`
  const viewerUrl = `/pdf-viewer/external/pdfjs-2.1.266-dist/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`

  return (
    <MenuViewerWithShortcuts
      viewerUrl={viewerUrl}
      restaurantName={payload.restaurant.name}
      menus={menus}
      categoriesByMenu={categoriesByMenu}
      pageNumberByCategory={pageNumberByCategory}
      totalPages={totalPages}
      dishPositions={dishPositions}
      dishesInfo={dishesInfo}
    />
  )
}

