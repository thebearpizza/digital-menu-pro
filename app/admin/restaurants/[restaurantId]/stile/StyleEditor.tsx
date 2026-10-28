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
  CUSTOM_PREFIX, DEFAULT_STYLE, FONTS, PAPER_STYLES, PAPER_TEXTURES, TEXTURE_LABEL, parseStyle, registerCustomFonts,
  type MenuStyle, type Ornament, type TextStyle, type Weight,
} from '@/lib/menuStyle'
import type { PickTarget } from '@/app/prova/[token]/typeset'
import { loadCustomFonts } from '@/app/prova/[token]/fonts'
import {
  BackgroundField, Choice, ColorField, FieldShell, FontsManager, GlassControls, OrnamentField, PaperSwatch, PhoneFrame, Slider,
  TextStyleField, Toggle, cssOf, lum, pct, px,
} from './controls'
import { saveMenuMedia, saveMenuStyles, saveMenuText, type MenuTextPages } from './actions'
import TextPageEditor from './TextPageEditor'
import MediaPanel, { type MediaDish } from './MediaPanel'
import type { MediaPage } from '@/lib/menuMedia'
import StyleNav from './StyleNav'

type PanelId =
  | 'presets' | 'paper' | 'fonts' | 'head' | 'runningHead' | 'category' | 'dish' | 'price' | 'description'
  | 'allergens' | 'pageNumber' | 'infoPage' | 'allergenPage' | 'card' | 'chrome' | 'effects' | 'media'

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
  { id: 'infoPage',    title: 'Pagina informativa',   sub: 'Testo, posizione e caratteri' },
  { id: 'allergenPage', title: 'Pagina allergeni',    sub: 'Legenda dei 14 allergeni in fondo al menu' },
  { id: 'media',       title: 'Foto e video',         sub: 'Pagine intere: categorie e promo' },
  { id: 'card',        title: 'Scheda del piatto',    sub: 'Quella che si apre toccando un piatto' },
  { id: 'chrome',      title: 'Comandi e vetro',      sub: 'Barra, categorie, lingua: vetro liquido; aiuti' },
  { id: 'effects',     title: 'Effetto sfoglio',      sub: 'Ombre e velocità della pagina' },
]

// Toccando un elemento nell'anteprima si apre il suo pannello.
const PICK_PANEL: Record<PickTarget, PanelId> = {
  paper: 'paper', restaurant: 'head', title: 'head', runningHead: 'runningHead', category: 'category',
  name: 'dish', price: 'price', description: 'description', allergens: 'allergens', pageNumber: 'pageNumber', text: 'infoPage',
  legend: 'allergenPage', media: 'media',
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
  /** Menu attivi del ristorante, ognuno con il suo stile attuale, le sue
   *  pagine foto/video, categorie e piatti (per collegare le promo). */
  menus:        { id: string; name: string; style: MenuStyle; media: MediaPage[]; categories: string[]; dishes: MediaDish[]; text: MenuTextPages }[]
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
  const styleDirty = useMemo(() => JSON.stringify(style) !== JSON.stringify(saved), [style, saved])
  // Pagine foto/video del menu scelto (si salvano solo per lui).
  const [mediaSavedBy, setMediaSavedBy] = useState<Record<string, MediaPage[]>>(() => Object.fromEntries(menus.map(m => [m.id, m.media])))
  const mediaSaved = useMemo(() => mediaSavedBy[menuId] ?? [], [mediaSavedBy, menuId])
  const [media, setMedia] = useState<MediaPage[]>(mediaSaved)
  const [mediaOpen, setMediaOpen] = useState<string | null>(null)
  const mediaDirty = useMemo(() => JSON.stringify(media) !== JSON.stringify(mediaSaved), [media, mediaSaved])
  // Pagine di testo del menu scelto (si salvano solo per lui).
  const [textSavedBy, setTextSavedBy] = useState<Record<string, MenuTextPages>>(() => Object.fromEntries(menus.map(m => [m.id, m.text])))
  const textSaved = useMemo(() => textSavedBy[menuId] ?? EMPTY_TEXT, [textSavedBy, menuId])
  const [text, setText] = useState<MenuTextPages>(textSaved)
  const textDirty = useMemo(() => JSON.stringify(text) !== JSON.stringify(textSaved), [text, textSaved])
  const dirty = styleDirty || mediaDirty || textDirty
  const current = menus.find(m => m.id === menuId)

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
  useEffect(() => { post({ type: 'lito-media', pages: media, focus: mediaOpen }) }, [media, mediaOpen, post])
  // Pagine di testo: si vedono mentre si scrive; col pannello aperto l'anteprima va lì.
  useEffect(() => {
    post({ type: 'lito-text', pages: text, focus: open === 'infoPage' ? 'info' : open === 'allergenPage' ? 'allergens' : null })
  }, [text, open, post])
  // Pannello della scheda aperto: l'anteprima mostra la scheda di un piatto.
  useEffect(() => { post({ type: 'lito-card', open: open === 'card' }) }, [open, post])
  const live = useRef({ style, open, media, text })
  live.current = { style, open, media, text }
  useEffect(() => {
    let clear = 0
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const msg = e.data as { type?: string; target?: PickTarget }
      if (msg?.type === 'lito-preview-ready') {
        post({ type: 'lito-style', style: live.current.style })
        post({ type: 'lito-media', pages: live.current.media, focus: null })
        post({ type: 'lito-text', pages: live.current.text, focus: null })
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

  /** Salva il menu scelto più gli altri indicati (solo le modifiche fatte);
   *  le pagine foto/video solo del menu scelto. */
  const save = (others: string[]) => startSaving(async () => {
    if (textDirty) {
      const r = await saveMenuText(restaurantId, menuId, text)
      if (!r.ok) { setMessage({ ok: false, text: r.error }); window.setTimeout(() => setMessage(null), 3000); return }
      setTextSavedBy(prev => ({ ...prev, [menuId]: text }))
      if (!styleDirty && !mediaDirty) {
        setMessage({ ok: true, text: 'Pagine di testo salvate.' })
        window.setTimeout(() => setMessage(null), 3000)
        return
      }
    }
    if (mediaDirty) {
      const r = await saveMenuMedia(restaurantId, menuId, media)
      if (!r.ok) { setMessage({ ok: false, text: r.error }); window.setTimeout(() => setMessage(null), 3000); return }
      setMediaSavedBy(prev => ({ ...prev, [menuId]: media }))
      if (!styleDirty) {
        setMessage({ ok: true, text: 'Foto e video salvati.' })
        window.setTimeout(() => setMessage(null), 3000)
        return
      }
    }
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
  // La scelta dei menu a cui applicare riguarda solo lo stile.
  const askSave = () => (menus.length > 1 && styleDirty ? setApplyOpen(true) : save([]))

  /** Cambio del menu da modificare (le modifiche non salvate si perdono). */
  const switchMenu = (id: string) => {
    if (id === menuId) return
    if (dirty && !window.confirm('Le modifiche non salvate a questo menu andranno perse. Continuare?')) return
    setMenuId(id)
    setStyle(savedBy[id] ?? DEFAULT_STYLE)
    setMedia(mediaSavedBy[id] ?? [])
    setMediaOpen(null)
    setText(textSavedBy[id] ?? EMPTY_TEXT)
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
        <Choice label="Categorie nelle pagine" value={st.category.newPage ? 'page' : 'flow'} onChange={v => edit(s => { s.category.newPage = v === 'page' })}
          options={[{ value: 'flow', label: 'Una dopo l\'altra (più categorie per pagina)' }, { value: 'page', label: 'Ogni categoria su una pagina nuova' }]}
          hint={st.category.newPage ? 'Una categoria lunga continua sulle pagine dopo; la successiva parte sempre da una pagina nuova.' : undefined} />
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
      case 'infoPage': return (<>
        <p className="text-[11px] text-gray-400 -mt-1">Vale per il menu scelto in alto. Sta sempre in una sola pagina: se il testo è lungo, caratteri e spazi si riducono quanto basta.</p>
        <Toggle label="Mostra la pagina informativa" value={text.info.enabled} onChange={v => setText(t => ({ ...t, info: { ...t.info, enabled: v } }))} />
        {text.info.enabled && (<>
          <Choice label="Dove" value={text.info.position} onChange={v => setText(t => ({ ...t, info: { ...t.info, position: v } }))}
            options={[{ value: 'first', label: 'All\'inizio, sotto il titolo del menu' }, { value: 'last', label: 'Alla fine, in una pagina sua' }]} />
          <FieldShell label="Testo">
            <TextPageEditor value={text.info.body} onChange={html => setText(t => ({ ...t, info: { ...t.info, body: html } }))} />
          </FieldShell>
          <Sub>Caratteri</Sub>
          {T('Titoli', s => s.textPages.title, [16, 44], 'I sottotitoli sono un po\' più piccoli.')}
          {T('Testo', s => s.textPages.body, [11, 24])}
          <Slider label="Interlinea" value={st.textPages.lineHeight} min={0.85} max={1.4} step={0.01} format={pct} onChange={v => edit(s => { s.textPages.lineHeight = v })} />
          <Slider label="Spazio tra i paragrafi" value={st.textPages.paraGap} min={0} max={30} step={1} format={px} onChange={v => edit(s => { s.textPages.paraGap = v })} />
        </>)}
      </>)
      case 'allergenPage': return (<>
        <p className="text-[11px] text-gray-400 -mt-1">Vale per il menu scelto in alto. L&apos;elenco si crea da solo con i nomi e i numeri degli allergeni del tuo account, tradotto nelle lingue del menu. Sta sempre in una sola pagina.</p>
        <Toggle label="Mostra la pagina allergeni in fondo al menu" value={text.allergen.enabled} onChange={v => setText(t => ({ ...t, allergen: { enabled: v } }))} />
        {text.allergen.enabled && (<>
          <Sub>Caratteri</Sub>
          {T('Nomi degli allergeni', s => s.textPages.legendName, [10, 26])}
          {T('Numeri', s => s.textPages.legendNum, [7, 18], undefined, true)}
          <p className="text-[11px] text-gray-400">Il titolo &quot;Allergeni&quot; usa lo stile delle categorie; la nota sotto il titolo lo stile del testo della pagina informativa.</p>
        </>)}
      </>)
      case 'card': return (<>
        <p className="text-[11px] text-gray-400 -mt-1">L&apos;anteprima mostra la scheda di un piatto finché questo pannello è aperto. I caratteri sono quelli dei piatti.</p>
        <Sub>Foto e testo</Sub>
        <Choice label="Forma della foto" value={st.card.photo} onChange={v => edit(s => { s.card.photo = v })}
          options={[{ value: 'square', label: 'Quadrata' }, { value: 'landscape', label: 'Orizzontale' }, { value: 'portrait', label: 'Verticale' }, { value: 'circle', label: 'Tonda' }]} />
        <Slider label="Larghezza della foto" value={st.card.photoWidth} min={50} max={100} step={1} format={v => `${Math.round(v)}%`} onChange={v => edit(s => { s.card.photoWidth = v })} />
        {st.card.photo !== 'circle' && (
          <Slider label="Angoli della foto" value={st.card.radius} min={0} max={32} step={1} format={px} onChange={v => edit(s => { s.card.radius = v })} />
        )}
        <Slider label="Grandezza del nome" value={st.card.titleSize} min={22} max={48} step={1} format={px} onChange={v => edit(s => { s.card.titleSize = v })} />
        <Toggle label="Categoria sopra il nome" value={st.card.showCategory} onChange={v => edit(s => { s.card.showCategory = v })} />
        <Toggle label="Riquadro prezzo e allergeni" value={st.card.showSummary} onChange={v => edit(s => { s.card.showSummary = v })} />
        <Toggle label="&quot;Altro in …&quot; (altri piatti della categoria)" value={st.card.showMore} onChange={v => edit(s => { s.card.showMore = v })} />

        <Sub>Colori della scheda</Sub>
        <FieldShell label="Colori pronti">
          <div className="flex flex-wrap gap-2">
            {CARD_COLORS(st.page.paper).map(c => {
              const on = st.card.surface === c.surface
              return (
                <button key={c.name} type="button" aria-pressed={on} onClick={() => edit(s => {
                    s.card.surface = c.surface; s.card.box = c.box
                    // Vetro scuro sopra una carta chiara: più pieno, se no diventa grigio.
                    if (c.dark) s.card.glass = Math.min(s.card.glass, 0.2)
                  })}
                  className={`flex items-center gap-2 border px-2.5 py-1.5 text-xs transition ${on ? 'border-blue-600 ring-1 ring-blue-600 text-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`} style={{ borderRadius: 10 }}>
                  <span className="inline-block w-4 h-4 border border-gray-300" style={{ background: c.surface, borderRadius: 5 }} />
                  {c.name}
                </button>
              )
            })}
          </div>
        </FieldShell>
        <ColorField label="Colore del vetro della scheda" value={st.card.surface} onChange={v => edit(s => { s.card.surface = v })} />
        <Slider label="Trasparenza del vetro" value={st.card.glass} min={0} max={1} step={0.05} format={v => (v < 0.15 ? 'Piena' : v > 0.8 ? 'Molto trasparente' : pct(v))} onChange={v => edit(s => { s.card.glass = v })} />
        <Slider label="Velatura a tutto schermo" hint="Allargando la scheda, la parte da &quot;Descrizione&quot; in giù si opacizza per leggere meglio."
          value={st.card.fill} min={0} max={1} step={0.02} format={v => (v < 0.05 ? 'Nessuna' : pct(v))} onChange={v => edit(s => { s.card.fill = v })} />
        <Slider label="Scurimento del menu dietro" value={st.card.dim} min={0} max={0.6} step={0.02} format={v => (v < 0.02 ? 'Nessuno' : pct(v / 0.6))} onChange={v => edit(s => { s.card.dim = v })} />
        <Choice label="Colori del testo" value={st.card.textColors} onChange={v => edit(s => { s.card.textColors = v })}
          options={[{ value: 'menu', label: 'Come il menu' }, { value: 'custom', label: 'Propri della scheda' }]}
          hint={st.card.textColors === 'menu' ? 'Se un colore del menu si leggerebbe male sulla scheda, si usa un testo scuro o chiaro.' : 'Usati così come sono: ogni testo prende il principale, il secondario o l\'accento, come nel menu.'} />
        {st.card.textColors === 'custom' && (
          <div className="grid grid-cols-3 gap-3">
            <ColorField label="Principale" value={st.card.ink} onChange={v => edit(s => { s.card.ink = v })} />
            <ColorField label="Secondario" value={st.card.soft} onChange={v => edit(s => { s.card.soft = v })} />
            <ColorField label="Accento" value={st.card.accent} onChange={v => edit(s => { s.card.accent = v })} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <ColorField label="Colore dei riquadri" hint="Prezzo e allergeni, abbinamento, miniature." value={st.card.box} onChange={v => edit(s => { s.card.box = v })} />
          <Slider label="Intensità dei riquadri" value={st.card.boxOpacity} min={0} max={1} step={0.02} format={v => (v < 0.02 ? 'Invisibili' : pct(v))} onChange={v => edit(s => { s.card.boxOpacity = v })} />
        </div>

        <Sub>Tasti X e freccia</Sub>
        <GlassControls value={st.card.buttons}
          note="Vetro liquido dei tasti in alto nella scheda: piega la foto del piatto quando ci passa sotto. Sui telefoni senza WebGL2 resta il vetro normale."
          onPreset={look => edit(s => { s.card.buttons = { ...look } })}
          onChange={patch => edit(s => { Object.assign(s.card.buttons, patch) })} />
        <Choice label="Colore della X e della freccia" value={st.card.icon === 'auto' ? 'auto' : 'custom'}
          onChange={v => edit(s => { s.card.icon = v === 'auto' ? 'auto' : (s.card.icon === 'auto' ? '#1d1915' : s.card.icon) })}
          options={[{ value: 'auto', label: 'Automatico' }, { value: 'custom', label: 'Scelto' }]}
          hint={st.card.icon === 'auto' ? 'Scuro sul vetro chiaro, bianco sul vetro scuro.' : undefined} />
        {st.card.icon !== 'auto' && <ColorField label="Colore" value={st.card.icon} onChange={v => edit(s => { s.card.icon = v })} />}
      </>)
      case 'chrome': return (<>
        <Choice label="Testo dei comandi" value={st.chrome.tint} onChange={v => edit(s => { s.chrome.tint = v })}
          options={[{ value: 'light', label: 'Scuro (vetro chiaro)' }, { value: 'dark', label: 'Bianco (vetro scuro)' }]}
          hint="La barra con Menu, categorie e lingua si apre scorrendo in su sul menu." />
        <GlassControls value={st.chrome.glass}
          note="Vetro della barra, delle categorie, della bandierina e del suo menu, delle istruzioni dei gesti. Scegliendo un vetro pronto il testo si adatta."
          onPreset={look => edit(s => { s.chrome.glass = { ...look }; s.chrome.tint = lum(look.tint) < 0.4 ? 'dark' : 'light' })}
          onChange={patch => edit(s => { Object.assign(s.chrome.glass, patch) })} />
        <Toggle label="Istruzioni dei gesti alla prima apertura" value={st.chrome.hints} onChange={v => edit(s => { s.chrome.hints = v })} />
        <Toggle label="Invito a sfogliare (il foglio si solleva da solo)" hint="Non si vede nell'anteprima." value={st.chrome.peek} onChange={v => edit(s => { s.chrome.peek = v })} />
      </>)
      case 'media': return (
        <MediaPanel restaurantId={restaurantId} value={media} categories={current?.categories ?? []} dishes={current?.dishes ?? []}
          openId={mediaOpen} onOpen={setMediaOpen} onChange={setMedia} />
      )
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
      <StyleNav restaurantId={restaurantId} active="menu" />
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
          <button type="button" onClick={() => { setStyle(saved); setMedia(mediaSaved); setText(textSaved) }} disabled={!dirty} className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 disabled:opacity-40">
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
            {size => menuId && (
              <iframe ref={frameRef} title="Anteprima del menu" src={`/prova/${token}?menu=${menuId}&preview=1`}
                className="block border-0" style={{ width: size.w, height: size.h }} />
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

const signedPx = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)} px`
const examplePrice = (st: MenuStyle) => {
  const f = (p: number) => {
    const n = new Intl.NumberFormat('it-IT', { minimumFractionDigits: st.dish.priceDecimals === 'auto' && p % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(p)
    return st.dish.priceSymbol === 'before' ? `€ ${n}` : st.dish.priceSymbol === 'none' ? n : `${n} €`
  }
  return `${f(12)} · ${f(12.5)}`
}
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

/** Titoletto di un gruppo di controlli dentro un pannello. */
function Sub({ children }: { children: React.ReactNode }) {
  return <p className="pt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 border-t border-gray-100">{children}</p>
}

/** Colori pronti per la scheda del piatto (vetro e riquadri). */
const CARD_COLORS = (paper: string) => [
  { name: 'Avorio',  surface: '#fffdf9', box: '#ffffff' },
  { name: 'Bianco',  surface: '#ffffff', box: '#ffffff' },
  { name: 'Carta del menu', surface: paper, box: '#ffffff' },
  { name: 'Sabbia',  surface: '#efe4d2', box: '#fffaf1' },
  { name: 'Salvia',  surface: '#e3e8dc', box: '#f8faf4' },
  { name: 'Fumo',    surface: '#2a2622', box: '#4a433c', dark: true },
  { name: 'Notte',   surface: '#141618', box: '#2c3034', dark: true },
]

const EMPTY_TEXT: MenuTextPages = { info: { enabled: false, position: 'first', body: '', align: 'left' }, allergen: { enabled: false } }
