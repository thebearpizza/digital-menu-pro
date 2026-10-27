import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import CurlMenu from './CurlMenu'
import { PAPER, type Dish, type MenuData } from './typeset'
import { allergenName, allergenNumber, type AllergenCatalog } from '@/lib/allergens'
import { isMenuOpenNow } from '@/lib/menuSchedule'
import type { DishTranslations, MenuTranslations } from '@/lib/translations'
import type { I18nData, MenuChoice } from './i18n'

// Prototipo "pageCurl": menu a tutto schermo, una pagina alla volta.
// Indirizzo di prova separato da /m/[token] (QR): nessun effetto sui clienti.
//   /prova/<token>            → primo menu attivo
//   /prova/<token>?menu=<id>  → un menu specifico

export const dynamic = 'force-dynamic'

const DISH_COLS = 'id, name, description, price, category, allergens, sort_order, image_url, pairing_dish_id, pairing_label, translations'
type Row = Record<string, unknown>

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
    .from('restaurants').select('id, name, owner_id')
    .eq('qr_public_token', params.token).eq('is_active', true).single()
  if (!restaurant) notFound()

  const { data: allMenus } = await supabase
    .from('menus').select('id, name, category_order, translations, schedule_enabled, schedule_from, schedule_until')
    .eq('restaurant_id', restaurant.id).eq('is_active', true)
    .order('sort_order', { ascending: true })
  // Programmazione oraria: fuori fascia un menu non si vede (come nel menu pubblico).
  const menus = (allMenus ?? []).filter(m => isMenuOpenNow(m as Parameters<typeof isMenuOpenNow>[0]))
  const menu = menus.find(m => m.id === searchParams.menu) ?? menus[0]
  if (!menu) notFound()

  const [{ data: dishes }, { data: overrides }] = await Promise.all([
    supabase
      .from('dishes').select(DISH_COLS)
      .eq('menu_id', menu.id).eq('is_active', true)
      .order('sort_order', { ascending: true }),
    // Nomi/numeri degli allergeni personalizzati dall'account del ristorante.
    supabase.from('allergen_overrides').select('items').eq('user_id', restaurant.owner_id).maybeSingle(),
  ])
  const catalog = (overrides?.items ?? null) as AllergenCatalog

  // Abbinamenti: il piatto consigliato può stare in un altro menu del ristorante.
  const pairIds = Array.from(new Set((dishes ?? []).map(d => d.pairing_dish_id as string | null).filter((x): x is string => !!x)))
  const { data: pairRows } = pairIds.length
    ? await supabase.from('dishes').select(`${DISH_COLS}, menus!inner(restaurant_id, translations)`)
        .in('id', pairIds).eq('is_active', true).eq('menus.restaurant_id', restaurant.id)
    : { data: [] as Row[] }

  const toDish = (d: Row, withPairing: boolean): Dish => {
    const pair = withPairing && d.pairing_dish_id ? (pairRows ?? []).find(p => p.id === d.pairing_dish_id) : null
    return {
      id: d.id as string,
      name: d.name as string,
      description: (d.description as string | null) || null,
      price: d.price === null ? null : Number(d.price),
      allergens: ((d.allergens as unknown[] | null) ?? []).map(Number).filter(id => id > 0)
        .map(id => ({ id, n: allergenNumber(id, catalog), name: allergenName(id, 'it', catalog) })),
      image: (d.image_url as string | null) || null,
      category: ((d.category as string | null) ?? '') || 'Altro',
      pairing: pair ? { label: (d.pairing_label as string | null) || null, dish: toDish(pair as Row, false) } : null,
    }
  }

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
        .map(d => toDish(d, true)),
    })).filter(c => c.dishes.length > 0),
    labels: { allergens: 'Allergeni', cont: 'segue' },
  }

  // Traduzioni (generate dal gestionale): la lingua si sceglie sul telefono.
  const trOf = (r: Row) => (r.translations ?? {}) as DishTranslations
  const i18n: I18nData = {
    menu: (menu.translations ?? {}) as MenuTranslations,
    dishes: Object.fromEntries([...(dishes ?? []), ...(pairRows ?? [])].map(d => [d.id as string, trOf(d as Row)])),
    pairMenus: Object.fromEntries((pairRows ?? []).map(d => {
      const m = (d as Row).menus as { translations?: MenuTranslations } | null
      return [d.id as string, (m?.translations ?? {}) as MenuTranslations]
    })),
    catalog,
  }
  const choices: MenuChoice[] = menus.map(m => ({ id: m.id as string, name: m.name as string, translations: (m.translations ?? {}) as MenuTranslations }))

  return <CurlMenu key={menu.id} data={data} i18n={i18n} menus={choices} menuId={menu.id as string} token={params.token} />
}
