'use client'

import { useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Blocco zoom runtime — necessario su iOS Safari, che dalla versione 10 ignora
// `user-scalable=no` / `maximum-scale` nel meta viewport per ragioni di
// accessibilità. Qui intercettiamo i gesti che genererebbero zoom:
//
//  • pinch-to-zoom  → eventi `gesturestart/change/end` (solo iOS) annullati
//  • doppio-tap     → due `touchend` ravvicinati (<300ms) annullati
//
// Il doppio-tap zoom è già neutralizzato anche via CSS `touch-action:
// manipulation` (globals.css); qui aggiungiamo la rete di sicurezza JS per i
// browser/contesti dove la sola CSS non basta. Gli swipe a un dito (turn.js) e
// i tap singoli sui piatti restano intatti: preventDefault scatta solo sul
// secondo tap ravvicinato e sui gesti multi-touch.
// ─────────────────────────────────────────────────────────────────────────────

export default function NoZoom() {
  useEffect(() => {
    const preventGesture = (e: Event) => e.preventDefault()

    // iOS-only gesture events (pinch zoom)
    document.addEventListener('gesturestart', preventGesture, { passive: false })
    document.addEventListener('gesturechange', preventGesture, { passive: false })
    document.addEventListener('gestureend', preventGesture, { passive: false })

    // Double-tap zoom: annulla il secondo tocco se avviene entro 300ms dal primo.
    let lastTouchEnd = 0
    const onTouchEnd = (e: TouchEvent) => {
      const now = Date.now()
      if (now - lastTouchEnd <= 300) e.preventDefault()
      lastTouchEnd = now
    }
    document.addEventListener('touchend', onTouchEnd, { passive: false })

    return () => {
      document.removeEventListener('gesturestart', preventGesture)
      document.removeEventListener('gesturechange', preventGesture)
      document.removeEventListener('gestureend', preventGesture)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  return null
}
