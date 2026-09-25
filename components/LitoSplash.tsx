'use client'

import { useEffect, useState } from 'react'

const ANIMATION_MS = 4200
const MAX_WAIT_MS = 15000
const L_PATH = 'm44.64 35.88c-2.07 1.87-4.98 2.83-7.76 2.83-5.43 0-10.09-2.8-14.39-4.56 3.09-3.22 5.32-7.98 7.34-12.61 1.55-3.490 3.02-6.41 5.3-8.86 1.76-1.84 4.06-3.2 6.03-3.2 1.27 0 1.97 0.78 1.97 1.84 0 4-6.45 9.45-12.76 11.56-0.22 0.08-0.16 0.31 0.12 0.3 8.4-0.73 15.68-6.16 15.67-10.87-0.01-2.42-1.9-3.86-5.04-3.86-4.56 0-9.68 2.68-13.21 7.3-3.66 4.79-5.49 11.38-9.17 17.15-1.75-0.46-3.56-0.68-5.25-0.68-5.21 0-9.6 2.66-9.6 5.73 0 2.11 1.91 3.2 4.48 3.2 4.31 0 8.94-2.8 12.01-5.27 4.27 2.26 8.96 5.67 14.47 5.67 5.72 0 9.42-3.27 10.11-5.27 0.09-0.28-0.16-0.54-0.32-0.4zm-33.53 3.18c-1.53-0.04-2.4-0.84-2.4-2.03 0-1.82 2.17-3.31 4.94-3.31 1.46 0 2.9 0.4 3.97 0.87-1.82 2.62-4.38 4.5-6.51 4.47z'
const PEN_PATH = 'M30.4 22.4C34 19.5 40 15.5 44 12.5C46.8 10.2 45 7.6 41.5 8.2C37 9 33 11.5 30.5 15.5C26.5 21.5 24 28 19.2 32.8C16 34.5 11 34 7.8 35.5C5 37 5.3 40 8.8 40.2C12.5 40.4 17 37.5 20.5 34.8C26 37 31 40 37 40C41 40 43.5 37.8 44.8 36'

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
                <mask id="ls-pen" maskUnits="userSpaceOnUse" x="-5" y="-5" width="60" height="60">
                  <path className="ls-pen" pathLength={1} d={PEN_PATH} />
                </mask>
              </defs>
              <path className="ls-ink" mask="url(#ls-pen)" d={L_PATH} />
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
.ls-book{position:relative;width:min(40vw,260px);aspect-ratio:3/4;transform-style:preserve-3d;transform:rotateX(8deg);animation:ls-in .5s ease both}
.ls-leaf{position:absolute;inset:0;border-radius:2px 6px 6px 2px;background:radial-gradient(120% 90% at 30% 20%,rgba(255,255,255,.7),transparent 60%),linear-gradient(90deg,rgba(0,0,0,.1),transparent 8%,transparent 92%,rgba(0,0,0,.04)),var(--paper);box-shadow:0 1px 0 var(--edge),0 2px 0 #e2dacb,0 3px 0 var(--edge),0 4px 0 #ddd4c3,0 24px 40px -12px rgba(0,0,0,.35)}
.ls-grain::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;mix-blend-mode:multiply;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .4  0 0 0 0 .35  0 0 0 0 .28  0 0 0 .09 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.ls-logo{position:absolute;left:16%;top:18%;width:68%;height:auto;overflow:visible}
.ls-ink{fill:#111}
.ls-pen{fill:none;stroke:#fff;stroke-width:4.6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:ls-write var(--d) cubic-bezier(.55,.1,.35,1) forwards}
.ls-word{position:absolute;left:0;right:0;bottom:12%;text-align:center;letter-spacing:.42em;text-indent:.42em;font:500 11px/1 Georgia,"Times New Roman",serif;color:#6b6357;text-transform:uppercase;opacity:0;animation:ls-word var(--d) ease forwards}
.ls-page{position:absolute;inset:0;transform-origin:left center;transform-style:preserve-3d;animation:ls-turn var(--d) cubic-bezier(.45,.05,.25,1) forwards}
.ls-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:2px 6px 6px 2px;overflow:hidden}
.ls-front{display:grid;place-items:center;background:linear-gradient(90deg,rgba(0,0,0,.18),transparent 6%),radial-gradient(120% 80% at 70% 10%,rgba(255,255,255,.55),transparent 55%),var(--paper)}
.ls-rule{width:46%;aspect-ratio:1;border:1px solid rgba(17,17,17,.18);border-radius:50%;display:grid;place-items:center;font:italic 400 13px Georgia,serif;color:rgba(17,17,17,.45);letter-spacing:.2em}
.ls-back{transform:rotateY(180deg);background:linear-gradient(270deg,rgba(0,0,0,.14),transparent 10%),var(--paper)}
.ls-front::before,.ls-back::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,transparent 20%,rgba(0,0,0,.28) 100%);opacity:0;animation:ls-shade var(--d) ease-in-out forwards}
.ls-cast{position:absolute;inset:0;pointer-events:none;border-radius:2px 6px 6px 2px;background:linear-gradient(90deg,rgba(0,0,0,.3),transparent 70%);opacity:0;animation:ls-shade var(--d) ease-in-out forwards}
@keyframes ls-in{from{opacity:0;transform:rotateX(8deg) translateY(8px)}to{opacity:1;transform:rotateX(8deg)}}
@keyframes ls-center{0%,10%{transform:translateX(0)}58%,100%{transform:translateX(50%)}}
@keyframes ls-turn{0%,10%{transform:rotateY(0)}34%{transform:rotateY(-70deg) skewY(-3deg)}50%{transform:rotateY(-150deg) skewY(1deg)}58%,100%{transform:rotateY(-180deg)}}
@keyframes ls-shade{0%,10%{opacity:0}32%{opacity:1}54%,100%{opacity:0}}
@keyframes ls-write{0%,24%{stroke-dashoffset:1}86%,100%{stroke-dashoffset:0}}
@keyframes ls-word{0%,84%{opacity:0;transform:translateY(4px)}96%,100%{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ls-page,.ls-cast{display:none}.ls-stage,.ls-book{animation:none}.ls-pen{animation:none;stroke-dashoffset:0}.ls-word{animation:none;opacity:1}}
`
