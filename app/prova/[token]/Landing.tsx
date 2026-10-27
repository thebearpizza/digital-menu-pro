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
// Anteprima della Personalizzazione (?preview=1): lo stile arriva dalla
// pagina che la contiene; toccando un elemento si apre il suo pannello.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ALL_LANGS, LANG_LABELS, isLang, menuName, type Lang } from '@/lib/translations'
import { fontStack, resolveFace, type TextStyle } from '@/lib/menuStyle'
import { landingColor, landingFaces, landingFontsUrl, parseLanding, type LandingStyle } from '@/lib/landingStyle'
import { GlassButton, GlassMenu, GlassMenuItem, GlassSheen, GlassTint, glassSurface, SPRING } from './Glass'
import { Flag } from './Chrome'
import { t, type MenuChoice } from './i18n'
import { loadCustomFonts, loadFontCss } from './fonts'
import { paintPaper } from './paper'
import { drawOrnament } from './typeset'

const LANG_KEY = 'dmp-menu-lang'

export type SocialKind = 'instagram' | 'facebook' | 'website' | 'tripadvisor' | 'maps'
export type LandingPick =
  | 'l-background' | 'l-logo' | 'l-description' | 'l-choose' | 'l-buttons' | 'l-captions' | 'l-socials' | 'l-legal'

export interface LandingProps {
  token: string
  restaurant: {
    name:        string
    description: string | null
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

export default function Landing({ token, restaurant, menus, style: initialStyle, preview = false }: LandingProps) {
  const router = useRouter()
  const [st, setSt] = useState(initialStyle)
  const bg = st.background
  const onMedia = bg.kind === 'media' && bg.media.length > 0
  const base = onMedia ? '#14110e' : bg.paper

  const [lang, setLangState] = useState<Lang>('it')
  const [langOpen, setLangOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState<string | null>(null)

  // Anteprima: lo stile arriva a ogni modifica dalla Personalizzazione.
  useEffect(() => {
    if (!preview) return
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const msg = e.data as { type?: string; style?: unknown }
      if (msg?.type === 'lito-landing' && msg.style) setSt(parseLanding(msg.style))
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
    Promise.all([url ? loadFontCss(url) : Promise.resolve(), loadCustomFonts(st.customFonts)])
      .then(() => Promise.all(landingFaces(st).map(f => document.fonts.load(f).catch(() => undefined))))
      .then(show, show)
    const tm = window.setTimeout(show, 2500)
    return () => clearTimeout(tm)
  }, [fontsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try { const saved = localStorage.getItem(LANG_KEY); if (isLang(saved)) setLangState(saved) } catch { /* memoria non disponibile */ }
    if (!preview) for (const m of menus) router.prefetch(`/prova/${token}?menu=${m.id}`)
  }, [menus, router, token, preview])

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

  const open = (m: MenuChoice) => {
    if (leaving || preview) return
    setLeaving(m.paper ?? '#fbf8f2')
    window.setTimeout(() => router.push(`/prova/${token}?menu=${m.id}`), 280)
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
  const motion = st.motion.entrance
  const move = (i: number): React.CSSProperties => motion === 'rise'
    ? { transform: ready ? 'none' : 'translate3d(0, 12px, 0)', transition: `transform 900ms ${SPRING} ${120 + i * 90}ms` }
    : {}
  const fade = (i: number): React.CSSProperties => motion === 'none'
    ? { opacity: ready ? 1 : 0 }
    : { opacity: ready ? 1 : 0, transition: `opacity 700ms ease ${120 + i * 90}ms` }
  const appear = (i: number): React.CSSProperties => {
    const m = move(i), f = fade(i)
    return { ...m, ...f, transition: [m.transition, f.transition].filter(Boolean).join(', ') || undefined }
  }

  const left = st.layout.align === 'left'
  const B = st.buttons
  const showName = st.logo.mode !== 'logo' || !st.logo.url
  const showLogo = st.logo.mode !== 'name' && !!st.logo.url
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
            first={i === 0} left={left} onClick={() => open(m)} move={move(3 + i)} fade={fade(3 + i)} />
        ))}
      </div>
    </section>
  )

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: base }} onClickCapture={onPickCapture}>
      <div data-pick="l-background" className="absolute inset-0">
        {onMedia ? <Media st={st} /> : <PaperCanvas st={st} />}
      </div>

      {/* Lingua */}
      <div data-nopick className="fixed" style={{ top: 'calc(env(safe-area-inset-top) + 12px)', right: 'max(14px, env(safe-area-inset-right))', zIndex: 20 }}>
        <GlassTint.Provider value={onMedia || lum(bg.paper) < 0.45 ? 'dark' : 'light'}>
          <GlassButton hidden={!ready} label={`${t('language', lang)}: ${LANG_LABELS[lang]}`} expanded={langOpen} onClick={() => setLangOpen(o => !o)}>
            <Flag lang={lang} />
          </GlassButton>
        </GlassTint.Provider>
      </div>
      <div data-nopick>
        <GlassMenu open={langOpen} onClose={() => setLangOpen(false)} align="right" edge={14}
          title={t('language', lang)} top="calc(env(safe-area-inset-top) + 60px)">
          {ALL_LANGS.map(l => (
            <GlassMenuItem key={l} icon={<Flag lang={l} />} label={LANG_LABELS[l]} checked={l === lang}
              onClick={() => { setLangOpen(false); setLang(l) }} />
          ))}
        </GlassMenu>
      </div>

      <main className="relative h-full overflow-y-auto flex flex-col"
        style={{ alignItems: left ? 'flex-start' : 'center', padding: 'calc(env(safe-area-inset-top) + 64px) 22px calc(env(safe-area-inset-bottom) + 18px)', overscrollBehavior: 'contain' }}>
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
                  className="relative flex items-center justify-center active:scale-95 transition-transform"
                  style={{
                    ...(st.socials.style === 'glass' ? glassSurface('light', onMedia || lum(bg.paper) < 0.45 ? 'dark' : 'light') : {}),
                    width: 40, height: 40, borderRadius: 20, color: st.colors.ink, ...fade(3 + menus.length),
                  }}>
                  {st.socials.style === 'glass' && <GlassSheen />}
                  <SocialIcon kind={sc.kind} />
                </a>
              ))}
            </div>
          )}
          <div data-pick="l-legal" style={fade(4 + menus.length)}>
            <Legal restaurant={restaurant} token={token} lang={lang} style={css(st.legal.text, st)} />
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

function MenuButton({ st, name, hours, first, left, onClick, move, fade }: {
  st: LandingStyle; name: string; hours: string | null; first: boolean; left: boolean; onClick: () => void
  move: React.CSSProperties; fade: React.CSSProperties
}) {
  const [pressed, setPressed] = useState(false)
  const release = () => setPressed(false)
  const B = st.buttons
  const dark = B.tint === 'dark'
  const surface: React.CSSProperties =
    B.style === 'glass' ? (dark
      ? { ...glassSurface('light', 'dark'), background: 'linear-gradient(180deg, rgba(30,24,18,0.30), rgba(30,24,18,0.18))', backdropFilter: 'blur(18px) saturate(1.6)', WebkitBackdropFilter: 'blur(18px) saturate(1.6)' }
      : { ...glassSurface(), background: 'linear-gradient(180deg, rgba(255,255,255,0.62), rgba(255,255,255,0.42))' })
    : B.style === 'solid' ? { background: B.fill, boxShadow: '0 6px 18px rgba(20,14,8,0.16), 0 1px 3px rgba(20,14,8,0.12)' }
    : B.style === 'outline' ? { boxShadow: `inset 0 0 0 1.2px ${rgba(landingColor(B.name.color, st), 0.7)}` }
    : { borderTop: first ? 'none' : `1px solid ${rgba(landingColor(B.name.color, st), 0.22)}`, borderRadius: 0 }
  // Sul colore pieno il testo si adatta (chiaro su fondo scuro, e viceversa)
  // se il ristoratore ha lasciato i colori della pagina.
  const solidText = B.style === 'solid' && (B.name.color === 'ink' || B.name.color === 'soft')
    ? (lum(B.fill) < 0.5 ? '#ffffff' : '#1d1915') : null
  const nameCss = { ...css(B.name, st), ...(solidText ? { color: solidText } : {}) }
  const hoursCss = { ...css(B.hours.text, st), ...(solidText ? { color: rgba(solidText, 0.72) } : {}) }
  return (
    <div style={move}>
      <button type="button" onClick={onClick}
        onPointerDown={() => setPressed(true)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
        className="relative w-full flex flex-col justify-center"
        style={{ ...surface, alignItems: left ? 'flex-start' : 'center', minHeight: B.height, padding: '11px 20px',
          borderRadius: B.style === 'minimal' ? 0 : B.radius, WebkitTapHighlightColor: 'transparent',
          ...fade, transform: `scale(${pressed ? 0.975 : 1})`, transition: `transform 300ms ${SPRING}, ${fade.transition ?? 'none'}` }}>
        {B.style === 'glass' && <GlassSheen />}
        <span className="relative" style={{ ...nameCss, lineHeight: 1.15, textAlign: left ? 'left' : 'center' }}>{name}</span>
        {hours && <span className="relative" style={{ ...hoursCss, marginTop: 4 }}>{hours}</span>}
      </button>
    </div>
  )
}

// ── Sfondi ───────────────────────────────────────────────────────────────────

/** Carta (o gradiente) con luce e superficie, come le pagine del menu. */
function PaperCanvas({ st }: { st: LandingStyle }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const bg = st.background
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
    }
    paint()
    window.addEventListener('resize', paint)
    return () => window.removeEventListener('resize', paint)
  }, [bg.kind, bg.paper, bg.color2, bg.texture, bg.textureStrength])
  return <canvas ref={ref} aria-hidden className="absolute inset-0 w-full h-full" />
}

/** Foto e video a tutto schermo: si alternano in dissolvenza; le foto con un
 *  lento zoom, i video muti in loop. Titolo e sottotitolo al centro. */
function Media({ st }: { st: LandingStyle }) {
  const bg = st.background
  const list = bg.media
  const [i, setI] = useState(0)
  useEffect(() => {
    if (list.length < 2) return
    const tm = window.setInterval(() => setI(v => (v + 1) % list.length), bg.interval * 1000)
    return () => clearInterval(tm)
  }, [list.length, bg.interval])
  const k0 = i % Math.max(1, list.length)
  const cur = list[k0]
  const blur = bg.blur > 0 ? { filter: `blur(${bg.blur}px)`, transform: 'scale(1.06)' } : {}
  return (
    <>
      <style>{`@keyframes lito-kb { from { transform: scale(1.0) } to { transform: scale(1.09) } }
        @keyframes lito-cap { from { opacity: 0; transform: translate3d(0, 8px, 0) } to { opacity: 1; transform: none } }`}</style>
      {list.map((b, k) => (
        <div key={b.id} aria-hidden className="absolute inset-0 overflow-hidden" style={{ opacity: k === k0 ? 1 : 0, transition: 'opacity 1400ms ease' }}>
          <div className="absolute inset-0" style={blur}>
            {b.video
              // Il poster resta visibile se il video non parte (es. formato non supportato).
              ? <video src={b.url} poster={b.poster ?? undefined} muted playsInline autoPlay loop preload="auto" className="w-full h-full" style={{ objectFit: 'cover' }} />
              // eslint-disable-next-line @next/next/no-img-element
              : <img key={k === k0 ? `on-${i}` : 'off'} src={b.url} alt="" className="w-full h-full"
                  style={{ objectFit: 'cover', animation: k === k0 && bg.kenBurns ? `lito-kb ${bg.interval + 2}s ease-out forwards` : 'none' }} />}
          </div>
        </div>
      ))}
      {/* Velo per la leggibilità: più scuro in alto (nome) e in basso (pulsanti). */}
      <div aria-hidden className="absolute inset-0" style={{
        background: `linear-gradient(180deg, rgba(0,0,0,${0.84 * bg.overlay}) 0%, rgba(0,0,0,${0.1 * bg.overlay}) 32%, rgba(0,0,0,${0.2 * bg.overlay}) 52%, rgba(0,0,0,${Math.min(0.92, 1.36 * bg.overlay)}) 100%)`,
      }} />
      {st.captions.show && (cur?.title || cur?.subtitle) && (
        <div key={cur.id} data-pick="l-captions" className="absolute left-0 right-0 text-center"
          style={{ top: '38%', padding: '0 28px', animation: 'lito-cap 900ms ease both' }}>
          {cur.title && <p style={{ ...css(st.captions.title, st), lineHeight: 1.15, textShadow: '0 2px 16px rgba(0,0,0,0.45)' }}>{cur.title}</p>}
          {cur.subtitle && <p style={{ ...css(st.captions.subtitle, st), marginTop: 8, textShadow: '0 1px 10px rgba(0,0,0,0.5)' }}>{cur.subtitle}</p>}
        </div>
      )}
      {list.length > 1 && (
        <div aria-hidden className="absolute left-0 right-0 flex justify-center pointer-events-none" style={{ top: 'calc(38% + 86px)', gap: 6 }}>
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

function Legal({ restaurant, token, lang, style }: { restaurant: LandingProps['restaurant']; token: string; lang: Lang; style: React.CSSProperties }) {
  const line1 = [restaurant.legalName || restaurant.name, restaurant.vat ? `${t('vat', lang)} ${restaurant.vat}` : null].filter(Boolean).join(' · ')
  return (
    <div style={{ ...style, lineHeight: 1.6 }}>
      <p>{line1}</p>
      {restaurant.address && <p>{restaurant.address}</p>}
      <a href={`/prova/${token}/privacy`} className="underline underline-offset-2" style={{ color: style.color }}>{t('privacy', lang)}</a>
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
