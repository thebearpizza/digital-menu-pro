'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveTheme, createBanner, deleteBanner } from './actions'
import {
  DEFAULT_THEME, SERIF_FONTS, SANS_FONTS, DISPLAY_FONTS, PAGINATION_OPTIONS,
  MENU_BG_EFFECTS, MENU_BG_EFFECT_LABELS,
  googleFontsUrl, allThemeFonts, fontStack, formatPrice,
} from '@/lib/theme'
import { ALL_GOOGLE_FONTS } from '@/lib/googleFontsCatalog'
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

// Searchable font picker — spans the full Google Fonts catalog (1500+ families)
// plus a curated shortlist shown first. Renders inline (no absolute dropdown) so
// it never gets clipped by the sidebar's overflow containers. Each visible option
// is previewed in its own font, loaded on demand.

function FontSelector({ label, value, curated, category, onChange }: {
  label: string; value: string; curated: string[]; category: 'serif' | 'sans'; onChange: (v: string) => void
}) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (!q) {
      const rest = ALL_GOOGLE_FONTS.filter(f => !curated.includes(f))
      return [...curated, ...rest].slice(0, 80)
    }
    return ALL_GOOGLE_FONTS.filter(f => f.toLowerCase().includes(q)).slice(0, 80)
  }, [q, curated])

  // Load the fonts currently visible in the list so each option previews itself.
  // Debounced so fast typing doesn't fire a fetch per keystroke.
  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => {
      const href = googleFontsUrl(results)
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
  }, [open, results])

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
            {results.length === 0 && (
              <p className="px-3 py-3 text-[11px] text-gray-400">Nessun font trovato.</p>
            )}
            {results.map(f => (
              <button key={f} type="button"
                onClick={() => { onChange(f); setOpen(false); setQuery('') }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors ${f === value ? 'bg-gray-100' : ''}`}
                style={{ fontFamily: fontStack(f, category) }}>
                {f}
              </button>
            ))}
            {!q && results.length >= 80 && (
              <p className="px-3 py-2 text-[10px] text-gray-300">Digita per cercare tra tutti i {ALL_GOOGLE_FONTS.length} font…</p>
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

// ── Sidebar setters interface ─────────────────────────────────────────────────

interface SidebarSetters {
  setLBg:            (p: Partial<LandingBackground>) => void
  setLLogo:          (p: Partial<LandingTheme['logo']>) => void
  setLTitle:         (p: Partial<LandingTheme['title']>) => void
  setLDesc:          (p: Partial<LandingTheme['description']>) => void
  setLBu:            (p: Partial<LandingTheme['buttons']>) => void
  setL:              (p: Partial<LandingTheme>) => void
  setMDishes:        (p: Partial<MenuTheme['dishes']>) => void
  setMDescs:         (p: Partial<MenuTheme['descriptions']>) => void
  setMPrices:        (p: Partial<MenuTheme['prices']>) => void
  setMCats:          (p: Partial<MenuTheme['categories']>) => void
  setMLayout:        (p: Partial<MenuTheme['layout']>) => void
  setMDivider:       (p: Partial<MenuTheme['layout']['divider']>) => void
  setMBg:            (p: Partial<MenuTheme['background']>) => void
  setMNav:           (p: Partial<MenuTheme['navigation']>) => void
  setM:              (p: Partial<MenuTheme>) => void
  setC:              (p: Partial<CardTheme>) => void
  setCardTitle:      (p: Partial<CardTheme['title']>) => void
  setCardDesc:       (p: Partial<CardTheme['description']>) => void
  setCardPrice:      (p: Partial<CardTheme['price']>) => void
  handleBgUpload:    (f: File) => void
  handleVideoUpload: (f: File) => void
  bgUploading:       boolean
  vidUploading:      boolean
}

// ── Buttons panel — own state for transparent-bg toggle ───────────────────────

function ButtonsPanel({ l, setLBu }: {
  l: LandingTheme; setLBu: (p: Partial<LandingTheme['buttons']>) => void
}) {
  const [bgTransparent, setBgTransparent] = useState(l.buttons.bgColor === 'transparent')
  const [bgHex, setBgHex] = useState(l.buttons.bgColor === 'transparent' ? '#000000' : l.buttons.bgColor)
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Forma</p>
        <PillGroup
          options={[{ label:'Flat', value:'flat' },{ label:'Arrotondato', value:'rounded' },{ label:'Pill', value:'pill' }]}
          value={l.buttons.shape} onChange={v => setLBu({ shape: v })} />
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
      <div>
        <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
          <input type="checkbox" checked={bgTransparent}
            onChange={e => { setBgTransparent(e.target.checked); setLBu({ bgColor: e.target.checked ? 'transparent' : bgHex }) }}
            className="accent-gray-900 w-3.5 h-3.5" />
          <span className="text-xs text-gray-600">Sfondo trasparente</span>
        </label>
        {!bgTransparent && (
          <ColorRow label="Colore sfondo" value={bgHex}
            onChange={v => { setBgHex(v); setLBu({ bgColor: v }) }} />
        )}
      </div>
      <FontSelector label="Font bottoni" value={l.buttons.font} curated={SANS_FONTS} category="sans"
        onChange={v => setLBu({ font: v })} />
      <FontSizeSlider label="Dimensione testo" value={l.buttons.fontSize}
        min={0.5} max={1.2} step={0.025} previewFont={fontStack(l.buttons.font, 'sans')}
        onChange={v => setLBu({ fontSize: v })} />
    </div>
  )
}

// ── Editor sidebar ────────────────────────────────────────────────────────────

function EditorSidebar({ target, theme, setters, onClose }: {
  target: string; theme: RestaurantTheme; setters: SidebarSetters; onClose: () => void
}) {
  const info = EDITOR_TARGETS[target]
  const l    = theme.landing
  const m    = theme.menu
  const c    = theme.card
  const bgFileRef    = useRef<HTMLInputElement>(null)
  const videoFileRef = useRef<HTMLInputElement>(null)

  function renderControls() {
    switch (target) {

      case 'landing-bg': return (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tipo</p>
            <PillGroup
              options={[{ label:'Colore', value:'color' },{ label:'Immagine', value:'image' },{ label:'Video', value:'video' },{ label:'GIF', value:'gif' }]}
              value={l.background.type} onChange={v => setters.setLBg({ type: v })} />
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
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Loop</p>
                <PillGroup
                  options={[{ label:'Loop', value:'loop' },{ label:'Una volta', value:'once' },{ label:'Ping-pong', value:'pingpong' }]}
                  value={l.background.loopMode} onChange={v => setters.setLBg({ loopMode: v })} />
              </div>
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
        </div>
      )

      case 'landing-logo': return (
        <div className="space-y-4">
          <FontSizeSlider label="Dimensione logo" value={l.logo.size}
            min={1} max={8} step={0.25} previewFont="inherit"
            onChange={v => setters.setLLogo({ size: v })} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Blend mode</p>
            <PillGroup
              options={[{ label:'Normale', value:'normal' },{ label:'Multiply', value:'multiply' },{ label:'Screen', value:'screen' }]}
              value={l.logo.mixBlend} onChange={v => setters.setLLogo({ mixBlend: v })} />
          </div>
        </div>
      )

      case 'landing-title': return (
        <div className="space-y-4">
          <FontSelector label="Font" value={l.title.font}
            curated={[...SERIF_FONTS, ...DISPLAY_FONTS]} category="serif"
            onChange={v => setters.setLTitle({ font: v })} />
          <FontSizeSlider label="Dimensione" value={l.title.size}
            min={0.8} max={5} step={0.1} previewFont={fontStack(l.title.font, 'serif')}
            onChange={v => setters.setLTitle({ size: v })} />
          <ColorRow label="Colore" value={l.title.color} onChange={v => setters.setLTitle({ color: v })} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Peso</p>
            <PillGroup
              options={[{ label:'Light', value:'light' },{ label:'Normal', value:'normal' },{ label:'Bold', value:'bold' }]}
              value={l.title.weight} onChange={v => setters.setLTitle({ weight: v })} />
          </div>
        </div>
      )

      case 'landing-desc': return (
        <div className="space-y-4">
          <FontSelector label="Font" value={l.description.font}
            curated={SANS_FONTS} category="sans"
            onChange={v => setters.setLDesc({ font: v })} />
          <FontSizeSlider label="Dimensione" value={l.description.size}
            min={0.4} max={1.4} step={0.05} previewFont={fontStack(l.description.font, 'sans')}
            onChange={v => setters.setLDesc({ size: v })} />
          <ColorRow label="Colore" value={l.description.color.slice(0, 7)}
            onChange={v => setters.setLDesc({ color: v })} />
        </div>
      )

      case 'landing-buttons': return (
        <ButtonsPanel l={l} setLBu={setters.setLBu} />
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
        </div>
      )

      case 'dish-title': return (
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1">Card espansa</p>
            <FontSelector label="Font" value={c.title.font}
              curated={[...SERIF_FONTS, ...DISPLAY_FONTS]} category="serif"
              onChange={v => setters.setCardTitle({ font: v })} />
            <FontSizeSlider label="Dimensione" value={c.title.size}
              min={1.0} max={3.5} step={0.1} previewFont={fontStack(c.title.font, 'serif')}
              onChange={v => setters.setCardTitle({ size: v })} />
            <ColorRow label="Colore" value={c.title.color}
              onChange={v => setters.setCardTitle({ color: v })} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Peso</p>
              <PillGroup
                options={[{ label:'Light', value:'light' },{ label:'Normal', value:'normal' },{ label:'Bold', value:'bold' }]}
                value={c.title.weight} onChange={v => setters.setCardTitle({ weight: v })} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Bordi card</p>
              <PillGroup
                options={[{ label:'Netti', value:'none' },{ label:'Soft', value:'sm' },{ label:'Arrotondati', value:'md' }]}
                value={c.borderRadius} onChange={v => setters.setC({ borderRadius: v })} />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1">Menu PDF (flipbook)</p>
            <FontSelector label="Font" value={m.dishes.titleFont}
              curated={[...SERIF_FONTS, ...DISPLAY_FONTS]} category="serif"
              onChange={v => setters.setMDishes({ titleFont: v })} />
            <FontSizeSlider label="Dimensione" value={m.dishes.titleSize}
              min={0.8} max={3.5} step={0.1} previewFont={fontStack(m.dishes.titleFont, 'serif')}
              onChange={v => setters.setMDishes({ titleSize: v })} />
            <ColorRow label="Colore" value={m.dishes.titleColor}
              onChange={v => setters.setMDishes({ titleColor: v })} />
          </div>
        </div>
      )

      case 'dish-description': return (
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1">Card espansa</p>
            <FontSelector label="Font" value={c.description.font}
              curated={SANS_FONTS} category="sans"
              onChange={v => setters.setCardDesc({ font: v })} />
            <FontSizeSlider label="Dimensione" value={c.description.size}
              min={0.6} max={1.6} step={0.05} previewFont={fontStack(c.description.font, 'sans')}
              onChange={v => setters.setCardDesc({ size: v })} />
            <ColorRow label="Colore" value={c.description.color}
              onChange={v => setters.setCardDesc({ color: v })} />
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1">Menu PDF (flipbook)</p>
            <FontSelector label="Font" value={m.descriptions.font}
              curated={SANS_FONTS} category="sans"
              onChange={v => setters.setMDescs({ font: v })} />
            <FontSizeSlider label="Dimensione" value={m.descriptions.size}
              min={0.5} max={1.6} step={0.05} previewFont={fontStack(m.descriptions.font, 'sans')}
              onChange={v => setters.setMDescs({ size: v })} />
            <ColorRow label="Colore" value={m.descriptions.color}
              onChange={v => setters.setMDescs({ color: v })} />
          </div>
        </div>
      )

      case 'dish-price': return (
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1">Card espansa</p>
            <FontSelector label="Font" value={c.price.font}
              curated={SANS_FONTS} category="sans"
              onChange={v => setters.setCardPrice({ font: v })} />
            <FontSizeSlider label="Dimensione" value={c.price.size}
              min={0.7} max={2.5} step={0.05} previewFont={fontStack(c.price.font, 'sans')}
              onChange={v => setters.setCardPrice({ size: v })} />
            <ColorRow label="Colore" value={c.price.color}
              onChange={v => setters.setCardPrice({ color: v })} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Formato</p>
              <PillGroup
                options={[{ label:'€ 12.00', value:'symbol-left' },{ label:'12.00 €', value:'symbol-right' },{ label:'12.00', value:'no-symbol' }]}
                value={c.price.format} onChange={v => setters.setCardPrice({ format: v })} />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1">Menu PDF (flipbook)</p>
            <FontSelector label="Font" value={m.prices.font}
              curated={SANS_FONTS} category="sans"
              onChange={v => setters.setMPrices({ font: v })} />
            <FontSizeSlider label="Dimensione" value={m.prices.size}
              min={0.7} max={2.5} step={0.05} previewFont={fontStack(m.prices.font, 'sans')}
              onChange={v => setters.setMPrices({ size: v })} />
            <ColorRow label="Colore" value={m.prices.color}
              onChange={v => setters.setMPrices({ color: v })} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Formato</p>
              <PillGroup
                options={[{ label:'€ 12.00', value:'symbol-left' },{ label:'12.00 €', value:'symbol-right' },{ label:'12.00', value:'no-symbol' }]}
                value={m.prices.format} onChange={v => setters.setMPrices({ format: v })} />
            </div>
          </div>
        </div>
      )

      case 'category-title': return (
        <div className="space-y-4">
          <FontSelector label="Font" value={m.categories.font}
            curated={[...SERIF_FONTS, ...DISPLAY_FONTS]} category="serif"
            onChange={v => setters.setMCats({ font: v })} />
          <FontSizeSlider label="Dimensione" value={m.categories.size}
            min={0.8} max={3.0} step={0.1} previewFont={fontStack(m.categories.font, 'serif')}
            onChange={v => setters.setMCats({ size: v })} />
          <ColorRow label="Colore" value={m.categories.color}
            onChange={v => setters.setMCats({ color: v })} />
        </div>
      )

      case 'background-layout': return (
        <div className="space-y-4">
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
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Divisore</p>
            <PillGroup
              options={[{ label:'Nessuno', value:'none' },{ label:'Solido', value:'solid' },{ label:'Tratteg.', value:'dashed' },{ label:'Punteg.', value:'dotted' }]}
              value={m.layout.divider.type} onChange={v => setters.setMDivider({ type: v })} />
            {m.layout.divider.type !== 'none' && (
              <div className="mt-2">
                <ColorRow label="Colore divisore" value={m.layout.divider.color}
                  onChange={v => setters.setMDivider({ color: v })} />
              </div>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Layout piatti</p>
            <PillGroup
              options={[{ label:'Lista', value:'list' },{ label:'Griglia', value:'grid-2' },{ label:'Card', value:'boxed-card' },{ label:'Minimal', value:'minimal-row' }]}
              value={m.layout.dishLayout} onChange={v => setters.setMLayout({ dishLayout: v })} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Allineamento</p>
            <PillGroup
              options={[{ label:'Sx', value:'left' },{ label:'Centro', value:'center' },{ label:'Dx', value:'right' }]}
              value={m.layout.dishAlignment} onChange={v => setters.setMLayout({ dishAlignment: v })} />
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
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Layout PDF</p>
            <PillGroup
              options={[{ label:'Classic', value:'classic' },{ label:'Compact', value:'compact' }]}
              value={m.pdfLayout} onChange={v => setters.setM({ pdfLayout: v })} />
          </div>
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
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {renderControls()}
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
        post({ type: 'dmp-nav', view: previewMode })
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
    post({ type: 'dmp-nav', view: previewMode })
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
  const { ref: fillRef, height: fillHeight } = useFillHeight()

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

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false)
    try { await saveTheme(restaurantId, theme as unknown as object); setSaved(true) }
    catch (e: unknown) { setError((e as Error).message ?? 'Errore.') }
    finally { setSaving(false) }
  }

  const setters: SidebarSetters = {
    setLBg, setLLogo, setLTitle, setLDesc, setLBu, setL,
    setMDishes, setMDescs, setMPrices, setMCats, setMLayout, setMDivider, setMBg, setMNav, setM,
    setC, setCardTitle, setCardDesc, setCardPrice,
    handleBgUpload, handleVideoUpload, bgUploading, vidUploading,
  }
  void setCardAllergens; void setCardClose; void setMAllergens; void setMSticky

  const sidebarOpen = editMode && activeEditor !== null


  return (
    /* useFillHeight measures this wrapper's real top offset and stretches it to
       the bottom of the viewport, so the preview fills all available space with
       no fixed-offset guessing and no leftover bottom gap. */
    <div ref={fillRef} className="flex flex-col"
      style={{ height: fillHeight ? fillHeight : 'calc(100dvh - 270px)', minHeight: 360 }}>

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

      {/* ── Main: preview (left) + contextual editor panel (right) ──────────
          The panel is always part of the flex row: when an element is selected
          it animates its width open and the preview shrinks to make room — a
          smooth side-by-side, no overlay and no blur over the iframe. */}
      <div className="flex-1 flex min-h-0 rounded-lg overflow-hidden border border-gray-200">

        {/* Preview — flex-1 so it shrinks proportionally as the panel opens */}
        <div className="flex-1 min-w-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 transition-all duration-300 ease-out p-3 sm:p-5">
          <LivePreview
            qrToken={qrToken} theme={theme} previewMode={previewMode}
            editMode={editMode} showDummyData={showDummyData}
            onElementClick={setActiveEditor}
          />
        </div>

        {/* Contextual editor panel — pinned right, width animates open/closed.
            Responsive width keeps both panel and preview usable on tablets. */}
        <aside
          className={`shrink-0 bg-white overflow-hidden transition-[width] duration-300 ease-out ${
            sidebarOpen ? 'w-[88vw] sm:w-[46vw] md:w-[380px] border-l border-gray-200' : 'w-0'
          }`}>
          {sidebarOpen && (
            <div className="h-full w-[88vw] sm:w-[46vw] md:w-[380px]">
              <EditorSidebar target={activeEditor!} theme={theme} setters={setters} onClose={() => setActiveEditor(null)} />
            </div>
          )}
        </aside>
      </div>

    </div>
  )
}
