// ─────────────────────────────────────────────────────────────────────────────
// Inquadratura delle foto dei piatti nel nuovo menu.
//
// Il nuovo menu mostra la foto ORIGINALE (image_original_url, o image_url per
// le foto mai ritagliate) dentro il riquadro della scheda, che ha il formato
// scelto nello stile del menu (quadrata, orizzontale 4:3, verticale 4:5,
// tonda). La parte da mostrare è `dishes.photo_frame`: rettangolo normalizzato
// 0..1 sull'originale, con `a` = rapporto larghezza/altezza del riquadro per
// cui è stato scelto.
//
// Se manca (o è stato scelto per un altro formato) si usa il riquadro più
// grande possibile del formato giusto, centrato dove il ristoratore aveva
// centrato il vecchio ritaglio 16:9 (image_crop), altrimenti al centro.
// ─────────────────────────────────────────────────────────────────────────────

export interface Rect { x: number; y: number; w: number; h: number }
export interface PhotoFrame extends Rect { a: number }

export type PhotoShape = 'square' | 'landscape' | 'portrait' | 'circle'
export const PHOTO_ASPECT: Record<PhotoShape, number> = { square: 1, landscape: 4 / 3, portrait: 4 / 5, circle: 1 }
export const PHOTO_LABEL: Record<PhotoShape, string> = { square: 'quadrata', landscape: 'orizzontale 4:3', portrait: 'verticale 4:5', circle: 'tonda' }

const n01 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null)

/** Rettangolo valido (o null). */
export function parseRect(v: unknown): Rect | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  const x = n01(r.x), y = n01(r.y), w = n01(r.w), h = n01(r.h)
  if (x === null || y === null || !w || !h) return null
  return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) }
}

export function parseFrame(v: unknown): PhotoFrame | null {
  const r = parseRect(v)
  const a = (v as { a?: unknown } | null)?.a
  return r && typeof a === 'number' && a > 0 ? { ...r, a } : null
}

/** Stesso formato (con tolleranza per gli arrotondamenti). */
export const sameAspect = (a: number, b: number) => Math.abs(a / b - 1) < 0.02

/**
 * Parte dell'originale da mostrare in un riquadro di formato `aspect`
 * (larghezza/altezza in pixel), per una foto di proporzioni `imgAspect`.
 */
export function frameFor(imgAspect: number, aspect: number, frame: PhotoFrame | null, focus: Rect | null): Rect {
  if (frame && sameAspect(frame.a, aspect)) return frame
  // Il più grande possibile: in coordinate normalizzate w/h = aspect/imgAspect.
  const r = aspect / imgAspect
  const w = r >= 1 ? 1 : r
  const h = r >= 1 ? 1 / r : 1
  const c = frame ?? focus
  const cx = c ? c.x + c.w / 2 : 0.5
  const cy = c ? c.y + c.h / 2 : 0.5
  return {
    x: Math.max(0, Math.min(1 - w, cx - w / 2)),
    y: Math.max(0, Math.min(1 - h, cy - h / 2)),
    w, h,
  }
}

/** Stile CSS dell'<img> (assoluta, dentro un riquadro overflow: hidden del
 *  formato giusto) che mostra esattamente `rect` dell'originale. */
export function frameStyle(rect: Rect): React.CSSProperties {
  return {
    position: 'absolute', maxWidth: 'none',
    width: `${100 / rect.w}%`, height: `${100 / rect.h}%`,
    left: `${(-rect.x / rect.w) * 100}%`, top: `${(-rect.y / rect.h) * 100}%`,
  }
}
