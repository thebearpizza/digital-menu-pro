'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveTheme, createBanner, deleteBanner } from './actions'
import {
  DEFAULT_THEME, SERIF_FONTS, SANS_FONTS, DISPLAY_FONTS, PAGINATION_OPTIONS,
  MENU_BG_EFFECTS, MENU_BG_EFFECT_LABELS,
  googleFontsUrl, allThemeFonts, fontStack, formatPrice,
} from '@/lib/theme'
import type {
  RestaurantTheme, LandingTheme, LandingBackground, MenuTheme, CardTheme,
  MenuBgEffect, PaginationStyle,
} from '@/lib/theme'

const MAX_MEDIA_BYTES = 5 * 1024 * 1024 // 5MB

// ── Poster extraction ─────────────────────────────────────────────────────────

async function extractVideoPoster(file: File): Promise<Blob | null> {
  return new Promise(resolve => {
    const video = document.createElement('video')
    const url   = URL.createObjectURL(file)
    video.src   = url
    video.muted = true
    video.playsInline = true

    const cleanup = () => URL.revokeObjectURL(url)
    const draw = () => {
      try {
        const canvas = document.createElement('canvas')
        const maxW   = 1280
        const ratio  = Math.min(maxW / (video.videoWidth  || maxW), 1)
        canvas.width  = Math.round((video.videoWidth  || 1280) * ratio)
        canvas.height = Math.round((video.videoHeight || 720)  * ratio)
        const ctx = canvas.getContext('2d')
        if (!ctx) { cleanup(); resolve(null); return }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        cleanup()
        canvas.toBlob(b => resolve(b), 'image/jpeg', 0.82)
      } catch { cleanup(); resolve(null) }
    }

    video.addEventListener('loadeddata', draw,                            { once: true })
    video.addEventListener('error',      () => { cleanup(); resolve(null) }, { once: true })
    video.load()
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminBanner {
  id:         string
  media_url:  string | null
  media_type: string
  title:      string | null
  subtitle:   string | null
  sort_order: number
  is_active:  boolean
}

interface Props {
  restaurantId:   string
  restaurantName: string
  restaurantLogo: string | null
  qrToken:        string | null
  initialTheme:   RestaurantTheme
  initialBanners: AdminBanner[]
}

// ── Font loader ───────────────────────────────────────────────────────────────

function usePreviewFonts(theme: RestaurantTheme) {
  const fontsKey = allThemeFonts(theme).join(',')
  useEffect(() => {
    const href = googleFontsUrl(allThemeFonts(theme))
    if (!href) return
    let link = document.querySelector('link[data-admin-preview-fonts]') as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.rel = 'stylesheet'
      link.setAttribute('data-admin-preview-fonts', '1')
      document.head.appendChild(link)
    }
    link.href = href
  }, [fontsKey]) // eslint-disable-line react-hooks/exhaustive-deps
}

// ── UI Atoms ──────────────────────────────────────────────────────────────────

function Accordion({ title, defaultOpen = false, children }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-100">
      <button type="button"
        className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}>
        {title}
        <span className="text-gray-300 text-lg leading-none">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-4 pb-4 pt-2 space-y-3">{children}</div>}
    </div>
  )
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs text-gray-600 min-w-0 flex-1">{label}</label>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-gray-400 font-mono w-16 text-right">{value.slice(0, 7)}</span>
        <div className="relative w-8 h-8 border border-gray-200 overflow-hidden rounded-sm">
          <input type="color" value={value.startsWith('#') && value.length >= 7 ? value.slice(0,7) : '#888888'}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 w-[150%] h-[150%] -top-1 -left-1 cursor-pointer border-0 p-0 bg-transparent" />
        </div>
      </div>
    </div>
  )
}

function PillGroup<T extends string>({
  options, value, onChange,
}: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs border transition-colors ${
            value === o.value
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function FontSelector({ label, value, curated, category, onChange }: {
  label: string; value: string; curated: string[]; category: 'serif' | 'sans'; onChange: (v: string) => void
}) {
  const isCustom = !curated.includes(value)
  const [customMode, setCustomMode] = useState(isCustom)
  const [customVal,  setCustomVal]  = useState(isCustom ? value : '')

  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      {!customMode ? (
        <select value={value}
          onChange={e => { if (e.target.value === '__custom__') { setCustomMode(true); return } onChange(e.target.value) }}
          className="w-full px-2 py-1.5 border border-gray-200 text-xs bg-white focus:outline-none focus:border-gray-400">
          {curated.map(f => <option key={f} value={f}>{f}</option>)}
          <option value="__custom__">Altro Google Font…</option>
        </select>
      ) : (
        <div className="flex gap-1">
          <input type="text" value={customVal} onChange={e => setCustomVal(e.target.value)}
            placeholder="es. Abril Fatface"
            className="flex-1 px-2 py-1.5 border border-gray-200 text-xs focus:outline-none focus:border-gray-400"
            onBlur={() => { if (customVal.trim()) onChange(customVal.trim()) }}
            onKeyDown={e => { if (e.key === 'Enter' && customVal.trim()) onChange(customVal.trim()) }} />
          <button type="button" onClick={() => { setCustomMode(false); onChange(curated[0]) }}
            className="text-[10px] text-gray-400 hover:text-gray-600 px-1">&#x2715;</button>
        </div>
      )}
      <p className="mt-1 text-[11px]" style={{ fontFamily: fontStack(value, category), color: '#888' }}>
        {value} — Il tuo menù in questo font
      </p>
    </div>
  )
}

function FontSizeSlider({ label, value, min, max, step, previewFont, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  previewFont: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs text-gray-600">{label}</label>
        <span className="text-[10px] font-mono text-gray-400">{value.toFixed(2)}rem</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-gray-900" />
      <p className="mt-0.5 overflow-hidden text-nowrap"
        style={{ fontSize: `${value}rem`, fontFamily: previewFont, color: '#999', lineHeight: 1.2 }}>
        Testo di esempio
      </p>
    </div>
  )
}

// ── iOS-style toggle ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        disabled ? 'bg-gray-200 cursor-not-allowed' : checked ? 'bg-gray-900' : 'bg-gray-300'
      }`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

// ── Editor target registry ────────────────────────────────────────────────────

const EDITOR_TARGETS: Record<string, { title: string; hint: string }> = {
  'landing-bg':        { title: 'Sfondo Landing',     hint: 'Tipo, immagine, video, colore, texture, opacità' },
  'landing-logo':      { title: 'Logo',               hint: 'Dimensione, blend mode' },
  'landing-title':     { title: 'Nome Ristorante',    hint: 'Font, colore, dimensione, peso' },
  'landing-desc':      { title: 'Slogan',             hint: 'Font, colore, dimensione' },
  'landing-buttons':   { title: 'Bottoni Menu',       hint: 'Colori, bordo, font, forma' },
  'landing-socials':   { title: 'Social & Accento',   hint: 'Colore accento, icone social, dimensione' },
  'dish-title':        { title: 'Titolo Piatto',      hint: 'Font, colore, dimensione' },
  'dish-description':  { title: 'Descrizione Piatto', hint: 'Font, colore, dimensione' },
  'dish-price':        { title: 'Prezzo',             hint: 'Font, colore, formato' },
  'category-title':    { title: 'Titolo Categoria',   hint: 'Font, colore, dimensione, allineamento' },
  'background-layout': { title: 'Sfondo & Layout',    hint: 'Sfondo menu, paginazione, spaziatura' },
}

// ── Editor sidebar placeholder (Step 3 will fill with real controls) ──────────

function EditorSidebar({ target, onClose }: { target: string; onClose: () => void }) {
  const info = EDITOR_TARGETS[target]
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <div>
          <p className="text-xs font-semibold text-gray-800">{info?.title ?? target}</p>
          {info?.hint && <p className="text-[10px] text-gray-400 mt-0.5">{info.hint}</p>}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none w-7 h-7 flex items-center justify-center">&#xD7;</button>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <p className="text-xs text-gray-400">Controlli in arrivo (Step 3)</p>
      </div>
    </div>
  )
}

// ── Live preview iframe ───────────────────────────────────────────────────────

function LivePreview({ qrToken, theme, previewMode, editMode = false, showDummyData = false, onElementClick }: {
  qrToken: string | null; theme: RestaurantTheme; previewMode: 'landing' | 'menu' | 'card'
  editMode?: boolean; showDummyData?: boolean; onElementClick?: (target: string) => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const readyRef  = useRef(false)

  function post(msg: object) {
    iframeRef.current?.contentWindow?.postMessage(msg, window.location.origin)
  }

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'dmp-preview-ready') {
        readyRef.current = true
        post({ type: 'dmp-theme', theme })
        post({ type: 'dmp-nav', view: previewMode === 'card' ? 'menu' : previewMode })
        post({ type: 'dmp-editor-state', editMode, showDummyData })
      }
      if (e.data?.type === 'dmp-element-clicked' && e.data.target) {
        onElementClick?.(e.data.target)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [theme, previewMode, editMode, showDummyData]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!readyRef.current) return
    const id = setTimeout(() => post({ type: 'dmp-theme', theme }), 150)
    return () => clearTimeout(id)
  }, [theme]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!readyRef.current) return
    post({ type: 'dmp-nav', view: previewMode === 'card' ? 'menu' : previewMode })
  }, [previewMode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!readyRef.current) return
    post({ type: 'dmp-editor-state', editMode, showDummyData })
  }, [editMode, showDummyData]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!qrToken) {
    return (
      <div className="w-full h-full flex items-center justify-center text-center px-6">
        <p className="text-xs text-gray-400">
          Anteprima non disponibile: questo ristorante non ha ancora un token QR pubblico.
        </p>
      </div>
    )
  }

  return (
    <div className="relative mx-auto h-full" style={{ aspectRatio: '9/19.5', maxWidth: '100%' }}>
      <div className="absolute inset-0 rounded-[2rem] overflow-hidden border border-gray-300 shadow-xl bg-black">
        <iframe
          ref={iframeRef}
          title="Anteprima menu"
          src={`/m/${qrToken}?preview=1`}
          className="w-full h-full border-0"
          style={{ pointerEvents: editMode ? 'none' : 'auto' }}
        />
      </div>
    </div>
  )
}

// ── Banner Manager ────────────────────────────────────────────────────────────

function BannerManager({ restaurantId, initialBanners }: { restaurantId: string; initialBanners: AdminBanner[] }) {
  const [banners, setBanners]       = useState<AdminBanner[]>(initialBanners)
  const [uploading, setUploading]   = useState(false)
  const [newTitle,    setNewTitle]    = useState('')
  const [newSubtitle, setNewSubtitle] = useState('')
  const [error, setError]           = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleAdd() {
    if (!fileRef.current?.files?.[0]) { setError('Seleziona un file.'); return }
    const file = fileRef.current.files[0]
    if (file.size > MAX_MEDIA_BYTES) { setError('File troppo grande (max 5MB).'); return }
    setUploading(true); setError(null)
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${restaurantId}/banners/${Date.now()}.${ext}`
    const { data: up, error: upErr } = await supabase.storage
      .from('restaurant-assets').upload(path, file, { upsert: false })
    if (upErr || !up) { setError('Upload: ' + upErr?.message); setUploading(false); return }
    const { data: pub } = supabase.storage.from('restaurant-assets').getPublicUrl(up.path)
    try {
      const b = await createBanner(restaurantId, {
        media_url:  pub.publicUrl,
        media_type: file.type.startsWith('video/') ? 'video' : 'image',
        title:      newTitle.trim()    || undefined,
        subtitle:   newSubtitle.trim() || undefined,
        sort_order: banners.length,
      })
      setBanners(prev => [...prev, { ...b, is_active: true }])
      setNewTitle(''); setNewSubtitle('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Errore nella creazione.')
    } finally { setUploading(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questo banner?')) return
    try { await deleteBanner(restaurantId, id); setBanners(prev => prev.filter(b => b.id !== id)) }
    catch (e: unknown) { setError((e as Error).message) }
  }

  return (
    <div className="space-y-3">
      {banners.length === 0 && <p className="text-xs text-gray-400">Nessun banner. Aggiungine uno sotto.</p>}
      {banners.map(b => (
        <div key={b.id} className="flex items-center gap-3 p-2 border border-gray-100">
          {b.media_url && <img src={b.media_url} alt="" className="w-16 h-10 object-cover shrink-0 border border-gray-100" />}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate">{b.title || '(nessun titolo)'}</p>
            {b.subtitle && <p className="text-[10px] text-gray-400 truncate">{b.subtitle}</p>}
          </div>
          <button type="button" onClick={() => handleDelete(b.id)}
            className="text-red-400 hover:text-red-600 text-xs shrink-0 transition-colors">Elimina</button>
        </div>
      ))}
      <div className="border border-gray-100 p-3 bg-gray-50 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">+ Nuovo banner</p>
        <input ref={fileRef} type="file" accept="image/*,video/*"
          className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50 cursor-pointer" />
        <input type="text" placeholder="Titolo (opzionale)" value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-200 text-xs focus:outline-none focus:border-gray-400 bg-white" />
        <input type="text" placeholder="Sottotitolo (opzionale)" value={newSubtitle}
          onChange={e => setNewSubtitle(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-200 text-xs focus:outline-none focus:border-gray-400 bg-white" />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button type="button" onClick={handleAdd} disabled={uploading}
          className="bg-gray-800 text-white text-xs px-4 py-1.5 hover:bg-gray-600 disabled:opacity-50 transition-colors">
          {uploading ? 'Caricamento…' : '+ Aggiungi'}
        </button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CustomizationClient({
  restaurantId, qrToken, initialTheme, initialBanners,
}: Props) {
  const [theme,        setTheme]        = useState<RestaurantTheme>(initialTheme)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [bgUploading,  setBgUploading]  = useState(false)
  const [vidUploading, setVidUploading] = useState(false)
  const [previewMode,  setPreviewMode]  = useState<'landing' | 'menu' | 'card'>('landing')
  const [editMode,     setEditMode]     = useState(false)
  const [showDummyData,setShowDummyData]= useState(false)
  const [activeEditor, setActiveEditor] = useState<string | null>(null)

  useEffect(() => { if (!editMode) { setActiveEditor(null); setShowDummyData(false) } }, [editMode])

  usePreviewFonts(theme)

  // ── Typed patch helpers ──────────────────────────────────────────────────────

  function setL(patch: Partial<LandingTheme>) {
    setSaved(false); setTheme(t => ({ ...t, landing: { ...t.landing, ...patch } }))
  }
  function setM(patch: Partial<MenuTheme>) {
    setSaved(false); setTheme(t => ({ ...t, menu: { ...t.menu, ...patch } }))
  }
  function setC(patch: Partial<CardTheme>) {
    setSaved(false); setTheme(t => ({ ...t, card: { ...t.card, ...patch } }))
  }
  function setCardTitle(patch: Partial<CardTheme['title']>) {
    setSaved(false); setTheme(t => ({ ...t, card: { ...t.card, title: { ...t.card.title, ...patch } } }))
  }
  function setCardDesc(patch: Partial<CardTheme['description']>) {
    setSaved(false); setTheme(t => ({ ...t, card: { ...t.card, description: { ...t.card.description, ...patch } } }))
  }
  function setCardPrice(patch: Partial<CardTheme['price']>) {
    setSaved(false); setTheme(t => ({ ...t, card: { ...t.card, price: { ...t.card.price, ...patch } } }))
  }
  function setCardAllergens(patch: Partial<CardTheme['allergens']>) {
    setSaved(false); setTheme(t => ({ ...t, card: { ...t.card, allergens: { ...t.card.allergens, ...patch } } }))
  }
  function setCardClose(patch: Partial<CardTheme['closeButton']>) {
    setSaved(false); setTheme(t => ({ ...t, card: { ...t.card, closeButton: { ...t.card.closeButton, ...patch } } }))
  }
  function setLBg(patch: Partial<LandingBackground>) {
    setSaved(false); setTheme(t => ({ ...t, landing: { ...t.landing, background: { ...t.landing.background, ...patch } } }))
  }
  function setLLogo(patch: Partial<LandingTheme['logo']>) {
    setSaved(false); setTheme(t => ({ ...t, landing: { ...t.landing, logo: { ...t.landing.logo, ...patch } } }))
  }
  function setLTitle(patch: Partial<LandingTheme['title']>) {
    setSaved(false); setTheme(t => ({ ...t, landing: { ...t.landing, title: { ...t.landing.title, ...patch } } }))
  }
  function setLDesc(patch: Partial<LandingTheme['description']>) {
    setSaved(false); setTheme(t => ({ ...t, landing: { ...t.landing, description: { ...t.landing.description, ...patch } } }))
  }
  function setLBu(patch: Partial<LandingTheme['buttons']>) {
    setSaved(false); setTheme(t => ({ ...t, landing: { ...t.landing, buttons: { ...t.landing.buttons, ...patch } } }))
  }
  function setMLayout(patch: Partial<MenuTheme['layout']>) {
    setSaved(false); setTheme(t => ({ ...t, menu: { ...t.menu, layout: { ...t.menu.layout, ...patch } } }))
  }
  function setMDivider(patch: Partial<MenuTheme['layout']['divider']>) {
    setSaved(false); setTheme(t => ({ ...t, menu: { ...t.menu, layout: { ...t.menu.layout, divider: { ...t.menu.layout.divider, ...patch } } } }))
  }
  function setMDishes(patch: Partial<MenuTheme['dishes']>) {
    setSaved(false); setTheme(t => ({ ...t, menu: { ...t.menu, dishes: { ...t.menu.dishes, ...patch } } }))
  }
  function setMDescs(patch: Partial<MenuTheme['descriptions']>) {
    setSaved(false); setTheme(t => ({ ...t, menu: { ...t.menu, descriptions: { ...t.menu.descriptions, ...patch } } }))
  }
  function setMAllergens(patch: Partial<MenuTheme['allergens']>) {
    setSaved(false); setTheme(t => ({ ...t, menu: { ...t.menu, allergens: { ...t.menu.allergens, ...patch } } }))
  }
  function setMPrices(patch: Partial<MenuTheme['prices']>) {
    setSaved(false); setTheme(t => ({ ...t, menu: { ...t.menu, prices: { ...t.menu.prices, ...patch } } }))
  }
  function setMCats(patch: Partial<MenuTheme['categories']>) {
    setSaved(false); setTheme(t => ({ ...t, menu: { ...t.menu, categories: { ...t.menu.categories, ...patch } } }))
  }
  function setMSticky(patch: Partial<MenuTheme['stickyCategories']>) {
    setSaved(false); setTheme(t => ({ ...t, menu: { ...t.menu, stickyCategories: { ...t.menu.stickyCategories, ...patch } } }))
  }
  function setMNav(patch: Partial<MenuTheme['navigation']>) {
    setSaved(false); setTheme(t => ({ ...t, menu: { ...t.menu, navigation: { ...t.menu.navigation, ...patch } } }))
  }
  function setMBg(patch: Partial<MenuTheme['background']>) {
    setSaved(false); setTheme(t => ({ ...t, menu: { ...t.menu, background: { ...t.menu.background, ...patch } } }))
  }

  // ── Upload handlers ──────────────────────────────────────────────────────────

  async function handleBgUpload(file: File) {
    if (file.size > MAX_MEDIA_BYTES) { setError('Immagine troppo grande (max 5MB).'); return }
    setBgUploading(true); setError(null)
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${restaurantId}/theme-bg.${ext}`
    const { data, error: err } = await supabase.storage
      .from('restaurant-assets').upload(path, file, { upsert: true })
    if (!err && data) {
      const { data: pub } = supabase.storage.from('restaurant-assets').getPublicUrl(data.path)
      setLBg({ type: 'image', value: `${pub.publicUrl}?v=${Date.now()}` })
    } else if (err) setError('Upload: ' + err.message)
    setBgUploading(false)
  }

  async function handleVideoUpload(file: File) {
    if (file.size > MAX_MEDIA_BYTES) { setError('Video troppo grande (max 5MB).'); return }
    setVidUploading(true); setError(null)
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'mp4'
    const path = `${restaurantId}/theme-video.${ext}`

    const [{ data, error: err }, posterBlob] = await Promise.all([
      supabase.storage.from('restaurant-assets').upload(path, file, { upsert: true }),
      extractVideoPoster(file),
    ])

    if (err || !data) { setError('Upload: ' + err?.message); setVidUploading(false); return }

    const { data: pub } = supabase.storage.from('restaurant-assets').getPublicUrl(data.path)
    const ts       = Date.now()
    const videoUrl = `${pub.publicUrl}?v=${ts}`

    let posterUrl: string | undefined
    if (posterBlob) {
      const posterPath = `${restaurantId}/theme-video-poster.jpg`
      const { data: pUp } = await supabase.storage
        .from('restaurant-assets')
        .upload(posterPath, posterBlob, { upsert: true, contentType: 'image/jpeg' })
      if (pUp) {
        const { data: pPub } = supabase.storage.from('restaurant-assets').getPublicUrl(pUp.path)
        posterUrl = `${pPub.publicUrl}?v=${ts}`
      }
    }

    setLBg({ type: 'video', value: videoUrl, poster: posterUrl })
    setVidUploading(false)
  }

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false)
    try { await saveTheme(restaurantId, theme as unknown as object); setSaved(true) }
    catch (e: unknown) { setError((e as Error).message ?? 'Errore.') }
    finally { setSaving(false) }
  }

  // ── Derived values (used by Step 3 sidebar controls) ─────────────────────────

  const l    = theme.landing
  const m    = theme.menu
  const SERIF_STACK = fontStack(l.title.font,   'serif')
  const SANS_STACK  = fontStack(l.buttons.font, 'sans')
  // Keep these to prevent TS "unused variable" warnings until Step 3.
  void m; void SERIF_STACK; void SANS_STACK; void setL; void setM; void setC
  void setCardTitle; void setCardDesc; void setCardPrice; void setCardAllergens; void setCardClose
  void setLBg; void setLLogo; void setLTitle; void setLDesc; void setLBu
  void setMLayout; void setMDivider; void setMDishes; void setMDescs; void setMAllergens
  void setMPrices; void setMCats; void setMSticky; void setMNav; void setMBg
  void handleBgUpload; void handleVideoUpload; void bgUploading; void vidUploading

  const sidebarOpen = editMode && activeEditor !== null


  return (
    /* The outer div uses an absolute viewport height calculation so the preview
       fills the screen without relying on the ancestor chain. The vertical offset
       accounts for: AdminShell padding (64px) + RestaurantLayout padding + title (48px)
       + breadcrumb (32px) + TabNav (44px) + control-bar (52px) ≈ 270px total.     */
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 270px)', minHeight: 480 }}>

      {/* ── Control bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3 pb-3 mb-3 border-b border-gray-100 flex-wrap shrink-0">

        {/* Mode tabs */}
        {(['landing', 'menu', 'card'] as const).map(mode => (
          <button key={mode} type="button" onClick={() => setPreviewMode(mode)}
            className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider border transition-colors ${
              previewMode === mode
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}>
            {mode === 'landing' ? 'Landing' : mode === 'menu' ? 'Menu' : 'Card'}
          </button>
        ))}

        <div className="hidden sm:block w-px h-5 bg-gray-200 mx-1 shrink-0" />

        {/* Pencil toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Toggle checked={editMode} onChange={setEditMode} />
          <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            <span className="hidden sm:inline">Modifica</span>
          </span>
        </label>

        {/* Dummy data checkbox — only enabled in edit mode */}
        <label className={`flex items-center gap-1.5 select-none text-xs ${editMode ? 'cursor-pointer text-gray-600' : 'cursor-not-allowed text-gray-300'}`}>
          <input type="checkbox" disabled={!editMode} checked={showDummyData}
            onChange={e => setShowDummyData(e.target.checked)}
            className="accent-gray-900 w-3.5 h-3.5" />
          <span className="hidden sm:inline">Dati fittizi</span>
          <span className="sm:hidden">Fittizi</span>
        </label>

        {editMode && (
          <span className="hidden md:inline ml-1 text-[10px] text-gray-400">
            {activeEditor ? `Modifica: ${EDITOR_TARGETS[activeEditor]?.title ?? activeEditor}` : 'Clicca un elemento per modificarlo'}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status + save */}
        {saved  && <span className="text-xs text-green-600 shrink-0">Salvato</span>}
        {error  && <span className="text-xs text-red-500 truncate max-w-[120px] shrink-0">{error}</span>}
        <button type="button"
          onClick={() => { if (confirm('Ripristinare il tema predefinito?')) { setTheme(DEFAULT_THEME); setSaved(false) } }}
          className="hidden sm:inline text-[10px] text-gray-400 hover:text-gray-600 shrink-0">
          Ripristina
        </button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="bg-gray-900 text-white text-xs font-medium px-4 py-2 hover:bg-gray-700 disabled:opacity-50 transition-colors shrink-0">
          {saving ? '…' : 'Salva'}
        </button>
      </div>

      {/* ── Main: preview + contextual sidebar ─────────────────────────── */}
      <div className="flex-1 flex min-h-0 rounded-lg overflow-hidden border border-gray-200">

        {/* Preview — flex-1 so it shrinks proportionally when the sidebar opens */}
        <div className="flex-1 min-w-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 transition-all duration-300 ease-out p-4 sm:p-6">
          <LivePreview
            qrToken={qrToken} theme={theme} previewMode={previewMode}
            editMode={editMode} showDummyData={showDummyData}
            onElementClick={setActiveEditor}
          />
        </div>

        {/* Desktop contextual sidebar — width animates 0 ↔ 340px, phone mockup scales */}
        <aside
          className="shrink-0 bg-white border-l border-gray-200 overflow-hidden transition-all duration-300 ease-out hidden md:block"
          style={{ width: sidebarOpen ? 340 : 0 }}>
          {sidebarOpen && (
            <EditorSidebar target={activeEditor!} onClose={() => setActiveEditor(null)} />
          )}
        </aside>
      </div>

      {/* ── Mobile bottom sheet — slides up when an element is selected ── */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div className="md:hidden fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
            onClick={() => setActiveEditor(null)} />
          {/* Sheet */}
          <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-2xl"
            style={{ maxHeight: '65dvh' }}>
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-9 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(65dvh - 20px)' }}>
              <EditorSidebar target={activeEditor!} onClose={() => setActiveEditor(null)} />
            </div>
          </div>
        </>
      )}

    </div>
  )
}
