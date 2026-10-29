'use client'
// Misuratore della fluidità (solo aggiungendo ?fps=1 all'indirizzo): quanti
// fotogrammi al secondo disegna davvero il browser e quanti ne salta. Serve a
// verificare sul telefono se il limite è del browser (es. Safari a 60) o del menu.

import { useEffect, useState } from 'react'

export default function FpsMeter() {
  const [on, setOn] = useState(false)
  const [txt, setTxt] = useState('…')
  useEffect(() => {
    // Resta acceso passando dalla pagina d'apertura al menu (stessa scheda del browser); ?fps=0 lo spegne.
    try {
      const v = new URLSearchParams(location.search).get('fps')
      if (v === '1') sessionStorage.setItem('lito-fps', '1')
      if (v === '0') sessionStorage.removeItem('lito-fps')
      setOn(sessionStorage.getItem('lito-fps') === '1')
    } catch { /* memoria non disponibile */ }
  }, [])
  useEffect(() => {
    if (!on) return
    let raf = 0, last = performance.now(), t0 = last
    const gaps: number[] = []
    const tick = (now: number) => {
      gaps.push(now - last); last = now
      if (now - t0 >= 1000) {
        const sorted = [...gaps].sort((a, b) => a - b)
        const med = sorted[Math.floor(sorted.length / 2)] || 16.7
        const hz = Math.round(1000 / med)
        const dropped = gaps.filter(g => g > med * 1.6).length
        setTxt(`${hz} Hz · ${gaps.length} fps · saltati ${dropped}`)
        gaps.length = 0; t0 = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on])
  if (!on) return null
  return (
    <div style={{ position: 'fixed', left: 8, bottom: 'calc(8px + env(safe-area-inset-bottom))', zIndex: 2147483000, pointerEvents: 'none',
      background: 'rgba(0,0,0,0.72)', color: '#fff', font: '600 12px/1.2 system-ui, -apple-system, sans-serif', padding: '5px 9px', borderRadius: 8 }}>
      {txt}
    </div>
  )
}
