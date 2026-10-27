// Caratteri del menu (Cormorant Garamond + Inter), serviti dal nostro proxy
// /api/gfonts: il telefono del cliente non contatta Google. Un solo foglio di
// stile per tutta la visita (pagina d'apertura e menu).

export const FONTS_CSS = '/api/gfonts/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600&display=block'

/** Inserisce (una volta) il foglio di stile dei caratteri; si risolve quando è
 *  caricato (le facce sono dichiarate, non ancora scaricate). */
export function loadFontCss(): Promise<void> {
  return new Promise<void>(resolve => {
    let link = document.querySelector<HTMLLinkElement>('link[data-curl-fonts]')
    if (link?.dataset.loaded) { resolve(); return }
    if (!link) {
      link = document.createElement('link')
      link.rel = 'stylesheet'; link.href = FONTS_CSS; link.dataset.curlFonts = '1'
      document.head.appendChild(link)
    }
    const el = link
    el.addEventListener('load', () => { el.dataset.loaded = '1'; resolve() }, { once: true })
    el.addEventListener('error', () => resolve(), { once: true })
  })
}
