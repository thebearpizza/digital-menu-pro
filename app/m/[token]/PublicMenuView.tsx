'use client'
// ─────────────────────────────────────────────────────────────────────────────
// PublicMenuView — client wrapper for /m/[token].
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'
import FlipbookViewer  from './FlipbookViewer'
import { useMenuPDF }  from './useMenuPDF'
import {
  googleFontsUrl, fontStack, borderRadiusPx, hexToRgb, parseTheme,
} from '@/lib/theme'
import type { RestaurantTheme } from '@/lib/theme'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Dish {
  id:              string
  name:            string
  description:     string | null
  price:           number | null
  category:        string
  image_url:       string | null
  allergens:       number[]
  pairing_dish_id: string | null
  pairing_label:   string | null
}

export interface Menu {
  id:     string
  name:   string
  dishes: Dish[]
}

export interface Restaurant {
  name:            string
  description:     string | null
  logo_url:        string | null
  instagram_url:   string | null
  facebook_url:    string | null
  website_url:     string | null
  tripadvisor_url: string | null
  google_maps_url: string | null
  visibility:      Record<string, boolean> | null
  theme:           RestaurantTheme
}

export interface Banner {
  id:         string
  media_url:  string | null
  media_type: string
  title:      string | null
  subtitle:   string | null
}

export interface Info {
  title:   string | null
  content: string | null
}

interface Props {
  restaurant:     Restaurant
  menus:          Menu[]
  banners:        Banner[]
  info:           Info | null
  defaultMenuId?: string | null
}

// ── Visibility ────────────────────────────────────────────────────────────────

type VisKey = 'name' | 'description' | 'logo' | 'instagram' | 'facebook' | 'website' | 'tripadvisor' | 'google_maps'

function isVis(visibility: Record<string, boolean> | null, key: VisKey): boolean {
  if (!visibility) return true
  return visibility[key] !== false
}

// ── ThemeInjector — writes CSS custom properties on <html> for globals.css ───

function ThemeInjector({ theme }: { theme: RestaurantTheme }) {
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--theme-accent',     theme.accent)
    root.style.setProperty('--theme-accent-rgb', hexToRgb(theme.accent))
    root.style.setProperty('--theme-bg',         theme.appBg)
    root.style.setProperty('--page-background',  theme.pageBackground)
    root.style.setProperty('--theme-text',       theme.textPrimary)
    root.style.setProperty('--theme-muted',      theme.textMuted)
    root.style.setProperty('--theme-nav',        theme.navBg)
    root.style.setProperty('--theme-radius',     borderRadiusPx(theme.borderRadius))
    root.style.setProperty('--font-size-title',  `${theme.fontSizes.title}rem`)
    root.style.setProperty('--font-size-base',   `${theme.fontSizes.base}rem`)
    root.style.setProperty('--font-size-price',  `${theme.fontSizes.price}rem`)
  }, [theme])
  return null
}

// ── Google Fonts loader ───────────────────────────────────────────────────────

function ThemeFontLoader({ fontSerif, fontSans }: { fontSerif: string; fontSans: string }) {
  useEffect(() => {
    const href = googleFontsUrl(fontSerif, fontSans)
    let link = document.querySelector('link[data-theme-fonts]') as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.rel = 'stylesheet'
      link.setAttribute('data-theme-fonts', '1')
      document.head.appendChild(link)
    }
    link.href = href
  }, [fontSerif, fontSans])
  return null
}

// ── Banner carousel ───────────────────────────────────────────────────────────

function BannerCarousel({ banners, accent }: { banners: Banner[]; accent: string }) {
  const [idx,   setIdx]   = useState(0)
  const [phase, setPhase] = useState<'in' | 'out'>('in')

  useEffect(() => {
    if (banners.length <= 1) return
    const t = setInterval(() => {
      setPhase('out')
      const swap = setTimeout(() => {
        setIdx(i => (i + 1) % banners.length)
        setPhase('in')
      }, 450)
      return () => clearTimeout(swap)
    }, 5000)
    return () => clearInterval(t)
  }, [banners.length])

  const banner = banners[idx]
  if (!banner?.media_url) return null

  return (
    <div className="w-full mb-8 relative overflow-hidden" style={{ borderRadius: 4, aspectRatio: '16/6' }}>
      <img
        key={banner.id + idx}
        src={banner.media_url}
        alt={banner.title ?? ''}
        className={`absolute inset-0 w-full h-full object-cover ${phase === 'in' ? 'banner-in' : 'banner-out'}`}
      />
      {(banner.title || banner.subtitle) && (
        <div className="absolute inset-0 flex flex-col justify-end p-4"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65), transparent)' }}>
          {banner.title    && <p className="text-white text-sm font-medium leading-tight">{banner.title}</p>}
          {banner.subtitle && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>{banner.subtitle}</p>}
        </div>
      )}
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
          {banners.map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
              style={{ background: i === idx ? accent : `${accent}50` }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Social icons ──────────────────────────────────────────────────────────────

function InstagramIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
}
function FacebookIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
}
function GlobeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
}
function MapPinIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
}
function CompassIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
}

function SocialBar({ restaurant }: { restaurant: Restaurant }) {
  const vis = restaurant.visibility
  const t   = restaurant.theme
  const links = [
    { key: 'instagram'   as VisKey, url: restaurant.instagram_url,   Icon: InstagramIcon, label: 'Instagram'   },
    { key: 'facebook'    as VisKey, url: restaurant.facebook_url,    Icon: FacebookIcon,  label: 'Facebook'    },
    { key: 'website'     as VisKey, url: restaurant.website_url,     Icon: GlobeIcon,     label: 'Sito web'    },
    { key: 'tripadvisor' as VisKey, url: restaurant.tripadvisor_url, Icon: CompassIcon,   label: 'TripAdvisor' },
    { key: 'google_maps' as VisKey, url: restaurant.google_maps_url, Icon: MapPinIcon,    label: 'Google Maps' },
  ].filter(({ key, url }) => url && isVis(vis, key))
  if (links.length === 0) return null
  return (
    <div className="mt-10 flex items-center justify-center gap-5">
      {links.map(({ url, Icon, label }) => (
        <a key={label} href={url!} target="_blank" rel="noopener noreferrer" aria-label={label}
          className="transition-opacity duration-200 hover:opacity-50"
          style={{ color: `${t.accent}99` }}>
          <Icon />
        </a>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PublicMenuView({ restaurant, menus, banners, defaultMenuId }: Props) {
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(defaultMenuId ?? null)
  const selectedMenu = selectedMenuId ? menus.find(m => m.id === selectedMenuId) ?? null : null

  // ── Live theme ────────────────────────────────────────────────────────────
  // In normal use the theme comes straight from the DB-loaded prop. When the
  // page runs inside the admin preview iframe (?preview), the admin pushes
  // unsaved theme changes via postMessage and we re-render them in real time.
  const [liveTheme, setLiveTheme] = useState<RestaurantTheme>(restaurant.theme)
  const t = liveTheme

  // ── Immersive video transition ──────────────────────────────────────────────
  // When theme.immersiveTransition + theme.bgVideo are set, tapping a menu
  // button fades the landing UI out, plays the video once, and only opens the
  // menu on the video's `ended` event. Otherwise selection is immediate.
  const [pendingMenuId, setPendingMenuId] = useState<string | null>(null)
  const transitioning = pendingMenuId !== null
  const videoRef = useRef<HTMLVideoElement>(null)

  function openMenu(menuId: string) {
    if (t.immersiveTransition && t.bgVideo) {
      setPendingMenuId(menuId)
    } else {
      setSelectedMenuId(menuId)
    }
  }

  // Drive the immersive video once a transition starts.
  useEffect(() => {
    if (!transitioning) return
    const v = videoRef.current
    if (!v) { setSelectedMenuId(pendingMenuId); return }
    v.currentTime = 0
    const finish = () => setSelectedMenuId(pendingMenuId)
    v.addEventListener('ended', finish, { once: true })
    // Safety net: if the video can't play (blocked/missing), don't trap the user.
    const fallback = setTimeout(finish, 8000)
    const p = v.play()
    if (p && typeof p.catch === 'function') p.catch(() => finish())
    return () => { v.removeEventListener('ended', finish); clearTimeout(fallback) }
  }, [transitioning, pendingMenuId])

  // ── Admin preview bridge (postMessage) ───────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isPreview = new URLSearchParams(window.location.search).has('preview')
    if (!isPreview) return

    function onMessage(e: MessageEvent) {
      // Same-origin only: the admin iframe and the public page share the domain.
      if (e.origin !== window.location.origin) return
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'dmp-theme' && d.theme) {
        setLiveTheme(parseTheme(d.theme))
      } else if (d.type === 'dmp-nav') {
        if (d.view === 'landing') { setPendingMenuId(null); setSelectedMenuId(null) }
        else if (d.view === 'menu') setSelectedMenuId(prev => prev ?? menus[0]?.id ?? null)
      }
    }
    window.addEventListener('message', onMessage)
    // Tell the parent we're ready so it can push the current draft theme.
    try { window.parent?.postMessage({ type: 'dmp-preview-ready' }, window.location.origin) } catch {}
    return () => window.removeEventListener('message', onMessage)
  }, [menus])

  const { pdfUrl, categories, isGenerating, error } = useMenuPDF(
    { name: restaurant.name },
    selectedMenu ? {
      id:     selectedMenu.id,
      name:   selectedMenu.name,
      dishes: selectedMenu.dishes.map(d => ({
        id:          d.id,
        name:        d.name,
        description: d.description,
        price:       d.price,
        category:    d.category || 'Menu',
        allergens:   d.allergens,
      })),
    } : null,
    t,
  )

  const vis    = restaurant.visibility
  const SERIF  = fontStack(t.fontSerif, 'serif')
  const SANS   = fontStack(t.fontSans, 'sans')
  const RADIUS = borderRadiusPx(t.borderRadius)

  // ── 1. Landing ────────────────────────────────────────────────────────────
  if (!selectedMenuId || !selectedMenu) {
    const showLogo = !!restaurant.logo_url && isVis(vis, 'logo')
    const showName = isVis(vis, 'name')
    const showDesc = !!restaurant.description && isVis(vis, 'description')

    return (
      <>
        <ThemeInjector theme={t} />
        <ThemeFontLoader fontSerif={t.fontSerif} fontSans={t.fontSans} />
        <div className="fixed inset-0 h-[100dvh] flex flex-col items-center justify-center overflow-y-auto"
          style={{ background: t.appBg, fontFamily: SANS }}>

          {/* Background image overlay (only when no video is set) */}
          {t.bgImage && !t.bgVideo && (
            <div className="absolute inset-0 pointer-events-none"
              style={{ backgroundImage: `url(${t.bgImage})`, backgroundSize: 'cover',
                backgroundPosition: 'center', opacity: (t.bgImageOpacity ?? 30) / 100 }} />
          )}

          {/* Background / immersive video. Non-immersive: looping muted wallpaper.
              Immersive: paused until a menu button is tapped, then plays fullscreen. */}
          {t.bgVideo && (
            <video
              ref={videoRef}
              src={t.bgVideo}
              muted
              playsInline
              autoPlay={!t.immersiveTransition}
              loop={!t.immersiveTransition}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{
                opacity:    transitioning ? 1 : (t.bgImageOpacity ?? 30) / 100,
                zIndex:     transitioning ? 40 : 0,
                transition: 'opacity 0.8s ease',
              }}
            />
          )}

          <div className="absolute top-0 inset-x-0 h-px"
            style={{ background: `linear-gradient(90deg,transparent,${t.accent}55,transparent)` }} />

          <div className="relative flex flex-col items-center text-center px-10 w-full max-w-xs py-12"
            style={{ opacity: transitioning ? 0 : 1, transition: 'opacity 0.6s ease',
              pointerEvents: transitioning ? 'none' : 'auto' }}>

            <BannerCarousel banners={banners} accent={t.accent} />

            {showLogo && (
              <img src={restaurant.logo_url!} alt={restaurant.name} className="h-14 object-contain"
                style={{ opacity: 0.88, marginBottom: showName || showDesc ? '1.5rem' : '2.5rem' }} />
            )}

            {!showLogo && showName && (
              <div className="w-10 h-px mb-7" style={{ background: t.accent }} />
            )}

            {showName && (
              <h1 className="font-light uppercase leading-none"
                style={{ color: t.textPrimary, fontFamily: SERIF,
                  fontSize: 'clamp(1.6rem,5vw,2.4rem)', letterSpacing: '0.22em' }}>
                {restaurant.name}
              </h1>
            )}

            {showDesc && (
              <p style={{ color: `${t.accent}80`, fontFamily: SANS, fontSize: '0.6rem',
                letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '0.6rem' }}>
                {restaurant.description}
              </p>
            )}

            {!showLogo && (showName || showDesc) && (
              <div className="w-10 h-px mt-7" style={{ background: t.accent }} />
            )}

            <div className="mt-10 flex flex-col gap-3 w-full">
              {menus.length === 0 ? (
                <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: t.textMuted }}>
                  Menu in aggiornamento.
                </p>
              ) : (
                menus.map(m => (
                  <button key={m.id} onClick={() => openMenu(m.id)}
                    className="group relative px-10 py-3 overflow-hidden transition-colors duration-300"
                    style={{ color: t.textPrimary, border: `1px solid ${t.accent}50`,
                      borderRadius: RADIUS, fontFamily: SANS,
                      fontSize: '0.625rem', letterSpacing: '0.28em', textTransform: 'uppercase' }}>
                    <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: `${t.accent}14` }} />
                    <span className="relative">{`Sfoglia il menu ${m.name}`}</span>
                  </button>
                ))
              )}
            </div>

            <SocialBar restaurant={restaurant} />
          </div>

          <p className="absolute bottom-6 text-[8px] uppercase tracking-[0.35em]" style={{ color: t.textMuted }}>
            menu digitale
          </p>
          <div className="absolute bottom-0 inset-x-0 h-px"
            style={{ background: `linear-gradient(90deg,transparent,${t.accent}55,transparent)` }} />
        </div>
      </>
    )
  }

  // ── 2. Generating ─────────────────────────────────────────────────────────
  if (isGenerating || !pdfUrl) {
    return (
      <>
        <ThemeInjector theme={t} />
        <div className="fixed inset-0 h-[100dvh] flex flex-col items-center justify-center"
          style={{ background: t.appBg }}>
          {error ? (
            <div className="text-center px-8 flex flex-col items-center gap-4">
              <p className="text-xs text-red-400">Impossibile generare il menu.</p>
              <button onClick={() => setSelectedMenuId(null)}
                className="text-[10px] uppercase tracking-[0.25em] underline underline-offset-4"
                style={{ color: t.textMuted, fontFamily: SANS }}>
                ← torna
              </button>
            </div>
          ) : (
            <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: t.textMuted, fontFamily: SANS }}>
              Preparazione menu…
            </p>
          )}
        </div>
      </>
    )
  }

  // ── 3. Flipbook ───────────────────────────────────────────────────────────
  return (
    <>
      <ThemeInjector theme={t} />
      <FlipbookViewer
        pdfUrl={pdfUrl}
        restaurantName={restaurant.name}
        restaurantLogo={restaurant.logo_url}
        onBack={() => setSelectedMenuId(null)}
        categories={categories.length > 0 ? categories : undefined}
        dishes={selectedMenu.dishes}
        theme={t}
      />
    </>
  )
}
