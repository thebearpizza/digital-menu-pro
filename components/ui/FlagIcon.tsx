// ─────────────────────────────────────────────────────────────────────────────
// FlagIcon — bandiere 2D disegnate in SVG (niente emoji): rendering identico su
// ogni OS/browser, look "vecchio stampo" pulito e professionale. Una bandiera
// per lingua supportata dal menu (it/en/fr/de/es).
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react'
import type { Lang } from '@/lib/translations'

const FLAGS: Record<Lang, ReactNode> = {
  // Italia — tre bande verticali verde/bianco/rosso
  it: (
    <svg viewBox="0 0 3 2" className="w-full h-full block">
      <rect width="1" height="2" x="0" fill="#009246" />
      <rect width="1" height="2" x="1" fill="#ffffff" />
      <rect width="1" height="2" x="2" fill="#ce2b37" />
    </svg>
  ),
  // Regno Unito — Union Jack semplificata
  en: (
    <svg viewBox="0 0 60 40" className="w-full h-full block">
      <clipPath id="flag-uk-clip"><rect width="60" height="40" /></clipPath>
      <g clipPath="url(#flag-uk-clip)">
        <rect width="60" height="40" fill="#012169" />
        <path d="M0,0 L60,40 M60,0 L0,40" stroke="#ffffff" strokeWidth="8" />
        <path d="M0,0 L60,40 M60,0 L0,40" stroke="#c8102e" strokeWidth="4" />
        <path d="M30,0 V40 M0,20 H60" stroke="#ffffff" strokeWidth="12" />
        <path d="M30,0 V40 M0,20 H60" stroke="#c8102e" strokeWidth="6" />
      </g>
    </svg>
  ),
  // Francia — tre bande verticali blu/bianco/rosso
  fr: (
    <svg viewBox="0 0 3 2" className="w-full h-full block">
      <rect width="1" height="2" x="0" fill="#0055a4" />
      <rect width="1" height="2" x="1" fill="#ffffff" />
      <rect width="1" height="2" x="2" fill="#ef4135" />
    </svg>
  ),
  // Germania — tre bande orizzontali nero/rosso/oro
  de: (
    <svg viewBox="0 0 3 3" className="w-full h-full block">
      <rect width="3" height="1" y="0" fill="#000000" />
      <rect width="3" height="1" y="1" fill="#dd0000" />
      <rect width="3" height="1" y="2" fill="#ffce00" />
    </svg>
  ),
  // Spagna — rosso/giallo/rosso (banda centrale doppia)
  es: (
    <svg viewBox="0 0 3 2" className="w-full h-full block">
      <rect width="3" height="2" fill="#aa151b" />
      <rect width="3" height="1" y="0.5" fill="#f1bf00" />
    </svg>
  ),
}

export function FlagIcon({ lang, className = '' }: { lang: Lang; className?: string }) {
  return (
    <span
      className={`inline-block overflow-hidden rounded-[2px] ring-1 ring-black/10 ${className}`}
      aria-hidden="true"
    >
      {FLAGS[lang]}
    </span>
  )
}
