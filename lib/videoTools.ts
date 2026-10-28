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

/** Il browser sa creare video? (WebCodecs) */
export const canEncodeVideo = () => typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window
export const canMakeBoomerang = canEncodeVideo

export type EncodeResult = { blob: Blob } | { error: string }

/** Video → MP4 H.264 andata e ritorno (al massimo 10 s di video). */
export const makeBoomerang = (source: File | string, onProgress?: (p: number) => void) =>
  encodeVideo(source, { boomerang: true, maxSeconds: 10 }, onProgress)

/** Video → MP4 H.264 leggero (al massimo 30 s, lato lungo 1280 px, senza
 *  audio): parte su tutti i telefoni. I video di iPhone e Mac (.mov HEVC) e i
 *  .webm su molti telefoni non si vedrebbero. */
export const toH264 = (source: File | string, onProgress?: (p: number) => void) =>
  encodeVideo(source, { boomerang: false, maxSeconds: 30 }, onProgress)

type FrameCb = (now: number, meta: { mediaTime: number }) => void
type VideoWithRvfc = HTMLVideoElement & { requestVideoFrameCallback?: (cb: FrameCb) => number }

// H.264 dal profilo più alto al più semplice, livelli che coprono il 720p e il 1080p.
const CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.64001f', 'avc1.4d001f', 'avc1.42e01f']

/** Codifica un video in MP4 H.264.
 *
 *  Lettura dei fotogrammi: il video si riproduce una volta (fuori vista ma
 *  nella pagina: Safari non mostra fotogrammi di un video staccato) e ogni
 *  fotogramma mostrato viene codificato con il suo tempo vero. Se il browser
 *  non segnala i fotogrammi, si passa da un fotogramma all'altro saltando.
 *  Boomerang: i fotogrammi dell'andata si tengono in JPEG e si ricodificano
 *  al contrario, senza ripetere gli estremi (niente fermo-immagine). */
export async function encodeVideo(
  source: File | string, opts: { boomerang: boolean; maxSeconds: number }, onProgress?: (p: number) => void,
): Promise<EncodeResult> {
  if (!canEncodeVideo()) return { error: 'Questo browser non sa creare video: apri la pagina da Chrome o da Safari aggiornati.' }
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer')
  const { url, revoke } = srcOf(source)
  // Il video sta nella pagina, piccolissimo e quasi trasparente.
  const holder = document.createElement('div')
  holder.style.cssText = 'position:fixed;right:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;overflow:hidden;z-index:-1'
  document.body.appendChild(holder)
  try {
    let v: VideoWithRvfc
    try { v = await loadVideo(url) } catch { return { error: 'Il video non si apre in questo browser.' } }
    v.style.cssText = 'width:2px;height:2px'
    holder.appendChild(v)
    const dur = Math.min(opts.maxSeconds, await knownDuration(v))
    if (dur < 0.5) return { error: 'Non riesco a leggere la durata del video.' }
    const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight))
    const even = (x: number) => Math.max(2, Math.round((x * k) / 2) * 2)
    const width = even(v.videoWidth), height = even(v.videoHeight)
    const base = { width, height, bitrate: 3_000_000, framerate: 30, avc: { format: 'avc' as const } }
    let codec: string | null = null
    for (const c of CODECS) {
      try { if ((await VideoEncoder.isConfigSupported({ codec: c, ...base })).supported) { codec = c; break } } catch { /* prossimo */ }
    }
    if (!codec) return { error: 'Questo browser non sa codificare video H.264.' }

    const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width, height }, fastStart: 'in-memory' })
    let failure: string | null = null
    const encoder = new VideoEncoder({
      output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta) } catch (e) { failure = `scrittura MP4: ${(e as Error).message}` } },
      error: e => { failure = `codifica: ${e.message}` },
    })
    encoder.configure({ codec, ...base })
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
    const share = opts.boomerang ? 0.5 : 1
    const kept: Promise<{ t: number; jpg: Blob | null }>[] = []
    let last = -1
    const take = async (t: number) => {
      if (t <= last) return
      c.drawImage(v, 0, 0, width, height)
      encode(canvas, t)
      last = t
      if (opts.boomerang) kept.push(new Promise(r => canvas.toBlob(b => r({ t, jpg: b }), 'image/jpeg', 0.9)))
      onProgress?.(share * Math.min(1, t / dur))
      while (encoder.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 5))
    }

    // ── Andata: riproduzione con segnale di ogni fotogramma…
    let played = false
    if (v.requestVideoFrameCallback) {
      played = await new Promise<boolean>(resolve => {
        let done = false, t0 = -1
        const finish = (ok: boolean) => { if (done) return; done = true; v.pause(); resolve(ok) }
        const onFrame: FrameCb = (_now, meta) => {
          if (done) return
          if (t0 < 0) t0 = meta.mediaTime
          const t = meta.mediaTime - t0
          if (t > dur || failure) { finish(true); return }
          void take(t)
          v.requestVideoFrameCallback!(onFrame)
        }
        v.requestVideoFrameCallback!(onFrame)
        v.addEventListener('ended', () => finish(count > 2), { once: true })
        // Nessun fotogramma segnalato in 2,5 s: si passa al metodo a salti.
        window.setTimeout(() => { if (count === 0) finish(false) }, 2500)
        window.setTimeout(() => finish(count > 2), (dur + 10) * 1000)
        v.currentTime = 0
        v.play().catch(() => finish(false))
      })
    }
    // …oppure fotogramma per fotogramma, saltando.
    if (!played) {
      if (count > 0) return { error: 'La lettura del video si è interrotta: riprova.' }
      for (let i = 0; i < Math.floor(dur * 30); i++) {
        if (failure) break
        await seek(v, i / 30)
        await take(i / 30)
      }
    }
    if (failure) return { error: `Errore di ${failure}` }
    if (count < 3) return { error: 'Non riesco a leggere i fotogrammi del video.' }

    // ── Ritorno (dal penultimo al secondo fotogramma)
    if (opts.boomerang) {
      const frames = (await Promise.all(kept)).filter(f => f.jpg).sort((a, b) => a.t - b.t)
      const T = frames[frames.length - 1].t
      for (let i = frames.length - 2; i >= 1; i--) {
        if (failure) break
        const bmp = await createImageBitmap(frames[i].jpg!)
        encode(bmp, T + (T - frames[i].t))
        bmp.close()
        while (encoder.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 5))
        onProgress?.(0.5 + 0.5 * (1 - i / (frames.length - 1)))
      }
    }
    await encoder.flush()
    encoder.close()
    if (failure) return { error: `Errore di ${failure}` }
    muxer.finalize()
    return { blob: new Blob([(muxer.target as InstanceType<typeof ArrayBufferTarget>).buffer], { type: 'video/mp4' }) }
  } catch (e) {
    return { error: `Errore imprevisto: ${(e as Error)?.message ?? e}` }
  } finally {
    holder.remove()
    revoke()
  }
}
