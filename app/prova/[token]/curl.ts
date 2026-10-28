// ─────────────────────────────────────────────────────────────────────────────
// Motore dello sfoglio "a cilindro" (stile app Libri / UIPageViewController
// .pageCurl), in WebGL. Nessuna libreria esterna.
//
// Geometria. Un foglio è una griglia fitta, attaccata al dorso sul suo bordo
// sinistro. Data una linea di piega (punto `axis`, direzione unitaria `dir`
// verso il bordo libero), ogni punto a distanza d dalla linea:
//   d ≤ 0        resta piatto;
//   0 < d < πR   si avvolge su un cilindro di raggio R (angolo θ = d / R);
//   d ≥ πR       è oltre il cilindro: piatto, capovolto, sollevato di 2R.
//
// Gesto → piega. Il punto afferrato del bordo libero (P0) deve finire sotto il
// dito (F). Soluzione chiusa:
//   dir = (P0 − F)/|P0 − F|,  d0 = (|P0 − F| + πR)/2,  axis = P0 − dir·d0.
// Il dorso non si stacca mai: F è vincolato nei dischi centrati negli angoli
// del dorso, di raggio pari alla loro distanza da P0.
//
// Tutte le coordinate sono in pixel CSS dello schermo.
// ─────────────────────────────────────────────────────────────────────────────

import { LiquidGlass, type GlassParams, type GlassRect } from './liquidGlass'

export interface Vec { x: number; y: number }

export interface CurlParams {
  axis: Vec
  dir:  Vec
  R:    number
}

/**
 * Piega che porta il punto P0 del foglio sotto il dito F.
 * pageW = larghezza del foglio (dal dorso al bordo libero).
 */
export function solveCurl(P0: Vec, F: Vec, pageW: number): CurlParams | null {
  const dx = P0.x - F.x, dy = P0.y - F.y
  const raw = Math.hypot(dx, dy)
  if (raw < 0.5) return null
  // Direzione stabile: con pochi pixel di gesto la componente verticale è solo
  // tremolio del dito → viene smorzata finché il gesto non è abbastanza lungo.
  // Senza questo la piega ruota a scatti a inizio sfoglio (sfarfallio).
  const settle = Math.min(1, raw / (pageW * 0.22))
  const vx = dx, vy = dy * settle * settle
  const len = Math.hypot(vx, vy)
  const dir = len > 0 ? { x: vx / len, y: vy / len } : { x: 1, y: 0 }
  const dist = dx * dir.x + dy * dir.y
  // Raggio: morbido a metà gesto, mai sottile rispetto alla griglia (un
  // cilindro troppo stretto crea triangoli stirati a cavallo della piega).
  // Ai due capi (foglio appena sollevato / appena posato dall'altra parte) il
  // rotolo si chiude fino a zero, come la carta vera legata al dorso: così il
  // foglio arriva piatto, senza curva scura vicino al dorso che poi sparisce
  // di colpo quando la pagina si ferma. Vale durante il gesto, non solo
  // nell'animazione: chi tiene il foglio quasi posato lo vede già disteso.
  const t = Math.max(0, Math.min(1, dist / (2 * pageW)))
  const lift = Math.sin(Math.min(1, t / 0.08) * Math.PI / 2)
  const u = Math.min(1, (1 - t) / 0.25)
  const land = u * u * (3 - 2 * u)
  // Mai esattamente 0: lo shader usa R in smoothstep e divisioni.
  const R = Math.max(0.25, pageW * (0.055 + 0.085 * Math.sin(Math.PI * t)) * lift * land)
  const d0 = (dist + Math.PI * R) / 2
  return { axis: { x: P0.x - dir.x * d0, y: P0.y - dir.y * d0 }, dir, R }
}

/** Vincolo del dorso (bordo verticale x = spineX, alto H). */
export function constrain(P0: Vec, F: Vec, spineX: number, H: number): Vec {
  let f = { ...F }
  const corners = [{ x: spineX, y: 0 }, { x: spineX, y: H }]
  for (let k = 0; k < 3; k++) {
    for (const c of corners) {
      const r = Math.hypot(P0.x - c.x, P0.y - c.y)
      const vx = f.x - c.x, vy = f.y - c.y
      const d = Math.hypot(vx, vy)
      if (d > r && d > 0) f = { x: c.x + (vx * r) / d, y: c.y + (vy * r) / d }
    }
  }
  return f
}

// ── Shader ───────────────────────────────────────────────────────────────────

const VS = `
attribute vec2 aPos;
uniform vec2  uScreen;    // dimensioni dello schermo
uniform vec2  uOrigin;    // angolo in alto a sinistra del foglio
uniform vec2  uPage;      // dimensioni del foglio
uniform float uCurl;      // 1 = foglio che si sfoglia
uniform vec2  uAxis;
uniform vec2  uDir;
uniform float uR;
uniform float uPersp;
varying vec2  vUV;
varying vec2  vP;
varying vec3  vN;
varying float vD;
const float PI = 3.14159265;
void main() {
  vec2 p = uOrigin + aPos * uPage;
  vec3 pos = vec3(p, 0.0);
  vec3 n = vec3(0.0, 0.0, 1.0);
  float d = dot(p - uAxis, uDir);
  if (uCurl > 0.5 && d > 0.0) {
    vec2 base = p - uDir * d;
    float pr = PI * uR;
    if (d < pr) {
      float th = d / uR;
      pos = vec3(base + uDir * (uR * sin(th)), uR * (1.0 - cos(th)));
      n = vec3(-uDir * sin(th), cos(th));
    } else {
      pos = vec3(base - uDir * (d - pr), 2.0 * uR);
      n = vec3(0.0, 0.0, -1.0);
    }
  }
  vUV = aPos; vP = p; vN = n; vD = d;
  vec2 ndc = vec2(pos.x / uScreen.x * 2.0 - 1.0, 1.0 - pos.y / uScreen.y * 2.0);
  float w = 1.0 - pos.z * uPersp;
  float depth = -pos.z / uScreen.x - uCurl * 0.0005;
  gl_Position = vec4(ndc, depth * w, w);
}`

const FS = `
precision highp float;
uniform sampler2D uTex;
uniform sampler2D uBack;
uniform float uHasBack;   // il retro del foglio ha una pagina vera (doppia pagina)
uniform float uThrough;   // quanto il testo del fronte traspare dal retro (0 – 0.4)
uniform vec2  uPage;
uniform float uCurl;
uniform float uShadow;    // intensità delle ombre (0 = nessuna piega)
uniform float uKind;      // pagina ferma: 1 = scoperta dal rotolo, 2 = sotto il lembo
uniform vec2  uAxis;
uniform vec2  uDir;
uniform float uR;
uniform vec2  uSheetO;    // foglio che si sfoglia: origine e dimensioni
uniform vec2  uSheetS;
uniform float uGutter;    // ombra del dorso: 0 bordo sinistro, 1 bordo destro
uniform float uGutterK;   // intensità ombra del dorso
uniform vec3  uPaper;
uniform sampler2D uVid;   // video sotto la pagina (pagine foto/video)
uniform float uHasVid;
uniform vec4  uVidMap;    // uv del foglio → uv del video (ritaglio "cover")
varying vec2  vUV;
varying vec2  vP;
varying vec3  vN;
varying float vD;
const float PI = 3.14159265;

// Fronte della pagina: con un video, la pagina (testi e sfumature) sta sopra
// il video dove è opaca.
vec3 frontColor(vec4 tex) {
  if (uHasVid < 0.5) return tex.rgb;
  vec3 v = texture2D(uVid, vUV * uVidMap.xy + uVidMap.zw).rgb;
  return mix(v, tex.rgb, tex.a);
}

// Distanza dal foglio che si sfoglia (0 se dentro).
float outsideSheet(vec2 q) {
  vec2 r = q - uSheetO;
  vec2 o = max(vec2(0.0), max(-r, r - uSheetS));
  return length(o);
}

// Ombra del lembo capovolto sospeso sopra il punto q (pagina piatta sotto).
float flapShadow(vec2 q) {
  float dq = dot(q - uAxis, uDir);
  if (dq > 0.0) return 1.0;
  vec2 src = q + uDir * (PI * uR - 2.0 * dq);
  // Dentro l'impronta del lembo l'ombra è piena (lì sopra c'è il lembo; dove
  // la prospettiva lo sposta un filo, si vede ombra e non una "copia" chiara
  // dell'angolo). Fuori sfuma con la distanza.
  float o = outsideSheet(src);
  return 1.0 - 0.16 * uShadow * exp(-o / (0.55 * uR + 2.0));
}

void main() {
  vec3 N = normalize(vN);
  vec3 L = normalize(vec3(-0.30, -0.55, 1.0));   // luce dall'alto a sinistra
  vec3 V = vec3(0.0, 0.0, 1.0);
  float flatDiff = dot(V, L);
  vec4 tex = texture2D(uTex, vUV);
  vec3 col;
  bool front = N.z >= 0.0;

  if (front) {
    float diff = clamp(dot(N, L), 0.0, 1.0) / flatDiff;
    float shade = mix(0.74, 1.0, clamp(diff, 0.0, 1.05));
    vec3 Hh = normalize(L + V);
    float spec = pow(clamp(dot(N, Hh), 0.0, 1.0), 40.0) * 0.10 * smoothstep(0.0, 0.25, 1.0 - N.z);
    col = frontColor(tex) * shade + spec;
  } else {
    // Retro: pagina vera (doppia pagina) o carta. Il testo del fronte
    // traspare a specchio, come nella carta vera: scurisce il retro dove sul
    // fronte c'è inchiostro (quanto, lo sceglie il ristoratore).
    vec3 base = uHasBack > 0.5 ? texture2D(uBack, vec2(1.0 - vUV.x, vUV.y)).rgb : uPaper;
    vec3 ink = clamp(frontColor(tex) / max(uPaper, vec3(0.04)), 0.0, 1.5);
    vec3 back = base * mix(vec3(1.0), ink, uThrough);
    vec3 Nb = -N;
    float diff = clamp(dot(Nb, L), 0.0, 1.0) / flatDiff;
    float shade = mix(0.72, 1.0, clamp(diff, 0.0, 1.04));
    float inner = (uCurl > 0.5 && vD > 0.0 && vD < PI * uR) ? 0.08 * sin(vD / uR) : 0.0;
    col = back * (shade - inner);
  }

  // Ombra del dorso: misurata sul foglio (vale su entrambe le facce).
  float g = uGutter < 0.5 ? vUV.x : 1.0 - vUV.x;
  col *= 1.0 - uGutterK * exp(-g * uPage.x / (uPage.x * 0.035 + 1.0));

  if (uShadow > 0.001) {
    if (uCurl < 0.5 && uKind > 0.5 && uKind < 1.5) {
      // Pagina scoperta: ombra del rotolo, contatto stretto + penombra.
      float d = dot(vP - uAxis, uDir);
      float s = d - uR;
      float sp = max(s, 0.0);
      float k = 0.30 * exp(-sp / (uR * 0.22 + 2.0)) + 0.16 * exp(-sp / (uR * 0.9 + 6.0));
      col *= 1.0 - uShadow * k * smoothstep(-uR, 0.0, s);
    } else if (uCurl < 0.5 && uKind > 1.5) {
      col *= flapShadow(vP);
    } else if (uCurl > 0.5 && vD <= 0.0) {
      col *= flapShadow(vP);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`

// ── Renderer ─────────────────────────────────────────────────────────────────

export interface Rect { x: number; y: number; w: number; h: number }

export interface Sheet {
  rect:    Rect
  front:   WebGLTexture
  /** Retro del foglio (solo doppia pagina): la pagina che appare girandolo. */
  back?:   WebGLTexture | null
  /** Pagine ferme: 1 = viene scoperta dal rotolo, 2 = il lembo ci passa sopra. */
  kind?:   0 | 1 | 2
  /** Bordo del dorso del foglio. */
  gutter:  'left' | 'right'
  gutterK: number
  /** Video sotto la pagina (pagina foto/video "dal vivo"): texture e
   *  mappa uv del foglio → uv del video [sx, sy, ox, oy]. */
  video?:  { tex: WebGLTexture; map: [number, number, number, number] } | null
}

export interface Scene {
  statics: Sheet[]
  moving:  (Sheet & { curl: CurlParams | null }) | null
  shadow:  number
  /** Testo che traspare dal retro del foglio che gira (0 – 0.4). */
  through?: number
}

export class CurlRenderer {
  readonly gl: WebGLRenderingContext
  /** WebGL2 (se c'è): permette il vetro liquido sopra la scena. */
  private gl2: WebGL2RenderingContext | null
  private glass: LiquidGlass | null = null
  private glassRects: GlassRect[] = []
  private glassLook: GlassParams | null = null
  // Lastra della scena (multicampione per i bordi lisci, poi risolta in una
  // texture con mipmap che il vetro legge, sfoca e piega).
  private fb: { msaa: WebGLFramebuffer; color: WebGLRenderbuffer; depth: WebGLRenderbuffer; resolve: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number } | null = null
  private fbValid = false
  private last: Scene | null = null
  private pxW = 1
  private pxH = 1
  private paperHex: string
  private prog: WebGLProgram
  private buf: WebGLBuffer
  private ibuf: WebGLBuffer
  private count = 0
  private u: Record<string, WebGLUniformLocation | null> = {}
  private sw = 1
  private sh = 1
  private paper: [number, number, number]
  private blank: WebGLTexture | null = null

  constructor(canvas: HTMLCanvasElement, paperHex: string) {
    const attrs = { antialias: true, alpha: false, depth: true, premultipliedAlpha: false, powerPreference: 'high-performance' as const }
    // WebGL2 se c'è (gli shader WebGL1 funzionano uguale), altrimenti WebGL1.
    const gl2 = canvas.getContext('webgl2', attrs) as WebGL2RenderingContext | null
    const gl = (gl2 ?? canvas.getContext('webgl', attrs)) as WebGLRenderingContext | null
    if (!gl) throw new Error('WebGL non disponibile')
    this.gl = gl as WebGLRenderingContext
    this.gl2 = gl2
    if (gl2) { try { this.glass = new LiquidGlass(gl2) } catch { this.glass = null } }
    this.paperHex = paperHex
    this.paper = hexToRgb(paperHex)
    this.prog = link(gl, VS, FS)
    for (const n of ['uScreen', 'uOrigin', 'uPage', 'uCurl', 'uAxis', 'uDir', 'uR', 'uPersp', 'uTex', 'uBack', 'uHasBack',
      'uShadow', 'uThrough', 'uKind', 'uSheetO', 'uSheetS', 'uGutter', 'uGutterK', 'uPaper', 'uVid', 'uHasVid', 'uVidMap']) {
      this.u[n] = gl.getUniformLocation(this.prog, n)
    }
    this.buf = gl.createBuffer()!
    this.ibuf = gl.createBuffer()!
    this.buildMesh()
  }

  /** Griglia fitta (maglie di 2–4 px): il cilindro resta liscio a ogni angolo. */
  private buildMesh() {
    const gl = this.gl
    const cols = 110, rows = 190
    const v = new Float32Array((cols + 1) * (rows + 1) * 2)
    let k = 0
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { v[k++] = i / cols; v[k++] = j / rows }
    const idx = new Uint16Array(cols * rows * 6)
    k = 0
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1
      idx[k++] = a; idx[k++] = c; idx[k++] = b
      idx[k++] = b; idx[k++] = c; idx[k++] = d
    }
    this.count = idx.length
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibuf)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW)
  }

  /** Colore della carta (fondo e retro dei fogli) quando cambia lo stile. */
  setPaper(hex: string) { this.paper = hexToRgb(hex); this.paperHex = hex }

  /** Il vetro liquido è disponibile (WebGL2). */
  get liquid(): boolean { return !!this.glass }

  /** Elementi in vetro sopra il menu e aspetto del vetro. */
  setGlass(rects: GlassRect[], look: GlassParams) { this.glassRects = rects; this.glassLook = look }

  /** Ridisegna solo il vetro sopra l'ultima scena (i comandi si muovono, la
   *  pagina no). Se il vetro sparisce, torna al disegno diretto. */
  composite() {
    if (!this.glass || !this.last) return
    if (!this.glassRects.length) { this.render(this.last); return }
    if (!this.fbValid) { this.drawToFb(this.last) }
    this.drawGlass()
  }

  get maxTexture(): number { return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number }

  resize(wCss: number, hCss: number, pxW: number, pxH: number) {
    this.sw = wCss; this.sh = hCss
    this.pxW = pxW; this.pxH = pxH
    this.fbValid = false
    this.gl.viewport(0, 0, pxW, pxH)
  }

  private ensureFb() {
    const gl = this.gl2!
    if (this.fb && this.fb.w === this.pxW && this.fb.h === this.pxH) return this.fb
    if (this.fb) {
      gl.deleteFramebuffer(this.fb.msaa); gl.deleteFramebuffer(this.fb.resolve)
      gl.deleteRenderbuffer(this.fb.color); gl.deleteRenderbuffer(this.fb.depth); gl.deleteTexture(this.fb.tex)
    }
    const w = this.pxW, h = this.pxH
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) as number)
    const color = gl.createRenderbuffer()!
    gl.bindRenderbuffer(gl.RENDERBUFFER, color)
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h)
    const depth = gl.createRenderbuffer()!
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth)
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h)
    const msaa = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, msaa)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth)
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const resolve = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, resolve)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.fb = { msaa, color, depth, resolve, tex, w, h }
    return this.fb
  }

  /** Scena nella lastra, risolta nella texture con mipmap. */
  private drawToFb(scene: Scene) {
    const gl = this.gl2!
    const fb = this.ensureFb()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb.msaa)
    this.drawScene(scene)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb.msaa)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fb.resolve)
    gl.blitFramebuffer(0, 0, fb.w, fb.h, 0, 0, fb.w, fb.h, gl.COLOR_BUFFER_BIT, gl.NEAREST)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, fb.tex)
    gl.generateMipmap(gl.TEXTURE_2D)
    this.fbValid = true
  }

  private drawGlass() {
    if (!this.glass || !this.fb || !this.glassLook) return
    this.glass.render({
      width: this.sw, height: this.sh, base: this.paperHex,
      layers: [{ texture: { tex: this.fb.tex, w: this.fb.w, h: this.fb.h }, alpha: 1, scale: 1, cover: false, dynamic: false }],
      veil: 0, blur: 0, rects: this.glassRects, glass: this.glassLook,
    }, this.pxW / this.sw)
  }

  createTexture(source: HTMLCanvasElement): WebGLTexture {
    const gl = this.gl
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }

  deleteTexture(t: WebGLTexture) { this.gl.deleteTexture(t) }

  /** Texture per un video (aggiornata a ogni fotogramma con updateVideo). */
  createVideoTexture(): WebGLTexture {
    const gl = this.gl
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([22, 18, 14, 255]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }

  /** Fotogramma attuale del video nella sua texture (false se non si può). */
  updateVideo(t: WebGLTexture, video: HTMLVideoElement): boolean {
    const gl = this.gl
    if (video.readyState < 2 || !video.videoWidth) return false
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video) } catch { return false }
    return true
  }

  render(scene: Scene) {
    this.last = scene
    // Con elementi in vetro sullo schermo: scena nella lastra, poi il vetro.
    if (this.glass && this.glassRects.length && this.glassLook) {
      this.drawToFb(scene)
      this.drawGlass()
      return
    }
    this.fbValid = false
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.drawScene(scene)
  }

  private drawScene(scene: Scene) {
    const gl = this.gl
    gl.viewport(0, 0, this.pxW, this.pxH)
    gl.clearColor(this.paper[0], this.paper[1], this.paper[2], 1)
    gl.clearDepth(1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.disable(gl.CULL_FACE)
    gl.useProgram(this.prog)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibuf)
    const loc = gl.getAttribLocation(this.prog, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    gl.uniform2f(this.u.uScreen, this.sw, this.sh)
    gl.uniform1f(this.u.uPersp, 1 / (Math.max(this.sw, this.sh) * 4.2))
    gl.uniform3f(this.u.uPaper, this.paper[0], this.paper[1], this.paper[2])
    gl.uniform1i(this.u.uTex, 0)
    gl.uniform1i(this.u.uBack, 1)
    gl.uniform1i(this.u.uVid, 2)

    const m = scene.moving
    const c = m?.curl ?? null
    const shadow = c ? Math.max(0, Math.min(1.6, scene.shadow)) : 0
    gl.uniform1f(this.u.uShadow, shadow)
    gl.uniform1f(this.u.uThrough, Math.max(0, Math.min(0.4, scene.through ?? 0.03)))
    gl.uniform2f(this.u.uAxis, c ? c.axis.x : this.sw * 10, c ? c.axis.y : 0)
    gl.uniform2f(this.u.uDir, c ? c.dir.x : 1, c ? c.dir.y : 0)
    gl.uniform1f(this.u.uR, c ? c.R : 1)
    gl.uniform2f(this.u.uSheetO, m ? m.rect.x : 0, m ? m.rect.y : 0)
    gl.uniform2f(this.u.uSheetS, m ? m.rect.w : 0, m ? m.rect.h : 0)

    const drawSheet = (s: Sheet, curl: boolean) => {
      gl.uniform2f(this.u.uOrigin, s.rect.x, s.rect.y)
      gl.uniform2f(this.u.uPage, s.rect.w, s.rect.h)
      gl.uniform1f(this.u.uCurl, curl ? 1 : 0)
      gl.uniform1f(this.u.uKind, s.kind ?? 0)
      gl.uniform1f(this.u.uGutter, s.gutter === 'left' ? 0 : 1)
      gl.uniform1f(this.u.uGutterK, s.gutterK)
      gl.uniform1f(this.u.uHasBack, s.back ? 1 : 0)
      gl.uniform1f(this.u.uHasVid, s.video ? 1 : 0)
      if (s.video) gl.uniform4f(this.u.uVidMap, ...s.video.map)
      gl.activeTexture(gl.TEXTURE2)
      gl.bindTexture(gl.TEXTURE_2D, s.video?.tex ?? s.front)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, s.back ?? s.front)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, s.front)
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0)
    }
    for (const s of scene.statics) drawSheet(s, false)
    if (m) drawSheet(m, !!c)
  }
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
  return s
}

function link(gl: WebGLRenderingContext, vs: string, fs: string) {
  const p = gl.createProgram()!
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'program')
  return p
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
