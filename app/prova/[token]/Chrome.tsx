'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Comandi sopra il menu, in vetro, in un'unica barra in basso (come la barra
// di Safari su iOS 26, sotto il pollice; la testatina in alto resta libera):
//   • a sinistra "Menu" → scelta del menu (solo se ce n'è più d'uno);
//   • al centro le categorie: quella della pagina aperta è evidenziata
//     (l'indicatore scivola), un tocco porta alla sua pagina;
//   • a destra la bandierina → scelta della lingua.
// La barra è nascosta sotto il bordo dello schermo: si apre scorrendo verso
// l'alto (segue il dito, il gesto lo gestisce CurlMenu tramite `barRef`), si
// chiude scorrendo verso il basso, girando pagina o toccando il foglio.
// ─────────────────────────────────────────────────────────────────────────────

import { forwardRef, useLayoutEffect, useRef, useState } from 'react'
import { FlagIcon } from '@/components/ui/FlagIcon'
import { ALL_LANGS, LANG_LABELS, menuName, type Lang } from '@/lib/translations'
import { GlassButton, GlassMenu, GlassMenuItem, GlassSheen, glassSurface, SPRING } from './Glass'
import { t, type MenuChoice } from './i18n'
import { SANS } from './typeset'

const INK = '#1d1915'
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
  menus:      MenuChoice[]
  menuId:     string
  onMenu:     (id: string) => void
  categories: { index: number; name: string; page: number }[]
  active:     number
  onJump:     (page: number) => void
}

export default function Chrome({ shown, barRef, lang, onLang, menus, menuId, onMenu, categories, active, onJump }: Props) {
  const [open, setOpen] = useState<null | 'menu' | 'lang'>(null)
  const hide = !shown && !open
  // I pannelli si aprono sopra il loro tasto (allineati al suo bordo esterno).
  const menuRef = useRef<HTMLDivElement>(null)
  const langRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ menu: 12, lang: 12 })
  const toggle = (which: 'menu' | 'lang') => {
    const m = menuRef.current?.getBoundingClientRect(), l = langRef.current?.getBoundingClientRect()
    setEdges({ menu: m ? m.left : 12, lang: l ? window.innerWidth - l.right : 12 })
    setOpen(o => (o === which ? null : which))
  }

  return (
    <>
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
        {menus.length > 1 && (
          <Slot hide={hide} ref={menuRef}>
            <GlassButton pill size={BAR_H} label={t('chooseMenu', lang)} expanded={open === 'menu'} onClick={() => toggle('menu')}>
              <span style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 600, letterSpacing: '0.01em' }}>{t('menu', lang)}</span>
            </GlassButton>
          </Slot>
        )}
        {categories.length > 1 && <CategoryBar categories={categories} active={active} onJump={onJump} hide={hide} />}
        <Slot hide={hide} ref={langRef}>
          <GlassButton size={BAR_H} label={`${t('language', lang)}: ${LANG_LABELS[lang]}`} expanded={open === 'lang'} onClick={() => toggle('lang')}>
            <Flag lang={lang} />
          </GlassButton>
        </Slot>
      </div>

      <GlassMenu open={open === 'menu'} onClose={() => setOpen(null)} align="left" edge={edges.menu} bottom={MENU_BOTTOM} title={t('chooseMenu', lang)}>
        {menus.map(m => (
          <GlassMenuItem key={m.id} label={menuName(m.name, m.translations, lang)} checked={m.id === menuId}
            onClick={() => { setOpen(null); if (m.id !== menuId) onMenu(m.id) }} />
        ))}
      </GlassMenu>
      <GlassMenu open={open === 'lang'} onClose={() => setOpen(null)} align="right" edge={edges.lang} bottom={MENU_BOTTOM} title={t('language', lang)}>
        {ALL_LANGS.map(l => (
          <GlassMenuItem key={l} icon={<Flag lang={l} />} label={LANG_LABELS[l]} checked={l === lang}
            onClick={() => { setOpen(null); onLang(l) }} />
        ))}
      </GlassMenu>
    </>
  )
}

const Slot = forwardRef<HTMLDivElement, { hide: boolean; children: React.ReactNode }>(function Slot({ hide, children }, ref) {
  return <div ref={ref} className="shrink-0" style={{ pointerEvents: hide ? 'none' : 'auto' }}>{children}</div>
})

// ── Barra delle categorie ────────────────────────────────────────────────────

function CategoryBar({ categories, active, onJump, hide }: {
  categories: Props['categories']
  active:     number
  onJump:     (page: number) => void
  hide:       boolean
}) {
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
      style={{ ...glassSurface(), pointerEvents: hide ? 'none' : 'auto', borderRadius: BAR_H / 2, height: BAR_H, flex: '0 1 auto', maxWidth: 560 }}>
      <GlassSheen />
      <div ref={scrollRef} className="relative h-full overflow-x-auto"
        style={{ scrollbarWidth: 'none', touchAction: 'pan-x', overscrollBehaviorX: 'contain',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%)',
          maskImage: 'linear-gradient(90deg, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%)' }}>
        <div className="relative flex items-center h-full" style={{ padding: '0 5px', width: 'max-content' }}>
          {ind && (
            <span aria-hidden className="absolute"
              style={{ top: 5, bottom: 5, left: ind.left, width: ind.width, borderRadius: 16,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.72))',
                boxShadow: '0 2px 6px rgba(20,14,8,0.14), inset 0 0 0 1px rgba(255,255,255,0.9), inset 0 -3px 5px -3px rgba(40,28,14,0.10)',
                transition: `left 420ms ${SPRING}, width 420ms ${SPRING}` }} />
          )}
          {categories.map((c, i) => (
            <button key={c.index} ref={el => { chipRefs.current[i] = el }} type="button"
              aria-current={i === active ? 'true' : undefined}
              onClick={() => onJump(c.page)}
              className="relative shrink-0 whitespace-nowrap"
              style={{ height: 32, padding: '0 13px', borderRadius: 16, fontFamily: SANS, fontSize: 13, fontWeight: i === active ? 600 : 500,
                letterSpacing: '0.01em', color: i === active ? INK : 'rgba(29,25,21,0.62)', transition: 'color 200ms ease',
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
function Flag({ lang }: { lang: Lang }) {
  return (
    <span className="flex items-center justify-center" style={{ width: 24, height: 18 }}>
      <FlagIcon lang={lang} className="!block w-[22px] h-[15px]" />
    </span>
  )
}
