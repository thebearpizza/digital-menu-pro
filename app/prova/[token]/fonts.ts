import { CUSTOM_PREFIX, customFamily, resolveFace, styleFaces, styleFontsUrl, textStyles, type CustomFont, type MenuStyle, type TextStyle } from '@/lib/menuStyle'

// Caratteri del menu (Cormorant Garamond + Inter), serviti dal nostro proxy
// /api/gfonts: il telefono del cliente non contatta Google. Un solo foglio di
// stile per tutta la visita (pagina d'apertura e menu).

export const FONTS_CSS = '/api/gfonts/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600&display=block'

/** Inserisce (una volta per indirizzo) il foglio di stile dei caratteri; si
 *  risolve quando è caricato (le facce sono dichiarate, non ancora scaricate). */
export function loadFontCss(href: string = FONTS_CSS): Promise<void> {
  return new Promise<void>(resolve => {
    let link = Array.from(document.querySelectorAll<HTMLLinkElement>('link[data-curl-fonts]')).find(l => l.dataset.href === href)
    if (link?.dataset.loaded) { resolve(); return }
    if (!link) {
      link = document.createElement('link')
      link.rel = 'stylesheet'; link.href = href; link.dataset.curlFonts = '1'; link.dataset.href = href
      document.head.appendChild(link)
    }
    const el = link
    el.addEventListener('load', () => { el.dataset.loaded = '1'; resolve() }, { once: true })
    el.addEventListener('error', () => resolve(), { once: true })
  })
}

// ── Caratteri caricati e sfondo delle pagine ─────────────────────────────────

const customLoaded = new Map<string, Promise<void>>()
/** Registra (una volta per file) le facce dei caratteri caricati dal
 *  ristoratore: ogni file con il suo spessore e corsivo. Con `used` (i testi
 *  che le pagine scrivono davvero) solo le facce che servono: una famiglia
 *  intera sono una dozzina di file da scaricare sul telefono del cliente. */
export function loadCustomFonts(fonts: CustomFont[], used?: TextStyle[]): Promise<void> {
  const need = used && new Set(used.filter(t => t.font.startsWith(CUSTOM_PREFIX)).map(t => {
    const f = resolveFace(t.font, t.weight, t.italic)
    return `${t.font.slice(CUSTOM_PREFIX.length)}|${f.weight}|${f.italic}`
  }))
  return Promise.all(fonts.flatMap(f => f.faces.filter(x => !need || need.has(`${f.id}|${x.weight}|${x.italic}`)).map(x => {
    const key = `${f.id}|${x.url}|${x.weight}|${x.italic}`
    let p = customLoaded.get(key)
    if (!p) {
      const face = new FontFace(customFamily(f.id), `url("${x.url}")`, {
        display: 'block', weight: String(x.weight), style: x.italic ? 'italic' : 'normal',
      })
      p = face.load().then(ff => { document.fonts.add(ff) }).catch(() => undefined)
      customLoaded.set(key, p)
    }
    return p
  }))).then(() => undefined)
}

const images = new Map<string, Promise<HTMLImageElement | null>>()
/** Immagine per il canvas (crossOrigin: la pagina diventa una texture WebGL). */
export function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  let p = images.get(url)
  if (!p) {
    p = new Promise(resolve => {
      const im = new Image()
      im.crossOrigin = 'anonymous'
      im.onload = () => (im.decode ? im.decode().catch(() => undefined) : Promise.resolve()).then(() => resolve(im))
      im.onerror = () => resolve(null)
      im.src = url
    })
    images.set(url, p)
  }
  return p
}

/** Tutto ciò che serve per impaginare con uno stile: caratteri (Google via
 *  proxy e caricati) e immagine di sfondo delle pagine. */
export async function loadStyleAssets(st: MenuStyle): Promise<{ background: HTMLImageElement | null }> {
  const css = styleFontsUrl(st)
  const [, , background] = await Promise.all([
    css ? loadFontCss(css) : Promise.resolve(),
    loadCustomFonts(st.customFonts, textStyles(st)),
    loadImage(st.page.background.url),
  ])
  await Promise.all(styleFaces(st).map(f => document.fonts.load(f).catch(() => undefined)))
  return { background }
}
