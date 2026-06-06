'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveTheme } from './actions'
import {
  DEFAULT_THEME,
  SERIF_FONTS,
  SANS_FONTS,
  googleFontsUrl,
  fontStack,
  borderRadiusPx,
} from '@/lib/theme'
import type { RestaurantTheme } from '@/lib/theme'

interface Props {
  restaurantId:   string
  restaurantName: string
  restaurantLogo: string | null
  initialTheme:   RestaurantTheme
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

// ── Section heading ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">
      {children}
    </p>
  )
}

// ── Color picker row ──────────────────────────────────────────────────────────

function ColorRow({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs text-gray-600 min-w-0 flex-1">{label}</label>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-gray-400 font-mono w-16 text-right">{value}</span>
        <div className="relative w-8 h-8 border border-gray-200 overflow-hidden rounded-sm">
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 w-[150%] h-[150%] -top-1 -left-1 cursor-pointer border-0 p-0 bg-transparent"
          />
        </div>
      </div>
    </div>
  )
}

// ── Radio pill group ──────────────────────────────────────────────────────────

function PillGroup<T extends string>({
  options, value, onChange,
}: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs border transition-colors ${
            value === o.value
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Font selector ─────────────────────────────────────────────────────────────

function FontSelector({
  label, value, curated, onChange,
}: { label: string; value: string; curated: string[]; onChange: (v: string) => void }) {
  const isCustom = !curated.includes(value)
  const [customMode, setCustomMode] = useState(isCustom)
  const [customVal, setCustomVal] = useState(isCustom ? value : '')

  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      <div className="flex gap-2">
        {!customMode ? (
          <select
            value={value}
            onChange={e => {
              if (e.target.value === '__custom__') { setCustomMode(true); return }
              onChange(e.target.value)
            }}
            className="flex-1 px-2 py-1.5 border border-gray-200 text-xs bg-white focus:outline-none focus:border-gray-400"
          >
            {curated.map(f => <option key={f} value={f}>{f}</option>)}
            <option value="__custom__">Altro (Google Font)…</option>
          </select>
        ) : (
          <div className="flex-1 flex gap-1">
            <input
              type="text"
              value={customVal}
              onChange={e => setCustomVal(e.target.value)}
              placeholder="es. Abril Fatface"
              className="flex-1 px-2 py-1.5 border border-gray-200 text-xs focus:outline-none focus:border-gray-400"
              onBlur={() => { if (customVal.trim()) onChange(customVal.trim()) }}
              onKeyDown={e => { if (e.key === 'Enter' && customVal.trim()) onChange(customVal.trim()) }}
            />
            <button
              type="button"
              onClick={() => { setCustomMode(false); onChange(curated[0]) }}
              className="text-[10px] text-gray-400 hover:text-gray-600 px-1"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      <p
        className="mt-1 text-[11px]"
        style={{ fontFamily: fontStack(value, 'serif'), color: '#666' }}
      >
        {value} — Il tuo menù in questo font
      </p>
    </div>
  )
}

// ── Mini landing preview ──────────────────────────────────────────────────────

function LandingPreview({
  theme, restaurantName, restaurantLogo,
}: { theme: RestaurantTheme; restaurantName: string; restaurantLogo: string | null }) {
  const SERIF = fontStack(theme.fontSerif, 'serif')
  const SANS  = fontStack(theme.fontSans, 'sans')
  const R     = borderRadiusPx(theme.borderRadius)

  return (
    <div
      className="relative overflow-hidden flex flex-col items-center justify-center"
      style={{
        background:  theme.pageBg,
        aspectRatio: '9 / 16',
        maxHeight:   460,
        fontFamily:  SANS,
      }}
    >
      {/* bg image overlay */}
      {theme.bgImage && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:    `url(${theme.bgImage})`,
            backgroundSize:     'cover',
            backgroundPosition: 'center',
            opacity:            (theme.bgImageOpacity ?? 30) / 100,
          }}
        />
      )}

      {/* top line */}
      <div className="absolute top-0 inset-x-0 h-px"
        style={{ background: `linear-gradient(90deg,transparent,${theme.accent}55,transparent)` }} />

      <div className="relative flex flex-col items-center text-center px-8 w-full">
        {restaurantLogo ? (
          <img src={restaurantLogo} alt="" className="h-8 object-contain mb-4" style={{ opacity: 0.88 }} />
        ) : (
          <>
            <div className="w-6 h-px mb-4" style={{ background: theme.accent }} />
            <h1
              className="font-light uppercase leading-none mb-4"
              style={{ color: theme.textPrimary, fontFamily: SERIF, fontSize: 'clamp(0.9rem,3vw,1.2rem)', letterSpacing: '0.22em' }}
            >
              {restaurantName}
            </h1>
            <div className="w-6 h-px mb-5" style={{ background: theme.accent }} />
          </>
        )}

        <div className="flex flex-col gap-2 w-full mt-2">
          {['Pranzo', 'Cena'].map(name => (
            <div
              key={name}
              className="px-6 py-2 text-center"
              style={{
                color:         theme.textPrimary,
                border:        `1px solid ${theme.accent}50`,
                borderRadius:  R,
                fontFamily:    SANS,
                fontSize:      '0.5rem',
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
              }}
            >
              {`Sfoglia il menu ${name}`}
            </div>
          ))}
        </div>

        {/* social placeholder dots */}
        <div className="flex gap-3 mt-5">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full"
              style={{ background: `${theme.accent}60` }}
            />
          ))}
        </div>
      </div>

      {/* bottom line */}
      <div className="absolute bottom-0 inset-x-0 h-px"
        style={{ background: `linear-gradient(90deg,transparent,${theme.accent}55,transparent)` }} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CustomizationClient({
  restaurantId, restaurantName, restaurantLogo, initialTheme,
}: Props) {
  const [theme,   setTheme]   = useState<RestaurantTheme>(initialTheme)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [bgUploading, setBgUploading] = useState(false)

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
      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Personalizzazione</h2>
          <p className="text-xs text-gray-400 mt-0.5">Le modifiche si applicano al menu clienti in tempo reale dopo il salvataggio.</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-600">Salvato.</span>}
          {error && <span className="text-xs text-red-500">{error}</span>}
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Ripristina
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-gray-900 text-white text-xs font-medium px-4 py-2 hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </div>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">

        {/* ── LEFT: Controls ─────────────────────────────────────────────── */}
        <div className="space-y-8">

          {/* Colori */}
          <div>
            <SectionLabel>Colori</SectionLabel>
            <div className="bg-white border border-gray-100 p-4 space-y-3">
              <ColorRow label="Colore accento"         value={theme.accent}       onChange={v => set('accent', v)} />
              <ColorRow label="Sfondo landing"         value={theme.pageBg}       onChange={v => set('pageBg', v)} />
              <ColorRow label="Barra navigazione"      value={theme.navBg}        onChange={v => set('navBg', v)} />
              <ColorRow label="Testo principale"       value={theme.textPrimary}  onChange={v => set('textPrimary', v)} />
              <ColorRow label="Testo secondario"       value={theme.textMuted}    onChange={v => set('textMuted', v)} />
            </div>
          </div>

          {/* Tipografia */}
          <div>
            <SectionLabel>Tipografia</SectionLabel>
            <div className="bg-white border border-gray-100 p-4 space-y-4">
              <FontSelector
                label="Font titoli (nome ristorante, piatti)"
                value={theme.fontSerif}
                curated={SERIF_FONTS}
                onChange={v => set('fontSerif', v)}
              />
              <FontSelector
                label="Font testi (label, bottoni, descrizioni)"
                value={theme.fontSans}
                curated={SANS_FONTS}
                onChange={v => set('fontSans', v)}
              />
            </div>
          </div>

          {/* Stile bordi */}
          <div>
            <SectionLabel>Stile bordi</SectionLabel>
            <div className="bg-white border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-3">Applica a bottoni, card prodotti e modal.</p>
              <PillGroup
                options={[
                  { label: 'Netto',        value: 'none' as const },
                  { label: 'Arrotondato',  value: 'sm'   as const },
                  { label: 'Morbido',      value: 'md'   as const },
                ]}
                value={theme.borderRadius}
                onChange={v => set('borderRadius', v)}
              />
            </div>
          </div>

          {/* Sfondo landing */}
          <div>
            <SectionLabel>Sfondo landing (opzionale)</SectionLabel>
            <div className="bg-white border border-gray-100 p-4 space-y-3">
              <p className="text-xs text-gray-500">
                Immagine/texture sovrapposta allo sfondo scuro. Usa immagini con basso contrasto per non disturbare il testo.
              </p>
              {theme.bgImage && (
                <div className="relative inline-block">
                  <img src={theme.bgImage} alt="Sfondo" className="w-24 h-16 object-cover border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => set('bgImage', undefined)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={e => e.target.files?.[0] && handleBgUpload(e.target.files[0])}
                className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50 cursor-pointer"
              />
              {bgUploading && <p className="text-xs text-gray-400">Caricamento…</p>}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Opacità sfondo: <span className="font-medium text-gray-700">{theme.bgImageOpacity}%</span>
                </label>
                <input
                  type="range"
                  min={5} max={80} step={5}
                  value={theme.bgImageOpacity}
                  onChange={e => set('bgImageOpacity', Number(e.target.value))}
                  className="w-full accent-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Layout PDF */}
          <div>
            <SectionLabel>Layout PDF</SectionLabel>
            <div className="bg-white border border-gray-100 p-4 space-y-3">
              <PillGroup
                options={[
                  { label: 'Classic',  value: 'classic' as const },
                  { label: 'Compact',  value: 'compact' as const },
                ]}
                value={theme.pdfLayout}
                onChange={v => set('pdfLayout', v)}
              />
              <p className="text-[11px] text-gray-400">
                {theme.pdfLayout === 'classic'
                  ? 'Una categoria per pagina. Margini generosi, ideale per menù eleganti.'
                  : 'Più categorie per pagina. Formato denso, ideale per menù con molti piatti.'}
              </p>
            </div>
          </div>

        </div>

        {/* ── RIGHT: Live preview ─────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 mb-2">
            Preview live
          </p>
          <div className="border border-gray-100 overflow-hidden">
            <LandingPreview
              theme={theme}
              restaurantName={restaurantName}
              restaurantLogo={restaurantLogo}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-center">
            Anteprima della landing page clienti
          </p>
        </div>

      </div>
    </div>
  )
}
