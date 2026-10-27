'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Comandi sopra il menu, in vetro, in un'unica barra in basso (come la barra
// di Safari su iOS 26, sotto il pollice; la testatina in alto resta libera):
//   • a sinistra "Menu" → torna alla pagina d'apertura, dove si sceglie il menu;
//   • al centro le categorie: quella della pagina aperta è evidenziata
//     (l'indicatore scivola), un tocco porta alla sua pagina;
//   • a destra la bandierina → scelta della lingua.
// La barra è nascosta sotto il bordo dello schermo: si apre scorrendo verso
// l'alto (segue il dito, il gesto lo gestisce CurlMenu tramite `barRef`), si
// chiude scorrendo verso il basso, girando pagina o toccando il foglio.
// ─────────────────────────────────────────────────────────────────────────────

import { forwardRef, useLayoutEffect, useRef, useState } from 'react'
import { FlagIcon } from '@/components/ui/FlagIcon'
import { ALL_LANGS, LANG_LABELS, type Lang } from '@/lib/translations'
import { GlassButton, GlassMenu, GlassMenuItem, GlassSheen, GlassTint, glassInk, glassSurface, SPRING, type GlassTintKind } from './Glass'
import { t } from './i18n'
import { SANS } from './typeset'
import { mix } from '@/lib/menuStyle'

// Categoria aperta: l'accento del menu (scurito sul vetro chiaro, schiarito su
// quello scuro, per restare leggibile).
const selectedOf = (accent: string, tint: GlassTintKind) => mix(accent, tint === 'dark' ? '#ffffff' : '#000000', tint === 'dark' ? 0.35 : 0.3)
export const BAR_H = 42
/** Spostamento della barra nascosta (px oltre all'area sicura in basso). */
export const BAR_HIDE = BAR_H + 22
const BOTTOM = 'calc(env(safe-area-inset-bottom) + 8px)'
const MENU_BOTTOM = `calc(env(safe-area-inset-bottom) + ${8 + BAR_H + 10}px)`

interface Props {
  shown:      boolean
  barRef:     React.RefObject<HTMLDivElement>
  lang:       Lang
  onLang:     (l: Lang) => void
  onMenus:    () => void
  categories: { index: number; name: string; page: number }[]
  active:     number
  onJump:     (page: number) => void
  tint:       GlassTintKind
  accent:     string
}

export default function Chrome({ shown, barRef, lang, onLang, onMenus, categories, active, onJump, tint, accent }: Props) {
  const INK = glassInk(tint)
  const [open, setOpen] = useState<null | 'lang'>(null)
  const hide = !shown && !open
  // Il pannello delle lingue si apre sopra il suo tasto.
  const langRef = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState(12)
  const toggleLang = () => {
    const l = langRef.current?.getBoundingClientRect()
    setEdge(l ? window.innerWidth - l.right : 12)
    setOpen(o => (o === 'lang' ? null : 'lang'))
  }

  return (
    <GlassTint.Provider value={tint}>
      <div ref={barRef} className="fixed left-0 right-0 flex items-center justify-center"
        style={{
          bottom: BOTTOM, zIndex: 40, gap: 8,
          padding: '0 max(12px, env(safe-area-inset-right)) 0 max(12px, env(safe-area-inset-left))',
          // Solo spostamento, niente opacità: su un contenitore spegnerebbe la
          // sfocatura del vetro dei tasti (che comparirebbe di scatto).
          transform: hide ? `translate3d(0, calc(${BAR_HIDE}px + env(safe-area-inset-bottom)), 0)` : 'translate3d(0, 0, 0)',
          pointerEvents: 'none',
          transition: 'transform 420ms cubic-bezier(0.2, 0.9, 0.25, 1)',
          willChange: 'transform',
        }}>
        <Slot hide={hide}>
          <GlassButton pill size={BAR_H} label={t('chooseMenu', lang)} onClick={onMenus}>
            <svg width="8" height="13" viewBox="0 0 8 13" aria-hidden style={{ marginRight: -1 }}><path d="M6.5 1.5L1.8 6.5l4.7 5" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 600, letterSpacing: '0.01em' }}>{t('menu', lang)}</span>
          </GlassButton>
        </Slot>
        {categories.length > 1 && <CategoryBar categories={categories} active={active} onJump={onJump} hide={hide} tint={tint} accent={accent} />}
        <Slot hide={hide} ref={langRef}>
          <GlassButton size={BAR_H} label={`${t('language', lang)}: ${LANG_LABELS[lang]}`} expanded={open === 'lang'} onClick={toggleLang}>
            <Flag lang={lang} />
          </GlassButton>
        </Slot>
      </div>

      <GlassMenu open={open === 'lang'} onClose={() => setOpen(null)} align="right" edge={edge} bottom={MENU_BOTTOM} title={t('language', lang)}>
        {ALL_LANGS.map(l => (
          <GlassMenuItem key={l} icon={<Flag lang={l} />} label={LANG_LABELS[l]} checked={l === lang}
            onClick={() => { setOpen(null); onLang(l) }} />
        ))}
      </GlassMenu>
    </GlassTint.Provider>
  )
}

const Slot = forwardRef<HTMLDivElement, { hide: boolean; children: React.ReactNode }>(function Slot({ hide, children }, ref) {
  return <div ref={ref} className="shrink-0" style={{ pointerEvents: hide ? 'none' : 'auto' }}>{children}</div>
})

// ── Barra delle categorie ────────────────────────────────────────────────────

function CategoryBar({ categories, active, onJump, hide, tint, accent }: {
  categories: Props['categories']
  active:     number
  onJump:     (page: number) => void
  hide:       boolean
  tint:       GlassTintKind
  accent:     string
}) {
  const dark = tint === 'dark'
  const SELECTED = selectedOf(accent, tint)
  const ar = parseInt(accent.slice(1, 3), 16), ag = parseInt(accent.slice(3, 5), 16), ab = parseInt(accent.slice(5, 7), 16)
  const scrollRef = useRef<HTMLDivElement>(null)
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null)
  const first = useRef(true)

  // L'indicatore scivola sotto la categoria attiva, che viene portata al centro.
  useLayoutEffect(() => {
    const chip = chipRefs.current[active], sc = scrollRef.current
    if (!chip || !sc) return
    setInd({ left: chip.offsetLeft, width: chip.offsetWidth })
    const left = chip.offsetLeft - (sc.clientWidth - chip.offsetWidth) / 2
    sc.scrollTo({ left: Math.max(0, left), behavior: first.current ? 'auto' : 'smooth' })
    first.current = false
  }, [active, categories])

  return (
    <nav aria-label="Categorie" className="relative overflow-hidden min-w-0"
      style={{ ...glassSurface('light', tint), pointerEvents: hide ? 'none' : 'auto', borderRadius: BAR_H / 2, height: BAR_H, flex: '0 1 auto', maxWidth: 560 }}>
      <GlassSheen />
      <div ref={scrollRef} className="relative h-full overflow-x-auto"
        style={{ scrollbarWidth: 'none', touchAction: 'pan-x', overscrollBehaviorX: 'contain',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%)',
          maskImage: 'linear-gradient(90deg, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%)' }}>
        <div className="relative flex items-center h-full" style={{ padding: '0 5px', width: 'max-content' }}>
          {ind && (
            <span aria-hidden className="absolute"
              // Selettore come la barra di iOS 26: capsula appena tinta (oro
              // del menu) con filo di luce, non una pillola bianca piena.
              style={{ top: 5, bottom: 5, left: ind.left, width: ind.width, borderRadius: 16,
                background: `rgba(${ar},${ag},${ab},${dark ? 0.26 : 0.14})`,
                boxShadow: dark
                  ? 'inset 0 1px 0 rgba(255,255,255,0.16), inset 0 0 0 0.5px rgba(255,255,255,0.10)'
                  : `inset 0 1px 0 rgba(255,255,255,0.55), inset 0 0 0 0.5px rgba(${ar},${ag},${ab},0.16)`,
                transition: `left 420ms ${SPRING}, width 420ms ${SPRING}` }} />
          )}
          {categories.map((c, i) => (
            <button key={c.index} ref={el => { chipRefs.current[i] = el }} type="button"
              aria-current={i === active ? 'true' : undefined}
              onClick={() => onJump(c.page)}
              className="relative shrink-0 whitespace-nowrap overflow-hidden text-ellipsis"
              // Stesso spessore per tutte (l'indicatore non cambia misura
              // cambiando selezione); nomi lunghi con i puntini.
              style={{ height: 32, maxWidth: 176, padding: '0 13px', borderRadius: 16, fontFamily: SANS, fontSize: 13, fontWeight: 600,
                letterSpacing: '0.01em', color: i === active ? SELECTED : dark ? 'rgba(255,255,255,0.72)' : 'rgba(29,25,21,0.66)', transition: 'color 250ms ease',
                WebkitTapHighlightColor: 'transparent' }}>
              {c.name}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}

// Contenitore flex: la bandierina (inline-block) non scivola sulla linea di
// base del testo e il suo bordo sottile non viene ritagliato.
export function Flag({ lang }: { lang: Lang }) {
  return (
    <span className="flex items-center justify-center" style={{ width: 24, height: 18 }}>
      <FlagIcon lang={lang} className="!block w-[22px] h-[15px]" />
    </span>
  )
}
