// ─────────────────────────────────────────────────────────────────────────────
// Stile della pagina d'apertura del nuovo menu (Lito): la pagina che si apre
// dal QR, dove si sceglie il menu. Salvato in restaurants.landing_style (JSONB).
//
// Foto, video e logo stanno qui dentro e NON in restaurant_banners / logo_url:
// quelli li usa ancora il menu in produzione, che non deve cambiare finché il
// nuovo menu non lo sostituisce. NULL = si parte da quello che il ristoratore
// ha già (banner, sfondo e logo del vecchio tema): vedi `initialLanding`.
// ─────────────────────────────────────────────────────────────────────────────

// Vetro liquido: definito con lo stile del menu (vale anche per i suoi comandi).
export { GLASS_PRESETS, type GlassLook } from './menuStyle'
import {
  CUSTOM_PREFIX, GLASS_PRESETS, PAPER_TEXTURES, bool, colorRef, fontsUrlFor, parseGlass, facesFor, hex, num, obj, parseCustomFonts, pick, text,
  ORNAMENTS, type ColorRef, type CustomFont, type GlassLook, type Ornament, type PaperTextureKind, type TextStyle, type Weight,
} from './menuStyle'

export interface LandingMedia {
  id:        string
  url:       string
  video:     boolean
  poster:    string | null   // immagine d'attesa (primo fotogramma utile)
  title:     string | null
  subtitle:  string | null
  /** Video: secondo del primo fotogramma utile (saltato l'inizio nero). */
  startAt:   number
  /** Video: versione "andata e ritorno" già pronta (riproduzione boomerang). */
  boomerang: string | null
}

export interface LandingStyle {
  version: 1
  background: {
    kind:            'paper' | 'gradient' | 'media'
    paper:           string            // colore della carta / primo colore del gradiente
    color2:          string            // secondo colore del gradiente
    texture:         PaperTextureKind
    textureStrength: number            // 0 – 1
    media:           LandingMedia[]    // foto e video (si alternano)
    overlay:         number            // velo scuro sopra foto/video: 0 – 0.9
    blur:            number            // sfocatura di foto/video: 0 – 20 px
    kenBurns:        boolean           // lento zoom sulle foto
    interval:        number            // secondi tra una foto e l'altra: 4 – 15
    /** Riproduzione dei video: in loop; boomerang (avanti e indietro); oppure
     *  "intro": immagine ferma, il video parte quando si sceglie il menu e il
     *  menu si apre alla fine del video. */
    videoMode:       'loop' | 'boomerang' | 'intro'
    /** Intro: immagine ferma scelta dal ristoratore (altrimenti il primo
     *  fotogramma utile del video). */
    introImage:      string | null
  }
  colors:  { ink: string; soft: string; accent: string }
  layout:  { header: 'top' | 'center'; buttons: 'bottom' | 'center'; align: 'center' | 'left' }
  /** Logo e nome si accendono e spengono ciascuno per conto suo (entrambi
   *  spenti = in testa non c'è nulla). Logo acceso senza file = niente logo. */
  logo:    { url: string | null; showLogo: boolean; showName: boolean; size: number }   // altezza 40 – 180
  name:        TextStyle
  description: { show: boolean; text: TextStyle }
  ornament:    Ornament
  chooseLabel: { show: boolean; text: TextStyle }
  buttons: {
    style:  'glass' | 'solid' | 'outline' | 'minimal'
    tint:   'light' | 'dark'           // vetro chiaro o fumé (vetro dei browser senza WebGL)
    /** Vetro "liquido" (rifrazione vera): vale per pulsanti, lingua e social. */
    glass:  GlassLook
    fill:   string                     // colore pieno (stile 'solid')
    radius: number                     // 0 – 48
    height: number                     // 44 – 110
    width:  number                     // larghezza massima 240 – 560
    gap:    number                     // 0 – 28
    paddingX: number                   // spazio ai lati del testo: 8 – 48
    border: { width: number; color: ColorRef }   // bordo: 0 – 4 px
    shadow: number                     // ombra dei pulsanti pieni/bordati: 0 – 1
    content: 'stack' | 'split'         // orario sotto il nome, oppure nome a sinistra e orario a destra
    arrow:  'none' | 'chevron' | 'arrow'
    press:  'liquid' | 'scale' | 'none'
    name:   TextStyle
    hours:  { show: boolean; text: TextStyle }
  }
  captions: { show: boolean; title: TextStyle; subtitle: TextStyle }
  socials:  { show: boolean; style: 'glass' | 'plain' }
  legal:    { text: TextStyle }
  motion:   { entrance: 'rise' | 'fade' | 'none' }
  customFonts: CustomFont[]
}

const T = (font: string, size: number, weight: Weight, color: ColorRef, o: Partial<TextStyle> = {}): TextStyle =>
  ({ font, size, weight, italic: false, color, upper: false, tracking: 0, ...o })
const SERIF = 'Cormorant Garamond', SANS = 'Inter'

// Colori del testo sulla carta e sopra foto/video.
export const ON_PAPER = { ink: '#1d1915', soft: '#6f665b', accent: '#9a8462' }
export const ON_MEDIA = { ink: '#ffffff', soft: '#ebe5da', accent: '#ffffff' }

export const DEFAULT_LANDING: LandingStyle = {
  version: 1,
  background: {
    kind: 'paper', paper: '#fbf8f2', color2: '#efe6d6', texture: 'grain', textureStrength: 0.35,
    media: [], overlay: 0.5, blur: 0, kenBurns: true, interval: 7, videoMode: 'loop', introImage: null,
  },
  colors: { ...ON_PAPER },
  layout: { header: 'top', buttons: 'bottom', align: 'center' },
  logo: { url: null, showLogo: true, showName: false, size: 84 },
  name: T(SERIF, 46, 500, 'ink', { tracking: 0.01 }),
  description: { show: true, text: T(SANS, 10.5, 600, 'accent', { upper: true, tracking: 0.3 }) },
  ornament: 'diamond',
  chooseLabel: { show: true, text: T(SANS, 10.5, 600, 'soft', { upper: true, tracking: 0.24 }) },
  buttons: {
    style: 'glass', tint: 'light', glass: GLASS_PRESETS[1].look, fill: '#1d1915', radius: 22, height: 62, width: 380, gap: 10,
    paddingX: 20, border: { width: 0, color: 'ink' }, shadow: 0.4, content: 'stack', arrow: 'none', press: 'liquid',
    name: T(SERIF, 23, 500, 'ink'),
    hours: { show: true, text: T(SANS, 10.5, 600, 'accent', { tracking: 0.16 }) },
  },
  captions: { show: true, title: T(SERIF, 28, 500, 'ink', { italic: true }), subtitle: T(SANS, 12, 500, 'soft', { tracking: 0.08 }) },
  socials: { show: true, style: 'glass' },
  legal: { text: T(SANS, 10.5, 400, 'soft') },
  motion: { entrance: 'rise' },
  customFonts: [],
}

const isUrl = (u: unknown): u is string => typeof u === 'string' && /^https:\/\//.test(u)
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export function parseLanding(raw: unknown): LandingStyle {
  const r = obj(raw), d = DEFAULT_LANDING
  const bg = obj(r.background), co = obj(r.colors), ly = obj(r.layout), lg = obj(r.logo), de = obj(r.description)
  const cl = obj(r.chooseLabel), bt = obj(r.buttons), hr = obj(bt.hours), ca = obj(r.captions), so = obj(r.socials)
  const le = obj(r.legal), mo = obj(r.motion)
  const customFonts = parseCustomFonts(r.customFonts)
  const custom = new Set(customFonts.map(f => CUSTOM_PREFIX + f.id))
  const tx = (v: unknown, dd: TextStyle) => text(v, dd, custom)
  const media: LandingMedia[] = (Array.isArray(bg.media) ? bg.media : []).map(obj)
    .filter(m => typeof m.id === 'string' && isUrl(m.url))
    .slice(0, 12)
    .map(m => ({
      id: (m.id as string).slice(0, 60), url: m.url as string, video: bool(m.video, false),
      poster: isUrl(m.poster) ? m.poster : null, title: str(m.title, 80), subtitle: str(m.subtitle, 140),
      startAt: num(m.startAt, 0, 30, 0), boomerang: isUrl(m.boomerang) ? m.boomerang : null,
    }))
  return {
    version: 1,
    background: {
      kind: pick(bg.kind, ['paper', 'gradient', 'media'] as const, d.background.kind),
      paper: hex(bg.paper, d.background.paper), color2: hex(bg.color2, d.background.color2),
      texture: pick(bg.texture, PAPER_TEXTURES, d.background.texture),
      textureStrength: num(bg.textureStrength, 0, 1, d.background.textureStrength),
      media,
      overlay: num(bg.overlay, 0, 0.9, d.background.overlay),
      blur: num(bg.blur, 0, 20, d.background.blur),
      kenBurns: bool(bg.kenBurns, d.background.kenBurns),
      interval: num(bg.interval, 4, 15, d.background.interval),
      videoMode: pick(bg.videoMode, ['loop', 'boomerang', 'intro'] as const, d.background.videoMode),
      introImage: isUrl(bg.introImage) ? bg.introImage : null,
    },
    colors: { ink: hex(co.ink, d.colors.ink), soft: hex(co.soft, d.colors.soft), accent: hex(co.accent, d.colors.accent) },
    layout: {
      header: pick(ly.header, ['top', 'center'] as const, d.layout.header),
      buttons: pick(ly.buttons, ['bottom', 'center'] as const, d.layout.buttons),
      align: pick(ly.align, ['center', 'left'] as const, d.layout.align),
    },
    logo: logoOf(lg, d.logo),
    name: tx(r.name, d.name),
    description: { show: bool(de.show, d.description.show), text: tx(de.text, d.description.text) },
    ornament: pick(r.ornament, ORNAMENTS, d.ornament),
    chooseLabel: { show: bool(cl.show, d.chooseLabel.show), text: tx(cl.text, d.chooseLabel.text) },
    buttons: {
      style: pick(bt.style, ['glass', 'solid', 'outline', 'minimal'] as const, d.buttons.style),
      tint: pick(bt.tint, ['light', 'dark'] as const, d.buttons.tint),
      fill: hex(bt.fill, d.buttons.fill),
      glass: parseGlass(bt.glass, bt.tint === 'dark' ? GLASS_PRESETS[2].look : d.buttons.glass),
      radius: num(bt.radius, 0, 48, d.buttons.radius),
      height: num(bt.height, 44, 110, d.buttons.height),
      width: num(bt.width, 240, 560, d.buttons.width),
      gap: num(bt.gap, 0, 28, d.buttons.gap),
      paddingX: num(bt.paddingX, 8, 48, d.buttons.paddingX),
      border: { width: num(obj(bt.border).width, 0, 4, d.buttons.border.width), color: colorRef(obj(bt.border).color, d.buttons.border.color) },
      shadow: num(bt.shadow, 0, 1, d.buttons.shadow),
      content: pick(bt.content, ['stack', 'split'] as const, d.buttons.content),
      arrow: pick(bt.arrow, ['none', 'chevron', 'arrow'] as const, d.buttons.arrow),
      press: pick(bt.press, ['liquid', 'scale', 'none'] as const, d.buttons.press),
      name: tx(bt.name, d.buttons.name),
      hours: { show: bool(hr.show, d.buttons.hours.show), text: tx(hr.text, d.buttons.hours.text) },
    },
    captions: { show: bool(ca.show, d.captions.show), title: tx(ca.title, d.captions.title), subtitle: tx(ca.subtitle, d.captions.subtitle) },
    socials: { show: bool(so.show, d.socials.show), style: pick(so.style, ['glass', 'plain'] as const, d.socials.style) },
    legal: { text: tx(le.text, d.legal.text) },
    motion: { entrance: pick(mo.entrance, ['rise', 'fade', 'none'] as const, d.motion.entrance) },
    customFonts,
  }
}

/** Punto di partenza per chi non ha ancora uno stile: foto/video e logo che
 *  il ristoratore ha già (banner del menu attuale, sfondo e logo del vecchio
 *  tema). Con foto o video, testo chiaro e vetro fumé come oggi. */
export function initialLanding(media: LandingMedia[], logo: string | null): LandingStyle {
  const st = structuredClone(DEFAULT_LANDING)
  st.logo.url = logo
  if (media.length) {
    st.background.kind = 'media'
    st.background.media = media
    st.colors = { ...ON_MEDIA }
    st.buttons.tint = 'dark'
    st.buttons.glass = { ...GLASS_PRESETS[2].look }
    st.description.text.color = 'soft'
    st.buttons.hours.text.color = 'soft'
  }
  return st
}

/** Testi della pagina (per caricare solo i caratteri usati). */
export function landingTexts(st: LandingStyle): TextStyle[] {
  return [st.name, st.description.text, st.chooseLabel.text, st.buttons.name, st.buttons.hours.text,
    st.captions.title, st.captions.subtitle, st.legal.text]
}
export const landingFontsUrl = (st: LandingStyle) => fontsUrlFor(landingTexts(st))
export const landingFaces = (st: LandingStyle) => facesFor(landingTexts(st))

/** Colore effettivo di un riferimento. */
export const landingColor = (ref: ColorRef, st: LandingStyle) =>
  ref === 'ink' ? st.colors.ink : ref === 'soft' ? st.colors.soft : ref === 'accent' ? st.colors.accent : ref

/** Video dell'intro: il primo video tra foto e video (se c'è). */
export const introVideo = (st: LandingStyle) =>
  st.background.kind === 'media' && st.background.videoMode === 'intro' ? st.background.media.find(m => m.video) ?? null : null

/** Logo e nome visibili. Vecchio formato (`mode`: solo logo / solo nome /
 *  entrambi, e senza file il nome compariva comunque): stessa resa di prima. */
function logoOf(lg: Record<string, unknown>, d: LandingStyle['logo']): LandingStyle['logo'] {
  const url = isUrl(lg.url) ? lg.url : null
  const size = num(lg.size, 40, 180, d.size)
  if (typeof lg.showLogo === 'boolean' || typeof lg.showName === 'boolean') {
    return { url, size, showLogo: lg.showLogo === true, showName: lg.showName === true }
  }
  const mode = lg.mode === 'name' || lg.mode === 'both' ? lg.mode : 'logo'
  return { url, size, showLogo: mode !== 'name' && !!url, showName: mode !== 'logo' || !url }
}
