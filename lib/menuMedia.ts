// ─────────────────────────────────────────────────────────────────────────────
// Pagine foto/video del nuovo menu (menus.media_pages).
//
// Due tipi, entrambi a pagina intera nel libro:
//  • categoria: foto o video prima di una categoria (titolo = nome della
//    categoria, se non se ne sceglie un altro);
//  • promo: foto o video (o la foto del piatto collegato) con titolo,
//    descrizione, etichetta e prezzo/prezzo promo. Si mette all'inizio del
//    menu, prima o dopo una categoria, o alla fine: legata ai contenuti, resta
//    nel punto giusto qualunque siano stile, testo e schermo. Se collegata a
//    un piatto, toccandola si apre la sua scheda.
//
// menus.media_pages NULL = il menu non è ancora stato configurato qui: si
// usano le vecchie pubblicità del tema (theme_config.ads), convertite.
// ─────────────────────────────────────────────────────────────────────────────

export type MediaKind = 'category' | 'promo'
export type MediaWhere = 'start' | 'before' | 'after' | 'end'

export interface MediaPage {
  id:          string
  kind:        MediaKind
  /** Posizione: per le categorie sempre 'before'. */
  where:       MediaWhere
  /** Categoria di riferimento (prima/dopo). */
  category:    string | null
  /** Foto o video caricato (per le promo può mancare: foto del piatto). */
  url:         string | null
  video:       boolean
  /** Video: immagine d'attesa (primo fotogramma utile). */
  poster:      string | null
  dishId:      string | null
  title:       string | null
  description: string | null
  badge:       string | null
  /** Prezzo di listino (vuoto = quello del piatto collegato). */
  price:       number | null
  promoPrice:  number | null
  priceMode:   'strikethrough' | 'solo'
  show:        boolean
}

const str = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const price = (v: unknown) => {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.round(v * 100) / 100
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^\d,.-]/g, '').replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
  }
  return null
}
const url = (v: unknown) => (typeof v === 'string' && /^https?:\/\//.test(v) ? v.slice(0, 1000) : null)
export const newMediaId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function parseMediaPage(v: unknown): MediaPage | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  const kind: MediaKind = r.kind === 'promo' ? 'promo' : 'category'
  const where: MediaWhere = kind === 'category' ? 'before'
    : r.where === 'start' || r.where === 'before' || r.where === 'after' || r.where === 'end' ? r.where : 'start'
  const category = str(r.category, 120)
  if ((kind === 'category' || where === 'before' || where === 'after') && !category) return null
  return {
    id: str(r.id, 40) ?? newMediaId(), kind, where, category,
    url: url(r.url), video: r.video === true, poster: url(r.poster),
    dishId: str(r.dishId, 40),
    title: str(r.title, 120), description: str(r.description, 400), badge: str(r.badge, 60),
    price: price(r.price), promoPrice: price(r.promoPrice),
    priceMode: r.priceMode === 'strikethrough' ? 'strikethrough' : 'solo',
    show: r.show !== false,
  }
}

export function parseMedia(v: unknown): MediaPage[] {
  return Array.isArray(v) ? v.map(parseMediaPage).filter((x): x is MediaPage => !!x).slice(0, 40) : []
}

/** Vecchie pubblicità del tema (Personalizzazione → Menù Media) di un menu.
 *  "Dopo la pagina PDF n°" non ha un corrispettivo (le pagine cambiano): la
 *  promo va all'inizio del menu. */
export function fromOldAds(themeConfig: unknown, menuId: string): MediaPage[] {
  const ads = (themeConfig as { ads?: unknown[] } | null)?.ads
  if (!Array.isArray(ads)) return []
  const out: MediaPage[] = []
  ads.forEach((a, i) => {
    const r = (a ?? {}) as Record<string, unknown>
    if (r.menuId && r.menuId !== menuId) return
    const mediaUrl = r.mode === 'custom_media' ? url(r.mediaUrl) : null
    const photo = url(r.backupImageUrl)
    const isVideo = !!mediaUrl && /\.(mp4|m4v|mov|webm)(\?|$)/i.test(mediaUrl)
    const cat = str(r.categoryTarget, 120)
    const p = parseMediaPage({
      id: `ad${i}`, kind: cat ? 'category' : 'promo', where: cat ? 'before' : 'start', category: cat,
      url: mediaUrl ?? photo, video: isVideo, poster: isVideo ? photo : null,
      dishId: str(r.dishId, 40), title: str(r.dishName, 120), description: str(r.dishDescription, 400), badge: str(r.badgeText, 60),
      price: r.price, promoPrice: r.promoPrice, priceMode: r.promoPriceMode,
    })
    if (p) out.push(p)
  })
  return out
}
