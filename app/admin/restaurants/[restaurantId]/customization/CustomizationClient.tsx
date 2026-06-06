'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveTheme, createBanner, deleteBanner } from './actions'
import {
  DEFAULT_THEME, SERIF_FONTS, SANS_FONTS,
  googleFontsUrl, fontStack, borderRadiusPx, formatPrice,
} from '@/lib/theme'
import type { RestaurantTheme } from '@/lib/theme'

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
  initialTheme:   RestaurantTheme
  initialBanners: AdminBanner[]
}

// ── Font loader ───────────────────────────────────────────────────────────────

function usePreviewFonts(fontSerif: string, fontSans: string) {
  useEffect(() => {
    const href = googleFontsUrl(fontSerif, fontSans)
    let link = document.querySelector('link[data-admin-preview-fonts]') as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.rel = 'stylesheet'
      link.setAttribute('data-admin-preview-fonts', '1')
      document.head.appendChild(link)
    }
    link.href = href
  }, [fontSerif, fontSans])
}

// ── UI Atoms ──────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">{children}</p>
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs text-gray-600 min-w-0 flex-1">{label}</label>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-gray-400 font-mono w-16 text-right">{value}</span>
        <div className="relative w-8 h-8 border border-gray-200 overflow-hidden rounded-sm">
          <input type="color" value={value} onChange={e => onChange(e.target.value)}
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
        <select value={value} onChange={e => { if (e.target.value === '__custom__') { setCustomMode(true); return } onChange(e.target.value) }}
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
      <p className="mt-0.5 overflow-hidden text-nowrap" style={{ fontSize: `${value}rem`, fontFamily: previewFont, color: '#999', lineHeight: 1.2 }}>
        Testo di esempio
      </p>
    </div>
  )
}

// ── Phone frame wrapper ───────────────────────────────────────────────────────

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ aspectRatio: '9/19.5', width: '100%', maxWidth: 320 }}>
      {/* Outer bezel */}
      <div className="absolute inset-0 border-[10px] border-gray-900 rounded-[3rem] shadow-2xl z-10 pointer-events-none" />
      {/* Volume buttons (left) */}
      <div className="absolute -left-3.5 top-20 w-1.5 h-8 bg-gray-800 rounded-l z-20" />
      <div className="absolute -left-3.5 top-32 w-1.5 h-8 bg-gray-800 rounded-l z-20" />
      {/* Power button (right) */}
      <div className="absolute -right-3.5 top-24 w-1.5 h-12 bg-gray-800 rounded-r z-20" />
      {/* Notch */}
      <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-28 h-7 bg-gray-900 rounded-b-2xl z-20 pointer-events-none" />
      {/* Home pill */}
      <div className="absolute bottom-[10px] left-1/2 -translate-x-1/2 w-20 h-1 bg-gray-700 rounded-full z-20 pointer-events-none" />
      {/* Screen */}
      <div className="absolute inset-[10px] rounded-[2.5rem] overflow-hidden bg-black">
        {children}
      </div>
    </div>
  )
}

// ── Landing Preview ───────────────────────────────────────────────────────────

function LandingPreview({ theme, restaurantName, restaurantLogo }: {
  theme: RestaurantTheme; restaurantName: string; restaurantLogo: string | null
}) {
  const SERIF = fontStack(theme.fontSerif, 'serif')
  const SANS  = fontStack(theme.fontSans, 'sans')
  const R     = borderRadiusPx(theme.borderRadius)

  return (
    <div className="w-full h-full relative flex flex-col items-center justify-center overflow-hidden"
      style={{ background: theme.appBg, fontFamily: SANS }}>
      {theme.bgImage && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: `url(${theme.bgImage})`, backgroundSize: 'cover',
            backgroundPosition: 'center', opacity: (theme.bgImageOpacity ?? 30) / 100 }} />
      )}
      <div className="absolute top-0 inset-x-0 h-px"
        style={{ background: `linear-gradient(90deg,transparent,${theme.accent}55,transparent)` }} />

      <div className="relative flex flex-col items-center text-center px-8 w-full">
        {restaurantLogo ? (
          <img src={restaurantLogo} alt="" className="h-10 object-contain mb-4" style={{ opacity: 0.88 }} />
        ) : (
          <>
            <div className="w-6 h-px mb-3" style={{ background: theme.accent }} />
            <h1 className="font-light uppercase leading-none mb-3"
              style={{ color: theme.textPrimary, fontFamily: SERIF,
                fontSize: `${theme.fontSizes.title * 0.65}rem`, letterSpacing: '0.22em' }}>
              {restaurantName}
            </h1>
            <div className="w-6 h-px mb-4" style={{ background: theme.accent }} />
          </>
        )}
        <div className="flex flex-col gap-2 w-full">
          {['Pranzo', 'Cena'].map(name => (
            <div key={name} className="px-4 py-2 text-center"
              style={{ color: theme.textPrimary, border: `1px solid ${theme.accent}50`,
                borderRadius: R, fontFamily: SANS,
                fontSize: `${theme.fontSizes.base * 0.55}rem`,
                letterSpacing: '0.28em', textTransform: 'uppercase' }}>
              {`Sfoglia il menu ${name}`}
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: `${theme.accent}60` }} />
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 inset-x-0 h-px"
        style={{ background: `linear-gradient(90deg,transparent,${theme.accent}55,transparent)` }} />
    </div>
  )
}

// ── Menu Preview (dish list mock) ─────────────────────────────────────────────

const MOCK_DISHES = [
  { id: '1', name: 'Bruschetta al Pomodoro', description: 'Pane tostato, pomodoro, basilico, olio EVO', price: 6.50, category: 'Antipasti' },
  { id: '2', name: 'Carpaccio di Manzo',     description: 'Manzo crudo, rucola, parmigiano, limone',   price: 12.00, category: 'Antipasti' },
  { id: '3', name: 'Tagliatelle al Ragù',    description: 'Pasta fresca, ragù bolognese',               price: 14.00, category: 'Primi' },
  { id: '4', name: 'Risotto ai Porcini',     description: 'Carnaroli, porcini, parmigiano 24 mesi',    price: 15.50, category: 'Primi' },
]

function MenuPreview({ theme }: { theme: RestaurantTheme }) {
  const SERIF  = fontStack(theme.fontSerif, 'serif')
  const SANS   = fontStack(theme.fontSans, 'sans')
  const isGrid = theme.dishLayout === 'grid'
  const isBox  = theme.dishLayout === 'boxed'
  const scale  = 0.55   // preview is ~55% of real size

  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col"
      style={{ background: theme.pageBackground, fontFamily: SANS }}>

      {/* Nav bar */}
      <div className="shrink-0 px-3 py-1.5 flex gap-2 overflow-hidden" style={{ background: theme.navBg }}>
        {['Antipasti', 'Primi'].map((cat, i) => (
          <span key={cat} className="text-[8px] uppercase tracking-widest shrink-0 px-1.5 py-0.5"
            style={{ color: i === 0 ? theme.accent : `${theme.textMuted}88`, fontFamily: SANS,
              borderBottom: i === 0 ? `1.5px solid ${theme.accent}` : 'none' }}>
            {cat}
          </span>
        ))}
      </div>

      {/* Category label */}
      <div className="px-4 pt-3 pb-1.5 shrink-0">
        <p className="uppercase text-[8px] tracking-[0.2em]" style={{ color: theme.accent }}>Antipasti</p>
        <div className="h-px mt-1" style={{ background: `${theme.accent}30` }} />
      </div>

      {/* Dishes */}
      <div className={`px-3 flex-1 overflow-hidden ${isGrid ? 'grid grid-cols-2 gap-1.5 content-start pt-1' : 'flex flex-col'}`}>
        {MOCK_DISHES.slice(0, isGrid ? 4 : 3).map((dish, i) => {
          const priceStr = formatPrice(dish.price, theme.priceFormat)
          const showDiv  = !isGrid && !isBox && theme.dividerStyle !== 'none' && i < 2

          return (
            <div key={dish.id}
              style={isBox ? {
                border: `0.5px solid ${theme.accent}40`,
                borderRadius: borderRadiusPx(theme.borderRadius),
                padding: '5px 6px', marginBottom: 4,
              } : { paddingTop: 4, paddingBottom: showDiv ? 0 : 4 }}>
              <div className="flex items-start justify-between gap-1.5">
                <p style={{ fontFamily: SANS, fontSize: `${theme.fontSizes.base * scale}rem`,
                  fontWeight: 600, color: '#1a1a1a', textTransform: 'uppercase',
                  letterSpacing: '0.04em', lineHeight: 1.2, flex: 1 }}>
                  {dish.name}
                </p>
                <p style={{ fontFamily: SANS, fontSize: `${theme.fontSizes.price * scale}rem`,
                  fontWeight: 600, color: '#1a1a1a', flexShrink: 0, lineHeight: 1.2 }}>
                  {priceStr}
                </p>
              </div>
              <p style={{ fontFamily: SERIF, fontSize: `${theme.fontSizes.base * scale * 0.85}rem`,
                color: '#6a6a6a', lineHeight: 1.35, marginTop: 2 }}>
                {dish.description}
              </p>
              {showDiv && (
                <div className="mt-2 mb-0.5 h-px"
                  style={{ background: '#ece6da', borderStyle: theme.dividerStyle === 'dashed' ? 'dashed' : 'solid' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Banner Manager ────────────────────────────────────────────────────────────

function BannerManager({ restaurantId, initialBanners }: { restaurantId: string; initialBanners: AdminBanner[] }) {
  const [banners, setBanners] = useState<AdminBanner[]>(initialBanners)
  const [uploading, setUploading] = useState(false)
  const [newTitle,    setNewTitle]    = useState('')
  const [newSubtitle, setNewSubtitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleAdd() {
    if (!fileRef.current?.files?.[0]) { setError('Seleziona un file.'); return }
    setUploading(true); setError(null)
    const file = fileRef.current.files[0]
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${restaurantId}/banners/${Date.now()}.${ext}`
    const { data: up, error: upErr } = await supabase.storage
      .from('restaurant-assets')
      .upload(path, file, { upsert: false })
    if (upErr || !up) { setError('Upload: ' + upErr?.message); setUploading(false); return }
    const { data: pub } = supabase.storage.from('restaurant-assets').getPublicUrl(up.path)
    try {
      const b = await createBanner(restaurantId, {
        media_url:  pub.publicUrl,
        media_type: file.type.startsWith('video/') ? 'video' : 'image',
        title:      newTitle.trim() || undefined,
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
        <input type="text" placeholder="Titolo (opzionale)" value={newTitle} onChange={e => setNewTitle(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-200 text-xs focus:outline-none focus:border-gray-400 bg-white" />
        <input type="text" placeholder="Sottotitolo (opzionale)" value={newSubtitle} onChange={e => setNewSubtitle(e.target.value)}
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
  restaurantId, restaurantName, restaurantLogo, initialTheme, initialBanners,
}: Props) {
  const [theme,       setTheme]       = useState<RestaurantTheme>(initialTheme)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [bgUploading, setBgUploading] = useState(false)
  const [previewMode, setPreviewMode] = useState<'landing' | 'menu'>('landing')

  usePreviewFonts(theme.fontSerif, theme.fontSans)

  function set<K extends keyof RestaurantTheme>(key: K, value: RestaurantTheme[K]) {
    setSaved(false); setTheme(t => ({ ...t, [key]: value }))
  }
  function setFs(key: keyof RestaurantTheme['fontSizes'], value: number) {
    setSaved(false); setTheme(t => ({ ...t, fontSizes: { ...t.fontSizes, [key]: value } }))
  }

  async function handleBgUpload(file: File) {
    setBgUploading(true)
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${restaurantId}/theme-bg.${ext}`
    const { data, error: err } = await supabase.storage
      .from('restaurant-assets').upload(path, file, { upsert: true })
    if (!err && data) {
      const { data: pub } = supabase.storage.from('restaurant-assets').getPublicUrl(data.path)
      set('bgImage', pub.publicUrl)
    } else if (err) setError('Upload: ' + err.message)
    setBgUploading(false)
  }

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false)
    try { await saveTheme(restaurantId, theme as unknown as object); setSaved(true) }
    catch (e: any) { setError(e.message ?? 'Errore.') }
    finally { setSaving(false) }
  }

  const SERIF = fontStack(theme.fontSerif, 'serif')
  const SANS  = fontStack(theme.fontSans, 'sans')

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Personalizzazione</h2>
          <p className="text-xs text-gray-400 mt-0.5">Le modifiche si applicano al menu clienti dopo il salvataggio.</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-600">Salvato.</span>}
          {error && <span className="text-xs text-red-500 max-w-[200px] truncate">{error}</span>}
          <button type="button" onClick={() => { if (confirm('Ripristinare il tema predefinito?')) { setTheme(DEFAULT_THEME); setSaved(false) } }}
            className="text-xs text-gray-400 hover:text-gray-600">Ripristina</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="bg-gray-900 text-white text-xs font-medium px-4 py-2 hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {saving ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </div>
      </div>

      {/* ── 30 / 70 layout ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 items-start">

        {/* ── Controls (scrollable fixed column) ─────────────────────────── */}
        <div className="space-y-8 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto lg:pr-2">

          {/* Doppio sfondo */}
          <div>
            <SectionLabel>Sfondi</SectionLabel>
            <div className="bg-white border border-gray-100 p-4 space-y-4">
              <div>
                <p className="text-[10px] text-gray-400 mb-2 uppercase tracking-wider">Contenitore app (landing, intorno al flipbook)</p>
                <ColorRow label="Colore sfondo app" value={theme.appBg} onChange={v => set('appBg', v)} />
              </div>
              <div className="border-t border-gray-50 pt-4">
                <p className="text-[10px] text-gray-400 mb-2 uppercase tracking-wider">Pagine PDF (il "foglio" del menù)</p>
                <ColorRow label="Colore pagine" value={theme.pageBackground} onChange={v => set('pageBackground', v)} />
                <p className="text-[10px] text-gray-400 mt-1">
                  Su carta stampata si usa sempre bianco o avorio (es. <span className="font-mono">#fffff5</span>).
                </p>
              </div>
              <div className="border-t border-gray-50 pt-4">
                <ColorRow label="Barra navigazione"  value={theme.navBg}       onChange={v => set('navBg', v)} />
                <ColorRow label="Colore accento"     value={theme.accent}      onChange={v => set('accent', v)} />
                <ColorRow label="Testo principale"   value={theme.textPrimary} onChange={v => set('textPrimary', v)} />
                <ColorRow label="Testo secondario"   value={theme.textMuted}   onChange={v => set('textMuted', v)} />
              </div>
            </div>
          </div>

          {/* Sfondo texture */}
          <div>
            <SectionLabel>Texture sfondo app (opzionale)</SectionLabel>
            <div className="bg-white border border-gray-100 p-4 space-y-3">
              {theme.bgImage && (
                <div className="relative inline-block">
                  <img src={theme.bgImage} alt="Sfondo" className="w-24 h-16 object-cover border border-gray-200" />
                  <button type="button" onClick={() => set('bgImage', undefined)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">×</button>
                </div>
              )}
              <input type="file" accept="image/*"
                onChange={e => e.target.files?.[0] && handleBgUpload(e.target.files[0])}
                className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50 cursor-pointer" />
              {bgUploading && <p className="text-xs text-gray-400">Caricamento…</p>}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Opacità texture: <span className="font-medium text-gray-700">{theme.bgImageOpacity}%</span>
                </label>
                <input type="range" min={5} max={80} step={5} value={theme.bgImageOpacity}
                  onChange={e => set('bgImageOpacity', Number(e.target.value))}
                  className="w-full accent-gray-900" />
              </div>
            </div>
          </div>

          {/* Tipografia */}
          <div>
            <SectionLabel>Tipografia</SectionLabel>
            <div className="bg-white border border-gray-100 p-4 space-y-4">
              <FontSelector label="Font titoli (nome ristorante, piatti)" value={theme.fontSerif} curated={SERIF_FONTS} category="serif" onChange={v => set('fontSerif', v)} />
              <FontSelector label="Font testi (label, bottoni)"            value={theme.fontSans}  curated={SANS_FONTS}  category="sans"  onChange={v => set('fontSans', v)} />
            </div>
          </div>

          {/* Dimensioni testo */}
          <div>
            <SectionLabel>Dimensioni testo</SectionLabel>
            <div className="bg-white border border-gray-100 p-4 space-y-5">
              <FontSizeSlider label="Titoli (nome ristorante, piatti)" value={theme.fontSizes.title} min={1.0} max={2.5} step={0.05} previewFont={SERIF} onChange={v => setFs('title', v)} />
              <FontSizeSlider label="Testo normale (descrizioni)"       value={theme.fontSizes.base}  min={0.6} max={1.3} step={0.05} previewFont={SANS}  onChange={v => setFs('base', v)} />
              <FontSizeSlider label="Prezzi"                            value={theme.fontSizes.price} min={0.7} max={1.8} step={0.05} previewFont={SANS}  onChange={v => setFs('price', v)} />
            </div>
          </div>

          {/* Stile bordi */}
          <div>
            <SectionLabel>Stile bordi</SectionLabel>
            <div className="bg-white border border-gray-100 p-4">
              <PillGroup options={[
                { label: 'Netto',       value: 'none' as const },
                { label: 'Soft',        value: 'sm'   as const },
                { label: 'Arrotondato', value: 'md'   as const },
              ]} value={theme.borderRadius} onChange={v => set('borderRadius', v)} />
            </div>
          </div>

          {/* Layout piatti */}
          <div>
            <SectionLabel>Layout piatti (PDF)</SectionLabel>
            <div className="bg-white border border-gray-100 p-4 space-y-3">
              <PillGroup options={[
                { label: 'Lista',   value: 'list'  as const },
                { label: 'Griglia', value: 'grid'  as const },
                { label: 'Boxed',   value: 'boxed' as const },
              ]} value={theme.dishLayout} onChange={v => set('dishLayout', v)} />
              <p className="text-[11px] text-gray-400">
                {theme.dishLayout === 'list'  ? 'Verticale classico.' :
                 theme.dishLayout === 'grid'  ? '2 colonne — compatto, menù lunghi.' :
                                                'Riquadro per piatto — modulare.'}
              </p>
            </div>
          </div>

          {/* Prezzo e divisori */}
          <div>
            <SectionLabel>Prezzo e divisori</SectionLabel>
            <div className="bg-white border border-gray-100 p-4 space-y-4">
              <div>
                <p className="text-xs text-gray-600 mb-2">Formato prezzo</p>
                <PillGroup options={[
                  { label: '€ 12,50', value: 'before'  as const },
                  { label: '12,50 €', value: 'after'   as const },
                  { label: '12.50',   value: 'minimal' as const },
                ]} value={theme.priceFormat} onChange={v => set('priceFormat', v)} />
                <p className="text-[10px] font-mono text-gray-400 mt-1">{formatPrice(12.50, theme.priceFormat)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-2">Divisori tra piatti</p>
                <PillGroup options={[
                  { label: 'Nessuno',  value: 'none'   as const },
                  { label: 'Linea',    value: 'thin'   as const },
                  { label: 'Tratteg.', value: 'dashed' as const },
                ]} value={theme.dividerStyle} onChange={v => set('dividerStyle', v)} />
              </div>
            </div>
          </div>

          {/* Impaginazione PDF */}
          <div>
            <SectionLabel>Impaginazione PDF</SectionLabel>
            <div className="bg-white border border-gray-100 p-4 space-y-3">
              <PillGroup options={[
                { label: 'Classic', value: 'classic' as const },
                { label: 'Compact', value: 'compact' as const },
              ]} value={theme.pdfLayout} onChange={v => set('pdfLayout', v)} />
              <p className="text-[11px] text-gray-400">
                {theme.pdfLayout === 'classic' ? '1 categoria/pagina. Margini ampi.' : 'Flow continuo. Più dense.'}
              </p>
            </div>
          </div>

          {/* Banner */}
          <div>
            <SectionLabel>Banner promozionali</SectionLabel>
            <div className="bg-white border border-gray-100 p-4">
              <p className="text-xs text-gray-400 mb-4">Appaiono nella landing sopra i bottoni menu.</p>
              <BannerManager restaurantId={restaurantId} initialBanners={initialBanners} />
            </div>
          </div>

        </div>

        {/* ── Preview (70%, sticky, full-height) ─────────────────────────── */}
        <div className="lg:sticky lg:top-6 flex flex-col" style={{ height: 'calc(100vh - 11rem)' }}>
          {/* Toggle */}
          <div className="flex gap-1 mb-3 shrink-0">
            {(['landing', 'menu'] as const).map(mode => (
              <button key={mode} type="button" onClick={() => setPreviewMode(mode)}
                className={`px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider border transition-colors ${
                  previewMode === mode
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}>
                {mode === 'landing' ? 'Landing' : 'Menù'}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-gray-400 self-center">
              {previewMode === 'landing' ? 'Schermata di benvenuto clienti' : 'Layout pagine menù'}
            </span>
          </div>

          {/* Preview area — centrata, con phone frame */}
          <div className="flex-1 min-h-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 rounded-lg overflow-hidden p-8">
            <PhoneFrame>
              {previewMode === 'landing'
                ? <LandingPreview theme={theme} restaurantName={restaurantName} restaurantLogo={restaurantLogo} />
                : <MenuPreview theme={theme} />}
            </PhoneFrame>
          </div>

          <p className="text-[10px] text-center text-gray-400 mt-2 shrink-0">
            Preview in tempo reale · Scala circa 60%
          </p>
        </div>

      </div>
    </div>
  )
}
