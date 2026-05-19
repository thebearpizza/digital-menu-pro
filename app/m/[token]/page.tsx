import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MenuViewerWithShortcuts } from './MenuViewerWithShortcuts'

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

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('qr_public_token', params.token)
    .single()

  if (!restaurant) notFound()

  // Query categorie per i shortcut
  const { data: menus } = await supabase
    .from('menus')
    .select('id, name')
    .eq('restaurant_id', restaurant.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const menuIds = menus?.map((m) => m.id) || []
  const { data: dishes } = await supabase
    .from('dishes')
    .select('category, menu_id')
    .in('menu_id', menuIds)
    .order('sort_order', { ascending: true })

  // Raggruppa categorie per menu
  const categoriesByMenu: Record<string, string[]> = {}
  if (dishes) {
    for (const dish of dishes) {
      if (dish.category) {
        if (!categoriesByMenu[dish.menu_id]) {
          categoriesByMenu[dish.menu_id] = []
        }
        if (!categoriesByMenu[dish.menu_id].includes(dish.category)) {
          categoriesByMenu[dish.menu_id].push(dish.category)
        }
      }
    }
  }

  const pdfUrl = `/api/menu-pdf/${encodeURIComponent(params.token)}`
  const viewerUrl = `/pdf-viewer/external/pdfjs-2.1.266-dist/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`

  return (
    <MenuViewerWithShortcuts
      viewerUrl={viewerUrl}
      restaurantName={restaurant.name}
      menus={menus || []}
      categoriesByMenu={categoriesByMenu}
    />
  )
}
