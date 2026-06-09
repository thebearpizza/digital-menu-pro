'use client'
// ─────────────────────────────────────────────────────────────────────────────
// PublicMenuView — landing + flipbook in a single DOM tree.
// Both layers are always mounted after the menu is first opened; visibility is
// toggled via opacity so the background video never needs to re-initialize.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'
import FlipbookViewer  from './FlipbookViewer'
import DishModal       from './DishModal'
import type { DishData } from './DishModal'
import { EditHandle, sendEdit } from './EditHandle'
import { useMenuPDF }  from './useMenuPDF'
import {
  googleFontsUrl, allThemeFonts, fontStack,
  hexToRgb, landingButtonRadius, landingTextureCss, menuBackgroundCss,
  parseTheme,
} from '@/lib/theme'
import type { RestaurantTheme } from '@/lib/theme'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Dish {
  id: string; name: string; description: string | null; price: number | null
  category: string; image_url: string | null; allergens: number[]
  pairing_dish_id: string | null; pairing_label: string | null
}
export interface Menu   { id: string; name: string; dishes: Dish[] }
export interface Banner { id: string; media_url: string | null; media_type: string; title: string | null; subtitle: string | null }
export interface Info   { title: string | null; content: string | null }
export interface Restaurant {
  name: string; description: string | null; logo_url: string | null
  instagram_url: string | null; facebook_url: string | null
  website_url: string | null; tripadvisor_url: string | null
  google_maps_url: string | null
  visibility: Record<string, boolean> | null
  theme: RestaurantTheme
}

interface Props {
  restaurant: Restaurant; menus: Menu[]; banners: Banner[]
  info: Info | null; defaultMenuId?: string | null
}

type VisKey = 'name'|'description'|'logo'|'instagram'|'facebook'|'website'|'tripadvisor'|'google_maps'
function isVis(v: Record<string,boolean>|null, k: VisKey) { return !v || v[k] !== false }

// ── CSS vars injected on <html> so globals.css and FlipbookViewer can read them

function ThemeInjector({ theme }: { theme: RestaurantTheme }) {
  useEffect(() => {
    const root = document.documentElement
    const l = theme.landing; const m = theme.menu
    root.style.setProperty('--theme-accent',     l.accent)
    root.style.setProperty('--menu-accent',      m.accent)
    root.style.setProperty('--theme-accent-rgb', hexToRgb(m.accent))
    root.style.setProperty('--page-background',  m.pageBackground)
    root.style.setProperty('--font-size-title',  `${m.dishes.titleSize}rem`)
    root.style.setProperty('--font-size-base',   `${m.descriptions.size}rem`)
    root.style.setProperty('--font-size-price',  `${m.prices.size}rem`)
    // card vars
    const c = theme.card
    root.style.setProperty('--card-bg',          c.bgColor)
    root.style.setProperty('--card-title-color', c.title.color)
    root.style.setProperty('--card-price-color', c.price.color)
  }, [theme])
  return null
}

function ThemeFontLoader({ theme }: { theme: RestaurantTheme }) {
  useEffect(() => {
    const href = googleFontsUrl(allThemeFonts(theme))
    if (!href) return
    let link = document.querySelector('link[data-theme-fonts]') as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.rel = 'stylesheet'
      link.setAttribute('data-theme-fonts', '1')
      document.head.appendChild(link)
    }
    link.href = href
  }, [theme])
  return null
}

// ── Social icons ──────────────────────────────────────────────────────────────

function InstagramIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: '1em', height: '1em' }}><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg> }
function FacebookIcon()  { return <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '1em', height: '1em' }}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> }
function GlobeIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: '1em', height: '1em' }}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> }
function MapPinIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: '1em', height: '1em' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> }
function CompassIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: '1em', height: '1em' }}><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg> }

// ── Banner carousel ───────────────────────────────────────────────────────────

function BannerCarousel({ banners, accent }: { banners: Banner[]; accent: string }) {
  const [idx, setIdx]   = useState(0)
  const [phase, setPhase] = useState<'in'|'out'>('in')
  useEffect(() => {
    if (banners.length <= 1) return
    const t = setInterval(() => {
      setPhase('out')
      const s = setTimeout(() => { setIdx(i => (i+1)%banners.length); setPhase('in') }, 450)
      return () => clearTimeout(s)
    }, 5000)
    return () => clearInterval(t)
  }, [banners.length])
  const b = banners[idx]
  if (!b?.media_url) return null
  return (
    <div className="w-full mb-8 relative overflow-hidden" style={{ borderRadius: 4, aspectRatio: '16/6' }}>
      <img key={b.id+idx} src={b.media_url} alt={b.title??''} className={`absolute inset-0 w-full h-full object-cover ${phase==='in'?'banner-in':'banner-out'}`} />
      {(b.title||b.subtitle) && (
        <div className="absolute inset-0 flex flex-col justify-end p-4" style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.65),transparent)' }}>
          {b.title    && <p className="text-white text-sm font-medium leading-tight">{b.title}</p>}
          {b.subtitle && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>{b.subtitle}</p>}
        </div>
      )}
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
          {banners.map((_,i) => <div key={i} className="w-1.5 h-1.5 rounded-full transition-colors duration-300" style={{ background: i===idx ? accent : `${accent}50` }} />)}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PublicMenuView({ restaurant, menus, banners, defaultMenuId }: Props) {
  // selectedMenuId: what the user has chosen to view (null = landing)
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(defaultMenuId ?? null)
  // pendingMenuId: set during immersive video transition (PDF generation starts early)
  const [pendingMenuId, setPendingMenuId]   = useState<string | null>(null)

  // liveTheme: updated via postMessage from admin preview iframe
  const [liveTheme, setLiveTheme] = useState<RestaurantTheme>(restaurant.theme)
  const t = liveTheme
  const l = t.landing
  const m = t.menu

  // editMode / showDummyData / cardPreviewOpen: driven by dmp-editor-state + dmp-nav
  const [editMode,        setEditMode]        = useState(false)
  const [showDummyData,   setShowDummyData]   = useState(false)
  const [cardPreviewOpen, setCardPreviewOpen] = useState(false)

  const videoRef      = useRef<HTMLVideoElement>(null)
  const [posterVisible, setPosterVisible] = useState(true)

  // ── Admin preview bridge ───────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isPreview = new URLSearchParams(window.location.search).has('preview')
    if (!isPreview) return
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'dmp-theme' && d.theme)  setLiveTheme(parseTheme(d.theme))
      if (d.type === 'dmp-nav') {
        if (d.view === 'landing') {
          setPendingMenuId(null); setSelectedMenuId(null); setCardPreviewOpen(false)
        } else if (d.view === 'menu') {
          setSelectedMenuId(p => p ?? menus[0]?.id ?? null); setCardPreviewOpen(false)
        } else if (d.view === 'card') {
          setSelectedMenuId(p => p ?? menus[0]?.id ?? null); setCardPreviewOpen(true)
        }
      }
      if (d.type === 'dmp-editor-state') {
        setEditMode(!!d.editMode)
        setShowDummyData(!!d.showDummyData)
      }
      if (d.type === 'dmp-font-scale' && typeof d.fontSize === 'number') {
        document.documentElement.style.fontSize = `${d.fontSize}px`
      }
    }
    window.addEventListener('message', onMessage)
    try { window.parent?.postMessage({ type: 'dmp-preview-ready' }, window.location.origin) } catch {}
    return () => {
      window.removeEventListener('message', onMessage)
      document.documentElement.style.fontSize = ''
    }
  }, [menus])

  // ── PDF generation — driven by selected or pending menu ───────────────────
  const activeMenuId = selectedMenuId ?? pendingMenuId
  const activeMenu   = activeMenuId ? menus.find(m => m.id === activeMenuId) ?? null : null
  const { pdfUrl, categories, isGenerating, error } = useMenuPDF(
    { name: restaurant.name },
    activeMenu ? {
      id: activeMenu.id, name: activeMenu.name,
      dishes: activeMenu.dishes.map(d => ({
        id: d.id, name: d.name, description: d.description,
        price: d.price, category: d.category||'Menu', allergens: d.allergens,
      })),
    } : null,
    t,
  )

  // ── Derived visibility flags ───────────────────────────────────────────────
  const transitioning = pendingMenuId !== null
  const menuVisible   = selectedMenuId !== null
  const menuReady     = menuVisible && !!pdfUrl

  // ── Poster / video logic ───────────────────────────────────────────────────
  function handleCanPlay() {
    if (!l.background.immersiveTransition) setPosterVisible(false)
  }
  // Restore poster whenever landing re-appears
  useEffect(() => { if (!menuVisible) setPosterVisible(true) }, [menuVisible])

  // ── Immersive transition driver ────────────────────────────────────────────
  function openMenu(menuId: string) {
    if (editMode) return
    if (l.background.immersiveTransition && l.background.type === 'video') {
      setPendingMenuId(menuId)
    } else {
      setSelectedMenuId(menuId)
    }
  }

  useEffect(() => {
    if (!transitioning) return
    const v = videoRef.current
    if (!v) { setSelectedMenuId(pendingMenuId); setPendingMenuId(null); return }
    v.currentTime = 0
    setPosterVisible(false)
    const finish = () => { setSelectedMenuId(pendingMenuId); setPendingMenuId(null) }
    v.addEventListener('ended', finish, { once: true })
    const fallback = setTimeout(finish, 8000)
    const p = v.play()
    if (p?.catch) p.catch(() => finish())
    return () => { v.removeEventListener('ended', finish); clearTimeout(fallback) }
  }, [transitioning, pendingMenuId])

  // Pingpong loop. Browsers don't reliably support negative playbackRate (Chrome
  // ignores it → the video would freeze at the end), so we drive the reverse leg
  // with a manual rAF that steps currentTime backwards, then resume native
  // forward playback. If reverse playback can't be set up at all we fall back to
  // a seamless forward loop so the background never stalls.
  useEffect(() => {
    const v = videoRef.current
    if (!v || l.background.loopMode !== 'pingpong' || l.background.immersiveTransition) return

    let raf = 0
    let last = 0
    let reversing = false

    const stepBack = (ts: number) => {
      if (!reversing) return
      const dt = last ? (ts - last) / 1000 : 0
      last = ts
      const next = v.currentTime - dt   // 1× reverse speed
      if (next <= 0.02) {
        v.currentTime = 0
        reversing = false
        v.play().catch(() => {})        // resume forward
        return
      }
      v.currentTime = next
      raf = requestAnimationFrame(stepBack)
    }

    const handleEnded = () => {
      if (!v.duration || Number.isNaN(v.duration)) { v.currentTime = 0; v.play().catch(() => {}); return }
      try { v.pause() } catch {}
      reversing = true
      last = 0
      v.currentTime = Math.max(0, v.duration - 0.05)
      raf = requestAnimationFrame(stepBack)
    }

    v.addEventListener('ended', handleEnded)
    return () => {
      v.removeEventListener('ended', handleEnded)
      reversing = false
      if (raf) cancelAnimationFrame(raf)
    }
  }, [l.background.loopMode, l.background.immersiveTransition])

  // ── Fonts ─────────────────────────────────────────────────────────────────
  const TITLE_FONT    = fontStack(l.title.font,   'serif')
  const DESC_FONT     = fontStack(l.description.font, 'sans')
  const BUTTON_FONT   = fontStack(l.buttons.font, 'sans')
  const BUTTON_RADIUS = landingButtonRadius(l.buttons.shape)
  const vis           = restaurant.visibility

  // ── Dummy data for admin preview (fills empty fields when showDummyData=true) ─
  const displayDesc = restaurant.description || (showDummyData ? 'Alta cucina italiana · dal 1987' : null)
  const displayMenus = (showDummyData && menus.length === 0)
    ? [{ id: 'dummy-pranzo', name: 'Pranzo', dishes: [] as Dish[] }, { id: 'dummy-cena', name: 'Cena', dishes: [] as Dish[] }]
    : menus
  const displayRestaurant: Restaurant = showDummyData ? {
    ...restaurant,
    instagram_url: restaurant.instagram_url || '#',
    facebook_url:  restaurant.facebook_url  || '#',
    website_url:   restaurant.website_url   || '#',
  } : restaurant

  // Card preview: first real dish if available, else rich dummy data (photo +
  // allergens + pairing). The photo is an inline SVG so it needs no network.
  const DUMMY_PHOTO =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='450'%3E%3Cdefs%3E%3CradialGradient id='g' cx='35%25' cy='30%25' r='80%25'%3E%3Cstop offset='0%25' stop-color='%233a2c1c'/%3E%3Cstop offset='55%25' stop-color='%23241a10'/%3E%3Cstop offset='100%25' stop-color='%23140d07'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='800' height='450' fill='url(%23g)'/%3E%3Cg fill='none' stroke='%23c9a96e' stroke-opacity='0.45' stroke-width='3'%3E%3Ccircle cx='400' cy='225' r='150'/%3E%3Ccircle cx='400' cy='225' r='110'/%3E%3C/g%3E%3Cg fill='%23c9a96e' fill-opacity='0.5'%3E%3Cellipse cx='400' cy='225' rx='70' ry='38'/%3E%3C/g%3E%3Ctext x='400' y='400' text-anchor='middle' fill='%23c9a96e' fill-opacity='0.6' font-family='Georgia,serif' font-size='22' letter-spacing='4'%3EANTEPRIMA%3C/text%3E%3C/svg%3E"
  const DUMMY_DISH: DishData = {
    id: 'preview', name: 'Tagliolini al Tartufo Nero',
    description: 'Tagliolini freschi al tartufo nero di Norcia, burro mantecato e Parmigiano Reggiano stagionato 24 mesi.',
    price: 24, category: 'Primi', image_url: DUMMY_PHOTO, allergens: [1, 3, 7],
    pairing_dish_id: 'preview-wine', pairing_label: 'Abbinamento vino consigliato',
  }
  const DUMMY_WINE: DishData = {
    id: 'preview-wine', name: 'Barolo Riserva 2018',
    description: 'Nebbiolo di Serralunga d\'Alba, 13.5% vol.',
    price: 18, category: 'Vini', image_url: null, allergens: [],
    pairing_dish_id: null, pairing_label: null,
  }
  const allDishesFlat = menus.flatMap(m => m.dishes)
  const cardPreviewDish: DishData = allDishesFlat[0]
    ? { ...allDishesFlat[0], allergens: allDishesFlat[0].allergens ?? [] }
    : DUMMY_DISH
  const cardPreviewAllDishes: DishData[] = allDishesFlat.length
    ? allDishesFlat.map(d => ({ ...d, allergens: d.allergens ?? [] }))
    : [DUMMY_DISH, DUMMY_WINE]

  // ── Background landing layer styles ───────────────────────────────────────
  const bgIsVideo = l.background.type === 'video' || l.background.type === 'gif'
  const bgIsImage = l.background.type === 'image'
  const bgColor   = l.background.type === 'color' ? l.background.value : '#0d0d0d'
  const textureBg = landingTextureCss(l.background.texture)

  return (
    <div className="fixed inset-0 h-[100dvh]">
      <ThemeInjector theme={t} />
      <ThemeFontLoader theme={t} />

      {/* ── LANDING LAYER — always in DOM so video keeps playing ─────────── */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto"
        style={{
          background:   bgColor,
          opacity:      menuVisible && menuReady ? 0 : 1,
          pointerEvents:menuVisible && menuReady ? 'none' : 'auto',
          transition:   'opacity 0.5s ease',
          fontFamily:   DESC_FONT,
        }}
      >
        {/* Image background */}
        {bgIsImage && (
          <div className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: `url(${l.background.value})`, backgroundSize: 'cover', backgroundPosition: 'center',
              opacity: l.background.opacity/100 }} />
        )}

        {/* Texture overlay */}
        {textureBg && (
          <div className="absolute inset-0 pointer-events-none" style={textureBg} />
        )}

        {/* Video / immersive background */}
        {bgIsVideo && (
          <div className="absolute inset-0 pointer-events-none"
            style={{ opacity: transitioning ? 1 : l.background.opacity/100, zIndex: transitioning ? 40 : 0, transition: 'opacity 0.8s ease' }}>
            {l.background.poster && (
              <img src={l.background.poster} alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: posterVisible ? 1 : 0, transition: 'opacity 0.6s ease' }} />
            )}
            <video ref={videoRef} src={l.background.value} muted playsInline preload="auto"
              autoPlay={!l.background.immersiveTransition}
              loop={!l.background.immersiveTransition && l.background.loopMode === 'loop'}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: (l.background.poster && posterVisible) ? 0 : 1, transition: 'opacity 0.6s ease' }}
              onCanPlay={handleCanPlay}
            />
          </div>
        )}

        {/* Gold top rule */}
        <div className="absolute top-0 inset-x-0 h-px"
          style={{ background: `linear-gradient(90deg,transparent,${l.accent}55,transparent)` }} />

        {/* Background edit handle — top-right corner badge (edit mode only) */}
        {editMode && (
          <button
            className="absolute top-3 right-3 z-[300] flex items-center gap-1.5 px-2.5 py-1 bg-blue-500 text-white rounded-full text-[11px] shadow-lg"
            onClick={() => sendEdit('landing-bg')}>
            <span>✏</span><span>Sfondo</span>
          </button>
        )}

        {/* Content — fades during immersive transition */}
        <div className="relative flex flex-col items-center text-center px-10 w-full max-w-xs py-12"
          style={{ opacity: transitioning ? 0 : 1, transition: 'opacity 0.6s ease', pointerEvents: transitioning ? 'none' : 'auto' }}>

          <BannerCarousel banners={banners} accent={l.accent} />

          <EditHandle target="landing-logo" editMode={editMode}>
            {restaurant.logo_url && isVis(vis, 'logo') && (
              <img src={restaurant.logo_url} alt={restaurant.name}
                className="object-contain"
                style={{
                  height: `${l.logo.size * 0.75}rem`,
                  mixBlendMode: l.logo.mixBlend as any,
                  opacity: 0.88,
                  marginBottom: isVis(vis,'name') ? '1.5rem' : '2.5rem',
                }} />
            )}
          </EditHandle>

          {!restaurant.logo_url && isVis(vis,'name') && (
            <div className="w-10 h-px mb-7" style={{ background: l.accent }} />
          )}

          <EditHandle target="landing-title" editMode={editMode}>
            {isVis(vis,'name') && (
              <h1 className="uppercase leading-none"
                style={{
                  color: l.title.color, fontFamily: TITLE_FONT,
                  fontSize: `${l.title.size}rem`,
                  letterSpacing: '0.22em',
                  fontWeight: l.title.weight === 'bold' ? 700 : l.title.weight === 'normal' ? 400 : 300,
                }}>
                {restaurant.name}
              </h1>
            )}
          </EditHandle>

          <EditHandle target="landing-desc" editMode={editMode}>
            {displayDesc && isVis(vis,'description') && (
              <p style={{ color: l.description.color, fontFamily: DESC_FONT, fontSize: `${l.description.size}rem`, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '0.6rem' }}>
                {displayDesc}
              </p>
            )}
          </EditHandle>

          {!restaurant.logo_url && (isVis(vis,'name') || isVis(vis,'description')) && (
            <div className="w-10 h-px mt-7" style={{ background: l.accent }} />
          )}

          {/* Menu buttons */}
          <EditHandle target="landing-buttons" editMode={editMode} className="w-full mt-10">
            <div className="flex flex-col gap-3 w-full">
              {displayMenus.length === 0 ? (
                <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: l.title.color }}>Menu in aggiornamento.</p>
              ) : (
                displayMenus.map(menu => (
                  <button key={menu.id} onClick={() => openMenu(menu.id)}
                    className="group relative px-10 py-3 overflow-hidden transition-colors duration-300"
                    style={{
                      color:       l.buttons.textColor,
                      background:  l.buttons.bgColor,
                      border:      l.buttons.borderStyle === 'none' ? 'none' : `${l.buttons.borderWidth ?? 1}px ${l.buttons.borderStyle} ${l.buttons.borderColor}50`,
                      borderRadius:BUTTON_RADIUS,
                      fontFamily:  BUTTON_FONT,
                      fontSize:    `${l.buttons.fontSize}rem`,
                      letterSpacing:'0.28em',
                      textTransform:'uppercase',
                    }}>
                    <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: `${l.buttons.borderColor}14` }} />
                    <span className="relative">{`Sfoglia il menu ${menu.name}`}</span>
                  </button>
                ))
              )}
            </div>
          </EditHandle>

          {/* Social links */}
          <EditHandle target="landing-socials" editMode={editMode}>
            <SocialBar restaurant={displayRestaurant} editMode={editMode} liveLanding={l} />
          </EditHandle>
        </div>

        {/* Footer label */}
        <p className="absolute bottom-6 text-[8px] uppercase tracking-[0.35em]" style={{ color: l.title.color + '44' }}>
          menu digitale
        </p>
        <div className="absolute bottom-0 inset-x-0 h-px"
          style={{ background: `linear-gradient(90deg,transparent,${l.accent}55,transparent)` }} />
      </div>

      {/* ── LOADING OVERLAY — shown while PDF is generating ──────────────── */}
      {menuVisible && !menuReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ ...menuBackgroundCss(m.background) }}>
          {error ? (
            <div className="text-center px-8 flex flex-col items-center gap-4">
              <p className="text-xs text-red-400">Impossibile generare il menu.</p>
              <button onClick={() => setSelectedMenuId(null)}
                className="text-[10px] uppercase tracking-[0.25em] underline underline-offset-4"
                style={{ color: m.navigation.color, fontFamily: fontStack(m.stickyCategories.font,'sans') }}>
                ← torna
              </button>
            </div>
          ) : (
            <p className="text-[10px] uppercase tracking-[0.3em]"
              style={{ color: m.navigation.color, fontFamily: fontStack(m.stickyCategories.font,'sans') }}>
              Preparazione menu…
            </p>
          )}
        </div>
      )}

      {/* ── FLIPBOOK LAYER — mounted once PDF is ready, stays mounted ────── */}
      {pdfUrl && (
        <div className="absolute inset-0"
          style={{ opacity: menuReady ? 1 : 0, pointerEvents: menuReady ? 'auto' : 'none', transition: 'opacity 0.5s ease' }}>
          <FlipbookViewer
            pdfUrl={pdfUrl}
            restaurantName={restaurant.name}
            restaurantLogo={restaurant.logo_url}
            onBack={() => setSelectedMenuId(null)}
            categories={categories.length > 0 ? categories : undefined}
            dishes={activeMenu?.dishes ?? []}
            theme={t}
            editMode={editMode && !cardPreviewOpen}
            onEditTarget={sendEdit}
          />
        </div>
      )}

      {/* ── CARD PREVIEW — DishModal aperta dall'admin in tab Card ───────── */}
      {cardPreviewOpen && (
        <div className="absolute inset-0" style={{ zIndex: 500 }}>
          <DishModal
            activeDish={cardPreviewDish}
            allDishes={cardPreviewAllDishes}
            onClose={() => setCardPreviewOpen(false)}
            onOpenDish={() => {}}
            editMode={editMode}
            theme={t}
          />
        </div>
      )}
    </div>
  )
}

// ── Menu edit palette ───────────────────────────────────────────────────────
// The flipbook menu is a rendered PDF, so individual dish/category texts aren't
// real DOM nodes we can wrap. Instead we surface a labelled chip for each menu
// ── SocialBar ─────────────────────────────────────────────────────────────────

function SocialBar({ restaurant, editMode = false, liveLanding }: {
  restaurant: Restaurant; editMode?: boolean; liveLanding?: RestaurantTheme['landing']
}) {
  const vis = restaurant.visibility
  const t   = liveLanding ?? restaurant.theme.landing
  const links = [
    { key:'instagram'   as VisKey, url: restaurant.instagram_url,   Icon: InstagramIcon, label:'Instagram'   },
    { key:'facebook'    as VisKey, url: restaurant.facebook_url,    Icon: FacebookIcon,  label:'Facebook'    },
    { key:'website'     as VisKey, url: restaurant.website_url,     Icon: GlobeIcon,     label:'Sito web'    },
    { key:'tripadvisor' as VisKey, url: restaurant.tripadvisor_url, Icon: CompassIcon,   label:'TripAdvisor' },
    { key:'google_maps' as VisKey, url: restaurant.google_maps_url, Icon: MapPinIcon,    label:'Google Maps' },
  ].filter(({ key, url }) => url && isVis(vis, key))
  if (!links.length) return null
  return (
    <div className="mt-10 flex items-center justify-center gap-5">
      {links.map(({ url, Icon, label }) => (
        <a key={label} href={editMode ? undefined : url!}
          target={editMode ? undefined : '_blank'}
          rel="noopener noreferrer" aria-label={label}
          className="transition-opacity hover:opacity-50"
          style={{
            color:         t.socials.style === 'minimal' || t.socials.style === 'outline' ? `${t.socials.color}99` : t.socials.color,
            background:    t.socials.style === 'circle' || t.socials.style === 'box' ? `${t.socials.color}20` : 'transparent',
            border:        t.socials.style === 'outline' ? `1px solid ${t.socials.color}60` : 'none',
            borderRadius:  t.socials.style === 'circle' || t.socials.style === 'outline' ? '50%' : t.socials.style === 'box' ? 4 : 0,
            padding:       t.socials.style !== 'minimal' ? 8 : 0,
            display:       'flex', alignItems: 'center', justifyContent: 'center',
            width:         t.socials.style !== 'minimal' ? `${t.socials.size * 1.6 + 1}rem` : undefined,
            height:        t.socials.style !== 'minimal' ? `${t.socials.size * 1.6 + 1}rem` : undefined,
          }}>
          <span style={{ fontSize: `${t.socials.size}rem`, lineHeight: 1, display: 'flex' }}><Icon /></span>
        </a>
      ))}
    </div>
  )
}
