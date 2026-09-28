'use client'

import { useEffect, useState } from 'react'
import LitoMark from './LitoMark'

const ANIMATION_MS = 4200
const WRITE_START_MS = 1000
const WRITE_MS = 2600
const MAX_WAIT_MS = 15000
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
            <LitoMark className="ls-logo" writeStartMs={WRITE_START_MS} writeMs={WRITE_MS} />
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
.ls-logo{position:absolute;left:16%;top:18%;width:68%;height:auto;overflow:visible}
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
@keyframes ls-word{0%,84%{opacity:0;transform:translateY(4px)}96%,100%{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ls-page,.ls-cast{display:none}.ls-stage,.ls-book{animation:none}.ls-word{animation:none;opacity:1}}
`
