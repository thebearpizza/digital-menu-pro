// ─────────────────────────────────────────────────────────────────────────────
// Strumenti video della Personalizzazione (solo nel browser del ristoratore).
//
//  • usefulFrame: il primo fotogramma "utile" di un video, saltando l'inizio
//    nero o in dissolvenza dal nero → immagine d'attesa e punto di partenza.
//  • makeBoomerang: un unico MP4 "andata + ritorno" (il video e poi lo stesso
//    al contrario): ripetuto in loop dà un movimento continuo, senza salti.
//    I browser non sanno riprodurre un video all'indietro in modo fluido,
//    quindi il ritorno si prepara qui, una volta, al caricamento: fotogramma
//    per fotogramma, codificato in H.264 (WebCodecs) e scritto in MP4
//    (mp4-muxer). Il file risultante si riproduce ovunque, iPhone compresi.
// ─────────────────────────────────────────────────────────────────────────────

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.crossOrigin = 'anonymous'
    v.muted = true; v.playsInline = true; v.preload = 'auto'
    v.addEventListener('loadeddata', () => resolve(v), { once: true })
    v.addEventListener('error', () => reject(new Error('video')), { once: true })
    v.src = src
    v.load()
  })
}

/** Durata vera. I .webm registrati nel browser (es. quelli convertiti dal
 *  vecchio editor) non la dichiarano (Infinity): saltando molto avanti il
 *  browser la calcola. */
async function knownDuration(v: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(v.duration) && v.duration > 0) return v.duration
  await new Promise<void>(resolve => {
    const tm = window.setTimeout(resolve, 4000)
    const on = () => { if (Number.isFinite(v.duration)) { clearTimeout(tm); v.removeEventListener('durationchange', on); resolve() } }
    v.addEventListener('durationchange', on)
    v.currentTime = 1e101
  })
  const d = Number.isFinite(v.duration) ? v.duration : 0
  await seek(v, 0)
  return d
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise(resolve => {
    if (Math.abs(v.currentTime - t) < 1e-4 && v.readyState >= 2) { resolve(); return }
    const done = () => { clearTimeout(tm); resolve() }
    const tm = window.setTimeout(done, 3000)   // seek bloccato: si va avanti comunque
    v.addEventListener('seeked', done, { once: true })
    v.currentTime = t
  })
}

const srcOf = (s: File | string) => (typeof s === 'string' ? { url: s, revoke: () => {} } : (() => {
  const url = URL.createObjectURL(s)
  return { url, revoke: () => URL.revokeObjectURL(url) }
})())

/** Primo fotogramma utile: si misura la luminosità nei primi 4 s; il primo
 *  istante che arriva al 70% della luminosità massima (oltre una soglia
 *  minima) è quello buono. Restituisce il tempo e un JPEG del fotogramma. */
export async function usefulFrame(source: File | string): Promise<{ time: number; image: Blob | null }> {
  const { url, revoke } = srcOf(source)
  try {
    const v = await loadVideo(url)
    const dur = (await knownDuration(v)) || 4
    const probe = document.createElement('canvas')
    probe.width = probe.height = 24
    const pc = probe.getContext('2d', { willReadFrequently: true })!
    const samples: { t: number; l: number }[] = []
    for (let t = 0; t <= Math.min(4, dur - 0.05); t += 0.1) {
      await seek(v, t)
      pc.drawImage(v, 0, 0, 24, 24)
      const d = pc.getImageData(0, 0, 24, 24).data
      let s = 0
      for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
      samples.push({ t, l: s / (d.length / 4) / 255 })
    }
    const max = Math.max(0, ...samples.map(x => x.l))
    const hit = samples.find(x => x.l >= Math.max(0.05, max * 0.7)) ?? samples[0] ?? { t: 0 }
    const time = Math.round(hit.t * 100) / 100
    await seek(v, time)
    const w = Math.min(1280, v.videoWidth || 1280), k = w / (v.videoWidth || w)
    const cv = document.createElement('canvas')
    cv.width = w; cv.height = Math.round((v.videoHeight || 720) * k)
    cv.getContext('2d')!.drawImage(v, 0, 0, cv.width, cv.height)
    const image = await new Promise<Blob | null>(r => cv.toBlob(b => r(b), 'image/jpeg', 0.84))
    return { time, image }
  } catch {
    return { time: 0, image: null }
  } finally {
    revoke()
  }
}

/** Il browser sa preparare il boomerang? (WebCodecs con H.264) */
export const canMakeBoomerang = () => typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window

const MAX_SECONDS = 10   // oltre, il file raddoppiato diventa troppo pesante

/** Video → MP4 andata e ritorno. `onProgress` 0–1. Null se non si può. */
type FrameCb = (now: number, meta: { mediaTime: number }) => void
type VideoWithRvfc = HTMLVideoElement & { requestVideoFrameCallback?: (cb: FrameCb) => number }

/** Video → MP4 andata e ritorno. `onProgress` 0–1. Null se non si può.
 *
 *  Andata: il video si riproduce una volta e ogni fotogramma mostrato viene
 *  codificato con il suo tempo vero (velocità originale, qualunque sia la
 *  frequenza del video) e messo da parte in JPEG. Ritorno: gli stessi
 *  fotogrammi al contrario, senza ripetere gli estremi (niente fermo-immagine).
 *  Riprodurre invece di saltare da un fotogramma all'altro è più veloce e
 *  preciso: molti video (es. quelli registrati nel browser) non hanno l'indice
 *  per saltare con esattezza. */
export async function makeBoomerang(source: File | string, onProgress?: (p: number) => void): Promise<Blob | null> {
  if (!canMakeBoomerang()) return null
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer')
  const { url, revoke } = srcOf(source)
  try {
    const v = await loadVideo(url) as VideoWithRvfc
    if (!v.requestVideoFrameCallback) return null
    const dur = Math.min(MAX_SECONDS, await knownDuration(v))
    if (dur < 0.5) return null
    // Lato lungo al massimo 1280 px, misure pari (richiesto da H.264).
    const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight))
    const even = (x: number) => Math.max(2, Math.round((x * k) / 2) * 2)
    const width = even(v.videoWidth), height = even(v.videoHeight)
    const config = { width, height, bitrate: 3_000_000, framerate: 30 }

    // Profilo H.264 supportato (High → Main → Baseline).
    let codec: string | null = null
    for (const c of CODECS) {
      try { if ((await VideoEncoder.isConfigSupported({ codec: c, ...config })).supported) { codec = c; break } } catch { /* prossimo */ }
    }
    if (!codec) return null

    const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: MUX_CODEC, width, height }, fastStart: 'in-memory' })
    let failed = false
    const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: () => { failed = true } })
    encoder.configure({ codec, ...config })
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const c = canvas.getContext('2d')!
    let count = 0
    const encode = (src: CanvasImageSource, t: number) => {
      const frame = new VideoFrame(src as HTMLCanvasElement, { timestamp: Math.round(t * 1e6) })
      encoder.encode(frame, { keyFrame: count % 60 === 0 })
      frame.close()
      count++
    }

    // ── Andata
    const kept: Promise<{ t: number; jpg: Blob | null }>[] = []
    let t0 = -1, last = 0
    await new Promise<void>(resolve => {
      let done = false
      const finish = () => { if (done) return; done = true; v.pause(); resolve() }
      const onFrame: FrameCb = (_now, meta) => {
        if (done) return
        if (t0 < 0) t0 = meta.mediaTime
        const t = meta.mediaTime - t0
        if (t > dur || failed) { finish(); return }
        if (t > last || count === 0) {
          c.drawImage(v, 0, 0, width, height)
          encode(canvas, t)
          last = t
          kept.push(new Promise(r => canvas.toBlob(b => r({ t, jpg: b }), 'image/jpeg', 0.9)))
          onProgress?.(0.5 * Math.min(1, t / dur))
        }
        v.requestVideoFrameCallback!(onFrame)
      }
      v.requestVideoFrameCallback!(onFrame)
      v.addEventListener('ended', finish, { once: true })
      window.setTimeout(finish, (dur + 8) * 1000)   // video che si blocca
      v.currentTime = 0
      v.play().catch(finish)
    })
    const frames = (await Promise.all(kept)).filter(f => f.jpg).sort((a, b) => a.t - b.t)
    if (frames.length < 3 || failed) return null

    // ── Ritorno (dal penultimo al secondo fotogramma)
    const T = frames[frames.length - 1].t
    for (let i = frames.length - 2; i >= 1; i--) {
      if (failed) return null
      const bmp = await createImageBitmap(frames[i].jpg!)
      encode(bmp, T + (T - frames[i].t))
      bmp.close()
      while (encoder.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 5))
      onProgress?.(0.5 + 0.5 * (1 - i / (frames.length - 1)))
    }
    await encoder.flush()
    encoder.close()
    if (failed) return null
    muxer.finalize()
    return new Blob([(muxer.target as InstanceType<typeof ArrayBufferTarget>).buffer], { type: 'video/mp4' })
  } catch {
    return null
  } finally {
    revoke()
  }
}

// H.264 (High → Main → Baseline): si riproduce ovunque, iPhone compresi.
const CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.42e01f']
const MUX_CODEC = 'avc' as const
