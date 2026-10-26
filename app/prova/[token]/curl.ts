// ─────────────────────────────────────────────────────────────────────────────
// Motore dello sfoglio "a cilindro" (stile app Libri / UIPageViewController
// .pageCurl), in WebGL. Nessuna libreria esterna.
//
// Geometria. La pagina è una griglia fitta. Data una linea di piega (punto
// `axis`, direzione unitaria `dir` che punta verso il bordo libero), ogni punto
// a distanza d dalla linea:
//   d ≤ 0        resta piatto;
//   0 < d < πR   si avvolge su un cilindro di raggio R (angolo θ = d / R);
//   d ≥ πR       è oltre il cilindro: piatto, capovolto, sollevato di 2R.
// Così la pagina si arrotola come carta vera e il retro si vede capovolto.
//
// Gesto → piega. Il bordo libero afferrato (punto P0 della pagina) deve finire
// sotto il dito (F). Per il cilindro la soluzione è chiusa:
//   dir = (P0 − F)/|P0 − F|,  d0 = (|P0 − F| + πR)/2,  axis = P0 − dir·d0.
// Il dorso (bordo sinistro) non si stacca mai: F è vincolato nei dischi
// centrati negli angoli del dorso, di raggio pari alla loro distanza da P0.
// ─────────────────────────────────────────────────────────────────────────────

export interface Vec { x: number; y: number }

export interface CurlParams {
  axis: Vec
  dir:  Vec
  R:    number
}

/** Piega per portare il punto P0 della pagina sotto il dito F. */
export function solveCurl(P0: Vec, F: Vec, W: number): CurlParams | null {
  const dx = P0.x - F.x, dy = P0.y - F.y
  const dist = Math.hypot(dx, dy)
  if (dist < 0.5) return null
  // Raggio: piccolo all'inizio e alla fine, più ampio a metà gesto (come iOS).
  const t = Math.max(0, Math.min(1, dist / (2 * W)))
  const R = W * (0.028 + 0.105 * Math.sin(Math.PI * t))
  const dir = { x: dx / dist, y: dy / dist }
  const d0 = (dist + Math.PI * R) / 2
  return { axis: { x: P0.x - dir.x * d0, y: P0.y - dir.y * d0 }, dir, R }
}

/** Vincolo del dorso: il dito non può portare la pagina dove si strapperebbe. */
export function constrain(P0: Vec, F: Vec, H: number): Vec {
  let f = { ...F }
  const corners = [{ x: 0, y: 0 }, { x: 0, y: H }]
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
uniform vec2  uSize;
uniform float uCurl;      // 1 = pagina che si sfoglia, 0 = pagina sotto (piatta)
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
  vec2 p = aPos * uSize;
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
  vec2 ndc = vec2(pos.x / uSize.x * 2.0 - 1.0, 1.0 - pos.y / uSize.y * 2.0);
  float w = 1.0 - pos.z * uPersp;
  float depth = -pos.z / uSize.x - uCurl * 0.0005;
  gl_Position = vec4(ndc, depth * w, w);
}`

const FS = `
precision highp float;
uniform sampler2D uTex;
uniform vec2  uSize;
uniform float uCurl;
uniform float uActive;    // intensità delle ombre (0 = nessuna piega)
uniform vec2  uAxis;
uniform vec2  uDir;
uniform float uR;
uniform vec3  uPaper;
varying vec2  vUV;
varying vec2  vP;
varying vec3  vN;
varying float vD;
const float PI = 3.14159265;

// Distanza di un punto dal rettangolo pagina (0 se dentro).
float outside(vec2 q) {
  vec2 o = max(vec2(0.0), max(-q, q - uSize));
  return length(o);
}

void main() {
  vec3 N = normalize(vN);
  vec3 L = normalize(vec3(-0.30, -0.55, 1.0));   // luce dall'alto a sinistra
  vec3 V = vec3(0.0, 0.0, 1.0);
  float flatDiff = dot(V, L);
  vec4 tex = texture2D(uTex, vUV);
  vec3 col;

  if (N.z >= 0.0) {
    // Fronte: luce diffusa relativa alla pagina piatta + riflesso sulla curva.
    float diff = clamp(dot(N, L), 0.0, 1.0) / flatDiff;
    float shade = mix(0.72, 1.0, clamp(diff, 0.0, 1.06));
    vec3 H = normalize(L + V);
    float spec = pow(clamp(dot(N, H), 0.0, 1.0), 48.0) * 0.18 * step(0.001, 1.0 - N.z);
    col = tex.rgb * shade + spec;
  } else {
    // Retro: carta con il testo che traspare (specchiato) in controluce.
    vec3 back = mix(uPaper, tex.rgb, 0.06);
    vec3 Nb = -N;
    float diff = clamp(dot(Nb, L), 0.0, 1.0) / flatDiff;
    float shade = mix(0.70, 1.0, clamp(diff, 0.0, 1.04));
    // Interno della curva più scuro vicino alla piega.
    float inner = (uCurl > 0.5 && vD > 0.0 && vD < PI * uR) ? 0.10 * sin(vD / uR) : 0.0;
    col = back * (shade - inner);
  }

  // Ombra leggerissima lungo il dorso (bordo sinistro), come un libro aperto.
  if (N.z >= 0.0) col *= 1.0 - 0.07 * exp(-vP.x / (uSize.x * 0.025));

  if (uActive > 0.001) {
    if (uCurl < 0.5) {
      // Pagina sotto: ombra del rotolo, densa vicino alla curva e sfumata.
      float d = dot(vP - uAxis, uDir);
      float s = d - uR;
      // Due componenti: contatto (stretta, scura) + penombra (morbida, leggera).
      float sp = max(s, 0.0);
      float k = 0.30 * exp(-sp / (uR * 0.22 + 2.0)) + 0.16 * exp(-sp / (uR * 0.9 + 6.0));
      col *= 1.0 - uActive * k * smoothstep(-uR, 0.0, s);
    } else if (vD <= 0.0) {
      // Parte piatta della pagina che gira: ombra del lembo capovolto sospeso.
      float dq = vD;
      vec2 src = vP + uDir * (PI * uR - 2.0 * dq);
      float o = outside(src);
      if (o > 0.0) col *= 1.0 - 0.16 * uActive * exp(-o / (0.55 * uR + 2.0));
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`

// ── Renderer ─────────────────────────────────────────────────────────────────

export interface Frame {
  front:  WebGLTexture
  bottom: WebGLTexture | null
  curl:   CurlParams | null
  /** 0..1: le ombre si dissolvono all'inizio e alla fine dello sfoglio. */
  shadow: number
}

export class CurlRenderer {
  readonly gl: WebGLRenderingContext
  private prog: WebGLProgram
  private buf: WebGLBuffer
  private ibuf: WebGLBuffer
  private count = 0
  private u: Record<string, WebGLUniformLocation | null> = {}
  private w = 1
  private h = 1
  private paper: [number, number, number]

  constructor(canvas: HTMLCanvasElement, paperHex: string) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, depth: true, premultipliedAlpha: false, powerPreference: 'high-performance' })
    if (!gl) throw new Error('WebGL non disponibile')
    this.gl = gl
    this.paper = hexToRgb(paperHex)
    this.prog = link(gl, VS, FS)
    for (const n of ['uSize', 'uCurl', 'uActive', 'uAxis', 'uDir', 'uR', 'uPersp', 'uTex', 'uPaper']) {
      this.u[n] = gl.getUniformLocation(this.prog, n)
    }
    this.buf = gl.createBuffer()!
    this.ibuf = gl.createBuffer()!
    this.buildMesh()
  }

  /** Griglia fitta: abbastanza punti per un cilindro liscio a qualunque angolo. */
  private buildMesh() {
    const gl = this.gl
    const cols = 64, rows = 112
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

  get maxTexture(): number { return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number }

  resize(wCss: number, hCss: number, pxW: number, pxH: number) {
    this.w = wCss; this.h = hCss
    this.gl.viewport(0, 0, pxW, pxH)
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

  render(f: Frame) {
    const gl = this.gl
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
    gl.uniform2f(this.u.uSize, this.w, this.h)
    gl.uniform1f(this.u.uPersp, 1 / (this.w * 4.2))
    gl.uniform3f(this.u.uPaper, this.paper[0], this.paper[1], this.paper[2])
    gl.uniform1i(this.u.uTex, 0)
    gl.activeTexture(gl.TEXTURE0)

    const c = f.curl
    const active = c ? Math.max(0, Math.min(1, f.shadow)) : 0
    gl.uniform1f(this.u.uActive, active)
    gl.uniform2f(this.u.uAxis, c ? c.axis.x : this.w * 10, c ? c.axis.y : 0)
    gl.uniform2f(this.u.uDir, c ? c.dir.x : 1, c ? c.dir.y : 0)
    gl.uniform1f(this.u.uR, c ? c.R : 1)

    if (c && f.bottom) {
      gl.uniform1f(this.u.uCurl, 0)
      gl.bindTexture(gl.TEXTURE_2D, f.bottom)
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0)
    }
    gl.uniform1f(this.u.uCurl, 1)
    gl.bindTexture(gl.TEXTURE_2D, f.front)
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0)
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
