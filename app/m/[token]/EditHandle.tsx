'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Edit-mode helpers — used when the public menu is loaded inside the admin
// preview iframe. Clicking a wrapped element posts the target id to the parent
// window, which opens the corresponding editor panel.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import type React from 'react'

export function sendEdit(target: string) {
  try { window.parent?.postMessage({ type: 'dmp-element-clicked', target }, window.location.origin) } catch {}
}

// True when the ADMIN page hosting the preview iframe is phone-sized. The
// iframe itself is always phone-width (it's a phone mockup), so Tailwind
// breakpoints inside it can't tell a desktop preview from a real smartphone —
// we must measure the parent window instead. On smartphone the chip bar is the
// only editor entry point, so all in-preview edit chrome is hidden there.
export function useIsMobilePreview(): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    try {
      const w = window.parent ?? window
      const mq = w.matchMedia('(max-width: 639px)')
      const update = () => setMobile(mq.matches)
      update()
      mq.addEventListener('change', update)
      return () => mq.removeEventListener('change', update)
    } catch { /* cross-origin parent — standalone view, keep desktop behavior */ }
  }, [])
  return mobile
}

export function EditHandle({
  target, children, editMode, className = '', style,
}: {
  target: string; children: React.ReactNode; editMode: boolean
  className?: string; style?: React.CSSProperties
}) {
  const mobile = useIsMobilePreview()
  if (!editMode || mobile) return <>{children}</>
  return (
    <div
      className={`relative ${className}`}
      style={{ ...style, cursor: 'pointer' }}
      onClick={e => { e.stopPropagation(); sendEdit(target) }}
      role="button" tabIndex={0} aria-label={`Edit ${target}`}
    >
      {children}
      <div className="absolute inset-0 border-2 border-dashed border-blue-400/60 rounded pointer-events-none" />
    </div>
  )
}
