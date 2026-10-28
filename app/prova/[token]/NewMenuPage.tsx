import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import CurlMenu from './CurlMenu'
import { PAPER, mediaViews, type Dish, type MenuData } from './typeset'
import { ALLERGENS, allergenName, allergenNumber, type AllergenCatalog } from '@/lib/allergens'
import { isCategoryOpenNow, isMenuOpenNow, isWindowOpenNow, scheduleLabel, type CategorySchedules } from '@/lib/menuSchedule'
import { parseRichText } from './richText'
import { parseStyle } from '@/lib/menuStyle'
import { parseFrame, parseRect } from '@/lib/photoFrame'
import { fromOldAds, parseMedia } from '@/lib/menuMedia'
import Landing, { type SocialKind } from './Landing'
import { initialLanding, parseLanding, type LandingMedia } from '@/lib/landingStyle'
import type { DishTranslations, MenuTranslations } from '@/lib/translations'
import type { I18nData, MenuChoice } from './i18n'

// Nuovo menu (pagina d'apertura + menu a tutto schermo con giro pagina).
// Servito da due indirizzi con lo stesso contenuto:
//   /m/<token>      → il QR, per i ristoranti con il nuovo menu attivo
//                     (restaurants.new_menu): conta visite e aperture;
//   /prova/<token>  → anteprime e prove, nessuna statistica.
// Senza ?menu=<id> si vede la pagina d'apertura, con ?menu=<id> quel menu.

const DISH_COLS = 'id, name, description, price, category, allergens, sort_order, image_url, image_original_url, image_crop, photo_frame, pairing_dish_id, pairing_label, translations, schedule_enabled, schedule_from, schedule_until'
// Nome con cui il gestionale mostra (e programma) i piatti senza categoria.
const NO_CATEGORY = 'Senza categoria'

type TextPage = { enabled?: boolean; body?: string; position?: 'first' | 'last'; align?: 'left' | 'center' | 'right' }
type Row = Record<string, unknown>

export const NEW_MENU_METADATA: Metadata = {
  title: 'Menu',
  robots: { index: false, follow: false },
  // viewport-fit=cover: la pagina va sotto notch e barra home (i margini del
  // testo rispettano le aree sicure).
  viewport: 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  themeColor: PAPER,
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Menu' },
}

export interface NewMenuSearch { menu?: string; preview?: string; from?: string }

export default async function NewMenuPage({ token, searchParams, base, live }: {
  token: string
  searchParams: NewMenuSearch
  /** Indirizzo di partenza dei collegamenti interni: '/m' o '/prova'. */
  base: '/m' | '/prova'
  /** Menu vero sul QR: registra visite (page_views) e aperture (menu_events). */
  live: boolean
}) {
  const supabase = await createClient()
  const preview = searchParams.preview === '1'
  // Non contano le aperture dall'anteprima del gestionale né il ritorno dal
  // menu alla pagina d'apertura (stessa visita).
  const counted = live && !preview && searchParams.from !== 'admin' && searchParams.from !== 'menu'

  const { data: restaurant } = await supabase
    .from('restaurants').select('id, name, owner_id, theme_config, menu_style, landing_style, description, logo_url, instagram_url, facebook_url, website_url, tripadvisor_url, google_maps_url, legal_name, vat_number, legal_address, visibility')
    .eq('qr_public_token', token).eq('is_active', true).single()
  if (!restaurant) notFound()

  const { data: allMenus } = await supabase
    .from('menus').select('id, name, category_order, translations, schedule_enabled, schedule_from, schedule_until, category_schedules, text_content, menu_style, media_pages')
    .eq('restaurant_id', restaurant.id).eq('is_active', true)
    .order('sort_order', { ascending: true })
  // Programmazione oraria: fuori fascia un menu non si vede (come nel menu pubblico).
  const menus = (allMenus ?? []).filter(m => isMenuOpenNow(m as Parameters<typeof isMenuOpenNow>[0]))
  if (!menus.length) notFound()
  const choices: MenuChoice[] = menus.map(m => ({
    id: m.id as string, name: m.name as string,
    translations: (m.translations ?? {}) as MenuTranslations,
    hours: scheduleLabel(m as Parameters<typeof scheduleLabel>[0]),
    paper: parseStyle(m.menu_style ?? (restaurant as Row).menu_style).page.paper,
  }))

  // Nessun menu scelto: pagina d'apertura (anche con un solo menu).
  const chosen = menus.find(m => m.id === searchParams.menu)
  if (!chosen) {
    // Una visita = un'apertura della pagina d'apertura (come il vecchio menu,
    // che contava ogni apertura di /m/<token>).
    if (counted) {
      try { await supabase.from('page_views').insert({ restaurant_id: restaurant.id }) } catch { /* non blocca il menu */ }
    }
    const [{ data: bannerRows }, { data: photoRows }] = await Promise.all([
      supabase
        .from('restaurant_banners').select('id, media_url, media_type, title, subtitle')
        .eq('restaurant_id', restaurant.id).eq('is_active', true)
        .order('sort_order', { ascending: true }),
      // Foto dei primi piatti di ogni menu (≈ prime due pagine), da
      // precaricare mentre si sceglie il menu.
      supabase
        .from('dishes').select('menu_id, image_url, image_original_url, category, sort_order')
        .in('menu_id', menus.map(m => m.id as string)).eq('is_active', true).not('image_url', 'is', null)
        .order('sort_order', { ascending: true }),
    ])
    for (const c of choices) {
      const m = menus.find(x => x.id === c.id)!
      const order: string[] = Array.isArray(m.category_order) ? m.category_order : []
      const rank = (cat: string | null) => { const i = order.indexOf(cat ?? ''); return i < 0 ? order.length : i }
      const images = (photoRows ?? []).filter(d => d.menu_id === c.id)
        .sort((a, b) => rank(a.category as string | null) - rank(b.category as string | null))
        .slice(0, 8).map(d => ((d.image_original_url as string | null) || d.image_url) as string)
      c.preload = { style: parseStyle(m.menu_style ?? (restaurant as Row).menu_style), images }
    }
    const r = restaurant as Row
    // Stile della pagina d'apertura; chi non ne ha ancora uno parte da quello
    // che c'è già (banner e logo del menu attuale, sfondo del vecchio tema).
    const old = oldLanding(r.theme_config)
    let media: LandingMedia[] = (bannerRows ?? []).filter(b => b.media_url).map(b => ({
      id: b.id as string, url: b.media_url as string, video: b.media_type === 'video', poster: null,
      title: (b.title as string | null) || null, subtitle: (b.subtitle as string | null) || null, startAt: 0, boomerang: null,
    }))
    if (!media.length && old.background) media = [old.background]
    const landing = r.landing_style
      ? parseLanding(r.landing_style)
      : initialLanding(media, (r.logo_url as string | null) || old.logo)
    // Elementi nascosti dal ristoratore (Dati del ristorante → visibilità).
    const vis = (r.visibility ?? {}) as Record<string, boolean | undefined>
    const shown = (k: string) => vis[k] !== false
    const socialCols: [SocialKind, string, string][] = [
      ['instagram', 'instagram_url', 'instagram'], ['facebook', 'facebook_url', 'facebook'], ['tripadvisor', 'tripadvisor_url', 'tripadvisor'],
      ['maps', 'google_maps_url', 'google_maps'], ['website', 'website_url', 'website'],
    ]
    return (
      <Landing token={token} base={base} menus={choices} style={landing} preview={preview} fromAdmin={searchParams.from === 'admin'}
        restaurant={{
          name: r.name as string,
          description: shown('description') ? (r.description as string | null) || null : null,
          hide: { logo: !shown('logo'), name: !shown('name') },
          socials: socialCols.filter(([, col, key]) => r[col] && shown(key)).map(([kind, col]) => ({ kind, url: r[col] as string })),
          legalName: (r.legal_name as string | null) || null,
          vat: (r.vat_number as string | null) || null,
          address: (r.legal_address as string | null) || null,
        }} />
    )
  }
  const menu = chosen

  // Programmazione oraria di piatti e categorie: fuori fascia non compaiono.
  const catSchedules = (menu.category_schedules ?? {}) as CategorySchedules
  const dishOpen = (d: Row) => isWindowOpenNow(d.schedule_enabled as boolean | null, d.schedule_from as string | null, d.schedule_until as string | null)

  const [{ data: allDishes }, { data: overrides }] = await Promise.all([
    supabase
      .from('dishes').select(DISH_COLS)
      .eq('menu_id', menu.id).eq('is_active', true)
      .order('sort_order', { ascending: true }),
    // Nomi/numeri degli allergeni personalizzati dall'account del ristorante.
    supabase.from('allergen_overrides').select('items').eq('user_id', restaurant.owner_id).maybeSingle(),
  ])
  const catalog = (overrides?.items ?? null) as AllergenCatalog
  const dishes = (allDishes ?? []).filter(d => dishOpen(d as Row) && isCategoryOpenNow(catSchedules[(d.category as string | null) || NO_CATEGORY]))

  // Abbinamenti: il piatto consigliato può stare in un altro menu del ristorante.
  const pairIds = Array.from(new Set(dishes.map(d => d.pairing_dish_id as string | null).filter((x): x is string => !!x)))
  const { data: pairRows } = pairIds.length
    ? await supabase.from('dishes').select(`${DISH_COLS}, menus!inner(restaurant_id, translations)`)
        .in('id', pairIds).eq('is_active', true).eq('menus.restaurant_id', restaurant.id)
    : { data: [] as Row[] }

  const toDish = (d: Row, withPairing: boolean): Dish => {
    // Un abbinamento fuori orario non si propone.
    const pair = withPairing && d.pairing_dish_id ? (pairRows ?? []).find(p => p.id === d.pairing_dish_id && dishOpen(p as Row)) : null
    return {
      id: d.id as string,
      name: d.name as string,
      description: (d.description as string | null) || null,
      price: d.price === null ? null : Number(d.price),
      allergens: ((d.allergens as unknown[] | null) ?? []).map(Number).filter(id => id > 0)
        .map(id => ({ id, n: allergenNumber(id, catalog), name: allergenName(id, 'it', catalog) })),
      // L'originale intero: il riquadro del formato scelto lo inquadra.
      image: (d.image_original_url as string | null) || (d.image_url as string | null) || null,
      frame: parseFrame(d.photo_frame),
      focus: d.image_original_url ? parseRect(d.image_crop) : null,
      category: ((d.category as string | null) ?? '') || NO_CATEGORY,
      pairing: pair ? { label: (d.pairing_label as string | null) || null, dish: toDish(pair as Row, false) } : null,
    }
  }

  // Categorie: prima l'ordine salvato nel menu, poi le altre nell'ordine in cui
  // compaiono i piatti.
  const order: string[] = Array.isArray(menu.category_order) ? [...menu.category_order] : []
  for (const d of dishes) {
    const c = (d.category as string | null) ?? ''
    if (!order.includes(c)) order.push(c)
  }
  const data: MenuData = {
    restaurantName: restaurant.name as string,
    menuName: menu.name as string,
    categories: order.map(name => ({
      name: name || NO_CATEGORY,
      dishes: dishes
        .filter(d => ((d.category as string | null) ?? '') === name)
        .map(d => toDish(d, true)),
    })).filter(c => c.dishes.length > 0),
    info: infoPage(menu.text_content),
    allergenLegend: allergenLegendOf(menu.text_content, catalog),
    labels: { allergens: 'Allergeni', cont: 'segue', allergenNote: '' },
    media: mediaViews(menu.media_pages === null || menu.media_pages === undefined
      ? fromOldAds((restaurant as Row).theme_config, menu.id as string)
      : parseMedia(menu.media_pages), dishes.map(d => toDish(d as Row, true))),
  }

  // Traduzioni (generate dal gestionale): la lingua si sceglie sul telefono.
  const trOf = (r: Row) => (r.translations ?? {}) as DishTranslations
  const i18n: I18nData = {
    menu: (menu.translations ?? {}) as MenuTranslations,
    dishes: Object.fromEntries([...dishes, ...(pairRows ?? [])].map(d => [d.id as string, trOf(d as Row)])),
    pairMenus: Object.fromEntries((pairRows ?? []).map(d => {
      const m = (d as Row).menus as { translations?: MenuTranslations } | null
      return [d.id as string, (m?.translations ?? {}) as MenuTranslations]
    })),
    catalog,
  }

  return <CurlMenu key={menu.id} data={data} i18n={i18n} token={token} base={base}
    // Stile del menu, se ne ha uno suo; altrimenti quello del ristorante.
    style={parseStyle(menu.menu_style ?? (restaurant as Row).menu_style)} preview={preview}
    track={counted ? { restaurantId: restaurant.id as string, menuId: menu.id as string } : null} />
}

// ── Pagine di testo del menu ─────────────────────────────────────────────────

/** Pagina informativa del ristoratore (se attiva e non vuota). */
function infoPage(tc: unknown): MenuData['info'] {
  const info = (tc as { info?: TextPage } | null)?.info
  if (!info?.enabled) return null
  const blocks = parseRichText(info.body, info.align ?? 'left')
  return blocks.length ? { position: info.position === 'last' ? 'last' : 'first', blocks } : null
}

/** Legenda allergeni: se il ristoratore ha attivato la pagina allergeni, viene
 *  generata dal suo elenco (nomi e numeri personalizzati, tradotta); il testo
 *  scritto a mano nel gestionale non serve più. */
function allergenLegendOf(tc: unknown, catalog: AllergenCatalog): MenuData['allergenLegend'] {
  const page = (tc as { allergen?: TextPage } | null)?.allergen
  if (!page?.enabled) return null
  return ALLERGENS
    .map(a => ({ id: a.id, n: allergenNumber(a.id, catalog), name: allergenName(a.id, 'it', catalog) }))
    .sort((a, b) => a.n - b.n)
}

/** File della vecchia pagina d'apertura (sfondo foto/video, logo). */
function oldLanding(theme: unknown): { background: LandingMedia | null; logo: string | null } {
  const l = (theme as { landing?: { background?: { type?: string; value?: string; poster?: string }; logo?: { image?: string } } } | null)?.landing
  const bg = l?.background
  const media = bg && bg.value && (bg.type === 'image' || bg.type === 'video' || bg.type === 'gif')
  return {
    background: media
      ? { id: 'landing-bg', url: bg!.value!, video: bg!.type === 'video', poster: bg!.poster || null, title: null, subtitle: null, startAt: 0, boomerang: null }
      : null,
    logo: l?.logo?.image || null,
  }
}
