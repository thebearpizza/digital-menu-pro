'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Top-of-screen progress bar shown while navigating between admin pages, so
// link clicks (dashboard → ristoranti, tab navigation, ecc.) give immediate
// feedback instead of feeling frozen while the next page loads.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { animate, type JSAnimation } from 'animejs'

export default function NavigationProgress() {
  const barRef     = useRef<HTMLDivElement>(null)
  const animRef    = useRef<JSAnimation | null>(null)
  const loadingRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathname   = usePathname()

  const done = useCallback(() => {
    if (!loadingRef.current) return
    loadingRef.current = false
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    const el = barRef.current
    if (!el) return
    animRef.current?.revert()
    animRef.current = animate(el, {
      width: '100%',
      duration: 200,
      ease: 'outQuad',
      onComplete: () => {
        animate(el, {
          opacity: 0,
          duration: 250,
          delay: 100,
          onComplete: () => { el.style.width = '0%' },
        })
      },
    })
  }, [])

  const start = useCallback(() => {
    if (loadingRef.current) return
    loadingRef.current = true
    const el = barRef.current
    if (!el) return
    animRef.current?.revert()
    el.style.opacity = '1'
    el.style.width = '0%'
    animRef.current = animate(el, { width: ['0%', '85%'], duration: 4000, ease: 'outQuad' })
    timeoutRef.current = setTimeout(done, 8000)
  }, [done])

  // Clicking any internal link starts the bar immediately, before the
  // navigation/data-fetch for the next page completes.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement)?.closest('a')
      if (!anchor) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return
      const href = anchor.getAttribute('href')
      if (!href || !href.startsWith('/')) return
      if (new URL(href, window.location.href).pathname === window.location.pathname) return
      start()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [start])

  // Once the route actually changes, the new page has rendered — finish the bar.
  useEffect(() => {
    done()
  }, [pathname, done])

  return (
    <div
      ref={barRef}
      aria-hidden
      className="fixed top-0 left-0 z-[100] h-[3px] bg-blue-600 pointer-events-none"
      style={{ width: '0%', opacity: 0 }}
    />
  )
}
