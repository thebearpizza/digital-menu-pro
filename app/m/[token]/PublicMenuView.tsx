'use client'
// ─────────────────────────────────────────────────────────────────────────────
// PublicMenuView — landing + flipbook in a single DOM tree.
// Both layers are always mounted after the menu is first opened; visibility is
// toggled via opacity so the background video never needs to re-initialize.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useMemo, useCallback, type CSSProperties } from 'react'
import FlipbookViewer  from './FlipbookViewer'
import DishModal       from './DishModal'
import type { DishData } from './DishModal'
import { EditHandle, sendEdit, useIsMobilePreview } from './EditHandle'
import { useMenuPDF }  from './useMenuPDF'
import { animateLandingIn } from '@/lib/animations'
import { RingSpinner } from '@/components/ui/Spinner'
import {
  googleFontsUrl, allThemeFonts, fontStack,
  hexToRgb, landingButtonRadius, landingTextureCss, menuBackgroundCss,
  parseTheme, lineSizesFor, customFontFaceCss, cardBorderRadius, resolveMenuTheme,
} from '@/lib/theme'
import type { RestaurantTheme } from '@/lib/theme'
import {
  isLang, uiText, dishName, dishDescription, categoryName,
  menuName as translatedMenuName, hintTitle, hintText,
  ALL_LANGS, LANG_LABELS,
  type Lang, type DishTranslations, type MenuTranslations, type HintTranslations,
} from '@/lib/translations'
import { FlagIcon } from '@/components/ui/FlagIcon'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Dish {
  id: string; name: string; description: string | null; price: number | null
  category: string; image_url: string | null; allergens: number[]
  pairing_dish_id: string | null; pairing_label: string | null
  translations?: DishTranslations
}
export interface Menu {
  id: string; name: string; dishes: Dish[]
  translations?: MenuTranslations
  extra_pages?: import('./MenuPDFDocument').MenuExtraPages | null
}
export interface Banner { id: string; media_url: string | null; media_type: string; title: string | null; subtitle: string | null }
export interface Info   { title: string | null; content: string | null }
export interface Restaurant {
  name: string; description: string | null; logo_url: string | null
  instagram_url: string | null; facebook_url: string | null
  website_url: string | null; tripadvisor_url: string | null
  google_maps_url: string | null
  visibility: Record<string, boolean> | null
  theme: RestaurantTheme
  hintTranslations?: HintTranslations
}

interface Props {
  restaurant: Restaurant; menus: Menu[]; banners: Banner[]
  info: Info | null; defaultMenuId?: string | null
  restaurantId: string
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
    root.style.setProperty('--page-background',  m.pageBackground.color)
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
    // Custom uploaded fonts aren't on Google Fonts — exclude them from the
    // Google Fonts request (an unknown family there can break the whole
    // stylesheet) and inject @font-face rules for them instead.
    const customNames = new Set(Object.keys(theme.customFonts))
    const href = googleFontsUrl(allThemeFonts(theme).filter(f => !customNames.has(f)))
    if (href) {
      let link = document.querySelector('link[data-theme-fonts]') as HTMLLinkElement | null
      if (!link) {
        link = document.createElement('link')
        link.rel = 'stylesheet'
        link.setAttribute('data-theme-fonts', '1')
        document.head.appendChild(link)
      }
      link.href = href
    }

    let style = document.querySelector('style[data-custom-fonts]') as HTMLStyleElement | null
    const css = customFontFaceCss(theme.customFonts)
    if (css) {
      if (!style) {
        style = document.createElement('style')
        style.setAttribute('data-custom-fonts', '1')
        document.head.appendChild(style)
      }
      style.textContent = css
    } else if (style) {
      style.textContent = ''
    }
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

export default function PublicMenuView({ restaurant, menus, banners, defaultMenuId, restaurantId }: Props) {
  // selectedMenuId: what the user has chosen to view (null = landing)
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(defaultMenuId ?? null)
  // pendingMenuId: set during immersive video transition (PDF generation starts early)
  const [pendingMenuId, setPendingMenuId]   = useState<string | null>(null)

  // ── Tracking — fire-and-forget POST verso l'API route server-side ────────
  const track = useCallback((event_type: 'menu_open' | 'dish_click', menu_id: string, dish_id?: string) => {
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurantId, menu_id, dish_id: dish_id ?? null, event_type }),
    })
  }, [restaurantId])

  // ── Lingua del menu — italiano di default, scelta persistita sul device ────
  const [lang, setLangState] = useState<Lang>('it')
  const [landingLangOpen, setLandingLangOpen] = useState(false)
  // langReady: diventa true dopo che la preferenza lingua salvata è stata applicata.
  // Necessario per il pop-up hint: senza questo gate, l'effetto del hint gira una
  // prima volta con lang='it' (valore iniziale) e potrebbe mostrare l'overlay anche
  // se l'utente ha già visto il pop-up nella sua lingua (es. 'en'), restando bloccato.
  const [langReady, setLangReady] = useState(false)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dmp-menu-lang')
      if (isLang(saved)) setLangState(saved)
    } catch {}
    setLangReady(true)
  }, [])
  function setLang(l: Lang) {
    setLangState(l)
    try { localStorage.setItem('dmp-menu-lang', l) } catch {}
  }

  // Menu localizzati: nomi/descrizioni/categorie sostituiti con le traduzioni
  // pre-generate dal gestionale (fallback all'italiano se mancanti). Tutto il
  // resto della pipeline (PDF, flipbook, modale) consuma questi dati tradotti.
  const localizedMenus = useMemo<Menu[]>(() => {
    if (lang === 'it') return menus
    return menus.map(m => ({
      ...m,
      name: translatedMenuName(m.name, m.translations, lang),
      dishes: m.dishes.map(d => ({
        ...d,
        name:        dishName(d.name, d.translations, lang),
        description: dishDescription(d.description, d.translations, lang),
        category:    categoryName(d.category, m.translations, lang),
      })),
    }))
  }, [menus, lang])

  // liveTheme: updated via postMessage from admin preview iframe
  const [liveTheme, setLiveTheme] = useState<RestaurantTheme>(restaurant.theme)
  const t = liveTheme
  const l = t.landing

  // editMode / showDummyData / cardPreviewOpen: driven by dmp-editor-state + dmp-nav
  const [editMode,        setEditMode]        = useState(false)
  const [showDummyData,   setShowDummyData]   = useState(false)
  const [cardPreviewOpen, setCardPreviewOpen] = useState(false)
  // hintForced: tab "Pop-up" dell'admin → tieni il pop-up visibile per la
  // modifica anche se disattivato/già chiuso, indipendentemente da showHint.
  const [hintForced,      setHintForced]      = useState(false)
  const isMobilePreview = useIsMobilePreview()

  const videoRef        = useRef<HTMLVideoElement>(null)
  const landingContentRef = useRef<HTMLDivElement>(null)
  const transitioningRef = useRef(false)
  const [posterVisible, setPosterVisible] = useState(true)
  const [posterBroken,  setPosterBroken]  = useState(false)

  // ── Admin preview bridge ───────────────────────────────────────────────────
  const isPreviewRef = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isPreview = new URLSearchParams(window.location.search).has('preview')
    if (!isPreview) return
    isPreviewRef.current = true
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'dmp-theme' && d.theme)  setLiveTheme(parseTheme(d.theme))
      if (d.type === 'dmp-nav') {
        setHintForced(d.view === 'hint')
        if (d.view === 'landing') {
          setPendingMenuId(null); setSelectedMenuId(null); setCardPreviewOpen(false)
        } else if (d.view === 'menu' || d.view === 'hint') {
          // L'editor può indicare quale menu mostrare (sub-tab per-menu).
          if (typeof d.menuId === 'string' && d.menuId) setSelectedMenuId(d.menuId)
          else setSelectedMenuId(p => p ?? menus[0]?.id ?? null)
          setCardPreviewOpen(false)
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

  // Notifica il parent (editor admin) di ogni cambio vista interno, così i tab
  // Landing/Menu/Card restano sincronizzati anche quando la navigazione parte
  // dall'interno dell'anteprima (bottone "Sfoglia il menu", back, chiudi card).
  // I dmp-nav del parent producono lo stesso stato → nessun loop di feedback.
  const currentView: 'landing' | 'menu' | 'card' | 'hint' =
    cardPreviewOpen ? 'card' : hintForced ? 'hint' : selectedMenuId !== null ? 'menu' : 'landing'
  useEffect(() => {
    if (!isPreviewRef.current) return
    try { window.parent?.postMessage({ type: 'dmp-view-changed', view: currentView }, window.location.origin) } catch {}
  }, [currentView])

  // ── Landing entrance animation — staggered fade/slide-up, plays once ──────
  useEffect(() => {
    const anims = animateLandingIn(landingContentRef.current)
    return () => { anims.forEach(a => a.revert()) }
  }, [])

  // ── PDF generation — driven by selected or pending menu ───────────────────
  const activeMenuId = selectedMenuId ?? pendingMenuId
  const activeMenu   = activeMenuId ? localizedMenus.find(m => m.id === activeMenuId) ?? null : null

  // m: MenuTheme effettivo per il menu attivo (override per-menu se presente,
  // altrimenti "Generale" — vedi resolveMenuTheme). effectiveTheme propaga
  // questa risoluzione a FlipbookViewer/DishModal/useMenuPDF senza altre modifiche.
  const m = resolveMenuTheme(t, activeMenuId)
  const effectiveTheme: RestaurantTheme = { ...t, menu: m }

  const { pdfUrl, categories, isGenerating, error } = useMenuPDF(
    { name: restaurant.name },
    activeMenu ? {
      id: activeMenu.id, name: activeMenu.name, lang,
      extra_pages: activeMenu.extra_pages ?? null,
      dishes: activeMenu.dishes.map(d => ({
        id: d.id, name: d.name, description: d.description,
        price: d.price, category: d.category||'Menu', allergens: d.allergens,
      })),
    } : null,
    effectiveTheme,
  )

  // ── Derived visibility flags ───────────────────────────────────────────────
  const transitioning = pendingMenuId !== null
  transitioningRef.current = transitioning
  const menuVisible   = selectedMenuId !== null
  const menuReady     = menuVisible && !!pdfUrl

  // ── Hint popup ("come sfogliare il menu") ──────────────────────────────────
  // Mostrato al centro con sfondo sfocato all'apertura del menu. Con showOnce
  // appare una sola volta per dispositivo (localStorage); nell'anteprima admin
  // non persiste mai, così resta visibile/editabile in edit mode.
  const hint = m.hintPopup
  // Testi del pop-up tradotti nella lingua scelta (fallback IT).
  const hintTitleText = hintTitle(hint.title, restaurant.hintTranslations, lang)
  const hintBodyText  = hintText(hint.text,  restaurant.hintTranslations, lang)
  const [showHint, setShowHint] = useState(false)
  // Chiave "già visto" per-lingua: cambiando lingua il pop-up riappare una volta,
  // tradotto. langReady garantisce che lang sia già il valore salvato dal device
  // prima che questo effetto giri, evitando la race condition (vedi commento sopra).
  const hintKey = (l: Lang) => `dmp-menu-hint-seen:${window.location.pathname}:${l}`
  useEffect(() => {
    // Nell'anteprima admin il pop-up non appare mai da solo: ogni modifica al
    // tema rigenera il PDF (menuReady false→true) e rifarebbe sbucare il
    // pop-up a ogni ritocco. Lì si vede solo dalla tab "Pop-up" (hintForced).
    if (isPreviewRef.current) return
    if (!langReady || !menuReady || !hint.enabled) return
    if (hint.showOnce) {
      try { if (localStorage.getItem(hintKey(lang))) return } catch {}
    }
    // Short delay so the popup doesn't snap in the instant the video ends —
    // lets the landing→menu fade (0.5 s) finish before the hint appears.
    const t = setTimeout(() => setShowHint(true), 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langReady, menuReady, hint.enabled, lang])
  function dismissHint() {
    setShowHint(false)
    if (!isPreviewRef.current && hint.showOnce) {
      try { localStorage.setItem(hintKey(lang), '1') } catch {}
    }
  }

  // ── Poster / video logic ───────────────────────────────────────────────────
  function handleCanPlay() {
    if (!l.background.immersiveTransition) setPosterVisible(false)
  }

  // In immersive mode the video doesn't autoplay, so the browser shows black.
  // A plain seek isn't enough on iOS Safari (it decodes no frame until playback
  // starts), so we "prime" it: play() muted and pause as soon as a frame has
  // actually been PRESENTED (requestVideoFrameCallback where available, timeout
  // fallback elsewhere). We deliberately do NOT seek back to 0 after pausing —
  // on iOS that can flush the decoded frame and bring the black screen back;
  // being paused a frame or two in is visually identical to the start.
  function primeFirstFrame(v: HTMLVideoElement, isStale: () => boolean) {
    if (isStale()) return
    const pause = () => { if (!isStale()) { try { v.pause() } catch {} } }
    const whenPresented = () => {
      const anyV = v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => void }
      if (typeof anyV.requestVideoFrameCallback === 'function') anyV.requestVideoFrameCallback(pause)
      else setTimeout(pause, 150)
    }
    const p = v.play()
    if (p?.then) {
      p.then(() => { if (!isStale()) whenPresented() })
        .catch(() => {
          // Autoplay blocked (e.g. iOS Low Power Mode): retry on first interaction.
          const retry = () => { if (!isStale()) primeFirstFrame(v, isStale) }
          window.addEventListener('touchstart', retry, { once: true, passive: true })
          window.addEventListener('click', retry, { once: true })
        })
    } else whenPresented()
  }

  useEffect(() => {
    if (!l.background.immersiveTransition) return
    const v = videoRef.current
    if (!v) return
    let cancelled = false
    primeFirstFrame(v, () => cancelled || transitioningRef.current)
    return () => { cancelled = true }
  }, [l.background.value, l.background.immersiveTransition]) // eslint-disable-line react-hooks/exhaustive-deps

  // Restore poster when landing re-appears, but only if the video isn't actively
  // playing — in loop/pingpong mode the video runs continuously behind the menu
  // and should reappear immediately without the poster covering it.
  // In immersive mode re-prime: rewind and pause on the first presented frame.
  useEffect(() => {
    if (!menuVisible) {
      const v = videoRef.current
      const playing = v && !v.paused && !v.ended && v.readyState > 2
      setPosterVisible(!playing)
      if (v && l.background.immersiveTransition) {
        try { v.currentTime = 0 } catch {}
        primeFirstFrame(v, () => transitioningRef.current)
      }
    }
  }, [menuVisible]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Immersive transition driver ────────────────────────────────────────────
  function openMenu(menuId: string) {
    if (editMode) return
    track('menu_open', menuId)
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
    // Safety fallback: duration + 3 s buffer so longer videos aren't cut short.
    // The previous hardcoded 8 s fired finish() mid-playback on videos > 8 s.
    const safetyMs = v.duration && isFinite(v.duration)
      ? Math.ceil(v.duration * 1000) + 3000
      : 60000
    const fallback = setTimeout(finish, safetyMs)
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
  const displayDesc = l.description.text || restaurant.description || (showDummyData ? 'Alta cucina italiana · dal 1987' : null)
  const displayName = l.title.text || restaurant.name
  const logoSrc      = l.logo.image || restaurant.logo_url
  const displayMenus = (showDummyData && menus.length === 0)
    ? [{ id: 'dummy-pranzo', name: 'Pranzo', dishes: [] as Dish[] }, { id: 'dummy-cena', name: 'Cena', dishes: [] as Dish[] }]
    : localizedMenus
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
  const allDishesFlat = localizedMenus.flatMap(m => m.dishes)
  const cardPreviewDish: DishData = allDishesFlat[0]
    ? { ...allDishesFlat[0], allergens: allDishesFlat[0].allergens ?? [] }
    : DUMMY_DISH
  const cardPreviewAllDishes: DishData[] = allDishesFlat.length
    ? allDishesFlat.map(d => ({ ...d, allergens: d.allergens ?? [] }))
    : [DUMMY_DISH, DUMMY_WINE]

  // ── Background landing layer styles ───────────────────────────────────────
  // GIFs are image files: a <video> element cannot decode them (black screen),
  // so they render through the image layer where they animate natively.
  const bgIsVideo = l.background.type === 'video'
  const bgIsImage = l.background.type === 'image' || l.background.type === 'gif'
  const bgColor   = l.background.type === 'color' ? l.background.value : '#0d0d0d'
  const textureBg = landingTextureCss(l.background.texture)
  const hasPoster = !!l.background.poster && !posterBroken

  // ── Menu buttons layout ────────────────────────────────────────────────────
  // 'column' (default): impilati verticalmente. 'row': affiancati e a capo.
  // In entrambi i casi restano NEL FLUSSO della landing (logo→nome→slogan→
  // bottoni→social): non collidono mai da soli. Lo spostamento libero avviene
  // solo tramite gli offset per-elemento (l.positions), scelti dall'utente.
  const isRowButtons = l.buttons.layout === 'row'
  const buttonsBlock = (
    <div
      className={`flex ${isRowButtons ? 'flex-row flex-wrap justify-center' : 'flex-col items-center'} gap-3 w-full`}
      style={{ marginTop: `${l.buttons.gapTop}rem` }}
    >
      {displayMenus.length === 0 ? (
        <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: l.title.color }}>Menu in aggiornamento.</p>
      ) : (
        displayMenus.map(menu => (
          <button key={menu.id} onClick={() => openMenu(menu.id)}
            className="group relative overflow-hidden transition-colors duration-300 flex items-center justify-center text-center"
            style={{
              width:          `${l.buttons.width}%`,
              paddingTop:     '0.75rem',
              paddingBottom:  '0.75rem',
              // Padding orizzontale adattivo: generoso in colonna (full-width),
              // ridotto in riga così testi lunghi restano centrati e non traboccano
              // dai bottoni stretti.
              paddingLeft:    isRowButtons ? '0.6rem' : '2.5rem',
              paddingRight:   isRowButtons ? '0.6rem' : '2.5rem',
              color:          l.buttons.textColor,
              background:     l.buttons.bgColor,
              border:         l.buttons.borderStyle === 'none' ? 'none' : `${l.buttons.borderWidth ?? 1}px ${l.buttons.borderStyle} ${l.buttons.borderColor}50`,
              borderRadius:   BUTTON_RADIUS,
              fontFamily:     BUTTON_FONT,
              fontSize:       `${l.buttons.fontSize}rem`,
              letterSpacing:  '0.28em',
              textTransform:  'uppercase',
              minWidth:       0,
            }}>
            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: `${l.buttons.borderColor}14` }} />
            {/* marginRight negativo = compensa lo spazio finale della letter-spacing
                così il testo resta otticamente centrato a qualsiasi larghezza. */}
            <span className="relative" style={{ marginRight: '-0.28em', overflowWrap: 'anywhere', minWidth: 0 }}>
              {l.buttons.showBrowsePrefix ? `${uiText('browseMenu', lang)} ${menu.name}` : menu.name}
            </span>
          </button>
        ))
      )}
    </div>
  )

  // Offset di posizione libero per un elemento della landing (transform:translate).
  // A (0,0) non introduce alcuna trasformazione: il flusso base resta intatto.
  const posStyle = (p: { x: number; y: number }): CSSProperties | undefined =>
    (p.x || p.y) ? { transform: `translate(${p.x}rem, ${p.y}rem)` } : undefined

  return (
    <div className="fixed inset-0 h-[100dvh]">
      <ThemeInjector theme={effectiveTheme} />
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

        {/* Video / immersive background */}
        {bgIsVideo && (
          <div className="absolute inset-0 pointer-events-none"
            style={{ opacity: transitioning ? 1 : l.background.opacity/100, zIndex: transitioning ? 40 : 0, transition: 'opacity 0.8s ease' }}>
            {hasPoster && (
              <img src={l.background.poster} alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: posterVisible ? 1 : 0, transition: 'opacity 0.6s ease' }}
                onError={() => setPosterBroken(true)} />
            )}
            <video ref={videoRef} src={l.background.value} muted playsInline preload="auto"
              poster={hasPoster ? l.background.poster : undefined}
              autoPlay={!l.background.immersiveTransition}
              loop={!l.background.immersiveTransition && l.background.loopMode === 'loop'}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: (hasPoster && posterVisible) ? 0 : 1, transition: 'opacity 0.6s ease' }}
              onCanPlay={handleCanPlay}
            />
          </div>
        )}

        {/* Texture overlay — after image/video layers so it paints on top of both */}
        {textureBg && (
          <div className="absolute inset-0 pointer-events-none" style={textureBg} />
        )}

        {/* Gold top rule */}
        <div className="absolute top-0 inset-x-0 h-px"
          style={{ background: `linear-gradient(90deg,transparent,${l.accent}55,transparent)` }} />


        {/* Content — fades during immersive transition */}
        <div ref={landingContentRef} className="relative flex flex-col items-center text-center px-10 w-full max-w-xs py-12"
          style={{ opacity: transitioning ? 0 : 1, transition: 'opacity 0.6s ease', pointerEvents: transitioning ? 'none' : 'auto' }}>

          <BannerCarousel banners={banners} accent={l.accent} />

          {/* Ogni elemento è avvolto da un wrapper con offset di posizione libero
              (l.positions.*). A (0,0) il transform è assente e il layout resta il
              flusso base logo→nome→slogan→bottoni→social, che si ricalibra da solo.
              Con offset ≠ 0 l'utente sposta liberamente l'elemento (può sovrapporsi). */}
          <div style={posStyle(l.positions.logo)}>
            <EditHandle target="landing-logo" editMode={editMode}>
              {logoSrc && isVis(vis, 'logo') && (
                <img src={logoSrc} alt={displayName}
                  className="object-contain"
                  style={{
                    height: `${l.logo.size * 0.75}rem`,
                    mixBlendMode: l.logo.mixBlend as any,
                    opacity: 0.88,
                    marginBottom: isVis(vis,'name') ? `${l.logo.gapBottom}rem` : '2.5rem',
                  }} />
              )}
            </EditHandle>
          </div>

          {!logoSrc && isVis(vis,'name') && (
            <div className="w-10 h-px mb-7" style={{ background: l.accent }} />
          )}

          <div style={posStyle(l.positions.title)}>
            <EditHandle target="landing-title" editMode={editMode}>
              {isVis(vis,'name') && (
                <h1 className="uppercase leading-none"
                  style={{
                    color: l.title.color, fontFamily: TITLE_FONT,
                    letterSpacing: '0.22em',
                    fontWeight: l.title.weight === 'bold' ? 700 : l.title.weight === 'normal' ? 400 : 300,
                  }}>
                  {lineSizesFor(displayName, l.title.size, l.title.lineSizes).map((ln, i) => (
                    <span key={i} style={{ display: 'block', fontSize: `${ln.size}rem` }}>{ln.text}</span>
                  ))}
                </h1>
              )}
            </EditHandle>
          </div>

          <div style={posStyle(l.positions.description)}>
            <EditHandle target="landing-desc" editMode={editMode}>
              {displayDesc && isVis(vis,'description') && (
                <p style={{ color: l.description.color, fontFamily: DESC_FONT, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: `${l.title.gapBottom}rem` }}>
                  {lineSizesFor(displayDesc, l.description.size, l.description.lineSizes).map((ln, i) => (
                    <span key={i} style={{ display: 'block', fontSize: `${ln.size}rem` }}>{ln.text}</span>
                  ))}
                </p>
              )}
            </EditHandle>
          </div>

          {!logoSrc && (isVis(vis,'name') || isVis(vis,'description')) && (
            <div className="w-10 h-px mt-7" style={{ background: l.accent }} />
          )}

          {/* Menu buttons — sempre nel flusso; row/column cambia solo la direzione */}
          <div className="w-full" style={posStyle(l.positions.buttons)}>
            <EditHandle target="landing-buttons" editMode={editMode} className="w-full">
              {buttonsBlock}
            </EditHandle>
          </div>

          {/* Social links */}
          <div style={posStyle(l.positions.socials)}>
            <EditHandle target="landing-socials" editMode={editMode}>
              <SocialBar restaurant={displayRestaurant} editMode={editMode} liveLanding={l} />
            </EditHandle>
          </div>
        </div>

        {/* Footer label */}
        <p className="absolute bottom-6 text-[8px] uppercase tracking-[0.35em]" style={{ color: l.title.color + '44' }}>
          menu digitale
        </p>
        <div className="absolute bottom-0 inset-x-0 h-px"
          style={{ background: `linear-gradient(90deg,transparent,${l.accent}55,transparent)` }} />

        {/* ── Selettore lingua — bandierina in alto a destra della landing ─────
             Mostra la lingua corrente come flag SVG; al tap apre un popover
             con tutte le lingue disponibili. Overlay trasparente chiude al tap
             fuori. Nascosto in editMode (il bottone Sfondo occupa lo stesso
             angolo). ── */}
        {!editMode && (
          <div className="absolute top-3 right-3 z-[200]">
            <button
              onClick={() => setLandingLangOpen(o => !o)}
              aria-label={`Lingua: ${LANG_LABELS[lang]}`}
              className="flex items-center justify-center w-9 h-9 rounded-full transition-opacity hover:opacity-70 active:opacity-50"
              style={{ background: `${l.title.color}18` }}
            >
              <FlagIcon lang={lang} className="w-6 h-4" />
            </button>

            {landingLangOpen && (
              <>
                <div
                  className="fixed inset-0 z-[199]"
                  onClick={() => setLandingLangOpen(false)}
                />
                <div
                  className="absolute right-0 top-full mt-1 z-[200] overflow-hidden shadow-2xl rounded-[6px] min-w-[140px]"
                  style={{
                    background: l.background.type === 'color'
                      ? (l.background.value + 'e8')
                      : 'rgba(20,18,14,0.92)',
                    border: `1px solid ${l.accent}33`,
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  {ALL_LANGS.map(lng => (
                    <button
                      key={lng}
                      onClick={() => { setLang(lng); setLandingLangOpen(false) }}
                      className="flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 transition-opacity hover:opacity-70"
                      style={{
                        color:      lng === lang ? l.accent : l.title.color + 'bb',
                        fontFamily: fontStack(l.buttons.font, 'sans'),
                        fontSize:   '10px',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                      }}
                    >
                      <FlagIcon lang={lng} className="w-6 h-4 shrink-0" />
                      {LANG_LABELS[lng]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
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
            <div className="flex flex-col items-center gap-4">
              <RingSpinner size={28} color={m.navigation.color} />
              <p className="text-[10px] uppercase tracking-[0.3em]"
                style={{ color: m.navigation.color, fontFamily: fontStack(m.stickyCategories.font,'sans') }}>
                {uiText('preparing', lang)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── FLIPBOOK LAYER — mounted once PDF is ready, stays mounted ────── */}
      {pdfUrl && (
        <div className="absolute inset-0"
          style={{ opacity: menuReady ? 1 : 0, pointerEvents: menuReady ? 'auto' : 'none', transition: 'opacity 0.5s ease' }}>
          <FlipbookViewer
            pdfUrl={pdfUrl}
            restaurantName={displayName}
            restaurantLogo={logoSrc}
            onBack={() => setSelectedMenuId(null)}
            categories={categories.length > 0 ? categories : undefined}
            dishes={activeMenu?.dishes ?? []}
            theme={effectiveTheme}
            editMode={editMode && !cardPreviewOpen}
            onEditTarget={sendEdit}
            onDishOpen={!editMode && activeMenuId ? (dishId) => track('dish_click', activeMenuId, dishId) : undefined}
            lang={lang}
            onLangChange={setLang}
            ads={t.ads.filter(a => !a.menuId || a.menuId === activeMenuId)}
          />
        </div>
      )}

      {/* ── HINT POPUP — istruzioni d'uso mostrate all'apertura del menu ──
          hintForced (tab "Pop-up" dell'admin) lo tiene visibile per la modifica
          anche se disattivato o già chiuso; il × / sfondo chiudono sempre,
          la modifica avviene dalla tab dedicata "Pop-up". ── */}
      {menuVisible && menuReady && !cardPreviewOpen && (hintForced || (hint.enabled && showHint))
        && (!!hintTitleText.trim() || !!hintBodyText.trim()) && (
        <div
          className="absolute inset-0 flex items-center justify-center px-8"
          style={{ zIndex: 450, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'dish-fade-in 0.7s ease both' }}
          onClick={dismissHint}
        >
          <div
            className="relative w-full max-w-sm text-center"
            style={{
              background:   hint.bgColor,
              borderRadius: cardBorderRadius(hint.borderRadius),
              border:       `1px solid ${m.accent}26`,
              padding:      '30px 26px',
              fontFamily:   fontStack(hint.font, 'sans'),
              animation:    'dish-fade-in 0.6s ease 0.1s both',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={e => { e.stopPropagation(); dismissHint() }}
              aria-label="Chiudi"
              className="absolute top-2.5 right-3.5 text-xl leading-none transition-opacity hover:opacity-60"
              style={{ color: hint.closeColor }}
            >
              ×
            </button>
            {hintTitleText && (
              <p style={{ color: hint.titleColor, fontSize: `${hint.titleSize}rem`, letterSpacing: '0.06em', fontWeight: 600, marginBottom: 12 }}>
                {hintTitleText}
              </p>
            )}
            <p style={{ color: hint.textColor, fontSize: `${hint.textSize}rem`, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
              {hintBodyText}
            </p>
          </div>
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
            theme={effectiveTheme}
            lang={lang}
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
