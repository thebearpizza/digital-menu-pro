// ─────────────────────────────────────────────────────────────────────────────
// Lettura dei dati scritti dentro un file di carattere (.ttf, .otf, .woff):
// nome della famiglia, spessore (100–900) e corsivo. Serve a raggruppare i
// file della stessa famiglia caricati dal ristoratore (Aurel Light, Aurel
// Bold Italic… → un solo carattere "Aurel" con i suoi spessori e corsivi).
// I .woff2 sono compressi in un modo che il browser non sa aprire da qui:
// per quelli (e per i file illeggibili) si ricava tutto dal nome del file.
// ─────────────────────────────────────────────────────────────────────────────

export interface FontFileInfo { family: string; weight: number; italic: boolean }

// Parole di stile nei nomi (file o famiglia), dalla più lunga.
const WEIGHT_WORDS: [RegExp, number][] = [
  [/^(extra|ultra)(light|thin)$/, 200], [/^(extra|ultra)bold$/, 800], [/^(semi|demi)bold$/, 600],
  [/^(hairline|thin)$/, 100], [/^light$/, 300], [/^(regular|normal|book|roman|plain)$/, 400],
  [/^medium$/, 500], [/^bold$/, 700], [/^(heavy|black)$/, 900],
]
const ITALIC_WORD = /^(italic|oblique|it)$/

/** Separa un nome in parole (trattini, spazi, MaiuscoleAttaccate). */
function words(name: string): string[] {
  return name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s_\-.]+/)
    .filter(Boolean)
}

/** Dal nome (del file o della famiglia): famiglia senza parole di stile,
 *  spessore e corsivo. Riconosce anche "semi bold" / "extra light" separati. */
export function infoFromName(name: string): FontFileInfo {
  const ws = words(name)
  let weight = 400, italic = false
  const keep: string[] = []
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i].toLowerCase()
    const pair = i + 1 < ws.length ? w + ws[i + 1].toLowerCase() : ''
    const pairHit = pair && WEIGHT_WORDS.find(([re]) => re.test(pair))
    if (pairHit && /^(semi|demi|extra|ultra)$/.test(w)) { weight = pairHit[1]; i++; continue }
    const hit = WEIGHT_WORDS.find(([re]) => re.test(w))
    if (hit) { weight = hit[1]; continue }
    if (ITALIC_WORD.test(w)) { italic = true; continue }
    if (/^(\d{3})$/.test(w) && +w >= 100 && +w <= 900) { weight = +w; continue }
    keep.push(ws[i])
  }
  return { family: keep.join(' ') || name, weight, italic }
}

/** Dati del file: prima quelli scritti dentro, poi il nome del file. */
export async function readFontFileInfo(file: File): Promise<FontFileInfo> {
  const fromName = infoFromName(file.name)
  try {
    const buf = await file.arrayBuffer()
    const inner = await readSfnt(buf)
    if (!inner) return fromName
    return {
      family: inner.family || fromName.family,
      weight: inner.weight ?? fromName.weight,
      italic: inner.italic ?? fromName.italic,
    }
  } catch {
    return fromName
  }
}

interface Inner { family: string | null; weight: number | null; italic: boolean | null }

/** Tabelle OS/2 (spessore, corsivo) e name (famiglia) di un .ttf/.otf/.woff. */
async function readSfnt(buf: ArrayBuffer): Promise<Inner | null> {
  const dv = new DataView(buf)
  const sig = dv.getUint32(0)
  const tables = new Map<string, DataView>()
  const tag = (o: number) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3))
  if (sig === 0x00010000 || sig === 0x4f54544f /* OTTO */ || sig === 0x74727565 /* true */) {
    const n = dv.getUint16(4)
    for (let i = 0; i < n; i++) {
      const e = 12 + 16 * i
      const t = tag(e)
      if (t === 'OS/2' || t === 'name') tables.set(t, new DataView(buf, dv.getUint32(e + 8), dv.getUint32(e + 12)))
    }
  } else if (sig === 0x774f4646 /* wOFF */) {
    const n = dv.getUint16(12)
    for (let i = 0; i < n; i++) {
      const e = 44 + 20 * i
      const t = tag(e)
      if (t !== 'OS/2' && t !== 'name') continue
      const off = dv.getUint32(e + 4), comp = dv.getUint32(e + 8), orig = dv.getUint32(e + 12)
      const raw = new Uint8Array(buf, off, comp)
      const data = comp < orig ? await inflate(raw) : raw
      tables.set(t, new DataView(data.buffer, data.byteOffset, data.byteLength))
    }
  } else return null

  const os2 = tables.get('OS/2'), name = tables.get('name')
  return {
    weight: os2 && os2.byteLength >= 6 ? clampWeight(os2.getUint16(4)) : null,
    italic: os2 && os2.byteLength >= 64 ? (os2.getUint16(62) & 1) === 1 : null,
    family: name ? familyName(name) : null,
  }
}

const clampWeight = (w: number) => Math.max(100, Math.min(900, Math.round(w / 100) * 100))

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate')
  const out = new Response(new Blob([data]).stream().pipeThrough(ds))
  return new Uint8Array(await out.arrayBuffer())
}

/** Famiglia tipografica (nameID 16), altrimenti la famiglia (nameID 1) senza
 *  eventuali parole di stile ("Aurel Light" → "Aurel"). */
function familyName(t: DataView): string | null {
  const count = t.getUint16(2), strOff = t.getUint16(4)
  const found: Record<number, string> = {}
  for (let i = 0; i < count; i++) {
    const r = 6 + 12 * i
    const pid = t.getUint16(r), nid = t.getUint16(r + 6), len = t.getUint16(r + 8), off = t.getUint16(r + 10)
    if ((nid !== 1 && nid !== 16) || found[nid]) continue
    const start = strOff + off
    let s = ''
    if (pid === 3 || pid === 0) for (let k = 0; k + 1 < len; k += 2) s += String.fromCharCode(t.getUint16(start + k))
    else if (pid === 1) for (let k = 0; k < len; k++) s += String.fromCharCode(t.getUint8(start + k))
    if (s.trim()) found[nid] = s.trim()
  }
  if (found[16]) return found[16]
  return found[1] ? infoFromName(found[1]).family : null
}
