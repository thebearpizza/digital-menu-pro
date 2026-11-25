// ─────────────────────────────────────────────────────────────────────────────
// Salvataggio delle descrizioni delle categorie (solo server: usa il motore di
// traduzione). Scrive menus.text_content.categories lasciando intatto il resto
// (pagina informativa, allergeni). Un testo nuovo o cambiato viene tradotto
// subito; se la traduzione non riesce si salva lo stesso e le altre lingue
// mostrano l'italiano finché il testo non si salva di nuovo.
// ─────────────────────────────────────────────────────────────────────────────

import { translateEnabled, translateItems } from './translateEngine'
import { TARGET_LANGS, type TargetLang } from './translations'
import { cleanCategoryText, type CategoryText, type CategoryTextMode } from './categoryText'

type Supa = { from: (t: string) => any }   // client Supabase del gestionale

export type CategoryTextInput = { mode: CategoryTextMode; body: string } | null

/** Applica le modifiche (null o testo vuoto = togli la descrizione). */
export async function saveCategoryTexts(supabase: Supa, menuId: string, changes: Record<string, CategoryTextInput>): Promise<void> {
  const { data: menu, error: readErr } = await supabase.from('menus').select('text_content').eq('id', menuId).single()
  if (readErr || !menu) throw new Error('Menu non trovato.')
  const tc = { ...((menu.text_content ?? {}) as Record<string, unknown>) }
  const cats = { ...((tc.categories ?? {}) as Record<string, unknown>) }

  const toTranslate: { id: string; text: string }[] = []
  const next: Record<string, CategoryText> = {}
  for (const [name, input] of Object.entries(changes)) {
    const clean = cleanCategoryText(input)
    if (!clean) { delete cats[name]; continue }
    // Traduzione ancora valida se il testo non è cambiato.
    const prev = cleanCategoryText(cats[name])
    if (prev?.tr && prev.src === clean.body) { clean.tr = prev.tr; clean.src = prev.src }
    else toTranslate.push({ id: name, text: clean.body })
    next[name] = clean
  }
  if (toTranslate.length && translateEnabled()) {
    try {
      const res = await translateItems(toTranslate)
      for (const it of toTranslate) {
        const t: Partial<Record<TargetLang, string>> = {}
        for (const l of TARGET_LANGS) { const v = res[it.id]?.[l]; if (v) t[l] = v }
        if (Object.keys(t).length) { next[it.id].tr = t; next[it.id].src = it.text }
      }
    } catch (e: any) { console.error('category text translate failed', menuId, e?.message) }
  }
  Object.assign(cats, next)
  tc.categories = cats
  const { error } = await supabase.from('menus').update({ text_content: tc }).eq('id', menuId)
  if (error) throw new Error('Salvataggio non riuscito, riprova.')
}

/** Rinomina (to = nome nuovo) o toglie (to = null) la descrizione di una categoria. */
export function moveCategoryText(textContent: unknown, from: string, to: string | null): Record<string, unknown> | null {
  const tc = (textContent ?? {}) as Record<string, unknown>
  const cats = (tc.categories ?? {}) as Record<string, unknown>
  if (!(from in cats)) return null
  const nextCats = { ...cats }
  if (to) nextCats[to] = nextCats[from]
  delete nextCats[from]
  return { ...tc, categories: nextCats }
}
