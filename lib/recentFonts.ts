// Tracks the last fonts picked across all font dropdowns in the customization
// editor, so frequently-used fonts surface at the top of every selector.
const STORAGE_KEY = 'dmp-recent-fonts'
const MAX_RECENT  = 5

export function getRecentFonts(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((f): f is string => typeof f === 'string').slice(0, MAX_RECENT) : []
  } catch { return [] }
}

export function addRecentFont(font: string): string[] {
  if (typeof window === 'undefined') return []
  const current = getRecentFonts().filter(f => f !== font)
  const next = [font, ...current].slice(0, MAX_RECENT)
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  return next
}
