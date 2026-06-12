'use server'
// ─────────────────────────────────────────────────────────────────────────────
// Server actions per le traduzioni native del menu (en/fr/de/es).
//
// ensureMenuTranslations: pre-genera (Gemini) le traduzioni mancanti di nome
// menu, categorie e piatti. Non tocca MAI i campi marcati `manual` (override
// del ristoratore). I fallimenti del traduttore lasciano i campi vuoti: si
// rigenerano alla chiamata successiva, il pubblico nel frattempo vede l'italiano.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { translateItems, translateEnabled } from '@/lib/translateEngine'
import {
  TARGET_LANGS, type TargetLang,
  type DishTranslations, type MenuTranslations,
} from '@/lib/translations'

async function verifyOwnership(supabase: any, restaurantId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')
  const { data: r } = await supabase
    .from('restaurants').select('id').eq('id', restaurantId).eq('owner_id', user.id).single()
  if (!r) throw new Error('Non autorizzato')
  return user
}

export interface TranslationDish {
  id: string
  name: string
  description: string | null
  category: string | null
  translations: DishTranslations
}

export interface TranslationSnapshot {
  menuName:         string
  menuTranslations: MenuTranslations
  categories:       string[]            // nomi italiani, nell'ordine dell'editor
  dishes:           TranslationDish[]
  engineEnabled:    boolean
}

/** Categorie nell'ordine dell'editor: prima category_order, poi le altre. */
function orderedCategories(dishes: { category: string | null }[], order: string[] | null): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of order ?? []) { if (!seen.has(c)) { seen.add(c); out.push(c) } }
  for (const d of dishes) {
    const c = d.category
    if (c && !seen.has(c)) { seen.add(c); out.push(c) }
  }
  return out
}

/**
 * Pre-genera le traduzioni mancanti dell'intero menu e ritorna lo snapshot
 * aggiornato per il pannello traduzioni dell'admin.
 */
export async function ensureMenuTranslations(
  restaurantId: string, menuId: string,
): Promise<TranslationSnapshot> {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const [{ data: menu }, { data: dishes }] = await Promise.all([
    supabase.from('menus')
      .select('id, name, category_order, translations')
      .eq('id', menuId).eq('restaurant_id', restaurantId).single(),
    supabase.from('dishes')
      .select('id, name, description, category, translations, sort_order')
      .eq('menu_id', menuId)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true }),
  ])
  if (!menu) throw new Error('Menu non trovato')

  const dishList: TranslationDish[] = (dishes ?? []).map(d => ({
    id: d.id, name: d.name, description: d.description,
    category: d.category, translations: (d.translations ?? {}) as DishTranslations,
  }))
  const menuTr   = (menu.translations ?? {}) as MenuTranslations
  const cats     = orderedCategories(dishList, menu.category_order as string[] | null)
  const snapshot = (): TranslationSnapshot => ({
    menuName: menu.name, menuTranslations: menuTr,
    categories: cats, dishes: dishList, engineEnabled: translateEnabled(),
  })

  if (!translateEnabled()) return snapshot()

  // ── Raccogli i testi con almeno una lingua mancante (e non manuale) ────────
  const items: { id: string; text: string }[] = []
  const missingLangs = (has: (l: TargetLang) => boolean) => TARGET_LANGS.some(l => !has(l))

  if (missingLangs(l => !!menuTr[l]?.name)) items.push({ id: 'menu:name', text: menu.name })
  for (const c of cats) {
    if (missingLangs(l => !!menuTr[l]?.categories?.[c])) items.push({ id: `cat:${c}`, text: c })
  }
  for (const d of dishList) {
    if (missingLangs(l => !!d.translations[l]?.name)) items.push({ id: `dish:${d.id}:name`, text: d.name })
    if (d.description && missingLangs(l => !!d.translations[l]?.description)) {
      items.push({ id: `dish:${d.id}:desc`, text: d.description })
    }
  }
  if (!items.length) return snapshot()

  const res = await translateItems(items)

  // ── Merge: riempi SOLO i campi mancanti e non manuali ─────────────────────
  let menuChanged = false
  for (const lang of TARGET_LANGS) {
    const entry = menuTr[lang] ?? (menuTr[lang] = {})
    const n = res['menu:name']?.[lang]
    if (n && !entry.name && !entry.manual?.name) { entry.name = n; menuChanged = true }
    for (const c of cats) {
      const t = res[`cat:${c}`]?.[lang]
      if (!t) continue
      const catMap = entry.categories ?? (entry.categories = {})
      if (!catMap[c] && !entry.manual?.categories?.[c]) { catMap[c] = t; menuChanged = true }
    }
  }
  if (menuChanged) {
    await supabase.from('menus').update({ translations: menuTr }).eq('id', menuId)
  }

  const dishUpdates: PromiseLike<any>[] = []
  for (const d of dishList) {
    let changed = false
    for (const lang of TARGET_LANGS) {
      const entry = d.translations[lang] ?? (d.translations[lang] = {})
      const n = res[`dish:${d.id}:name`]?.[lang]
      if (n && !entry.name && !entry.manual?.name) { entry.name = n; changed = true }
      const ds = res[`dish:${d.id}:desc`]?.[lang]
      if (ds && !entry.description && !entry.manual?.description) { entry.description = ds; changed = true }
    }
    if (changed) {
      dishUpdates.push(
        supabase.from('dishes').update({ translations: d.translations }).eq('id', d.id)
      )
    }
  }
  if (dishUpdates.length) await Promise.all(dishUpdates)

  revalidatePath(`/admin/restaurants/${restaurantId}/menus/${menuId}`)
  return snapshot()
}

/**
 * Override manuale di nome/descrizione tradotti di un piatto. Stringa vuota =
 * rimuove l'override (il campo torna automatico e viene rigenerato subito).
 * Ritorna le traduzioni aggiornate del piatto.
 */
export async function saveDishTranslation(
  restaurantId: string, menuId: string, dishId: string, lang: TargetLang,
  patch: { name?: string; description?: string },
): Promise<DishTranslations> {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: dish } = await supabase
    .from('dishes').select('name, description, translations')
    .eq('id', dishId).eq('menu_id', menuId).single()
  if (!dish) throw new Error('Piatto non trovato')

  const tr = (dish.translations ?? {}) as DishTranslations
  const entry = tr[lang] ?? (tr[lang] = {})
  const manual = entry.manual ?? (entry.manual = {})

  const cleared: { id: string; text: string }[] = []
  if (patch.name !== undefined) {
    const v = patch.name.trim()
    if (v) { entry.name = v; manual.name = true }
    else {
      delete entry.name; delete manual.name
      cleared.push({ id: 'name', text: dish.name })
    }
  }
  if (patch.description !== undefined) {
    const v = patch.description.trim()
    if (v) { entry.description = v; manual.description = true }
    else {
      delete entry.description; delete manual.description
      if (dish.description) cleared.push({ id: 'desc', text: dish.description })
    }
  }

  // Campi svuotati → rigenera subito la traduzione automatica (best effort).
  if (cleared.length && translateEnabled()) {
    try {
      const res = await translateItems(cleared)
      const n = res['name']?.[lang];  if (n)  entry.name = n
      const d2 = res['desc']?.[lang]; if (d2) entry.description = d2
    } catch (e: any) { console.error('saveDishTranslation regen failed', e?.message) }
  }

  const { error } = await supabase.from('dishes').update({ translations: tr }).eq('id', dishId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${restaurantId}/menus/${menuId}`)
  return tr
}

/** Override manuale del nome tradotto di una categoria (vuoto = rigenera). */
export async function saveCategoryTranslation(
  restaurantId: string, menuId: string, lang: TargetLang,
  itName: string, value: string,
): Promise<MenuTranslations> {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: menu } = await supabase
    .from('menus').select('translations')
    .eq('id', menuId).eq('restaurant_id', restaurantId).single()
  if (!menu) throw new Error('Menu non trovato')

  const tr = (menu.translations ?? {}) as MenuTranslations
  const entry  = tr[lang] ?? (tr[lang] = {})
  const cats   = entry.categories ?? (entry.categories = {})
  const manual = entry.manual ?? (entry.manual = {})
  const manualCats = manual.categories ?? (manual.categories = {})

  const v = value.trim()
  if (v) { cats[itName] = v; manualCats[itName] = true }
  else {
    delete cats[itName]; delete manualCats[itName]
    if (translateEnabled()) {
      try {
        const res = await translateItems([{ id: 'cat', text: itName }])
        const t = res['cat']?.[lang]; if (t) cats[itName] = t
      } catch (e: any) { console.error('saveCategoryTranslation regen failed', e?.message) }
    }
  }

  const { error } = await supabase.from('menus').update({ translations: tr }).eq('id', menuId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${restaurantId}/menus/${menuId}`)
  return tr
}

/** Override manuale del nome tradotto del menu (vuoto = rigenera). */
export async function saveMenuNameTranslation(
  restaurantId: string, menuId: string, lang: TargetLang, value: string,
): Promise<MenuTranslations> {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: menu } = await supabase
    .from('menus').select('name, translations')
    .eq('id', menuId).eq('restaurant_id', restaurantId).single()
  if (!menu) throw new Error('Menu non trovato')

  const tr = (menu.translations ?? {}) as MenuTranslations
  const entry  = tr[lang] ?? (tr[lang] = {})
  const manual = entry.manual ?? (entry.manual = {})

  const v = value.trim()
  if (v) { entry.name = v; manual.name = true }
  else {
    delete entry.name; delete manual.name
    if (translateEnabled()) {
      try {
        const res = await translateItems([{ id: 'name', text: menu.name }])
        const t = res['name']?.[lang]; if (t) entry.name = t
      } catch (e: any) { console.error('saveMenuNameTranslation regen failed', e?.message) }
    }
  }

  const { error } = await supabase.from('menus').update({ translations: tr }).eq('id', menuId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${restaurantId}/menus/${menuId}`)
  return tr
}
