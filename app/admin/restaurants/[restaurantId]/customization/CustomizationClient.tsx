'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveTheme, createBanner, deleteBanner } from './actions'
import {
  DEFAULT_THEME, SERIF_FONTS, SANS_FONTS, PAGINATION_OPTIONS,
  MENU_BG_EFFECTS, MENU_BG_EFFECT_LABELS,
  googleFontsUrl, allThemeFonts, fontStack, formatPrice,
} from '@/lib/theme'
import type {
  RestaurantTheme, LandingTheme, LandingBackground, MenuTheme,
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
            className="text-[10px] text-gray-400 hover:text-gray-600 px-1">✕</button>
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

// ── Live preview iframe ───────────────────────────────────────────────────────

function LivePreview({ qrToken, theme, previewMode }: {
  qrToken: string | null; theme: RestaurantTheme; previewMode: 'landing' | 'menu'
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
        post({ type: 'dmp-nav', view: previewMode })
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [theme, previewMode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!readyRef.current) return
    const id = setTimeout(() => post({ type: 'dmp-theme', theme }), 150)
    return () => clearTimeout(id)
  }, [theme]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!readyRef.current) return
    post({ type: 'dmp-nav', view: previewMode })
  }, [previewMode]) // eslint-disable-line react-hooks/exhaustive-deps

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
    } catch (e: any) {
      setError(e.message ?? 'Errore nella creazione.')
    } finally { setUploading(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questo banner?')) return
    try { await deleteBanner(restaurantId, id); setBanners(prev => prev.filter(b => b.id !== id)) }
    catch (e: any) { setError(e.message) }
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
  const [previewMode,  setPreviewMode]  = useState<'landing' | 'menu'>('landing')
  const [previewOpen,  setPreviewOpen]  = useState(false)

  usePreviewFonts(theme)

  // ── Typed patch helpers ──────────────────────────────────────────────────────

  function setL(patch: Partial<LandingTheme>) {
    setSaved(false); setTheme(t => ({ ...t, landing: { ...t.landing, ...patch } }))
  }
  function setM(patch: Partial<MenuTheme>) {
    setSaved(false); setTheme(t => ({ ...t, menu: { ...t.menu, ...patch } }))
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
    catch (e: any) { setError(e.message ?? 'Errore.') }
    finally { setSaving(false) }
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const l    = theme.landing
  const m    = theme.menu
  const SERIF_STACK = fontStack(l.title.font,   'serif')
  const SANS_STACK  = fontStack(l.buttons.font, 'sans')

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Personalizzazione</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Anteprima dal vivo a destra. Le modifiche si applicano dopo il salvataggio.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-600">Salvato.</span>}
          {error && <span className="text-xs text-red-500 max-w-[200px] truncate">{error}</span>}
          <button type="button"
            onClick={() => { if (confirm('Ripristinare il tema predefinito?')) { setTheme(DEFAULT_THEME); setSaved(false) } }}
            className="text-xs text-gray-400 hover:text-gray-600">
            Ripristina
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="bg-gray-900 text-white text-xs font-medium px-4 py-2 hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {saving ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </div>
      </div>

      {/* ── Mode toggle ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6">
        {(['landing', 'menu'] as const).map(mode => (
          <button key={mode} type="button" onClick={() => setPreviewMode(mode)}
            className={`px-4 py-2 text-[10px] font-semibold uppercase tracking-wider border transition-colors ${
              previewMode === mode
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}>
            {mode === 'landing' ? '↙ Landing' : '↗ Menù'}
          </button>
        ))}
        <span className="ml-2 text-[10px] text-gray-400 self-center hidden sm:inline">
          {previewMode === 'landing' ? 'Schermata di benvenuto clienti' : 'Pagine menù e piatti'}
        </span>
      </div>

      {/* ── 30/70 grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 items-start">

        {/* ── Controls ───────────────────────────────────────────────────── */}
        <div className="space-y-2 lg:pr-2">

          {previewMode === 'landing' ? (
            <>
              {/* ── LANDING: Sfondo ── */}
              <Accordion title="Sfondo landing" defaultOpen>
                <div>
                  <p className="text-xs text-gray-600 mb-2">Tipo</p>
                  <PillGroup options={[
                    { label: 'Colore',    value: 'color' as const },
                    { label: 'Immagine',  value: 'image' as const },
                    { label: 'Video',     value: 'video' as const },
                  ]} value={l.background.type} onChange={v => setLBg({ type: v })} />
                </div>

                {l.background.type === 'color' && (
                  <ColorRow label="Colore sfondo" value={l.background.value} onChange={v => setLBg({ value: v })} />
                )}

                {l.background.type === 'image' && (
                  <>
                    {l.background.value && l.background.value.startsWith('http') && (
                      <div className="relative inline-block">
                        <img src={l.background.value} alt="Sfondo" className="w-24 h-16 object-cover border border-gray-200" />
                        <button type="button"
                          onClick={() => setLBg({ type: 'color', value: '#0d0d0d' })}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">×</button>
                      </div>
                    )}
                    <input type="file" accept="image/*"
                      onChange={e => e.target.files?.[0] && handleBgUpload(e.target.files[0])}
                      className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50 cursor-pointer" />
                    {bgUploading && <p className="text-xs text-gray-400">Caricamento…</p>}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Opacità overlay: <span className="font-medium text-gray-700">{l.background.opacity}%</span>
                      </label>
                      <input type="range" min={5} max={100} step={5} value={l.background.opacity}
                        onChange={e => setLBg({ opacity: Number(e.target.value) })}
                        className="w-full accent-gray-900" />
                    </div>
                  </>
                )}

                {l.background.type === 'video' && (
                  <>
                    {l.background.value && l.background.value.startsWith('http') && (
                      <div className="relative inline-block">
                        {l.background.poster
                          ? <img src={l.background.poster} alt="" className="w-32 h-20 object-cover border border-gray-200" />
                          : <video src={l.background.value} muted className="w-32 h-20 object-cover border border-gray-200 bg-black" />
                        }
                        <button type="button"
                          onClick={() => setLBg({ type: 'color', value: '#0d0d0d', poster: undefined })}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">×</button>
                      </div>
                    )}
                    <input type="file" accept="video/*"
                      onChange={e => e.target.files?.[0] && handleVideoUpload(e.target.files[0])}
                      className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50 cursor-pointer" />
                    {vidUploading && <p className="text-xs text-gray-400">Caricamento e estrazione poster…</p>}
                    <p className="text-[10px] text-gray-400">Max 5MB. MP4/WebM consigliati.</p>
                    <label className={`flex items-start gap-2 pt-2 border-t border-gray-50 ${l.background.value ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                      <input type="checkbox" disabled={!l.background.value}
                        checked={l.background.immersiveTransition}
                        onChange={e => setLBg({ immersiveTransition: e.target.checked })}
                        className="mt-0.5 accent-gray-900" />
                      <span className="text-xs text-gray-600">
                        Transizione immersiva
                        <span className="block text-[10px] text-gray-400">
                          Al tap su un menù la UI svanisce, il video parte e al termine si apre il menù.
                        </span>
                      </span>
                    </label>
                  </>
                )}

                <div>
                  <p className="text-xs text-gray-600 mb-2">Texture overlay</p>
                  <PillGroup options={[
                    { label: 'Nessuna', value: 'none'  as const },
                    { label: 'Rumore', value: 'noise' as const },
                    { label: 'Grana',  value: 'grain' as const },
                    { label: 'Marmo',  value: 'marble' as const },
                  ]} value={l.background.texture} onChange={v => setLBg({ texture: v })} />
                </div>
              </Accordion>

              {/* ── LANDING: Accento ── */}
              <Accordion title="Accento & Social" defaultOpen>
                <ColorRow label="Colore accento (bottoni, bordi)" value={l.accent}        onChange={v => setL({ accent: v })} />
                <ColorRow label="Icone social"                     value={l.socials.color} onChange={v => setL({ socials: { color: v } })} />
              </Accordion>

              {/* ── LANDING: Logo ── */}
              <Accordion title="Logo">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-gray-600">Dimensione logo</label>
                    <span className="text-[10px] font-mono text-gray-400">{l.logo.size.toFixed(1)}rem</span>
                  </div>
                  <input type="range" min={1.5} max={8} step={0.5} value={l.logo.size}
                    onChange={e => setLLogo({ size: Number(e.target.value) })}
                    className="w-full accent-gray-900" />
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-2">Blend mode logo</p>
                  <PillGroup options={[
                    { label: 'Normale',   value: 'normal'   as const },
                    { label: 'Moltiplica', value: 'multiply' as const },
                    { label: 'Screen',    value: 'screen'   as const },
                  ]} value={l.logo.mixBlend} onChange={v => setLLogo({ mixBlend: v })} />
                  <p className="text-[10px] text-gray-400 mt-1">
                    {l.logo.mixBlend === 'multiply' ? 'Rimuove lo sfondo bianco del logo.' :
                     l.logo.mixBlend === 'screen'   ? 'Rimuove lo sfondo scuro del logo.' :
                                                      'Logo con sfondo opaco.'}
                  </p>
                </div>
              </Accordion>

              {/* ── LANDING: Titolo ── */}
              <Accordion title="Titolo ristorante">
                <FontSelector label="Font" value={l.title.font} curated={SERIF_FONTS} category="serif"
                  onChange={v => setLTitle({ font: v })} />
                <FontSizeSlider label="Dimensione" value={l.title.size} min={1.0} max={4.0} step={0.1}
                  previewFont={SERIF_STACK} onChange={v => setLTitle({ size: v })} />
                <ColorRow label="Colore" value={l.title.color} onChange={v => setLTitle({ color: v })} />
                <div>
                  <p className="text-xs text-gray-600 mb-2">Peso</p>
                  <PillGroup options={[
                    { label: 'Light',    value: 'light'  as const },
                    { label: 'Normale',  value: 'normal' as const },
                    { label: 'Grassetto', value: 'bold'  as const },
                  ]} value={l.title.weight} onChange={v => setLTitle({ weight: v })} />
                </div>
              </Accordion>

              {/* ── LANDING: Descrizione ── */}
              <Accordion title="Descrizione / Slogan">
                <FontSelector label="Font" value={l.description.font} curated={SANS_FONTS} category="sans"
                  onChange={v => setLDesc({ font: v })} />
                <FontSizeSlider label="Dimensione" value={l.description.size} min={0.4} max={1.2} step={0.05}
                  previewFont={SANS_STACK} onChange={v => setLDesc({ size: v })} />
                <ColorRow label="Colore" value={l.description.color.slice(0, 7)} onChange={v => setLDesc({ color: v })} />
              </Accordion>

              {/* ── LANDING: Bottoni ── */}
              <Accordion title="Bottoni menu">
                <div>
                  <p className="text-xs text-gray-600 mb-2">Forma</p>
                  <PillGroup options={[
                    { label: 'Netto',       value: 'flat'    as const },
                    { label: 'Arrotondato', value: 'rounded' as const },
                    { label: 'Pill',        value: 'pill'    as const },
                  ]} value={l.buttons.shape} onChange={v => setLBu({ shape: v })} />
                </div>
                <ColorRow label="Colore testo"  value={l.buttons.textColor}   onChange={v => setLBu({ textColor: v })} />
                <ColorRow label="Colore sfondo" value={l.buttons.bgColor.startsWith('#') ? l.buttons.bgColor : '#000000'} onChange={v => setLBu({ bgColor: v })} />
                <ColorRow label="Colore bordo"  value={l.buttons.borderColor} onChange={v => setLBu({ borderColor: v })} />
                <div>
                  <p className="text-xs text-gray-600 mb-2">Stile bordo</p>
                  <PillGroup options={[
                    { label: 'Nessuno',   value: 'none'   as const },
                    { label: 'Continuo',  value: 'solid'  as const },
                    { label: 'Tratteg.', value: 'dashed' as const },
                  ]} value={l.buttons.borderStyle} onChange={v => setLBu({ borderStyle: v })} />
                </div>
                <FontSelector label="Font" value={l.buttons.font} curated={SANS_FONTS} category="sans"
                  onChange={v => setLBu({ font: v })} />
                <FontSizeSlider label="Dimensione font" value={l.buttons.fontSize} min={0.4} max={1.0} step={0.025}
                  previewFont={SANS_STACK} onChange={v => setLBu({ fontSize: v })} />
              </Accordion>

              {/* ── LANDING: Banner ── */}
              <Accordion title="Banner promozionali">
                <p className="text-xs text-gray-400">Appaiono nella landing sopra i bottoni menu.</p>
                <BannerManager restaurantId={restaurantId} initialBanners={initialBanners} />
              </Accordion>
            </>
          ) : (
            <>
              {/* ── MENU: Sfondo ── */}
              <Accordion title="Sfondo menù" defaultOpen>
                <ColorRow label="Colore base" value={m.background.color} onChange={v => setMBg({ color: v })} />
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Effetto sfondo</label>
                  <select value={m.background.effect}
                    onChange={e => setMBg({ effect: e.target.value as MenuBgEffect })}
                    className="w-full px-2 py-1.5 border border-gray-200 text-xs bg-white focus:outline-none focus:border-gray-400">
                    {MENU_BG_EFFECTS.map(e => (
                      <option key={e} value={e}>{MENU_BG_EFFECT_LABELS[e]}</option>
                    ))}
                  </select>
                </div>
              </Accordion>

              {/* ── MENU: Accento ── */}
              <Accordion title="Accento menù" defaultOpen>
                <ColorRow label="Colore accento (prezzi, icone)" value={m.accent} onChange={v => setM({ accent: v })} />
              </Accordion>

              {/* ── MENU: Layout piatti ── */}
              <Accordion title="Layout piatti" defaultOpen>
                <div>
                  <p className="text-xs text-gray-600 mb-2">Disposizione</p>
                  <PillGroup options={[
                    { label: 'Lista',     value: 'list'        as const },
                    { label: 'Griglia',   value: 'grid-2'      as const },
                    { label: 'Boxed',     value: 'boxed-card'  as const },
                    { label: 'Minimale',  value: 'minimal-row' as const },
                  ]} value={m.layout.dishLayout} onChange={v => setMLayout({ dishLayout: v })} />
                  <p className="text-[10px] text-gray-400 mt-1">
                    {m.layout.dishLayout === 'grid-2'      ? '2 colonne — compatto, menù lunghi.' :
                     m.layout.dishLayout === 'boxed-card'  ? 'Riquadro per piatto.' :
                     m.layout.dishLayout === 'minimal-row' ? 'Solo nome e prezzo, nessuna descrizione.' :
                                                              'Lista verticale classica.'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-2">Allineamento</p>
                  <PillGroup options={[
                    { label: 'Sinistra', value: 'left'   as const },
                    { label: 'Centro',   value: 'center' as const },
                    { label: 'Destra',   value: 'right'  as const },
                  ]} value={m.layout.dishAlignment} onChange={v => setMLayout({ dishAlignment: v })} />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-gray-600">Spaziatura tra piatti</label>
                    <span className="text-[10px] font-mono text-gray-400">{m.layout.dishSpacing}px</span>
                  </div>
                  <input type="range" min={0} max={24} step={2} value={m.layout.dishSpacing}
                    onChange={e => setMLayout({ dishSpacing: Number(e.target.value) })}
                    className="w-full accent-gray-900" />
                </div>
              </Accordion>

              {/* ── MENU: Divisori ── */}
              <Accordion title="Divisori tra piatti">
                <div>
                  <p className="text-xs text-gray-600 mb-2">Tipo</p>
                  <PillGroup options={[
                    { label: 'Nessuno',  value: 'none'   as const },
                    { label: 'Linea',    value: 'solid'  as const },
                    { label: 'Tratteg.', value: 'dashed' as const },
                    { label: 'Puntini',  value: 'dotted' as const },
                  ]} value={m.layout.divider.type} onChange={v => setMDivider({ type: v })} />
                </div>
                {m.layout.divider.type !== 'none' && (
                  <ColorRow label="Colore divisore" value={m.layout.divider.color} onChange={v => setMDivider({ color: v })} />
                )}
              </Accordion>

              {/* ── MENU: Nomi piatti ── */}
              <Accordion title="Nomi piatti">
                <FontSelector label="Font nomi" value={m.dishes.titleFont} curated={SERIF_FONTS} category="serif"
                  onChange={v => setMDishes({ titleFont: v })} />
                <FontSizeSlider label="Dimensione" value={m.dishes.titleSize} min={1.0} max={2.5} step={0.05}
                  previewFont={fontStack(m.dishes.titleFont, 'serif')}
                  onChange={v => setMDishes({ titleSize: v })} />
                <ColorRow label="Colore" value={m.dishes.titleColor} onChange={v => setMDishes({ titleColor: v })} />
              </Accordion>

              {/* ── MENU: Descrizioni ── */}
              <Accordion title="Descrizioni">
                <FontSelector label="Font" value={m.descriptions.font} curated={SANS_FONTS} category="sans"
                  onChange={v => setMDescs({ font: v })} />
                <FontSizeSlider label="Dimensione" value={m.descriptions.size} min={0.6} max={1.3} step={0.05}
                  previewFont={fontStack(m.descriptions.font, 'sans')}
                  onChange={v => setMDescs({ size: v })} />
                <ColorRow label="Colore" value={m.descriptions.color} onChange={v => setMDescs({ color: v })} />
              </Accordion>

              {/* ── MENU: Allergeni ── */}
              <Accordion title="Allergeni">
                <div>
                  <p className="text-xs text-gray-600 mb-2">Stile visualizzazione</p>
                  <PillGroup options={[
                    { label: 'Testo',  value: 'text'  as const },
                    { label: 'Badge',  value: 'badge' as const },
                  ]} value={m.allergens.style} onChange={v => setMAllergens({ style: v })} />
                  <p className="text-[10px] text-gray-400 mt-1">
                    {m.allergens.style === 'badge' ? 'Pill compatto con ⚠.' : 'Riquadro con intestazione "Allergeni".'}
                  </p>
                </div>
                <ColorRow label="Colore testo" value={m.allergens.color}   onChange={v => setMAllergens({ color: v })} />
                <ColorRow label="Sfondo"       value={m.allergens.bgColor} onChange={v => setMAllergens({ bgColor: v })} />
              </Accordion>

              {/* ── MENU: Prezzi ── */}
              <Accordion title="Prezzi">
                <div>
                  <p className="text-xs text-gray-600 mb-2">Formato</p>
                  <PillGroup options={[
                    { label: '€ 12,50', value: 'symbol-left'  as const },
                    { label: '12,50 €', value: 'symbol-right' as const },
                    { label: '12.50',   value: 'no-symbol'    as const },
                  ]} value={m.prices.format} onChange={v => setMPrices({ format: v })} />
                  <p className="text-[10px] font-mono text-gray-400 mt-1">{formatPrice(12.50, m.prices.format)}</p>
                </div>
                <FontSelector label="Font prezzi" value={m.prices.font} curated={SANS_FONTS} category="sans"
                  onChange={v => setMPrices({ font: v })} />
                <FontSizeSlider label="Dimensione" value={m.prices.size} min={0.7} max={1.8} step={0.05}
                  previewFont={fontStack(m.prices.font, 'sans')}
                  onChange={v => setMPrices({ size: v })} />
                <ColorRow label="Colore" value={m.prices.color} onChange={v => setMPrices({ color: v })} />
              </Accordion>

              {/* ── MENU: Categorie ── */}
              <Accordion title="Titoli categorie">
                <FontSelector label="Font" value={m.categories.font} curated={SERIF_FONTS} category="serif"
                  onChange={v => setMCats({ font: v })} />
                <ColorRow label="Colore" value={m.categories.color} onChange={v => setMCats({ color: v })} />
              </Accordion>

              {/* ── MENU: Barra sticky ── */}
              <Accordion title="Barra categorie sticky">
                <div>
                  <p className="text-xs text-gray-600 mb-2">Stile</p>
                  <PillGroup options={[
                    { label: 'Solida',      value: 'solid'            as const },
                    { label: 'Vetro blur',  value: 'transparent-blur' as const },
                    { label: 'Nascosta',    value: 'none'             as const },
                  ]} value={m.stickyCategories.style} onChange={v => setMSticky({ style: v })} />
                  <p className="text-[10px] text-gray-400 mt-1">
                    {m.stickyCategories.style === 'transparent-blur' ? 'Effetto vetro smerigliato (backdrop-blur).' :
                     m.stickyCategories.style === 'none'             ? 'Barra nascosta — solo sfoglio manuale.' :
                                                                       'Barra opaca con colore navigazione.'}
                  </p>
                </div>
                {m.stickyCategories.style !== 'none' && (
                  <>
                    <ColorRow label="Sfondo barra"  value={m.stickyCategories.bgColor}   onChange={v => setMSticky({ bgColor: v })} />
                    <ColorRow label="Colore testo"  value={m.stickyCategories.textColor} onChange={v => setMSticky({ textColor: v })} />
                    <FontSelector label="Font" value={m.stickyCategories.font} curated={SANS_FONTS} category="sans"
                      onChange={v => setMSticky({ font: v })} />
                  </>
                )}
              </Accordion>

              {/* ── MENU: Navigazione flipbook ── */}
              <Accordion title="Navigazione flipbook">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Stile indicatori pagina</label>
                  <select value={m.navigation.style}
                    onChange={e => setMNav({ style: e.target.value as PaginationStyle })}
                    className="w-full px-2 py-1.5 border border-gray-200 text-xs bg-white focus:outline-none focus:border-gray-400">
                    {(Object.entries(PAGINATION_OPTIONS) as [PaginationStyle, { label: string; prev: string; next: string }][]).map(
                      ([key, opt]) => <option key={key} value={key}>{opt.label}</option>
                    )}
                  </select>
                  {m.navigation.style !== 'hidden' && (
                    <p className="text-[10px] font-mono text-gray-400 mt-1">
                      {PAGINATION_OPTIONS[m.navigation.style].prev}{'  ···  '}{PAGINATION_OPTIONS[m.navigation.style].next}
                    </p>
                  )}
                </div>
                <ColorRow label="Colore navigazione" value={m.navigation.color} onChange={v => setMNav({ color: v })} />
              </Accordion>

              {/* ── MENU: Impaginazione PDF ── */}
              <Accordion title="Impaginazione PDF">
                <div>
                  <p className="text-xs text-gray-600 mb-2">Layout pagine</p>
                  <PillGroup options={[
                    { label: 'Classic', value: 'classic' as const },
                    { label: 'Compact', value: 'compact' as const },
                  ]} value={m.pdfLayout} onChange={v => setM({ pdfLayout: v })} />
                  <p className="text-[11px] text-gray-400 mt-1">
                    {m.pdfLayout === 'classic' ? '1 categoria/pagina. Margini ampi.' : 'Flow continuo. Più dense.'}
                  </p>
                </div>
                <ColorRow label="Colore pagine (stampa)" value={m.pageBackground} onChange={v => setM({ pageBackground: v })} />
                <p className="text-[10px] text-gray-400">
                  Su carta stampata si usa bianco o avorio (es. <span className="font-mono">#fffff5</span>).
                </p>
              </Accordion>
            </>
          )}
        </div>

        {/* ── Live preview — sticky (desktop) ────────────────────────────── */}
        <div className="hidden lg:flex lg:sticky lg:top-4 flex-col" style={{ height: 'calc(100vh - 2rem)' }}>
          <div className="flex-1 min-h-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 rounded-lg overflow-hidden p-6">
            <LivePreview qrToken={qrToken} theme={theme} previewMode={previewMode} />
          </div>
          <p className="text-[10px] text-center text-gray-400 mt-2 shrink-0">
            Anteprima dal vivo · modifiche non salvate visibili solo qui
          </p>
        </div>

      </div>

      {/* ── Mobile FAB ─────────────────────────────────────────────────────────── */}
      <button type="button" onClick={() => setPreviewOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-xs font-semibold px-5 py-3.5 rounded-full shadow-2xl hover:bg-gray-700 active:scale-95 transition-all flex items-center gap-2">
        <span>Vedi Anteprima</span>
        <span className="text-base leading-none">↗</span>
      </button>

      {/* ── Mobile full-screen preview ─────────────────────────────────────────── */}
      {previewOpen && (
        <div className="lg:hidden fixed inset-0 z-[9999] bg-gray-950 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
            <div className="flex gap-1">
              {(['landing', 'menu'] as const).map(mode => (
                <button key={mode} type="button" onClick={() => setPreviewMode(mode)}
                  className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider border transition-colors ${
                    previewMode === mode
                      ? 'bg-white text-gray-900 border-white'
                      : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
                  }`}>
                  {mode === 'landing' ? 'Landing' : 'Menù'}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setPreviewOpen(false)}
              className="text-gray-400 hover:text-white text-2xl leading-none transition-colors w-10 h-10 flex items-center justify-center"
              aria-label="Chiudi anteprima">
              ×
            </button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-4">
            <LivePreview qrToken={qrToken} theme={theme} previewMode={previewMode} />
          </div>
          <p className="text-[10px] text-center text-gray-600 pb-4 shrink-0">
            Anteprima dal vivo · modifiche non ancora salvate
          </p>
        </div>
      )}

    </div>
  )
}
