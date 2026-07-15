// ─────────────────────────────────────────────────────────────────────────────
// imageCompress — ridimensiona e ri-comprime le immagini lato client PRIMA
// dell'upload, per tagliare il peso dei file (e quindi l'egress del CDN) senza
// perdita visibile di qualità sulle card del menu.
//
// • Downscale al lato lungo massimo (default 2000px) + ri-encoding JPEG q~0.82.
//   Un 4000px da telefono (~2MB) scende a ~300-600KB restando nitido su mobile.
// • SVG e GIF passano intatti (il canvas li rasterizzerebbe / appiattirebbe
//   l'animazione). I PNG restano PNG (preserva la trasparenza dei loghi).
// • Difensivo: se qualcosa fallisce o il risultato non è più piccolo
//   dell'originale, restituisce il file originale immutato. Non gonfia mai.
//
// L'orientamento EXIF è gestito dal browser sul tag <img> (image-orientation:
// from-image, default) → le foto verticali da telefono non vengono ruotate.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024  // 5MB — tetto per le immagini
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024 // 20MB — tetto per i video

// Formati che NON vanno passati per il canvas.
const PASSTHROUGH = new Set(['image/svg+xml', 'image/gif'])

export interface CompressOpts {
  maxDim?: number    // lato lungo massimo in px (default 2000)
  quality?: number   // qualità JPEG 0..1 (default 0.82)
  maxBytes?: number  // tetto duro: abbassa la qualità per starci sotto
}

function loadImageEl(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')) }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(res => canvas.toBlob(res, type, quality))
}

/**
 * Restituisce una versione ridimensionata/compressa del file immagine, oppure
 * il file originale se non c'è nulla da guadagnare o se non è comprimibile.
 * Non lancia mai: in caso di errore torna il file originale.
 */
export async function compressImageFile(file: File, opts: CompressOpts = {}): Promise<File> {
  const { maxDim = 2000, quality = 0.82, maxBytes = MAX_IMAGE_BYTES } = opts

  if (!file.type.startsWith('image/') || PASSTHROUGH.has(file.type)) return file
  if (typeof document === 'undefined') return file

  try {
    const img = await loadImageEl(file)
    const w = img.naturalWidth, h = img.naturalHeight
    if (!w || !h) return file

    const scale = Math.min(1, maxDim / Math.max(w, h))
    // Niente da fare: già piccola per dimensioni e per peso.
    if (scale === 1 && file.size <= 900 * 1024) return file

    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = tw; canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, tw, th)

    const isPng = file.type === 'image/png'
    const mime  = isPng ? 'image/png' : 'image/jpeg'

    let q = quality
    let blob = await canvasToBlob(canvas, mime, q)
    if (!blob) return file
    // Per i JPEG, se ancora sopra il tetto abbassa la qualità (min 0.5).
    while (!isPng && blob.size > maxBytes && q > 0.5) {
      q = Math.max(0.5, q - 0.1)
      const b = await canvasToBlob(canvas, mime, q)
      if (!b) break
      blob = b
    }

    // Non sostituire mai con qualcosa di più pesante dell'originale.
    if (blob.size >= file.size) return file

    const ext  = isPng ? 'png' : 'jpg'
    const name = file.name.replace(/\.[^.]+$/, '') + '.' + ext
    return new File([blob], name, { type: mime })
  } catch {
    return file
  }
}
