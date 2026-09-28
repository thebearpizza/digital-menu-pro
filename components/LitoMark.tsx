'use client'

import { useId } from 'react'

const L_PATH = 'm44.64 35.88c-2.07 1.87-4.98 2.83-7.76 2.83-5.43 0-10.09-2.8-14.39-4.56 3.09-3.22 5.32-7.98 7.34-12.61 1.55-3.490 3.02-6.41 5.3-8.86 1.76-1.84 4.06-3.2 6.03-3.2 1.27 0 1.97 0.78 1.97 1.84 0 4-6.45 9.45-12.76 11.56-0.22 0.08-0.16 0.31 0.12 0.3 8.4-0.73 15.68-6.16 15.67-10.87-0.01-2.42-1.9-3.86-5.04-3.86-4.56 0-9.68 2.68-13.21 7.3-3.66 4.79-5.49 11.38-9.17 17.15-1.75-0.46-3.56-0.68-5.25-0.68-5.21 0-9.6 2.66-9.6 5.73 0 2.11 1.91 3.2 4.48 3.2 4.31 0 8.94-2.8 12.01-5.27 4.27 2.26 8.96 5.67 14.47 5.67 5.72 0 9.42-3.27 10.11-5.27 0.09-0.28-0.16-0.54-0.32-0.4zm-33.53 3.18c-1.53-0.04-2.4-0.84-2.4-2.03 0-1.82 2.17-3.31 4.94-3.31 1.46 0 2.9 0.4 3.97 0.87-1.82 2.62-4.38 4.5-6.51 4.47z'
// Zone da nascondere ai tratti già scritti, dipinte di nero nella maschera subito
// dopo quei tratti (i tratti successivi le scoprono). Niente clipPath: Safari lo
// rasterizza a bassa risoluzione dentro le maschere e l'asta esce a gradini.
// - SWASH_HIDE: mentre si scrive lo svolazzo, l'asta accanto alla sua punta.
// - CROSSING_HIDE: all'incrocio, tutto tranne la sagoma dell'asta (tracciata sui
//   suoi bordi reali), così la coda che la attraversa compare solo al passaggio.
const SWASH_HIDE = 'M18 8L32.9 15.9L31.3 19L30.3 21L29.35 23L28.6 25L27.3 28L18 28Z'
const CROSSING_HIDE = 'M15.5 31.6H25V38H15.5Z M19.36 31.6L18.7 32.95L17.6 34.6L16 36.5L15.5 36.98L15.5 38L17.8 38L19.15 36.8L20.4 35.95L22.6 34.15L24.3 32L24.68 31.6Z'
const PEN_STROKES = [
  { d: 'M31.4 22C32 21.73 33.57 21.18 35 20.4C36.43 19.62 38.5 18.43 40 17.3C41.5 16.17 43.1 14.65 44 13.6C44.9 12.55 45.4 11.73 45.4 11C45.4 10.27 44.73 9.57 44 9.2C43.27 8.83 42.13 8.68 41 8.8', w: 5, len: 23.75 },
  { d: 'M41 8.8C39.87 8.92 38.43 9.32 37.2 9.9C35.97 10.48 34.67 11.42 33.6 12.3C32.53 13.18 31.63 14.15 30.8 15.2C29.97 16.25 29.28 17.38 28.6 18.6C27.92 19.82 27.4 21.1 26.7 22.5C26 23.9 25.12 25.58 24.4 27C23.68 28.42 23.15 29.82 22.4 31', w: 6.2, len: 30.27 },
  { d: 'M22.4 31C21.65 32.18 20.8 33.12 19.9 34.1C19 35.08 18.23 36.02 17 36.9', w: 5, len: 8.03 },
  { d: 'M17 36.9C15.77 37.78 13.87 38.87 12.5 39.4C11.13 39.93 9.85 40.12 8.8 40.1C7.75 40.08 6.8 39.75 6.2 39.3C5.6 38.85 5.03 38.02 5.2 37.4', w: 5.2, len: 13.96 },
  { d: 'M5.2 37.4C5.37 36.78 6.23 36.07 7.2 35.6C8.17 35.13 9.62 34.78 11 34.6C12.38 34.42 14.08 34.4 15.5 34.5C16.92 34.6 18.08 34.85 19.5 35.2', w: 5.2, len: 15.27 },
  { d: 'M19.5 35.2C20.92 35.55 22.42 36.03 24 36.6C25.58 37.17 27.33 38 29 38.6C30.67 39.2 32.42 39.9 34 40.2C35.58 40.5 37.12 40.63 38.5 40.4C39.88 40.17 41.28 39.5 42.3 38.8C43.32 38.1 44.22 36.63 44.6 36.2', w: 4.4, len: 27.52 },
]
// Dopo il tratto di indice N, la zona da nascondere ai tratti precedenti.
const HIDE_AFTER: Record<number, string> = { 0: SWASH_HIDE, 3: CROSSING_HIDE }
const TOTAL_LEN = PEN_STROKES.reduce((a, b) => a + b.len, 0)

/** La L dorata di Lito che si scrive a pennino, su sfondo trasparente. */
export default function LitoMark({
  writeStartMs = 0,
  writeMs = 2600,
  className,
}: {
  writeStartMs?: number
  writeMs?: number
  className?: string
}) {
  const uid = useId().replace(/:/g, '')
  const id = (name: string) => `lm${uid}-${name}`
  let before = 0

  return (
    <svg className={`lito-mark${className ? ` ${className}` : ''}`} viewBox="0 0 50 50" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <defs>
        <linearGradient id={id('gold')} x1="4" y1="8" x2="46" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7c5810" />
          <stop offset=".22" stopColor="#c6982e" />
          <stop offset=".42" stopColor="#f0d686" />
          <stop offset=".58" stopColor="#b88923" />
          <stop offset=".8" stopColor="#8b6514" />
          <stop offset="1" stopColor="#d5ad4c" />
        </linearGradient>
        <linearGradient id={id('sheen')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff6d6" stopOpacity=".7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={id('glyph')} maskUnits="userSpaceOnUse" x="-5" y="-5" width="60" height="60">
          <path d={L_PATH} fill="#fff" />
        </mask>
        <mask id={id('pen')} maskUnits="userSpaceOnUse" x="-5" y="-5" width="60" height="60">
          {PEN_STROKES.map((st, i) => {
            const delay = writeStartMs + (writeMs * before) / TOTAL_LEN
            before += st.len
            const last = i === PEN_STROKES.length - 1
            return [
              <path
                key={i}
                className="lm-pen"
                pathLength={1}
                d={st.d}
                strokeWidth={st.w}
                style={{
                  animationDelay: `${delay}ms`,
                  animationDuration: `${(writeMs * st.len) / TOTAL_LEN}ms`,
                  animationTimingFunction: i === 0 ? 'cubic-bezier(.5,0,1,1)' : last ? 'cubic-bezier(0,0,.4,1)' : 'linear',
                }}
              />,
              HIDE_AFTER[i] && <path key={`hide${i}`} d={HIDE_AFTER[i]} fill="#000" fillRule="evenodd" />,
            ]
          })}
        </mask>
      </defs>
      <g mask={`url(#${id('pen')})`}>
        <path d={L_PATH} fill={`url(#${id('gold')})`} />
        <g mask={`url(#${id('glyph')})`}>
          <rect
            className="lm-sheen"
            x="-20" y="0" width="20" height="50"
            fill={`url(#${id('sheen')})`}
            style={{ animationDelay: `${writeStartMs + writeMs - 100}ms` }}
          />
        </g>
      </g>
    </svg>
  )
}

const CSS = `
.lito-mark{display:block;overflow:visible;shape-rendering:geometricPrecision}
.lm-pen{fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1 2;stroke-dashoffset:1;animation-name:lm-write;animation-fill-mode:both}
.lm-sheen{animation:lm-sheen 1.1s ease-in-out both}
@keyframes lm-write{0%{stroke-dashoffset:1;stroke-opacity:0}.5%{stroke-opacity:1}100%{stroke-dashoffset:0;stroke-opacity:1}}
@keyframes lm-sheen{from{transform:translateX(0)}to{transform:translateX(70px)}}
@media (prefers-reduced-motion:reduce){.lm-pen{animation:none!important;stroke-dashoffset:0}.lm-sheen{display:none}}
`
