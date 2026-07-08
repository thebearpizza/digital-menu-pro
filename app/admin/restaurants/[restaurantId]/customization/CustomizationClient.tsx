'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveTheme, createBanner, deleteBanner } from './actions'
import {
  DEFAULT_THEME, SERIF_FONTS, SANS_FONTS, DISPLAY_FONTS, PAGINATION_OPTIONS,
  MENU_BG_EFFECTS, MENU_BG_EFFECT_LABELS, CURRENCY_OPTIONS,
  googleFontsUrl, allThemeFonts, fontStack, formatPrice, customFontFaceCss, CUSTOM_FONT_EXTENSIONS,
  resolveMenuTheme,
} from '@/lib/theme'
import { ALL_GOOGLE_FONTS } from '@/lib/googleFontsCatalog'
import { PRESETS, applyBaseFont, applyBaseSurface, applyBaseText, applyBaseAccent } from '@/lib/themePresets'
import type { ThemePreset } from '@/lib/themePresets'
import { removeUniformBackground } from '@/lib/imageBackground'
import { getRecentFonts, addRecentFont } from '@/lib/recentFonts'
import { useStaggerEntrance } from '@/lib/animations'
import { Spinner } from '@/components/ui/Spinner'
import type {
  RestaurantTheme, LandingTheme, LandingBackground, MenuTheme, CardTheme,
  MenuBgEffect, PaginationStyle, AlignOpt, AllergenDisplay, PricePosition, DividerType,
  CategoryFlourish, DishLayout, AdConfig,
} from '@/lib/theme'

const MAX_MEDIA_BYTES = 5 * 1024 * 1024 // 5MB
const MAX_FONT_BYTES  = 2 * 1024 * 1024 // 2MB

function slugifyFontName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'font'
}

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

    // Il frame 0 è spesso NERO (video con fade-in dal nero): il poster viene
    // catturato ~1s dentro il video (o a 1/4 della durata se più corto), così
    // la landing non rivela mai "sfondo nero + bottoni" in attesa del play.
    video.addEventListener('loadeddata', () => {
      const t = Math.min(1, (isFinite(video.duration) ? video.duration : 4) * 0.25)
      if (t <= 0.05) { draw(); return }
      video.addEventListener('seeked', draw, { once: true })
      try { video.currentTime = t } catch { draw() }
    }, { once: true })
    video.addEventListener('error', () => { cleanup(); resolve(null) }, { once: true })
    video.load()
  })
}

// ── Video compression ─────────────────────────────────────────────────────────
// Re-encodes a video in-browser by drawing each frame onto a downscaled canvas and
// recording the canvas stream with MediaRecorder at a capped bitrate. Returns the
// original file untouched if the browser can't re-encode (no MediaRecorder/codec).

async function compressVideoFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<File> {
  if (typeof MediaRecorder === 'undefined') return file

  // Pick a supported codec, preferring VP9 → VP8 → default webm.
  const mimeCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  const mimeType = mimeCandidates.find(m => MediaRecorder.isTypeSupported(m))
  if (!mimeType) return file

  return new Promise<File>(resolve => {
    const video = document.createElement('video')
    const url   = URL.createObjectURL(file)
    video.src = url; video.muted = true; video.playsInline = true

    const done = (result: File) => { URL.revokeObjectURL(url); resolve(result) }

    video.addEventListener('loadedmetadata', () => {
      const maxW   = 1280
      const ratio  = Math.min(maxW / (video.videoWidth || maxW), 1)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round((video.videoWidth  || 1280) * ratio)
      canvas.height = Math.round((video.videoHeight || 720)  * ratio)
      const ctx = canvas.getContext('2d')
      if (!ctx) { done(file); return }

      let stream: MediaStream
      try { stream = (canvas as any).captureStream(30) } catch { done(file); return }

      const chunks: BlobPart[] = []
      let recorder: MediaRecorder
      try {
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_200_000 })
      } catch { done(file); return }

      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        // If compression didn't actually shrink it, keep the original.
        if (blob.size === 0 || blob.size >= file.size) { done(file); return }
        const name = file.name.replace(/\.[^.]+$/, '') + '.webm'
        done(new File([blob], name, { type: 'video/webm' }))
      }

      const duration = video.duration || 0
      const drawLoop = () => {
        if (video.ended || video.paused) return
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        if (duration && onProgress) onProgress(Math.min(99, Math.round((video.currentTime / duration) * 100)))
        requestAnimationFrame(drawLoop)
      }

      video.addEventListener('ended', () => { try { recorder.stop() } catch {} }, { once: true })
      // Safety cap: stop after 30s of source even if 'ended' never fires.
      const cap = setTimeout(() => { try { recorder.stop() } catch {} }, Math.min((duration || 30) * 1000 + 2000, 32000))
      recorder.onerror = () => { clearTimeout(cap); done(file) }

      recorder.start(250)
      video.play().then(() => requestAnimationFrame(drawLoop)).catch(() => { clearTimeout(cap); done(file) })
    }, { once: true })

    video.addEventListener('error', () => done(file), { once: true })
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

interface MenuSummary {
  id:   string
  name: string
}

interface Props {
  restaurantId:   string
  restaurantName: string
  restaurantLogo: string | null
  qrToken:        string | null
  initialTheme:   RestaurantTheme
  initialBanners: AdminBanner[]
  menus:          MenuSummary[]
}

// ── Font loader ───────────────────────────────────────────────────────────────

function usePreviewFonts(theme: RestaurantTheme) {
  const customNames = new Set(Object.keys(theme.customFonts))
  const fontsKey = allThemeFonts(theme).filter(f => !customNames.has(f)).join(',')
  useEffect(() => {
    const href = googleFontsUrl(allThemeFonts(theme).filter(f => !customNames.has(f)))
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

  const customFontsKey = JSON.stringify(theme.customFonts)
  useEffect(() => {
    let style = document.querySelector('style[data-admin-custom-fonts]') as HTMLStyleElement | null
    const css = customFontFaceCss(theme.customFonts)
    if (!css) { if (style) style.textContent = ''; return }
    if (!style) {
      style = document.createElement('style')
      style.setAttribute('data-admin-custom-fonts', '1')
      document.head.appendChild(style)
    }
    style.textContent = css
  }, [customFontsKey]) // eslint-disable-line react-hooks/exhaustive-deps
}

// ── Fill-height hook ───────────────────────────────────────────────────────────
// Measures the wrapper's distance from the top of the viewport and stretches it
// to the bottom edge (minus a small margin) so the preview always uses every
// available pixel — no fixed-offset guessing, no leftover bottom gap, no scroll.

function useFillHeight() {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const top = el.getBoundingClientRect().top
      setHeight(Math.max(window.innerHeight - top - 12, 360))
    }
    measure()
    // rAF catches the post-layout position once fonts/chrome settle.
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      ro.disconnect()
    }
  }, [])
  return { ref, height }
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

// Posizione libera di un elemento landing: offset orizzontale + verticale (rem).
// A (0,0) l'elemento resta nel flusso base; spostandolo può sovrapporsi agli altri.
function PositionRow({ pos, onChange }: {
  pos: { x: number; y: number }
  onChange: (p: Partial<{ x: number; y: number }>) => void
}) {
  const moved = pos.x !== 0 || pos.y !== 0
  return (
    <div className="pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Posizione</p>
        {moved && (
          <button type="button" onClick={() => onChange({ x: 0, y: 0 })}
            className="text-[11px] text-gray-400 hover:text-gray-600 underline">
            Reimposta
          </button>
        )}
      </div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs text-gray-600">Orizzontale</label>
        <span className="text-[10px] font-mono text-gray-400">{pos.x}rem</span>
      </div>
      <input type="range" min={-12} max={12} step={0.25} value={pos.x}
        onChange={e => onChange({ x: Number(e.target.value) })}
        className="w-full accent-gray-900" />
      <div className="flex justify-between items-center mb-1 mt-2">
        <label className="text-xs text-gray-600">Verticale</label>
        <span className="text-[10px] font-mono text-gray-400">{pos.y}rem</span>
      </div>
      <input type="range" min={-12} max={12} step={0.25} value={pos.y}
        onChange={e => onChange({ y: Number(e.target.value) })}
        className="w-full accent-gray-900" />
      <p className="text-[10px] text-gray-400 mt-1">Sposta l&apos;elemento; a 0 torna nel layout di base.</p>
    </div>
  )
}

// Alignment control with an "inherit from general" option.
function AlignRow({ label, value, onChange, withInherit = true }: {
  label: string; value: AlignOpt; onChange: (v: AlignOpt) => void; withInherit?: boolean
}) {
  const opts: { label: string; value: AlignOpt }[] = [
    ...(withInherit ? [{ label: 'Generale', value: 'inherit' as AlignOpt }] : []),
    { label: 'Sx', value: 'left' }, { label: 'Centro', value: 'center' }, { label: 'Dx', value: 'right' },
  ]
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{label}</p>
      <PillGroup options={opts} value={value} onChange={onChange} />
    </div>
  )
}

// Separator picker for allergen lists.
function SeparatorRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = [
    { label: 'Virgola', value: ', ' },
    { label: 'Punto', value: ' · ' },
    { label: 'Barra', value: ' | ' },
    { label: 'Trattino', value: ' - ' },
  ]
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Separatore</p>
      <PillGroup options={opts} value={value} onChange={onChange} />
    </div>
  )
}

// Searchable font picker — spans the full Google Fonts catalog (1500+ families)
// plus a curated shortlist shown first. Renders inline (no absolute dropdown) so
// it never gets clipped by the sidebar's overflow containers. Each visible option
// is previewed in its own font, loaded on demand.

function FontSelector({ label, value, curated, category, onChange, customFonts = {}, onUploadFont, uploading = false }: {
  label: string; value: string; curated: string[]; category: 'serif' | 'sans'; onChange: (v: string) => void
  customFonts?: Record<string, string>
  onUploadFont?: (file: File) => Promise<string | null>
  uploading?: boolean
}) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const fontFileRef = useRef<HTMLInputElement>(null)
  const customNames = Object.keys(customFonts)

  useEffect(() => { if (open) setRecent(getRecentFonts()) }, [open])

  const q = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (!q) {
      const rest = ALL_GOOGLE_FONTS.filter(f => !curated.includes(f) && !recent.includes(f))
      return [...curated.filter(f => !recent.includes(f)), ...rest].slice(0, 80)
    }
    return ALL_GOOGLE_FONTS.filter(f => f.toLowerCase().includes(q)).slice(0, 80)
  }, [q, curated, recent])

  // A typed name not found in the curated catalog — let the user use it as a
  // custom Google Font (any valid family name works, even if not listed).
  const customName = query.trim()
  const isCustom = customName.length > 1
    && !ALL_GOOGLE_FONTS.some(f => f.toLowerCase() === customName.toLowerCase())

  // Load the fonts currently visible in the list so each option previews itself.
  // Debounced so fast typing doesn't fire a fetch per keystroke.
  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => {
      const href = googleFontsUrl(isCustom ? [...results, customName] : results)
      if (!href) return
      let link = document.querySelector('link[data-font-search]') as HTMLLinkElement | null
      if (!link) {
        link = document.createElement('link')
        link.rel = 'stylesheet'
        link.setAttribute('data-font-search', '1')
        document.head.appendChild(link)
      }
      link.href = href
    }, 250)
    return () => clearTimeout(id)
  }, [open, results, isCustom, customName])

  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1.5 border border-gray-200 text-xs bg-white hover:border-gray-400 transition-colors">
        <span className="truncate" style={{ fontFamily: fontStack(value, category) }}>{value}</span>
        <span className="text-gray-300 ml-2 shrink-0">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="mt-1 border border-gray-200 rounded-sm bg-white">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder={`Cerca tra ${ALL_GOOGLE_FONTS.length} font…`}
              className="w-full px-2 py-1.5 border border-gray-200 text-xs focus:outline-none focus:border-gray-400" />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {!q && customNames.length > 0 && (
              <>
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Font caricati</p>
                {customNames.map(f => (
                  <button key={`custom-${f}`} type="button"
                    onClick={() => { onChange(f); setOpen(false); setQuery('') }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors ${f === value ? 'bg-gray-100' : ''}`}
                    style={{ fontFamily: fontStack(f, category) }}>
                    {f}
                  </button>
                ))}
                <div className="border-t border-gray-100" />
              </>
            )}
            {!q && recent.length > 0 && (
              <>
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Usati di recente</p>
                {recent.map(f => (
                  <button key={`recent-${f}`} type="button"
                    onClick={() => { addRecentFont(f); onChange(f); setOpen(false); setQuery('') }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors ${f === value ? 'bg-gray-100' : ''}`}
                    style={{ fontFamily: fontStack(f, category) }}>
                    {f}
                  </button>
                ))}
                <div className="border-t border-gray-100" />
              </>
            )}
            {results.length === 0 && (
              <p className="px-3 py-3 text-[11px] text-gray-400">Nessun font trovato.</p>
            )}
            {results.map(f => (
              <button key={f} type="button"
                onClick={() => { addRecentFont(f); onChange(f); setOpen(false); setQuery('') }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors ${f === value ? 'bg-gray-100' : ''}`}
                style={{ fontFamily: fontStack(f, category) }}>
                {f}
              </button>
            ))}
            {!q && results.length >= 80 && (
              <p className="px-3 py-2 text-[10px] text-gray-300">Digita per cercare tra tutti i {ALL_GOOGLE_FONTS.length} font…</p>
            )}
            {isCustom && (
              <button type="button"
                onClick={() => { addRecentFont(customName); onChange(customName); setOpen(false); setQuery('') }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 transition-colors border-t border-gray-100 text-blue-600"
                style={{ fontFamily: fontStack(customName, category) }}>
                Usa &ldquo;{customName}&rdquo; come font Google personalizzato
              </button>
            )}
            {onUploadFont && (
              <div className="border-t border-gray-100 p-2">
                <input ref={fontFileRef} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden"
                  onChange={async e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const name = await onUploadFont(f)
                    if (name) { addRecentFont(name); onChange(name); setOpen(false); setQuery('') }
                    if (fontFileRef.current) fontFileRef.current.value = ''
                  }} />
                <button type="button" disabled={uploading}
                  onClick={() => fontFileRef.current?.click()}
                  className="w-full text-left px-1 py-1 text-[11px] text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50">
                  {uploading ? 'Caricamento…' : '⤒ Carica file font (.ttf, .otf, .woff, .woff2)'}
                </button>
              </div>
            )}
          </div>
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

// ── Mobile chip bar config ────────────────────────────────────────────────────

const MOBILE_TARGETS: Record<'landing' | 'menu' | 'card' | 'hint', string[]> = {
  landing: ['landing-bg','landing-logo','landing-title','landing-desc','landing-buttons','landing-socials'],
  menu:    ['category-title','dish-title','dish-description','dish-price','allergens','background-layout','sticky-categories'],
  card:    ['card-style','card-category','dish-title','dish-description','dish-price','allergens','card-pairing'],
  hint:    ['menu-hint'],
}
const MOBILE_LABELS: Record<string, string> = {
  'landing-bg':       'Sfondo',    'landing-logo':     'Logo',
  'landing-title':    'Nome',      'landing-desc':     'Slogan',
  'landing-buttons':  'Bottoni',   'landing-socials':  'Social',
  'dish-title':       'Titolo',    'dish-description': 'Descr.',
  'dish-price':       'Prezzo',    'allergens':        'Allergeni',
  'category-title':   'Categoria', 'background-layout':'Layout',
  'sticky-categories':'Barra',     'card-style':       'Stile Card',
  'card-category':    'Categoria', 'card-pairing':     'Abbinam.',
  'menu-hint':        'Pop-up',
}

// ── Editor target registry ────────────────────────────────────────────────────

const EDITOR_TARGETS: Record<string, { title: string; hint: string }> = {
  'landing-bg':        { title: 'Sfondo Landing',     hint: 'Tipo, immagine, video, colore, texture, opacità' },
  'landing-logo':      { title: 'Logo',               hint: 'Immagine, dimensione, blend mode, spaziatura' },
  'landing-title':     { title: 'Nome Ristorante',    hint: 'Testo, font, colore, dimensione, peso' },
  'landing-desc':      { title: 'Slogan',             hint: 'Testo, font, colore, dimensione' },
  'landing-buttons':   { title: 'Bottoni Menu',       hint: 'Disposizione, larghezza, posizione, colori, font' },
  'landing-socials':   { title: 'Social & Accento',   hint: 'Colore accento, icone social, dimensione' },
  'dish-title':        { title: 'Titolo Piatto',      hint: 'Font, colore, dimensione, allineamento' },
  'dish-description':  { title: 'Descrizione Piatto', hint: 'Font, colore, dimensione, allineamento' },
  'dish-price':        { title: 'Prezzo',             hint: 'Font, colore, formato, valuta, posizione' },
  'category-title':    { title: 'Titolo Categoria',   hint: 'Font, colore, dimensione, allineamento' },
  'allergens':         { title: 'Allergeni',          hint: 'Stile, formato, separatore, colori' },
  'card-style':        { title: 'Stile Card',         hint: 'Sfondo card, bordi, pulsante chiudi, accento' },
  'card-category':     { title: 'Categoria (Card)',   hint: 'Colore e dimensione dell\'etichetta categoria nella card' },
  'card-pairing':      { title: 'Abbinamento',        hint: 'Colori dell\'etichetta e del prodotto consigliato' },
  'sticky-categories': { title: 'Barra Categorie',    hint: 'Stile, colori, font della barra categorie' },
  'menu-hint':         { title: 'Pop-up istruzioni',  hint: 'Testo, colori, font del pop-up "come sfogliare il menu"' },
  'background-layout': { title: 'Sfondo & Layout',    hint: 'Accento, sfondo menu, immagine, paginazione, spaziatura' },
}

// ── Sidebar setters interface ─────────────────────────────────────────────────

interface SidebarSetters {
  setLBg:            (p: Partial<LandingBackground>) => void
  setLLogo:          (p: Partial<LandingTheme['logo']>) => void
  setLTitle:         (p: Partial<LandingTheme['title']>) => void
  setLDesc:          (p: Partial<LandingTheme['description']>) => void
  setLBu:            (p: Partial<LandingTheme['buttons']>) => void
  setLPos:           (key: keyof LandingTheme['positions'], p: Partial<{ x: number; y: number }>) => void
  setL:              (p: Partial<LandingTheme>) => void
  setMDishes:        (p: Partial<MenuTheme['dishes']>) => void
  setMDescs:         (p: Partial<MenuTheme['descriptions']>) => void
  setMPrices:        (p: Partial<MenuTheme['prices']>) => void
  setMCats:          (p: Partial<MenuTheme['categories']>) => void
  setMLayout:        (p: Partial<MenuTheme['layout']>) => void
  setMDivider:       (p: Partial<MenuTheme['layout']['divider']>) => void
  setMBg:            (p: Partial<MenuTheme['background']>) => void
  setMPageBg:        (p: Partial<MenuTheme['pageBackground']>) => void
  setMNav:           (p: Partial<MenuTheme['navigation']>) => void
  setMSticky:        (p: Partial<MenuTheme['stickyCategories']>) => void
  setMHint:          (p: Partial<MenuTheme['hintPopup']>) => void
  setMAllergens:     (p: Partial<MenuTheme['allergens']>) => void
  setM:              (p: Partial<MenuTheme>) => void
  setC:              (p: Partial<CardTheme>) => void
  setCardTitle:      (p: Partial<CardTheme['title']>) => void
  setCardDesc:       (p: Partial<CardTheme['description']>) => void
  setCardPrice:      (p: Partial<CardTheme['price']>) => void
  setCardAllergens:  (p: Partial<CardTheme['allergens']>) => void
  setCardClose:      (p: Partial<CardTheme['closeButton']>) => void
  setCardCategory:   (p: Partial<CardTheme['category']>) => void
  setCardPairing:    (p: Partial<CardTheme['pairing']>) => void
  handleBgUpload:     (f: File) => void
  handleVideoUpload:  (f: File) => void
  handleMenuBgUpload: (f: File) => void
  handleMenuPageBgUpload: (f: File) => void
  handlePosterUpload: (f: File) => void
  handleLogoUpload:   (f: File) => void
  handleFontUpload:   (f: File) => Promise<string | null>
  bgUploading:        boolean
  vidUploading:       boolean
  menuBgUploading:    boolean
  pageBgUploading:    boolean
  posterUploading:    boolean
  logoUploading:      boolean
  fontUploading:      boolean
}

// ── Buttons panel — own state for transparent-bg toggle ───────────────────────

function ButtonsPanel({ l, setLBu, pos, onPos, customFonts, onUploadFont, fontUploading }: {
  l: LandingTheme; setLBu: (p: Partial<LandingTheme['buttons']>) => void
  pos: { x: number; y: number }
  onPos: (p: Partial<{ x: number; y: number }>) => void
  customFonts: Record<string, string>
  onUploadFont: (f: File) => Promise<string | null>
  fontUploading: boolean
}) {
  // Derived from the theme so it stays in sync after "Ripristina" / preset loads;
  // bgHex only remembers the last hex while the transparent checkbox is on.
  const bgTransparent = l.buttons.bgColor === 'transparent'
  const [bgHex, setBgHex] = useState(bgTransparent ? '#000000' : l.buttons.bgColor)
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Disposizione</p>
        <PillGroup
          options={[{ label:'Colonna', value:'column' },{ label:'Riga', value:'row' }]}
          value={l.buttons.layout}
          onChange={v => setLBu(
            // Passando a "riga" con la larghezza piena i bottoni andrebbero a
            // capo uno per riga: se è ancora larga, la porto a ~metà così stanno
            // affiancati subito (l'utente può poi regolarla).
            v === 'row' && l.buttons.width > 60 ? { layout: v, width: 48 } : { layout: v }
          )} />
      </div>
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-xs text-gray-600">Larghezza bottone</label>
          <span className="text-[10px] font-mono text-gray-400">{l.buttons.width}%</span>
        </div>
        <input type="range" min={20} max={100} step={1} value={l.buttons.width}
          onChange={e => setLBu({ width: Number(e.target.value) })}
          className="w-full accent-gray-900" />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Forma</p>
        <PillGroup
          options={[{ label:'Flat', value:'flat' },{ label:'Arrotondato', value:'rounded' },{ label:'Pill', value:'pill' }]}
          value={l.buttons.shape} onChange={v => setLBu({ shape: v })} />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Stile</p>
        <PillGroup
          options={[{ label:'2D', value:'flat2d' },{ label:'3D', value:'threed' }]}
          value={l.buttons.threeD ? 'threed' : 'flat2d'}
          onChange={v => setLBu({ threeD: v === 'threed' })} />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Bordo</p>
        <PillGroup
          options={[{ label:'Nessuno', value:'none' },{ label:'Solido', value:'solid' },{ label:'Tratteggiato', value:'dashed' }]}
          value={l.buttons.borderStyle} onChange={v => setLBu({ borderStyle: v })} />
      </div>
      {l.buttons.borderStyle !== 'none' && (<>
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-gray-600">Spessore bordo</label>
            <span className="text-[10px] font-mono text-gray-400">{l.buttons.borderWidth}px</span>
          </div>
          <input type="range" min={0} max={5} step={0.5} value={l.buttons.borderWidth}
            onChange={e => setLBu({ borderWidth: Number(e.target.value) })}
            className="w-full accent-gray-900" />
        </div>
        <ColorRow label="Colore bordo" value={l.buttons.borderColor} onChange={v => setLBu({ borderColor: v })} />
      </>)}
      <ColorRow label="Colore testo" value={l.buttons.textColor} onChange={v => setLBu({ textColor: v })} />
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={l.buttons.showBrowsePrefix}
          onChange={e => setLBu({ showBrowsePrefix: e.target.checked })}
          className="accent-gray-900 w-3.5 h-3.5" />
        <span className="text-xs text-gray-600">Mostra &ldquo;Sfoglia il menu&rdquo; prima del nome</span>
      </label>
      <div>
        <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
          <input type="checkbox" checked={bgTransparent}
            onChange={e => setLBu({ bgColor: e.target.checked ? 'transparent' : bgHex })}
            className="accent-gray-900 w-3.5 h-3.5" />
          <span className="text-xs text-gray-600">Sfondo trasparente</span>
        </label>
        {!bgTransparent && (<div className="space-y-3">
          <ColorRow label="Colore sfondo" value={l.buttons.bgColor}
            onChange={v => { setBgHex(v); setLBu({ bgColor: v }) }} />
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-gray-600">Opacità sfondo</label>
              <span className="text-[10px] font-mono text-gray-400">{l.buttons.bgOpacity}%</span>
            </div>
            <input type="range" min={0} max={100} step={1} value={l.buttons.bgOpacity}
              onChange={e => setLBu({ bgOpacity: Number(e.target.value) })}
              className="w-full accent-gray-900" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Effetto</p>
            <PillGroup
              options={[
                { label:'Pieno',   value:'solid' },
                { label:'Grad. ↓', value:'gradient-v' },
                { label:'Grad. →', value:'gradient-h' },
                { label:'Grad. ⤡', value:'gradient-diag' },
              ]}
              value={l.buttons.bgEffect}
              onChange={v => setLBu(
                // Primo passaggio a gradiente senza secondo colore: parte dal
                // colore base così l'effetto è subito visibile e regolabile.
                v !== 'solid' && !l.buttons.bgColor2
                  ? { bgEffect: v, bgColor2: l.buttons.bgColor }
                  : { bgEffect: v }
              )} />
          </div>
          {l.buttons.bgEffect !== 'solid' && (
            <ColorRow label="Secondo colore gradiente" value={l.buttons.bgColor2 || l.buttons.bgColor}
              onChange={v => setLBu({ bgColor2: v })} />
          )}
        </div>)}
      </div>
      <FontSelector label="Font bottoni" value={l.buttons.font} curated={SANS_FONTS} category="sans"
        onChange={v => setLBu({ font: v })}
        customFonts={customFonts} onUploadFont={onUploadFont} uploading={fontUploading} />
      <FontSizeSlider label="Dimensione testo" value={l.buttons.fontSize}
        min={0.5} max={1.2} step={0.025} previewFont={fontStack(l.buttons.font, 'sans')}
        onChange={v => setLBu({ fontSize: v })} />
      <PositionRow pos={pos} onChange={onPos} />
    </div>
  )
}

// ── Editor sidebar ────────────────────────────────────────────────────────────

function EditorSidebar({ target, theme, setters, previewMode, activeMenuId, onClose, restaurantName, restaurantLogo }: {
  target: string; theme: RestaurantTheme; setters: SidebarSetters
  previewMode: 'landing' | 'menu' | 'card' | 'hint'; activeMenuId: string | null; onClose: () => void
  restaurantName: string; restaurantLogo: string | null
}) {
  const info = EDITOR_TARGETS[target]
  const l    = theme.landing
  const m    = previewMode === 'menu' ? resolveMenuTheme(theme, activeMenuId) : theme.menu
  const c    = theme.card
  // Shared dish targets (title/desc/price/allergens) live in both Card and Menu.
  // Show only the section that matches the tab the user is editing from.
  const showCard = previewMode === 'card'
  const showMenu = previewMode !== 'card'
  const bgFileRef     = useRef<HTMLInputElement>(null)
  const videoFileRef  = useRef<HTMLInputElement>(null)
  const posterFileRef = useRef<HTMLInputElement>(null)
  const contentRef = useStaggerEntrance<HTMLDivElement>({
    duration: 420, staggerMs: 45, translateY: 10,
    selector: ':scope > div > *',
  })

  function renderControls() {
    switch (target) {

      case 'landing-bg': return (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tipo</p>
            <PillGroup
              options={[{ label:'Colore', value:'color' },{ label:'Immagine', value:'image' },{ label:'Video', value:'video' },{ label:'GIF', value:'gif' }]}
              value={l.background.type}
              onChange={v => setters.setLBg(
                // Switching back to color with a leftover media URL would make the
                // value an invalid CSS color — reset to the default hex.
                v === 'color' && !l.background.value.startsWith('#')
                  ? { type: v, value: '#0d0d0d' }
                  : { type: v }
              )} />
          </div>
          {l.background.type === 'color' && (
            <ColorRow label="Colore sfondo" value={l.background.value}
              onChange={v => setters.setLBg({ value: v })} />
          )}
          {(l.background.type === 'image' || l.background.type === 'gif') && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">File</p>
              {l.background.value?.startsWith('http') && (
                <img src={l.background.value} alt="" className="w-full h-20 object-cover border border-gray-200 mb-2 rounded" />
              )}
              <input ref={bgFileRef} type="file" accept="image/*"
                onChange={e => { const f = e.target.files?.[0]; if (f) setters.handleBgUpload(f) }}
                className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50 cursor-pointer w-full" />
              {setters.bgUploading && <p className="text-xs text-gray-400 mt-1">Caricamento…</p>}
            </div>
          )}
          {l.background.type === 'video' && (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">File video</p>
                <input ref={videoFileRef} type="file" accept="video/*"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setters.handleVideoUpload(f) }}
                  className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50 cursor-pointer w-full" />
                {setters.vidUploading && <p className="text-xs text-gray-400 mt-1">Caricamento…</p>}
              </div>
              {/* Loop is irrelevant in immersive mode (the video plays once as a
                  transition), so hide it to avoid a dead control. */}
              {!l.background.immersiveTransition && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Loop</p>
                  <PillGroup
                    options={[{ label:'Loop', value:'loop' },{ label:'Una volta', value:'once' },{ label:'Ping-pong', value:'pingpong' }]}
                    value={l.background.loopMode} onChange={v => setters.setLBg({ loopMode: v })} />
                </div>
              )}
            </div>
          )}
          {/* Opacity is meaningful only for image/video/gif overlays, not plain colors */}
          {l.background.type !== 'color' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-gray-600">Opacità</label>
                <span className="text-[10px] font-mono text-gray-400">{l.background.opacity}%</span>
              </div>
              <input type="range" min={0} max={100} step={1} value={l.background.opacity}
                onChange={e => setters.setLBg({ opacity: Number(e.target.value) })}
                className="w-full accent-gray-900" />
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Texture overlay</p>
            <PillGroup
              options={[{ label:'Nessuna', value:'none' },{ label:'Rumore', value:'noise' },{ label:'Grana', value:'grain' },{ label:'Legno', value:'wood' },{ label:'Marmo', value:'marble' }]}
              value={l.background.texture} onChange={v => setters.setLBg({ texture: v })} />
          </div>
          {/* Immersive transition only makes sense for video */}
          {l.background.type === 'video' && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Toggle checked={l.background.immersiveTransition}
                onChange={v => setters.setLBg({ immersiveTransition: v })} />
              <span className="text-xs text-gray-600">Transizione immersiva</span>
            </label>
          )}
          {/* Freeze-frame poster — shown when immersive transition is on, since the
              video doesn't autoplay and a manual still image is the reliable way to
              avoid a black background before the user taps a menu. */}
          {l.background.type === 'video' && l.background.immersiveTransition && (
            <div className="border-l-2 border-gray-200 pl-3 ml-1 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Fermo immagine</p>
              <p className="text-[11px] text-gray-400 leading-snug">
                Immagine statica mostrata prima che parta il video (consigliata: il primo fotogramma).
              </p>
              {l.background.poster && (
                <div className="relative">
                  <img src={l.background.poster} alt="" className="w-full h-20 object-cover border border-gray-200 rounded" />
                  <button type="button" onClick={() => setters.setLBg({ poster: undefined })}
                    className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-black/60 text-white text-xs rounded-full hover:bg-black/80">
                    &#x2715;
                  </button>
                </div>
              )}
              <input ref={posterFileRef} type="file" accept="image/*"
                onChange={e => { const f = e.target.files?.[0]; if (f) setters.handlePosterUpload(f) }}
                className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50 cursor-pointer w-full" />
              {setters.posterUploading && <p className="text-xs text-gray-400">Caricamento…</p>}
            </div>
          )}
        </div>
      )

      case 'landing-logo': return (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Immagine logo</p>
            {l.logo.image ? (
              <div className="flex items-center gap-3 mb-2">
                <img src={l.logo.image} alt="Logo" className="h-10 w-10 object-contain border border-gray-200 rounded bg-white" />
                <button type="button" onClick={() => setters.setLLogo({ image: '' })}
                  className="text-[11px] text-red-500 hover:text-red-600 underline">
                  Rimuovi (usa logo del ristorante)
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 mb-2">
                {restaurantLogo ? 'Verrà usato il logo del ristorante.' : 'Nessun logo impostato.'}
              </p>
            )}
            <input type="file" accept="image/*"
              onChange={e => { const f = e.target.files?.[0]; if (f) setters.handleLogoUpload(f) }}
              className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50 cursor-pointer w-full" />
            {setters.logoUploading && <p className="text-xs text-gray-400 mt-1">Caricamento…</p>}
          </div>
          <FontSizeSlider label="Dimensione logo" value={l.logo.size}
            min={1} max={8} step={0.25} previewFont="inherit"
            onChange={v => setters.setLLogo({ size: v })} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Blend mode</p>
            <PillGroup
              options={[{ label:'Normale', value:'normal' },{ label:'Multiply', value:'multiply' },{ label:'Screen', value:'screen' }]}
              value={l.logo.mixBlend} onChange={v => setters.setLLogo({ mixBlend: v })} />
          </div>
          <FontSizeSlider label="Spazio sotto logo" value={l.logo.gapBottom}
            min={0} max={6} step={0.25} previewFont="inherit"
            onChange={v => setters.setLLogo({ gapBottom: v })} />
          <PositionRow pos={l.positions.logo} onChange={p => setters.setLPos('logo', p)} />
        </div>
      )

      case 'landing-title': return (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Testo</p>
            <textarea value={l.title.text} placeholder={restaurantName}
              rows={Math.max(1, l.title.text.split('\n').length)}
              onChange={e => setters.setLTitle({ text: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-gray-400 resize-y" />
            <p className="text-[11px] text-gray-400 mt-1">Vuoto = usa il nome del ristorante ({restaurantName}). Premi Invio per andare a capo.</p>
          </div>
          <FontSelector label="Font" value={l.title.font}
            curated={[...SERIF_FONTS, ...DISPLAY_FONTS]} category="serif"
            onChange={v => setters.setLTitle({ font: v })}
            customFonts={theme.customFonts} onUploadFont={setters.handleFontUpload} uploading={setters.fontUploading} />
          <FontSizeSlider label="Grandezza riga 1" value={l.title.size}
            min={0.8} max={5} step={0.1} previewFont={fontStack(l.title.font, 'serif')}
            onChange={v => setters.setLTitle({ size: v })} />
          {l.title.text.split('\n').slice(1).map((_, i) => (
            <FontSizeSlider key={i} label={`Grandezza riga ${i + 2}`}
              value={l.title.lineSizes[i] ?? l.title.size}
              min={0.8} max={5} step={0.1} previewFont={fontStack(l.title.font, 'serif')}
              onChange={v => {
                const next = [...l.title.lineSizes]
                next[i] = v
                setters.setLTitle({ lineSizes: next })
              }} />
          ))}
          <ColorRow label="Colore" value={l.title.color} onChange={v => setters.setLTitle({ color: v })} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Peso</p>
            <PillGroup
              options={[{ label:'Light', value:'light' },{ label:'Normal', value:'normal' },{ label:'Bold', value:'bold' }]}
              value={l.title.weight} onChange={v => setters.setLTitle({ weight: v })} />
          </div>
          <FontSizeSlider label="Spazio sotto il nome" value={l.title.gapBottom}
            min={0} max={6} step={0.25} previewFont="inherit"
            onChange={v => setters.setLTitle({ gapBottom: v })} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Linee decorative</p>
            <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
              <input type="checkbox" checked={l.dividers.show}
                onChange={e => setters.setL({ dividers: { ...l.dividers, show: e.target.checked } })}
                className="accent-gray-900 w-3.5 h-3.5" />
              <span className="text-xs text-gray-600">Mostra le linee sopra il nome e sotto lo slogan</span>
            </label>
            {l.dividers.show && (
              <ColorRow label="Colore linee" value={l.dividers.color || l.accent}
                onChange={v => setters.setL({ dividers: { ...l.dividers, color: v } })} />
            )}
            <p className="text-[11px] text-gray-400 mt-1">Visibili solo quando non c&rsquo;è un logo.</p>
          </div>
          <PositionRow pos={l.positions.title} onChange={p => setters.setLPos('title', p)} />
        </div>
      )

      case 'landing-desc': return (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Testo</p>
            <textarea value={l.description.text} placeholder="Alta cucina italiana · dal 1987"
              rows={Math.max(1, l.description.text.split('\n').length)}
              onChange={e => setters.setLDesc({ text: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-gray-400 resize-y" />
            <p className="text-[11px] text-gray-400 mt-1">Vuoto = usa la descrizione del ristorante. Premi Invio per andare a capo.</p>
          </div>
          <FontSelector label="Font" value={l.description.font}
            curated={SANS_FONTS} category="sans"
            onChange={v => setters.setLDesc({ font: v })}
            customFonts={theme.customFonts} onUploadFont={setters.handleFontUpload} uploading={setters.fontUploading} />
          <FontSizeSlider label="Grandezza riga 1" value={l.description.size}
            min={0.4} max={1.4} step={0.05} previewFont={fontStack(l.description.font, 'sans')}
            onChange={v => setters.setLDesc({ size: v })} />
          {l.description.text.split('\n').slice(1).map((_, i) => (
            <FontSizeSlider key={i} label={`Grandezza riga ${i + 2}`}
              value={l.description.lineSizes[i] ?? l.description.size}
              min={0.4} max={1.4} step={0.05} previewFont={fontStack(l.description.font, 'sans')}
              onChange={v => {
                const next = [...l.description.lineSizes]
                next[i] = v
                setters.setLDesc({ lineSizes: next })
              }} />
          ))}
          <ColorRow label="Colore" value={l.description.color.slice(0, 7)}
            onChange={v => setters.setLDesc({ color: v })} />
          <FontSizeSlider label="Spazio sopra i bottoni menu" value={l.buttons.gapTop}
            min={0} max={6} step={0.25} previewFont="inherit"
            onChange={v => setters.setLBu({ gapTop: v })} />
          <PositionRow pos={l.positions.description} onChange={p => setters.setLPos('description', p)} />
        </div>
      )

      case 'landing-buttons': return (
        <ButtonsPanel l={l} setLBu={setters.setLBu}
          pos={l.positions.buttons} onPos={p => setters.setLPos('buttons', p)}
          customFonts={theme.customFonts} onUploadFont={setters.handleFontUpload} fontUploading={setters.fontUploading} />
      )

      case 'landing-socials': return (
        <div className="space-y-4">
          <ColorRow label="Colore accento" value={l.accent}
            onChange={v => setters.setL({ accent: v, socials: { ...l.socials, color: v } })} />
          <ColorRow label="Colore icone" value={l.socials.color}
            onChange={v => setters.setL({ socials: { ...l.socials, color: v } })} />
          <FontSizeSlider label="Dimensione icone" value={l.socials.size}
            min={0.8} max={2.5} step={0.05} previewFont="inherit"
            onChange={v => setters.setL({ socials: { ...l.socials, size: v } })} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Stile</p>
            <PillGroup
              options={[{ label:'Minimal', value:'minimal' },{ label:'Cerchio', value:'circle' },{ label:'Box', value:'box' },{ label:'Outline', value:'outline' }]}
              value={l.socials.style}
              onChange={v => setters.setL({ socials: { ...l.socials, style: v } })} />
          </div>
          <PositionRow pos={l.positions.socials} onChange={p => setters.setLPos('socials', p)} />
        </div>
      )

      case 'dish-title': return (
        <div className="space-y-5">
          {showCard && (
          <div className="space-y-3">
            <FontSelector label="Font" value={c.title.font}
              curated={[...SERIF_FONTS, ...DISPLAY_FONTS]} category="serif"
              onChange={v => setters.setCardTitle({ font: v })}
              customFonts={theme.customFonts} onUploadFont={setters.handleFontUpload} uploading={setters.fontUploading} />
            <FontSizeSlider label="Dimensione" value={c.title.size}
              min={1.0} max={4.5} step={0.1} previewFont={fontStack(c.title.font, 'serif')}
              onChange={v => setters.setCardTitle({ size: v })} />
            <ColorRow label="Colore" value={c.title.color}
              onChange={v => setters.setCardTitle({ color: v })} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Peso</p>
              <PillGroup
                options={[{ label:'Light', value:'light' },{ label:'Normal', value:'normal' },{ label:'Bold', value:'bold' }]}
                value={c.title.weight} onChange={v => setters.setCardTitle({ weight: v })} />
            </div>
          </div>
          )}
          {showMenu && (
          <div className="space-y-3">
            <FontSelector label="Font" value={m.dishes.titleFont}
              curated={[...SERIF_FONTS, ...DISPLAY_FONTS]} category="serif"
              onChange={v => setters.setMDishes({ titleFont: v })}
              customFonts={theme.customFonts} onUploadFont={setters.handleFontUpload} uploading={setters.fontUploading} />
            <FontSizeSlider label="Dimensione" value={m.dishes.titleSize}
              min={0.8} max={4.5} step={0.1} previewFont={fontStack(m.dishes.titleFont, 'serif')}
              onChange={v => setters.setMDishes({ titleSize: v })} />
            <ColorRow label="Colore" value={m.dishes.titleColor}
              onChange={v => setters.setMDishes({ titleColor: v })} />
            <AlignRow label="Allineamento" value={m.dishes.align}
              onChange={v => setters.setMDishes({ align: v })} />
            <p className="text-[10px] text-gray-400 leading-snug">Descrizione e allergeni seguono questo allineamento finché non li personalizzi singolarmente.</p>
          </div>
          )}
        </div>
      )

      case 'dish-description': return (
        <div className="space-y-5">
          {showCard && (
          <div className="space-y-3">
            <FontSelector label="Font" value={c.description.font}
              curated={SANS_FONTS} category="sans"
              onChange={v => setters.setCardDesc({ font: v })}
              customFonts={theme.customFonts} onUploadFont={setters.handleFontUpload} uploading={setters.fontUploading} />
            <FontSizeSlider label="Dimensione" value={c.description.size}
              min={0.6} max={2.0} step={0.05} previewFont={fontStack(c.description.font, 'sans')}
              onChange={v => setters.setCardDesc({ size: v })} />
            <ColorRow label="Colore" value={c.description.color}
              onChange={v => setters.setCardDesc({ color: v })} />
          </div>
          )}
          {showMenu && (
          <div className="space-y-3">
            <FontSelector label="Font" value={m.descriptions.font}
              curated={SANS_FONTS} category="sans"
              onChange={v => setters.setMDescs({ font: v })}
              customFonts={theme.customFonts} onUploadFont={setters.handleFontUpload} uploading={setters.fontUploading} />
            <FontSizeSlider label="Dimensione" value={m.descriptions.size}
              min={0.5} max={2.5} step={0.05} previewFont={fontStack(m.descriptions.font, 'sans')}
              onChange={v => setters.setMDescs({ size: v })} />
            <ColorRow label="Colore" value={m.descriptions.color}
              onChange={v => setters.setMDescs({ color: v })} />
            <AlignRow label="Allineamento" value={m.descriptions.align}
              onChange={v => setters.setMDescs({ align: v })} />
          </div>
          )}
        </div>
      )

      case 'dish-price': return (
        <div className="space-y-5">
          {showCard && (
          <div className="space-y-3">
            <FontSelector label="Font" value={c.price.font}
              curated={SANS_FONTS} category="sans"
              onChange={v => setters.setCardPrice({ font: v })}
              customFonts={theme.customFonts} onUploadFont={setters.handleFontUpload} uploading={setters.fontUploading} />
            <FontSizeSlider label="Dimensione" value={c.price.size}
              min={0.7} max={3.0} step={0.05} previewFont={fontStack(c.price.font, 'sans')}
              onChange={v => setters.setCardPrice({ size: v })} />
            <ColorRow label="Colore" value={c.price.color}
              onChange={v => setters.setCardPrice({ color: v })} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Formato</p>
              <PillGroup
                options={[{ label:'€ 12.00', value:'symbol-left' },{ label:'12.00 €', value:'symbol-right' },{ label:'12.00', value:'no-symbol' }]}
                value={c.price.format} onChange={v => setters.setCardPrice({ format: v })} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Valuta</p>
              <PillGroup
                options={CURRENCY_OPTIONS.map(cur => ({ label: cur, value: cur }))}
                value={c.price.currency} onChange={v => setters.setCardPrice({ currency: v })} />
            </div>
          </div>
          )}
          {showMenu && (
          <div className="space-y-3">
            <FontSelector label="Font" value={m.prices.font}
              curated={SANS_FONTS} category="sans"
              onChange={v => setters.setMPrices({ font: v })}
              customFonts={theme.customFonts} onUploadFont={setters.handleFontUpload} uploading={setters.fontUploading} />
            <FontSizeSlider label="Dimensione" value={m.prices.size}
              min={0.7} max={3.0} step={0.05} previewFont={fontStack(m.prices.font, 'sans')}
              onChange={v => setters.setMPrices({ size: v })} />
            <ColorRow label="Colore" value={m.prices.color}
              onChange={v => setters.setMPrices({ color: v })} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Formato</p>
              <PillGroup
                options={[{ label:'sx 12.00', value:'symbol-left' },{ label:'12.00 dx', value:'symbol-right' },{ label:'Nessun simbolo', value:'no-symbol' }]}
                value={m.prices.format} onChange={v => setters.setMPrices({ format: v })} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Valuta</p>
              <PillGroup
                options={CURRENCY_OPTIONS.map(cur => ({ label: cur, value: cur }))}
                value={m.prices.currency} onChange={v => setters.setMPrices({ currency: v })} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Posizione prezzo</p>
              <PillGroup
                options={[{ label:'Sopra', value:'above' },{ label:'Destra', value:'right' }]}
                value={m.prices.position} onChange={v => setters.setMPrices({ position: v as PricePosition })} />
            </div>
          </div>
          )}
        </div>
      )

      case 'category-title': return (
        <div className="space-y-4">
          <FontSelector label="Font" value={m.categories.font}
            curated={[...SERIF_FONTS, ...DISPLAY_FONTS]} category="serif"
            onChange={v => setters.setMCats({ font: v })}
            customFonts={theme.customFonts} onUploadFont={setters.handleFontUpload} uploading={setters.fontUploading} />
          <FontSizeSlider label="Dimensione" value={m.categories.size}
            min={0.8} max={3.5} step={0.1} previewFont={fontStack(m.categories.font, 'serif')}
            onChange={v => setters.setMCats({ size: v })} />
          <ColorRow label="Colore" value={m.categories.color}
            onChange={v => setters.setMCats({ color: v })} />
          <div className={m.categories.flourish !== 'none' ? 'opacity-30 pointer-events-none' : ''}>
            <AlignRow label="Allineamento proprio" value={m.categories.align}
              onChange={v => setters.setMCats({ align: v })} />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-gray-600">Spazio dopo categoria</label>
              <span className="text-[10px] font-mono text-gray-400">{m.categories.gapAfter}pt</span>
            </div>
            <input type="range" min={0} max={40} step={1} value={m.categories.gapAfter}
              onChange={e => setters.setMCats({ gapAfter: Number(e.target.value) })}
              className="w-full accent-gray-900" />
            <p className="text-[10px] text-gray-400 mt-1">Distanza tra il nome categoria e il primo piatto.</p>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Ghirigori (decori laterali)</p>
            <PillGroup
              options={[{ label:'Nessuno', value:'none' },{ label:'Linee', value:'lines' },{ label:'Punti', value:'dots' },{ label:'Diamante', value:'diamond' }]}
              value={m.categories.flourish} onChange={v => setters.setMCats({ flourish: v as CategoryFlourish })} />
          </div>
          {m.categories.flourish !== 'none' && (<>
            <ColorRow label="Colore decoro" value={m.categories.flourishColor}
              onChange={v => setters.setMCats({ flourishColor: v })} />
            {m.categories.flourish === 'lines' && (<>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-gray-600">Lunghezza linee</label>
                  <span className="text-[10px] font-mono text-gray-400">{m.categories.flourishWidth}px</span>
                </div>
                <input type="range" min={10} max={120} step={2} value={m.categories.flourishWidth}
                  onChange={e => setters.setMCats({ flourishWidth: Number(e.target.value) })}
                  className="w-full accent-gray-900" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-gray-600">Spessore linee</label>
                  <span className="text-[10px] font-mono text-gray-400">{m.categories.flourishThickness}px</span>
                </div>
                <input type="range" min={0.5} max={6} step={0.5} value={m.categories.flourishThickness}
                  onChange={e => setters.setMCats({ flourishThickness: Number(e.target.value) })}
                  className="w-full accent-gray-900" />
              </div>
            </>)}
          </>)}
        </div>
      )

      case 'allergens': return (
        <div className="space-y-5">
          {showCard && (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Stile</p>
              <PillGroup
                options={[{ label:'Testo', value:'text' },{ label:'Badge', value:'badge' }]}
                value={c.allergens.style} onChange={v => setters.setCardAllergens({ style: v })} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Formato nomi</p>
              <PillGroup
                options={[{ label:'Completo', value:'full' },{ label:'Breve', value:'short' },{ label:'Numero', value:'number' }]}
                value={c.allergens.display} onChange={v => setters.setCardAllergens({ display: v as AllergenDisplay })} />
            </div>
            <SeparatorRow value={c.allergens.separator} onChange={v => setters.setCardAllergens({ separator: v })} />
            <FontSizeSlider label="Dimensione testo" value={c.allergens.size}
              min={0.5} max={1.6} step={0.05} previewFont="inherit"
              onChange={v => setters.setCardAllergens({ size: v })} />
            <ColorRow label="Colore testo" value={c.allergens.color}
              onChange={v => setters.setCardAllergens({ color: v })} />
            <ColorRow label="Colore etichetta &ldquo;Allergeni&rdquo;" value={c.allergens.labelColor}
              onChange={v => setters.setCardAllergens({ labelColor: v })} />
            <ColorRow label="Sfondo" value={c.allergens.bgColor}
              onChange={v => setters.setCardAllergens({ bgColor: v })} />
          </div>
          )}
          {showMenu && (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Formato nomi</p>
              <PillGroup
                options={[{ label:'Completo', value:'full' },{ label:'Breve', value:'short' },{ label:'Numero', value:'number' }]}
                value={m.allergens.display} onChange={v => setters.setMAllergens({ display: v as AllergenDisplay })} />
            </div>
            <SeparatorRow value={m.allergens.separator} onChange={v => setters.setMAllergens({ separator: v })} />
            <FontSizeSlider label="Dimensione testo" value={m.allergens.size}
              min={0.5} max={1.6} step={0.05} previewFont="inherit"
              onChange={v => setters.setMAllergens({ size: v })} />
            <ColorRow label="Colore testo" value={m.allergens.color}
              onChange={v => setters.setMAllergens({ color: v })} />
            <AlignRow label="Allineamento" value={m.allergens.align}
              onChange={v => setters.setMAllergens({ align: v })} />
          </div>
          )}
        </div>
      )

      case 'card-category': return (
        <div className="space-y-4">
          <p className="text-[11px] text-gray-400 leading-snug">
            Etichetta categoria mostrata in cima alla card. È indipendente dal titolo categoria del menu.
          </p>
          <ColorRow label="Colore" value={c.category.color}
            onChange={v => setters.setCardCategory({ color: v })} />
          <FontSizeSlider label="Dimensione" value={c.category.size}
            min={0.4} max={1.4} step={0.025} previewFont="inherit"
            onChange={v => setters.setCardCategory({ size: v })} />
        </div>
      )

      case 'card-pairing': return (
        <div className="space-y-4">
          <p className="text-[11px] text-gray-400 leading-snug">
            Box &ldquo;Abbinamento consigliato&rdquo; mostrato nella card quando un piatto ha un abbinamento.
          </p>
          <ColorRow label="Colore etichetta" value={c.pairing.labelColor}
            onChange={v => setters.setCardPairing({ labelColor: v })} />
          <ColorRow label="Colore prodotto consigliato" value={c.pairing.productColor}
            onChange={v => setters.setCardPairing({ productColor: v })} />
        </div>
      )

      case 'card-style': return (
        <div className="space-y-4">
          <ColorRow label="Sfondo card" value={c.bgColor}
            onChange={v => setters.setC({ bgColor: v })} />
          <ColorRow label="Colore accento" value={c.accent}
            onChange={v => setters.setC({ accent: v })} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Allineamento testo</p>
            <PillGroup
              options={[{ label:'Sinistra', value:'left' },{ label:'Centro', value:'center' },{ label:'Destra', value:'right' }]}
              value={c.align} onChange={v => setters.setC({ align: v })} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Layout card</p>
            <PillGroup
              options={[{ label:'Foto sopra', value:'photo-top' },{ label:'Foto lato', value:'photo-side' },{ label:'Minimal', value:'minimal' }]}
              value={c.layout} onChange={v => setters.setC({ layout: v })} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Angoli card</p>
            <PillGroup
              options={[{ label:'Netti', value:'none' },{ label:'Arrotondati', value:'sm' },{ label:'Morbidi', value:'md' }]}
              value={c.borderRadius} onChange={v => setters.setC({ borderRadius: v })} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Toggle checked={c.closeButton.show}
              onChange={v => setters.setCardClose({ show: v })} />
            <span className="text-xs text-gray-600">Mostra pulsante chiudi (×)</span>
          </label>
          {!c.closeButton.show && (
            <p className="text-[11px] text-gray-400 leading-snug">
              La card si chiude comunque toccando fuori dalla card.
            </p>
          )}
          {c.closeButton.show && (<>
            <FontSizeSlider label="Dimensione chiudi" value={c.closeButton.size}
              min={0.8} max={3} step={0.05} previewFont="inherit"
              onChange={v => setters.setCardClose({ size: v })} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Pulsante chiudi</p>
              <PillGroup
                options={[{ label:'Nessuno', value:'none' },{ label:'Cerchio', value:'circle' },{ label:'Quadrato', value:'square' }]}
                value={c.closeButton.shape} onChange={v => setters.setCardClose({ shape: v })} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Posizione chiudi</p>
              <PillGroup
                options={[{ label:'Alto dx', value:'top-right' },{ label:'Alto sx', value:'top-left' }]}
                value={c.closeButton.position} onChange={v => setters.setCardClose({ position: v })} />
            </div>
            <ColorRow label="Colore chiudi" value={c.closeButton.color}
              onChange={v => setters.setCardClose({ color: v })} />
          </>)}
        </div>
      )

      case 'sticky-categories': return (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Stile barra</p>
            <PillGroup
              options={[{ label:'Solido', value:'solid' },{ label:'Nascosta', value:'none' }]}
              value={m.stickyCategories.style} onChange={v => setters.setMSticky({ style: v })} />
          </div>
          {m.stickyCategories.style !== 'none' && (<>
            <ColorRow label="Sfondo barra" value={m.stickyCategories.bgColor.startsWith('rgba') ? '#070707' : m.stickyCategories.bgColor}
              onChange={v => setters.setMSticky({ bgColor: v })} />
            <ColorRow label="Testo categoria" value={m.stickyCategories.textColor}
              onChange={v => setters.setMSticky({ textColor: v })} />
            <ColorRow label="Categoria attiva" value={m.stickyCategories.activeColor}
              onChange={v => setters.setMSticky({ activeColor: v })} />
            <FontSelector label="Font" value={m.stickyCategories.font}
              curated={SANS_FONTS} category="sans"
              onChange={v => setters.setMSticky({ font: v })}
              customFonts={theme.customFonts} onUploadFont={setters.handleFontUpload} uploading={setters.fontUploading} />
            <FontSizeSlider label="Dimensione testo" value={m.stickyCategories.fontSize}
              min={0.5} max={1.2} step={0.025} previewFont={fontStack(m.stickyCategories.font, 'sans')}
              onChange={v => setters.setMSticky({ fontSize: v })} />
          </>)}
        </div>
      )

      case 'menu-hint': return (
        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Toggle checked={m.hintPopup.enabled}
              onChange={v => setters.setMHint({ enabled: v })} />
            <span className="text-xs text-gray-600">Mostra pop-up istruzioni</span>
          </label>
          {m.hintPopup.enabled && (<>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Toggle checked={m.hintPopup.showOnce}
                onChange={v => setters.setMHint({ showOnce: v })} />
              <span className="text-xs text-gray-600">Solo la prima volta per dispositivo</span>
            </label>
            <p className="text-[11px] text-gray-400 leading-snug">
              Nell&rsquo;anteprima il pop-up è sempre visibile; per i clienti
              {m.hintPopup.showOnce ? ' appare solo alla prima apertura del menu.' : ' appare a ogni apertura del menu.'}
            </p>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Titolo</p>
              <input type="text" value={m.hintPopup.title}
                onChange={e => setters.setMHint({ title: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-gray-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Testo</p>
              <textarea value={m.hintPopup.text}
                rows={Math.max(2, m.hintPopup.text.split('\n').length)}
                onChange={e => setters.setMHint({ text: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-gray-400 resize-y" />
              <p className="text-[11px] text-gray-400 mt-1">Premi Invio per andare a capo.</p>
            </div>
            <FontSelector label="Font" value={m.hintPopup.font}
              curated={SANS_FONTS} category="sans"
              onChange={v => setters.setMHint({ font: v })}
              customFonts={theme.customFonts} onUploadFont={setters.handleFontUpload} uploading={setters.fontUploading} />
            <FontSizeSlider label="Dimensione titolo" value={m.hintPopup.titleSize}
              min={0.8} max={2.2} step={0.05} previewFont={fontStack(m.hintPopup.font, 'sans')}
              onChange={v => setters.setMHint({ titleSize: v })} />
            <FontSizeSlider label="Dimensione testo" value={m.hintPopup.textSize}
              min={0.6} max={1.6} step={0.05} previewFont={fontStack(m.hintPopup.font, 'sans')}
              onChange={v => setters.setMHint({ textSize: v })} />
            <ColorRow label="Sfondo pop-up" value={m.hintPopup.bgColor}
              onChange={v => setters.setMHint({ bgColor: v })} />
            <ColorRow label="Colore titolo" value={m.hintPopup.titleColor}
              onChange={v => setters.setMHint({ titleColor: v })} />
            <ColorRow label="Colore testo" value={m.hintPopup.textColor}
              onChange={v => setters.setMHint({ textColor: v })} />
            <ColorRow label="Colore chiudi (×)" value={m.hintPopup.closeColor}
              onChange={v => setters.setMHint({ closeColor: v })} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Angoli</p>
              <PillGroup
                options={[{ label:'Netti', value:'none' },{ label:'Arrotondati', value:'sm' },{ label:'Morbidi', value:'md' }]}
                value={m.hintPopup.borderRadius} onChange={v => setters.setMHint({ borderRadius: v })} />
            </div>
          </>)}
        </div>
      )

      case 'background-layout': return (
        <div className="space-y-4">
          <ColorRow label="Colore accento menu" value={m.accent}
            onChange={v => setters.setM({ accent: v })} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Sfondo menu</p>
            <div className="space-y-2.5">
              <ColorRow label="Colore primario" value={m.background.color}
                onChange={v => setters.setMBg({ color: v })} />
              <ColorRow label="Colore secondario" value={m.background.color2}
                onChange={v => setters.setMBg({ color2: v })} />
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Effetto</label>
                <select value={m.background.effect}
                  onChange={e => setters.setMBg({ effect: e.target.value as MenuBgEffect })}
                  className="w-full px-2 py-1.5 border border-gray-200 text-xs bg-white focus:outline-none focus:border-gray-400">
                  {MENU_BG_EFFECTS.map(ef => (
                    <option key={ef} value={ef}>{MENU_BG_EFFECT_LABELS[ef]}</option>
                  ))}
                </select>
              </div>
              {m.background.effect !== 'none' && (<>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-gray-600">Opacità effetto</label>
                    <span className="text-[10px] font-mono text-gray-400">{m.background.effectOpacity}%</span>
                  </div>
                  <input type="range" min={0} max={100} step={1} value={m.background.effectOpacity}
                    onChange={e => setters.setMBg({ effectOpacity: Number(e.target.value) })}
                    className="w-full accent-gray-900" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-gray-600">Intensità effetto</label>
                    <span className="text-[10px] font-mono text-gray-400">{m.background.effectStrength}%</span>
                  </div>
                  <input type="range" min={20} max={200} step={5} value={m.background.effectStrength}
                    onChange={e => setters.setMBg({ effectStrength: Number(e.target.value) })}
                    className="w-full accent-gray-900" />
                </div>
              </>)}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Immagine di sfondo</p>
            {m.background.image
              ? (
                <div className="space-y-2">
                  <img src={m.background.image} alt="" className="w-full h-20 object-cover border border-gray-200 rounded" />
                  <div className="flex items-center gap-2">
                    <input type="file" accept="image/*"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setters.handleMenuBgUpload(f) }}
                      className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50 cursor-pointer flex-1" />
                    <button type="button" onClick={() => setters.setMBg({ image: '' })}
                      className="text-[10px] text-red-400 hover:text-red-600 shrink-0">Rimuovi</button>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-gray-600">Opacità immagine</label>
                      <span className="text-[10px] font-mono text-gray-400">{m.background.imageOpacity}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={1} value={m.background.imageOpacity}
                      onChange={e => setters.setMBg({ imageOpacity: Number(e.target.value) })}
                      className="w-full accent-gray-900" />
                  </div>
                </div>
              )
              : (
                <input type="file" accept="image/*"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setters.handleMenuBgUpload(f) }}
                  className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50 cursor-pointer w-full" />
              )}
            {setters.menuBgUploading && <p className="text-xs text-gray-400 mt-1">Caricamento…</p>}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Sfondo pagina (sotto i piatti)</p>
            <div className="space-y-2.5">
              <ColorRow label="Colore primario" value={m.pageBackground.color}
                onChange={v => setters.setMPageBg({ color: v })} />
              <ColorRow label="Colore secondario" value={m.pageBackground.color2}
                onChange={v => setters.setMPageBg({ color2: v })} />
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Effetto</label>
                <select value={m.pageBackground.effect}
                  onChange={e => setters.setMPageBg({ effect: e.target.value as MenuBgEffect })}
                  className="w-full px-2 py-1.5 border border-gray-200 text-xs bg-white focus:outline-none focus:border-gray-400">
                  {MENU_BG_EFFECTS.map(ef => (
                    <option key={ef} value={ef}>{MENU_BG_EFFECT_LABELS[ef]}</option>
                  ))}
                </select>
              </div>
              {m.pageBackground.effect !== 'none' && (<>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-gray-600">Opacità effetto</label>
                    <span className="text-[10px] font-mono text-gray-400">{m.pageBackground.effectOpacity}%</span>
                  </div>
                  <input type="range" min={0} max={100} step={1} value={m.pageBackground.effectOpacity}
                    onChange={e => setters.setMPageBg({ effectOpacity: Number(e.target.value) })}
                    className="w-full accent-gray-900" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-gray-600">Intensità effetto</label>
                    <span className="text-[10px] font-mono text-gray-400">{m.pageBackground.effectStrength}%</span>
                  </div>
                  <input type="range" min={20} max={200} step={5} value={m.pageBackground.effectStrength}
                    onChange={e => setters.setMPageBg({ effectStrength: Number(e.target.value) })}
                    className="w-full accent-gray-900" />
                </div>
              </>)}
            </div>
            <div className="mt-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Immagine di sfondo pagina</p>
              {m.pageBackground.image
                ? (
                  <div className="space-y-2">
                    <img src={m.pageBackground.image} alt="" className="w-full h-20 object-cover border border-gray-200 rounded" />
                    <div className="flex items-center gap-2">
                      <input type="file" accept="image/*"
                        onChange={e => { const f = e.target.files?.[0]; if (f) setters.handleMenuPageBgUpload(f) }}
                        className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50 cursor-pointer flex-1" />
                      <button type="button" onClick={() => setters.setMPageBg({ image: '' })}
                        className="text-[10px] text-red-400 hover:text-red-600 shrink-0">Rimuovi</button>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-gray-600">Opacità immagine</label>
                        <span className="text-[10px] font-mono text-gray-400">{m.pageBackground.imageOpacity}%</span>
                      </div>
                      <input type="range" min={0} max={100} step={1} value={m.pageBackground.imageOpacity}
                        onChange={e => setters.setMPageBg({ imageOpacity: Number(e.target.value) })}
                        className="w-full accent-gray-900" />
                    </div>
                  </div>
                )
                : (
                  <input type="file" accept="image/*"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setters.handleMenuPageBgUpload(f) }}
                    className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-600 hover:file:bg-gray-50 cursor-pointer w-full" />
                )}
              {setters.pageBgUploading && <p className="text-xs text-gray-400 mt-1">Caricamento…</p>}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Divisore (sotto ogni piatto)</p>
            <PillGroup
              options={[{ label:'Nessuno', value:'none' },{ label:'Solido', value:'solid' },{ label:'Tratteg.', value:'dashed' },{ label:'Punteg.', value:'dotted' },{ label:'Doppio', value:'double' },{ label:'Gradiente', value:'gradient' },{ label:'Ornamento', value:'ornament' },{ label:'Ondulato', value:'wavy' }]}
              value={m.layout.divider.type} onChange={v => {
                const t = v as DividerType
                const defaultWidth = (t === 'wavy' || t === 'ornament' || t === 'none') ? 0.5 : 1
                setters.setMDivider({ type: t, width: defaultWidth, widthPercent: 100 })
              }} />
            {m.layout.divider.type !== 'none' && (
              <div className="mt-2 space-y-2">
                <ColorRow label="Colore divisore" value={m.layout.divider.color}
                  onChange={v => setters.setMDivider({ color: v })} />
                {(m.layout.divider.type === 'solid' || m.layout.divider.type === 'dashed' || m.layout.divider.type === 'dotted' || m.layout.divider.type === 'double' || m.layout.divider.type === 'gradient') && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-gray-600">Spessore</label>
                      <span className="text-[10px] font-mono text-gray-400">{m.layout.divider.width}px</span>
                    </div>
                    <input type="range" min={1} max={5} step={0.5} value={m.layout.divider.width}
                      onChange={e => setters.setMDivider({ width: Number(e.target.value) })}
                      className="w-full accent-gray-900" />
                  </div>
                )}
                {m.layout.divider.type === 'wavy' && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-gray-600">Spessore</label>
                      <span className="text-[10px] font-mono text-gray-400">{m.layout.divider.width}px</span>
                    </div>
                    <input type="range" min={0.5} max={1} step={0.5} value={m.layout.divider.width}
                      onChange={e => setters.setMDivider({ width: Number(e.target.value) })}
                      className="w-full accent-gray-900" />
                  </div>
                )}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-gray-600">Larghezza</label>
                    <span className="text-[10px] font-mono text-gray-400">{m.layout.divider.widthPercent}%</span>
                  </div>
                  <input type="range" min={10} max={100} step={5} value={m.layout.divider.widthPercent}
                    onChange={e => setters.setMDivider({ widthPercent: Number(e.target.value) })}
                    className="w-full accent-gray-900" />
                </div>
              </div>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Layout piatti</p>
            <PillGroup
              options={[{ label:'Lista', value:'list' },{ label:'Griglia 2', value:'grid-2' },{ label:'Griglia 3', value:'grid-3' },{ label:'Card', value:'boxed-card' },{ label:'Minimal', value:'minimal-row' },{ label:'Elegante', value:'elegant' }]}
              value={m.layout.dishLayout} onChange={v => setters.setMLayout({ dishLayout: v as DishLayout })} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Allineamento generale</p>
            <PillGroup
              options={[{ label:'Sx', value:'left' },{ label:'Centro', value:'center' },{ label:'Dx', value:'right' }]}
              value={m.layout.dishAlignment} onChange={v => setters.setMLayout({ dishAlignment: v })} />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-gray-600">Spaziatura piatti</label>
              <span className="text-[10px] font-mono text-gray-400">{m.layout.dishSpacing}px</span>
            </div>
            <input type="range" min={0} max={40} step={1} value={m.layout.dishSpacing}
              onChange={e => setters.setMLayout({ dishSpacing: Number(e.target.value) })}
              className="w-full accent-gray-900" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-gray-600">Piatti per pagina</label>
              <span className="text-[10px] font-mono text-gray-400">{m.layout.dishesPerPage === 0 ? 'Auto' : m.layout.dishesPerPage}</span>
            </div>
            <input type="range" min={0} max={20} step={1} value={m.layout.dishesPerPage}
              onChange={e => setters.setMLayout({ dishesPerPage: Number(e.target.value) })}
              className="w-full accent-gray-900" />
            <p className="text-[10px] text-gray-400 mt-1">0 = automatico (flusso naturale). Valori bassi forzano l&apos;impaginazione.</p>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Paginazione</label>
            <select value={m.navigation.style}
              onChange={e => setters.setMNav({ style: e.target.value as PaginationStyle })}
              className="w-full px-2 py-1.5 border border-gray-200 text-xs bg-white focus:outline-none focus:border-gray-400">
              {(Object.keys(PAGINATION_OPTIONS) as PaginationStyle[]).map(k => (
                <option key={k} value={k}>{PAGINATION_OPTIONS[k].label}</option>
              ))}
            </select>
          </div>
          {m.navigation.style !== 'hidden' && (<>
            <ColorRow label="Colore tasti nav" value={m.navigation.color}
              onChange={v => setters.setMNav({ color: v })} />
            <FontSelector label="Font tasti nav" value={m.navigation.font} curated={SANS_FONTS} category="sans"
              onChange={v => setters.setMNav({ font: v })}
              customFonts={theme.customFonts} onUploadFont={setters.handleFontUpload} uploading={setters.fontUploading} />
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-gray-600">Dimensione tasti nav</label>
                <span className="text-[10px] font-mono text-gray-400">{m.navigation.size}rem</span>
              </div>
              <input type="range" min={0.5} max={1.5} step={0.0625} value={m.navigation.size}
                onChange={e => setters.setMNav({ size: Number(e.target.value) })}
                className="w-full accent-gray-900" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Spessore tasti nav</label>
              <PillGroup
                options={[{ label:'Thin', value:'400' },{ label:'Medium', value:'500' },{ label:'Semi', value:'600' },{ label:'Bold', value:'700' }]}
                value={String(m.navigation.fontWeight)}
                onChange={v => setters.setMNav({ fontWeight: Number(v) as 400|500|600|700 })} />
            </div>
          </>)}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Layout PDF</p>
            <PillGroup
              options={[{ label:'Classic', value:'classic' },{ label:'Compact', value:'compact' }]}
              value={m.pdfLayout} onChange={v => setters.setM({ pdfLayout: v })} />
          </div>
          {m.pdfLayout === 'compact' && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Modalità compact</p>
              <PillGroup
                options={[{ label:'Lineare', value:'linear' },{ label:'Alternato', value:'alternating' }]}
                value={m.compactMode} onChange={v => setters.setM({ compactMode: v as MenuTheme['compactMode'] })} />
              <p className="text-[10px] text-gray-400 mt-1">Alternato: ogni categoria inverte l&apos;allineamento del titolo.</p>
            </div>
          )}
        </div>
      )

      default: return <p className="text-xs text-gray-400">Nessun controllo disponibile.</p>
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <div>
          <p className="text-xs font-semibold text-gray-800">{info?.title ?? target}</p>
          {info?.hint && <p className="text-[10px] text-gray-400 mt-0.5">{info.hint}</p>}
        </div>
        <button onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none w-7 h-7 flex items-center justify-center">
          &#xD7;
        </button>
      </div>
      <div key={target} ref={contentRef} className="flex-1 overflow-y-auto px-4 py-4">
        {renderControls()}
      </div>
    </div>
  )
}

// ── Live preview iframe ───────────────────────────────────────────────────────

function LivePreview({ qrToken, theme, previewMode, activeMenuId = null, editMode = false, showDummyData = false, onElementClick, onViewChange, zoom = 1 }: {
  qrToken: string | null; theme: RestaurantTheme; previewMode: 'landing' | 'menu' | 'card' | 'hint'
  activeMenuId?: string | null
  editMode?: boolean; showDummyData?: boolean; onElementClick?: (target: string) => void
  onViewChange?: (view: 'landing' | 'menu' | 'card') => void
  zoom?: number
}) {
  const iframeRef    = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const readyRef     = useRef(false)

  // L'anteprima è un documento separato: se il tab admin resta aperto mentre
  // esce un nuovo deploy, l'iframe continua a servire il bundle VECCHIO e
  // "non rispecchia" il frontend reale. Quando si torna sul tab dopo più di
  // 15 minuti di assenza, l'iframe viene rimontato → ricarica il bundle
  // corrente dal server (la pagina pubblica è force-dynamic, mai cachata).
  const [iframeEpoch, setIframeEpoch] = useState(0)
  useEffect(() => {
    let hiddenAt: number | null = null
    const onVis = () => {
      if (document.hidden) { hiddenAt = Date.now(); return }
      if (hiddenAt !== null && Date.now() - hiddenAt > 15 * 60_000) {
        readyRef.current = false
        setIframeEpoch(e => e + 1)
      }
      hiddenAt = null
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  function post(msg: object) {
    iframeRef.current?.contentWindow?.postMessage(msg, window.location.origin)
  }

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'dmp-preview-ready') {
        readyRef.current = true
        post({ type: 'dmp-theme', theme })
        post({ type: 'dmp-nav', view: previewMode, menuId: previewMode === 'menu' ? activeMenuId : undefined })
        post({ type: 'dmp-editor-state', editMode, showDummyData })
        const w = containerRef.current?.getBoundingClientRect().width ?? 0
        if (w > 0) post({ type: 'dmp-font-scale', fontSize: Math.round((w / 390) * 16 * 10) / 10 })
      }
      if (e.data?.type === 'dmp-element-clicked' && e.data.target) {
        onElementClick?.(e.data.target)
      }
      // Navigazione interna all'anteprima (es. "Sfoglia il menu") → sync dei tab
      if (e.data?.type === 'dmp-view-changed' && ['landing','menu','card'].includes(e.data.view)) {
        onViewChange?.(e.data.view)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [theme, previewMode, activeMenuId, editMode, showDummyData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Resend font scale whenever the preview container resizes (sidebar open/close)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0 && readyRef.current) post({ type: 'dmp-font-scale', fontSize: Math.round((w / 390) * 16 * 10) / 10 })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!readyRef.current) return
    const id = setTimeout(() => post({ type: 'dmp-theme', theme }), 150)
    return () => clearTimeout(id)
  }, [theme]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!readyRef.current) return
    post({ type: 'dmp-nav', view: previewMode, menuId: previewMode === 'menu' ? activeMenuId : undefined })
  }, [previewMode, activeMenuId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div ref={containerRef} className="relative mx-auto h-full"
      style={{ aspectRatio: '9/19.5', maxWidth: '100%', transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: 'top center' }}>
      <div className="absolute inset-0 rounded-[2rem] overflow-hidden border border-gray-300 shadow-xl bg-black">
        <iframe
          key={iframeEpoch}
          ref={iframeRef}
          title="Anteprima menu"
          src={`/m/${qrToken}?preview=1${iframeEpoch > 0 ? `&r=${iframeEpoch}` : ''}`}
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

// ── Base panel — personalizzazione semplificata ─────────────────────────────────
// Una griglia di temi preset (ognuno trasforma tutto il menu) + 4 controlli che
// si propagano ovunque in un colpo solo: Font, Sfondo, Testo, Accento.

function PresetCard({ preset, active, onApply }: {
  preset: ThemePreset; active: boolean; onApply: () => void
}) {
  const m = preset.theme.menu
  const pageBg     = m.pageBackground.color
  const text       = m.dishes.titleColor
  const muted      = m.descriptions.color
  const accent     = m.prices.color
  const titleFont  = fontStack(m.dishes.titleFont, 'serif')
  const bodyFont   = fontStack(m.descriptions.font, 'sans')
  const dividerCol = m.layout.divider.color
  return (
    <button type="button" onClick={onApply}
      className={`group text-left rounded-lg overflow-hidden border transition-all ${
        active ? 'border-gray-900 ring-2 ring-gray-900/15' : 'border-gray-200 hover:border-gray-400'
      }`}>
      {/* Mini-anteprima del foglio menu con i colori/font reali del preset */}
      <div style={{ background: pageBg }} className="px-3 py-3 h-[92px] flex flex-col justify-center gap-1.5">
        <span style={{ color: accent, fontFamily: bodyFont, fontSize: 8, letterSpacing: '0.18em' }}
          className="uppercase font-semibold">Antipasti</span>
        <div className="flex items-baseline justify-between gap-2">
          <span style={{ color: text, fontFamily: titleFont, fontSize: 15, lineHeight: 1 }}>Tartare di tonno</span>
          <span style={{ color: accent, fontFamily: bodyFont, fontSize: 11 }}>€18</span>
        </div>
        <div style={{ borderTop: `1px solid ${dividerCol}` }} />
        <span style={{ color: muted, fontFamily: bodyFont, fontSize: 8.5, lineHeight: 1.25 }}>
          Avocado, lime, sesamo tostato
        </span>
      </div>
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-white border-t border-gray-100">
        <span className="text-[11px] font-semibold text-gray-800 truncate">{preset.name}</span>
        {active && <span className="text-[9px] font-bold uppercase tracking-wider text-gray-900 shrink-0 ml-1">Attivo</span>}
      </div>
      <div className="px-2.5 pb-1.5 bg-white -mt-0.5">
        <span className="text-[9px] text-gray-400 truncate block">{preset.mood}</span>
      </div>
    </button>
  )
}

function BasePanel({ theme, customFonts, onUploadFont, fontUploading, onApplyPreset, onFont, onSurface, onText, onAccent, popupEnabled, onPopupToggle, onPreviewPopup }: {
  theme: RestaurantTheme
  customFonts: Record<string, string>
  onUploadFont: (file: File) => Promise<string | null>
  fontUploading: boolean
  onApplyPreset: (p: ThemePreset) => void
  onFont:         (font: string) => void
  onSurface:      (color: string) => void
  onText:         (color: string) => void
  onAccent:       (color: string) => void
  popupEnabled:   boolean
  onPopupToggle:  (v: boolean) => void
  onPreviewPopup: () => void
}) {
  const curFont   = theme.menu.dishes.titleFont
  const curBg     = theme.menu.pageBackground.color
  const curText   = theme.menu.dishes.titleColor
  const curAccent = theme.menu.accent

  // Un preset è "attivo" se le sue 4 leve combaciano col tema corrente.
  const isActive = (p: ThemePreset) =>
    p.theme.menu.dishes.titleFont === curFont &&
    p.theme.menu.pageBackground.color === curBg &&
    p.theme.menu.dishes.titleColor === curText &&
    p.theme.menu.accent === curAccent

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <p className="text-xs font-semibold text-gray-800">Personalizzazione base</p>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
          Scegli un tema pronto, poi rifinisci font e colori: si applicano a tutto il menu.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Temi preset */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Temi pronti</p>
          <div className="grid grid-cols-2 gap-2.5">
            {PRESETS.map(p => (
              <PresetCard key={p.name} preset={p} active={isActive(p)} onApply={() => onApplyPreset(p)} />
            ))}
          </div>
        </div>

        {/* Font unico */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Font del menu</p>
          <FontSelector label="Carattere" value={curFont} curated={[...SERIF_FONTS, ...SANS_FONTS, ...DISPLAY_FONTS]}
            category="serif" onChange={onFont} customFonts={customFonts}
            onUploadFont={onUploadFont} uploading={fontUploading} />
          <p className="text-[11px] text-gray-400 mt-1.5">Applicato a titoli, piatti, descrizioni e prezzi.</p>
        </div>

        {/* Colori */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Colori</p>
          <ColorRow label="Sfondo"  value={curBg}     onChange={onSurface} />
          <ColorRow label="Testo"   value={curText}   onChange={onText} />
          <ColorRow label="Accento" value={curAccent} onChange={onAccent} />
          <p className="text-[11px] text-gray-400 leading-snug">
            Lo sfondo copre landing, foglio del menu e card; l’accento colora prezzi, decori e bordi.
          </p>
        </div>

        {/* Pop-up di benvenuto */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Pop-up di benvenuto</p>
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
              <Toggle checked={popupEnabled} onChange={onPopupToggle} />
              Mostra istruzioni all&apos;apertura
            </label>
            <button
              type="button"
              onClick={onPreviewPopup}
              className="shrink-0 text-[11px] text-gray-500 underline hover:text-gray-800"
            >
              Anteprima
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
            Pop-up con istruzioni su come sfogliare il menu. Per modificare testo e colori passa alla modalità avanzata.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CustomizationClient({
  restaurantId, restaurantName, restaurantLogo, qrToken, initialTheme, initialBanners, menus,
}: Props) {
  const [theme,        setTheme]        = useState<RestaurantTheme>(initialTheme)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [bgUploading,  setBgUploading]  = useState(false)
  const [vidUploading, setVidUploading] = useState(false)
  const [menuBgUploading, setMenuBgUploading] = useState(false)
  const [pageBgUploading, setPageBgUploading] = useState(false)
  const [posterUploading, setPosterUploading] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [fontUploading, setFontUploading] = useState(false)
  const [previewMode,  setPreviewMode]  = useState<'landing' | 'menu' | 'card' | 'hint'>('landing')
  const [adsOpen,      setAdsOpen]      = useState(false)
  // Sub-tab attivo dentro "Menu": null = "Generale" (tema condiviso), altrimenti
  // l'id del menu il cui override per-menu si sta modificando.
  const [activeMenuTab, setActiveMenuTab] = useState<string | null>(null)
  const editMode     = true
  const showDummyData = false
  const [activeEditor, setActiveEditor] = useState<string | null>(null)
  const [previewZoom,  setPreviewZoom]  = useState(1)
  const [isMobile,     setIsMobile]     = useState(false)
  // Livello dell'editor: 'base' = preset + 4 leve globali; 'advanced' = editor
  // completo attuale (controllo per-elemento). Cambiare livello non altera il
  // tema, solo l'interfaccia.
  const [editorLevel,  setEditorLevel]  = useState<'base' | 'advanced'>('advanced')

  // On mobile there's no separate "preview vs edit" mode — the chip bar is
  // the only way to open editors, so the iframe should always be tappable.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  usePreviewFonts(theme)
  const { ref: fillRef, height: fillHeight } = useFillHeight()

  // ── Typed patch helpers ──────────────────────────────────────────────────────

  function setL(patch: Partial<LandingTheme>) {
    setSaved(false); setTheme(t => ({ ...t, landing: { ...t.landing, ...patch } }))
  }
  function setCustomFonts(patch: Record<string, string>) {
    setSaved(false); setTheme(t => ({ ...t, customFonts: { ...t.customFonts, ...patch } }))
  }
  // Applica una trasformazione al MenuTheme giusto: "Generale" (theme.menu) o,
  // se è attivo un sub-tab per-menu, l'override in theme.menuThemes[menuId]
  // (creato lazy clonando il Generale al primo edit). hintPopup resta sempre
  // quello del Generale — è restaurant-wide (vedi resolveMenuTheme).
  function updateMenuTheme(t: RestaurantTheme, fn: (m: MenuTheme) => MenuTheme): RestaurantTheme {
    if (!activeMenuTab) return { ...t, menu: fn(t.menu) }
    const base = t.menuThemes?.[activeMenuTab] ?? t.menu
    const next = { ...fn(base), hintPopup: t.menu.hintPopup }
    return { ...t, menuThemes: { ...(t.menuThemes ?? {}), [activeMenuTab]: next } }
  }
  function setM(patch: Partial<MenuTheme>) {
    setSaved(false); setTheme(t => updateMenuTheme(t, m => ({ ...m, ...patch })))
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
  function setCardCategory(patch: Partial<CardTheme['category']>) {
    setSaved(false); setTheme(t => ({ ...t, card: { ...t.card, category: { ...t.card.category, ...patch } } }))
  }
  function setCardPairing(patch: Partial<CardTheme['pairing']>) {
    setSaved(false); setTheme(t => ({ ...t, card: { ...t.card, pairing: { ...t.card.pairing, ...patch } } }))
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
  function setLPos(key: keyof LandingTheme['positions'], patch: Partial<{ x: number; y: number }>) {
    setSaved(false)
    setTheme(t => ({
      ...t,
      landing: { ...t.landing, positions: { ...t.landing.positions, [key]: { ...t.landing.positions[key], ...patch } } },
    }))
  }
  function setMLayout(patch: Partial<MenuTheme['layout']>) {
    setSaved(false); setTheme(t => updateMenuTheme(t, m => ({ ...m, layout: { ...m.layout, ...patch } })))
  }
  function setMDivider(patch: Partial<MenuTheme['layout']['divider']>) {
    setSaved(false); setTheme(t => updateMenuTheme(t, m => ({ ...m, layout: { ...m.layout, divider: { ...m.layout.divider, ...patch } } })))
  }
  function setMDishes(patch: Partial<MenuTheme['dishes']>) {
    setSaved(false); setTheme(t => updateMenuTheme(t, m => ({ ...m, dishes: { ...m.dishes, ...patch } })))
  }
  function setMDescs(patch: Partial<MenuTheme['descriptions']>) {
    setSaved(false); setTheme(t => updateMenuTheme(t, m => ({ ...m, descriptions: { ...m.descriptions, ...patch } })))
  }
  function setMAllergens(patch: Partial<MenuTheme['allergens']>) {
    setSaved(false); setTheme(t => updateMenuTheme(t, m => ({ ...m, allergens: { ...m.allergens, ...patch } })))
  }
  function setMPrices(patch: Partial<MenuTheme['prices']>) {
    setSaved(false); setTheme(t => updateMenuTheme(t, m => ({ ...m, prices: { ...m.prices, ...patch } })))
  }
  function setMCats(patch: Partial<MenuTheme['categories']>) {
    setSaved(false); setTheme(t => updateMenuTheme(t, m => ({ ...m, categories: { ...m.categories, ...patch } })))
  }
  function setMSticky(patch: Partial<MenuTheme['stickyCategories']>) {
    setSaved(false); setTheme(t => updateMenuTheme(t, m => ({ ...m, stickyCategories: { ...m.stickyCategories, ...patch } })))
  }
  function setMHint(patch: Partial<MenuTheme['hintPopup']>) {
    setSaved(false); setTheme(t => ({ ...t, menu: { ...t.menu, hintPopup: { ...t.menu.hintPopup, ...patch } } }))
  }
  function setMNav(patch: Partial<MenuTheme['navigation']>) {
    setSaved(false); setTheme(t => updateMenuTheme(t, m => ({ ...m, navigation: { ...m.navigation, ...patch } })))
  }
  function setMBg(patch: Partial<MenuTheme['background']>) {
    setSaved(false); setTheme(t => updateMenuTheme(t, m => ({ ...m, background: { ...m.background, ...patch } })))
  }
  function setMPageBg(patch: Partial<MenuTheme['pageBackground']>) {
    setSaved(false); setTheme(t => updateMenuTheme(t, m => ({ ...m, pageBackground: { ...m.pageBackground, ...patch } })))
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
      // Keep the gif type for animated GIFs so the selected pill stays coherent.
      const type = file.type === 'image/gif' ? 'gif' as const : 'image' as const
      setLBg({ type, value: `${pub.publicUrl}?v=${Date.now()}` })
    } else if (err) setError('Upload: ' + err.message)
    setBgUploading(false)
  }

  async function handleMenuBgUpload(file: File) {
    if (file.size > MAX_MEDIA_BYTES) { setError('Immagine troppo grande (max 5MB).'); return }
    setMenuBgUploading(true); setError(null)
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${restaurantId}/menu-bg.${ext}`
    const { data, error: err } = await supabase.storage
      .from('restaurant-assets').upload(path, file, { upsert: true })
    if (!err && data) {
      const { data: pub } = supabase.storage.from('restaurant-assets').getPublicUrl(data.path)
      setMBg({ image: `${pub.publicUrl}?v=${Date.now()}` })
    } else if (err) setError('Upload: ' + err.message)
    setMenuBgUploading(false)
  }

  async function handleMenuPageBgUpload(file: File) {
    if (file.size > MAX_MEDIA_BYTES) { setError('Immagine troppo grande (max 5MB).'); return }
    setPageBgUploading(true); setError(null)
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${restaurantId}/menu-page-bg.${ext}`
    const { data, error: err } = await supabase.storage
      .from('restaurant-assets').upload(path, file, { upsert: true })
    if (!err && data) {
      const { data: pub } = supabase.storage.from('restaurant-assets').getPublicUrl(data.path)
      setMPageBg({ image: `${pub.publicUrl}?v=${Date.now()}` })
    } else if (err) setError('Upload: ' + err.message)
    setPageBgUploading(false)
  }

  async function handleLogoUpload(file: File) {
    if (file.size > MAX_MEDIA_BYTES) { setError('Immagine troppo grande (max 5MB).'); return }
    setLogoUploading(true); setError(null)
    const supabase = createClient()
    // Cut out a uniform background color so the logo fuses with the landing
    // background instead of showing a solid box around it.
    let blob: Blob = file
    let ext = file.name.split('.').pop() ?? 'png'
    try {
      const cut = await removeUniformBackground(file)
      if (cut !== (file as Blob)) { blob = cut; ext = 'png' }
    } catch { /* fall back to original file */ }
    const path = `${restaurantId}/logo.${ext}`
    const { data, error: err } = await supabase.storage
      .from('restaurant-assets').upload(path, blob, { upsert: true, contentType: blob.type || file.type })
    if (!err && data) {
      const { data: pub } = supabase.storage.from('restaurant-assets').getPublicUrl(data.path)
      setLLogo({ image: `${pub.publicUrl}?v=${Date.now()}` })
    } else if (err) setError('Upload: ' + err.message)
    setLogoUploading(false)
  }

  async function handleFontUpload(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!(CUSTOM_FONT_EXTENSIONS as readonly string[]).includes(ext)) {
      setError('Formato non supportato (usa .ttf, .otf, .woff o .woff2).')
      return null
    }
    if (file.size > MAX_FONT_BYTES) { setError('File troppo grande (max 2MB).'); return null }
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Font personalizzato'
    setFontUploading(true); setError(null)
    const supabase = createClient()
    const path = `${restaurantId}/fonts/${slugifyFontName(name)}.${ext}`
    const { data, error: err } = await supabase.storage
      .from('restaurant-assets').upload(path, file, { upsert: true, contentType: file.type })
    setFontUploading(false)
    if (err || !data) { setError('Upload: ' + err?.message); return null }
    const { data: pub } = supabase.storage.from('restaurant-assets').getPublicUrl(data.path)
    setCustomFonts({ [name]: `${pub.publicUrl}?v=${Date.now()}` })
    return name
  }

  async function handlePosterUpload(file: File) {
    if (file.size > MAX_MEDIA_BYTES) { setError('Immagine troppo grande (max 5MB).'); return }
    setPosterUploading(true); setError(null)
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${restaurantId}/theme-video-poster-custom.${ext}`
    const { data, error: err } = await supabase.storage
      .from('restaurant-assets').upload(path, file, { upsert: true })
    if (!err && data) {
      const { data: pub } = supabase.storage.from('restaurant-assets').getPublicUrl(data.path)
      setLBg({ poster: `${pub.publicUrl}?v=${Date.now()}` })
    } else if (err) setError('Upload: ' + err.message)
    setPosterUploading(false)
  }

  async function handleVideoUpload(rawFile: File) {
    setVidUploading(true); setError(null)

    // Compress oversized videos in-browser before upload (re-encode + downscale).
    let file = rawFile
    if (rawFile.size > MAX_MEDIA_BYTES) {
      setError('Compressione video in corso…')
      file = await compressVideoFile(rawFile)
      if (file.size > MAX_MEDIA_BYTES) {
        setError(`Video ancora troppo grande dopo la compressione (${(file.size / 1024 / 1024).toFixed(1)}MB, max 5MB). Usa un video più corto.`)
        setVidUploading(false); return
      }
      setError(null)
    }

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

  function setAds(ads: AdConfig[]) { setTheme(t => ({ ...t, ads })); setSaved(false) }

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false)
    try { await saveTheme(restaurantId, theme as unknown as object); setSaved(true) }
    catch (e: unknown) { setError((e as Error).message ?? 'Errore.') }
    finally { setSaving(false) }
  }

  // ── Base mode handlers ────────────────────────────────────────────────────────
  // Applicano un preset completo o propagano una singola leva (font/colore) su
  // tutto il tema, override per-menu inclusi (vedi lib/themePresets.ts).
  function applyPreset(p: ThemePreset) {
    setSaved(false)
    setTheme(t => {
      const next = { ...structuredClone(p.theme), customFonts: structuredClone(t.customFonts) }
      // Preserve the user's popup content and on/off state: the preset provides
      // visual styling (colors, font, radius) but must not overwrite what the
      // owner wrote in the title/text fields or toggled on/off.
      next.menu.hintPopup = {
        ...next.menu.hintPopup,
        enabled:  t.menu.hintPopup.enabled,
        showOnce: t.menu.hintPopup.showOnce,
        title:    t.menu.hintPopup.title,
        text:     t.menu.hintPopup.text,
      }
      return next
    })
  }
  function baseFont(font: string)     { setSaved(false); setTheme(t => applyBaseFont(t, font)) }
  function baseAccent(color: string)  { setSaved(false); setTheme(t => applyBaseAccent(t, color)) }
  function baseSurface(color: string) {
    // Cambiando lo sfondo, ricalcola anche i "muted" derivati dalla coppia testo/sfondo.
    setSaved(false)
    setTheme(t => applyBaseText(applyBaseSurface(t, color), t.menu.dishes.titleColor, color))
  }
  function baseText(color: string) {
    setSaved(false)
    setTheme(t => applyBaseText(t, color, t.menu.pageBackground.color))
  }

  // Passando a "base" la tab Pop-up (esclusiva dell'avanzata) non ha senso.
  function changeEditorLevel(level: 'base' | 'advanced') {
    if (level === 'base' && previewMode === 'hint') setPreviewMode('menu')
    setEditorLevel(level)
  }
  const baseMode = editorLevel === 'base'

  const setters: SidebarSetters = {
    setLBg, setLLogo, setLTitle, setLDesc, setLBu, setLPos, setL,
    setMDishes, setMDescs, setMPrices, setMCats, setMLayout, setMDivider, setMBg, setMPageBg, setMNav, setMSticky, setMHint, setMAllergens, setM,
    setC, setCardTitle, setCardDesc, setCardPrice, setCardAllergens, setCardClose, setCardCategory, setCardPairing,
    handleBgUpload, handleVideoUpload, handleMenuBgUpload, handleMenuPageBgUpload, handlePosterUpload, handleLogoUpload, handleFontUpload,
    bgUploading, vidUploading, menuBgUploading, pageBgUploading, posterUploading, logoUploading, fontUploading,
  }

  // La tab "Pop-up" ha un solo target: il pannello si apre da sé, senza
  // bisogno della modalità Modifica né di un click nell'anteprima.
  const sidebarTarget = previewMode === 'hint' ? 'menu-hint' : activeEditor
  const sidebarOpen   = previewMode === 'hint' || activeEditor !== null
  const closeSidebar  = previewMode === 'hint' ? () => setPreviewMode('menu') : () => setActiveEditor(null)


  return (
    /* useFillHeight measures this wrapper's real top offset and stretches it to
       the bottom of the viewport, so the preview fills all available space with
       no fixed-offset guessing and no leftover bottom gap. */
    <div ref={fillRef} className="flex flex-col"
      style={{ height: fillHeight ? fillHeight : 'calc(100dvh - 270px)', minHeight: 360 }}>

      {/* ── Control bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3 pb-3 mb-3 border-b border-gray-100 flex-wrap shrink-0">

        {/* Livello editor: Base / Avanzata */}
        <div className="flex items-center rounded-full border border-gray-200 p-0.5 shrink-0">
          {(['base', 'advanced'] as const).map(lvl => (
            <button key={lvl} type="button" onClick={() => changeEditorLevel(lvl)}
              className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full transition-colors ${
                editorLevel === lvl ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'
              }`}>
              {lvl === 'base' ? 'Base' : 'Avanzata'}
            </button>
          ))}
        </div>

        <div className="hidden sm:block w-px h-5 bg-gray-200 mx-0.5 shrink-0" />

        {/* Mode tabs — la tab Pop-up esiste solo in modalità avanzata */}
        {(baseMode ? (['landing', 'menu', 'card'] as const) : (['landing', 'menu', 'card', 'hint'] as const)).map(mode => (
          <button key={mode} type="button" onClick={() => { setPreviewMode(mode); setAdsOpen(false) }}
            className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider border transition-colors ${
              !adsOpen && previewMode === mode
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}>
            {mode === 'landing' ? 'Landing' : mode === 'menu' ? 'Menu' : mode === 'card' ? 'Card' : 'Pop-up'}
          </button>
        ))}

        {/* Menù Media — gestione pagine Ad nel flipbook */}
        <button type="button" onClick={() => setAdsOpen(o => !o)}
          className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider border transition-colors ${
            adsOpen
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
          }`}>
          Menù Media
        </button>

        {/* Sub-tab per-menu: Generale + un tab per ogni menu del ristorante.
            Visibili solo nella tab Menu e solo se c'è più di un menu. */}
        {previewMode === 'menu' && menus.length > 1 && (
          <div className="w-full sm:w-auto flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-400 select-none">↳</span>
            {[{ id: null as string | null, name: 'Generale' }, ...menus].map(mn => (
              <button key={mn.id ?? '__general'} type="button" onClick={() => setActiveMenuTab(mn.id)}
                className={`px-2.5 py-1 text-[10px] font-medium border rounded-full transition-colors ${
                  activeMenuTab === mn.id
                    ? 'bg-gray-700 text-white border-gray-700'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}>
                {mn.name}
                {mn.id !== null && theme.menuThemes?.[mn.id] && (
                  <span className="ml-1 text-amber-400" title="Questo menu ha personalizzazioni proprie">●</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Strumenti dell'editor avanzato — nascosti in modalità base */}
        {!baseMode && (
          <>
            <div className="hidden sm:block w-px h-5 bg-gray-200 mx-1 shrink-0" />
            <span className="hidden md:inline ml-1 text-[10px] text-gray-400">
              {activeEditor ? `Modifica: ${EDITOR_TARGETS[activeEditor]?.title ?? activeEditor}` : 'Clicca un elemento per modificarlo'}
            </span>
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status + save */}
        {saved  && <span className="text-xs text-green-600 shrink-0">Salvato</span>}
        {error  && <span className="text-xs text-red-500 truncate max-w-[120px] shrink-0">{error}</span>}

        {/* Zoom control */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button type="button"
            onClick={() => setPreviewZoom(z => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
            className="w-6 h-6 flex items-center justify-center border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800 leading-none select-none text-base">−</button>
          <span className="text-[10px] font-mono text-gray-400 w-9 text-center select-none">{Math.round(previewZoom * 100)}%</span>
          <button type="button"
            onClick={() => setPreviewZoom(z => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
            className="w-6 h-6 flex items-center justify-center border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800 leading-none select-none text-base">+</button>
        </div>

        <button type="button"
          onClick={() => { if (confirm('Ripristinare il tema predefinito?')) { setTheme(DEFAULT_THEME); setSaved(false) } }}
          className="hidden sm:inline text-[10px] text-gray-400 hover:text-gray-600 shrink-0">
          Ripristina
        </button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="bg-gray-900 text-white text-xs font-medium px-4 py-2 hover:bg-gray-700 disabled:opacity-50 transition-colors shrink-0 min-w-[52px] flex items-center justify-center">
          {saving ? <Spinner color="#fff" size={4} /> : 'Salva'}
        </button>
      </div>

      {/* ── Main: preview + contextual editor panel ────────────────────────
          Desktop: side-by-side (preview shrinks as panel opens).
          Mobile:  full-width preview with chip bar above; dropdown overlays
                   the top portion of the iframe leaving most of it visible. */}
      {adsOpen ? (
        <AdsPanel ads={theme.ads} setAds={setAds} restaurantId={restaurantId} />
      ) : baseMode ? (
        /* ── Modalità base: anteprima + pannello preset/leve, sempre aperto.
              Desktop affiancati; mobile impilati (pannello scrollabile sotto). */
        <div className="flex-1 flex flex-col sm:flex-row min-h-0 rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex-1 min-w-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 p-3 sm:p-5 min-h-0">
            <LivePreview
              qrToken={qrToken} theme={theme} previewMode={previewMode} activeMenuId={activeMenuTab}
              editMode={isMobile} showDummyData={false}
              onElementClick={() => {}} onViewChange={setPreviewMode} zoom={previewZoom}
            />
          </div>
          <aside className="shrink-0 w-full sm:w-[380px] bg-white border-t sm:border-t-0 sm:border-l border-gray-200 overflow-hidden max-h-[48dvh] sm:max-h-none">
            <BasePanel
              theme={theme} customFonts={theme.customFonts}
              onUploadFont={handleFontUpload} fontUploading={fontUploading}
              onApplyPreset={applyPreset}
              onFont={baseFont} onSurface={baseSurface} onText={baseText} onAccent={baseAccent}
              popupEnabled={theme.menu.hintPopup.enabled}
              onPopupToggle={v => setMHint({ enabled: v })}
              onPreviewPopup={() => setPreviewMode('hint')}
            />
          </aside>
        </div>
      ) : (
      <div className="flex-1 flex min-h-0 rounded-lg border border-gray-200" style={{ overflow: 'visible' }}>

        {/* Preview column — chip bar + iframe stacked on mobile */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0 relative">

          {/* Mobile chip bar: sm:hidden, scrollable chips for current tab's targets.
              La tab "Pop-up" ha un solo target e si apre da sé: niente chip. */}
          <div className="shrink-0 bg-white border-b border-gray-100 relative z-20">
            {previewMode !== 'hint' && (
              <div className="flex gap-1.5 px-3 py-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {MOBILE_TARGETS[previewMode].map(target => (
                  <button key={target} type="button"
                    onClick={() => setActiveEditor(prev => prev === target ? null : target)}
                    className={`shrink-0 px-3 py-1.5 text-[11px] font-medium rounded-full border transition-colors whitespace-nowrap ${
                      activeEditor === target
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}>
                    {MOBILE_LABELS[target] ?? target}
                  </button>
                ))}
              </div>
            )}
            {/* Dropdown editor panel — overlays iframe from top, max 48dvh (mobile only) */}
            {sidebarTarget !== null && (previewMode === 'hint' || MOBILE_TARGETS[previewMode].includes(sidebarTarget)) && (
              <div className="sm:hidden absolute top-full left-0 right-0 bg-white shadow-xl z-50 overflow-y-auto"
                style={{ maxHeight: '48dvh', borderBottom: '1px solid #e5e7eb' }}>
                <EditorSidebar target={sidebarTarget} theme={theme} setters={setters}
                  previewMode={previewMode} activeMenuId={activeMenuTab} onClose={closeSidebar}
                  restaurantName={restaurantName} restaurantLogo={restaurantLogo} />
              </div>
            )}
          </div>

          {/* Preview iframe area — fills remaining height, centers phone mockup */}
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 transition-all duration-300 ease-out p-3 sm:p-5 min-h-0">
            <LivePreview
              qrToken={qrToken} theme={theme} previewMode={previewMode} activeMenuId={activeMenuTab}
              editMode={editMode || isMobile} showDummyData={showDummyData}
              onElementClick={setActiveEditor} onViewChange={setPreviewMode} zoom={previewZoom}
            />
          </div>
        </div>

        {/* Desktop sidebar — hidden on mobile, animates width open/closed */}
        <aside
          className={`hidden sm:block shrink-0 bg-white overflow-hidden transition-[width] duration-300 ease-out ${
            sidebarOpen ? 'sm:w-[46vw] md:w-[380px] border-l border-gray-200' : 'w-0'
          }`}>
          {sidebarOpen && (
            <div className="h-full sm:w-[46vw] md:w-[380px]">
              <EditorSidebar target={sidebarTarget!} theme={theme} setters={setters} previewMode={previewMode} activeMenuId={activeMenuTab} onClose={closeSidebar}
                restaurantName={restaurantName} restaurantLogo={restaurantLogo} />
            </div>
          )}
        </aside>
      </div>
      )}

    </div>
  )
}

// ── AdsPanel ──────────────────────────────────────────────────────────────────

interface MenuOption { id: string; name: string }
interface DishOption {
  id: string; name: string; price: number | null; description: string | null
  image_url: string | null; category: string; menu_id: string; menu_name: string
}

function AdsPanel({ ads, setAds, restaurantId }: {
  ads: AdConfig[]; setAds: (a: AdConfig[]) => void; restaurantId: string
}) {
  const EMPTY = (): AdConfig => ({
    insertAfterPdfPage: 1, menuId: '', dishId: '', mode: 'auto_generated',
    backupImageUrl: '', dishName: '', dishDescription: '', badgeText: '', price: '', promoPrice: '', promoPriceMode: 'solo',
    categoryTarget: undefined,
  })

  const [adding,        setAdding]        = useState(false)
  // null = nuovo media; numero = indice del media esistente in modifica
  const [editingIndex,  setEditingIndex]  = useState<number | null>(null)
  const [form,          setForm]          = useState<AdConfig>(EMPTY())
  const [adMode,        setAdMode]        = useState<'promo' | 'categoria'>('promo')
  // pageStr: stato stringa separato per l'input pagina — evita che il campo si blocchi su "1"
  const [pageStr,       setPageStr]       = useState('1')
  const [menuOptions,   setMenuOptions]   = useState<MenuOption[]>([])
  const [dishes,        setDishes]        = useState<DishOption[]>([])
  const [loading,       setLoading]       = useState(true)
  const [imgUploading,  setImgUploading]  = useState(false)
  const [imgError,      setImgError]      = useState<string | null>(null)
  const [vidUploading,  setVidUploading]  = useState(false)
  const [vidError,      setVidError]      = useState<string | null>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const vidInputRef = useRef<HTMLInputElement>(null)

  // Carica menu + piatti una sola volta al mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: menus } = await supabase
        .from('menus')
        .select('id, name, dishes(id, name, description, price, image_url, category)')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (cancelled || !menus) return
      setMenuOptions((menus as any[]).map(m => ({ id: m.id, name: m.name })))
      setDishes((menus as any[]).flatMap(m =>
        (m.dishes as any[]).map((d: any) => ({ ...d, menu_id: m.id, menu_name: m.name }))
      ))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [restaurantId])

  async function handleImgUpload(file: File) {
    if (file.size > MAX_MEDIA_BYTES) { setImgError('Immagine troppo grande (max 5 MB).'); return }
    setImgUploading(true); setImgError(null)
    const supabase = createClient()
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const { data, error } = await supabase.storage
      .from('restaurant-assets').upload(`${restaurantId}/ads/${Date.now()}.${ext}`, file, { upsert: false })
    setImgUploading(false)
    if (error || !data) { setImgError('Upload fallito: ' + error?.message); return }
    const { data: pub } = supabase.storage.from('restaurant-assets').getPublicUrl(data.path)
    setForm(f => ({ ...f, backupImageUrl: pub.publicUrl }))
  }

  async function handleVidUpload(rawFile: File) {
    setVidUploading(true); setVidError(null)
    let file = rawFile
    if (rawFile.size > MAX_MEDIA_BYTES) {
      setVidError('Compressione in corso…')
      file = await compressVideoFile(rawFile)
      if (file.size > MAX_MEDIA_BYTES) {
        setVidError(`Video ancora troppo grande (${(file.size / 1024 / 1024).toFixed(1)} MB, max 5 MB). Usa un clip più corto.`)
        setVidUploading(false); return
      }
      setVidError(null)
    }
    const supabase = createClient()
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
    const { data, error } = await supabase.storage
      .from('restaurant-assets').upload(`${restaurantId}/ads/${Date.now()}.${ext}`, file, { upsert: false })
    setVidUploading(false)
    if (error || !data) { setVidError('Upload fallito: ' + error?.message); return }
    const { data: pub } = supabase.storage.from('restaurant-assets').getPublicUrl(data.path)
    setForm(f => ({ ...f, mediaUrl: pub.publicUrl, mode: 'custom_media' }))
  }

  function pickDish(dishId: string) {
    const d = dishes.find(x => x.id === dishId)
    if (!d) { setForm(f => ({ ...f, dishId: '' })); return }
    setForm(f => ({
      ...f, dishId: d.id, dishName: d.name,
      dishDescription: d.description ?? '',
      price: d.price != null ? `€ ${d.price.toFixed(2).replace('.', ',')}` : f.price,
      backupImageUrl: d.image_url ?? f.backupImageUrl,
    }))
  }

  function resetForm() { setForm(EMPTY()); setPageStr('1'); setEditingIndex(null); setAdMode('promo') }

  function startEdit(idx: number) {
    const ad = ads[idx]
    if (!ad) return
    setAdMode(ad.categoryTarget ? 'categoria' : 'promo')
    setForm({ ...EMPTY(), ...ad, dishName: ad.dishName ?? '' })
    setPageStr(String(Math.max(1, ad.insertAfterPdfPage || 1)))
    setEditingIndex(idx)
    setAdding(true)
  }

  const canSave = adMode === 'categoria'
    ? !!form.menuId && !!form.categoryTarget?.trim()
    : !!form.menuId && (!!(form.dishName ?? '').trim() || !!form.mediaUrl?.trim() || !!form.backupImageUrl?.trim())

  function handleAdd() {
    if (!canSave) return
    let entry: AdConfig
    if (adMode === 'categoria') {
      entry = {
        ...form,
        insertAfterPdfPage: 1,
        categoryTarget:  form.categoryTarget?.trim(),
        menuId:          form.menuId || undefined,
        dishId:          '',
        dishName:        '',
        dishDescription: form.dishDescription?.trim() || undefined,
        badgeText:       undefined,
        price:           undefined,
        promoPrice:      undefined,
        promoPriceMode:  undefined,
        mediaUrl:        form.mediaUrl?.trim() || undefined,
      }
    } else {
      const n = Math.max(1, parseInt(pageStr) || 1)
      entry = {
        ...form,
        insertAfterPdfPage: n,
        categoryTarget:  undefined,
        menuId:          form.menuId    || undefined,
        dishName:        (form.dishName ?? '').trim(),
        dishDescription: form.dishDescription?.trim() || undefined,
        badgeText:       form.badgeText?.trim()   || undefined,
        price:           form.price?.trim()        || undefined,
        promoPrice:      form.promoPrice?.trim()   || undefined,
        promoPriceMode:  form.promoPrice?.trim()   ? (form.promoPriceMode ?? 'solo') : undefined,
        mediaUrl:        form.mediaUrl?.trim()     || undefined,
      }
    }
    setAds(editingIndex !== null
      ? ads.map((a, i) => (i === editingIndex ? entry : a))
      : [...ads, entry])
    resetForm()
    setAdding(false)
  }

  const filteredDishes = form.menuId ? dishes.filter(d => d.menu_id === form.menuId) : []
  const uniqueCategories = Array.from(new Set(filteredDishes.map(d => d.category).filter(Boolean))).sort() as string[]
  const INPUT = 'mt-1 w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-gray-400 bg-white'

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-white rounded-lg border border-gray-200">
      <div className="max-w-xl mx-auto space-y-6">

        <div>
          <h2 className="text-sm font-semibold text-gray-900">Menù Media</h2>
          <p className="mt-1 text-xs text-gray-500 leading-relaxed">
            Pagine con foto/video iniettate nel flipbook: promo di un prodotto (con card
            al click) oppure presentazione di una categoria (appare prima della categoria).
            Ricorda di <strong>Salvare</strong>.
          </p>
        </div>

        {ads.length === 0 && !adding && (
          <p className="text-xs text-gray-400 italic">Nessun media configurato.</p>
        )}

        <div className="space-y-2">
          {ads.map((ad, idx) => (
            <div key={idx}
              className={`flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border bg-gray-50 transition-colors ${editingIndex === idx ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'}`}>
              <button type="button" onClick={() => startEdit(idx)} className="flex-1 min-w-0 text-left group">
                <p className="text-xs font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                  {ad.categoryTarget
                    ? `Categoria: ${ad.categoryTarget}`
                    : (ad.dishName?.trim() || (ad.mediaUrl ? 'Video promo' : 'Promo senza nome'))}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {menuOptions.find(m => m.id === ad.menuId)?.name ?? 'Tutti i menu'}
                  {ad.categoryTarget
                    ? <span className="text-violet-600"> · prima di &ldquo;{ad.categoryTarget}&rdquo;</span>
                    : <span> · pag. {ad.insertAfterPdfPage}</span>}
                  {ad.badgeText  && <span> · <em>{ad.badgeText}</em></span>}
                  {ad.promoPrice ? <span> · <s>{ad.price}</s> {ad.promoPrice}</span> : ad.price ? <span> · {ad.price}</span> : null}
                  {ad.mediaUrl   && <span> · 🎬</span>}
                  {ad.dishId     && <span className="text-green-600"> · card ✓</span>}
                  <span className="text-blue-500"> · modifica</span>
                </p>
              </button>
              <button type="button" onClick={() => { setAds(ads.filter((_, i) => i !== idx)); if (editingIndex !== null) { resetForm(); setAdding(false) } }}
                className="shrink-0 text-gray-400 hover:text-red-500 transition-colors text-xl leading-none">×</button>
            </div>
          ))}
        </div>

        {adding ? (
          <div className="rounded-lg border border-gray-200 p-4 space-y-4 bg-gray-50">
            <p className="text-xs font-semibold text-gray-700">{editingIndex !== null ? 'Modifica media' : 'Nuovo media'}</p>

            {/* ── 0. Tipo di media ── */}
            <div>
              <span className="text-[11px] text-gray-500 block mb-1.5">Tipo</span>
              <div className="flex gap-2">
                {(['promo', 'categoria'] as const).map(mode => (
                  <label key={mode} className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-medium px-3 py-1.5 rounded border transition-colors ${adMode === mode ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'}`}>
                    <input type="radio" name="adMode" value={mode} className="sr-only"
                      checked={adMode === mode}
                      onChange={() => { setAdMode(mode); setForm(f => ({ ...EMPTY(), menuId: f.menuId })) }} />
                    {mode === 'promo' ? 'Promozione prodotto' : 'Media categoria'}
                  </label>
                ))}
              </div>
            </div>

            {/* ── 1. Menu (obbligatorio) ── */}
            <label className="block">
              <span className="text-[11px] text-gray-500">Menu * {loading && '(caricamento…)'}</span>
              <select className={INPUT} value={form.menuId ?? ''} disabled={loading}
                onChange={e => setForm(f => ({ ...f, menuId: e.target.value, dishId: '', dishName: '', price: '', backupImageUrl: '', categoryTarget: undefined }))}>
                <option value="">— seleziona menu —</option>
                {menuOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>

            {/* ── 2a. PROMO: piatto collegato (opzionale, filtrato per menu) ── */}
            {adMode === 'promo' && form.menuId && (
              <label className="block">
                <span className="text-[11px] text-gray-500">Piatto collegato (opzionale — apre la card al click)</span>
                <select className={INPUT} value={form.dishId}
                  onChange={e => pickDish(e.target.value)}>
                  <option value="">— nessun collegamento —</option>
                  {filteredDishes.map(d => (
                    <option key={d.id} value={d.id}>{d.name}{d.category ? ` · ${d.category}` : ''}</option>
                  ))}
                </select>
                {form.dishId && <p className="mt-1 text-[11px] text-green-600">✓ Al click si aprirà la card del piatto</p>}
              </label>
            )}

            {/* ── 2b. CATEGORIA: selettore categoria ── */}
            {adMode === 'categoria' && form.menuId && (
              <label className="block">
                <span className="text-[11px] text-gray-500">Categoria * (il media apparirà prima di questa categoria)</span>
                <select className={INPUT} value={form.categoryTarget ?? ''}
                  onChange={e => setForm(f => ({ ...f, categoryTarget: e.target.value }))}>
                  <option value="">— seleziona categoria —</option>
                  {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              {/* ── 3. Nome (solo per promo) ── */}
              {adMode === 'promo' && (
                <label className="col-span-2 block">
                  <span className="text-[11px] text-gray-500">Nome nella promo <span className="text-gray-400">(opzionale)</span></span>
                  <input className={INPUT} value={form.dishName ?? ''}
                    onChange={e => setForm(f => ({ ...f, dishName: e.target.value }))}
                    placeholder="es. Tagliere Gourmet — lascia vuoto per solo video" />
                </label>
              )}

              {/* ── 3b. Descrizione ── */}
              <label className="col-span-2 block">
                <span className="text-[11px] text-gray-500">Descrizione (opzionale — appare sotto il titolo)</span>
                <textarea className={INPUT + ' resize-none'} rows={2}
                  value={form.dishDescription ?? ''}
                  onChange={e => setForm(f => ({ ...f, dishDescription: e.target.value }))}
                  placeholder="es. Selezione di salumi e formaggi artigianali…" />
              </label>

              {/* ── 4. Pagina (solo per promo) ── */}
              {adMode === 'promo' && (
                <label className="block">
                  <span className="text-[11px] text-gray-500">Dopo pagina PDF n°</span>
                  <input type="number" min={1} className={INPUT}
                    value={pageStr}
                    onChange={e => setPageStr(e.target.value)}
                    onBlur={() => {
                      const n = Math.max(1, parseInt(pageStr) || 1)
                      setPageStr(String(n))
                      setForm(f => ({ ...f, insertAfterPdfPage: n }))
                    }} />
                </label>
              )}

              {/* ── 5. Badge (solo per promo) ── */}
              {adMode === 'promo' && (
                <label className="block">
                  <span className="text-[11px] text-gray-500">Badge (opzionale)</span>
                  <input className={INPUT} value={form.badgeText ?? ''}
                    onChange={e => setForm(f => ({ ...f, badgeText: e.target.value }))}
                    placeholder="es. Specialità della Casa" />
                </label>
              )}

              {/* ── 6. Prezzi (solo per promo) ── */}
              {adMode === 'promo' && (<>
                <label className="block">
                  <span className="text-[11px] text-gray-500">Prezzo originale</span>
                  <input className={INPUT} value={form.price ?? ''}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="es. € 18,00" />
                </label>

                <label className="block">
                  <span className="text-[11px] text-gray-500">Prezzo promo</span>
                  <input className={INPUT} value={form.promoPrice ?? ''}
                    onChange={e => setForm(f => ({ ...f, promoPrice: e.target.value }))}
                    placeholder="es. € 14,00" />
                </label>

                {form.promoPrice?.trim() && (
                  <div className="col-span-2">
                    <span className="text-[11px] text-gray-500 block mb-1.5">Visualizzazione prezzo promo</span>
                    <div className="flex gap-3">
                      {([['strikethrough', `${form.price || '€ 18'} → ${form.promoPrice} (barrato)`],
                         ['solo',          `Solo ${form.promoPrice} in evidenza`]] as const).map(([val, label]) => (
                        <label key={val} className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-700">
                          <input type="radio" name="promoPriceMode" value={val}
                            checked={(form.promoPriceMode ?? 'solo') === val}
                            onChange={() => setForm(f => ({ ...f, promoPriceMode: val }))} />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>)}
            </div>

            {/* ── 7. Foto sfondo (Ken Burns) ── */}
            <div>
              <span className="text-[11px] text-gray-500">Foto sfondo — Ken Burns</span>
              <div className="mt-1 flex gap-2 items-center">
                <input className={INPUT + ' flex-1 min-w-0'} value={form.backupImageUrl}
                  onChange={e => setForm(f => ({ ...f, backupImageUrl: e.target.value }))}
                  placeholder="https://… oppure carica →" />
                <button type="button" onClick={() => imgInputRef.current?.click()} disabled={imgUploading}
                  className="shrink-0 px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors whitespace-nowrap">
                  {imgUploading ? 'Caricamento…' : 'Sfoglia foto'}
                </button>
                <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImgUpload(f); e.target.value = '' }} />
              </div>
              {imgError && <p className="mt-1 text-[11px] text-red-500">{imgError}</p>}
              {form.backupImageUrl && !imgUploading && (
                <img src={form.backupImageUrl} alt=""
                  className="mt-2 h-20 w-full rounded object-cover border border-gray-200"
                  onError={e => (e.currentTarget.style.display = 'none')} />
              )}
            </div>

            {/* ── 8. Video promo (opzionale, sovrascrive foto) ── */}
            <div>
              <span className="text-[11px] text-gray-500">Video promo <span className="text-gray-400">(opzionale — sovrascrive la foto)</span></span>
              <div className="mt-1 flex gap-2 items-center">
                <input className={INPUT + ' flex-1 min-w-0'} value={form.mediaUrl ?? ''}
                  onChange={e => setForm(f => ({ ...f, mediaUrl: e.target.value, mode: e.target.value ? 'custom_media' : 'auto_generated' }))}
                  placeholder="https://… oppure carica →" />
                <button type="button" onClick={() => vidInputRef.current?.click()} disabled={vidUploading}
                  className="shrink-0 px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors whitespace-nowrap">
                  {vidUploading ? 'Caricamento…' : 'Sfoglia video'}
                </button>
                <input ref={vidInputRef} type="file" accept="video/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleVidUpload(f); e.target.value = '' }} />
              </div>
              {vidError && <p className="mt-1 text-[11px] text-red-500">{vidError}</p>}
              {form.mediaUrl && !vidUploading && (
                <video src={form.mediaUrl} muted playsInline
                  className="mt-2 h-20 w-full rounded object-cover border border-gray-200" />
              )}
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
              <button type="button" onClick={handleAdd}
                disabled={!canSave}
                className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded disabled:opacity-40 hover:bg-gray-700 transition-colors">
                {editingIndex !== null ? 'Salva modifiche' : 'Aggiungi'}
              </button>
              <button type="button" onClick={() => { setAdding(false); resetForm() }}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors">
                Annulla
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => { resetForm(); setAdding(true) }}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors">
            <span className="text-base leading-none font-light">+</span>
            Aggiungi media
          </button>
        )}
      </div>
    </div>
  )
}
