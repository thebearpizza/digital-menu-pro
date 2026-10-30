'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Pagina d'apertura (dopo il QR): qui si sceglie il menu, anche se è uno solo.
// Tutto l'aspetto viene dallo stile della pagina d'apertura (lib/landingStyle).
//
//  • Sfondo: carta (colore e superficie), gradiente, oppure foto e video che
//    si alternano in dissolvenza (lento zoom, velo, sfocatura), con titolo e
//    sottotitolo di ciascuno.
//  • Logo e/o nome, descrizione, ornamento; la bandierina per la lingua.
//  • La scelta del menu: pulsanti in vetro, pieni, bordati o solo testo, con
//    nome e orario. Toccandone uno la pagina sfuma nella carta di quel menu.
//  • Social, ragione sociale, P.IVA, indirizzo e informativa privacy.
//
// Video: in loop, a boomerang (file andata e ritorno preparato al caricamento)
// oppure "intro": immagine ferma; scelto il menu, il video parte e il menu si
// apre alla fine. L'attesa serve a precaricare il menu (pagina, caratteri,
// sfondo, foto dei primi piatti), che comunque inizia già qui: mentre si
// sceglie, si preparano tutti i menu.
//
// Anteprima della Personalizzazione (?preview=1): lo stile arriva dalla
// pagina che la contiene; toccando un elemento si apre il suo pannello.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ALL_LANGS, LANG_LABELS, isLang, menuName, type Lang } from '@/lib/translations'
import { fontStack, resolveFace, type TextStyle } from '@/lib/menuStyle'
import { introVideo, landingColor, landingFaces, landingFontsUrl, landingTexts, parseLanding, type LandingStyle } from '@/lib/landingStyle'
import { registerCustomFonts } from '@/lib/menuStyle'
import { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types'
import { GlassButton, GlassMenu, GlassMenuItem, GlassSheen, GlassTint, LiquidOn, glassSurface, SPRING } from './Glass'
import { Flag } from './Chrome'
import { t, type MenuChoice } from './i18n'
import { loadCustomFonts, loadFontCss, loadStyleAssets } from './fonts'
import { warmImage, whenIdle } from './preload'
import { paintPaper } from './paper'
import { drawOrnament } from './typeset'
import GlassStage, { type StageBackground } from './GlassStage'
import AdminReturn from './AdminReturn'
import FpsMeter from './FpsMeter'

const LANG_KEY = 'dmp-menu-lang'

export type SocialKind = 'instagram' | 'facebook' | 'website' | 'tripadvisor' | 'maps'
export type LandingPick =
  | 'l-background' | 'l-logo' | 'l-description' | 'l-choose' | 'l-buttons' | 'l-captions' | 'l-socials' | 'l-legal'

export interface LandingProps {
  token: string
  /** Indirizzo di partenza dei collegamenti: '/m' (QR) o '/prova'. */
  base?: '/m' | '/prova'
  /** Aperto dall'Anteprima del gestionale (tasto per tornarci). */
  fromAdmin?: boolean
  restaurant: {
    name:        string
    description: string | null
    /** Nascosti dal ristoratore nei dati del ristorante. */
    hide?:       { logo?: boolean; name?: boolean }
    socials:     { kind: SocialKind; url: string }[]
    legalName:   string | null
    vat:         string | null
    address:     string | null
  }
  menus:    MenuChoice[]
  style:    LandingStyle
  preview?: boolean
}

/** Stile di testo → CSS (faccia reale, colore effettivo). */
function css(tx: TextStyle, st: LandingStyle): React.CSSProperties {
  const f = resolveFace(tx.font, tx.weight, tx.italic)
  return {
    fontFamily: fontStack(tx.font), fontWeight: f.weight, fontStyle: f.italic ? 'italic' : 'normal', fontSize: tx.size,
    textTransform: tx.upper ? 'uppercase' : 'none', letterSpacing: `${tx.tracking}em`, color: landingColor(tx.color, st),
  }
}
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}

export default function Landing({ token, base: basePath = '/prova', fromAdmin = false, restaurant, menus, style: initialStyle, preview = false }: LandingProps) {
  const router = useRouter()
  const [st, setSt] = useState(initialStyle)
  const bg = st.background
  const onMedia = bg.kind === 'media' && bg.media.length > 0
  const base = onMedia ? '#14110e' : bg.paper

  const [lang, setLangState] = useState<Lang>('it')
  const [langOpen, setLangOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState<string | null>(null)
  // Intro: il video parte alla scelta del menu; intanto la pagina si svuota.
  const [introOn, setIntroOn] = useState(false)
  const introRef = useRef<HTMLVideoElement>(null)
  const introBusy = useRef(false)
  // Vetro liquido: chi gestisce lo sfondo lo descrive qui; il palco WebGL lo
  // disegna con le lenti. glOn = palco attivo (altrimenti vetro dei browser).
  const rootRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<(() => StageBackground) | null>(null)
  const [glOn, setGlOn] = useState(false)

  // Anteprima: lo stile arriva a ogni modifica dalla Personalizzazione.
  useEffect(() => {
    if (!preview) return
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const msg = e.data as { type?: string; style?: unknown }
      if (msg?.type === 'lito-landing' && msg.style) setSt(parseLanding(msg.style))
      if (msg?.type === 'lito-intro-test') startIntroRef.current(null)   // "Prova l'intro" dall'editor
    }
    window.addEventListener('message', onMsg)
    window.parent?.postMessage({ type: 'lito-preview-ready' }, window.location.origin)
    return () => window.removeEventListener('message', onMsg)
  }, [preview])

  // Caratteri (Google via proxy e caricati): testo invisibile finché non ci
  // sono, niente cambio di carattere a vista.
  const fontsKey = landingFontsUrl(st) + JSON.stringify(st.customFonts)
  useEffect(() => {
    let done = false
    const show = () => { if (!done) { done = true; setReady(true) } }
    const url = landingFontsUrl(st)
    Promise.all([url ? loadFontCss(url) : Promise.resolve(), loadCustomFonts(st.customFonts, landingTexts(st))])
      .then(() => Promise.all(landingFaces(st).map(f => document.fonts.load(f).catch(() => undefined))))
      .then(show, show)
    const tm = window.setTimeout(show, 2500)
    return () => clearTimeout(tm)
  }, [fontsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try { const saved = localStorage.getItem(LANG_KEY); if (isLang(saved)) setLangState(saved) } catch { /* memoria non disponibile */ }
  }, [])

  // Precaricamento dei menu mentre si sceglie: pagina (dati e codice),
  // caratteri, sfondo delle pagine e foto dei primi piatti.
  const preloadMenu = useCallback((m: MenuChoice, urgent: boolean) => {
    router.prefetch(`${basePath}/${token}?menu=${m.id}`, { kind: PrefetchKind.FULL })
    if (!m.preload) return
    registerCustomFonts(m.preload.style.customFonts)
    loadStyleAssets(m.preload.style).catch(() => undefined)
    for (const src of m.preload.images) warmImage(src, !urgent)
  }, [router, token, basePath])
  useEffect(() => {
    if (!ready || preview) return
    whenIdle(() => { for (const m of menus) preloadMenu(m, false) }, 2000)
  }, [ready, preview, menus, preloadMenu])

  // Sotto le barre di Safari: lo stesso fondo della pagina.
  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.backgroundColor
    html.style.backgroundColor = base
    return () => { html.style.backgroundColor = prev }
  }, [base])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(LANG_KEY, l) } catch { /* memoria non disponibile */ }
  }, [])

  const go = (m: MenuChoice) => {
    setLeaving(m.paper ?? '#fbf8f2')
    window.setTimeout(() => router.push(`${basePath}/${token}?menu=${m.id}`), 280)
  }

  /** Intro: parte il video (dal primo fotogramma utile), la pagina si svuota,
   *  il menu scelto si precarica; alla fine del video si apre il menu. Se il
   *  video non parte o si blocca, si apre subito. m = null: prova dall'editor
   *  (alla fine si torna all'immagine ferma). */
  const startIntro = (m: MenuChoice | null) => {
    const iv = introVideo(st), v = introRef.current
    if (!iv || !v) { if (m) go(m); return }
    if (introBusy.current) return
    introBusy.current = true
    if (m) preloadMenu(m, true)
    setIntroOn(true)
    let last = -1, still = 0
    const finish = () => {
      clearInterval(watch); clearTimeout(cap)
      v.onended = null
      if (m) { go(m); return }
      introBusy.current = false
      setIntroOn(false)
      v.pause()
      try { v.currentTime = iv.startAt } catch { /* non ancora caricato */ }
    }
    const watch = window.setInterval(() => {
      if (v.currentTime === last) { if (++still >= 6) finish() } else still = 0
      last = v.currentTime
    }, 500)
    const cap = window.setTimeout(finish, 30000)
    v.onended = finish
    try { v.currentTime = iv.startAt } catch { /* si parte da dove si è */ }
    v.play().catch(finish)
  }
  const startIntroRef = useRef(startIntro)
  startIntroRef.current = startIntro

  const open = (m: MenuChoice) => {
    if (leaving || preview || introBusy.current) return
    if (introVideo(st)) startIntro(m)
    else go(m)
  }

  // Anteprima: un tocco dice alla Personalizzazione che cosa si vuole
  // modificare (niente navigazione). La lingua resta usabile.
  const onPickCapture = (e: React.MouseEvent) => {
    if (!preview) return
    const el = e.target as HTMLElement
    if (el.closest('[data-nopick]')) return
    e.preventDefault(); e.stopPropagation()
    const target = (el.closest('[data-pick]') as HTMLElement | null)?.dataset.pick ?? 'l-background'
    window.parent?.postMessage({ type: 'lito-pick', target }, window.location.origin)
  }

  // Entrata a scalare. Per gli elementi in vetro il contenitore si sposta e
  // basta: la dissolvenza va sull'elemento stesso (un antenato semitrasparente
  // spegnerebbe la sfocatura, che poi comparirebbe di scatto).
  // Durante l'intro tutto sparisce insieme, senza ritardi.
  const motion = st.motion.entrance
  const shown = ready && !introOn
  const delay = (i: number) => (introOn ? 0 : 120 + i * 90)
  const move = (i: number): React.CSSProperties => motion === 'rise'
    ? { transform: shown ? 'none' : 'translate3d(0, 12px, 0)', transition: `transform 900ms ${SPRING} ${delay(i)}ms` }
    : {}
  const fade = (i: number): React.CSSProperties => motion === 'none' && !introOn
    ? { opacity: shown ? 1 : 0 }
    : { opacity: shown ? 1 : 0, transition: `opacity ${introOn ? 450 : 700}ms ease ${delay(i)}ms` }
  const appear = (i: number): React.CSSProperties => {
    const m = move(i), f = fade(i)
    return { ...m, ...f, transition: [m.transition, f.transition].filter(Boolean).join(', ') || undefined }
  }

  const left = st.layout.align === 'left'
  const B = st.buttons
  const hasLogo = !!st.logo.url && !restaurant.hide?.logo
  const showName = !restaurant.hide?.name && st.logo.showName
  const showLogo = st.logo.showLogo && hasLogo
  const shadow = onMedia ? '0 2px 18px rgba(0,0,0,0.35)' : 'none'
  const glassTint = B.tint
  const header = (
    <header style={{ ...appear(1), textAlign: left ? 'left' : 'center', width: '100%', maxWidth: 520 }}>
      {showLogo && (
        <div data-pick="l-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={st.logo.url!} alt={restaurant.name} className={left ? '' : 'mx-auto'}
            style={{ maxHeight: st.logo.size, maxWidth: st.logo.size * 2.6, objectFit: 'contain', filter: onMedia ? 'drop-shadow(0 2px 10px rgba(0,0,0,0.35))' : 'none' }} />
        </div>
      )}
      {showName && (
        <h1 data-pick="l-logo" style={{ ...css(st.name, st), lineHeight: 1.05, textShadow: shadow, marginTop: showLogo ? 14 : 0 }}>{restaurant.name}</h1>
      )}
      {st.description.show && restaurant.description && (
        <p data-pick="l-description" style={{ ...css(st.description.text, st), marginTop: 12, textShadow: onMedia ? '0 1px 10px rgba(0,0,0,0.35)' : 'none' }}>
          {restaurant.description}
        </p>
      )}
      {st.ornament !== 'none' && (
        <div data-pick="l-logo" style={{ marginTop: 16, display: 'flex', justifyContent: left ? 'flex-start' : 'center' }}>
          <OrnamentCanvas kind={st.ornament} color={st.colors.accent} />
        </div>
      )}
    </header>
  )

  const buttons = (
    <section className="w-full" style={{ maxWidth: B.width, marginLeft: left ? 0 : 'auto', marginRight: left ? 0 : 'auto' }}>
      {st.chooseLabel.show && (
        <p data-pick="l-choose" style={{ ...css(st.chooseLabel.text, st), marginBottom: 14, textAlign: left ? 'left' : 'center', textShadow: onMedia ? '0 1px 10px rgba(0,0,0,0.35)' : 'none', ...appear(2) }}>
          {t('chooseMenu', lang)}
        </p>
      )}
      <div data-pick="l-buttons" className="flex flex-col" style={{ gap: B.style === 'minimal' ? 0 : B.gap }}>
        {menus.map((m, i) => (
          <MenuButton key={m.id} st={st} name={menuName(m.name, m.translations, lang)} hours={B.hours.show ? m.hours ?? null : null}
            first={i === 0} left={left} gl={glOn} onClick={() => open(m)} move={move(3 + i)} fade={fade(3 + i)} />
        ))}
      </div>
    </section>
  )

  return (
    <div ref={rootRef} className="fixed inset-0 overflow-hidden" style={{ background: base }} onClickCapture={onPickCapture}>
      <div data-pick="l-background" className="absolute inset-0">
        {onMedia ? <Media st={st} introRef={introRef} introOn={introOn} bgRef={bgRef} /> : <PaperCanvas st={st} bgRef={bgRef} />}
      </div>
      {/* Vetro liquido: sfondo e lenti disegnati in WebGL (sotto i testi). */}
      <GlassStage rootRef={rootRef} background={bgRef} glass={B.glass} liquidPress={B.press === 'liquid'} onState={setGlOn} />
      {!preview && <AdminReturn fromAdmin={fromAdmin} />}
      <FpsMeter />

      {/* Lingua */}
      <div data-nopick className="fixed" style={{ top: 'calc(env(safe-area-inset-top) + 12px)', right: 'max(14px, env(safe-area-inset-right))', zIndex: 20 }}>
        <GlassTint.Provider value={onMedia || lum(bg.paper) < 0.45 ? 'dark' : 'light'}>
          <LiquidOn.Provider value={glOn}>
            <GlassButton hidden={!shown} label={`${t('language', lang)}: ${LANG_LABELS[lang]}`} expanded={langOpen} onClick={() => setLangOpen(o => !o)}>
              <Flag lang={lang} />
            </GlassButton>
          </LiquidOn.Provider>
        </GlassTint.Provider>
      </div>
      <div data-nopick>
        <LiquidOn.Provider value={glOn}>
        <GlassMenu open={langOpen} onClose={() => setLangOpen(false)} align="right" edge={14}
          title={t('language', lang)} top="calc(env(safe-area-inset-top) + 60px)">
          {ALL_LANGS.map(l => (
            <GlassMenuItem key={l} icon={<Flag lang={l} />} label={LANG_LABELS[l]} checked={l === lang}
              onClick={() => { setLangOpen(false); setLang(l) }} />
          ))}
        </GlassMenu>
        </LiquidOn.Provider>
      </div>

      <main className="relative h-full overflow-y-auto flex flex-col"
        style={{ zIndex: 3, pointerEvents: introOn ? 'none' : undefined, alignItems: left ? 'flex-start' : 'center', padding: 'calc(env(safe-area-inset-top) + 64px) 22px calc(env(safe-area-inset-bottom) + 18px)', overscrollBehavior: 'contain' }}>
        {st.layout.header === 'center' && <div className="flex-1" style={{ minHeight: 12 }} />}
        {header}
        <GlassTint.Provider value={glassTint}>
          {st.layout.buttons === 'center'
            ? <><div style={{ height: 34 }} />{buttons}<div className="flex-1" style={{ minHeight: 28 }} /></>
            : <><div className="flex-1" style={{ minHeight: 28 }} />{buttons}</>}
        </GlassTint.Provider>

        {/* Social e dati legali */}
        <footer className="w-full" style={{ marginTop: 26, textAlign: left ? 'left' : 'center', ...move(3 + menus.length) }}>
          {st.socials.show && restaurant.socials.length > 0 && (
            <div data-pick="l-socials" className="flex" style={{ gap: 10, marginBottom: 18, justifyContent: left ? 'flex-start' : 'center' }}>
              {restaurant.socials.map(sc => (
                <a key={sc.kind} href={sc.url} target="_blank" rel="noopener noreferrer" aria-label={sc.kind}
                  data-glass={st.socials.style === 'glass' && glOn ? '' : undefined} data-radius="20"
                  className="relative flex items-center justify-center active:scale-95 transition-transform"
                  style={{
                    ...(st.socials.style === 'glass' && !glOn ? glassSurface('light', onMedia || lum(bg.paper) < 0.45 ? 'dark' : 'light') : {}),
                    width: 40, height: 40, borderRadius: 20, color: st.colors.ink, ...fade(3 + menus.length),
                  }}>
                  {st.socials.style === 'glass' && !glOn && <GlassSheen />}
                  <SocialIcon kind={sc.kind} />
                </a>
              ))}
            </div>
          )}
          <div data-pick="l-legal" style={fade(4 + menus.length)}>
            <Legal restaurant={restaurant} token={token} base={basePath} lang={lang} style={css(st.legal.text, st)} />
          </div>
        </footer>
      </main>

      {/* Uscita: la pagina sfuma nella carta del menu scelto. */}
      <div aria-hidden className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 60, background: leaving ?? bg.paper, opacity: leaving ? 1 : 0, transition: 'opacity 280ms ease' }} />
    </div>
  )
}

// ── Pulsante di un menu ──────────────────────────────────────────────────────

function MenuButton({ st, name, hours, first, left, gl, onClick, move, fade }: {
  st: LandingStyle; name: string; hours: string | null; first: boolean; left: boolean
  /** Vetro liquido attivo (lo disegna il palco WebGL: qui solo testo). */
  gl: boolean
  onClick: () => void
  move: React.CSSProperties; fade: React.CSSProperties
}) {
  const [pressed, setPressed] = useState(false)
  const release = () => setPressed(false)
  const B = st.buttons
  const dark = B.tint === 'dark'
  const ink = landingColor(B.name.color, st)
  const borderColor = landingColor(B.border.color, st)
  const sh = B.shadow
  const surface: React.CSSProperties =
    B.style === 'glass' ? (gl ? {}
      : dark
        ? { ...glassSurface('light', 'dark'), background: 'linear-gradient(180deg, rgba(30,24,18,0.30), rgba(30,24,18,0.18))', backdropFilter: 'blur(18px) saturate(1.6)', WebkitBackdropFilter: 'blur(18px) saturate(1.6)' }
        : { ...glassSurface(), background: 'linear-gradient(180deg, rgba(255,255,255,0.62), rgba(255,255,255,0.42))' })
    : B.style === 'solid' ? { background: B.fill, boxShadow: sh ? `0 ${6 * sh}px ${18 * sh}px rgba(20,14,8,${0.32 * sh}), 0 1px 3px rgba(20,14,8,${0.2 * sh})` : 'none' }
    : B.style === 'outline' ? { boxShadow: `inset 0 0 0 ${Math.max(1, B.border.width || 1.2)}px ${rgba(B.border.width ? borderColor : ink, B.border.width ? 1 : 0.7)}${sh ? `, 0 ${6 * sh}px ${18 * sh}px rgba(0,0,0,${0.22 * sh})` : ''}` }
    : { borderTop: first ? 'none' : `1px solid ${rgba(ink, 0.22)}`, borderRadius: 0 }
  // Bordo scelto (pieno e vetro; il bordato lo ha già nel suo contorno).
  const border = B.border.width && (B.style === 'solid' || B.style === 'glass') ? { outline: `${B.border.width}px solid ${borderColor}`, outlineOffset: -B.border.width } : {}
  // Sul colore pieno il testo si adatta (chiaro su fondo scuro, e viceversa)
  // se il ristoratore ha lasciato i colori della pagina.
  const solidText = B.style === 'solid' && (B.name.color === 'ink' || B.name.color === 'soft')
    ? (lum(B.fill) < 0.5 ? '#ffffff' : '#1d1915') : null
  const nameCss = { ...css(B.name, st), ...(solidText ? { color: solidText } : {}) }
  const hoursCss = { ...css(B.hours.text, st), ...(solidText ? { color: rgba(solidText, 0.72) } : {}) }
  const split = B.content === 'split'
  const scale = pressed ? (B.press === 'scale' ? 0.965 : B.press === 'liquid' ? 0.99 : 1) : 1
  const arrow = B.arrow === 'none' ? null : (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="relative shrink-0" style={{ color: nameCss.color as string, opacity: 0.75 }}>
      {B.arrow === 'chevron'
        ? <path d="M5 2.5L9.5 7 5 11.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        : <path d="M2 7h9.5M7.5 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
  return (
    <div style={move}>
      <button type="button" onClick={onClick}
        onPointerDown={() => setPressed(true)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
        data-glass={B.style === 'glass' && gl ? '' : undefined} data-radius={B.radius} data-pressed={pressed ? '1' : '0'}
        className="relative w-full flex items-center"
        style={{ ...surface, ...border, minHeight: B.height, padding: `11px ${B.paddingX}px`, gap: 12,
          borderRadius: B.style === 'minimal' ? 0 : B.radius, WebkitTapHighlightColor: 'transparent',
          ...fade, transform: `scale(${scale})`, transition: `transform 300ms ${SPRING}, ${fade.transition ?? 'none'}` }}>
        {B.style === 'glass' && !gl && <GlassSheen />}
        {split ? (<>
          <span className="relative flex-1 min-w-0 text-left" style={{ ...nameCss, lineHeight: 1.15 }}>{name}</span>
          {hours && <span className="relative shrink-0" style={hoursCss}>{hours}</span>}
        </>) : (
          <span className="relative flex-1 min-w-0 flex flex-col" style={{ alignItems: left ? 'flex-start' : 'center' }}>
            <span style={{ ...nameCss, lineHeight: 1.15, textAlign: left ? 'left' : 'center' }}>{name}</span>
            {hours && <span style={{ ...hoursCss, marginTop: 4 }}>{hours}</span>}
          </span>
        )}
        {arrow}
      </button>
    </div>
  )
}

// ── Sfondi ───────────────────────────────────────────────────────────────────

/** Carta (o gradiente) con luce e superficie, come le pagine del menu. */
function PaperCanvas({ st, bgRef }: { st: LandingStyle; bgRef: React.MutableRefObject<(() => StageBackground) | null> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const version = useRef(0)
  const bg = st.background
  // Per il vetro liquido: la carta è già a misura di schermo.
  bgRef.current = () => ({
    layers: ref.current ? [{ source: ref.current, alpha: 1, scale: 1, cover: false, dynamic: false, version: version.current }] : [],
    veil: 0, blur: 0, base: bg.paper,
  })
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const paint = () => {
      const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 3)
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
      const c = cv.getContext('2d')
      if (!c) return
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (bg.kind === 'gradient') {
        const g = c.createLinearGradient(0, 0, 0, H)
        g.addColorStop(0, bg.paper); g.addColorStop(1, bg.color2)
        c.fillStyle = g
      } else c.fillStyle = bg.paper
      c.fillRect(0, 0, W, H)
      const dark = lum(bg.paper) < 0.45
      const r = c.createRadialGradient(W * 0.5, H * 0.38, 0, W * 0.5, H * 0.38, Math.hypot(W, H) * 0.62)
      r.addColorStop(0, dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)')
      r.addColorStop(1, dark ? 'rgba(0,0,0,0.22)' : 'rgba(150,130,100,0.12)')
      c.fillStyle = r; c.fillRect(0, 0, W, H)
      paintPaper(c, bg.texture, bg.textureStrength, W, H)
      version.current++
    }
    paint()
    window.addEventListener('resize', paint)
    return () => window.removeEventListener('resize', paint)
  }, [bg.kind, bg.paper, bg.color2, bg.texture, bg.textureStrength])
  return <canvas ref={ref} aria-hidden className="absolute inset-0 w-full h-full" />
}

/** Foto e video a tutto schermo: si alternano in dissolvenza; le foto con un
 *  lento zoom, i video muti in loop (o a boomerang). Titolo e sottotitolo al
 *  centro. Intro: immagine ferma e il video pronto, che parte su richiesta. */
function Media({ st, introRef, introOn, bgRef }: {
  st: LandingStyle; introRef: React.RefObject<HTMLVideoElement>; introOn: boolean
  bgRef: React.MutableRefObject<(() => StageBackground) | null>
}) {
  const bg = st.background
  const iv = introVideo(st)
  const list = iv ? [iv] : bg.media
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  useEffect(() => { if (!introOn) setPlaying(false) }, [introOn])
  // Per il vetro liquido: gli stessi strati, tempi e zoom della pagina HTML.
  const els = useRef(new Map<string, HTMLImageElement | HTMLVideoElement>())
  const setEl = (id: string) => (el: HTMLImageElement | HTMLVideoElement | null) => { if (el) els.current.set(id, el); else els.current.delete(id) }
  const timing = useRef({ cur: 0, since: performance.now(), prev: -1, prevSince: 0 })
  const playingAt = useRef(0)
  const veilAt = useRef({ on: introOn, at: 0 })
  useEffect(() => {
    if (list.length < 2) return
    const tm = window.setInterval(() => setI(v => (v + 1) % list.length), bg.interval * 1000)
    return () => clearInterval(tm)
  }, [list.length, bg.interval])
  const k0 = i % Math.max(1, list.length)
  const cur = list[k0]
  if (timing.current.cur !== k0) timing.current = { cur: k0, since: performance.now(), prev: timing.current.cur, prevSince: timing.current.since }
  if (veilAt.current.on !== introOn) veilAt.current = { on: introOn, at: performance.now() }
  bgRef.current = () => {
    const now = performance.now()
    const zoom = bg.blur > 0 ? 1.06 : 1
    const kb = (since: number) => {
      if (!bg.kenBurns) return 1
      const x = Math.min(1, (now - since) / ((bg.interval + 2) * 1000))
      return 1 + 0.09 * (1 - Math.pow(1 - x, 3))
    }
    const layers: StageBackground['layers'] = []
    if (iv) {
      const stillEl = els.current.get('still'), v = introRef.current
      if (stillEl) layers.push({ source: stillEl, alpha: 1, scale: zoom, cover: true, dynamic: false })
      if (v) {
        const a = !stillEl ? 1 : playingAt.current ? Math.min(1, (now - playingAt.current) / 350) : 0
        if (a > 0) layers.push({ source: v, alpha: a, scale: zoom, cover: true, dynamic: true })
      }
    } else {
      const tm = timing.current
      const x = tm.prev >= 0 ? Math.min(1, (now - tm.since) / 1400) : 1
      const add = (idx: number, since: number, alpha: number) => {
        const m = list[idx], el = m && els.current.get(m.id)
        if (el) layers.push({ source: el, alpha, scale: zoom * (m.video ? 1 : kb(since)), cover: true, dynamic: m.video })
      }
      if (tm.prev >= 0 && tm.prev !== tm.cur && x < 1) add(tm.prev, tm.prevSince, 1 - x)
      add(tm.cur, tm.since, x)
    }
    const va = veilAt.current
    const vk = va.at === 0 ? (va.on ? 0 : 1) : va.on ? 1 - Math.min(1, (now - va.at) / 600) : Math.min(1, (now - va.at) / 600)
    return { layers, veil: bg.overlay * vk, blur: bg.blur, base: '#14110e' }
  }
  const blur = bg.blur > 0 ? { filter: `blur(${bg.blur}px)`, transform: 'scale(1.06)' } : {}
  // Immagine ferma dell'intro: quella scelta, altrimenti il primo fotogramma utile.
  const still = iv ? bg.introImage ?? iv.poster : null
  return (
    <>
      <style>{`@keyframes lito-kb { from { transform: scale(1.0) } to { transform: scale(1.09) } }
        @keyframes lito-cap { from { opacity: 0; transform: translate3d(0, 8px, 0) } to { opacity: 1; transform: none } }`}</style>
      {iv ? (
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0" style={blur}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {still && <img ref={setEl('still')} src={still} alt="" crossOrigin="anonymous" className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover' }} />}
            {/* Il video resta sotto l'immagine finché non scorre davvero
                (niente fotogramma nero o fermo a vista). */}
            <video ref={introRef} src={iv.url} muted playsInline preload="auto" crossOrigin="anonymous" className="absolute inset-0 w-full h-full"
              onLoadedMetadata={e => { try { e.currentTarget.currentTime = iv.startAt } catch { /* ok */ } }}
              onPlaying={() => { playingAt.current = performance.now(); setPlaying(true) }}
              onPause={() => { playingAt.current = 0 }}
              style={{ objectFit: 'cover', opacity: playing || !still ? 1 : 0, transition: 'opacity 350ms ease' }} />
          </div>
        </div>
      ) : list.map((b, k) => (
        <div key={b.id} aria-hidden className="absolute inset-0 overflow-hidden" style={{ opacity: k === k0 ? 1 : 0, transition: 'opacity 1400ms ease' }}>
          <div className="absolute inset-0" style={blur}>
            {b.video
              // Il poster resta visibile se il video non parte (es. formato non supportato).
              ? <video ref={setEl(b.id)} src={bg.videoMode === 'boomerang' ? b.boomerang ?? b.url : b.url} poster={b.poster ?? undefined}
                  muted playsInline autoPlay loop preload="auto" crossOrigin="anonymous" className="w-full h-full" style={{ objectFit: 'cover' }} />
              // eslint-disable-next-line @next/next/no-img-element
              : <img ref={setEl(b.id)} key={k === k0 ? `on-${i}` : 'off'} src={b.url} alt="" crossOrigin="anonymous" className="w-full h-full"
                  style={{ objectFit: 'cover', animation: k === k0 && bg.kenBurns ? `lito-kb ${bg.interval + 2}s ease-out forwards` : 'none' }} />}
          </div>
        </div>
      ))}
      {/* Velo per la leggibilità: più scuro in alto (nome) e in basso (pulsanti).
          Durante l'intro sparisce: il video si vede pieno. */}
      <div aria-hidden className="absolute inset-0" style={{
        opacity: introOn ? 0 : 1, transition: 'opacity 600ms ease',
        background: `linear-gradient(180deg, rgba(0,0,0,${0.84 * bg.overlay}) 0%, rgba(0,0,0,${0.1 * bg.overlay}) 32%, rgba(0,0,0,${0.2 * bg.overlay}) 52%, rgba(0,0,0,${Math.min(0.92, 1.36 * bg.overlay)}) 100%)`,
      }} />
      {st.captions.show && !introOn && (cur?.title || cur?.subtitle) && (
        <div key={cur.id} data-pick="l-captions" className="absolute left-0 right-0 text-center"
          style={{ top: '38%', padding: '0 28px', animation: 'lito-cap 900ms ease both', zIndex: 2 }}>
          {cur.title && <p style={{ ...css(st.captions.title, st), lineHeight: 1.15, textShadow: '0 2px 16px rgba(0,0,0,0.45)' }}>{cur.title}</p>}
          {cur.subtitle && <p style={{ ...css(st.captions.subtitle, st), marginTop: 8, textShadow: '0 1px 10px rgba(0,0,0,0.5)' }}>{cur.subtitle}</p>}
        </div>
      )}
      {list.length > 1 && (
        <div aria-hidden className="absolute left-0 right-0 flex justify-center pointer-events-none" style={{ top: 'calc(38% + 86px)', gap: 6, zIndex: 2 }}>
          {list.map((b, k) => (
            <span key={b.id} style={{ width: k === k0 ? 16 : 6, height: 6, borderRadius: 3, background: k === k0 ? '#fff' : 'rgba(255,255,255,0.5)', transition: `width 500ms ${SPRING}, background 300ms ease` }} />
          ))}
        </div>
      )}
    </>
  )
}

// ── Dettagli ─────────────────────────────────────────────────────────────────

function OrnamentCanvas({ kind, color }: { kind: LandingStyle['ornament']; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    cv.width = 100 * dpr; cv.height = 16 * dpr
    const c = cv.getContext('2d')
    if (!c) return
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.clearRect(0, 0, 100, 16)
    drawOrnament(c, kind, 50, 8, 1, color, rgba(color, 0.55))
  }, [kind, color])
  return <canvas ref={ref} aria-hidden style={{ width: 100, height: 16, display: 'block' }} />
}

function Legal({ restaurant, token, base, lang, style }: { restaurant: LandingProps['restaurant']; token: string; base: string; lang: Lang; style: React.CSSProperties }) {
  const line1 = [restaurant.legalName || restaurant.name, restaurant.vat ? `${t('vat', lang)} ${restaurant.vat}` : null].filter(Boolean).join(' · ')
  return (
    <div style={{ ...style, lineHeight: 1.6 }}>
      <p>{line1}</p>
      {restaurant.address && <p>{restaurant.address}</p>}
      <a href={`${base}/${token}/privacy`} className="underline underline-offset-2" style={{ color: style.color }}>{t('privacy', lang)}</a>
    </div>
  )
}

function SocialIcon({ kind }: { kind: SocialKind }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, className: 'relative' }
  switch (kind) {
    case 'instagram': return <svg {...common}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" /></svg>
    case 'facebook':  return <svg {...common}><path d="M14.5 8.5h2.5V5h-2.5C12 5 10.5 6.6 10.5 9v2H8v3.5h2.5V21H14v-6.5h2.6l.4-3.5H14V9.3c0-.5.3-.8.5-.8z" /></svg>
    case 'website':   return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.6 3.5 5.4 3.5 8.5s-1.1 5.9-3.5 8.5c-2.4-2.6-3.5-5.4-3.5-8.5S9.6 6.1 12 3.5z" /></svg>
    case 'tripadvisor': return <svg {...common}><circle cx="7.5" cy="13" r="3.5" /><circle cx="16.5" cy="13" r="3.5" /><path d="M4 9.5c2.3-1.6 5-2.5 8-2.5s5.7.9 8 2.5M12 13v.01" /></svg>
    case 'maps':      return <svg {...common}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>
  }
}
