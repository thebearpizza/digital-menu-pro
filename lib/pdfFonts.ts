// ─────────────────────────────────────────────────────────────────────────────
// pdfFonts — registers real Google Font TTFs into @react-pdf/renderer so the
// generated menu PDF renders the typography chosen in the admin, not just the
// built-in Helvetica/Times.
//
// • TTF URLs come from lib/pdfFontUrls.ts (static per-weight files on
//   fonts.gstatic.com, which serves them with open CORS).
// • Registration is idempotent and cached per family for the session, so the
//   live preview can regenerate the PDF on every slider move without re-fetching.
// • Every step is defensive: a missing family or a failed register never throws,
//   the caller simply falls back to a built-in font.
// ─────────────────────────────────────────────────────────────────────────────

import { PDF_FONT_URLS } from './pdfFontUrls'

// Families we've already handed to Font.register this session.
const registered = new Set<string>()
// Families known to be unavailable (not in the catalog) — skip silently.
const unavailable = new Set<string>()

type FontLike = {
  register: (opts: { family: string; fonts: { src: string; fontWeight?: number; fontStyle?: string }[] }) => void
}

/**
 * Ensure `family` is registered with @react-pdf. Returns true if the family is
 * usable as a `fontFamily` value, false if the caller should fall back.
 */
export function ensurePdfFont(Font: FontLike, family: string): boolean {
  if (!family) return false
  if (registered.has(family)) return true
  if (unavailable.has(family)) return false

  const urls = PDF_FONT_URLS[family]
  if (!urls) { unavailable.add(family); return false }

  try {
    // Always provide both weights the PDF asks for (400 + 700) so resolution
    // never fails — fall the bold back to the regular file when absent.
    const fonts: { src: string; fontWeight?: number; fontStyle?: string }[] = [
      { src: urls.r,          fontWeight: 400 },
      { src: urls.b ?? urls.r, fontWeight: 700 },
    ]
    if (urls.i) fonts.push({ src: urls.i, fontWeight: 400, fontStyle: 'italic' })
    Font.register({ family, fonts })
    registered.add(family)
    return true
  } catch {
    unavailable.add(family)
    return false
  }
}

/**
 * Register every family used by a menu theme and return the set that succeeded,
 * so the document can decide per-element whether to use the real font or a
 * built-in fallback.
 */
export function registerThemeFonts(
  Font: FontLike,
  families: string[],
): Set<string> {
  const ok = new Set<string>()
  for (const f of families) {
    if (ensurePdfFont(Font, f)) ok.add(f)
  }
  return ok
}
