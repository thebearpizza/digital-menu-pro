'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveTheme, createBanner, deleteBanner } from './actions'
import {
  DEFAULT_THEME, SERIF_FONTS, SANS_FONTS,
  googleFontsUrl, fontStack, formatPrice,
} from '@/lib/theme'
import type { RestaurantTheme } from '@/lib/theme'

// Max upload size for landing media (banners + background video).
const MAX_MEDIA_BYTES = 5 * 1024 * 1024 // 5MB

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

// ── Font loader (for the admin-side live previews of font pickers) ─────────────

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

// ── Live preview iframe (real /m/[token] page + postMessage bridge) ────────────

function LivePreview({ qrToken, theme, previewMode }: {
  qrToken: string | null; theme: RestaurantTheme; previewMode: 'landing' | 'menu'
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const readyRef  = useRef(false)

  function post(msg: object) {
    iframeRef.current?.contentWindow?.postMessage(msg, window.location.origin)
  }

  // Receive the iframe's "ready" handshake, then push the current draft state.
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
  }, [theme, previewMode])

  // Debounced theme push — only fires once the user pauses, so dragging a color
  // or font slider stays buttery even on slow machines.
  useEffect(() => {
    if (!readyRef.current) return
    const id = setTimeout(() => post({ type: 'dmp-theme', theme }), 150)
    return () => clearTimeout(id)
  }, [theme])

  // Navigate the preview between landing and menu.
  useEffect(() => {
    if (!readyRef.current) return
    post({ type: 'dmp-nav', view: previewMode })
  }, [previewMode])

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
  const [banners, setBanners] = useState<AdminBanner[]>(initialBanners)
  const [uploading, setUploading] = useState(false)
  const [newTitle,    setNewTitle]    = useState('')
  const [newSubtitle, setNewSubtitle] = useState('')
  const [error, setError] = useState<string | null>(null)
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
  restaurantId, qrToken, initialTheme, initialBanners,
}: Props) {
  const [theme,        setTheme]        = useState<RestaurantTheme>(initialTheme)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [bgUploading,  setBgUploading]  = useState(false)
  const [vidUploading, setVidUploading] = useState(false)
  const [previewMode,  setPreviewMode]  = useState<'landing' | 'menu'>('landing')

  usePreviewFonts(theme.fontSerif, theme.fontSans)

  function set<K extends keyof RestaurantTheme>(key: K, value: RestaurantTheme[K]) {
    setSaved(false); setTheme(t => ({ ...t, [key]: value }))
  }
  function setFs(key: keyof RestaurantTheme['fontSizes'], value: number) {
    setSaved(false); setTheme(t => ({ ...t, fontSizes: { ...t.fontSizes, [key]: value } }))
  }

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
      // Cache-bust so the iframe preview reloads a replaced file at the same path.
      set('bgImage', `${pub.publicUrl}?v=${Date.now()}`)
    } else if (err) setError('Upload: ' + err.message)
    setBgUploading(false)
  }

  async function handleVideoUpload(file: File) {
    if (file.size > MAX_MEDIA_BYTES) { setError('Video troppo grande (max 5MB).'); return }
    setVidUploading(true); setError(null)
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'mp4'
    const path = `${restaurantId}/theme-video.${ext}`
    const { data, error: err } = await supabase.storage
      .from('restaurant-assets').upload(path, file, { upsert: true })
    if (!err && data) {
      const { data: pub } = supabase.storage.from('restaurant-assets').getPublicUrl(data.path)
      set('bgVideo', `${pub.publicUrl}?v=${Date.now()}`)
    } else if (err) setError('Upload: ' + err.message)
    setVidUploading(false)
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
          <p className="text-xs text-gray-400 mt-0.5">Anteprima dal vivo a destra. Le modifiche si applicano al menu clienti dopo il salvataggio.</p>
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
                <p className="text-[10px] text-gray-400 mb-2 uppercase tracking-wider">Pagine PDF (il &quot;foglio&quot; del menù)</p>
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
                  Opacità media: <span className="font-medium text-gray-700">{theme.bgImageOpacity}%</span>
                </label>
                <input type="range" min={5} max={100} step={5} value={theme.bgImageOpacity}
                  onChange={e => set('bgImageOpacity', Number(e.target.value))}
                  className="w-full accent-gray-900" />
              </div>
            </div>
          </div>

          {/* Sfondo video / immersione */}
          <div>
            <SectionLabel>Video di sfondo e immersione</SectionLabel>
            <div className="bg-white border border-gray-100 p-4 space-y-3">
              {theme.bgVideo && (
                <div className="relative inline-block">
                  <video src={theme.bgVideo} muted className="w-32 h-20 object-cover border border-gray-200 bg-black" />
                  <button type="button" onClick={() => set('bgVideo', undefined)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">×</button>
                </div>
              )}
              <input type="file" accept="video/*"
                onChange={e => e.target.files?.[0] && handleVideoUpload(e.target.files[0])}
                className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50 cursor-pointer" />
              {vidUploading && <p className="text-xs text-gray-400">Caricamento…</p>}
              <p className="text-[10px] text-gray-400">Max 5MB. MP4/WebM consigliati. Usa l&apos;opacità qui sopra anche per il video.</p>

              <label className={`flex items-start gap-2 pt-2 border-t border-gray-50 ${theme.bgVideo ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                <input type="checkbox" disabled={!theme.bgVideo}
                  checked={theme.immersiveTransition}
                  onChange={e => set('immersiveTransition', e.target.checked)}
                  className="mt-0.5 accent-gray-900" />
                <span className="text-xs text-gray-600">
                  Transizione immersiva
                  <span className="block text-[10px] text-gray-400">
                    Al tap su un menù la UI svanisce, il video parte e al termine si apre il menù. Senza spunta il video resta come sfondo in loop.
                  </span>
                </span>
              </label>
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

        {/* ── Live preview (70%, sticky, full-height iframe) ──────────────── */}
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
              {previewMode === 'landing' ? 'Schermata di benvenuto clienti' : 'Pagine menù reali'}
            </span>
          </div>

          {/* Preview area — real /m/[token] page inside an iframe */}
          <div className="flex-1 min-h-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 rounded-lg overflow-hidden p-6">
            <LivePreview qrToken={qrToken} theme={theme} previewMode={previewMode} />
          </div>

          <p className="text-[10px] text-center text-gray-400 mt-2 shrink-0">
            Anteprima dal vivo della pagina reale · le modifiche non salvate sono visibili solo qui
          </p>
        </div>

      </div>
    </div>
  )
}
