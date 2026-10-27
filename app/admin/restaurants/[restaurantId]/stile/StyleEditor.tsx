'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Personalizzazione del nuovo menu.
//
// A destra (in alto sul telefono) il menu vero, in una cornice da telefono:
// riceve lo stile a ogni modifica e si reimpagina. Toccando un elemento
// nell'anteprima (un nome di piatto, un prezzo, una categoria, la carta) si
// evidenziano qui i comandi che lo riguardano. A sinistra i comandi: colori,
// caratteri, layout. Ogni comando ha un effetto reale sul menu.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  DEFAULT_STYLE, DETAIL_FONTS, DISPLAY_FONTS, TEXT_FONTS, fontStack,
  type CategoryStyle, type MenuStyle, type PriceStyle,
} from '@/lib/menuStyle'
import type { PickTarget } from '@/app/prova/[token]/typeset'
import { saveMenuStyle } from './actions'

type Field =
  | 'paper' | 'ink' | 'accent' | 'display' | 'text' | 'details'
  | 'align' | 'textScale' | 'dishSpacing' | 'price' | 'category' | 'italic' | 'allergens' | 'pageNumbers'

// Che cosa si evidenzia toccando un elemento nell'anteprima.
const PICK_FIELDS: Record<PickTarget, Field[]> = {
  paper:       ['paper'],
  title:       ['display', 'accent'],
  category:    ['category', 'details', 'accent'],
  name:        ['display', 'ink', 'align'],
  price:       ['price', 'display'],
  description: ['text', 'italic'],
  allergens:   ['allergens', 'details', 'accent'],
  text:        ['text', 'ink'],
}

// Tavolozze pronte (carta, testo, accento): un punto di partenza.
const PALETTES: { name: string; paper: string; ink: string; accent: string }[] = [
  { name: 'Carta',     paper: '#fbf8f2', ink: '#1d1915', accent: '#9a8462' },
  { name: 'Avorio',    paper: '#f7f1e6', ink: '#2b1d1a', accent: '#7d2a2a' },
  { name: 'Salvia',    paper: '#f2f1ea', ink: '#1f2a24', accent: '#5f7a5c' },
  { name: 'Bianco',    paper: '#ffffff', ink: '#141414', accent: '#8a7a5c' },
  { name: 'Notte',     paper: '#1b1916', ink: '#eee6d8', accent: '#c4a46b' },
]

const FONT_SAMPLE_URL = '/api/gfonts/css2?' +
  Array.from(new Set([...DISPLAY_FONTS, ...DETAIL_FONTS].map(f => f.name)))
    .map(n => `family=${encodeURIComponent(n).replace(/%20/g, '+')}:wght@500`).join('&') + '&display=swap'

interface Props {
  restaurantId: string
  token:        string
  initialStyle: MenuStyle
  menus:        { id: string; name: string }[]
}

export default function StyleEditor({ restaurantId, token, initialStyle, menus }: Props) {
  const [style, setStyle] = useState<MenuStyle>(initialStyle)
  const [saved, setSaved] = useState<MenuStyle>(initialStyle)
  const [menuId, setMenuId] = useState(menus[0]?.id ?? '')
  const [focus, setFocus] = useState<Field[]>([])
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, startSaving] = useTransition()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const fieldRefs = useRef(new Map<Field, HTMLElement>())
  const dirty = useMemo(() => JSON.stringify(style) !== JSON.stringify(saved), [style, saved])

  // Campioni dei caratteri nei pulsanti di scelta.
  useEffect(() => {
    if (document.querySelector('link[data-lito-font-samples]')) return
    const l = document.createElement('link')
    l.rel = 'stylesheet'; l.href = FONT_SAMPLE_URL; l.dataset.litoFontSamples = '1'
    document.head.appendChild(l)
  }, [])

  // Anteprima: riceve lo stile a ogni modifica; ci dice cosa è stato toccato.
  const send = useCallback((st: MenuStyle) => {
    frameRef.current?.contentWindow?.postMessage({ type: 'lito-style', style: st }, window.location.origin)
  }, [])
  useEffect(() => { send(style) }, [style, send])
  const styleRef = useRef(style)
  styleRef.current = style
  useEffect(() => {
    let clear = 0
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const msg = e.data as { type?: string; target?: PickTarget }
      if (msg?.type === 'lito-preview-ready') send(styleRef.current)
      if (msg?.type === 'lito-pick' && msg.target) {
        const fields = PICK_FIELDS[msg.target] ?? []
        setFocus(fields)
        fieldRefs.current.get(fields[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        clearTimeout(clear); clear = window.setTimeout(() => setFocus([]), 2400)
      }
    }
    window.addEventListener('message', onMsg)
    return () => { window.removeEventListener('message', onMsg); clearTimeout(clear) }
  }, [send])

  // Modifiche non salvate: avviso uscendo dalla pagina.
  useEffect(() => {
    if (!dirty) return
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  const set = <K extends keyof MenuStyle>(group: K, patch: Partial<MenuStyle[K]>) =>
    setStyle(st => ({ ...st, [group]: { ...st[group], ...patch } }))

  const save = () => startSaving(async () => {
    const res = await saveMenuStyle(restaurantId, style)
    if (res.ok) { setSaved(style); setMessage({ ok: true, text: 'Stile salvato.' }) }
    else setMessage({ ok: false, text: res.error })
    window.setTimeout(() => setMessage(null), 3000)
  })

  const reg = (f: Field) => (el: HTMLElement | null) => { if (el) fieldRefs.current.set(f, el); else fieldRefs.current.delete(f) }
  const fieldProps = (f: Field) => ({ fieldRef: reg(f), highlighted: focus.includes(f) })

  return (
    <div className="pb-24">
      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
        {/* Anteprima */}
        <div className="lg:order-2 lg:sticky lg:top-4 shrink-0 flex flex-col items-center gap-3">
          <PhoneFrame>
            {menuId && (
              <iframe ref={frameRef} title="Anteprima del menu" src={`/prova/${token}?menu=${menuId}&preview=1`}
                className="block border-0" style={{ width: 390, height: 844 }} />
            )}
          </PhoneFrame>
          {menus.length > 1 && (
            <label className="text-xs text-gray-500 flex items-center gap-2">
              Menu in anteprima
              <select value={menuId} onChange={e => setMenuId(e.target.value)} className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white">
                {menus.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          )}
          <p className="text-xs text-gray-400 text-center max-w-[300px]">Tocca un elemento nell&apos;anteprima per trovare i comandi che lo modificano.</p>
        </div>

        {/* Comandi */}
        <div className="flex-1 min-w-0 space-y-5 px-4 sm:px-0">
          <Section title="Colori">
            <div className="flex flex-wrap gap-2 mb-4">
              {PALETTES.map(p => {
                const on = p.paper === style.colors.paper && p.ink === style.colors.ink && p.accent === style.colors.accent
                return (
                  <button key={p.name} type="button" onClick={() => set('colors', { paper: p.paper, ink: p.ink, accent: p.accent })}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${on ? 'border-blue-600 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-400'}`}>
                    <span className="flex -space-x-1">
                      {[p.paper, p.ink, p.accent].map((c, i) => <span key={i} className="w-4 h-4 rounded-full border border-black/10" style={{ background: c }} />)}
                    </span>
                    {p.name}
                  </button>
                )
              })}
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <ColorField label="Carta" value={style.colors.paper} onChange={v => set('colors', { paper: v })} {...fieldProps('paper')} />
              <ColorField label="Testo" value={style.colors.ink} onChange={v => set('colors', { ink: v })} {...fieldProps('ink')} />
              <ColorField label="Accento" hint="Categorie, ornamenti, allergeni" value={style.colors.accent} onChange={v => set('colors', { accent: v })} {...fieldProps('accent')} />
            </div>
          </Section>

          <Section title="Caratteri">
            <FontField label="Titoli" hint="Nomi dei piatti, titolo del menu, prezzi" fonts={DISPLAY_FONTS} value={style.fonts.display} onChange={v => set('fonts', { display: v })} {...fieldProps('display')} />
            <FontField label="Testi" hint="Descrizioni, pagine di testo" fonts={TEXT_FONTS} value={style.fonts.text} onChange={v => set('fonts', { text: v })} {...fieldProps('text')} />
            <FontField label="Dettagli" hint="Categorie, allergeni, numeri di pagina" fonts={DETAIL_FONTS} value={style.fonts.details} onChange={v => set('fonts', { details: v })} {...fieldProps('details')} upper />
          </Section>

          <Section title="Layout">
            <Choice label="Allineamento" value={style.layout.align} onChange={v => set('layout', { align: v })} {...fieldProps('align')}
              options={[{ value: 'left', label: 'A sinistra' }, { value: 'center', label: 'Centrato' }]}
              hint={style.layout.align === 'center' ? 'Centrato: il prezzo va sotto il nome.' : undefined} />
            <Choice<PriceStyle> label="Prezzo" value={style.layout.align === 'center' ? 'below' : style.layout.price} disabled={style.layout.align === 'center'}
              onChange={v => set('layout', { price: v })} {...fieldProps('price')}
              options={[{ value: 'dots', label: 'A destra con puntini' }, { value: 'plain', label: 'A destra' }, { value: 'below', label: 'Sotto il nome' }]} />
            <Choice<CategoryStyle> label="Titolo di categoria" value={style.layout.category} onChange={v => set('layout', { category: v })} {...fieldProps('category')}
              options={[{ value: 'rules', label: 'Con filetti' }, { value: 'ornament', label: 'Con rombo' }, { value: 'plain', label: 'Semplice' }]} />
            <Slider label="Grandezza del testo" value={style.layout.textScale} min={0.85} max={1.25} step={0.05}
              format={v => `${Math.round(v * 100)}%`} onChange={v => set('layout', { textScale: v })} {...fieldProps('textScale')} />
            <Slider label="Spazio tra i piatti" value={style.layout.dishSpacing} min={8} max={44} step={2}
              format={v => (v <= 14 ? 'Compatto' : v <= 26 ? 'Normale' : 'Arioso')} onChange={v => set('layout', { dishSpacing: v })} {...fieldProps('dishSpacing')} />
            <Toggle label="Descrizioni in corsivo" value={style.layout.italicDescriptions} onChange={v => set('layout', { italicDescriptions: v })} {...fieldProps('italic')} />
            <Toggle label="Numeri degli allergeni sotto i piatti" hint="Nella scheda del piatto ci sono sempre." value={style.layout.showAllergens} onChange={v => set('layout', { showAllergens: v })} {...fieldProps('allergens')} />
            <Toggle label="Numeri di pagina" value={style.layout.pageNumbers} onChange={v => set('layout', { pageNumbers: v })} {...fieldProps('pageNumbers')} />
          </Section>
        </div>
      </div>

      {/* Salvataggio */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-gray-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 sm:px-6 py-3">
          <span className={`text-sm ${message ? (message.ok ? 'text-green-700' : 'text-red-600') : 'text-gray-500'}`}>
            {message?.text ?? (dirty ? 'Modifiche non salvate' : 'Tutto salvato')}
          </span>
          <div className="flex-1" />
          <button type="button" onClick={() => setStyle(DEFAULT_STYLE)} className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2">
            Stile base
          </button>
          <button type="button" onClick={() => setStyle(saved)} disabled={!dirty} className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 disabled:opacity-40">
            Annulla
          </button>
          <button type="button" onClick={save} disabled={!dirty || saving}
            className="text-sm font-medium rounded-lg bg-blue-600 text-white px-4 py-2 disabled:opacity-40 hover:bg-blue-700">
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Cornice da telefono (si adatta allo spazio) ─────────────────────────────

function PhoneFrame({ children }: { children: React.ReactNode }) {
  const [k, setK] = useState(0.7)
  useEffect(() => {
    const fit = () => {
      const wide = window.innerWidth >= 1024
      const maxH = wide ? window.innerHeight - 140 : window.innerHeight * 0.58
      const maxW = wide ? 360 : window.innerWidth - 48
      setK(Math.max(0.4, Math.min(1, maxH / 844, maxW / 390)))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return (
    <div className="rounded-[40px] bg-gray-900 p-2.5 shadow-xl" style={{ width: 390 * k + 20, height: 844 * k + 20 }}>
      <div className="overflow-hidden rounded-[32px] bg-white" style={{ width: 390 * k, height: 844 * k }}>
        <div style={{ width: 390, height: 844, transform: `scale(${k})`, transformOrigin: '0 0' }}>{children}</div>
      </div>
    </div>
  )
}

// ── Comandi ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

interface FieldBase { label: string; hint?: string; highlighted?: boolean; fieldRef?: (el: HTMLElement | null) => void }

function FieldShell({ label, hint, highlighted, refFn, children }: { label: string; hint?: string; highlighted?: boolean; refFn?: (el: HTMLElement | null) => void; children: React.ReactNode }) {
  return (
    <div ref={refFn} className={`rounded-lg transition-shadow duration-300 ${highlighted ? 'ring-2 ring-blue-500 ring-offset-4' : ''}`}>
      <div className="text-xs font-medium text-gray-700 mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-gray-400 mt-1">{hint}</div>}
    </div>
  )
}

function ColorField({ label, hint, value, onChange, highlighted, fieldRef }: FieldBase & { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <FieldShell label={label} hint={hint} highlighted={highlighted} refFn={fieldRef}>
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0" aria-label={label} />
        <input value={text} onChange={e => { setText(e.target.value); if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toLowerCase()) }}
          className="w-full text-sm font-mono text-gray-700 outline-none" spellCheck={false} />
      </div>
    </FieldShell>
  )
}

function FontField({ label, hint, fonts, value, onChange, highlighted, fieldRef, upper }: FieldBase & { fonts: { name: string }[]; value: string; onChange: (v: string) => void; upper?: boolean }) {
  return (
    <FieldShell label={label} hint={hint} highlighted={highlighted} refFn={fieldRef}>
      <div className="flex flex-wrap gap-2">
        {fonts.map(f => (
          <button key={f.name} type="button" onClick={() => onChange(f.name)} title={f.name}
            className={`rounded-lg border px-3 py-1.5 text-[15px] transition ${f.name === value ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50/40' : 'border-gray-200 hover:border-gray-400'}`}
            style={{ fontFamily: fontStack(f.name), fontWeight: 500, letterSpacing: upper ? '0.08em' : undefined }}>
            {upper ? f.name.toUpperCase() : f.name}
          </button>
        ))}
      </div>
    </FieldShell>
  )
}

function Choice<T extends string>({ label, hint, value, options, onChange, highlighted, fieldRef, disabled }: FieldBase & { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <FieldShell label={label} hint={hint} highlighted={highlighted} refFn={fieldRef}>
      <div className={`inline-flex flex-wrap rounded-lg border border-gray-200 p-0.5 bg-gray-50 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${o.value === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </FieldShell>
  )
}

function Slider({ label, hint, value, min, max, step, format, onChange, highlighted, fieldRef }: FieldBase & { value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <FieldShell label={label} hint={hint} highlighted={highlighted} refFn={fieldRef}>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="flex-1 accent-blue-600" aria-label={label} />
        <span className="text-xs text-gray-600 w-16 text-right tabular-nums">{format(value)}</span>
      </div>
    </FieldShell>
  )
}

function Toggle({ label, hint, value, onChange, highlighted, fieldRef }: FieldBase & { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <FieldShell label="" hint={hint} highlighted={highlighted} refFn={fieldRef}>
      <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className="flex items-center gap-3 text-sm text-gray-700 text-left -mt-1.5">
        <span className={`relative shrink-0 inline-block w-10 h-6 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </span>
        {label}
      </button>
    </FieldShell>
  )
}
