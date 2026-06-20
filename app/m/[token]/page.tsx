import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PublicMenuView from './PublicMenuView'
import { parseTheme, googleFontsUrl, allThemeFonts, customFontFaceCss, themeRootCssVars } from '@/lib/theme'
import { isMenuOpenNow } from '@/lib/menuSchedule'

// The /m/[token] URL pattern is the printed QR contract — this path must never change.
// See CLAUDE.md → "URL del QR code stabile per sempre"

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Menu',
  robots: { index: false, follow: false },
}

export default async function PublicMenuPage({
  params,
}: {
  params: { token: string }
}) {
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, description, logo_url, instagram_url, facebook_url, website_url, tripadvisor_url, google_maps_url, visibility, theme_config, hint_translations')
    .eq('qr_public_token', params.token)
    .eq('is_active', true)
    .single()

  if (!restaurant) notFound()

  // Track QR scan — awaited so the insert completes before response is sent
  try {
    await supabase.from('page_views').insert({ restaurant_id: restaurant.id })
  } catch {}

  const [{ data: rawMenus }, { data: banners }, { data: info }] = await Promise.all([
    supabase
      .from('menus')
      .select('id, name, sort_order, category_order, schedule_enabled, schedule_from, schedule_until, translations, text_content')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('restaurant_banners')
      .select('id, media_url, media_type, title, subtitle')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('restaurant_info')
      .select('title, content')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  // Programmazione oraria: i menu fuori fascia spariscono dal menu pubblico
  // (la pagina è force-dynamic, quindi il filtro è valutato a ogni richiesta).
  const visibleMenus = (rawMenus ?? []).filter(m => isMenuOpenNow(m as any))

  const menus = await Promise.all(
    visibleMenus.map(async menu => {
      const categoryOrder = (menu as any).category_order as string[] | null

      const { data: dishes } = await supabase
        .from('dishes')
        .select('id, name, description, price, category, image_url, allergens, sort_order, pairing_dish_id, pairing_label, translations')
        .eq('menu_id', menu.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      // Sort dishes respecting admin-defined category order; unknown categories
      // go alphabetically at the end.
      const sorted = (dishes ?? []).slice().sort((a, b) => {
        const catA = (a.category as string | null) ?? 'Menu'
        const catB = (b.category as string | null) ?? 'Menu'
        if (catA === catB) return (a.sort_order as number) - (b.sort_order as number)
        if (categoryOrder) {
          const iA = categoryOrder.indexOf(catA)
          const iB = categoryOrder.indexOf(catB)
          const rankA = iA === -1 ? Infinity : iA
          const rankB = iB === -1 ? Infinity : iB
          if (rankA !== rankB) return rankA - rankB
        }
        return catA.localeCompare(catB)
      })

      return {
        id:           menu.id as string,
        name:         menu.name as string,
        translations: ((menu as any).translations ?? {}) as Record<string, any>,
        extra_pages: (menu as any).text_content ?? null,
        dishes: sorted.map(d => ({
          id:              d.id as string,
          name:            d.name as string,
          description:     d.description as string | null,
          price:           d.price as number | null,
          category:        (d.category as string | null) ?? 'Menu',
          image_url:       d.image_url as string | null,
          allergens:       (d.allergens as number[] | null) ?? [],
          pairing_dish_id: d.pairing_dish_id as string | null,
          pairing_label:   d.pairing_label as string | null,
          translations:    ((d as any).translations ?? {}) as Record<string, any>,
        })),
      }
    })
  )

  // If only one menu, auto-select it (skips welcome screen)
  const defaultMenuId = menus.length === 1 ? menus[0].id : null

  // Fonts + CSS vars rendered server-side: the first HTML paint already has the
  // final typography and colors, instead of flashing fallback fonts/defaults
  // until the client-side ThemeFontLoader/ThemeInjector effects run.
  const theme       = parseTheme((restaurant as any).theme_config)
  const customNames = new Set(Object.keys(theme.customFonts))
  const fontsHref   = googleFontsUrl(allThemeFonts(theme).filter(f => !customNames.has(f)))
  const customCss   = customFontFaceCss(theme.customFonts)

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {fontsHref && <link rel="stylesheet" href={fontsHref} data-theme-fonts="1" />}
      {customCss && <style data-custom-fonts="1" dangerouslySetInnerHTML={{ __html: customCss }} />}
      <style dangerouslySetInnerHTML={{ __html: themeRootCssVars(theme, defaultMenuId) }} />
      <PublicMenuView
        restaurant={{
          name:             restaurant.name as string,
          description:      restaurant.description as string | null,
          logo_url:         restaurant.logo_url as string | null,
          instagram_url:    restaurant.instagram_url as string | null,
          facebook_url:     restaurant.facebook_url as string | null,
          website_url:      restaurant.website_url as string | null,
          tripadvisor_url:  restaurant.tripadvisor_url as string | null,
          google_maps_url:  restaurant.google_maps_url as string | null,
          visibility:       (restaurant.visibility ?? null) as Record<string, boolean> | null,
          theme,
          hintTranslations: ((restaurant as any).hint_translations ?? {}) as Record<string, any>,
        }}
        menus={menus}
        banners={(banners ?? []) as any[]}
        info={info ?? null}
        defaultMenuId={defaultMenuId}
        restaurantId={restaurant.id as string}
      />
    </>
  )
}
