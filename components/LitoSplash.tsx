'use client'

import { useEffect, useState } from 'react'
import LitoMark from './LitoMark'

const ANIMATION_MS = 3700
const WRITE_START_MS = 500
const WRITE_MS = 1700
// Sfoglio: copertina, poi pagine a raffica che scoprono la L mentre si scrive.
const COVER_START_MS = 450
const COVER_MS = 520
const PAGES = 8
const PAGE_START_MS = 820
const PAGE_STAGGER_MS = 165
const PAGE_MS = 300
const MAX_WAIT_MS = 15000
// Variante "loop": resta almeno finché la L non è stata scritta una volta.
const LOOP_MIN_MS = 1800
// Sotto lo splash, qualunque elemento con [data-app-loading] (skeleton, overlay
// di caricamento) tiene lo splash visibile finché non sparisce.
function contentReady() {
  return document.readyState === 'complete' && !document.querySelector('[data-app-loading]')
}

/** book = libro che si sfoglia (menu cliente); loop = L scritta in loop (gestionale). */
export default function LitoSplash({ variant = 'book' }: { variant?: 'book' | 'loop' }) {
  const [phase, setPhase] = useState<'playing' | 'leaving' | 'gone'>('playing')
  const minMs = variant === 'loop' ? LOOP_MIN_MS : ANIMATION_MS

  useEffect(() => {
    const start = performance.now()
    const tick = setInterval(() => {
      const elapsed = performance.now() - start
      if ((elapsed >= minMs && contentReady()) || elapsed >= MAX_WAIT_MS) {
        clearInterval(tick)
        setPhase('leaving')
        setTimeout(() => setPhase('gone'), 600)
      }
    }, 100)
    return () => clearInterval(tick)
  }, [minMs])

  if (phase === 'gone') return null

  if (variant === 'loop') {
    return (
      <div className={`lito-splash lito-splash-loop${phase === 'leaving' ? ' is-leaving' : ''}`} role="status" aria-label="Caricamento">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="ls-loop">
          <LitoMark loop className="ls-loop-mark" />
          <div className="ls-loop-word">Lito</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`lito-splash${phase === 'leaving' ? ' is-leaving' : ''}`} role="status" aria-label="Caricamento">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ls-stage">
        <div className="ls-book">
          <div className="ls-leaf ls-grain">
            <LitoMark className="ls-logo" writeStartMs={WRITE_START_MS} writeMs={WRITE_MS} />
            <div className="ls-word">Lito</div>
          </div>
          {Array.from({ length: PAGES }, (_, i) => (
            <div
              key={i}
              className="ls-page ls-grain"
              style={{
                zIndex: PAGES - i,
                animationDelay: `${PAGE_START_MS + i * PAGE_STAGGER_MS}ms`,
                animationDuration: `${PAGE_MS}ms`,
              }}
            >
              <LitoMark className="ls-logo" progress={(i + 1) / (PAGES + 1)} />
            </div>
          ))}
          <div
            className="ls-page ls-cover ls-grain"
            style={{ zIndex: PAGES + 1, animationDelay: `${COVER_START_MS}ms`, animationDuration: `${COVER_MS}ms` }}
          >
            <div className="ls-rule">Menu</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.lito-splash{--paper:#f6eedd;--edge:#e3d6ba;--d:${ANIMATION_MS}ms;position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:radial-gradient(120% 90% at 50% 38%,#fffefb,#faf6ee 55%,#f1eadd);overflow:hidden;transition:opacity .6s ease}
.lito-splash.is-leaving{opacity:0;pointer-events:none}
.lito-splash-loop{background:radial-gradient(120% 90% at 50% 38%,#fbf6ea,#efe4cd 60%,#e2d3b5)}
.ls-loop{display:flex;flex-direction:column;align-items:center;animation:ls-in .5s ease both}
.ls-loop-mark{width:min(34vw,140px);height:auto}
.ls-loop-word{margin-top:6px;font:500 12px/1 Georgia,"Times New Roman",serif;letter-spacing:.42em;text-indent:.42em;text-transform:uppercase;color:#7d6c52}
.lito-splash *{box-sizing:border-box}
.ls-stage{perspective:1600px;padding:16px}
.ls-book{position:relative;width:min(52vw,260px);aspect-ratio:3/4;transform-style:preserve-3d;animation:ls-in .5s ease both}
.ls-leaf{position:absolute;inset:0;border-radius:3px 8px 8px 3px;background:radial-gradient(120% 90% at 30% 20%,rgba(255,255,255,.7),transparent 60%),linear-gradient(90deg,rgba(0,0,0,.1),transparent 8%,transparent 92%,rgba(0,0,0,.04)),var(--paper);box-shadow:1px 1px 0 var(--edge),2px 2px 0 #dccdae,3px 3px 0 var(--edge),4px 4px 0 #d6c6a5,0 26px 44px -14px rgba(0,0,0,.35)}
.ls-grain::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;mix-blend-mode:multiply;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .4  0 0 0 0 .35  0 0 0 0 .28  0 0 0 .09 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.ls-logo{position:absolute;left:16%;top:22%;width:68%;height:auto;overflow:visible}
.ls-word{position:absolute;left:0;right:0;bottom:13%;text-align:center;letter-spacing:.42em;text-indent:.42em;font:500 11px/1 Georgia,"Times New Roman",serif;color:#6b6357;text-transform:uppercase;opacity:0;animation:ls-word var(--d) ease forwards}
.ls-page{position:absolute;inset:0;border-radius:3px 8px 8px 3px;transform-origin:left center;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:linear-gradient(90deg,rgba(0,0,0,.07),transparent 7%),radial-gradient(120% 80% at 70% 10%,rgba(255,255,255,.6),transparent 55%),#f8f1e3;animation-name:ls-flip;animation-timing-function:cubic-bezier(.5,.05,.7,.4);animation-fill-mode:both;will-change:transform}
.ls-page::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(90deg,transparent 15%,rgba(60,40,10,.32) 100%);opacity:0;animation:inherit;animation-name:ls-flip-shade}
.ls-cover{display:grid;place-items:center;background:linear-gradient(90deg,rgba(0,0,0,.16),transparent 6%),radial-gradient(120% 80% at 70% 10%,rgba(255,255,255,.55),transparent 55%),var(--paper);animation-timing-function:cubic-bezier(.45,.05,.55,.35)}
.ls-rule{width:46%;aspect-ratio:1;border:1px solid rgba(17,17,17,.18);border-radius:50%;display:grid;place-items:center;font:italic 400 13px Georgia,serif;color:rgba(17,17,17,.45);letter-spacing:.2em}
@keyframes ls-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
@keyframes ls-flip{from{transform:rotateY(0)}to{transform:rotateY(-180deg)}}
@keyframes ls-flip-shade{0%{opacity:0}45%{opacity:1}50%,100%{opacity:0}}
@keyframes ls-word{0%,84%{opacity:0;transform:translateY(4px)}96%,100%{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ls-page{display:none}.ls-book{animation:none}.ls-word{animation:none;opacity:1}}
`
