'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ALLERGENS, type AllergenOverride } from '@/lib/allergens'
import { translateEnabled, translateItems } from '@/lib/translateEngine'

export interface AllergenEdit { id: number; number: number; name: string }

/** Salva nomi/numeri allergeni dell'account. Solo le voci diverse dallo standard. */
export async function saveAllergenOverrides(edits: AllergenEdit[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sessione scaduta: accedi di nuovo.' }

  const byId = new Map(edits.map(e => [Number(e.id), e]))
  const seen = new Set<number>()
  const rows = ALLERGENS.map(a => {
    const e = byId.get(a.id)
    const number = Math.round(Number(e?.number ?? a.id))
    const name = String(e?.name ?? a.name).trim()
    return { id: a.id, number, name, defaultName: a.name }
  })
  for (const r of rows) {
    if (!Number.isFinite(r.number) || r.number < 1 || r.number > 99) return { ok: false, error: `Numero non valido per "${r.defaultName}" (usa 1–99).` }
    if (seen.has(r.number)) return { ok: false, error: `Il numero ${r.number} è usato da più allergeni.` }
    seen.add(r.number)
    if (!r.name) return { ok: false, error: `Il nome di "${r.defaultName}" non può essere vuoto.` }
    if (r.name.length > 60) return { ok: false, error: `Il nome "${r.name}" è troppo lungo (max 60 caratteri).` }
  }

  const { data: prev } = await supabase.from('allergen_overrides').select('items').eq('user_id', user.id).maybeSingle()
  const prevItems = (prev?.items as AllergenOverride[] | undefined) ?? []

  const items: AllergenOverride[] = []
  const toTranslate: { id: string; text: string }[] = []
  for (const r of rows) {
    const renamed = r.name !== r.defaultName
    if (!renamed && r.number === r.id) continue
    const item: AllergenOverride = { id: r.id }
    if (r.number !== r.id) item.number = r.number
    if (renamed) {
      item.name = r.name
      const old = prevItems.find(p => p.id === r.id)
      if (old?.name === r.name && old.i18n) item.i18n = old.i18n
      else toTranslate.push({ id: String(r.id), text: r.name })
    }
    items.push(item)
  }

  if (toTranslate.length && translateEnabled()) {
    try {
      const tr = await translateItems(toTranslate)
      for (const item of items) {
        const t = tr[String(item.id)]
        if (t && item.name) item.i18n = t
      }
    } catch {
      // Traduzione non disponibile: nelle altre lingue resta il nome italiano.
    }
  }

  const { error } = await supabase
    .from('allergen_overrides')
    .upsert({ user_id: user.id, items, updated_at: new Date().toISOString() })
  if (error) return { ok: false, error: 'Salvataggio non riuscito, riprova.' }

  revalidatePath('/admin', 'layout')
  return { ok: true }
}
