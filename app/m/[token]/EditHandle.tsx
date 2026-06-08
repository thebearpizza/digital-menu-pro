'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Edit-mode helpers — used when the public menu is loaded inside the admin
// preview iframe. Clicking a wrapped element posts the target id to the parent
// window, which opens the corresponding editor panel.
// ─────────────────────────────────────────────────────────────────────────────

import type React from 'react'

export function sendEdit(target: string) {
  try { window.parent?.postMessage({ type: 'dmp-element-clicked', target }, window.location.origin) } catch {}
}

export function EditHandle({
  target, children, editMode, className = '', style,
}: {
  target: string; children: React.ReactNode; editMode: boolean
  className?: string; style?: React.CSSProperties
}) {
  if (!editMode) return <>{children}</>
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
