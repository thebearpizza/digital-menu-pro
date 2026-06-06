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

// ── Font loader for admin preview ─────────────────────────────────────────────

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
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">
      {children}
    </p>
  )
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
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function FontSelector({ label, value, curated, onChange }: {
  label: string; value: string; curated: string[]; onChange: (v: string) => void
}) {
  const isCustom = !curated.includes(value)
  const [customMode, setCustomMode] = useState(isCustom)
  const [customVal,  setCustomVal]  = useState(isCustom ? value : '')

  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      <div className="flex gap-2">
        {!customMode ? (
          <select value={value} onChange={e => { if (e.target.value === '__custom__') { setCustomMode(true); return } onChange(e.target.value) }}
            className="flex-1 px-2 py-1.5 border border-gray-200 text-xs bg-white focus:outline-none focus:border-gray-400">
            {curated.map(f => <option key={f} value={f}>{f}</option>)}
            <option value="__custom__">Altro (Google Font)…</option>
          </select>
        ) : (
          <div className="flex-1 flex gap-1">
            <input type="text" value={customVal} onChange={e => setCustomVal(e.target.value)}
              placeholder="es. Abril Fatface"
              className="flex-1 px-2 py-1.5 border border-gray-200 text-xs focus:outline-none focus:border-gray-400"
              onBlur={() => { if (customVal.trim()) onChange(customVal.trim()) }}
              onKeyDown={e => { if (e.key === 'Enter' && customVal.trim()) onChange(customVal.trim()) }} />
            <button type="button" onClick={() => { setCustomMode(false); onChange(curated[0]) }}
              className="text-[10px] text-gray-400 hover:text-gray-600 px-1">✕</button>
          </div>
        )}
      </div>
      <p className="mt-1 text-[11px]" style={{ fontFamily: fontStack(value, 'serif'), color: '#666' }}>
        {value} — Il tuo menù in questo font
      </p>
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
    <div className="relative overflow-hidden flex flex-col items-center justify-center"
      style={{ background: theme.pageBg, aspectRatio: '9/16', maxHeight: 460, fontFamily: SANS }}>
      {theme.bgImage && (
        <div className="absolute inset-0"
          style={{ backgroundImage: `url(${theme.bgImage})`, backgroundSize: 'cover',
            backgroundPosition: 'center', opacity: (theme.bgImageOpacity ?? 30) / 100 }} />
      )}
      <div className="absolute top-0 inset-x-0 h-px"
        style={{ background: `linear-gradient(90deg,transparent,${theme.accent}55,transparent)` }} />

      <div className="relative flex flex-col items-center text-center px-8 w-full">
        {restaurantLogo ? (
          <img src={restaurantLogo} alt="" className="h-8 object-contain mb-4" style={{ opacity: 0.88 }} />
        ) : (
          <>
            <div className="w-6 h-px mb-4" style={{ background: theme.accent }} />
            <h1 className="font-light uppercase leading-none mb-4"
              style={{ color: theme.textPrimary, fontFamily: SERIF,
                fontSize: 'clamp(0.9rem,3vw,1.2rem)', letterSpacing: '0.22em' }}>
              {restaurantName}
            </h1>
            <div className="w-6 h-px mb-5" style={{ background: theme.accent }} />
          </>
        )}
        <div className="flex flex-col gap-2 w-full mt-2">
          {['Pranzo', 'Cena'].map(name => (
            <div key={name} className="px-6 py-2 text-center"
              style={{ color: theme.textPrimary, border: `1px solid ${theme.accent}50`,
                borderRadius: R, fontFamily: SANS, fontSize: '0.5rem',
                letterSpacing: '0.28em', textTransform: 'uppercase' }}>
              {`Sfoglia il menu ${name}`}
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-3 h-3 rounded-full" style={{ background: `${theme.accent}60` }} />
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 inset-x-0 h-px"
        style={{ background: `linear-gradient(90deg,transparent,${theme.accent}55,transparent)` }} />
    </div>
  )
}

// ── Menu Preview (mock dish list) ─────────────────────────────────────────────

const MOCK_DISHES = [
  { id: '1', name: 'Bruschetta al Pomodoro', description: 'Pane tostato, pomodoro, basilico, olio EVO', price: 6.50, category: 'Antipasti' },
  { id: '2', name: 'Carpaccio di Manzo',     description: 'Manzo crudo, rucola, parmigiano, limone',  price: 12.00, category: 'Antipasti' },
  { id: '3', name: 'Tagliatelle al Ragù',    description: 'Pasta fresca, ragù bolognese tradizionale', price: 14.00, category: 'Primi' },
  { id: '4', name: 'Risotto ai Porcini',     description: 'Carnaroli, porcini stagione, parmigiano',   price: 15.50, category: 'Primi' },
]

function MenuPreview({ theme }: { theme: RestaurantTheme }) {
  const SERIF  = fontStack(theme.fontSerif, 'serif')
  const SANS   = fontStack(theme.fontSans, 'sans')
  const isGrid = theme.dishLayout === 'grid'
  const isBox  = theme.dishLayout === 'boxed'

  return (
    <div className="relative overflow-hidden flex flex-col"
      style={{ background: '#ffffff', aspectRatio: '9/16', maxHeight: 460, fontFamily: SANS }}>

      {/* Nav bar mock */}
      <div className="shrink-0 px-4 py-2 flex gap-2 overflow-x-auto" style={{ background: theme.navBg }}>
        {['Antipasti', 'Primi'].map((cat, i) => (
          <span key={cat} className="text-[9px] uppercase tracking-widest shrink-0 px-2 py-1"
            style={{ color: i === 0 ? theme.accent : `${theme.textMuted}99`, fontFamily: SANS,
              borderBottom: i === 0 ? `1px solid ${theme.accent}` : 'none' }}>
            {cat}
          </span>
        ))}
      </div>

      {/* Category title */}
      <div className="px-5 pt-4 pb-2">
        <p className="uppercase text-[10px] tracking-[0.2em]"
          style={{ color: theme.accent, fontFamily: SANS }}>
          Antipasti
        </p>
        <div className="h-px mt-1" style={{ background: `${theme.accent}30` }} />
      </div>

      {/* Dishes */}
      <div className={`px-4 flex-1 overflow-hidden ${isGrid ? 'grid grid-cols-2 gap-2 content-start' : 'flex flex-col gap-0'}`}>
        {MOCK_DISHES.slice(0, isGrid ? 4 : 3).map((dish, i) => {
          const priceStr = formatPrice(dish.price, theme.priceFormat)
          const showDiv  = !isGrid && !isBox && theme.dividerStyle !== 'none' && i < 2

          return (
            <div key={dish.id}
              style={isBox ? {
                border: `0.5px solid ${theme.accent}40`,
                borderRadius: borderRadiusPx(theme.borderRadius),
                padding: '8px',
                marginBottom: '6px',
              } : {}}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold uppercase text-[8px] tracking-wider flex-1"
                  style={{ color: '#1a1a1a', fontFamily: SANS, lineHeight: 1.3 }}>
                  {dish.name}
                </p>
                <p className="text-[8px] font-semibold shrink-0" style={{ color: '#1a1a1a' }}>
                  {priceStr}
                </p>
              </div>
              <p className="text-[7px] mt-0.5" style={{ color: '#6a6a6a', fontFamily: SERIF, lineHeight: 1.4 }}>
                {dish.description}
              </p>
              {showDiv && (
                <div className="mt-2 mb-2 h-px"
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

function BannerManager({ restaurantId, initialBanners }: {
  restaurantId: string; initialBanners: AdminBanner[]
}) {
  const [banners, setBanners] = useState<AdminBanner[]>(initialBanners)
  const [uploading, setUploading] = useState(false)
  const [newTitle,    setNewTitle]    = useState('')
  const [newSubtitle, setNewSubtitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleAdd() {
    if (!fileRef.current?.files?.[0]) { setError('Seleziona un file immagine.'); return }
    setUploading(true); setError(null)
    const file = fileRef.current.files[0]
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${restaurantId}/banners/${Date.now()}.${ext}`
    const { data: up, error: upErr } = await supabase.storage
      .from('restaurant-assets')
      .upload(path, file, { upsert: false })
    if (upErr || !up) { setError('Upload fallito: ' + upErr?.message); setUploading(false); return }
    const { data: pub } = supabase.storage.from('restaurant-assets').getPublicUrl(up.path)
    try {
      const b = await createBanner(restaurantId, {
        media_url:   pub.publicUrl,
        media_type:  file.type.startsWith('video/') ? 'video' : 'image',
        title:       newTitle.trim() || undefined,
        subtitle:    newSubtitle.trim() || undefined,
        sort_order:  banners.length,
      })
      setBanners(prev => [...prev, { ...b, is_active: true }])
      setNewTitle(''); setNewSubtitle('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: any) {
      setError(e.message ?? 'Errore nella creazione del banner.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questo banner?')) return
    try {
      await deleteBanner(restaurantId, id)
      setBanners(prev => prev.filter(b => b.id !== id))
    } catch (e: any) {
      setError(e.message ?? 'Errore nell\'eliminazione.')
    }
  }

  return (
    <div className="space-y-4">
      {banners.length === 0 && (
        <p className="text-xs text-gray-400">Nessun banner attivo. Aggiungine uno qui sotto.</p>
      )}

      {/* Existing banners */}
      <div className="space-y-2">
        {banners.map(b => (
          <div key={b.id} className="flex items-center gap-3 p-2 border border-gray-100 bg-white">
            {b.media_url && (
              <img src={b.media_url} alt="" className="w-16 h-10 object-cover shrink-0 border border-gray-200" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">{b.title || '(nessun titolo)'}</p>
              {b.subtitle && <p className="text-[10px] text-gray-400 truncate">{b.subtitle}</p>}
            </div>
            <button type="button" onClick={() => handleDelete(b.id)}
              className="text-red-400 hover:text-red-600 text-xs shrink-0 transition-colors">
              Elimina
            </button>
          </div>
        ))}
      </div>

      {/* Add new banner */}
      <div className="border border-gray-100 p-3 bg-gray-50 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Aggiungi banner</p>
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
          {uploading ? 'Caricamento…' : '+ Aggiungi banner'}
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CustomizationClient({
  restaurantId, restaurantName, restaurantLogo, initialTheme, initialBanners,
}: Props) {
  const [theme,        setTheme]        = useState<RestaurantTheme>(initialTheme)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [bgUploading,  setBgUploading]  = useState(false)
  const [previewMode,  setPreviewMode]  = useState<'landing' | 'menu'>('landing')

  usePreviewFonts(theme.fontSerif, theme.fontSans)

  function set<K extends keyof RestaurantTheme>(key: K, value: RestaurantTheme[K]) {
    setSaved(false)
    setTheme(t => ({ ...t, [key]: value }))
  }

  async function handleBgUpload(file: File) {
    setBgUploading(true)
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${restaurantId}/theme-bg.${ext}`
    const { data, error: err } = await supabase.storage
      .from('restaurant-assets')
      .upload(path, file, { upsert: true })
    if (!err && data) {
      const { data: pub } = supabase.storage.from('restaurant-assets').getPublicUrl(data.path)
      set('bgImage', pub.publicUrl)
    } else if (err) {
      setError('Upload fallito: ' + err.message)
    }
    setBgUploading(false)
  }

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false)
    try {
      await saveTheme(restaurantId, theme as unknown as object)
      setSaved(true)
    } catch (e: any) {
      setError(e.message ?? 'Errore nel salvataggio.')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    if (!confirm('Ripristinare il tema predefinito?')) return
    setTheme(DEFAULT_THEME)
    setSaved(false)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Personalizzazione</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Modifica aspetto, font e layout. Le modifiche si applicano al menu clienti dopo il salvataggio.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved  && <span className="text-xs text-green-600">Salvato.</span>}
          {error  && <span className="text-xs text-red-500">{error}</span>}
          <button type="button" onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600">Ripristina</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="bg-gray-900 text-white text-xs font-medium px-4 py-2 hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {saving ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">

        {/* LEFT: Controls */}
        <div className="space-y-8">

          {/* Colori */}
          <div>
            <SectionLabel>Colori</SectionLabel>
            <div className="bg-white border border-gray-100 p-4 space-y-3">
              <ColorRow label="Colore accento"    value={theme.accent}      onChange={v => set('accent', v)} />
              <ColorRow label="Sfondo landing"    value={theme.pageBg}      onChange={v => set('pageBg', v)} />
              <ColorRow label="Barra navigazione" value={theme.navBg}       onChange={v => set('navBg', v)} />
              <ColorRow label="Testo principale"  value={theme.textPrimary} onChange={v => set('textPrimary', v)} />
              <ColorRow label="Testo secondario"  value={theme.textMuted}   onChange={v => set('textMuted', v)} />
            </div>
          </div>

          {/* Tipografia */}
          <div>
            <SectionLabel>Tipografia</SectionLabel>
            <div className="bg-white border border-gray-100 p-4 space-y-4">
              <FontSelector label="Font titoli (nome ristorante, piatti)" value={theme.fontSerif} curated={SERIF_FONTS} onChange={v => set('fontSerif', v)} />
              <FontSelector label="Font testi (label, bottoni)"            value={theme.fontSans}  curated={SANS_FONTS}  onChange={v => set('fontSans', v)} />
            </div>
          </div>

          {/* Stile bordi */}
          <div>
            <SectionLabel>Stile bordi</SectionLabel>
            <div className="bg-white border border-gray-100 p-4 space-y-2">
              <p className="text-xs text-gray-500 mb-3">Bottoni, card modal e banner.</p>
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
                {theme.dishLayout === 'list'  ? 'Piatti in lista verticale (classico).' :
                 theme.dishLayout === 'grid'  ? 'Due colonne affiancate — più compatto, ideale per menù lunghi.' :
                                                'Ogni piatto in un riquadro con bordo — aspetto modulare e moderno.'}
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
                  { label: '€ 12,50',  value: 'before'  as const },
                  { label: '12,50 €',  value: 'after'   as const },
                  { label: 'Minimal',  value: 'minimal' as const },
                ]} value={theme.priceFormat} onChange={v => set('priceFormat', v)} />
                <p className="text-[10px] text-gray-400 mt-1">{formatPrice(12.50, theme.priceFormat)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-2">Divisori tra i piatti</p>
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
                {theme.pdfLayout === 'classic'
                  ? 'Una categoria per pagina. Margini generosi, lettura comoda.'
                  : 'Categorie in flow continuo. Più dense, ideale per menù lunghi.'}
              </p>
            </div>
          </div>

          {/* Sfondo landing */}
          <div>
            <SectionLabel>Sfondo landing (opzionale)</SectionLabel>
            <div className="bg-white border border-gray-100 p-4 space-y-3">
              <p className="text-xs text-gray-500">
                Texture sovrapposta allo sfondo scuro. Usa immagini con contrasto basso.
              </p>
              {theme.bgImage && (
                <div className="relative inline-block">
                  <img src={theme.bgImage} alt="Sfondo" className="w-24 h-16 object-cover border border-gray-200" />
                  <button type="button" onClick={() => set('bgImage', undefined)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    ×
                  </button>
                </div>
              )}
              <input type="file" accept="image/*"
                onChange={e => e.target.files?.[0] && handleBgUpload(e.target.files[0])}
                className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50 cursor-pointer" />
              {bgUploading && <p className="text-xs text-gray-400">Caricamento…</p>}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Opacità: <span className="font-medium text-gray-700">{theme.bgImageOpacity}%</span>
                </label>
                <input type="range" min={5} max={80} step={5} value={theme.bgImageOpacity}
                  onChange={e => set('bgImageOpacity', Number(e.target.value))}
                  className="w-full accent-gray-900" />
              </div>
            </div>
          </div>

          {/* Banner promozionali */}
          <div>
            <SectionLabel>Banner promozionali</SectionLabel>
            <div className="bg-white border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-4">
                I banner appaiono nella landing page clienti sopra i bottoni menu. Supporto: immagini e video.
              </p>
              <BannerManager restaurantId={restaurantId} initialBanners={initialBanners} />
            </div>
          </div>

        </div>

        {/* RIGHT: Live Preview */}
        <div className="lg:sticky lg:top-6">
          {/* Preview toggle */}
          <div className="flex gap-1 mb-2">
            <button type="button" onClick={() => setPreviewMode('landing')}
              className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider border transition-colors ${
                previewMode === 'landing' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}>
              Landing
            </button>
            <button type="button" onClick={() => setPreviewMode('menu')}
              className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider border transition-colors ${
                previewMode === 'menu' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}>
              Menù
            </button>
          </div>
          <div className="border border-gray-100 overflow-hidden">
            {previewMode === 'landing'
              ? <LandingPreview theme={theme} restaurantName={restaurantName} restaurantLogo={restaurantLogo} />
              : <MenuPreview theme={theme} />}
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-center">
            {previewMode === 'landing' ? 'Anteprima landing clienti' : 'Anteprima layout piatti'}
          </p>
        </div>

      </div>
    </div>
  )
}
