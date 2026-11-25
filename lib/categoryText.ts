// ─────────────────────────────────────────────────────────────────────────────
// Descrizione delle categorie: testo scritto dal ristoratore per una categoria
// di un menu, mostrato in breve sotto il titolo o in una pagina intera (con la
// foto della categoria, se ce n'è una). Salvata in menus.text_content.categories
// ({ nome: { mode, body, tr, src } }); le traduzioni (tr) valgono solo se sono
// state fatte dal testo attuale (src === body), altrimenti si mostra l'italiano.
// Testo semplice: a capo, riga vuota = nuovo paragrafo, *corsivo*, **grassetto**.
// Client-safe.
// ─────────────────────────────────────────────────────────────────────────────

import { TARGET_LANGS, type Lang, type TargetLang } from './translations'

export type CategoryTextMode = 'short' | 'page'

export interface CategoryText {
  mode: CategoryTextMode
  body: string
  /** Traduzioni automatiche del testo `src`. */
  tr?:  Partial<Record<TargetLang, string>>
  src?: string
}
export type CategoryTexts = Record<string, CategoryText>

export const MAX_CATEGORY_TEXT = 1500

/** Una descrizione ripulita (null se vuota). */
export function cleanCategoryText(v: unknown): CategoryText | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  const body = typeof r.body === 'string' ? r.body.replace(/\r\n?/g, '\n').trim().slice(0, MAX_CATEGORY_TEXT) : ''
  if (!body) return null
  const out: CategoryText = { mode: r.mode === 'page' ? 'page' : 'short', body }
  const tr = r.tr && typeof r.tr === 'object' ? (r.tr as Record<string, unknown>) : null
  if (tr && typeof r.src === 'string') {
    const t: Partial<Record<TargetLang, string>> = {}
    for (const l of TARGET_LANGS) if (typeof tr[l] === 'string' && (tr[l] as string).trim()) t[l] = (tr[l] as string).slice(0, MAX_CATEGORY_TEXT * 2)
    if (Object.keys(t).length) { out.tr = t; out.src = r.src }
  }
  return out
}

/** Descrizioni delle categorie da menus.text_content. */
export function parseCategoryTexts(textContent: unknown): CategoryTexts {
  const raw = (textContent as { categories?: unknown } | null)?.categories
  const out: CategoryTexts = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [name, v] of Object.entries(raw as Record<string, unknown>)) {
    const c = cleanCategoryText(v)
    if (c) out[name] = c
  }
  return out
}

/** Il testo nella lingua scelta (traduzione solo se aggiornata). */
export function categoryTextIn(c: CategoryText, lang: Lang): string {
  if (lang === 'it') return c.body
  const t = c.src === c.body ? c.tr?.[lang as TargetLang] : undefined
  return t?.trim() ? t : c.body
}

export interface TextRunLite { text: string; bold?: boolean; italic?: boolean }

/** Paragrafi (riga vuota = nuovo paragrafo) con a capo, *corsivo* e **grassetto**. */
export function categoryTextRuns(body: string): TextRunLite[][] {
  return body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => {
    const runs: TextRunLite[] = []
    const re = /\*\*([^*]+)\*\*|\*([^*\n]+)\*/g
    let last = 0, m: RegExpExecArray | null
    while ((m = re.exec(p))) {
      if (m.index > last) runs.push({ text: p.slice(last, m.index) })
      runs.push(m[1] !== undefined ? { text: m[1], bold: true } : { text: m[2], italic: true })
      last = m.index + m[0].length
    }
    if (last < p.length) runs.push({ text: p.slice(last) })
    return runs
  })
}
