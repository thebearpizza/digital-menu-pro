import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { parseStyle } from '@/lib/menuStyle'
import { initialLanding, parseLanding, type LandingMedia } from '@/lib/landingStyle'
import LandingEditor from '../LandingEditor'

// Personalizzazione della pagina d'apertura del nuovo menu (dove si sceglie
// il menu). Chi non ha ancora uno stile parte da foto/video e logo che ha già.
export default async function LandingStylePage({ params }: { params: { restaurantId: string } }) {
  const supabase = await createClient()
  const [{ data: restaurant }, { data: banners }, { data: menus }] = await Promise.all([
    supabase.from('restaurants').select('id, qr_public_token, landing_style, logo_url, theme_config, menu_style').eq('id', params.restaurantId).single(),
    supabase.from('restaurant_banners').select('id, media_url, media_type, title, subtitle')
      .eq('restaurant_id', params.restaurantId).eq('is_active', true).order('sort_order', { ascending: true }),
    supabase.from('menus').select('menu_style').eq('restaurant_id', params.restaurantId).eq('is_active', true),
  ])
  if (!restaurant?.qr_public_token) notFound()

  let style
  if (restaurant.landing_style) style = parseLanding(restaurant.landing_style)
  else {
    const l = (restaurant.theme_config as { landing?: { background?: { type?: string; value?: string; poster?: string }; logo?: { image?: string } } } | null)?.landing
    let media: LandingMedia[] = (banners ?? []).filter(b => b.media_url).map(b => ({
      id: b.id as string, url: b.media_url as string, video: b.media_type === 'video', poster: null,
      title: (b.title as string | null) || null, subtitle: (b.subtitle as string | null) || null, startAt: 0, boomerang: null,
    }))
    const bg = l?.background
    if (!media.length && bg?.value && (bg.type === 'image' || bg.type === 'video' || bg.type === 'gif')) {
      media = [{ id: 'landing-bg', url: bg.value, video: bg.type === 'video', poster: bg.poster || null, title: null, subtitle: null, startAt: 0, boomerang: null }]
    }
    style = initialLanding(media, (restaurant.logo_url as string | null) || l?.logo?.image || null)
  }

  // Caratteri già caricati negli stili dei menu: si possono usare anche qui.
  const menuFonts = new Map<string, ReturnType<typeof parseStyle>['customFonts'][number]>()
  for (const m of [...(menus ?? []).map(x => x.menu_style), restaurant.menu_style]) {
    for (const f of parseStyle(m).customFonts) menuFonts.set(f.id, f)
  }

  return (
    <LandingEditor restaurantId={params.restaurantId} token={restaurant.qr_public_token as string}
      initialStyle={style} menuFonts={Array.from(menuFonts.values())} saved={!!restaurant.landing_style} />
  )
}
