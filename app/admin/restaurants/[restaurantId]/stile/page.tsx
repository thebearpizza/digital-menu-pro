import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { parseStyle } from '@/lib/menuStyle'
import { fromOldAds, parseMedia } from '@/lib/menuMedia'
import StyleEditor from './StyleEditor'
import QrSwitch from './QrSwitch'
import type { MenuTextPages } from './actions'

// Personalizzazione del nuovo menu: anteprima vera del menu e comandi accanto.
// Ogni menu ha il suo stile; chi non ne ha uno usa quello del ristorante.
export default async function StylePage({ params }: { params: { restaurantId: string } }) {
  const supabase = await createClient()
  const [{ data: restaurant }, { data: menus }] = await Promise.all([
    supabase.from('restaurants').select('id, qr_public_token, menu_style, new_menu, theme_config').eq('id', params.restaurantId).single(),
    supabase.from('menus').select('id, name, menu_style, media_pages, category_order, text_content').eq('restaurant_id', params.restaurantId).eq('is_active', true).order('sort_order', { ascending: true }),
  ])
  if (!restaurant?.qr_public_token) notFound()

  // Piatti attivi (per le pagine foto/video: categorie e piatto collegato).
  const { data: dishes } = await supabase.from('dishes')
    .select('id, menu_id, name, category, price, image_url, image_original_url, sort_order')
    .in('menu_id', (menus ?? []).map(m => m.id as string)).eq('is_active', true)
    .order('sort_order', { ascending: true })
  const menuDishes = (id: string) => (dishes ?? []).filter(d => d.menu_id === id).map(d => ({
    id: d.id as string, name: d.name as string, category: ((d.category as string | null) || 'Senza categoria'),
    price: d.price === null ? null : Number(d.price), image: (d.image_original_url as string | null) || (d.image_url as string | null) || null,
  }))
  const menuCategories = (m: { id: unknown; category_order: unknown }) => {
    const order = Array.isArray(m.category_order) ? [...(m.category_order as string[])] : []
    for (const d of menuDishes(m.id as string)) if (!order.includes(d.category)) order.push(d.category)
    const used = new Set(menuDishes(m.id as string).map(d => d.category))
    return order.filter(c => used.has(c))
  }

  return (<>
    <QrSwitch restaurantId={params.restaurantId} token={restaurant.qr_public_token as string} initial={restaurant.new_menu === true} />
    <StyleEditor
      restaurantId={params.restaurantId}
      token={restaurant.qr_public_token as string}
      menus={(menus ?? []).map(m => ({
        id: m.id as string, name: m.name as string,
        style: parseStyle(m.menu_style ?? restaurant.menu_style),
        // Mai configurate qui: le vecchie pubblicità del tema, convertite.
        media: m.media_pages === null ? fromOldAds(restaurant.theme_config, m.id as string) : parseMedia(m.media_pages),
        categories: menuCategories(m),
        dishes: menuDishes(m.id as string),
        text: textPagesOf(m.text_content),
      }))}
    />
  </>)
}

/** Pagine di testo del nuovo menu (pagina informativa e allergeni). */
function textPagesOf(tc: unknown): MenuTextPages {
  const t = (tc ?? {}) as { info?: Record<string, unknown>; allergen?: Record<string, unknown> }
  const i = t.info ?? {}
  return {
    info: {
      enabled: i.enabled === true,
      position: i.position === 'last' ? 'last' : 'first',
      body: typeof i.body === 'string' ? i.body : '',
      align: i.align === 'center' || i.align === 'right' ? i.align : 'left',
    },
    allergen: { enabled: t.allergen?.enabled === true },
  }
}
