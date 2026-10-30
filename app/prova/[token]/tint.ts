// ─────────────────────────────────────────────────────────────────────────────
// Colore sotto le barre del browser (fondo di <html> e theme-color).
//
// Pagina d'apertura, menu e scheda del piatto lo vogliono ciascuno del proprio
// colore. Se ognuno ripristinasse alla chiusura il colore trovato all'apertura,
// passando da un menu all'altro (le pagine si aprono e chiudono sfalsate)
// tornerebbe il colore di quello precedente. Qui invece vince sempre l'ultimo
// che l'ha chiesto ed è ancora aperto; chiudendo, torna quello del precedente.
// ─────────────────────────────────────────────────────────────────────────────

type Hold = { color: string }
const holds: Hold[] = []
let original: { bg: string; meta: string | null } | null = null

function apply() {
  const html = document.documentElement
  const top = holds[holds.length - 1]
  if (!original) return
  html.style.backgroundColor = top ? top.color : original.bg
  const color = top ? top.color : original.meta
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (color) {
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta) }
    meta.content = color
  }
}

/** Chiede il colore; `set` lo cambia (resta sua la precedenza), `release` lo lascia. */
export function holdTint(color: string): { set: (c: string) => void; release: () => void } {
  if (!original) {
    original = {
      bg: document.documentElement.style.backgroundColor,
      meta: document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content ?? null,
    }
  }
  const h: Hold = { color }
  holds.push(h)
  apply()
  return {
    set: c => { h.color = c; apply() },
    release: () => {
      const i = holds.indexOf(h)
      if (i >= 0) { holds.splice(i, 1); apply() }
    },
  }
}
