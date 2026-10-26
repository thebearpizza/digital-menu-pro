import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import CurlMenu from './CurlMenu'
import { PAPER, type MenuData } from './typeset'

// Prototipo "pageCurl": menu a tutto schermo, una pagina alla volta.
// Indirizzo di prova separato da /m/[token] (QR): nessun effetto sui clienti.
//   /prova/<token>            → primo menu attivo
//   /prova/<token>?menu=<id>  → un menu specifico

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Menu',
  robots: { index: false, follow: false },
  // viewport-fit=cover: la pagina va sotto notch e barra home (i margini del
  // testo rispettano le aree sicure).
  viewport: 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  themeColor: PAPER,
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Menu' },
}

export default async function ProvaPage({
  params, searchParams,
}: { params: { token: string }; searchParams: { menu?: string } }) {
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants').select('id, name')
    .eq('qr_public_token', params.token).eq('is_active', true).single()
  if (!restaurant) notFound()

  const { data: menus } = await supabase
    .from('menus').select('id, name, category_order')
    .eq('restaurant_id', restaurant.id).eq('is_active', true)
    .order('sort_order', { ascending: true })
  const menu = (menus ?? []).find(m => m.id === searchParams.menu) ?? (menus ?? [])[0]
  if (!menu) notFound()

  const { data: dishes } = await supabase
    .from('dishes').select('id, name, description, price, category, allergens, sort_order')
    .eq('menu_id', menu.id).eq('is_active', true)
    .order('sort_order', { ascending: true })

  // Categorie: prima l'ordine salvato nel menu, poi le altre nell'ordine in cui
  // compaiono i piatti.
  const order: string[] = Array.isArray(menu.category_order) ? [...menu.category_order] : []
  for (const d of dishes ?? []) {
    const c = (d.category as string | null) ?? ''
    if (!order.includes(c)) order.push(c)
  }
  const data: MenuData = {
    restaurantName: restaurant.name as string,
    menuName: menu.name as string,
    categories: order.map(name => ({
      name: name || 'Altro',
      dishes: (dishes ?? [])
        .filter(d => ((d.category as string | null) ?? '') === name)
        .map(d => ({
          id: d.id as string,
          name: d.name as string,
          description: (d.description as string | null) ?? null,
          price: d.price === null ? null : Number(d.price),
          allergens: (d.allergens as number[] | null) ?? [],
        })),
    })).filter(c => c.dishes.length > 0),
  }

  return <CurlMenu data={data} />
}
