'use client'

import { useEffect, useState } from 'react'

const ANIMATION_MS = 4200
const WRITE_START_MS = 1000
const WRITE_MS = 2600
const MAX_WAIT_MS = 15000
const L_PATH = 'm44.64 35.88c-2.07 1.87-4.98 2.83-7.76 2.83-5.43 0-10.09-2.8-14.39-4.56 3.09-3.22 5.32-7.98 7.34-12.61 1.55-3.490 3.02-6.41 5.3-8.86 1.76-1.84 4.06-3.2 6.03-3.2 1.27 0 1.97 0.78 1.97 1.84 0 4-6.45 9.45-12.76 11.56-0.22 0.08-0.16 0.31 0.12 0.3 8.4-0.73 15.68-6.16 15.67-10.87-0.01-2.42-1.9-3.86-5.04-3.86-4.56 0-9.68 2.68-13.21 7.3-3.66 4.79-5.49 11.38-9.17 17.15-1.75-0.46-3.56-0.68-5.25-0.68-5.21 0-9.6 2.66-9.6 5.73 0 2.11 1.91 3.2 4.48 3.2 4.31 0 8.94-2.8 12.01-5.27 4.27 2.26 8.96 5.67 14.47 5.67 5.72 0 9.42-3.27 10.11-5.27 0.09-0.28-0.16-0.54-0.32-0.4zm-33.53 3.18c-1.53-0.04-2.4-0.84-2.4-2.03 0-1.82 2.17-3.31 4.94-3.31 1.46 0 2.9 0.4 3.97 0.87-1.82 2.62-4.38 4.5-6.51 4.47z'
const PEN_STROKES = [
  { d: 'M31.4 22C32 21.73 33.57 21.18 35 20.4C36.43 19.62 38.5 18.43 40 17.3C41.5 16.17 43.1 14.65 44 13.6C44.9 12.55 45.4 11.73 45.4 11C45.4 10.27 44.73 9.57 44 9.2C43.27 8.83 42.13 8.68 41 8.8', w: 5, len: 23.75 },
  { d: 'M41 8.8C39.87 8.92 38.43 9.32 37.2 9.9C35.97 10.48 34.67 11.42 33.6 12.3C32.53 13.18 31.63 14.15 30.8 15.2C29.97 16.25 29.28 17.38 28.6 18.6C27.92 19.82 27.4 21.1 26.7 22.5C26 23.9 25.2 25.58 24.4 27C23.6 28.42 22.8 29.9 21.9 31C21 32.1 20.15 33.03 19 33.6', w: 6.2, len: 34.45 },
  { d: 'M19 33.6C17.85 34.17 16.42 34.25 15 34.4C13.58 34.55 11.87 34.27 10.5 34.5C9.13 34.73 7.72 35.15 6.8 35.8C5.88 36.45 5.07 37.67 5 38.4C4.93 39.13 5.65 39.83 6.4 40.2C7.15 40.57 8.32 40.72 9.5 40.6C10.68 40.48 12.22 40.05 13.5 39.5C14.78 38.95 16.08 37.98 17.2 37.3C18.32 36.62 19.07 35.53 20.2 35.4', w: 5.2, len: 33.43 },
  { d: 'M20.2 35.4C21.33 35.27 22.53 35.97 24 36.5C25.47 37.03 27.33 37.98 29 38.6C30.67 39.22 32.42 39.9 34 40.2C35.58 40.5 37.12 40.63 38.5 40.4C39.88 40.17 41.28 39.5 42.3 38.8C43.32 38.1 44.22 36.63 44.6 36.2', w: 4.4, len: 26.84 },
]

// Sotto lo splash, qualunque elemento con [data-app-loading] (skeleton, overlay
// di caricamento) tiene lo splash visibile finché non sparisce.
function contentReady() {
  return document.readyState === 'complete' && !document.querySelector('[data-app-loading]')
}

export default function LitoSplash() {
  const [phase, setPhase] = useState<'playing' | 'leaving' | 'gone'>('playing')

  useEffect(() => {
    const start = performance.now()
    const tick = setInterval(() => {
      const elapsed = performance.now() - start
      if ((elapsed >= ANIMATION_MS && contentReady()) || elapsed >= MAX_WAIT_MS) {
        clearInterval(tick)
        setPhase('leaving')
        setTimeout(() => setPhase('gone'), 600)
      }
    }, 100)
    return () => clearInterval(tick)
  }, [])

  if (phase === 'gone') return null

  return (
    <div className={`lito-splash${phase === 'leaving' ? ' is-leaving' : ''}`} role="status" aria-label="Caricamento">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ls-stage">
        <div className="ls-book">
          <div className="ls-leaf ls-grain">
            <svg className="ls-logo" viewBox="0 0 50 50" aria-hidden="true">
              <defs>
                <linearGradient id="ls-gold" x1="4" y1="8" x2="46" y2="42" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#7c5810" />
                  <stop offset=".22" stopColor="#c6982e" />
                  <stop offset=".42" stopColor="#f0d686" />
                  <stop offset=".58" stopColor="#b88923" />
                  <stop offset=".8" stopColor="#8b6514" />
                  <stop offset="1" stopColor="#d5ad4c" />
                </linearGradient>
                <linearGradient id="ls-sheen" x1="-20" y1="0" x2="0" y2="20" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#fff" stopOpacity="0" />
                  <stop offset=".5" stopColor="#fff6d6" stopOpacity=".7" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0" />
                  <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="70 0" begin="3.5s" dur="1.1s" fill="freeze" />
                </linearGradient>
                <mask id="ls-pen" maskUnits="userSpaceOnUse" x="-5" y="-5" width="60" height="60">
                  {PEN_STROKES.map((st, i) => {
                    const total = PEN_STROKES.reduce((a, b) => a + b.len, 0)
                    const before = PEN_STROKES.slice(0, i).reduce((a, b) => a + b.len, 0)
                    const last = i === PEN_STROKES.length - 1
                    return (
                      <path
                        key={i}
                        className="ls-pen"
                        pathLength={1}
                        d={st.d}
                        strokeWidth={st.w}
                        style={{
                          animationDelay: `${WRITE_START_MS + (WRITE_MS * before) / total}ms`,
                          animationDuration: `${(WRITE_MS * st.len) / total}ms`,
                          animationTimingFunction: i === 0 ? 'cubic-bezier(.5,0,1,1)' : last ? 'cubic-bezier(0,0,.4,1)' : 'linear',
                        }}
                      />
                    )
                  })}
                </mask>
              </defs>
              <path className="ls-ink" mask="url(#ls-pen)" d={L_PATH} />
              <path className="ls-sheen" mask="url(#ls-pen)" d={L_PATH} />
            </svg>
            <div className="ls-word">Lito</div>
          </div>
          <div className="ls-cast" />
          <div className="ls-page">
            <div className="ls-face ls-front ls-grain"><div className="ls-rule">Menu</div></div>
            <div className="ls-face ls-back ls-grain" />
          </div>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.lito-splash{--paper:#fbf8f2;--edge:#e9e2d4;--d:${ANIMATION_MS}ms;position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:#ece8e1;overflow:hidden;transition:opacity .6s ease}
.lito-splash.is-leaving{opacity:0;pointer-events:none}
.lito-splash *{box-sizing:border-box}
.ls-stage{perspective:1400px;padding:16px;animation:ls-center var(--d) cubic-bezier(.45,.05,.25,1) forwards}
.ls-book{position:relative;width:min(40vw,260px);aspect-ratio:3/4;transform-style:preserve-3d;animation:ls-in .5s ease both}
.ls-leaf{position:absolute;inset:0;border-radius:2px 6px 6px 2px;background:radial-gradient(120% 90% at 30% 20%,rgba(255,255,255,.7),transparent 60%),linear-gradient(90deg,rgba(0,0,0,.1),transparent 8%,transparent 92%,rgba(0,0,0,.04)),var(--paper);box-shadow:0 1px 0 var(--edge),0 2px 0 #e2dacb,0 3px 0 var(--edge),0 4px 0 #ddd4c3,0 24px 40px -12px rgba(0,0,0,.35)}
.ls-grain::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;mix-blend-mode:multiply;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .4  0 0 0 0 .35  0 0 0 0 .28  0 0 0 .09 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.ls-logo{shape-rendering:geometricPrecision;position:absolute;left:16%;top:18%;width:68%;height:auto;overflow:visible}
.ls-ink{fill:url(#ls-gold)}
.ls-sheen{fill:url(#ls-sheen)}
.ls-pen{fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1 2;stroke-dashoffset:1;animation-name:ls-write;animation-fill-mode:both}
.ls-word{position:absolute;left:0;right:0;bottom:12%;text-align:center;letter-spacing:.42em;text-indent:.42em;font:500 11px/1 Georgia,"Times New Roman",serif;color:#6b6357;text-transform:uppercase;opacity:0;animation:ls-word var(--d) ease forwards}
.ls-page{position:absolute;inset:0;transform-origin:left center;transform-style:preserve-3d;animation:ls-turn var(--d) cubic-bezier(.45,.05,.25,1) forwards}
.ls-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:2px 6px 6px 2px;overflow:hidden}
.ls-front{display:grid;place-items:center;background:linear-gradient(90deg,rgba(0,0,0,.18),transparent 6%),radial-gradient(120% 80% at 70% 10%,rgba(255,255,255,.55),transparent 55%),var(--paper)}
.ls-rule{width:46%;aspect-ratio:1;border:1px solid rgba(17,17,17,.18);border-radius:50%;display:grid;place-items:center;font:italic 400 13px Georgia,serif;color:rgba(17,17,17,.45);letter-spacing:.2em}
.ls-back{transform:rotateY(180deg);background:linear-gradient(270deg,rgba(0,0,0,.14),transparent 10%),var(--paper)}
.ls-front::before,.ls-back::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,transparent 20%,rgba(0,0,0,.28) 100%);opacity:0;animation:ls-shade var(--d) ease-in-out forwards}
.ls-cast{position:absolute;inset:0;pointer-events:none;border-radius:2px 6px 6px 2px;background:linear-gradient(90deg,rgba(0,0,0,.3),transparent 70%);opacity:0;animation:ls-shade var(--d) ease-in-out forwards}
@keyframes ls-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes ls-center{0%,10%{transform:translateX(0)}58%,100%{transform:translateX(50%)}}
@keyframes ls-turn{0%,10%{transform:rotateY(0)}34%{transform:rotateY(-70deg) skewY(-3deg)}50%{transform:rotateY(-150deg) skewY(1deg)}58%,100%{transform:rotateY(-180deg)}}
@keyframes ls-shade{0%,10%{opacity:0}32%{opacity:1}54%,100%{opacity:0}}
@keyframes ls-write{0%{stroke-dashoffset:1;stroke-opacity:0}.5%{stroke-opacity:1}100%{stroke-dashoffset:0;stroke-opacity:1}}
@keyframes ls-word{0%,84%{opacity:0;transform:translateY(4px)}96%,100%{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ls-page,.ls-cast{display:none}.ls-stage,.ls-book{animation:none}.ls-pen{animation:none!important;stroke-dashoffset:0}.ls-word{animation:none;opacity:1}}
`
