'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Shared anime.js entrance animations for the public menu (landing + dish card)
// and the admin backend (login, dashboard, lists, customization sidebar). The
// flipbook page-turn animation and the PDF document are intentionally left
// untouched — this module only covers landing content, the DishModal card and
// admin entrance/stagger/count-up effects.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { animate, stagger, utils, type JSAnimation } from 'animejs'

// Staggered fade/slide-up entrance for the landing page content. Animates the
// direct children of `container` (logo, title, description, menu buttons,
// socials) once on mount. Returns the animations so callers can revert them
// if the component unmounts mid-play.
export function animateLandingIn(container: HTMLElement | null): JSAnimation[] {
  if (!container) return []
  const items = container.querySelectorAll(':scope > *')
  if (!items.length) return []
  return [animate(items, {
    opacity: [0, 1],
    translateY: [18, 0],
    duration: 700,
    delay: stagger(110, { start: 150 }),
    ease: 'outQuad',
  })]
}

// Pop-in entrance for the DishModal card + backdrop.
export function animateCardIn(card: HTMLElement | null, backdrop?: HTMLElement | null): JSAnimation[] {
  const anims: JSAnimation[] = []
  if (backdrop) {
    anims.push(animate(backdrop, { opacity: [0, 1], duration: 200, ease: 'outQuad' }))
  }
  if (card) {
    anims.push(animate(card, {
      opacity: [0, 1],
      scale: [0.94, 1],
      translateY: [24, 0],
      duration: 380,
      ease: 'outExpo',
    }))
  }
  return anims
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin backend animation hooks (login, dashboard, lists, customization).
// ─────────────────────────────────────────────────────────────────────────────

// Tracks the `prefers-reduced-motion: reduce` media query so entrance effects
// can be skipped/applied instantly for users who opted out of motion.
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const update = () => setReduced(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reduced
}

// Staggered fade/slide-up entrance for the direct children of the returned
// ref's element. Runs once on mount (or whenever the component remounts via
// a `key` change). Respects prefers-reduced-motion by applying the final
// state instantly with no animation.
export function useStaggerEntrance<T extends HTMLElement>(opts?: {
  enabled?: boolean
  selector?: string
  translateY?: number
  duration?: number
  staggerMs?: number
  startDelay?: number
}) {
  const ref = useRef<T>(null)
  const reduced = usePrefersReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el || opts?.enabled === false) return
    const items = el.querySelectorAll(opts?.selector ?? ':scope > *')
    if (!items.length) return
    if (reduced) { utils.set(items, { opacity: 1, translateY: 0 }); return }
    animate(items, {
      opacity: [0, 1],
      translateY: [opts?.translateY ?? 18, 0],
      duration: opts?.duration ?? 700,
      delay: stagger(opts?.staggerMs ?? 90, { start: opts?.startDelay ?? 0 }),
      ease: 'outQuad',
    })
    return () => { utils.remove(items) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, opts?.enabled])
  return ref
}

// Animates a number counting up from 0 to `value` inside the returned ref's
// element. Respects prefers-reduced-motion by setting the final value instantly.
export function useCountUp(value: number, opts?: { duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = usePrefersReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced) { el.textContent = String(value); return }
    const obj = { val: 0 }
    animate(obj, {
      val: value,
      duration: opts?.duration ?? 900,
      ease: 'outExpo',
      onUpdate: () => { el.textContent = String(Math.round(obj.val)) },
    })
    return () => { utils.remove(obj) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced])
  return ref
}
