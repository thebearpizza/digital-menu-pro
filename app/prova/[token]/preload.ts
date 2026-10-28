// ─────────────────────────────────────────────────────────────────────────────
// Precaricamento delle foto dei piatti.
//
// Le foto si vedono nella scheda del piatto: per aprirla senza attese vanno
// scaricate (e decodificate) prima. Regola: dalla pagina d'apertura le foto
// delle prime due pagine di ogni menu; nel menu, quelle della pagina aperta
// e della successiva (in doppia pagina le due doppie vicine). Le altre si
// caricano quando si arriva alla pagina che le precede.
// ─────────────────────────────────────────────────────────────────────────────

// Foto già scaricate e decodificate: una scheda nuova le mostra subito,
// senza partire vuota con la dissolvenza. Resta valida passando dalla pagina
// d'apertura al menu (stessa pagina del browser).
export const readyImages = new Set<string>()
const pending = new Set<string>()

export function warmImage(src: string | null | undefined, low = false) {
  if (!src || readyImages.has(src) || pending.has(src)) return
  pending.add(src)
  const im = new Image()
  if (low) (im as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'low'
  im.decoding = 'async'
  im.src = src
  im.decode().then(() => { readyImages.add(src) }, () => {}).finally(() => pending.delete(src))
}

/** Esegue `fn` quando il browser è libero (o dopo `timeout` ms). */
export function whenIdle(fn: () => void, timeout = 1500) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout })
  else window.setTimeout(fn, Math.min(timeout, 300))
}
