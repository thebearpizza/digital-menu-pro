// ─────────────────────────────────────────────────────────────────────────────
// PDF del menu con la grafica del menu sul telefono: le pagine le impagina e
// disegna lo stesso motore (typeset), in formato A4, e diventano le pagine
// del PDF (immagini ad alta risoluzione: la carta una volta sola, i testi in
// un livello trasparente sopra). Fermo: niente animazioni, i video delle
// pagine foto/video sono sostituiti dalla loro immagine d'attesa.
// ─────────────────────────────────────────────────────────────────────────────

import { layoutMenu, type MenuData } from './typeset'
import { parseStyle, type MenuStyle } from '@/lib/menuStyle'
import { loadImage, loadStyleAssets } from './fonts'

// A4 in punti PDF; la pagina si impagina a questa misura (come un tablet).
const A4 = { w: 595.28, h: 841.89 }
// Pixel per punto: testi a ~180 dpi (nitidi in stampa), carta a ~144 dpi
// (sfumata: di più pesa senza vedersi).
const K = 2.5, KP = 2

export async function renderMenuPdf(menus: { data: MenuData; style: MenuStyle }[], onPage?: (done: number) => void): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  let done = 0
  for (const m of menus) {
    const style = parseStyle(m.style)   // registra i caratteri caricati anche qui
    const { background } = await loadStyleAssets(style)
    // Foto delle pagine foto/video (dei video, l'immagine d'attesa).
    const urls = new Set<string>()
    for (const mp of m.data.media ?? []) {
      if (mp.url && !mp.video) urls.add(mp.url)
      if (mp.poster) urls.add(mp.poster)
      if (!mp.url && mp.dish?.image) urls.add(mp.dish.image)
    }
    const imgs = new Map<string, HTMLImageElement>()
    await Promise.all(Array.from(urls).map(async u => { const im = await loadImage(u); if (im) imgs.set(u, im) }))

    const vp = { w: Math.round(A4.w), h: Math.round(A4.h), insets: { top: 0, right: 0, bottom: 0, left: 0 } }
    const probe = document.createElement('canvas').getContext('2d')!
    const layout = layoutMenu(probe, m.data, vp, style, { background, media: u => imgs.get(u) ?? null })
    const canvas = (k: number) => {
      const cv = document.createElement('canvas')
      cv.width = Math.round(vp.w * k); cv.height = Math.round(vp.h * k)
      return { cv, c: cv.getContext('2d')!, k }
    }
    const P = canvas(KP), T = canvas(K)
    const encode = async (cv: HTMLCanvasElement, type: 'image/jpeg' | 'image/png') => {
      const blob = await new Promise<Blob>((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('Pagina non disegnata'))), type, 0.84))
      const bytes = new Uint8Array(await blob.arrayBuffer())
      return type === 'image/png' ? pdf.embedPng(bytes) : pdf.embedJpg(bytes)
    }
    // La carta (tinta, superficie, immagine di sfondo) è uguale su tutte le
    // pagine: si salva una volta per variante e si riusa. Sopra, i testi in
    // un livello trasparente: il file resta leggero anche con sfondi materici.
    const papers = new Map<string, Awaited<ReturnType<typeof encode>>>()
    for (let i = 0; i < layout.pages.length; i++) {
      const page = pdf.addPage([A4.w, A4.h])
      const media = !!layout.pages[i].media
      const key = layout.paperKey(i)
      let paper = papers.get(key)
      if (!paper) {
        // Le pagine foto/video sono tutte immagine: alla risoluzione dei testi.
        const L = media ? T : P
        L.c.setTransform(L.k, 0, 0, L.k, 0, 0)
        L.c.fillStyle = style.page.paper; L.c.fillRect(0, 0, vp.w, vp.h)
        layout.paint(L.c, i, media ? {} : { layer: 'paper' })
        paper = await encode(L.cv, 'image/jpeg')
        if (!media) papers.set(key, paper)
      }
      page.drawImage(paper, { x: 0, y: 0, width: A4.w, height: A4.h })
      if (!media) {
        T.c.setTransform(1, 0, 0, 1, 0, 0); T.c.clearRect(0, 0, T.cv.width, T.cv.height)
        T.c.setTransform(K, 0, 0, K, 0, 0)
        layout.paint(T.c, i, { layer: 'content' })
        page.drawImage(await encode(T.cv, 'image/png'), { x: 0, y: 0, width: A4.w, height: A4.h })
      }
      onPage?.(++done)
    }
  }
  const bytes = await pdf.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

/** Scarica un file nel browser. */
export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
