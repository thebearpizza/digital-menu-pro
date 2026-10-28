// ─────────────────────────────────────────────────────────────────────────────
// Vetro "liquido" per i pulsanti della pagina d'apertura (WebGL2).
//
// Il vetro dei browser (backdrop-filter) sa solo sfocare e velare: niente
// rifrazione, e Safari non permette di aggiungerla. Qui lo sfondo (foto,
// video o carta) viene disegnato in WebGL e i pulsanti sono lenti vere,
// calcolate pixel per pixel su una forma arrotondata:
//  • rifrazione: nel bordo (lo "spessore" della lente) lo sfondo si piega e
//    si comprime come attraverso un vetro curvo; il centro resta piatto;
//  • sfocatura (vetro smerigliato) per strati di mipmap più campioni;
//  • dispersione: rosso e blu si separano un poco dove il vetro piega;
//  • colore del vetro, luminosità, saturazione;
//  • luce: riflesso sul bordo rivolto verso la luce, ombra sul lato opposto,
//    filo di luce sottile sul contorno, lucentezza in alto;
//  • ombra morbida sotto il pulsante; alla pressione la lente si gonfia.
// Il testo dei pulsanti resta HTML, sopra.
// ─────────────────────────────────────────────────────────────────────────────

export interface GlassParams {
  frost:      number   // 0 – 1
  refraction: number   // 0 – 1
  bezel:      number   // 0 – 1 (spessore del bordo che piega, rispetto alla mezza altezza)
  dispersion: number   // 0 – 1
  tint:       string   // #rrggbb
  tintAmount: number   // 0 – 1
  brightness: number   // -1 – 1
  saturation: number   // 0 – 2
  highlight:  number   // 0 – 1
  lightAngle: number   // gradi, da dove arriva la luce (135 = in alto a sinistra)
  shadow:     number   // 0 – 1
}

/** Uno strato dello sfondo (al massimo due, per le dissolvenze). */
export interface BgLayer {
  source?: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  /** In alternativa: una texture già pronta nello stesso contesto (la scena
   *  del menu disegnata dal motore del giro pagina), capovolta come le
   *  texture di framebuffer. */
  texture?: { tex: WebGLTexture; w: number; h: number }
  alpha:   number
  /** Ingrandimento oltre al riempimento (zoom lento, sfocatura). */
  scale:   number
  /** true = riempie lo schermo ritagliando (object-fit: cover); false = già a misura di schermo. */
  cover:   boolean
  /** Cambia nel tempo (video): si ricarica a ogni fotogramma. */
  dynamic: boolean
  /** Per le tele: numero che cambia quando vanno ricaricate. */
  version?: number
}

/** panel = 1: pannello (menu a tendina) — più smerigliato e velato, per
 *  leggere bene il testo che ci sta sopra. */
export interface GlassRect { x: number; y: number; w: number; h: number; radius: number; alpha: number; press: number; panel?: number }

export interface GlassFrame {
  width:  number             // px CSS
  height: number
  base:   string             // colore sotto gli strati
  layers: BgLayer[]
  /** Velo scuro sopra foto/video (0 – 0.9), come la pagina HTML. */
  veil:   number
  /** Sfocatura dello sfondo (px). */
  blur:   number
  rects:  GlassRect[]
  glass:  GlassParams
}

const MAX_RECTS = 12

const VS = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`

const FS = `#version 300 es
precision highp float;
uniform vec2  uSize;
uniform float uDpr;
uniform vec3  uBase;
uniform sampler2D uTex0;
uniform sampler2D uTex1;
uniform vec4  uMap0;
uniform vec4  uMap1;
uniform float uA0;
uniform float uA1;
uniform float uTexel0;
uniform float uTexel1;
uniform vec4  uVeil;      // alfa del velo a 0%, 32%, 52%, 100% dell'altezza
uniform float uBgBlur;
uniform int   uN;
uniform vec4  uRect[${MAX_RECTS}];
uniform vec4  uShape[${MAX_RECTS}];   // raggio, alfa, pressione, pannello
uniform float uFrost;
uniform float uRefract;
uniform float uBezel;
uniform float uDisp;
uniform float uBright;
uniform float uSat;
uniform float uHigh;
uniform float uShadow;
uniform vec3  uTint;
uniform float uTintA;
uniform vec2  uLight;     // direzione verso la luce
uniform float uClear;     // 1 = fuori dalle lenti trasparente (tela sopra l'HTML)
out vec4 outColor;

float layerLod(float r, float texel) { return r > 0.5 ? log2(max(1.0, r * texel)) : 0.0; }

vec3 sampleLayer(sampler2D tex, vec4 map, vec2 p, float r, float texel) {
  vec2 uv = p * map.xy + map.zw;
  if (r <= 0.5) return textureLod(tex, uv, 0.0).rgb;
  float lod = layerLod(r, texel);
  vec2 s = map.xy * r * 0.7;
  vec3 c = textureLod(tex, uv, lod).rgb * 2.0;
  c += textureLod(tex, uv + vec2( s.x, 0.0), lod).rgb;
  c += textureLod(tex, uv + vec2(-s.x, 0.0), lod).rgb;
  c += textureLod(tex, uv + vec2(0.0,  s.y), lod).rgb;
  c += textureLod(tex, uv + vec2(0.0, -s.y), lod).rgb;
  c += textureLod(tex, uv + vec2( s.x,  s.y) * 0.7071, lod).rgb;
  c += textureLod(tex, uv + vec2(-s.x,  s.y) * 0.7071, lod).rgb;
  c += textureLod(tex, uv + vec2( s.x, -s.y) * 0.7071, lod).rgb;
  c += textureLod(tex, uv + vec2(-s.x, -s.y) * 0.7071, lod).rgb;
  return c / 10.0;
}

vec3 bgAt(vec2 p, float r) {
  vec3 c = uBase;
  if (uA0 > 0.0) c = mix(c, sampleLayer(uTex0, uMap0, p, r, uTexel0), uA0);
  if (uA1 > 0.0) c = mix(c, sampleLayer(uTex1, uMap1, p, r, uTexel1), uA1);
  float y = clamp(p.y / uSize.y, 0.0, 1.0);
  float v = y < 0.32 ? mix(uVeil.x, uVeil.y, y / 0.32)
          : y < 0.52 ? mix(uVeil.y, uVeil.z, (y - 0.32) / 0.20)
          : mix(uVeil.z, uVeil.w, (y - 0.52) / 0.48);
  return c * (1.0 - v);
}

float sdBox(vec2 p, vec4 r, float rad) {
  vec2 hs = r.zw * 0.5;
  vec2 q = abs(p - (r.xy + hs)) - hs + rad;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr;
  vec3 col = bgAt(p, uBgBlur);

  // Lente più vicina e ombre sotto i pulsanti.
  float best = 1e9;
  int bi = -1;
  float shade = 0.0;
  for (int i = 0; i < ${MAX_RECTS}; i++) {
    if (i >= uN) break;
    vec4 r = uRect[i];
    vec4 s = uShape[i];
    float rad = min(s.x, min(r.z, r.w) * 0.5);
    float d = sdBox(p, r, rad);
    if (d < best) { best = d; bi = i; }
    float ds = sdBox(p - vec2(0.0, 5.0 + 3.0 * s.z), r, rad);
    shade = max(shade, (1.0 - smoothstep(-8.0, 22.0, ds)) * s.y);
  }
  float sa = best > 0.0 ? 0.38 * uShadow * shade : 0.0;
  vec3 lens = vec3(0.0);
  float la = 0.0;

  if (bi >= 0 && best < 1.0) {
    vec4 r = uRect[0];
    vec4 s = uShape[0];
    for (int i = 0; i < ${MAX_RECTS}; i++) { if (i == bi) { r = uRect[i]; s = uShape[i]; } }
    vec2 hs = r.zw * 0.5;
    float rad = min(s.x, min(hs.x, hs.y));
    float d = best;
    float e = 0.75;
    vec2 n = vec2(sdBox(p + vec2(e, 0.0), r, rad) - sdBox(p - vec2(e, 0.0), r, rad),
                  sdBox(p + vec2(0.0, e), r, rad) - sdBox(p - vec2(0.0, e), r, rad));
    n = n / max(length(n), 1e-4);
    float press = s.z;
    // Bordo che piega: t = 1 sul contorno, 0 dove il vetro torna piatto.
    float bz = max(2.0, uBezel * min(hs.x, hs.y) * (1.0 + 0.25 * press));
    float t = clamp(1.0 + d / bz, 0.0, 1.0);
    float k = uRefract * (1.0 + 0.6 * press);
    float bend = pow(t, 2.4) * bz * 1.1 * k;
    vec2 q = p + n * bend;                       // lo sfondo arriva da fuori: compresso nel bordo
    float fr = max(uFrost, 0.7 * s.w) * 16.0 + press * 2.0;
    float ds = uDisp * 0.35;
    vec3 g;
    g.r = bgAt(q + n * bend * ds, fr).r;
    g.g = bgAt(q, fr).g;
    g.b = bgAt(q - n * bend * ds, fr).b;
    float l = dot(g, vec3(0.2126, 0.7152, 0.0722));
    g = mix(vec3(l), g, uSat);
    g = g + uBright * 0.18;
    g = mix(g, uTint, max(uTintA, 0.42 * s.w));
    // Luce.
    float facing = max(dot(n, uLight), 0.0);
    float away = max(dot(n, -uLight), 0.0);
    float rim = pow(t, 4.0);
    g += uHigh * (0.50 * facing * rim + 0.08 * rim);
    g *= 1.0 - uHigh * 0.20 * away * pow(t, 3.0);
    float edge = 1.0 - smoothstep(0.0, 1.3, -d);
    g = mix(g, vec3(1.0), clamp(uHigh * edge * (0.18 + 0.62 * facing), 0.0, 1.0));
    float yy = (p.y - r.y) / max(r.w, 1.0);
    g += uHigh * 0.07 * (1.0 - smoothstep(0.0, 0.6, yy)) * (1.0 - t);
    g += press * 0.035;
    float aa = clamp(0.5 - d * uDpr, 0.0, 1.0);
    lens = clamp(g, 0.0, 1.0);
    la = aa * s.y;
  }
  if (uClear > 0.5) {
    // Solo lente e ombra (nero velato), il resto lascia vedere sotto.
    float a = la + (1.0 - la) * sa;
    outColor = vec4(a > 0.0 ? lens * la / a : vec3(0.0), a);
  } else {
    col = mix(col * (1.0 - sa), lens, la);
    outColor = vec4(col, 1.0);
  }
}`

interface Tex { tex: WebGLTexture; w: number; h: number; version: number; ready: boolean }

const hex3 = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export class LiquidGlass {
  private gl: WebGL2RenderingContext
  private prog: WebGLProgram
  private u: Record<string, WebGLUniformLocation | null> = {}
  private texs = new Map<NonNullable<BgLayer['source']>, Tex>()
  private canvas: HTMLCanvasElement | null
  private buf: WebGLBuffer
  private clear: boolean

  /** Con una tela: contesto proprio. Con un contesto WebGL2 già esistente
   *  (il motore del giro pagina): disegna nel suo framebuffer principale.
   *  `transparent`: la tela sta sopra l'HTML e disegna solo lenti e ombre. */
  constructor(target: HTMLCanvasElement | WebGL2RenderingContext, opts: { transparent?: boolean } = {}) {
    const own = target instanceof HTMLCanvasElement
    this.canvas = own ? target : null
    this.clear = !!opts.transparent && own
    const gl = own ? target.getContext('webgl2', { antialias: false, premultipliedAlpha: false, alpha: this.clear, preserveDrawingBuffer: false }) : target
    if (!gl) throw new Error('webgl2')
    this.gl = gl
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src); gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(`${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader: ${gl.getShaderInfoLog(s) || (gl.isContextLost() ? 'contesto perso' : '?')}`)
      }
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link')
    this.prog = prog
    gl.useProgram(prog)
    this.buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    for (const n of ['uSize', 'uDpr', 'uBase', 'uTex0', 'uTex1', 'uMap0', 'uMap1', 'uA0', 'uA1', 'uTexel0', 'uTexel1', 'uVeil', 'uBgBlur',
      'uN', 'uRect', 'uShape', 'uFrost', 'uRefract', 'uBezel', 'uDisp', 'uBright', 'uSat', 'uHigh', 'uShadow', 'uTint', 'uTintA', 'uLight', 'uClear']) {
      this.u[n] = gl.getUniformLocation(prog, n)
    }
    gl.uniform1i(this.u.uTex0, 0)
    gl.uniform1i(this.u.uTex1, 1)
  }

  private texture(layer: BgLayer): Tex | null {
    const gl = this.gl, src = layer.source
    if (layer.texture) return { tex: layer.texture.tex, w: layer.texture.w, h: layer.texture.h, version: 0, ready: true }
    if (!src) return null
    let t = this.texs.get(src)
    if (!t) {
      const tex = gl.createTexture()!
      t = { tex, w: 0, h: 0, version: -1, ready: false }
      this.texs.set(src, t)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }
    const w = src instanceof HTMLVideoElement ? src.videoWidth : src instanceof HTMLImageElement ? src.naturalWidth : src.width
    const h = src instanceof HTMLVideoElement ? src.videoHeight : src instanceof HTMLImageElement ? src.naturalHeight : src.height
    const usable = src instanceof HTMLVideoElement ? src.readyState >= 2 : src instanceof HTMLImageElement ? src.complete && w > 0 : w > 0
    if (!usable) return t.ready ? t : null
    const v = layer.version ?? 0
    if (layer.dynamic || !t.ready || t.version !== v) {
      gl.bindTexture(gl.TEXTURE_2D, t.tex)
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
        gl.generateMipmap(gl.TEXTURE_2D)
        t.ready = true; t.w = w; t.h = h; t.version = v
      } catch {
        return t.ready ? t : null
      }
    }
    return t
  }

  /** Mappa schermo (px CSS) → coordinate della tela, e texel per px. */
  private map(t: Tex, layer: BgLayer, W: number, H: number): { map: number[]; texel: number } {
    if (layer.texture) return { map: [1 / W, -1 / H, 0, 1], texel: t.w / W }   // framebuffer: capovolta
    if (!layer.cover) return { map: [1 / W, 1 / H, 0, 0], texel: t.w / W }
    const sc = Math.max(W / t.w, H / t.h) * layer.scale
    const dw = t.w * sc, dh = t.h * sc
    const ox = (W - dw) / 2, oy = (H - dh) / 2
    return { map: [1 / dw, 1 / dh, -ox / dw, -oy / dh], texel: t.w / dw }
  }

  /** Disegna sfondo e lenti. `dprOverride`: densità del framebuffer quando il
   *  contesto non è nostro (il motore del giro pagina ha la sua). */
  render(f: GlassFrame, dprOverride?: number) {
    const gl = this.gl
    const dpr = dprOverride ?? Math.min(window.devicePixelRatio || 1, 2)
    const cw = Math.round(f.width * dpr), ch = Math.round(f.height * dpr)
    if (this.canvas && (this.canvas.width !== cw || this.canvas.height !== ch)) { this.canvas.width = cw; this.canvas.height = ch }
    // Stato pulito: il contesto può essere condiviso con il giro pagina.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, cw, ch)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    gl.useProgram(this.prog)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    const loc = gl.getAttribLocation(this.prog, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    gl.uniform1i(this.u.uTex0, 0)
    gl.uniform1i(this.u.uTex1, 1)
    gl.uniform2f(this.u.uSize, f.width, f.height)
    gl.uniform1f(this.u.uDpr, dpr)
    gl.uniform3fv(this.u.uBase, hex3(f.base))

    const layers = f.layers.filter(l => l.alpha > 0.001).slice(-2)
    for (let i = 0; i < 2; i++) {
      const l = layers[i]
      const t = l ? this.texture(l) : null
      gl.activeTexture(i === 0 ? gl.TEXTURE0 : gl.TEXTURE1)
      if (l && t) {
        gl.bindTexture(gl.TEXTURE_2D, t.tex)
        const m = this.map(t, l, f.width, f.height)
        gl.uniform4fv(i === 0 ? this.u.uMap0 : this.u.uMap1, m.map)
        gl.uniform1f(i === 0 ? this.u.uTexel0 : this.u.uTexel1, m.texel)
        gl.uniform1f(i === 0 ? this.u.uA0 : this.u.uA1, l.alpha)
      } else {
        gl.uniform1f(i === 0 ? this.u.uA0 : this.u.uA1, 0)
      }
    }
    const o = f.veil
    gl.uniform4f(this.u.uVeil, 0.84 * o, 0.1 * o, 0.2 * o, Math.min(0.92, 1.36 * o))
    gl.uniform1f(this.u.uBgBlur, f.blur)

    const rects = f.rects.slice(0, MAX_RECTS)
    const R = new Float32Array(MAX_RECTS * 4), S = new Float32Array(MAX_RECTS * 4)
    rects.forEach((r, i) => { R.set([r.x, r.y, r.w, r.h], i * 4); S.set([r.radius, r.alpha, r.press, r.panel ?? 0], i * 4) })
    gl.uniform1i(this.u.uN, rects.length)
    gl.uniform4fv(this.u.uRect, R)
    gl.uniform4fv(this.u.uShape, S)
    const g = f.glass
    gl.uniform1f(this.u.uFrost, g.frost)
    gl.uniform1f(this.u.uRefract, g.refraction)
    gl.uniform1f(this.u.uBezel, g.bezel)
    gl.uniform1f(this.u.uDisp, g.dispersion)
    gl.uniform1f(this.u.uBright, g.brightness)
    gl.uniform1f(this.u.uSat, g.saturation)
    gl.uniform1f(this.u.uHigh, g.highlight)
    gl.uniform1f(this.u.uShadow, g.shadow)
    gl.uniform3fv(this.u.uTint, hex3(g.tint))
    gl.uniform1f(this.u.uTintA, g.tintAmount)
    // Direzione verso la luce (y dello schermo verso il basso): 0° da destra,
    // 90° dall'alto, 135° dall'alto a sinistra, 180° da sinistra.
    const a = (g.lightAngle * Math.PI) / 180
    gl.uniform2f(this.u.uLight, Math.cos(a), -Math.sin(a))
    gl.uniform1f(this.u.uClear, this.clear ? 1 : 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  dispose() {
    const gl = this.gl
    for (const t of Array.from(this.texs.values())) gl.deleteTexture(t.tex)
    this.texs.clear()
    // Niente loseContext: la stessa tela può essere riusata (React la rimonta).
    gl.deleteProgram(this.prog)
    gl.deleteBuffer(this.buf)
  }
}
