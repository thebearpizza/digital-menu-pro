'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { translateItems, translateEnabled } from '@/lib/translateEngine'
import { TARGET_LANGS, type MenuTranslations } from '@/lib/translations'

async function verifyOwnership(supabase: any, restaurantId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')
  const { data: r } = await supabase
    .from('restaurants').select('id').eq('id', restaurantId).eq('owner_id', user.id).single()
  if (!r) throw new Error('Non autorizzato')
  return user
}

function revalidate(restaurantId: string) {
  revalidatePath(`/admin/restaurants/${restaurantId}/menus`)
}

/**
 * Rigenera la traduzione automatica del nome del menu (override manuali
 * preservati). Best effort: mai bloccante per il salvataggio.
 */
async function autoTranslateMenuName(supabase: any, menuId: string, name: string) {
  if (!translateEnabled()) return
  try {
    const { data: menu } = await supabase
      .from('menus').select('translations').eq('id', menuId).single()
    const tr = (menu?.translations ?? {}) as MenuTranslations
    const res = await translateItems([{ id: 'name', text: name }])
    let changed = false
    for (const lang of TARGET_LANGS) {
      const entry = tr[lang] ?? (tr[lang] = {})
      const t = res['name']?.[lang]
      if (t && !entry.manual?.name) { entry.name = t; changed = true }
    }
    if (changed) await supabase.from('menus').update({ translations: tr }).eq('id', menuId)
  } catch (e: any) { console.error('autoTranslateMenuName failed', e?.message) }
}

export async function createMenu(restaurantId: string, name: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: last } = await supabase
    .from('menus').select('sort_order').eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: false }).limit(1).single()

  const { data, error } = await supabase
    .from('menus')
    .insert({ restaurant_id: restaurantId, name, sort_order: (last?.sort_order ?? -1) + 1 })
    .select('id, name, sort_order, is_active, menu_type').single()

  if (error) throw new Error(error.message)
  await autoTranslateMenuName(supabase, data.id, name)
  revalidate(restaurantId)
  return data
}

// ── Text menus ────────────────────────────────────────────────────────────────

const ALLERGENI_DEFAULT_TEXT = `ALLERGENI

Secondo il Regolamento UE 1169/2011, gli ingredienti e le sostanze che possono causare allergie o intolleranze devono essere riconoscibili nell'elenco degli ingredienti.

I 14 allergeni principali:

1. Cereali contenenti glutine (frumento, segale, orzo, avena, farro, kamut e i loro prodotti derivati)
2. Crostacei e prodotti a base di crostacei
3. Uova e prodotti a base di uova
4. Pesce e prodotti a base di pesce
5. Arachidi e prodotti a base di arachidi
6. Soia e prodotti a base di soia
7. Latte e prodotti a base di latte (incluso il lattosio)
8. Frutta a guscio: mandorle, nocciole, noci comuni, noci di acagiù, noci di pecan, noci del Brasile, pistacchi, noci macadamia e i loro prodotti
9. Sedano e prodotti a base di sedano
10. Senape e prodotti a base di senape
11. Semi di sesamo e prodotti a base di semi di sesamo
12. Anidride solforosa e solfiti in concentrazioni superiori a 10 mg/kg o 10 mg/L espressi come SO2
13. Lupini e prodotti a base di lupini
14. Molluschi e prodotti a base di molluschi

Per qualsiasi informazione sugli allergeni presenti nei nostri piatti, il nostro staff è a vostra disposizione.`

export async function createTextMenu(
  restaurantId: string,
  name: string,
  initialText?: string,
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: last } = await supabase
    .from('menus').select('sort_order').eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: false }).limit(1).single()

  const textContent = {
    body:       initialText ?? '',
    font:       'Helvetica',
    fontSize:   12,
    align:      'left',
    color:      '#1a1a1a',
    bold:       false,
    italic:     false,
    lineHeight: 1.6,
  }

  const { data, error } = await supabase
    .from('menus')
    .insert({
      restaurant_id: restaurantId,
      name,
      sort_order:    (last?.sort_order ?? -1) + 1,
      menu_type:     'text',
      text_content:  textContent,
    })
    .select('id, name, sort_order, is_active, menu_type, text_content').single()

  if (error) throw new Error(error.message)
  revalidate(restaurantId)
  return data
}

export async function createAllergenMenu(restaurantId: string) {
  return createTextMenu(restaurantId, 'Allergeni', ALLERGENI_DEFAULT_TEXT)
}

export async function createInfoMenu(restaurantId: string) {
  return createTextMenu(restaurantId, 'Info', '')
}

export async function updateTextContent(
  restaurantId: string,
  menuId: string,
  textContent: {
    body: string; font?: string; fontSize?: number
    align?: string; color?: string; bold?: boolean
    italic?: boolean; lineHeight?: number
  },
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { error } = await supabase
    .from('menus')
    .update({ text_content: textContent })
    .eq('id', menuId).eq('restaurant_id', restaurantId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${restaurantId}/menus/${menuId}/text-editor`)
}

export async function updateMenuName(restaurantId: string, menuId: string, name: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { error } = await supabase
    .from('menus').update({ name }).eq('id', menuId).eq('restaurant_id', restaurantId)
  if (error) throw new Error(error.message)
  await autoTranslateMenuName(supabase, menuId, name)
  revalidate(restaurantId)
}

/** Programmazione oraria: il menu è visibile al pubblico solo nella fascia
 *  from–until (ora italiana). Supporta fasce a cavallo di mezzanotte. */
export async function updateMenuSchedule(
  restaurantId: string,
  menuId: string,
  schedule: { enabled: boolean; from: string | null; until: string | null },
) {
  if (schedule.enabled && (!schedule.from || !schedule.until)) {
    throw new Error('Indica orario di inizio e di fine.')
  }
  if (schedule.enabled && schedule.from === schedule.until) {
    throw new Error('Orario di inizio e di fine coincidono: scegli una fascia valida.')
  }
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { error } = await supabase
    .from('menus')
    .update({
      schedule_enabled: schedule.enabled,
      schedule_from:    schedule.from,
      schedule_until:   schedule.until,
    })
    .eq('id', menuId).eq('restaurant_id', restaurantId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId)
}

export async function deleteMenu(restaurantId: string, menuId: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { error } = await supabase
    .from('menus').delete().eq('id', menuId).eq('restaurant_id', restaurantId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId)
}

export async function duplicateMenu(restaurantId: string, menuId: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: source } = await supabase
    .from('menus').select('name, sort_order, category_order, translations, menu_type, text_content').eq('id', menuId).single()
  if (!source) throw new Error('Menu non trovato')

  const { data: newMenu, error: menuErr } = await supabase
    .from('menus')
    .insert({
      restaurant_id: restaurantId,
      name: `${source.name} (Copia)`,
      sort_order: source.sort_order + 1,
      category_order: source.category_order,
      translations: source.translations ?? {},
      menu_type:    source.menu_type ?? 'dishes',
      text_content: source.text_content ?? null,
    })
    .select('id, name, sort_order, is_active, menu_type').single()
  if (menuErr) throw new Error(menuErr.message)

  // Only duplicate dishes for dish-type menus
  if ((source.menu_type ?? 'dishes') === 'dishes') {
    const { data: dishes } = await supabase
      .from('dishes')
      .select('name, description, price, category, image_url, allergens, sort_order, pairing_label, is_active, translations')
      .eq('menu_id', menuId)

    if (dishes?.length) {
      const { error: dishErr } = await supabase.from('dishes').insert(
        dishes.map(d => ({
          ...d,
          id: undefined,
          restaurant_id: restaurantId,
          menu_id: newMenu!.id,
          master_dish_id: null,
        }))
      )
      if (dishErr) throw new Error(`Menu copiato ma piatti non duplicati: ${dishErr.message}`)
    }
  }

  revalidate(restaurantId)
  return newMenu
}

export async function toggleMenuActive(restaurantId: string, menuId: string, active: boolean) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase
    .from('menus').update({ is_active: active }).eq('id', menuId).eq('restaurant_id', restaurantId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId)
}

export async function reorderMenus(restaurantId: string, orderedIds: string[]) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('menus').update({ sort_order: index }).eq('id', id).eq('restaurant_id', restaurantId)
    )
  )
  const failed = results.find(r => r.error)
  if (failed?.error) throw new Error(failed.error.message)
  revalidate(restaurantId)
}
