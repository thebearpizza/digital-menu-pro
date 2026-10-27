// ─────────────────────────────────────────────────────────────────────────────
// Superfici della carta, generate (niente immagini da scaricare).
//
// Ogni superficie è un "rilievo" con segno: dove è negativo la carta si
// scurisce (fibre, ombre, vergatura), dove è positivo si schiarisce (luci del
// rilievo). Si applica con due passate, moltiplica (scuro) e schermo (chiaro):
// il colore della carta scelto dal ristoratore resta quello, su carta chiara
// come su carta scura.
//
// Le tessere sono 512 px e si ripetono senza giunte (rumore periodico, fibre
// che "rientrano" dal lato opposto); si disegnano a metà scala (256 px CSS),
// nitide anche sugli schermi ad alta densità.
// ─────────────────────────────────────────────────────────────────────────────

import type { MenuStyle } from '@/lib/menuStyle'

export type PaperTexture = MenuStyle['page']['texture']
export interface PaperTiles { dark: HTMLCanvasElement; light: HTMLCanvasElement }

const N = 512
const cache = new Map<PaperTexture, PaperTiles | null>()

/** Tessere della superficie (generate una volta). Null = carta liscia. */
export function paperTiles(kind: PaperTexture): PaperTiles | null {
  if (kind === 'none' || typeof document === 'undefined') return null
  if (cache.has(kind)) return cache.get(kind)!
  const f = FIELDS[kind]()
  const tiles = toTiles(f)
  cache.set(kind, tiles)
  return tiles
}

/** Stende la superficie su un rettangolo (forza 0 – 1). */
export function paintPaper(c: CanvasRenderingContext2D, kind: PaperTexture, strength: number, w: number, h: number) {
  const t = paperTiles(kind)
  if (!t || strength <= 0) return
  const prev = c.globalCompositeOperation
  for (const [img, op] of [[t.dark, 'multiply'], [t.light, 'screen']] as const) {
    const pat = c.createPattern(img, 'repeat')
    if (!pat) continue
    pat.setTransform?.(new DOMMatrix().scale(0.5))
    c.globalCompositeOperation = op
    c.globalAlpha = Math.min(1, strength)
    c.fillStyle = pat
    c.fillRect(0, 0, w, h)
  }
  c.globalAlpha = 1
  c.globalCompositeOperation = prev
}

// ── Rumore periodico ─────────────────────────────────────────────────────────

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1_000_000) / 1_000_000 }
}

/** Rumore a valori su una griglia `cells`×`cells` che si ripete sulla tessera. */
function valueNoise(cells: number, seed: number) {
  const r = rng(seed)
  const g = new Float32Array(cells * cells).map(() => r() * 2 - 1)
  const sm = (t: number) => t * t * (3 - 2 * t)
  return (x: number, y: number) => {
    const fx = (x / N) * cells, fy = (y / N) * cells
    const x0 = Math.floor(fx), y0 = Math.floor(fy)
    const tx = sm(fx - x0), ty = sm(fy - y0)
    const at = (i: number, j: number) => g[(((j % cells) + cells) % cells) * cells + (((i % cells) + cells) % cells)]
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx
    return a + (b - a) * ty
  }
}

/** Somma di ottave (da `cells` in su), normalizzata a circa ±1. */
function fbm(cells: number, octaves: number, seed: number, gain = 0.5) {
  const ns = Array.from({ length: octaves }, (_, i) => valueNoise(cells << i, seed + i * 101))
  let norm = 0
  for (let i = 0, a = 1; i < octaves; i++, a *= gain) norm += a
  return (x: number, y: number) => {
    let v = 0
    for (let i = 0, a = 1; i < octaves; i++, a *= gain) v += ns[i](x, y) * a
    return v / norm
  }
}

type Field = Float32Array   // N×N, valori con segno (−1 scuro … +1 chiaro)

function field(fn: (x: number, y: number) => number): Field {
  const f = new Float32Array(N * N)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) f[y * N + x] = fn(x, y)
  return f
}

/** Aggiunge `v` in (x, y) con avvolgimento ai bordi (le fibre rientrano). */
function deposit(f: Field, x: number, y: number, v: number) {
  const xi = ((Math.round(x) % N) + N) % N, yi = ((Math.round(y) % N) + N) % N
  f[yi * N + xi] += v
}

/** Fibre: tratti curvi sottili, chiari o scuri. */
function fibers(f: Field, count: number, seed: number, o: { len: [number, number]; amp: number; dark: number; width?: number; curl?: number }) {
  const r = rng(seed)
  for (let k = 0; k < count; k++) {
    let x = r() * N, y = r() * N
    let a = r() * Math.PI * 2
    const len = o.len[0] + r() * (o.len[1] - o.len[0])
    const v = (r() < o.dark ? -1 : 1) * o.amp * (0.5 + r() * 0.5)
    const bend = (r() - 0.5) * (o.curl ?? 0.08)
    for (let s = 0; s < len; s += 0.5) {
      // Fibra più sottile alle estremità.
      const taper = Math.sin((s / len) * Math.PI)
      deposit(f, x, y, v * taper)
      if (o.width && o.width > 1) deposit(f, x + Math.sin(a), y - Math.cos(a), v * taper * 0.5)
      x += Math.cos(a) * 0.5; y += Math.sin(a) * 0.5
      a += bend
    }
  }
}

/** Macchioline (carta riciclata): piccoli dischi sfumati. */
function flecks(f: Field, count: number, seed: number, amp: number) {
  const r = rng(seed)
  for (let k = 0; k < count; k++) {
    const cx = r() * N, cy = r() * N, rad = 0.6 + r() * r() * 2.4, v = -amp * (0.4 + r() * 0.6)
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const d = Math.hypot(dx, dy)
      if (d <= rad + 0.5) deposit(f, cx + dx, cy + dy, v * Math.max(0, Math.min(1, rad + 0.5 - d)))
    }
  }
}

/** Rilievo illuminato: da un'altezza alla luce radente (in alto a sinistra). */
function relief(h: (x: number, y: number) => number, k: number): Field {
  return field((x, y) => {
    const gx = h(x + 1, y) - h(x - 1, y), gy = h(x, y + 1) - h(x, y - 1)
    return -(gx * 0.7 + gy * 0.7) * k
  })
}

const white = (seed: number) => { const r = rng(seed); return () => r() * 2 - 1 }

// ── Le superfici ─────────────────────────────────────────────────────────────

const FIELDS: Record<Exclude<PaperTexture, 'none'>, () => Field> = {
  // Grana fine e uniforme, appena nuvolosa.
  grain: () => {
    const w = white(11), cloud = fbm(8, 3, 12)
    return field((x, y) => w() * 0.32 + cloud(x, y) * 0.10)
  },
  // Cotone: nuvole morbide (la "pasta" della carta) e qualche fibra lunga.
  cotton: () => {
    const w = white(21), cloud = fbm(4, 5, 22, 0.55)
    const f = field((x, y) => cloud(x, y) * 0.22 + w() * 0.10)
    fibers(f, 160, 23, { len: [18, 60], amp: 0.16, dark: 0.55, curl: 0.06 })
    return f
  },
  // Vergata: righe fittissime orizzontali e filoni verticali, come le carte
  // fatte a mano in forma.
  laid: () => {
    const w = white(31), wave = fbm(4, 2, 32), cloud = fbm(6, 4, 33)
    return field((x, y) => {
      const yy = y + wave(x, y) * 1.2
      const lines = Math.cos((yy / 8) * Math.PI * 2) * 0.06
      const cx = ((x + wave(y, x) * 3) % 256 + 256) % 256
      const chain = -0.13 * Math.exp(-((cx - 128) ** 2) / 8)
      return lines + chain + cloud(x, y) * 0.10 + w() * 0.08
    })
  },
  // Pergamena: chiazze calde e irregolari, a più scale.
  parchment: () => {
    const w = white(41), big = fbm(2, 5, 42, 0.6), mid = fbm(12, 3, 43)
    return field((x, y) => {
      const b = big(x, y)
      return b * 0.32 - Math.max(0, -mid(x, y)) * 0.14 + w() * 0.06
    })
  },
  // Acquerello (grana "torchon"): bozzi piccoli e fitti in ogni direzione,
  // luce radente, più una leggera ondulazione della carta.
  watercolor: () => {
    const bumps = fbm(44, 2, 51, 0.4), cockle = fbm(3, 2, 53)
    const w = white(52)
    const f = relief(bumps, 0.75)
    for (let i = 0; i < f.length; i++) f[i] += w() * 0.04 + cockle(i % N, Math.floor(i / N)) * 0.05
    return f
  },
  // Lino: trama di fili sopra e sotto, spessore irregolare lungo il filo.
  linen: () => {
    const w = white(61), slubH = fbm(4, 3, 62), slubV = fbm(4, 3, 63)
    const P = 8
    return field((x, y) => {
      const tx = Math.floor(x / P), ty = Math.floor(y / P)
      const over = (tx + ty) % 2 === 0
      const hp = Math.sin(((y % P) / P) * Math.PI)      // profilo del filo orizzontale
      const vp = Math.sin(((x % P) / P) * Math.PI)      // profilo del filo verticale
      const prof = over ? hp : vp
      // Ingrossamenti lenti lungo il filo (rumore a bassa frequenza, periodico).
      const slub = (over ? slubH(x, ty * P) : slubV(tx * P, y)) * 0.12
      return (prof - 0.62) * 0.30 + slub + w() * 0.06
    })
  },
  // Riciclata: grana, nuvole, macchioline e frammenti di fibre.
  recycled: () => {
    const w = white(71), cloud = fbm(6, 4, 72)
    const f = field((x, y) => cloud(x, y) * 0.14 + w() * 0.14)
    flecks(f, 420, 73, 0.55)
    fibers(f, 260, 74, { len: [6, 22], amp: 0.22, dark: 0.7, curl: 0.15 })
    return f
  },
  // Kraft: fibre corte e fitte, chiare e scure, sopra una pasta nuvolosa.
  kraft: () => {
    const w = white(81), cloud = fbm(4, 4, 82)
    const f = field((x, y) => cloud(x, y) * 0.18 + w() * 0.10)
    fibers(f, 2200, 83, { len: [8, 34], amp: 0.12, dark: 0.55, curl: 0.05 })
    return f
  },
}

/** Rilievo → due tessere: grigi per "moltiplica" (scuro) e per "schermo" (chiaro). */
function toTiles(f: Field): PaperTiles {
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c }
  const dark = mk(), light = mk()
  const dc = dark.getContext('2d')!, lc = light.getContext('2d')!
  const di = dc.createImageData(N, N), li = lc.createImageData(N, N)
  for (let i = 0; i < f.length; i++) {
    const v = Math.max(-1, Math.min(1, f[i]))
    const d = 255 * (1 - Math.max(0, -v) * 0.55)   // moltiplica: 255 = nessun effetto
    const l = 255 * Math.max(0, v) * 0.55           // schermo: 0 = nessun effetto
    const k = i * 4
    di.data[k] = di.data[k + 1] = di.data[k + 2] = d; di.data[k + 3] = 255
    li.data[k] = li.data[k + 1] = li.data[k + 2] = l; li.data[k + 3] = 255
  }
  dc.putImageData(di, 0, 0); lc.putImageData(li, 0, 0)
  return { dark, light }
}
