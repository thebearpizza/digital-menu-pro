'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Personalizzazione della pagina d'apertura del nuovo menu.
//
// Stesso modo di lavorare dello stile del menu: anteprima vera in una cornice
// da telefono (riceve lo stile a ogni modifica), pannelli per elemento, tocco
// su un elemento dell'anteprima = si apre il suo pannello. Foto, video e logo
// si caricano qui e restano nello stile della pagina d'apertura: il menu in
// produzione (banner e logo attuali) non cambia.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { CUSTOM_PREFIX, PAPER_STYLES, PAPER_TEXTURES, TEXTURE_LABEL, registerCustomFonts, type CustomFont, type TextStyle } from '@/lib/menuStyle'
import { DEFAULT_LANDING, ON_MEDIA, ON_PAPER, type LandingMedia, type LandingStyle } from '@/lib/landingStyle'
import type { LandingPick } from '@/app/prova/[token]/Landing'
import { loadCustomFonts } from '@/app/prova/[token]/fonts'
import { compressImageFile, MAX_VIDEO_BYTES } from '@/lib/imageCompress'
import {
  Choice, ColorField, FieldShell, FontsManager, OrnamentField, PaperSwatch, PhoneFrame, Slider, TextStyleField, Toggle,
  lum, pct, px, uploadAsset,
} from './controls'
import { saveLandingStyle } from './actions'
import StyleNav from './StyleNav'
import { canMakeBoomerang, makeBoomerang, usefulFrame } from '@/lib/videoTools'

type PanelId =
  | 'presets' | 'background' | 'colors' | 'layout' | 'logo' | 'description' | 'buttons' | 'captions'
  | 'socials' | 'legal' | 'fonts' | 'motion'

const PANELS: { id: PanelId; title: string; sub: string }[] = [
  { id: 'presets',     title: 'Stili pronti',            sub: 'Un punto di partenza completo' },
  { id: 'background',  title: 'Sfondo',                  sub: 'Carta, gradiente, foto e video' },
  { id: 'colors',      title: 'Colori del testo',        sub: 'Testo, testo secondario, accento' },
  { id: 'layout',      title: 'Disposizione',            sub: 'Dove stanno nome e pulsanti' },
  { id: 'logo',        title: 'Logo e nome',             sub: 'Logo, nome del ristorante, ornamento' },
  { id: 'description', title: 'Descrizione',             sub: 'La riga sotto il nome' },
  { id: 'buttons',     title: 'Pulsanti dei menu',       sub: 'Stile, misure, testi, orari' },
  { id: 'captions',    title: 'Titoli di foto e video',  sub: 'Titolo e sottotitolo sopra le immagini' },
  { id: 'socials',     title: 'Social',                  sub: 'Instagram, Facebook, sito…' },
  { id: 'legal',       title: 'Dati legali',             sub: 'Ragione sociale, P.IVA, privacy' },
  { id: 'fonts',       title: 'I tuoi caratteri',        sub: 'Carica i file dei tuoi caratteri' },
  { id: 'motion',      title: 'Entrata',                 sub: 'Come compaiono gli elementi' },
]

const PICK_PANEL: Record<LandingPick, PanelId> = {
  'l-background': 'background', 'l-logo': 'logo', 'l-description': 'description', 'l-choose': 'buttons',
  'l-buttons': 'buttons', 'l-captions': 'captions', 'l-socials': 'socials', 'l-legal': 'legal',
}

// ── Stili pronti (si tengono foto, video, logo e caratteri caricati) ────────

const ts = (t: TextStyle, o: Partial<TextStyle>): TextStyle => ({ ...t, ...o })
type Preset = { name: string; desc: string; apply: (s: LandingStyle) => void }
const PRESETS: Preset[] = [
  {
    name: 'Classico', desc: 'Carta, Garamond, vetro chiaro',
    apply: s => {
      const keep = { media: s.background.media, logo: s.logo.url, fonts: s.customFonts }
      Object.assign(s, structuredClone(DEFAULT_LANDING))
      s.background.media = keep.media; s.logo.url = keep.logo; s.customFonts = keep.fonts
    },
  },
  {
    name: 'Foto piena', desc: 'Foto/video, testo bianco, vetro fumé',
    apply: s => {
      s.background.kind = 'media'; s.background.overlay = 0.5
      s.colors = { ...ON_MEDIA }; s.buttons.style = 'glass'; s.buttons.tint = 'dark'
      s.description.text.color = 'soft'; s.buttons.hours.text.color = 'soft'
    },
  },
  {
    name: 'Elegante', desc: 'Centrato, Bodoni, pulsanti bordati',
    apply: s => {
      s.layout = { header: 'center', buttons: 'center', align: 'center' }
      s.name = ts(s.name, { font: 'Bodoni Moda', weight: 400, italic: true, size: 44 })
      s.description.text = ts(s.description.text, { font: 'Cinzel', weight: 500, size: 10.5, upper: true, tracking: 0.32 })
      s.buttons = { ...s.buttons, style: 'outline', radius: 2, height: 58, name: ts(s.buttons.name, { font: 'Bodoni Moda', weight: 400, size: 21 }) }
      s.ornament = 'double'
    },
  },
  {
    name: 'Moderno', desc: 'A sinistra, Manrope, pulsanti pieni',
    apply: s => {
      s.layout = { header: 'top', buttons: 'bottom', align: 'left' }
      s.name = ts(s.name, { font: 'Manrope', weight: 700, size: 40, italic: false, tracking: -0.01 })
      s.description.text = ts(s.description.text, { font: 'Manrope', weight: 600, size: 11, tracking: 0.18 })
      s.chooseLabel.text = ts(s.chooseLabel.text, { font: 'Manrope', weight: 600 })
      s.buttons = {
        ...s.buttons, style: 'solid', radius: 14, height: 64, fill: s.background.kind === 'media' ? '#ffffff' : '#1d1915',
        name: ts(s.buttons.name, { font: 'Manrope', weight: 600, size: 19 }),
        hours: { ...s.buttons.hours, text: ts(s.buttons.hours.text, { font: 'Manrope', weight: 500 }) },
      }
      s.ornament = 'none'
    },
  },
  {
    name: 'Minimal', desc: 'Solo testo, linee sottili',
    apply: s => {
      s.buttons = { ...s.buttons, style: 'minimal', height: 58, name: ts(s.buttons.name, { font: 'Inter', weight: 500, size: 18 }) }
      s.name = ts(s.name, { font: 'Inter', weight: 600, size: 34, italic: false })
      s.description.text = ts(s.description.text, { font: 'Inter', weight: 500 })
      s.ornament = 'line'; s.socials.style = 'plain'
    },
  },
]

interface Props {
  restaurantId: string
  token:        string
  initialStyle: LandingStyle
  /** Caratteri già caricati negli stili dei menu. */
  menuFonts:    CustomFont[]
  /** Lo stile è già salvato (altrimenti è il punto di partenza ricavato). */
  saved:        boolean
}

export default function LandingEditor({ restaurantId, token, initialStyle, menuFonts, saved: savedOnce }: Props) {
  const [style, setStyle] = useState<LandingStyle>(initialStyle)
  const [saved, setSaved] = useState<LandingStyle | null>(savedOnce ? initialStyle : null)
  const [open, setOpen] = useState<PanelId | null>('presets')
  const [flash, setFlash] = useState<PanelId | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, startSaving] = useTransition()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const panelRefs = useRef(new Map<PanelId, HTMLElement>())
  // Mai salvato: anche senza modifiche si può salvare (fissa il punto di partenza).
  const dirty = useMemo(() => !saved || JSON.stringify(style) !== JSON.stringify(saved), [style, saved])

  registerCustomFonts([...menuFonts, ...style.customFonts])
  const customKey = JSON.stringify(style.customFonts)
  const [, setTick] = useState(0)
  useEffect(() => { loadCustomFonts([...menuFonts, ...style.customFonts]).then(() => setTick(t => t + 1)) }, [customKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const post = useCallback((msg: unknown) => frameRef.current?.contentWindow?.postMessage(msg, window.location.origin), [])
  useEffect(() => { post({ type: 'lito-landing', style }) }, [style, post])
  const live = useRef(style)
  live.current = style
  useEffect(() => {
    let clear = 0
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const msg = e.data as { type?: string; target?: LandingPick }
      if (msg?.type === 'lito-preview-ready') post({ type: 'lito-landing', style: live.current })
      if (msg?.type === 'lito-pick' && msg.target) {
        const id = PICK_PANEL[msg.target] ?? 'background'
        setOpen(id); setFlash(id)
        window.setTimeout(() => panelRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
        clearTimeout(clear); clear = window.setTimeout(() => setFlash(null), 1600)
      }
    }
    window.addEventListener('message', onMsg)
    return () => { window.removeEventListener('message', onMsg); clearTimeout(clear) }
  }, [post])

  useEffect(() => {
    if (!dirty || !saved) return
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty, saved])

  const edit = useCallback((fn: (s: LandingStyle) => void) => setStyle(prev => { const n = structuredClone(prev); fn(n); return n }), [])

  // Lavori sui video, in automatico: immagine d'attesa e punto di partenza
  // (primo fotogramma utile) per i video che non li hanno ancora (es. quelli
  // del menu attuale) e versione boomerang quando serve. Ogni lavoro si
  // tenta una volta sola per video.
  const [jobs, setJobs] = useState<Record<string, string>>({})
  const tried = useRef(new Set<string>())
  const patchMedia = useCallback((id: string, patch: Partial<LandingMedia>) =>
    edit(s => { const m = s.background.media.find(x => x.id === id); if (m) Object.assign(m, patch) }), [edit])
  const bgKind = style.background.kind, videoMode = style.background.videoMode, mediaKey = JSON.stringify(style.background.media.map(m => [m.id, !!m.poster, m.startAt, !!m.boomerang]))
  useEffect(() => {
    if (bgKind !== 'media') return
    const say = (id: string, text: string | null) => setJobs(j => { const n = { ...j }; if (text) n[id] = text; else delete n[id]; return n })
    for (const m of live.current.background.media) {
      if (!m.video) continue
      const posterKey = `${m.id}:poster`, boomKey = `${m.id}:boom`
      // Anche i video che hanno già un'immagine d'attesa ma nessun punto di
      // partenza calcolato (es. quelli del vecchio tema): servono all'intro.
      const needPoster = (!m.poster || m.startAt === 0) && !tried.current.has(posterKey)
      const needBoom = videoMode === 'boomerang' && !m.boomerang && !tried.current.has(boomKey)
      if (!needPoster && !needBoom) continue
      if (needPoster) tried.current.add(posterKey)
      if (needBoom) tried.current.add(boomKey)
      ;(async () => {
        try {
          if (needPoster) {
            say(m.id, 'Cerco il primo fotogramma utile…')
            const f = await usefulFrame(m.url)
            const poster = f.image ? await uploadAsset(restaurantId, 'landing', new File([f.image], 'poster.jpg', { type: 'image/jpeg' }), 'jpg') : null
            patchMedia(m.id, { poster, startAt: f.time })
          }
          if (needBoom) {
            if (!canMakeBoomerang()) { say(m.id, 'Questo browser non sa preparare il boomerang: apri la pagina da Chrome o da Safari aggiornati. Intanto il video va in loop.'); return }
            say(m.id, 'Preparo il boomerang… 0%')
            const blob = await makeBoomerang(m.url, p => say(m.id, `Preparo il boomerang… ${Math.round(p * 100)}%`))
            if (!blob) { say(m.id, 'Boomerang non riuscito con questo video: va in loop.'); return }
            say(m.id, 'Carico il boomerang…')
            const url = await uploadAsset(restaurantId, 'landing', new File([blob], 'boomerang.mp4', { type: 'video/mp4' }), 'mp4')
            patchMedia(m.id, { boomerang: url })
          }
          say(m.id, null)
        } catch {
          say(m.id, 'Preparazione del video non riuscita.')
        }
      })()
    }
  }, [bgKind, videoMode, mediaKey, restaurantId, patchMedia])

  /** I caratteri dei menu usati qui vengono copiati nello stile della pagina. */
  const withUsedFonts = (st: LandingStyle): LandingStyle => {
    const json = JSON.stringify(st)
    const have = new Set(st.customFonts.map(f => f.id))
    const extra = menuFonts.filter(f => !have.has(f.id) && json.includes(`"${CUSTOM_PREFIX}${f.id}"`))
    return extra.length ? { ...st, customFonts: [...st.customFonts, ...extra] } : st
  }
  const save = () => startSaving(async () => {
    const st = withUsedFonts(style)
    const res = await saveLandingStyle(restaurantId, st)
    if (res.ok) { setStyle(st); setSaved(st); setMessage({ ok: true, text: 'Pagina d\'apertura salvata.' }) }
    else setMessage({ ok: false, text: res.error })
    window.setTimeout(() => setMessage(null), 3000)
  })

  /** Sfondo: passando a foto/video il testo diventa chiaro, tornando alla
   *  carta torna scuro (se non era già stato scelto diversamente). */
  const setKind = (k: LandingStyle['background']['kind']) => edit(s => {
    s.background.kind = k
    const media = k === 'media'
    if (media && lum(s.colors.ink) < 0.5) { s.colors = { ...ON_MEDIA }; s.buttons.tint = 'dark' }
    if (!media && lum(s.colors.ink) > 0.6 && lum(s.background.paper) > 0.5) { s.colors = { ...ON_PAPER }; s.buttons.tint = 'light' }
  })

  const st = style
  const swatches = st.colors
  const paperForSamples = st.background.kind === 'media' ? '#3a332c' : st.background.paper
  const allFonts = [...st.customFonts, ...menuFonts.filter(f => !st.customFonts.some(x => x.id === f.id))]
  const T = (label: string, get: (s: LandingStyle) => TextStyle, range: [number, number], hint?: string, noCase?: boolean) => (
    <TextStyleField label={label} hint={hint} value={get(st)} range={range} swatches={swatches} paper={paperForSamples}
      custom={allFonts} noCase={noCase} onChange={v => edit(s => { Object.assign(get(s), v) })} />
  )

  const body = (id: PanelId) => {
    switch (id) {
      case 'presets': return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESETS.map(p => (
            <button key={p.name} type="button" onClick={() => edit(p.apply)}
              className="text-left border border-gray-200 hover:border-gray-400 p-3 transition" style={{ borderRadius: 16 }}>
              <div className="text-xs font-medium text-gray-800">{p.name}</div>
              <div className="text-[11px] text-gray-400 leading-tight">{p.desc}</div>
            </button>
          ))}
          <p className="col-span-full text-[11px] text-gray-400">Foto, video, logo e caratteri caricati restano. Finché non salvi, &quot;Annulla&quot; torna indietro.</p>
        </div>
      )
      case 'background': return (<>
        <Choice label="Sfondo" value={st.background.kind} onChange={setKind}
          options={[{ value: 'paper', label: 'Carta' }, { value: 'gradient', label: 'Gradiente' }, { value: 'media', label: 'Foto e video' }]} />
        {st.background.kind === 'media' ? (<>
          <MediaManager restaurantId={restaurantId} media={st.background.media} jobs={jobs} onSet={m => edit(s => { s.background.media = m })} />
          {st.background.media.some(m => m.video) && (<>
            <Choice label="Riproduzione del video" value={st.background.videoMode} onChange={v => edit(s => { s.background.videoMode = v })}
              options={[{ value: 'loop', label: 'In loop' }, { value: 'boomerang', label: 'Boomerang' }, { value: 'intro', label: 'All\'apertura del menu' }]}
              hint={st.background.videoMode === 'loop' ? 'Il video ricomincia da capo, all\'infinito.'
                : st.background.videoMode === 'boomerang' ? 'Arrivato alla fine il video torna indietro, poi riparte: movimento continuo, senza salti. La versione andata e ritorno si prepara qui una volta (fino a 10 secondi di video).'
                : 'Si vede un\'immagine ferma; quando il cliente sceglie il menu parte il video (il primo tra foto e video) e il menu si apre alla fine. Intanto il menu si prepara.'} />
            {st.background.videoMode === 'intro' && (<>
              <IntroImageField restaurantId={restaurantId} value={st.background.introImage}
                fallback={st.background.media.find(m => m.video)?.poster ?? null}
                onChange={url => edit(s => { s.background.introImage = url })} />
              <button type="button" onClick={() => post({ type: 'lito-intro-test' })}
                className="border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-500">
                ▶ Prova l&apos;intro nell&apos;anteprima
              </button>
            </>)}
          </>)}
          <Slider label="Velo scuro (leggibilità)" value={st.background.overlay} min={0} max={0.9} step={0.05} format={pct} onChange={v => edit(s => { s.background.overlay = v })} />
          <Slider label="Sfocatura" value={st.background.blur} min={0} max={20} step={1} format={px} onChange={v => edit(s => { s.background.blur = v })} />
          <Toggle label="Lento zoom sulle foto" value={st.background.kenBurns} onChange={v => edit(s => { s.background.kenBurns = v })} />
          {st.background.media.length > 1 && (
            <Slider label="Tempo per ogni foto" value={st.background.interval} min={4} max={15} step={1} format={v => `${v} s`} onChange={v => edit(s => { s.background.interval = v })} />
          )}
        </>) : (<>
          <FieldShell label="Carte pronte">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PAPER_STYLES.map(p => {
                const on = p.paper === st.background.paper && p.texture === st.background.texture
                return (
                  <button key={p.name} type="button" aria-pressed={on}
                    onClick={() => edit(s => {
                      Object.assign(s.background, { paper: p.paper, texture: p.texture, textureStrength: p.textureStrength })
                      // Carta scura: testo chiaro (e viceversa).
                      const dark = lum(p.paper) < 0.45
                      if (dark && lum(s.colors.ink) < 0.5) s.colors = { ink: p.ink ?? '#efe8dc', soft: p.soft ?? '#b3a999', accent: p.accent ?? '#c4a46b' }
                      else if (!dark && lum(s.colors.ink) > 0.6) s.colors = { ...ON_PAPER }
                      else if (p.ink) s.colors = { ink: p.ink, soft: p.soft ?? s.colors.soft, accent: p.accent ?? s.colors.accent }
                      s.buttons.tint = dark ? 'dark' : 'light'
                    })}
                    className={`text-left border p-1.5 transition ${on ? 'border-blue-600 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-400'}`}
                    style={{ borderRadius: 14 }}>
                    <PaperSwatch paper={p.paper} texture={p.texture} strength={p.textureStrength} light={p.light} ink={p.ink ?? '#1d1915'} />
                    <div className="text-[11px] font-medium text-gray-800 mt-1.5 px-0.5">{p.name}</div>
                  </button>
                )
              })}
            </div>
          </FieldShell>
          <div className="grid grid-cols-2 gap-3">
            <ColorField label={st.background.kind === 'gradient' ? 'Colore in alto' : 'Colore della carta'} value={st.background.paper} onChange={v => edit(s => { s.background.paper = v })} />
            {st.background.kind === 'gradient' && <ColorField label="Colore in basso" value={st.background.color2} onChange={v => edit(s => { s.background.color2 = v })} />}
          </div>
          <Choice label="Superficie" value={st.background.texture} onChange={v => edit(s => { s.background.texture = v })}
            options={PAPER_TEXTURES.map(t => ({ value: t, label: TEXTURE_LABEL[t] }))} />
          {st.background.texture !== 'none' && (
            <Slider label="Intensità della superficie" value={st.background.textureStrength} min={0} max={1} step={0.05} format={pct} onChange={v => edit(s => { s.background.textureStrength = v })} />
          )}
        </>)}
      </>)
      case 'colors': return (<>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => edit(s => { s.colors = { ...ON_PAPER } })} className="border border-gray-200 hover:border-gray-400 px-3 py-1.5 text-xs">Testo scuro</button>
          <button type="button" onClick={() => edit(s => { s.colors = { ...ON_MEDIA } })} className="border border-gray-200 hover:border-gray-400 px-3 py-1.5 text-xs">Testo chiaro</button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <ColorField label="Testo" value={st.colors.ink} onChange={v => edit(s => { s.colors.ink = v })} />
          <ColorField label="Secondario" value={st.colors.soft} onChange={v => edit(s => { s.colors.soft = v })} />
          <ColorField label="Accento" value={st.colors.accent} onChange={v => edit(s => { s.colors.accent = v })} />
        </div>
      </>)
      case 'layout': return (<>
        <Choice label="Nome e logo" value={st.layout.header} onChange={v => edit(s => { s.layout.header = v })}
          options={[{ value: 'top', label: 'In alto' }, { value: 'center', label: 'Al centro' }]} />
        <Choice label="Pulsanti dei menu" value={st.layout.buttons} onChange={v => edit(s => { s.layout.buttons = v })}
          options={[{ value: 'bottom', label: 'In basso (sotto il pollice)' }, { value: 'center', label: 'Subito sotto il nome' }]} />
        <Choice label="Allineamento" value={st.layout.align} onChange={v => edit(s => { s.layout.align = v })}
          options={[{ value: 'center', label: 'Centrato' }, { value: 'left', label: 'A sinistra' }]} />
      </>)
      case 'logo': return (<>
        <LogoField restaurantId={restaurantId} value={st.logo.url} onChange={url => edit(s => { s.logo.url = url })} />
        <Choice label="Mostra" value={st.logo.mode} onChange={v => edit(s => { s.logo.mode = v })}
          options={[{ value: 'logo', label: 'Solo logo' }, { value: 'name', label: 'Solo nome' }, { value: 'both', label: 'Logo e nome' }]}
          hint={!st.logo.url && st.logo.mode !== 'name' ? 'Senza logo si vede il nome.' : undefined} />
        {st.logo.url && st.logo.mode !== 'name' && (
          <Slider label="Grandezza del logo" value={st.logo.size} min={40} max={180} step={2} format={px} onChange={v => edit(s => { s.logo.size = v })} />
        )}
        {(st.logo.mode !== 'logo' || !st.logo.url) && T('Nome del ristorante', s => s.name, [20, 72])}
        <OrnamentField label="Ornamento" value={st.ornament} accent={st.colors.accent} paper={paperForSamples} onChange={v => edit(s => { s.ornament = v })} />
      </>)
      case 'description': return (<>
        <Toggle label="Mostra la descrizione" hint="Il testo si scrive in Informazioni del ristorante." value={st.description.show} onChange={v => edit(s => { s.description.show = v })} />
        {st.description.show && T('Testo della descrizione', s => s.description.text, [8, 28])}
      </>)
      case 'buttons': return (<>
        <Choice label="Stile" value={st.buttons.style} onChange={v => edit(s => { s.buttons.style = v })}
          options={[{ value: 'glass', label: 'Vetro' }, { value: 'solid', label: 'Pieno' }, { value: 'outline', label: 'Bordato' }, { value: 'minimal', label: 'Solo testo' }]} />
        {st.buttons.style === 'glass' && (
          <Choice label="Vetro" value={st.buttons.tint} onChange={v => edit(s => { s.buttons.tint = v })}
            options={[{ value: 'light', label: 'Chiaro' }, { value: 'dark', label: 'Fumé' }]} />
        )}
        {st.buttons.style === 'solid' && <ColorField label="Colore del pulsante" value={st.buttons.fill} onChange={v => edit(s => { s.buttons.fill = v })} />}
        {st.buttons.style !== 'minimal' && (
          <Slider label="Angoli" value={st.buttons.radius} min={0} max={40} step={1} format={px} onChange={v => edit(s => { s.buttons.radius = v })} />
        )}
        <Slider label="Altezza" value={st.buttons.height} min={44} max={96} step={1} format={px} onChange={v => edit(s => { s.buttons.height = v })} />
        <Slider label="Larghezza massima" value={st.buttons.width} min={240} max={560} step={10} format={px} onChange={v => edit(s => { s.buttons.width = v })} />
        {st.buttons.style !== 'minimal' && (
          <Slider label="Spazio tra i pulsanti" value={st.buttons.gap} min={0} max={28} step={1} format={px} onChange={v => edit(s => { s.buttons.gap = v })} />
        )}
        {T('Nome del menu', s => s.buttons.name, [13, 36], st.buttons.style === 'solid' ? 'Su colore pieno, con "Testo" o "Secondario" il colore si adatta da solo al pulsante.' : undefined)}
        <Toggle label="Orario del menu (se programmato)" value={st.buttons.hours.show} onChange={v => edit(s => { s.buttons.hours.show = v })} />
        {st.buttons.hours.show && T('Testo dell\'orario', s => s.buttons.hours.text, [8, 16], undefined, true)}
        <Toggle label={'Scritta "Scegli il menu" sopra i pulsanti'} value={st.chooseLabel.show} onChange={v => edit(s => { s.chooseLabel.show = v })} />
        {st.chooseLabel.show && T('Testo "Scegli il menu"', s => s.chooseLabel.text, [8, 20])}
      </>)
      case 'captions': return (<>
        <Toggle label="Titolo e sottotitolo sopra foto e video" hint="Si scrivono nel pannello Sfondo, per ogni foto o video." value={st.captions.show} onChange={v => edit(s => { s.captions.show = v })} />
        {st.captions.show && (<>
          {T('Titolo', s => s.captions.title, [16, 48])}
          {T('Sottotitolo', s => s.captions.subtitle, [9, 22])}
        </>)}
      </>)
      case 'socials': return (<>
        <Toggle label="Mostra i social" hint="Gli indirizzi si scrivono in Informazioni del ristorante." value={st.socials.show} onChange={v => edit(s => { s.socials.show = v })} />
        {st.socials.show && (
          <Choice label="Icone" value={st.socials.style} onChange={v => edit(s => { s.socials.style = v })}
            options={[{ value: 'glass', label: 'In bolle di vetro' }, { value: 'plain', label: 'Semplici' }]} />
        )}
      </>)
      case 'legal': return (<>
        <p className="text-[11px] text-gray-400 -mt-1">Ragione sociale, P.IVA, indirizzo e informativa privacy sono obbligatori e restano sempre visibili: qui si sceglie solo l&apos;aspetto.</p>
        {T('Testo dei dati legali', s => s.legal.text, [8, 14])}
      </>)
      case 'fonts': return (<>
        {menuFonts.filter(f => !st.customFonts.some(x => x.id === f.id)).length > 0 && (
          <p className="text-[11px] text-gray-400">I caratteri caricati per i menu ({menuFonts.map(f => f.name).join(', ')}) si possono già scegliere nei testi di questa pagina.</p>
        )}
        <FontsManager restaurantId={restaurantId} fonts={st.customFonts} onSet={list => edit(s => { s.customFonts = list })}
          used={id => JSON.stringify(st).includes(`"${CUSTOM_PREFIX}${id}"`)} />
      </>)
      case 'motion': return (
        <Choice label="Entrata degli elementi" value={st.motion.entrance} onChange={v => edit(s => { s.motion.entrance = v })}
          options={[{ value: 'rise', label: 'Salgono e compaiono' }, { value: 'fade', label: 'Compaiono' }, { value: 'none', label: 'Subito' }]}
          hint="Si rivede ricaricando l'anteprima." />
      )
    }
  }

  return (
    <div>
      <StyleNav restaurantId={restaurantId} active="landing" />
      <div className="sticky top-3 z-30 mb-4 mx-4 sm:mx-0 border border-gray-200 bg-white/90 backdrop-blur shadow-sm" style={{ borderRadius: 18 }}>
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2">
          <span className={`text-sm truncate ${message ? (message.ok ? 'text-green-700' : 'text-red-600') : dirty ? 'text-amber-700' : 'text-gray-500'}`}>
            {message?.text ?? (!saved ? 'Non ancora salvata' : dirty ? 'Modifiche non salvate' : 'Tutto salvato')}
          </span>
          <div className="flex-1" />
          <button type="button" onClick={() => saved && setStyle(saved)} disabled={!saved || !dirty} className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 disabled:opacity-40">
            Annulla
          </button>
          <button type="button" onClick={save} disabled={!dirty || saving}
            className="text-sm font-medium bg-blue-600 text-white px-4 py-2 disabled:opacity-40 hover:bg-blue-700">
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
        <div className="lg:order-2 lg:sticky lg:top-20 shrink-0 flex flex-col items-center gap-3">
          <PhoneFrame>
            <iframe ref={frameRef} title="Anteprima della pagina d'apertura" src={`/prova/${token}?preview=1`}
              className="block border-0" style={{ width: 390, height: 844 }} />
          </PhoneFrame>
          <p className="text-xs text-gray-400 text-center max-w-[300px]">Tocca un elemento nell&apos;anteprima per aprire il suo pannello.</p>
        </div>

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
    </div>
  )
}

// ── Logo ─────────────────────────────────────────────────────────────────────

function LogoField({ restaurantId, value, onChange }: { restaurantId: string; value: string | null; onChange: (url: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const upload = async (raw: File) => {
    setBusy(true); setErr(null)
    try {
      // PNG/SVG con trasparenza restano tali; le foto si comprimono.
      const file = raw.type === 'image/svg+xml' || raw.type === 'image/png' ? raw : await compressImageFile(raw)
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      onChange(await uploadAsset(restaurantId, 'landing', file, ext))
    } catch { setErr('Caricamento non riuscito, riprova.') }
    setBusy(false)
  }
  return (
    <FieldShell label="Logo" hint="Meglio un PNG con sfondo trasparente.">
      <div className="flex items-center gap-3">
        <div className="w-20 h-14 shrink-0 border border-gray-200 flex items-center justify-center overflow-hidden" style={{ borderRadius: 10, background: 'repeating-conic-gradient(#f3f4f6 0 25%, #fff 0 50%) 0 0 / 12px 12px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value && <img src={value} alt="" className="max-w-full max-h-full object-contain" />}
        </div>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
          className="border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-500 disabled:opacity-50">
          {busy ? 'Caricamento…' : value ? 'Cambia logo' : 'Carica logo'}
        </button>
        {value && <button type="button" onClick={() => onChange(null)} className="px-2 py-1.5 text-xs text-gray-500 hover:text-red-600">Togli</button>}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }} />
      </div>
      {err && <p className="text-[11px] text-red-600 mt-1">{err}</p>}
    </FieldShell>
  )
}

// ── Foto e video ─────────────────────────────────────────────────────────────

function MediaManager({ restaurantId, media, jobs, onSet }: {
  restaurantId: string; media: LandingMedia[]; jobs: Record<string, string>; onSet: (m: LandingMedia[]) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const latest = useRef(media)
  latest.current = media

  const upload = async (files: File[]) => {
    setErr(null)
    const added: LandingMedia[] = []
    for (let k = 0; k < files.length; k++) {
      const raw = files[k]
      setBusy(`Caricamento ${k + 1} di ${files.length}…`)
      try {
        const video = raw.type.startsWith('video/')
        if (video && raw.size > MAX_VIDEO_BYTES) { setErr(`${raw.name}: video troppo grande (massimo 20 MB).`); continue }
        const file = video ? raw : await compressImageFile(raw)
        const ext = (file.name.split('.').pop() || (video ? 'mp4' : 'jpg')).toLowerCase()
        const url = await uploadAsset(restaurantId, 'landing', file, ext)
        // Video: immagine d'attesa e punto di partenza dal primo fotogramma
        // utile (saltato l'inizio nero o in dissolvenza).
        let poster: string | null = null, startAt = 0
        if (video) {
          const f = await usefulFrame(raw)
          startAt = f.time
          if (f.image) poster = await uploadAsset(restaurantId, 'landing', new File([f.image], 'poster.jpg', { type: 'image/jpeg' }), 'jpg')
        }
        added.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, url, video, poster, title: null, subtitle: null, startAt, boomerang: null })
      } catch { setErr(`${raw.name}: caricamento non riuscito.`) }
    }
    if (added.length) onSet([...latest.current, ...added].slice(0, 12))
    setBusy(null)
  }
  const update = (i: number, patch: Partial<LandingMedia>) => onSet(media.map((m, k) => (k === i ? { ...m, ...patch } : m)))
  const moveBy = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= media.length) return
    const next = [...media]; [next[i], next[j]] = [next[j], next[i]]; onSet(next)
  }

  return (
    <FieldShell label="Foto e video" hint="Si alternano in dissolvenza. Video muti in loop (massimo 20 MB, meglio MP4 corti).">
      <div className="space-y-2">
        {media.map((m, i) => (
          <div key={m.id} className="flex gap-3 border border-gray-200 p-2" style={{ borderRadius: 12 }}>
            <div className="w-16 h-24 shrink-0 overflow-hidden bg-gray-100" style={{ borderRadius: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.video ? (m.poster ? <img src={m.poster} alt="" className="w-full h-full object-cover" /> : <video src={m.url} muted className="w-full h-full object-cover" />)
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={m.url} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] text-gray-500">
                <span className="flex-1">{m.video ? 'Video' : 'Foto'} {i + 1}</span>
                <button type="button" aria-label="Sposta su" disabled={i === 0} onClick={() => moveBy(i, -1)} className="px-1.5 disabled:opacity-30">↑</button>
                <button type="button" aria-label="Sposta giù" disabled={i === media.length - 1} onClick={() => moveBy(i, 1)} className="px-1.5 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => onSet(media.filter((_, k) => k !== i))} className="px-1.5 hover:text-red-600">Togli</button>
              </div>
              {jobs[m.id] && <p className="text-[11px] text-blue-700">{jobs[m.id]}</p>}
              <input value={m.title ?? ''} onChange={e => update(i, { title: e.target.value.slice(0, 80) || null })} placeholder="Titolo (facoltativo)"
                className="w-full text-sm border border-gray-200 px-2 py-1 outline-none focus:border-gray-400" />
              <input value={m.subtitle ?? ''} onChange={e => update(i, { subtitle: e.target.value.slice(0, 140) || null })} placeholder="Sottotitolo (facoltativo)"
                className="w-full text-sm border border-gray-200 px-2 py-1 outline-none focus:border-gray-400" />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy || media.length >= 12}
          className="border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-500 disabled:opacity-50">
          {busy ?? '+ Aggiungi foto o video'}
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
          onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) upload(fs) }} />
        {err && <p className="text-[11px] text-red-600">{err}</p>}
        {!media.length && <p className="text-[11px] text-gray-400">Senza foto o video si vede la carta.</p>}
      </div>
    </FieldShell>
  )
}

// ── Immagine ferma dell'intro ────────────────────────────────────────────────

function IntroImageField({ restaurantId, value, fallback, onChange }: {
  restaurantId: string; value: string | null; fallback: string | null; onChange: (url: string | null) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const upload = async (raw: File) => {
    setBusy(true); setErr(null)
    try {
      const file = await compressImageFile(raw)
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      onChange(await uploadAsset(restaurantId, 'landing', file, ext))
    } catch { setErr('Caricamento non riuscito, riprova.') }
    setBusy(false)
  }
  const shown = value ?? fallback
  return (
    <FieldShell label="Immagine ferma prima del video"
      hint={value ? undefined : 'Se non ne scegli una, si usa il primo fotogramma utile del video (saltato l\'inizio nero).'}>
      <div className="flex items-center gap-3">
        <div className="w-16 h-24 shrink-0 overflow-hidden bg-gray-100 border border-gray-200" style={{ borderRadius: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {shown && <img src={shown} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className="border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-500 disabled:opacity-50">
            {busy ? 'Caricamento…' : value ? 'Cambia immagine' : 'Scegli un\'immagine'}
          </button>
          {value && <button type="button" onClick={() => onChange(null)} className="px-2 py-1.5 text-xs text-gray-500 hover:text-red-600">Usa il primo fotogramma</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }} />
      </div>
      {err && <p className="text-[11px] text-red-600 mt-1">{err}</p>}
    </FieldShell>
  )
}
