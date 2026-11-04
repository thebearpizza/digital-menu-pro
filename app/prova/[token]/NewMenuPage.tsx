import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import CurlMenu from './CurlMenu'
import { MENU_COLS, buildMenuData, fullLegend } from './menuData'
import { PAPER } from './typeset'
import { isMenuOpenNow, scheduleLabel } from '@/lib/menuSchedule'
import { parseStyle } from '@/lib/menuStyle'
import Landing, { type SocialKind } from './Landing'
import { initialLanding, parseLanding, type LandingMedia } from '@/lib/landingStyle'
import type { MenuTranslations } from '@/lib/translations'
import type { MenuChoice } from './i18n'

// Il menu (pagina d'apertura + menu a tutto schermo con giro pagina).
// Servito da due indirizzi con lo stesso contenuto:
//   /m/<token>      → il QR: conta visite e aperture;
//   /prova/<token>  → anteprime e prove, nessuna statistica.
// Senza ?menu=<id> si vede la pagina d'apertura, con ?menu=<id> quel menu.

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
    .from('menus').select(MENU_COLS)
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
  const { data, i18n, style, catalog } = await buildMenuData(supabase, restaurant as Row, chosen as Row, { schedules: true })
  const menu = chosen
  return <CurlMenu key={menu.id} data={data} i18n={i18n} token={token} base={base}
    // Stile del menu, se ne ha uno suo; altrimenti quello del ristorante.
    style={style} preview={preview}
    track={counted ? { restaurantId: restaurant.id as string, menuId: menu.id as string } : null}
    // Anteprima: elenco completo degli allergeni (la pagina si può accendere dal pannello).
    legendAll={preview ? fullLegend(catalog) : undefined} />
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
