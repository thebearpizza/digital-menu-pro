'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveTheme, createBanner, deleteBanner, saveInfo } from './actions'

interface Banner {
  id: string
  media_url: string | null
  media_type: string
  title: string | null
  subtitle: string | null
  transition: string | null
  sort_order: number
  is_active: boolean
}

interface Info {
  id?: string
  title: string | null
  content: string | null
  is_active: boolean
}

interface Theme {
  fontHeading?: string
  fontBody?: string
  palette?: {
    bg?: string
    accent?: string
    primary?: string
  }
}

interface Props {
  restaurantId: string
  initialTheme: Theme
  initialBanners: Banner[]
  initialInfo: Info | null
}

const FONTS = ['Inter', 'Playfair Display', 'Lora', 'Montserrat', 'Roboto Slab', 'EB Garamond']

export default function CustomizationClient({ restaurantId, initialTheme, initialBanners, initialInfo }: Props) {
  const [activeTab, setActiveTab] = useState<'tema' | 'banner' | 'info'>('tema')

  // Theme
  const [theme, setTheme]     = useState<Theme>(initialTheme ?? {})
  const [themeSaving, setThemeSaving] = useState(false)
  const [themeSaved, setThemeSaved]   = useState(false)

  // Banners
  const [banners, setBanners]         = useState(initialBanners)
  const [uploading, setUploading]     = useState(false)
  const [bannerTitle, setBannerTitle] = useState('')
  const [bannerSub, setBannerSub]     = useState('')

  // Info
  const [infoTitle, setInfoTitle]     = useState(initialInfo?.title ?? 'Informazioni')
  const [infoContent, setInfoContent] = useState(initialInfo?.content ?? '')
  const [infoActive, setInfoActive]   = useState(initialInfo?.is_active ?? true)
  const [infoSaving, setInfoSaving]   = useState(false)
  const [infoSaved, setInfoSaved]     = useState(false)

  async function handleThemeSave() {
    setThemeSaving(true)
    try {
      await saveTheme(restaurantId, theme)
      setThemeSaved(true)
      setTimeout(() => setThemeSaved(false), 2000)
    } catch {}
    finally { setThemeSaving(false) }
  }

  async function handleBannerUpload(file: File) {
    setUploading(true)
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${restaurantId}/${Date.now()}.${ext}`
    const isVideo = file.type.startsWith('video/')
    const { data, error } = await supabase.storage
      .from('menu-banners').upload(path, file, { upsert: true })
    if (!error && data) {
      const { data: pub } = supabase.storage.from('menu-banners').getPublicUrl(data.path)
      const created = await createBanner(restaurantId, {
        media_url: pub.publicUrl,
        media_type: isVideo ? 'video' : 'image',
        title: bannerTitle || undefined,
        subtitle: bannerSub || undefined,
        sort_order: banners.length,
      })
      setBanners(prev => [...prev, created as Banner])
      setBannerTitle('')
      setBannerSub('')
    }
    setUploading(false)
  }

  async function handleDeleteBanner(id: string) {
    if (!confirm('Eliminare questo banner?')) return
    await deleteBanner(restaurantId, id)
    setBanners(prev => prev.filter(b => b.id !== id))
  }

  async function handleInfoSave() {
    setInfoSaving(true)
    try {
      await saveInfo(restaurantId, {
        title: infoTitle || 'Informazioni',
        content: infoContent,
        is_active: infoActive,
      })
      setInfoSaved(true)
      setTimeout(() => setInfoSaved(false), 2000)
    } catch {}
    finally { setInfoSaving(false) }
  }

  const SECTION_TABS = [
    { key: 'tema',   label: 'Tema grafico' },
    { key: 'banner', label: 'Banner benvenuto' },
    { key: 'info',   label: 'Card info' },
  ] as const

  return (
    <div>
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {SECTION_TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
              activeTab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TEMA */}
      {activeTab === 'tema' && (
        <div className="bg-white border border-gray-200 p-6 max-w-lg space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Font titoli</label>
              <select value={theme.fontHeading ?? 'Inter'}
                onChange={e => setTheme(t => ({ ...t, fontHeading: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-blue-500">
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Font corpo testo</label>
              <select value={theme.fontBody ?? 'Inter'}
                onChange={e => setTheme(t => ({ ...t, fontBody: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 text-sm bg-white focus:outline-none focus:border-blue-500">
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { key: 'bg',      label: 'Sfondo pagina', default: '#fffaf5' },
              { key: 'primary', label: 'Colore primario', default: '#b45309' },
              { key: 'accent',  label: 'Accento',        default: '#f59e0b' },
            ].map(c => (
              <div key={c.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{c.label}</label>
                <input type="color"
                  value={(theme.palette as any)?.[c.key] ?? c.default}
                  onChange={e => setTheme(t => ({
                    ...t, palette: { ...(t.palette ?? {}), [c.key]: e.target.value }
                  }))}
                  className="w-full h-9 border border-gray-300 cursor-pointer p-0.5"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleThemeSave} disabled={themeSaving}
              className="bg-blue-600 text-white text-sm font-medium px-5 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {themeSaving ? 'Salvataggio…' : 'Salva tema'}
            </button>
            {themeSaved && <span className="text-xs text-green-600">Salvato.</span>}
          </div>
        </div>
      )}

      {/* BANNER */}
      {activeTab === 'banner' && (
        <div className="space-y-5">
          {banners.length > 0 && (
            <div className="bg-white border border-gray-200">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Banner attivi ({banners.length})
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {banners.map(b => (
                  <div key={b.id} className="flex items-center gap-4 px-4 py-3">
                    {b.media_type === 'image' && b.media_url ? (
                      <img src={b.media_url} alt="" className="w-16 h-10 object-cover border border-gray-200" />
                    ) : (
                      <div className="w-16 h-10 bg-gray-100 border border-gray-200 flex items-center justify-center text-xs text-gray-400">
                        Video
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{b.title || '—'}</p>
                      <p className="text-xs text-gray-400 truncate">{b.subtitle || ''}</p>
                    </div>
                    <button onClick={() => handleDeleteBanner(b.id)}
                      className="text-xs text-red-500 hover:underline shrink-0">
                      Elimina
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 p-5 max-w-md space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aggiungi banner</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Titolo (opzionale)</label>
                <input type="text" value={bannerTitle} onChange={e => setBannerTitle(e.target.value)}
                  placeholder="Es. Benvenuti"
                  className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sottotitolo (opzionale)</label>
                <input type="text" value={bannerSub} onChange={e => setBannerSub(e.target.value)}
                  placeholder="Es. Scopri il nostro menu"
                  className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Immagine o video</label>
              <input type="file" accept="image/*,video/*"
                onChange={e => e.target.files?.[0] && handleBannerUpload(e.target.files[0])}
                className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-300 file:text-xs file:bg-white file:text-gray-700 hover:file:bg-gray-50 cursor-pointer"
              />
              {uploading && <p className="text-xs text-gray-400 mt-1">Caricamento…</p>}
            </div>
          </div>
        </div>
      )}

      {/* INFO */}
      {activeTab === 'info' && (
        <div className="bg-white border border-gray-200 p-6 max-w-lg space-y-4">
          <p className="text-xs text-gray-500">
            La card Info appare nel menu cliente. Puoi inserire orari, note, contatti.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Titolo card</label>
            <input type="text" value={infoTitle} onChange={e => setInfoTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contenuto</label>
            <textarea value={infoContent} onChange={e => setInfoContent(e.target.value)}
              rows={6} placeholder="Orari: Lun-Ven 12:00-22:00&#10;Tel. 06 1234567&#10;…"
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={infoActive} onChange={e => setInfoActive(e.target.checked)}
              className="accent-blue-600" />
            Mostra nel menu cliente
          </label>
          <div className="flex items-center gap-3">
            <button onClick={handleInfoSave} disabled={infoSaving}
              className="bg-blue-600 text-white text-sm font-medium px-5 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {infoSaving ? 'Salvataggio…' : 'Salva info'}
            </button>
            {infoSaved && <span className="text-xs text-green-600">Salvato.</span>}
          </div>
        </div>
      )}
    </div>
  )
}
