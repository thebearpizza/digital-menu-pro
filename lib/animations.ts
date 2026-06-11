'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Shared anime.js entrance animations for the public menu (landing + dish card).
// The flipbook page-turn animation and the PDF document are intentionally left
// untouched — this module only covers landing content and the DishModal card.
// ─────────────────────────────────────────────────────────────────────────────

import { animate, stagger } from 'animejs'

// Staggered fade/slide-up entrance for the landing page content. Animates the
// direct children of `container` (logo, title, description, menu buttons,
// socials) once on mount.
export function animateLandingIn(container: HTMLElement | null) {
  if (!container) return
  const items = container.querySelectorAll(':scope > *')
  if (!items.length) return
  animate(items, {
    opacity: [0, 1],
    translateY: [18, 0],
    duration: 700,
    delay: stagger(110, { start: 150 }),
    ease: 'outQuad',
  })
}

// Pop-in entrance for the DishModal card + backdrop.
export function animateCardIn(card: HTMLElement | null, backdrop?: HTMLElement | null) {
  if (backdrop) {
    animate(backdrop, { opacity: [0, 1], duration: 200, ease: 'outQuad' })
  }
  if (!card) return
  animate(card, {
    opacity: [0, 1],
    scale: [0.94, 1],
    translateY: [24, 0],
    duration: 380,
    ease: 'outExpo',
  })
}
