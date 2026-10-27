'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Personalizzazione del nuovo menu.
//
// A destra (in alto sul telefono) il menu vero, in una cornice da telefono:
// riceve lo stile a ogni modifica e si reimpagina. A sinistra un pannello per
// ogni elemento del menu (carta, copertina, testatina, categorie, piatti,
// prezzo, descrizione, allergeni, numeri di pagina, pagine di testo, scheda
// del piatto, comandi, sfoglio). Toccando un elemento nell'anteprima si apre
// il suo pannello. Ogni testo ha carattere, grandezza, spessore, corsivo,
// colore, maiuscolo e spaziatura; gli spessori e i corsivi offerti sono solo
// quelli che il carattere ha davvero. Si possono caricare caratteri propri e
// un'immagine di sfondo per le pagine.
//
// Ogni menu ha il suo stile: si modifica quello del menu scelto e, salvando,
// si decide a quali altri menu applicare le stesse modifiche (agli altri
// arrivano solo i cambiamenti fatti, il resto del loro stile non si tocca).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  CUSTOM_PREFIX, DEFAULT_STYLE, FONTS, FONT_CATS, ORNAMENTS, PAPER_STYLES, PAPER_TEXTURES, TEXTURE_LABEL, WEIGHTS, customWeights, fontInfo, fontLabel, fontStack, mix,
  parseStyle, registerCustomFonts, resolveFace,
  type ColorRef, type CustomFont, type FontCat, type MenuStyle, type Ornament, type TextStyle, type Weight,
} from '@/lib/menuStyle'
import { drawOrnament, type PickTarget } from '@/app/prova/[token]/typeset'
import { paintPaper } from '@/app/prova/[token]/paper'
import { loadCustomFonts } from '@/app/prova/[token]/fonts'
import { createClient } from '@/lib/supabase/client'
import { compressImageFile } from '@/lib/imageCompress'
import { readFontFileInfo } from '@/lib/fontFileInfo'
import { saveMenuStyles } from './actions'

type PanelId =
  | 'presets' | 'paper' | 'fonts' | 'head' | 'runningHead' | 'category' | 'dish' | 'price' | 'description'
  | 'allergens' | 'pageNumber' | 'textPages' | 'card' | 'chrome' | 'effects'

const PANELS: { id: PanelId; title: string; sub: string }[] = [
  { id: 'presets',     title: 'Stili pronti',         sub: 'Un punto di partenza completo' },
  { id: 'paper',       title: 'Carta e sfondo',       sub: 'Colori, superficie, immagine di sfondo, margini, grandezza' },
  { id: 'fonts',       title: 'I tuoi caratteri',     sub: 'Carica i file dei tuoi caratteri' },
  { id: 'head',        title: 'Copertina',            sub: 'Nome del ristorante, titolo del menu, ornamento' },
  { id: 'runningHead', title: 'Testatina',            sub: 'La riga in cima alle pagine' },
  { id: 'category',    title: 'Categorie',            sub: 'Titoli delle sezioni del menu' },
  { id: 'dish',        title: 'Piatti e nome',        sub: 'Allineamento, spazi, separatori, nome' },
  { id: 'price',       title: 'Prezzo',               sub: 'Posizione, formato, guida' },
  { id: 'description', title: 'Descrizione',          sub: 'Testo sotto il nome del piatto' },
  { id: 'allergens',   title: 'Allergeni',            sub: 'Numeri sotto i piatti' },
  { id: 'pageNumber',  title: 'Numeri di pagina',     sub: 'In fondo alle pagine' },
  { id: 'textPages',   title: 'Pagine di testo',      sub: 'Pagina informativa e legenda allergeni' },
  { id: 'card',        title: 'Scheda del piatto',    sub: 'Quella che si apre toccando un piatto' },
  { id: 'chrome',      title: 'Comandi e aiuti',      sub: 'Barra in basso, inviti a sfogliare' },
  { id: 'effects',     title: 'Effetto sfoglio',      sub: 'Ombre e velocità della pagina' },
]

// Toccando un elemento nell'anteprima si apre il suo pannello.
const PICK_PANEL: Record<PickTarget, PanelId> = {
  paper: 'paper', restaurant: 'head', title: 'head', runningHead: 'runningHead', category: 'category',
  name: 'dish', price: 'price', description: 'description', allergens: 'allergens', pageNumber: 'pageNumber', text: 'textPages',
}

// Tavolozze pronte (carta, testo, secondario, accento).
const PALETTES: { name: string; paper: string; ink: string; soft: string; accent: string }[] = [
  { name: 'Carta',      paper: '#fbf8f2', ink: '#1d1915', soft: '#5f574d', accent: '#9a8462' },
  { name: 'Avorio',     paper: '#f7f1e6', ink: '#2b1d1a', soft: '#6b5446', accent: '#7d2a2a' },
  { name: 'Salvia',     paper: '#f2f1ea', ink: '#1f2a24', soft: '#56635a', accent: '#5f7a5c' },
  { name: 'Mare',       paper: '#f4f6f6', ink: '#14232e', soft: '#4d5e69', accent: '#2f6b8a' },
  { name: 'Terracotta', paper: '#f6ede3', ink: '#2a1d16', soft: '#6e5547', accent: '#b0532f' },
  { name: 'Bianco',     paper: '#ffffff', ink: '#141414', soft: '#5c5c5c', accent: '#8a7a5c' },
  { name: 'Ardesia',    paper: '#24272b', ink: '#eef0f2', soft: '#a9b0b8', accent: '#c9a96e' },
  { name: 'Notte',      paper: '#1b1916', ink: '#eee6d8', soft: '#b8ad9c', accent: '#c4a46b' },
]

// ── Stili pronti ─────────────────────────────────────────────────────────────

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }
function merge<T>(base: T, patch: DeepPartial<T>): T {
  const out = { ...base } as Record<string, unknown>
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k]
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' ? merge(b, v as DeepPartial<typeof b>) : v
  }
  return out as T
}
const preset = (p: DeepPartial<MenuStyle>) => parseStyle(merge(DEFAULT_STYLE, p))
const tsx = (font: string, size: number, weight: Weight, o: Partial<TextStyle> = {}): Partial<TextStyle> => ({ font, size, weight, ...o })

const PRESETS: { name: string; desc: string; style: MenuStyle }[] = [
  { name: 'Classico', desc: 'Garamond, filetti, puntini', style: DEFAULT_STYLE },
  {
    name: 'Trattoria', desc: 'Calda, Playfair, lino',
    style: preset({
      page: { paper: '#f6ede0', ink: '#2b1d1a', soft: '#6b5446', accent: '#8c2f22', texture: 'linen', textureStrength: 0.45 },
      head: { title: tsx('Playfair Display', 36, 700, { italic: true }), restaurant: tsx('Playfair Display', 11, 600, { upper: true, tracking: 0.24 }), ornament: 'star' },
      runningHead: { text: tsx('Playfair Display', 9.5, 500, { upper: true, tracking: 0.2 }) },
      category: { text: tsx('Playfair Display', 13, 700, { upper: true, tracking: 0.16 }), style: 'ornament', ornament: 'leaf' },
      dish: {
        name: tsx('Playfair Display', 18.5, 600), price: tsx('Playfair Display', 18, 600),
        description: tsx('Lora', 15.5, 400, { italic: true }), leader: 'line',
      },
      textPages: { title: tsx('Playfair Display', 25, 600), body: tsx('Lora', 15.5, 400) },
    }),
  },
  {
    name: 'Moderno', desc: 'Pulito, Manrope, a sinistra',
    style: preset({
      page: { paper: '#ffffff', ink: '#141414', soft: '#5c5c5c', accent: '#141414', texture: 'none', light: 0, margin: 26 },
      head: { title: tsx('Manrope', 34, 700), restaurant: tsx('Manrope', 10.5, 600, { upper: true, tracking: 0.22 }), ornament: 'none', space: 10 },
      runningHead: { text: tsx('Manrope', 9, 600, { upper: true, tracking: 0.18 }), content: 'menu' },
      category: { text: tsx('Manrope', 12, 700, { upper: true, tracking: 0.14 }), style: 'underline', align: 'left', before: 34 },
      dish: {
        name: tsx('Manrope', 17, 600), price: tsx('Manrope', 17, 600),
        description: tsx('Manrope', 14.5, 400, { italic: false }), descLineHeight: 1.4,
        leader: 'none', priceSymbol: 'after', priceDecimals: 'auto', divider: 'line', spacing: 18,
      },
      allergens: { text: tsx('Manrope', 9.5, 600, { upper: true, tracking: 0.1 }), label: false },
      pageNumber: { text: tsx('Manrope', 9.5, 600), format: 'plain' },
      textPages: { title: tsx('Manrope', 24, 700), body: tsx('Manrope', 15, 400) },
      card: { radius: 6, photo: 'landscape' },
    }),
  },
  {
    name: 'Bistrot', desc: 'Corsivo, terracotta, centrato',
    style: preset({
      page: { paper: '#f6ede3', ink: '#2a1d16', soft: '#6e5547', accent: '#b0532f', texture: 'grain', textureStrength: 0.6 },
      head: { title: tsx('Dancing Script', 46, 700), restaurant: tsx('Josefin Sans', 11, 600, { upper: true, tracking: 0.3 }), ornament: 'flourish', ornamentSize: 1.2 },
      runningHead: { text: tsx('Josefin Sans', 9.5, 600, { upper: true, tracking: 0.25 }) },
      category: { text: tsx('Dancing Script', 26, 700, { upper: false, tracking: 0 }), style: 'plain', after: 12 },
      dish: {
        align: 'center', name: tsx('Josefin Sans', 15, 700, { upper: true, tracking: 0.08 }),
        price: tsx('Josefin Sans', 14, 600), pricePosition: 'below', priceSymbol: 'before',
        description: tsx('Cormorant Garamond', 17, 500, { italic: true }), divider: 'ornament', dividerOrnament: 'leaf', spacing: 22,
      },
      allergens: { text: tsx('Josefin Sans', 9.5, 600, { upper: true, tracking: 0.14 }) },
      textPages: { title: tsx('Dancing Script', 32, 700), body: tsx('Cormorant Garamond', 17, 500) },
      card: { photo: 'circle', photoWidth: 70 },
    }),
  },
  {
    name: 'Elegante', desc: 'Bodoni, molto spazio, cornici',
    style: preset({
      page: { paper: '#faf8f4', ink: '#191714', soft: '#6a635a', accent: '#8a7350', margin: 40, texture: 'grain', textureStrength: 0.25 },
      head: { title: tsx('Bodoni Moda', 40, 400, { italic: true }), restaurant: tsx('Cinzel', 11, 500, { upper: true, tracking: 0.36 }), ornament: 'double', space: 14, titleGap: 6 },
      runningHead: { text: tsx('Cinzel', 9, 500, { upper: true, tracking: 0.3 }) },
      category: { text: tsx('Cinzel', 12, 600, { upper: true, tracking: 0.3 }), style: 'frame', before: 38, after: 22 },
      dish: {
        align: 'center', name: tsx('Bodoni Moda', 19, 500), price: tsx('Bodoni Moda', 16, 400, { italic: true }),
        pricePosition: 'below', description: tsx('Bodoni Moda', 14.5, 400, { italic: true }), descWidth: 0.82, spacing: 28,
      },
      allergens: { text: tsx('Cinzel', 9, 500, { upper: true, tracking: 0.18 }) },
      pageNumber: { text: tsx('Cinzel', 9.5, 500, { tracking: 0.2 }), format: 'dashes' },
      textPages: { title: tsx('Bodoni Moda', 26, 400, { italic: true }), body: tsx('Bodoni Moda', 15, 400) },
    }),
  },
  {
    name: 'Notte', desc: 'Carta scura, oro, comandi fumé',
    style: preset({
      page: { paper: '#1b1916', ink: '#eee6d8', soft: '#b8ad9c', accent: '#c4a46b', textureStrength: 0.5 },
      head: { ornament: 'asterism' },
      chrome: { tint: 'dark' },
    }),
  },
  {
    name: 'Minimal', desc: 'Inter, centrato, essenziale',
    style: preset({
      page: { paper: '#fafafa', ink: '#222222', soft: '#777777', accent: '#9a9a9a', texture: 'none', light: 0.4 },
      head: { title: tsx('Inter', 30, 600), restaurant: tsx('Inter', 10, 500, { upper: true, tracking: 0.3 }), ornament: 'none' },
      runningHead: { show: false },
      category: { text: tsx('Inter', 11, 600, { upper: true, tracking: 0.3 }), style: 'plain' },
      dish: {
        align: 'center', name: tsx('Inter', 15.5, 600), price: tsx('Inter', 14, 500, { color: 'accent' }),
        pricePosition: 'inline', priceSymbol: 'none', priceDecimals: 'auto', description: tsx('Inter', 13.5, 400, { italic: false }),
        descLineHeight: 1.45, divider: 'short',
      },
      allergens: { text: tsx('Inter', 9, 500, { upper: true, tracking: 0.12 }), label: false },
      pageNumber: { text: tsx('Inter', 9, 500), format: 'plain' },
      textPages: { title: tsx('Inter', 22, 600), body: tsx('Inter', 14.5, 400) },
      card: { radius: 22 },
    }),
  },
]

// Campioni dei caratteri (una faccia per famiglia) per l'elenco di scelta.
const FONT_SAMPLE_URL = '/api/gfonts/css2?' +
  FONTS.map(f => `family=${encodeURIComponent(f.name).replace(/%20/g, '+')}:wght@${f.w[0]}`).join('&') + '&display=swap'

interface Props {
  restaurantId: string
  token:        string
  /** Menu attivi del ristorante, ognuno con il suo stile attuale. */
  menus:        { id: string; name: string; style: MenuStyle }[]
}

type Flat = Record<string, unknown>
/** Stile → { "dish.name.font": …, … } (le liste restano valori interi). */
function flatten(o: unknown, pre = '', out: Flat = {}): Flat {
  if (o && typeof o === 'object' && !Array.isArray(o)) for (const [k, v] of Object.entries(o)) flatten(v, pre ? `${pre}.${k}` : k, out)
  else out[pre] = o
  return out
}
/** Applica a `target` solo ciò che è cambiato da `from` a `to`. I caratteri
 *  caricati si sommano (nessun menu perde i suoi). */
function applyChanges(target: MenuStyle, from: MenuStyle, to: MenuStyle): MenuStyle {
  const a = flatten(from), b = flatten(to)
  const out = structuredClone(target) as unknown as Record<string, unknown>
  for (const [path, v] of Object.entries(b)) {
    if (JSON.stringify(a[path]) === JSON.stringify(v)) continue
    if (path === 'customFonts') {
      const have = new Set(target.customFonts.map(f => f.id))
      out.customFonts = [...target.customFonts, ...to.customFonts.filter(f => !have.has(f.id))]
      continue
    }
    const keys = path.split('.')
    let node = out
    for (const k of keys.slice(0, -1)) node = node[k] as Record<string, unknown>
    node[keys[keys.length - 1]] = structuredClone(v)
  }
  return parseStyle(out)
}

export default function StyleEditor({ restaurantId, token, menus }: Props) {
  const [menuId, setMenuId] = useState(menus[0]?.id ?? '')
  // Stile salvato di ogni menu; `style` è la copia di lavoro del menu scelto.
  const [savedBy, setSavedBy] = useState<Record<string, MenuStyle>>(() => Object.fromEntries(menus.map(m => [m.id, m.style])))
  const saved = savedBy[menuId] ?? DEFAULT_STYLE
  const [style, setStyle] = useState<MenuStyle>(saved)
  const [applyOpen, setApplyOpen] = useState(false)
  const [open, setOpen] = useState<PanelId | null>('presets')
  const [flash, setFlash] = useState<PanelId | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, startSaving] = useTransition()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const panelRefs = useRef(new Map<PanelId, HTMLElement>())
  const dirty = useMemo(() => JSON.stringify(style) !== JSON.stringify(saved), [style, saved])

  // Caratteri caricati: riconosciuti dai campioni e dall'elenco di scelta.
  registerCustomFonts(style.customFonts)
  const customKey = JSON.stringify(style.customFonts)
  const [, setFontsTick] = useState(0)
  useEffect(() => {
    loadCustomFonts(style.customFonts).then(() => setFontsTick(t => t + 1))
  }, [customKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (document.querySelector('link[data-lito-font-samples]')) return
    const l = document.createElement('link')
    l.rel = 'stylesheet'; l.href = FONT_SAMPLE_URL; l.dataset.litoFontSamples = '1'
    document.head.appendChild(l)
  }, [])

  // Anteprima: riceve lo stile a ogni modifica; ci dice cosa è stato toccato.
  const post = useCallback((msg: unknown) => frameRef.current?.contentWindow?.postMessage(msg, window.location.origin), [])
  useEffect(() => { post({ type: 'lito-style', style }) }, [style, post])
  // Pannello della scheda aperto: l'anteprima mostra la scheda di un piatto.
  useEffect(() => { post({ type: 'lito-card', open: open === 'card' }) }, [open, post])
  const live = useRef({ style, open })
  live.current = { style, open }
  useEffect(() => {
    let clear = 0
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const msg = e.data as { type?: string; target?: PickTarget }
      if (msg?.type === 'lito-preview-ready') {
        post({ type: 'lito-style', style: live.current.style })
        if (live.current.open === 'card') post({ type: 'lito-card', open: true })
      }
      if (msg?.type === 'lito-pick' && msg.target) {
        const id = PICK_PANEL[msg.target] ?? 'paper'
        setOpen(id)
        setFlash(id)
        window.setTimeout(() => panelRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
        clearTimeout(clear); clear = window.setTimeout(() => setFlash(null), 1600)
      }
    }
    window.addEventListener('message', onMsg)
    return () => { window.removeEventListener('message', onMsg); clearTimeout(clear) }
  }, [post])

  // Modifiche non salvate: avviso uscendo dalla pagina.
  useEffect(() => {
    if (!dirty) return
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  /** Modifica dello stile: si lavora su una copia. */
  const edit = useCallback((fn: (s: MenuStyle) => void) => setStyle(prev => { const n = structuredClone(prev); fn(n); return n }), [])

  /** Salva il menu scelto più gli altri indicati (solo le modifiche fatte). */
  const save = (others: string[]) => startSaving(async () => {
    const updates = [
      { menuId, style },
      ...others.map(id => ({ menuId: id, style: applyChanges(savedBy[id] ?? DEFAULT_STYLE, saved, style) })),
    ]
    // Tutti i menu: diventa anche lo stile del ristorante (per i menu nuovi).
    const all = menus.every(m => m.id === menuId || others.includes(m.id))
    const res = await saveMenuStyles(restaurantId, updates, all ? style : null)
    if (res.ok) {
      setSavedBy(prev => ({ ...prev, ...Object.fromEntries(updates.map(u => [u.menuId, u.style])) }))
      setApplyOpen(false)
      setMessage({ ok: true, text: updates.length > 1 ? `Stile salvato in ${updates.length} menu.` : 'Stile salvato.' })
    } else setMessage({ ok: false, text: res.error })
    window.setTimeout(() => setMessage(null), 3000)
  })
  const askSave = () => (menus.length > 1 ? setApplyOpen(true) : save([]))

  /** Cambio del menu da modificare (le modifiche non salvate si perdono). */
  const switchMenu = (id: string) => {
    if (id === menuId) return
    if (dirty && !window.confirm('Le modifiche non salvate a questo menu andranno perse. Continuare?')) return
    setMenuId(id)
    setStyle(savedBy[id] ?? DEFAULT_STYLE)
  }
  // Stili pronti e "Stile base" tengono i caratteri caricati.
  const replaceAll = (st: MenuStyle) => setStyle(prev => ({ ...structuredClone(st), customFonts: prev.customFonts }))

  const st = style
  const swatches = { ink: st.page.ink, soft: st.page.soft, accent: st.page.accent }
  const T = (label: string, get: (s: MenuStyle) => TextStyle, range: [number, number], hint?: string, noCase?: boolean) => (
    <TextStyleField label={label} hint={hint} value={get(st)} range={range} swatches={swatches} paper={st.page.paper}
      custom={st.customFonts} noCase={noCase} onChange={v => edit(s => { Object.assign(get(s), v) })} />
  )
  const O = (label: string, value: Ornament, set: (s: MenuStyle, v: Ornament) => void, noNone?: boolean) => (
    <OrnamentField label={label} value={value} accent={st.page.accent} paper={st.page.paper} noNone={noNone}
      onChange={v => edit(s => set(s, v))} />
  )

  const body = (id: PanelId) => {
    switch (id) {
      case 'presets': return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESETS.map(p => (
            <button key={p.name} type="button" onClick={() => replaceAll(p.style)}
              className="text-left border border-gray-200 hover:border-gray-400 p-2.5 transition" style={{ borderRadius: 16 }}>
              <PresetSample st={p.style} />
              <div className="text-xs font-medium text-gray-800 mt-2">{p.name}</div>
              <div className="text-[11px] text-gray-400 leading-tight">{p.desc}</div>
            </button>
          ))}
          <p className="col-span-full text-[11px] text-gray-400">Uno stile pronto sostituisce tutte le impostazioni: poi puoi cambiare ogni dettaglio. Finché non salvi, &quot;Annulla&quot; torna indietro.</p>
        </div>
      )
      case 'paper': return (<>
        <FieldShell label="Carte pronte" hint="Colore, superficie e luce studiati insieme; sulle carte scure o colorate cambiano anche i colori del testo.">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {PAPER_STYLES.map(p => {
              const on = p.paper === st.page.paper && p.texture === st.page.texture
              return (
                <button key={p.name} type="button" aria-pressed={on}
                  onClick={() => edit(s => {
                    Object.assign(s.page, { paper: p.paper, texture: p.texture, textureStrength: p.textureStrength, light: p.light })
                    if (p.ink) s.page.ink = p.ink
                    if (p.soft) s.page.soft = p.soft
                    if (p.accent) s.page.accent = p.accent
                    // Tornando a una carta chiara da una scura, il testo torna scuro.
                    if (!p.ink && lum(s.page.ink) > 0.6) Object.assign(s.page, { ink: DEFAULT_STYLE.page.ink, soft: DEFAULT_STYLE.page.soft, accent: DEFAULT_STYLE.page.accent })
                  })}
                  className={`text-left border p-1.5 transition ${on ? 'border-blue-600 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-400'}`}
                  style={{ borderRadius: 14 }}>
                  <PaperSwatch paper={p.paper} texture={p.texture} strength={p.textureStrength} light={p.light} ink={p.ink ?? '#1d1915'} />
                  <div className="text-[11px] font-medium text-gray-800 mt-1.5 px-0.5">{p.name}</div>
                  <div className="text-[10px] text-gray-400 leading-tight px-0.5">{p.desc}</div>
                </button>
              )
            })}
          </div>
        </FieldShell>
        <div className="flex flex-wrap gap-2">
          {PALETTES.map(p => {
            const on = p.paper === st.page.paper && p.ink === st.page.ink && p.accent === st.page.accent
            return (
              <button key={p.name} type="button" onClick={() => edit(s => { Object.assign(s.page, { paper: p.paper, ink: p.ink, soft: p.soft, accent: p.accent }) })}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${on ? 'border-blue-600 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-400'}`}>
                <span className="flex -space-x-1">
                  {[p.paper, p.ink, p.accent].map((c, i) => <span key={i} className="w-4 h-4 rounded-full border border-black/10" style={{ background: c }} />)}
                </span>
                {p.name}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ColorField label="Carta" value={st.page.paper} onChange={v => edit(s => { s.page.paper = v })} />
          <ColorField label="Testo" value={st.page.ink} onChange={v => edit(s => { s.page.ink = v })} />
          <ColorField label="Testo secondario" value={st.page.soft} onChange={v => edit(s => { s.page.soft = v })} />
          <ColorField label="Accento" value={st.page.accent} onChange={v => edit(s => { s.page.accent = v })} />
        </div>
        <BackgroundField restaurantId={restaurantId} value={st.page.background} paper={st.page.paper}
          onChange={v => edit(s => { Object.assign(s.page.background, v) })} />
        <Choice label="Superficie della carta" value={st.page.texture} onChange={v => edit(s => { s.page.texture = v })}
          options={PAPER_TEXTURES.map(t => ({ value: t, label: TEXTURE_LABEL[t] }))} />
        {st.page.texture !== 'none' && (
          <Slider label="Intensità della superficie" value={st.page.textureStrength} min={0} max={1} step={0.05} format={pct} onChange={v => edit(s => { s.page.textureStrength = v })} />
        )}
        <Slider label="Luce sulla pagina" hint="Centro più chiaro e bordi appena più scuri, come la carta vera." value={st.page.light} min={0} max={1} step={0.05} format={pct} onChange={v => edit(s => { s.page.light = v })} />
        <Slider label="Grandezza di tutti i testi" value={st.page.scale} min={0.8} max={1.3} step={0.01} format={pct} onChange={v => edit(s => { s.page.scale = v })} />
        <Slider label="Margini laterali" value={st.page.margin} min={12} max={64} step={1} format={px} onChange={v => edit(s => { s.page.margin = v })} />
        <Slider label="Margini in alto e in basso" value={st.page.marginV} min={14} max={70} step={1} format={px} onChange={v => edit(s => { s.page.marginV = v })} />
        <Slider label="Larghezza massima del testo" hint="Conta su tablet e schermi larghi." value={st.page.maxWidth} min={340} max={760} step={10} format={px} onChange={v => edit(s => { s.page.maxWidth = v })} />
      </>)
      case 'fonts': return (
        <FontsManager restaurantId={restaurantId} fonts={st.customFonts}
          onSet={list => edit(s => { s.customFonts = list })}
          used={id => JSON.stringify(st).includes(`"${CUSTOM_PREFIX}${id}"`)} />
      )
      case 'head': return (<>
        <Toggle label="Mostra il nome del ristorante" value={st.head.showRestaurant} onChange={v => edit(s => { s.head.showRestaurant = v })} />
        {st.head.showRestaurant && T('Nome del ristorante', s => s.head.restaurant, [7, 24])}
        {T('Titolo del menu', s => s.head.title, [20, 72], 'Se è troppo lungo per la riga si riduce da solo.')}
        {st.head.showRestaurant && (
          <Slider label="Spazio tra nome del ristorante e titolo" value={st.head.titleGap} min={-10} max={40} step={1} format={signedPx} onChange={v => edit(s => { s.head.titleGap = v })} />
        )}
        {O('Ornamento sotto il titolo', st.head.ornament, (s, v) => { s.head.ornament = v })}
        {st.head.ornament !== 'none' && (<>
          <Slider label="Grandezza dell'ornamento" value={st.head.ornamentSize} min={0.6} max={2} step={0.05} format={pct} onChange={v => edit(s => { s.head.ornamentSize = v })} />
          <Slider label="Distanza tra titolo e ornamento" value={st.head.ornamentGap} min={10} max={60} step={1} format={px} onChange={v => edit(s => { s.head.ornamentGap = v })} />
        </>)}
        <Slider label="Spazio sotto la copertina" value={st.head.space} min={0} max={80} step={1} format={px} onChange={v => edit(s => { s.head.space = v })} />
      </>)
      case 'runningHead': return (<>
        <Toggle label="Mostra la testatina" hint="Dalla seconda pagina in poi. Senza, il testo parte più in alto." value={st.runningHead.show} onChange={v => edit(s => { s.runningHead.show = v })} />
        {st.runningHead.show && (<>
          <Choice label="Contenuto" value={st.runningHead.content} onChange={v => edit(s => { s.runningHead.content = v })}
            options={[{ value: 'both', label: 'Ristorante · Menu' }, { value: 'restaurant', label: 'Solo ristorante' }, { value: 'menu', label: 'Solo menu' }]} />
          {T('Testo della testatina', s => s.runningHead.text, [7, 16])}
        </>)}
      </>)
      case 'category': return (<>
        {T('Titolo della categoria', s => s.category.text, [8, 40])}
        <Choice label="Decorazione" value={st.category.style} onChange={v => edit(s => { s.category.style = v })}
          options={[{ value: 'rules', label: 'Filetti' }, { value: 'underline', label: 'Sottolineato' }, { value: 'frame', label: 'Cornice' }, { value: 'ornament', label: 'Ornamento sotto' }, { value: 'plain', label: 'Nessuna' }]} />
        {st.category.style === 'ornament' && O('Ornamento sotto la categoria', st.category.ornament, (s, v) => { s.category.ornament = v }, true)}
        <Choice label="Allineamento" value={st.category.align} onChange={v => edit(s => { s.category.align = v })}
          options={[{ value: 'center', label: 'Centrato' }, { value: 'left', label: 'A sinistra' }]} />
        <Slider label="Spazio prima della categoria" value={st.category.before} min={0} max={80} step={1} format={px} onChange={v => edit(s => { s.category.before = v })} />
        <Slider label="Spazio dopo la categoria" value={st.category.after} min={0} max={60} step={1} format={px} onChange={v => edit(s => { s.category.after = v })} />
        <Toggle label="Scrivi &quot;segue&quot; quando la categoria continua nella pagina dopo" value={st.category.continued} onChange={v => edit(s => { s.category.continued = v })} />
      </>)
      case 'dish': return (<>
        <Choice label="Allineamento dei piatti" value={st.dish.align} onChange={v => edit(s => { s.dish.align = v })}
          options={[{ value: 'left', label: 'A sinistra' }, { value: 'center', label: 'Centrato' }]} />
        <Slider label="Spazio tra i piatti" value={st.dish.spacing} min={0} max={60} step={1} format={px} onChange={v => edit(s => { s.dish.spacing = v })} />
        <Choice label="Separatore tra i piatti" value={st.dish.divider} onChange={v => edit(s => { s.dish.divider = v })}
          options={[{ value: 'none', label: 'Nessuno' }, { value: 'line', label: 'Linea' }, { value: 'short', label: 'Lineetta' }, { value: 'dots', label: 'Puntini' }, { value: 'ornament', label: 'Ornamento' }]} />
        {st.dish.divider === 'ornament' && O('Ornamento tra i piatti', st.dish.dividerOrnament, (s, v) => { s.dish.dividerOrnament = v }, true)}
        {T('Nome del piatto', s => s.dish.name, [11, 34])}
        <Slider label="Interlinea del nome (nomi su più righe)" value={st.dish.nameLineHeight} min={1} max={1.6} step={0.01} format={v => v.toFixed(2)} onChange={v => edit(s => { s.dish.nameLineHeight = v })} />
      </>)
      case 'price': return (<>
        <Choice label="Posizione" value={st.dish.pricePosition} onChange={v => edit(s => { s.dish.pricePosition = v })}
          options={[{ value: 'right', label: 'A destra' }, { value: 'inline', label: 'Dopo il nome' }, { value: 'below', label: 'Sotto il nome' }]}
          hint={st.dish.align === 'center' && st.dish.pricePosition === 'right' ? 'Con i piatti centrati il prezzo "a destra" va sotto il nome.' : undefined} />
        {st.dish.pricePosition === 'right' && st.dish.align !== 'center' && (
          <Choice label="Guida tra nome e prezzo" value={st.dish.leader} onChange={v => edit(s => { s.dish.leader = v })}
            options={[{ value: 'dots', label: 'Puntini' }, { value: 'line', label: 'Linea' }, { value: 'none', label: 'Nessuna' }]} />
        )}
        {st.dish.pricePosition !== 'right' && (
          <Slider label={st.dish.pricePosition === 'inline' ? 'Spazio tra nome e prezzo' : 'Spazio sopra il prezzo'} value={st.dish.priceGap} min={0} max={30} step={1} format={px} onChange={v => edit(s => { s.dish.priceGap = v })} />
        )}
        <Choice label="Simbolo dell'euro" value={st.dish.priceSymbol} onChange={v => edit(s => { s.dish.priceSymbol = v })}
          options={[{ value: 'after', label: 'Dopo (12 €)' }, { value: 'before', label: 'Prima (€ 12)' }, { value: 'none', label: 'Nessuno (12)' }]} />
        <Choice label="Decimali" value={st.dish.priceDecimals} onChange={v => edit(s => { s.dish.priceDecimals = v })}
          options={[{ value: 'always', label: 'Sempre (12,00)' }, { value: 'auto', label: 'Solo se servono (12 · 12,50)' }]} />
        <p className="text-[11px] text-gray-400 -mt-2">Esempio: <span className="font-medium text-gray-600">{examplePrice(st)}</span></p>
        {T('Testo del prezzo', s => s.dish.price, [10, 32], undefined, true)}
      </>)
      case 'description': return (<>
        {T('Testo della descrizione', s => s.dish.description, [10, 26])}
        <Slider label="Spazio tra nome e descrizione" value={st.dish.descGap} min={0} max={24} step={1} format={px} onChange={v => edit(s => { s.dish.descGap = v })} />
        <Slider label="Interlinea" value={st.dish.descLineHeight} min={1.05} max={1.8} step={0.01} format={v => v.toFixed(2)} onChange={v => edit(s => { s.dish.descLineHeight = v })} />
        <Slider label="Larghezza della descrizione" hint="Più stretta = righe più corte." value={st.dish.descWidth} min={0.55} max={1} step={0.01} format={pct} onChange={v => edit(s => { s.dish.descWidth = v })} />
      </>)
      case 'allergens': return (<>
        <Toggle label="Numeri degli allergeni sotto i piatti" hint="Nella scheda del piatto ci sono sempre." value={st.allergens.show} onChange={v => edit(s => { s.allergens.show = v })} />
        {st.allergens.show && (<>
          <Toggle label="Scritta &quot;Allergeni&quot; prima dei numeri" value={st.allergens.label} onChange={v => edit(s => { s.allergens.label = v })} />
          {T('Testo degli allergeni', s => s.allergens.text, [7, 16])}
          <Slider label="Spazio sopra gli allergeni" value={st.dish.allergenGap} min={0} max={30} step={1} format={px} onChange={v => edit(s => { s.dish.allergenGap = v })} />
        </>)}
      </>)
      case 'pageNumber': return (<>
        <Toggle label="Numeri di pagina" value={st.pageNumber.show} onChange={v => edit(s => { s.pageNumber.show = v })} />
        {st.pageNumber.show && (<>
          <Choice label="Formato" value={st.pageNumber.format} onChange={v => edit(s => { s.pageNumber.format = v })}
            options={[{ value: 'of', label: '2 / 8' }, { value: 'plain', label: '2' }, { value: 'dashes', label: '— 2 —' }]} />
          {T('Testo dei numeri', s => s.pageNumber.text, [7, 16], undefined, true)}
        </>)}
      </>)
      case 'textPages': return (<>
        {T('Titoli', s => s.textPages.title, [16, 44], 'I sottotitoli sono un po\' più piccoli.')}
        {T('Testo', s => s.textPages.body, [11, 24], 'Anche i nomi della legenda allergeni.')}
        <Slider label="Interlinea" value={st.textPages.lineHeight} min={0.85} max={1.4} step={0.01} format={pct} onChange={v => edit(s => { s.textPages.lineHeight = v })} />
        <Slider label="Spazio tra i paragrafi" value={st.textPages.paraGap} min={0} max={30} step={1} format={px} onChange={v => edit(s => { s.textPages.paraGap = v })} />
      </>)
      case 'card': return (<>
        <p className="text-[11px] text-gray-400 -mt-1">L&apos;anteprima mostra la scheda di un piatto finché questo pannello è aperto. Caratteri e colori sono quelli dei piatti.</p>
        <Choice label="Forma della foto" value={st.card.photo} onChange={v => edit(s => { s.card.photo = v })}
          options={[{ value: 'square', label: 'Quadrata' }, { value: 'landscape', label: 'Orizzontale' }, { value: 'portrait', label: 'Verticale' }, { value: 'circle', label: 'Tonda' }]} />
        <Slider label="Larghezza della foto" value={st.card.photoWidth} min={50} max={100} step={1} format={v => `${Math.round(v)}%`} onChange={v => edit(s => { s.card.photoWidth = v })} />
        {st.card.photo !== 'circle' && (
          <Slider label="Angoli della foto" value={st.card.radius} min={0} max={32} step={1} format={px} onChange={v => edit(s => { s.card.radius = v })} />
        )}
        <Slider label="Grandezza del nome" value={st.card.titleSize} min={22} max={48} step={1} format={px} onChange={v => edit(s => { s.card.titleSize = v })} />
        <Slider label="Trasparenza del vetro" value={st.card.glass} min={0} max={1} step={0.05} format={v => (v < 0.15 ? 'Piena' : v > 0.8 ? 'Molto trasparente' : pct(v))} onChange={v => edit(s => { s.card.glass = v })} />
        <Toggle label="Categoria sopra il nome" value={st.card.showCategory} onChange={v => edit(s => { s.card.showCategory = v })} />
        <Toggle label="Riquadro prezzo e allergeni" value={st.card.showSummary} onChange={v => edit(s => { s.card.showSummary = v })} />
        <Toggle label="&quot;Altro in …&quot; (altri piatti della categoria)" value={st.card.showMore} onChange={v => edit(s => { s.card.showMore = v })} />
      </>)
      case 'chrome': return (<>
        <Choice label="Vetro dei comandi" value={st.chrome.tint} onChange={v => edit(s => { s.chrome.tint = v })}
          options={[{ value: 'light', label: 'Chiaro' }, { value: 'dark', label: 'Fumé' }]}
          hint="La barra con Menu, categorie e lingua (si apre scorrendo in su sul menu)." />
        <Toggle label="Istruzioni dei gesti alla prima apertura" value={st.chrome.hints} onChange={v => edit(s => { s.chrome.hints = v })} />
        <Toggle label="Invito a sfogliare (il foglio si solleva da solo)" hint="Non si vede nell'anteprima." value={st.chrome.peek} onChange={v => edit(s => { s.chrome.peek = v })} />
      </>)
      case 'effects': return (<>
        <Slider label="Ombre della pagina che gira" value={st.effects.shadow} min={0} max={1.6} step={0.05} format={pct} onChange={v => edit(s => { s.effects.shadow = v })} />
        <Slider label="Testo che traspare girando la pagina" hint="Sul retro del foglio che gira si intravede il testo a specchio, come nella carta vera."
          value={st.effects.showThrough} min={0} max={0.4} step={0.01} format={v => (v === 0 ? 'Niente' : `${Math.round((v / 0.4) * 100)}%`)}
          onChange={v => edit(s => { s.effects.showThrough = v })} />
        <Slider label="Velocità dello sfoglio" value={st.effects.speed} min={0.6} max={1.6} step={0.05} format={v => (v < 0.85 ? 'Lenta' : v > 1.2 ? 'Rapida' : 'Normale')} onChange={v => edit(s => { s.effects.speed = v })} />
      </>)
    }
  }

  return (
    <div>
      {/* Salvataggio: in alto e sempre visibile (in basso c'è la dock del gestionale). */}
      <div className="sticky top-3 z-30 mb-4 mx-4 sm:mx-0 border border-gray-200 bg-white/90 backdrop-blur shadow-sm" style={{ borderRadius: 18 }}>
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2">
          <span className={`text-sm truncate ${message ? (message.ok ? 'text-green-700' : 'text-red-600') : dirty ? 'text-amber-700' : 'text-gray-500'}`}>
            {message?.text ?? (dirty ? 'Modifiche non salvate' : 'Tutto salvato')}
          </span>
          <div className="flex-1" />
          <button type="button" onClick={() => replaceAll(DEFAULT_STYLE)} className="hidden sm:inline text-sm text-gray-500 hover:text-gray-800 px-3 py-2">
            Stile base
          </button>
          <button type="button" onClick={() => setStyle(saved)} disabled={!dirty} className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 disabled:opacity-40">
            Annulla
          </button>
          <button type="button" onClick={askSave} disabled={!dirty || saving}
            className="text-sm font-medium bg-blue-600 text-white px-4 py-2 disabled:opacity-40 hover:bg-blue-700">
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
        {/* Anteprima */}
        <div className="lg:order-2 lg:sticky lg:top-20 shrink-0 flex flex-col items-center gap-3">
          <PhoneFrame>
            {menuId && (
              <iframe ref={frameRef} title="Anteprima del menu" src={`/prova/${token}?menu=${menuId}&preview=1`}
                className="block border-0" style={{ width: 390, height: 844 }} />
            )}
          </PhoneFrame>
          {menus.length > 1 && (
            <label className="text-xs text-gray-500 flex items-center gap-2">
              Stile del menu
              <select value={menuId} onChange={e => switchMenu(e.target.value)} className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white">
                {menus.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          )}
          <p className="text-xs text-gray-400 text-center max-w-[300px]">Tocca un elemento nell&apos;anteprima per aprire il suo pannello.</p>
        </div>

        {/* Pannelli */}
        <div className="flex-1 min-w-0 space-y-2 px-4 sm:px-0">
          {PANELS.map(p => (
            <section key={p.id} ref={el => { if (el) panelRefs.current.set(p.id, el); else panelRefs.current.delete(p.id) }}
              className={`rounded-xl border bg-white transition-shadow duration-300 scroll-mt-20 ${flash === p.id ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'}`}>
              <button type="button" onClick={() => setOpen(o => (o === p.id ? null : p.id))} aria-expanded={open === p.id}
                className="w-full flex items-center gap-3 text-left px-4 sm:px-5 py-3.5">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-gray-800">{p.title}</span>
                  <span className="block text-[11px] text-gray-400 truncate">{p.sub}</span>
                </span>
                <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden className={`shrink-0 transition-transform ${open === p.id ? 'rotate-180' : ''}`}>
                  <path d="M1 1.5l5 5 5-5" fill="none" stroke="#9ca3af" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {open === p.id && <div className="px-4 sm:px-5 pb-5 pt-4 space-y-4 border-t border-gray-100">{body(p.id)}</div>}
            </section>
          ))}
        </div>
      </div>

      {applyOpen && (
        <ApplySheet menus={menus} current={menuId} saving={saving} onCancel={() => setApplyOpen(false)} onSave={save} />
      )}
    </div>
  )
}

const pct = (v: number) => `${Math.round(v * 100)}%`
const px = (v: number) => `${Math.round(v)} px`
const signedPx = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)} px`
const examplePrice = (st: MenuStyle) => {
  const f = (p: number) => {
    const n = new Intl.NumberFormat('it-IT', { minimumFractionDigits: st.dish.priceDecimals === 'auto' && p % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(p)
    return st.dish.priceSymbol === 'before' ? `€ ${n}` : st.dish.priceSymbol === 'none' ? n : `${n} €`
  }
  return `${f(12)} · ${f(12.5)}`
}
const refColor = (c: ColorRef, sw: { ink: string; soft: string; accent: string }) =>
  c === 'ink' ? sw.ink : c === 'soft' ? sw.soft : c === 'accent' ? sw.accent : c

/** Testo di uno stile come CSS (per campioni e anteprime nel gestionale). */
function cssOf(t: TextStyle, sw: { ink: string; soft: string; accent: string }): React.CSSProperties {
  const f = resolveFace(t.font, t.weight, t.italic)
  return {
    fontFamily: fontStack(t.font), fontWeight: f.weight, fontStyle: f.italic ? 'italic' : 'normal',
    textTransform: t.upper ? 'uppercase' : 'none', letterSpacing: `${t.tracking}em`, color: refColor(t.color, sw),
  }
}

/** Miniatura di uno stile pronto: titolo, categoria, un piatto con prezzo. */
function PresetSample({ st }: { st: MenuStyle }) {
  const sw = { ink: st.page.ink, soft: st.page.soft, accent: st.page.accent }
  const center = st.dish.align === 'center'
  return (
    <div className="rounded-md px-3 py-2.5 overflow-hidden" style={{ background: st.page.paper, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}>
      <div className="truncate text-center" style={{ ...cssOf(st.head.title, sw), fontSize: 17, lineHeight: 1.15 }}>Menu</div>
      <div className="truncate text-center" style={{ ...cssOf(st.category.text, sw), fontSize: Math.min(15, st.category.text.size * 0.75), marginTop: 6, textAlign: st.category.align }}>Antipasti</div>
      <div className="flex items-baseline gap-1.5" style={{ marginTop: 4, justifyContent: center ? 'center' : 'space-between' }}>
        <span className="truncate" style={{ ...cssOf(st.dish.name, sw), fontSize: Math.min(12.5, st.dish.name.size * 0.66) }}>Burrata</span>
        <span className="shrink-0" style={{ ...cssOf(st.dish.price, sw), fontSize: Math.min(12, st.dish.price.size * 0.64) }}>12</span>
      </div>
      <div className="truncate" style={{ ...cssOf(st.dish.description, sw), fontSize: Math.min(11, st.dish.description.size * 0.66), textAlign: center ? 'center' : 'left' }}>con alici e limone</div>
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

interface FieldBase { label: string; hint?: string }

function FieldShell({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <div className="text-xs font-medium text-gray-700 mb-1.5">{label}</div>}
      {children}
      {hint && <div className="text-[11px] text-gray-400 mt-1">{hint}</div>}
    </div>
  )
}

const WEIGHT_LABEL: Record<number, string> = {
  100: 'Sottilissimo', 200: 'Extra sottile', 300: 'Sottile', 400: 'Normale', 500: 'Medio',
  600: 'Semigrassetto', 700: 'Grassetto', 800: 'Extra grassetto', 900: 'Nero',
}

/** Stile completo di un testo: carattere, grandezza, spessore, corsivo,
 *  colore, maiuscolo, spaziatura. Solo facce che esistono davvero. */
function TextStyleField({ label, hint, value, range, swatches, paper, custom, noCase, onChange }: FieldBase & {
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

function FontPicker({ value, custom, onChange }: { value: string; custom: CustomFont[]; onChange: (v: string) => void }) {
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

function ColorRefField({ value, swatches, onChange }: { value: ColorRef; swatches: { ink: string; soft: string; accent: string }; onChange: (c: ColorRef) => void }) {
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

function ColorField({ label, hint, value, onChange }: FieldBase & { value: string; onChange: (v: string) => void }) {
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

function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
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

function Choice<T extends string>({ label, hint, value, options, onChange }: FieldBase & { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <FieldShell label={label} hint={hint}>
      <Segmented value={value} options={options} onChange={onChange} />
    </FieldShell>
  )
}

function Pill({ on, disabled, title, onClick, children }: { on: boolean; disabled?: boolean; title?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-pressed={on}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-35 disabled:cursor-not-allowed ${on ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50/50 text-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
      {children}
    </button>
  )
}

function Slider({ label, hint, value, min, max, step, format, onChange }: FieldBase & { value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <FieldShell label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="flex-1 min-w-0 accent-blue-600" aria-label={label} />
        <span className="text-xs text-gray-600 w-24 shrink-0 text-right tabular-nums">{format(value)}</span>
      </div>
    </FieldShell>
  )
}

function Toggle({ label, hint, value, onChange }: FieldBase & { value: boolean; onChange: (v: boolean) => void }) {
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

const ORNAMENT_LABEL: Record<Ornament, string> = {
  diamond: 'Rombo', star: 'Stella', circle: 'Cerchio', cross: 'Croce', leaf: 'Rametto', flourish: 'Ricciolo',
  asterism: 'Tre stelle', line: 'Linea', double: 'Doppia linea', wave: 'Onda', dots: 'Puntini', none: 'Nessuno',
}

function OrnamentThumb({ kind, accent, paper }: { kind: Ornament; accent: string; paper: string }) {
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

function OrnamentField({ label, value, accent, paper, noNone, onChange }: {
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

const FONT_EXT = ['ttf', 'otf', 'woff', 'woff2']
const MAX_FONT_BYTES = 4 * 1024 * 1024

async function uploadAsset(restaurantId: string, folder: string, file: File, ext: string): Promise<string> {
  const supabase = createClient()
  const path = `${restaurantId}/${folder}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`
  const { data, error } = await supabase.storage.from('restaurant-assets').upload(path, file, { upsert: false, contentType: file.type || undefined })
  if (error || !data) throw new Error(error?.message ?? 'upload')
  return supabase.storage.from('restaurant-assets').getPublicUrl(data.path).data.publicUrl
}

function BackgroundField({ restaurantId, value, paper, onChange }: {
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

function FontsManager({ restaurantId, fonts, onSet, used }: {
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

// ── Salvataggio: a quali menu ────────────────────────────────────────────────

function ApplySheet({ menus, current, saving, onCancel, onSave }: {
  menus:    { id: string; name: string }[]
  current:  string
  saving:   boolean
  onCancel: () => void
  onSave:   (others: string[]) => void
}) {
  const others = menus.filter(m => m.id !== current)
  const [sel, setSel] = useState<string[]>([])
  const all = sel.length === others.length
  const toggle = (id: string) => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <div className="w-full max-w-md bg-white p-5 shadow-xl" style={{ borderRadius: 20 }} onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-900">Dove applicare le modifiche?</h3>
        <p className="text-xs text-gray-500 mt-1">
          Il menu <b>{menus.find(m => m.id === current)?.name}</b> si salva comunque. Agli altri menu scelti arrivano solo le
          modifiche fatte ora: il resto del loro stile resta com&apos;è.
        </p>
        <div className="mt-4 space-y-1">
          <label className="flex items-center gap-3 py-1.5 text-sm font-medium text-gray-800 cursor-pointer">
            <input type="checkbox" checked={all} onChange={() => setSel(all ? [] : others.map(m => m.id))} className="w-4 h-4 accent-blue-600" />
            Tutti i menu
          </label>
          <div className="border-t border-gray-100 pt-1">
            {others.map(m => (
              <label key={m.id} className="flex items-center gap-3 py-1.5 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={sel.includes(m.id)} onChange={() => toggle(m.id)} className="w-4 h-4 accent-blue-600" />
                {m.name}
              </label>
            ))}
          </div>
        </div>
        {all && <p className="text-[11px] text-gray-400 mt-2">Con tutti i menu, questo diventa anche lo stile dei menu che creerai.</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annulla</button>
          <button type="button" onClick={() => onSave(sel)} disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Salvataggio…' : sel.length ? `Salva in ${sel.length + 1} menu` : 'Salva solo questo menu'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Campione di carta (superficie vera, come nel menu) ──────────────────────

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}

function PaperSwatch({ paper, texture, strength, light, ink }: {
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
