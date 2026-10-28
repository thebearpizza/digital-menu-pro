'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Comandi comuni della Personalizzazione del nuovo menu (stile del menu e
// pagina d'apertura): cornice dell'anteprima, cursori, scelte, colori, stile
// completo di un testo con scelta del carattere, ornamenti, caricamenti
// (immagine di sfondo, caratteri) e campioni di carta.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import {
  CUSTOM_PREFIX, FONTS, FONT_CATS, GLASS_PRESETS, ORNAMENTS, WEIGHTS, customWeights, fontInfo, fontLabel, fontStack, mix, resolveFace,
  type ColorRef, type CustomFont, type FontCat, type GlassLook, type MenuStyle, type Ornament, type TextStyle, type Weight,
} from '@/lib/menuStyle'
import { drawOrnament } from '@/app/prova/[token]/typeset'
import { paintPaper } from '@/app/prova/[token]/paper'
import { createClient } from '@/lib/supabase/client'
import { compressImageFile } from '@/lib/imageCompress'
import { readFontFileInfo } from '@/lib/fontFileInfo'

export const pct = (v: number) => `${Math.round(v * 100)}%`
export const px = (v: number) => `${Math.round(v)} px`

export const refColor = (c: ColorRef, sw: { ink: string; soft: string; accent: string }) =>
  c === 'ink' ? sw.ink : c === 'soft' ? sw.soft : c === 'accent' ? sw.accent : c

/** Testo di uno stile come CSS (per campioni e anteprime nel gestionale). */
export function cssOf(t: TextStyle, sw: { ink: string; soft: string; accent: string }): React.CSSProperties {
  const f = resolveFace(t.font, t.weight, t.italic)
  return {
    fontFamily: fontStack(t.font), fontWeight: f.weight, fontStyle: f.italic ? 'italic' : 'normal',
    textTransform: t.upper ? 'uppercase' : 'none', letterSpacing: `${t.tracking}em`, color: refColor(t.color, sw),
  }
}

/** Miniatura di uno stile pronto: titolo, categoria, un piatto con prezzo. */
// ── Cornice da telefono (si adatta allo spazio) ─────────────────────────────
// Il menu si impagina sull'altezza visibile dello schermo: l'anteprima usa
// l'area che resta al sito nel browser del telefono (barre di Safari/Chrome
// comprese), così le pagine si spezzano negli stessi punti che vede il
// cliente. Misure in punti CSS, con le barre del browser visibili.

export const PREVIEW_DEVICES = [
  { id: 'iphone',    label: 'iPhone 13–16 (Safari)',      w: 390, h: 664 },
  { id: 'iphonemax', label: 'iPhone Plus / Pro Max (Safari)', w: 430, h: 739 },
  { id: 'iphonese',  label: 'iPhone SE / 8 (Safari)',     w: 375, h: 553 },
  { id: 'android',   label: 'Android grande (Chrome)',    w: 412, h: 783 },
  { id: 'galaxy',    label: 'Samsung Galaxy S (Chrome)',  w: 360, h: 668 },
] as const
type PreviewDevice = { id: string; label: string; w: number; h: number }
const DEVICE_KEY = 'lito-preview-device'
const CUSTOM_KEY = 'lito-preview-custom'
const clampDim = (v: number, d: number) => (Number.isFinite(v) ? Math.max(280, Math.min(1400, Math.round(v))) : d)

/** Misura in punti: si applica quando è un valore sensato (mentre si scrive no). */
function DimInput({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  return (
    <input type="number" inputMode="numeric" aria-label={label} value={text} className="w-16 border border-gray-200 px-2 py-1 text-xs" style={{ borderRadius: 8 }}
      onChange={e => { setText(e.target.value); const n = Number(e.target.value); if (n >= 280 && n <= 1400) onCommit(Math.round(n)) }}
      onBlur={() => setText(String(value))} />
  )
}

/** Anteprima nella cornice: `children` riceve la misura dello schermo scelto. */
export function PhoneFrame({ children }: { children: (size: { w: number; h: number }) => React.ReactNode }) {
  const [dev, setDev] = useState<PreviewDevice>(PREVIEW_DEVICES[0])
  // "Personalizzato": le misure del proprio telefono (pagina /schermo).
  const [custom, setCustom] = useState({ w: 393, h: 659 })
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? 'null') as { w?: number; h?: number } | null
      const cu = c ? { w: clampDim(Number(c.w), 393), h: clampDim(Number(c.h), 659) } : null
      if (cu) setCustom(cu)
      const id = localStorage.getItem(DEVICE_KEY)
      const d = id === 'custom' && cu ? { id: 'custom', label: 'Personalizzato', ...cu } : PREVIEW_DEVICES.find(x => x.id === id)
      if (d) setDev(d)
    } catch { /* memoria non disponibile */ }
  }, [])
  const applyCustom = (c: { w: number; h: number }) => {
    setCustom(c)
    setDev({ id: 'custom', label: 'Personalizzato', ...c })
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(c)); localStorage.setItem(DEVICE_KEY, 'custom') } catch { /* memoria non disponibile */ }
  }
  const [k, setK] = useState(0.7)
  useEffect(() => {
    const fit = () => {
      const wide = window.innerWidth >= 1024
      const maxH = wide ? window.innerHeight - 170 : window.innerHeight * 0.58
      const maxW = wide ? 380 : window.innerWidth - 48
      setK(Math.max(0.4, Math.min(1, maxH / dev.h, maxW / dev.w)))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [dev])
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-[34px] bg-gray-900 p-2.5 shadow-xl" style={{ width: dev.w * k + 20, height: dev.h * k + 20 }}>
        <div className="overflow-hidden rounded-[26px] bg-white" style={{ width: dev.w * k, height: dev.h * k }}>
          <div style={{ width: dev.w, height: dev.h, transform: `scale(${k})`, transformOrigin: '0 0' }}>{children({ w: dev.w, h: dev.h })}</div>
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-500">
        Schermo
        <select value={dev.id} className="border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700" style={{ borderRadius: 8 }}
          onChange={e => {
            if (e.target.value === 'custom') { applyCustom(custom); return }
            const d = PREVIEW_DEVICES.find(x => x.id === e.target.value) ?? PREVIEW_DEVICES[0]
            setDev(d)
            try { localStorage.setItem(DEVICE_KEY, d.id) } catch { /* memoria non disponibile */ }
          }}>
          {PREVIEW_DEVICES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          <option value="custom">Il mio telefono (misure)</option>
        </select>
      </label>
      {dev.id === 'custom' && (
        <div className="flex flex-col items-center gap-1 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <DimInput label="Larghezza" value={custom.w} onCommit={w => applyCustom({ ...custom, w })} />
            ×
            <DimInput label="Altezza" value={custom.h} onCommit={h => applyCustom({ ...custom, h })} />
          </div>
          <span className="text-[11px] text-gray-400 text-center max-w-[260px]">
            Per le misure esatte apri <b className="text-gray-600">{typeof window !== 'undefined' ? window.location.host : ''}/schermo</b> sul telefono, nel browser con cui i clienti aprono il QR.
          </span>
        </div>
      )}
    </div>
  )
}

// ── Comandi ──────────────────────────────────────────────────────────────────

export interface FieldBase { label: string; hint?: string }

export function FieldShell({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <div className="text-xs font-medium text-gray-700 mb-1.5">{label}</div>}
      {children}
      {hint && <div className="text-[11px] text-gray-400 mt-1">{hint}</div>}
    </div>
  )
}

export const WEIGHT_LABEL: Record<number, string> = {
  100: 'Sottilissimo', 200: 'Extra sottile', 300: 'Sottile', 400: 'Normale', 500: 'Medio',
  600: 'Semigrassetto', 700: 'Grassetto', 800: 'Extra grassetto', 900: 'Nero',
}

/** Stile completo di un testo: carattere, grandezza, spessore, corsivo,
 *  colore, maiuscolo, spaziatura. Solo facce che esistono davvero. */
export function TextStyleField({ label, hint, value, range, swatches, paper, custom, noCase, onChange }: FieldBase & {
  value:    TextStyle
  range:    [number, number]
  swatches: { ink: string; soft: string; accent: string }
  paper:    string
  custom:   CustomFont[]
  /** Niente "maiuscolo" (prezzi, numeri di pagina: sono cifre). */
  noCase?:  boolean
  onChange: (v: Partial<TextStyle>) => void
}) {
  const info = fontInfo(value.font)
  const face = resolveFace(value.font, value.weight, value.italic)
  const weights = face.italic ? info.i : info.w
  const setFont = (name: string) => {
    const f = resolveFace(name, value.weight, value.italic)
    onChange({ font: name, weight: f.weight as Weight, italic: f.italic })
  }
  const setItalic = (it: boolean) => {
    const f = resolveFace(value.font, value.weight, it)
    onChange({ italic: f.italic, weight: f.weight as Weight })
  }
  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-800 shrink-0">{label}</span>
        <span className="flex-1 min-w-0 truncate text-right rounded-md px-2 py-1 text-[16px]" style={{ ...cssOf(value, swatches), background: paper }}>
          {noCase ? '12,50 · 1 / 8' : 'Aa Bb 12,50'}
        </span>
      </div>
      <FontPicker value={value.font} custom={custom} onChange={setFont} />
      <Slider label="Grandezza" value={value.size} min={range[0]} max={range[1]} step={0.5} format={v => `${v} px`} onChange={v => onChange({ size: v })} />
      <FieldShell label="Spessore">
        <Segmented value={face.weight} onChange={v => onChange({ weight: v as Weight })}
          options={weights.map(w => ({ value: w, label: WEIGHT_LABEL[w] ?? String(w) }))} />
      </FieldShell>
      <div className="flex flex-wrap gap-2">
        <Pill on={face.italic} disabled={!info.i.length} title={info.i.length ? undefined : 'Questo carattere non ha il corsivo'} onClick={() => setItalic(!face.italic)}>
          <span className="italic">Corsivo</span>
        </Pill>
        {!noCase && <Pill on={value.upper} onClick={() => onChange({ upper: !value.upper })}>MAIUSCOLO</Pill>}
      </div>
      <ColorRefField value={value.color} swatches={swatches} onChange={c => onChange({ color: c })} />
      <Slider label="Spaziatura tra le lettere" value={value.tracking} min={0} max={0.5} step={0.01}
        format={v => (v === 0 ? 'Nessuna' : `${Math.round(v * 100)}`)} onChange={v => onChange({ tracking: v })} />
      {hint && <div className="text-[11px] text-gray-400">{hint}</div>}
    </div>
  )
}

export function FontPicker({ value, custom, onChange }: { value: string; custom: CustomFont[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [cat, setCat] = useState<FontCat | 'all' | 'custom'>('all')
  const [q, setQ] = useState('')
  const mine = custom.map(f => ({ name: CUSTOM_PREFIX + f.id, label: f.name, cat: f.cat, ...customWeights(f) }))
  const list = (cat === 'custom' ? mine : [...mine, ...FONTS.map(f => ({ ...f, label: f.name }))])
    .filter(f => (cat === 'all' || cat === 'custom' || f.cat === cat) && (!q || f.label.toLowerCase().includes(q.toLowerCase())))
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left hover:border-gray-400">
        <span className="flex-1 truncate text-[16px]" style={{ fontFamily: fontStack(value) }}>{fontLabel(value)}</span>
        <span className="text-[11px] text-gray-400 shrink-0">{open ? 'Chiudi' : 'Cambia carattere'}</span>
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-white p-2">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {[{ cat: 'all' as const, label: 'Tutti' }, ...(mine.length ? [{ cat: 'custom' as const, label: 'I tuoi' }] : []), ...FONT_CATS].map(c => (
              <button key={c.cat} type="button" onClick={() => setCat(c.cat)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${cat === c.cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {c.label}
              </button>
            ))}
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca…" className="flex-1 min-w-[90px] text-xs border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-gray-400" />
          </div>
          <div className="grid grid-cols-2 gap-1 max-h-64 overflow-y-auto">
            {list.map(f => (
              <button key={f.name} type="button" onClick={() => { onChange(f.name); setOpen(false) }}
                className={`text-left px-2.5 py-1.5 transition ${f.name === value ? 'bg-blue-50 ring-1 ring-blue-500' : 'hover:bg-gray-50'}`} style={{ borderRadius: 10 }}>
                <span className="block truncate text-[17px] leading-tight text-gray-900" style={{ fontFamily: fontStack(f.name), fontWeight: f.w.includes(400) ? 400 : f.w[0] }}>{f.label}</span>
                <span className="block text-[10px] text-gray-400">{f.name.startsWith(CUSTOM_PREFIX) ? 'Tuo · ' : ''}{f.w.length > 1 ? `${f.w.length} spessori` : '1 spessore'}{f.i.length ? ' · corsivo' : ''}</span>
              </button>
            ))}
            {!list.length && <p className="col-span-2 text-xs text-gray-400 p-2">Nessun carattere trovato.</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export function ColorRefField({ value, swatches, onChange }: { value: ColorRef; swatches: { ink: string; soft: string; accent: string }; onChange: (c: ColorRef) => void }) {
  const custom = value !== 'ink' && value !== 'soft' && value !== 'accent'
  const opts: { v: ColorRef; label: string; c: string }[] = [
    { v: 'ink', label: 'Testo', c: swatches.ink }, { v: 'soft', label: 'Secondario', c: swatches.soft }, { v: 'accent', label: 'Accento', c: swatches.accent },
  ]
  return (
    <FieldShell label="Colore" hint={custom ? undefined : 'Segue i colori della carta: cambiandoli cambia anche questo testo.'}>
      <div className="flex flex-wrap items-center gap-1.5">
        {opts.map(o => (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${value === o.v ? 'border-blue-600 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-400'}`}>
            <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: o.c }} />
            {o.label}
          </button>
        ))}
        <label className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] cursor-pointer ${custom ? 'border-blue-600 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-400'}`}>
          <input type="color" value={custom ? value : swatches.ink} onChange={e => onChange(e.target.value.toLowerCase())}
            className="w-4 h-4 rounded-full border-0 p-0 bg-transparent cursor-pointer" aria-label="Colore libero" />
          Altro
        </label>
      </div>
    </FieldShell>
  )
}

export function ColorField({ label, hint, value, onChange }: FieldBase & { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <FieldShell label={label} hint={hint}>
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5">
        <input type="color" value={value} onChange={e => onChange(e.target.value.toLowerCase())} className="w-8 h-8 shrink-0 rounded cursor-pointer border-0 bg-transparent p-0" aria-label={label} />
        <input value={text} onChange={e => { setText(e.target.value); if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toLowerCase()) }}
          className="w-full min-w-0 text-sm font-mono text-gray-700 outline-none" spellCheck={false} />
      </div>
    </FieldShell>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-gray-200 p-0.5 bg-gray-50">
      {options.map(o => (
        <button key={String(o.value)} type="button" onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${o.value === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Choice<T extends string>({ label, hint, value, options, onChange }: FieldBase & { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <FieldShell label={label} hint={hint}>
      <Segmented value={value} options={options} onChange={onChange} />
    </FieldShell>
  )
}

export function Pill({ on, disabled, title, onClick, children }: { on: boolean; disabled?: boolean; title?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-pressed={on}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-35 disabled:cursor-not-allowed ${on ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50/50 text-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
      {children}
    </button>
  )
}

export function Slider({ label, hint, value, min, max, step, format, onChange }: FieldBase & { value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <FieldShell label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="flex-1 min-w-0 accent-blue-600" aria-label={label} />
        <span className="text-xs text-gray-600 w-24 shrink-0 text-right tabular-nums">{format(value)}</span>
      </div>
    </FieldShell>
  )
}

export function Toggle({ label, hint, value, onChange }: FieldBase & { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <FieldShell label="" hint={hint}>
      <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className="flex items-center gap-3 text-sm text-gray-700 text-left">
        <span className={`relative shrink-0 inline-block w-10 h-6 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </span>
        {label}
      </button>
    </FieldShell>
  )
}

// ── Ornamenti (miniature disegnate come nel menu) ───────────────────────────

export const ORNAMENT_LABEL: Record<Ornament, string> = {
  diamond: 'Rombo', star: 'Stella', circle: 'Cerchio', cross: 'Croce', leaf: 'Rametto', flourish: 'Ricciolo',
  asterism: 'Tre stelle', line: 'Linea', double: 'Doppia linea', wave: 'Onda', dots: 'Puntini', none: 'Nessuno',
}

export function OrnamentThumb({ kind, accent, paper }: { kind: Ornament; accent: string; paper: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const dpr = window.devicePixelRatio || 1
    cv.width = 96 * dpr; cv.height = 30 * dpr
    const c = cv.getContext('2d')
    if (!c) return
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.fillStyle = paper; c.fillRect(0, 0, 96, 30)
    drawOrnament(c, kind, 48, 15, 0.95, accent, mix(accent, paper, 0.45))
  }, [kind, accent, paper])
  return <canvas ref={ref} aria-hidden style={{ width: 96, height: 30, borderRadius: 6, display: 'block' }} />
}

export function OrnamentField({ label, value, accent, paper, noNone, onChange }: {
  label: string; value: Ornament; accent: string; paper: string; noNone?: boolean; onChange: (v: Ornament) => void
}) {
  return (
    <FieldShell label={label}>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
        {ORNAMENTS.filter(o => !(noNone && o === 'none')).map(o => (
          <button key={o} type="button" onClick={() => onChange(o)} aria-pressed={o === value}
            className={`flex flex-col items-center gap-1 border p-1.5 transition ${o === value ? 'border-blue-600 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-400'}`}
            style={{ borderRadius: 12 }}>
            <OrnamentThumb kind={o} accent={accent} paper={paper} />
            <span className="text-[10px] text-gray-600">{ORNAMENT_LABEL[o]}</span>
          </button>
        ))}
      </div>
    </FieldShell>
  )
}

// ── Caricamenti (sfondo delle pagine, caratteri) ────────────────────────────

export const FONT_EXT = ['ttf', 'otf', 'woff', 'woff2']
export const MAX_FONT_BYTES = 4 * 1024 * 1024

export async function uploadAsset(restaurantId: string, folder: string, file: File, ext: string): Promise<string> {
  const supabase = createClient()
  const path = `${restaurantId}/${folder}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`
  const { data, error } = await supabase.storage.from('restaurant-assets').upload(path, file, { upsert: false, contentType: file.type || undefined })
  if (error || !data) throw new Error(error?.message ?? 'upload')
  return supabase.storage.from('restaurant-assets').getPublicUrl(data.path).data.publicUrl
}

export function BackgroundField({ restaurantId, value, paper, onChange }: {
  restaurantId: string
  value:        MenuStyle['page']['background']
  paper:        string
  onChange:     (v: Partial<MenuStyle['page']['background']>) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const upload = async (raw: File) => {
    setBusy(true); setErr(null)
    try {
      const file = await compressImageFile(raw)
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      onChange({ url: await uploadAsset(restaurantId, 'menu-bg', file, ext) })
    } catch { setErr('Caricamento non riuscito, riprova.') }
    setBusy(false)
  }
  return (
    <FieldShell label="Immagine di sfondo delle pagine" hint={value.url ? undefined : 'Una foto, una texture, un motivo: va sotto il testo, con la trasparenza che scegli.'}>
      <div className="flex items-center gap-3">
        <div className="w-16 h-20 shrink-0 border border-gray-200 overflow-hidden" style={{ borderRadius: 8, background: paper }}>
          {value.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.url} alt="" className="w-full h-full object-cover" style={{ opacity: value.opacity }} />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className="border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-500 disabled:opacity-50">
            {busy ? 'Caricamento…' : value.url ? 'Cambia immagine' : 'Carica immagine'}
          </button>
          {value.url && (
            <button type="button" onClick={() => onChange({ url: null })} className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-600">Togli</button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }} />
      </div>
      {err && <p className="text-[11px] text-red-600 mt-1">{err}</p>}
      {value.url && (
        <div className="space-y-3 mt-3">
          <Slider label="Intensità dello sfondo" value={value.opacity} min={0.05} max={1} step={0.05} format={pct} onChange={v => onChange({ opacity: v })} />
          <Choice label="Disposizione" value={value.fit} onChange={v => onChange({ fit: v })}
            options={[{ value: 'cover', label: 'A tutta pagina' }, { value: 'tile', label: 'Motivo ripetuto' }]} />
          <Choice label="Su quali pagine" value={value.pages} onChange={v => onChange({ pages: v })}
            options={[{ value: 'all', label: 'Tutte' }, { value: 'first', label: 'Solo la prima' }, { value: 'others', label: 'Tutte tranne la prima' }]} />
        </div>
      )}
    </FieldShell>
  )
}

export function FontsManager({ restaurantId, fonts, onSet, used }: {
  restaurantId: string
  fonts:        CustomFont[]
  onSet:        (list: CustomFont[]) => void
  used:         (id: string) => boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  // Famiglia a cui aggiungere i prossimi file (null = la riconosce da sola).
  const target = useRef<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

  /** Carica più file insieme: ogni file finisce nella sua famiglia (letta dal
   *  file stesso), con il suo spessore e corsivo. */
  const upload = async (files: File[]) => {
    const list: CustomFont[] = structuredClone(fonts)
    const bad: string[] = []
    setErr(null)
    for (let k = 0; k < files.length; k++) {
      const file = files[k]
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      if (!FONT_EXT.includes(ext) || file.size > MAX_FONT_BYTES) { bad.push(file.name); continue }
      setBusy(`Caricamento ${k + 1} di ${files.length}…`)
      try {
        const info = await readFontFileInfo(file)
        const url = await uploadAsset(restaurantId, 'menu-fonts', file, ext)
        const fam = (target.current && list.find(f => f.id === target.current))
          || list.find(f => f.name.toLowerCase() === info.family.toLowerCase())
        const face = { url, weight: info.weight, italic: info.italic }
        if (fam) {
          // Stesso spessore e corsivo già presente: il file nuovo lo sostituisce.
          fam.faces = [...fam.faces.filter(x => !(x.weight === face.weight && x.italic === face.italic)), face]
        } else {
          list.push({ id: newId(), name: info.family.slice(0, 40), cat: 'serif', faces: [face] })
        }
      } catch { bad.push(file.name) }
    }
    for (const f of list) f.faces.sort((x, y) => x.weight - y.weight || Number(x.italic) - Number(y.italic))
    onSet(list)
    target.current = null
    setBusy(null)
    if (bad.length) setErr(`Non caricati: ${bad.join(', ')} (formati .ttf, .otf, .woff, .woff2; massimo 4 MB).`)
  }
  const pick = (familyId: string | null) => { target.current = familyId; fileRef.current?.click() }
  const patch = (id: string, fn: (f: CustomFont) => void) => {
    const list: CustomFont[] = structuredClone(fonts)
    const f = list.find(x => x.id === id)
    if (f) fn(f)
    onSet(list.filter(x => x.faces.length > 0))
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-400">
        Carica i file del tuo carattere (.ttf, .otf, .woff, .woff2): puoi selezionarli tutti insieme. I file della stessa
        famiglia (sottile, normale, grassetto, corsivo…) diventano un solo carattere: lo trovi in ogni testo sotto
        &quot;I tuoi&quot; e scegli spessore e corsivo come per gli altri. Usa solo caratteri che hai il diritto di usare.
      </p>
      {fonts.map(f => (
        <div key={f.id} className="border border-gray-200 p-3 space-y-2" style={{ borderRadius: 12 }}>
          <div className="flex flex-wrap items-center gap-2">
            <input value={f.name} onChange={e => patch(f.id, x => { x.name = e.target.value.slice(0, 40) })} aria-label="Nome del carattere"
              className="flex-1 min-w-[140px] text-sm font-medium border border-gray-200 px-2 py-1 outline-none focus:border-gray-400" />
            <select value={f.cat} onChange={e => patch(f.id, x => { x.cat = e.target.value as FontCat })} aria-label="Tipo"
              className="text-sm border border-gray-200 px-2 py-1 bg-white">
              {FONT_CATS.map(c => <option key={c.cat} value={c.cat}>{c.label}</option>)}
            </select>
            <button type="button" className="px-2 py-1 text-xs text-gray-500 hover:text-red-600"
              onClick={() => {
                if (!used(f.id) || window.confirm('Questo carattere è usato: quei testi torneranno al carattere base. Toglierlo?')) onSet(fonts.filter(x => x.id !== f.id))
              }}>
              Togli tutto
            </button>
          </div>
          <ul className="divide-y divide-gray-100">
            {f.faces.map((x, i) => (
              <li key={x.url} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="flex-1 min-w-[150px] truncate text-[20px] leading-tight text-gray-900"
                  style={{ fontFamily: fontStack(CUSTOM_PREFIX + f.id), fontWeight: x.weight, fontStyle: x.italic ? 'italic' : 'normal' }}>
                  {f.name} {WEIGHT_LABEL[x.weight]}{x.italic ? ' corsivo' : ''}
                </span>
                <select value={x.weight} aria-label="Spessore" className="text-xs border border-gray-200 px-1.5 py-1 bg-white"
                  onChange={e => patch(f.id, ff => { ff.faces[i].weight = Number(e.target.value) })}>
                  {WEIGHTS.map(w => <option key={w} value={w}>{WEIGHT_LABEL[w]} ({w})</option>)}
                </select>
                <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={x.italic} className="accent-blue-600"
                    onChange={e => patch(f.id, ff => { ff.faces[i].italic = e.target.checked })} />
                  Corsivo
                </label>
                <button type="button" aria-label="Togli questo file" className="px-1.5 text-gray-400 hover:text-red-600"
                  onClick={() => patch(f.id, ff => { ff.faces.splice(i, 1) })}>×</button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => pick(f.id)} disabled={!!busy} className="text-xs text-blue-700 hover:underline disabled:opacity-50">
            + Aggiungi file a {f.name}
          </button>
        </div>
      ))}
      <button type="button" onClick={() => pick(null)} disabled={!!busy}
        className="border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-500 disabled:opacity-50">
        {busy ?? '+ Carica i file di un carattere'}
      </button>
      <input ref={fileRef} type="file" multiple accept=".ttf,.otf,.woff,.woff2" className="hidden"
        onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) upload(fs); else target.current = null }} />
      {err && <p className="text-[11px] text-red-600">{err}</p>}
    </div>
  )
}

// ── Campione di carta (superficie vera, come nel menu) ──────────────────────

export const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}

export function PaperSwatch({ paper, texture, strength, light, ink }: {
  paper: string; texture: MenuStyle['page']['texture']; strength: number; light: number; ink: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const W = cv.clientWidth || 120, H = 72
    const dpr = window.devicePixelRatio || 1
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
    const c = cv.getContext('2d')
    if (!c) return
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.fillStyle = paper; c.fillRect(0, 0, W, H)
    const dark = lum(paper) < 0.45
    const g = c.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, Math.hypot(W, H) * 0.62)
    g.addColorStop(0, dark ? `rgba(255,255,255,${0.06 * light})` : `rgba(255,255,255,${0.55 * light})`)
    g.addColorStop(1, dark ? `rgba(0,0,0,${0.22 * light})` : `rgba(150,130,100,${0.12 * light})`)
    c.fillStyle = g; c.fillRect(0, 0, W, H)
    paintPaper(c, texture, strength, W, H)
    c.fillStyle = ink
    c.font = '500 15px "Cormorant Garamond", Georgia, serif'
    c.fillText('Antipasti', 10, 30)
    c.globalAlpha = 0.65
    c.font = 'italic 400 11px "Cormorant Garamond", Georgia, serif'
    c.fillText('burrata, alici, limone', 10, 48)
    c.globalAlpha = 1
  }, [paper, texture, strength, light, ink])
  return <canvas ref={ref} aria-hidden className="block w-full" style={{ height: 72, borderRadius: 10 }} />
}

// ── Vetro liquido ────────────────────────────────────────────────────────────

/** Da dove arriva la luce, a parole. */
function lightLabel(a: number): string {
  const names = ['da destra', 'dall\'alto a destra', 'dall\'alto', 'dall\'alto a sinistra', 'da sinistra', 'dal basso a sinistra', 'dal basso', 'dal basso a destra']
  return names[Math.round((((a % 360) + 360) % 360) / 45) % 8]
}

/** Regolazioni del vetro liquido: vetri pronti e ogni parametro. */
export function GlassControls({ value: G, note, onPreset, onChange }: {
  value:    GlassLook
  note?:    string
  onPreset: (look: GlassLook) => void
  onChange: (patch: Partial<GlassLook>) => void
}) {
  const sign = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`
  return (<>
    {note && <p className="text-[11px] text-gray-400 -mt-1">{note}</p>}
    <FieldShell label="Vetri pronti">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {GLASS_PRESETS.map(p => {
          const on = JSON.stringify(p.look) === JSON.stringify(G)
          return (
            <button key={p.name} type="button" aria-pressed={on} onClick={() => onPreset(p.look)}
              className={`text-left border p-2 transition ${on ? 'border-blue-600 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-400'}`} style={{ borderRadius: 12 }}>
              <div className="text-xs font-medium text-gray-800">{p.name}</div>
              <div className="text-[10px] text-gray-400 leading-tight">{p.desc}</div>
            </button>
          )
        })}
      </div>
    </FieldShell>
    <Slider label="Rifrazione (quanto il bordo piega lo sfondo)" value={G.refraction} min={0} max={1} step={0.01} format={pct} onChange={v => onChange({ refraction: v })} />
    <Slider label="Spessore della lente" value={G.bezel} min={0} max={1} step={0.01} format={pct} onChange={v => onChange({ bezel: v })} />
    <Slider label="Dispersione dei colori sul bordo" value={G.dispersion} min={0} max={1} step={0.01} format={pct} onChange={v => onChange({ dispersion: v })} />
    <Slider label="Smerigliatura" value={G.frost} min={0} max={1} step={0.01} format={v => (v < 0.05 ? 'Limpido' : pct(v))} onChange={v => onChange({ frost: v })} />
    <div className="grid grid-cols-2 gap-3">
      <ColorField label="Colore del vetro" value={G.tint} onChange={v => onChange({ tint: v })} />
      <Slider label="Intensità del colore" value={G.tintAmount} min={0} max={1} step={0.01} format={pct} onChange={v => onChange({ tintAmount: v })} />
    </div>
    <Slider label="Luminosità" value={G.brightness} min={-1} max={1} step={0.01} format={sign} onChange={v => onChange({ brightness: v })} />
    <Slider label="Saturazione" value={G.saturation} min={0} max={2} step={0.01} format={pct} onChange={v => onChange({ saturation: v })} />
    <Slider label="Riflessi di luce" value={G.highlight} min={0} max={1} step={0.01} format={pct} onChange={v => onChange({ highlight: v })} />
    <Slider label="Direzione della luce" value={G.lightAngle} min={0} max={360} step={5} format={lightLabel} onChange={v => onChange({ lightAngle: v })} />
    <Slider label="Ombra sotto il vetro" value={G.shadow} min={0} max={1} step={0.01} format={pct} onChange={v => onChange({ shadow: v })} />
  </>)
}
