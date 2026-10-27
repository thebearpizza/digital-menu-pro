'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Pagina d'apertura (dopo il QR): qui si sceglie il menu, anche se è uno solo.
//
//  • Sfondo: i banner del ristorante (foto con lento zoom, video in loop) che
//    si alternano in dissolvenza con titolo e sottotitolo; senza banner, la
//    carta del menu.
//  • In alto il logo (o il nome) e la descrizione; la bandierina per la lingua.
//  • In basso la scelta del menu: pulsanti in vetro con nome e orario.
//    Toccandone uno la pagina sfuma nella carta e si apre il menu.
//  • In fondo social, ragione sociale, P.IVA, indirizzo e informativa privacy.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ALL_LANGS, LANG_LABELS, isLang, menuName, type Lang } from '@/lib/translations'
import { GlassButton, GlassMenu, GlassMenuItem, GlassSheen, glassSurface, SPRING } from './Glass'
import { Flag } from './Chrome'
import { t, type MenuChoice } from './i18n'
import { loadFontCss } from './fonts'
import { PAPER, SERIF, SANS } from './typeset'

const LANG_KEY = 'dmp-menu-lang'
const INK = '#1d1915'
const ACCENT = '#9a8462'

export interface Banner { id: string; url: string; video: boolean; poster: string | null; title: string | null; subtitle: string | null }
export type SocialKind = 'instagram' | 'facebook' | 'website' | 'tripadvisor' | 'maps'

export interface LandingProps {
  token: string
  restaurant: {
    name:        string
    description: string | null
    logo:        string | null
    socials:     { kind: SocialKind; url: string }[]
    legalName:   string | null
    vat:         string | null
    address:     string | null
  }
  menus:   MenuChoice[]
  banners: Banner[]
}

export default function Landing({ token, restaurant, menus, banners }: LandingProps) {
  const router = useRouter()
  const onMedia = banners.length > 0
  const ink = onMedia ? '#fff' : INK
  const soft = onMedia ? 'rgba(255,255,255,0.78)' : 'rgba(29,25,21,0.62)'

  const [lang, setLangState] = useState<Lang>('it')
  const [langOpen, setLangOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    try { const saved = localStorage.getItem(LANG_KEY); if (isLang(saved)) setLangState(saved) } catch { /* memoria non disponibile */ }
    // Testo invisibile finché i caratteri veri non ci sono (niente cambio di font a vista).
    let done = false
    const show = () => { if (!done) { done = true; setReady(true) } }
    loadFontCss().then(() => document.fonts.ready).then(show)
    const tm = window.setTimeout(show, 2500)
    for (const m of menus) router.prefetch(`/prova/${token}?menu=${m.id}`)
    return () => clearTimeout(tm)
  }, [menus, router, token])

  // Sotto le barre di Safari: lo stesso fondo della pagina.
  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.backgroundColor
    html.style.backgroundColor = onMedia ? '#14110e' : PAPER
    return () => { html.style.backgroundColor = prev }
  }, [onMedia])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(LANG_KEY, l) } catch { /* memoria non disponibile */ }
  }, [])

  const open = (id: string) => {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(() => router.push(`/prova/${token}?menu=${id}`), 280)
  }

  // Entrata a scalare. Per gli elementi in vetro il contenitore si sposta e
  // basta: la dissolvenza va sull'elemento stesso (un antenato semitrasparente
  // spegnerebbe la sfocatura, che poi comparirebbe di scatto).
  const move = (i: number): React.CSSProperties => ({
    transform: ready ? 'none' : 'translate3d(0, 12px, 0)',
    transition: `transform 900ms ${SPRING} ${120 + i * 90}ms`,
  })
  const fade = (i: number): React.CSSProperties => ({
    opacity: ready ? 1 : 0,
    transition: `opacity 700ms ease ${120 + i * 90}ms`,
  })
  const appear = (i: number): React.CSSProperties => ({ ...move(i), ...fade(i), transition: `${move(i).transition}, ${fade(i).transition}` })

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: onMedia ? '#14110e' : PAPER }}>
      {onMedia ? <Media banners={banners} /> : <PaperBackground />}

      {/* Lingua */}
      <div className="fixed" style={{ top: 'calc(env(safe-area-inset-top) + 12px)', right: 'max(14px, env(safe-area-inset-right))', zIndex: 20 }}>
        <GlassButton hidden={!ready} label={`${t('language', lang)}: ${LANG_LABELS[lang]}`} expanded={langOpen} onClick={() => setLangOpen(o => !o)}>
          <Flag lang={lang} />
        </GlassButton>
      </div>
      <GlassMenu open={langOpen} onClose={() => setLangOpen(false)} align="right" edge={14}
        title={t('language', lang)} top="calc(env(safe-area-inset-top) + 60px)">
        {ALL_LANGS.map(l => (
          <GlassMenuItem key={l} icon={<Flag lang={l} />} label={LANG_LABELS[l]} checked={l === lang}
            onClick={() => { setLangOpen(false); setLang(l) }} />
        ))}
      </GlassMenu>

      <main className="relative h-full overflow-y-auto flex flex-col items-center text-center"
        style={{ padding: 'calc(env(safe-area-inset-top) + 64px) 22px calc(env(safe-area-inset-bottom) + 18px)', overscrollBehavior: 'contain' }}>
        {/* Logo o nome, descrizione */}
        <header style={appear(1)}>
          {restaurant.logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={restaurant.logo} alt={restaurant.name} className="mx-auto" style={{ maxHeight: 84, maxWidth: 220, objectFit: 'contain', filter: onMedia ? 'drop-shadow(0 2px 10px rgba(0,0,0,0.35))' : 'none' }} />
            : <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 46, lineHeight: 1.05, color: ink, letterSpacing: '0.01em', textShadow: onMedia ? '0 2px 18px rgba(0,0,0,0.35)' : 'none' }}>{restaurant.name}</h1>}
          {restaurant.description && (
            <p style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.3em', textTransform: 'uppercase', color: onMedia ? soft : ACCENT, marginTop: 12 }}>
              {restaurant.description}
            </p>
          )}
          <Ornament color={onMedia ? 'rgba(255,255,255,0.6)' : '#c9bba2'} dot={onMedia ? '#fff' : ACCENT} />
        </header>

        <div className="flex-1" style={{ minHeight: 28 }} />

        {/* Scelta del menu */}
        <section className="w-full" style={{ maxWidth: 380 }}>
          <p style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: soft, marginBottom: 14, ...appear(2) }}>
            {t('chooseMenu', lang)}
          </p>
          <div className="flex flex-col" style={{ gap: 10 }}>
            {menus.map((m, i) => (
              <MenuButton key={m.id} name={menuName(m.name, m.translations, lang)} hours={m.hours ?? null}
                dark={onMedia} onClick={() => open(m.id)} move={move(3 + i)} fade={fade(3 + i)} />
            ))}
          </div>
        </section>

        {/* Social e dati legali */}
        <footer className="w-full" style={{ marginTop: 26, ...move(3 + menus.length) }}>
          {restaurant.socials.length > 0 && (
            <div className="flex justify-center" style={{ gap: 10, marginBottom: 18 }}>
              {restaurant.socials.map(sc => (
                <a key={sc.kind} href={sc.url} target="_blank" rel="noopener noreferrer" aria-label={sc.kind}
                  className="relative flex items-center justify-center active:scale-95 transition-transform"
                  style={{ ...glassSurface(), width: 40, height: 40, borderRadius: 20, color: onMedia ? '#fff' : INK, ...fade(3 + menus.length) }}>
                  <GlassSheen />
                  <SocialIcon kind={sc.kind} />
                </a>
              ))}
            </div>
          )}
          <div style={fade(4 + menus.length)}>
            <Legal restaurant={restaurant} token={token} lang={lang} color={soft} />
          </div>
        </footer>
      </main>

      {/* Uscita: la pagina sfuma nella carta del menu. */}
      <div aria-hidden className="fixed inset-0 pointer-events-none" style={{ zIndex: 60, background: PAPER, opacity: leaving ? 1 : 0, transition: 'opacity 280ms ease' }} />
    </div>
  )
}

// ── Pulsante di un menu ──────────────────────────────────────────────────────

function MenuButton({ name, hours, dark, onClick, move, fade }: {
  name: string; hours: string | null; dark: boolean; onClick: () => void
  move: React.CSSProperties; fade: React.CSSProperties
}) {
  const [pressed, setPressed] = useState(false)
  const release = () => setPressed(false)
  // Sopra foto e video: vetro scuro e testo bianco; sulla carta: vetro chiaro.
  const surface: React.CSSProperties = dark
    ? { ...glassSurface(), background: 'linear-gradient(180deg, rgba(30,24,18,0.30), rgba(30,24,18,0.18))', backdropFilter: 'blur(18px) saturate(1.6)', WebkitBackdropFilter: 'blur(18px) saturate(1.6)' }
    : { ...glassSurface(), background: 'linear-gradient(180deg, rgba(255,255,255,0.62), rgba(255,255,255,0.42))' }
  return (
    <div style={move}>
      <button type="button" onClick={onClick}
        onPointerDown={() => setPressed(true)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
        className="relative w-full flex flex-col items-center justify-center"
        style={{ ...surface, minHeight: 62, padding: '11px 20px', borderRadius: 22, WebkitTapHighlightColor: 'transparent',
          ...fade, transform: `scale(${pressed ? 0.975 : 1})`, transition: `transform 300ms ${SPRING}, ${fade.transition}` }}>
        <GlassSheen />
        <span className="relative" style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 23, lineHeight: 1.15, color: dark ? '#fff' : INK }}>{name}</span>
        {hours && (
          <span className="relative" style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.16em', color: dark ? 'rgba(255,255,255,0.72)' : ACCENT, marginTop: 4 }}>{hours}</span>
        )}
      </button>
    </div>
  )
}

// ── Sfondi ───────────────────────────────────────────────────────────────────

function PaperBackground() {
  return (
    <div aria-hidden className="absolute inset-0"
      style={{ background: `radial-gradient(120% 80% at 50% 38%, rgba(255,255,255,0.6), rgba(232,224,208,0.35)), ${PAPER}` }} />
  )
}

/** Banner a tutto schermo: si alternano in dissolvenza; le foto con un lento
 *  zoom, i video muti in loop. Titolo e sottotitolo del banner al centro. */
function Media({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (banners.length < 2) return
    const tm = window.setInterval(() => setI(v => (v + 1) % banners.length), 7000)
    return () => clearInterval(tm)
  }, [banners.length])
  const cur = banners[i]
  return (
    <>
      <style>{`@keyframes lito-kb { from { transform: scale(1.0) } to { transform: scale(1.09) } }`}</style>
      {banners.map((b, k) => (
        <div key={b.id} aria-hidden className="absolute inset-0" style={{ opacity: k === i ? 1 : 0, transition: 'opacity 1400ms ease' }}>
          {b.video
            // Il poster resta visibile se il video non parte (es. formato non supportato).
            ? <video src={b.url} poster={b.poster ?? undefined} muted playsInline autoPlay loop preload="auto" className="w-full h-full" style={{ objectFit: 'cover' }} />
            // eslint-disable-next-line @next/next/no-img-element
            : <img key={k === i ? `on-${i}` : 'off'} src={b.url} alt="" className="w-full h-full"
                style={{ objectFit: 'cover', animation: k === i ? 'lito-kb 9s ease-out forwards' : 'none' }} />}
        </div>
      ))}
      {/* Leggibilità: scuro in alto (nome) e soprattutto in basso (pulsanti). */}
      <div aria-hidden className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.05) 32%, rgba(0,0,0,0.10) 52%, rgba(0,0,0,0.68) 100%)' }} />
      {(cur?.title || cur?.subtitle) && (
        <div key={cur.id} className="absolute left-0 right-0 text-center pointer-events-none"
          style={{ top: '38%', padding: '0 28px', animation: 'lito-cap 900ms ease both' }}>
          <style>{`@keyframes lito-cap { from { opacity: 0; transform: translate3d(0, 8px, 0) } to { opacity: 1; transform: none } }`}</style>
          {cur.title && <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 28, lineHeight: 1.15, color: '#fff', textShadow: '0 2px 16px rgba(0,0,0,0.45)' }}>{cur.title}</p>}
          {cur.subtitle && <p style={{ fontFamily: SANS, fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.85)', marginTop: 8, textShadow: '0 1px 10px rgba(0,0,0,0.5)' }}>{cur.subtitle}</p>}
        </div>
      )}
      {banners.length > 1 && (
        <div aria-hidden className="absolute left-0 right-0 flex justify-center" style={{ top: 'calc(38% + 86px)', gap: 6 }}>
          {banners.map((b, k) => (
            <span key={b.id} style={{ width: k === i ? 16 : 6, height: 6, borderRadius: 3, background: k === i ? '#fff' : 'rgba(255,255,255,0.5)', transition: `width 500ms ${SPRING}, background 300ms ease` }} />
          ))}
        </div>
      )}
    </>
  )
}

// ── Dettagli ─────────────────────────────────────────────────────────────────

function Ornament({ color, dot }: { color: string; dot: string }) {
  return (
    <svg width="96" height="10" viewBox="0 0 96 10" aria-hidden className="mx-auto" style={{ marginTop: 16, display: 'block' }}>
      <path d="M2 5h36M58 5h36" stroke={color} strokeWidth="0.9" />
      <path d="M48 1.6L51.4 5 48 8.4 44.6 5z" fill={dot} />
    </svg>
  )
}

function Legal({ restaurant, token, lang, color }: { restaurant: LandingProps['restaurant']; token: string; lang: Lang; color: string }) {
  const line1 = [restaurant.legalName || restaurant.name, restaurant.vat ? `${t('vat', lang)} ${restaurant.vat}` : null].filter(Boolean).join(' · ')
  return (
    <div style={{ fontFamily: SANS, fontSize: 10.5, lineHeight: 1.6, color }}>
      <p>{line1}</p>
      {restaurant.address && <p>{restaurant.address}</p>}
      <a href={`/prova/${token}/privacy`} className="underline underline-offset-2" style={{ color }}>{t('privacy', lang)}</a>
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
