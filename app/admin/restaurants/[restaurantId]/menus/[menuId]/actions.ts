'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function verifyOwnership(supabase: any, restaurantId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')
  const { data: r } = await supabase
    .from('restaurants').select('id').eq('id', restaurantId).eq('owner_id', user.id).single()
  if (!r) throw new Error('Non autorizzato')
  return user
}

function revalidate(restaurantId: string, menuId: string) {
  revalidatePath(`/admin/restaurants/${restaurantId}/menus/${menuId}`)
}

export async function createDish(
  restaurantId: string,
  menuId: string,
  data: {
    name: string
    description: string
    price: string
    category: string
    image_url: string
    allergens: number[]
    pairing_dish_id: string | null
  }
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const price = data.price ? parseFloat(data.price) : null

  const { data: last } = await supabase
    .from('dishes').select('sort_order').eq('menu_id', menuId)
    .order('sort_order', { ascending: false }).limit(1).single()

  const { data: dish, error } = await supabase
    .from('dishes')
    .insert({
      restaurant_id: restaurantId,
      menu_id:       menuId,
      name:          data.name,
      description:   data.description || null,
      price:         price !== null && !isNaN(price) ? price : null,
      category:      data.category || null,
      image_url:     data.image_url || null,
      allergens:     data.allergens,
      pairing_dish_id: data.pairing_dish_id || null,
      is_active:     true,
      sort_order:    (last?.sort_order ?? -1) + 1,
    })
    .select('id, name, description, price, category, image_url, allergens, sort_order, is_active, pairing_dish_id, pairing_label')
    .single()

  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
  return dish
}

export async function updateDish(
  restaurantId: string,
  menuId: string,
  dishId: string,
  data: {
    name: string
    description: string
    price: string
    category: string
    image_url: string
    allergens: number[]
    pairing_dish_id: string | null
  }
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const price = data.price ? parseFloat(data.price) : null

  const { data: dish, error } = await supabase
    .from('dishes')
    .update({
      name:          data.name,
      description:   data.description || null,
      price:         price !== null && !isNaN(price) ? price : null,
      category:      data.category || null,
      image_url:     data.image_url || null,
      allergens:     data.allergens,
      pairing_dish_id: data.pairing_dish_id || null,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', dishId)
    .select('id, name, description, price, category, image_url, allergens, sort_order, is_active, pairing_dish_id, pairing_label')
    .single()

  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
  return dish
}

export async function deleteDish(restaurantId: string, menuId: string, dishId: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase.from('dishes').delete().eq('id', dishId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
}

export async function reorderCategories(
  restaurantId: string,
  menuId: string,
  categoryOrder: string[]
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase
    .from('menus')
    .update({ category_order: categoryOrder })
    .eq('id', menuId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
}

/** Elimina una categoria e tutti i piatti che contiene, poi la rimuove
 *  da category_order. "Senza categoria" raggruppa i piatti con category null. */
export async function deleteCategory(restaurantId: string, menuId: string, category: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const isUncategorized = category === 'Senza categoria'
  const base = supabase.from('dishes').delete().eq('menu_id', menuId)
  const { error } = await (isUncategorized ? base.is('category', null) : base.eq('category', category))
  if (error) throw new Error(error.message)

  const { data: menu } = await supabase
    .from('menus').select('category_order').eq('id', menuId).single()
  const order = (menu?.category_order as string[] | null) ?? []
  if (order.includes(category)) {
    const { error: err2 } = await supabase
      .from('menus')
      .update({ category_order: order.filter(c => c !== category) })
      .eq('id', menuId)
    if (err2) throw new Error(err2.message)
  }
  revalidate(restaurantId, menuId)
}

/** Rinomina una categoria: aggiorna i piatti che la usano e category_order.
 *  Rinominare "Senza categoria" assegna la nuova categoria ai piatti senza. */
export async function renameCategory(
  restaurantId: string,
  menuId: string,
  oldName: string,
  newName: string,
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const isUncategorized = oldName === 'Senza categoria'
  const base = supabase.from('dishes').update({ category: newName }).eq('menu_id', menuId)
  const { error } = await (isUncategorized ? base.is('category', null) : base.eq('category', oldName))
  if (error) throw new Error(error.message)

  const { data: menu } = await supabase
    .from('menus').select('category_order').eq('id', menuId).single()
  const order = (menu?.category_order as string[] | null) ?? []
  if (order.includes(oldName)) {
    const { error: err2 } = await supabase
      .from('menus')
      .update({ category_order: order.map(c => (c === oldName ? newName : c)) })
      .eq('id', menuId)
    if (err2) throw new Error(err2.message)
  }
  revalidate(restaurantId, menuId)
}

/** Imposta lo stesso prezzo su più piatti in un colpo solo (selezione multipla). */
export async function bulkUpdateDishPrices(
  restaurantId: string,
  menuId: string,
  dishIds: string[],
  price: number | null,
) {
  if (!dishIds.length) return
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase
    .from('dishes')
    .update({ price, updated_at: new Date().toISOString() })
    .eq('menu_id', menuId)
    .in('id', dishIds)
  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
}

/** Import in blocco da modulo Excel: crea i piatti ricevuti (già validati lato
 *  client) accodandoli al menu. L'abbinamento è risolto per nome piatto, prima
 *  fra i piatti esistenti del menu, poi fra quelli appena creati. */
export async function bulkCreateDishes(
  restaurantId: string,
  menuId: string,
  rows: {
    name: string
    description: string | null
    price: number | null
    category: string
    image_url: string | null
    allergens: number[]
    pairing_name: string | null
    is_active: boolean
  }[],
) {
  if (!rows.length) return []
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: last } = await supabase
    .from('dishes').select('sort_order').eq('menu_id', menuId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()
  let sort = (last?.sort_order ?? -1) + 1

  const { data: created, error } = await supabase
    .from('dishes')
    .insert(rows.map(r => ({
      restaurant_id: restaurantId,
      menu_id:       menuId,
      name:          r.name,
      description:   r.description,
      price:         r.price,
      category:      r.category || null,
      image_url:     r.image_url,
      allergens:     r.allergens,
      is_active:     r.is_active,
      sort_order:    sort++,
    })))
    .select('id, name, description, price, category, image_url, allergens, sort_order, is_active, pairing_dish_id, pairing_label')
  if (error) throw new Error(error.message)

  // Seconda passata: risolvi gli abbinamenti per nome.
  const wantPairing = rows
    .map((r, i) => ({ r, dish: created?.[i] }))
    .filter(x => x.r.pairing_name && x.dish)
  if (wantPairing.length) {
    const { data: all } = await supabase
      .from('dishes').select('id, name').eq('menu_id', menuId)
    const byName = new Map((all ?? []).map(d => [String(d.name).trim().toLowerCase(), d.id]))
    for (const { r, dish } of wantPairing) {
      const targetId = byName.get(r.pairing_name!.trim().toLowerCase())
      if (targetId && targetId !== dish!.id) {
        await supabase.from('dishes').update({ pairing_dish_id: targetId }).eq('id', dish!.id)
        ;(dish as any).pairing_dish_id = targetId
      }
    }
  }

  revalidate(restaurantId, menuId)
  return created ?? []
}

// ── MODULO 4: riordino piatti, duplicazione, spostamento ────────────────────────

const DISH_COLUMNS =
  'id, name, description, price, category, image_url, allergens, sort_order, is_active, pairing_dish_id, pairing_label, master_dish_id'

/** Riscrive sort_order = indice per ogni piatto, nell'ordine ricevuto. */
export async function reorderDishes(
  restaurantId: string,
  menuId: string,
  dishIds: string[]
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  await Promise.all(
    dishIds.map((id, i) =>
      supabase.from('dishes').update({ sort_order: i }).eq('id', id).eq('menu_id', menuId)
    )
  )
  revalidate(restaurantId, menuId)
}

/** Duplica un singolo piatto nello stesso menu, in coda. */
export async function duplicateDish(restaurantId: string, menuId: string, dishId: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: src } = await supabase
    .from('dishes')
    .select('name, description, price, category, image_url, allergens, pairing_dish_id')
    .eq('id', dishId).single()
  if (!src) throw new Error('Piatto non trovato')

  const { data: last } = await supabase
    .from('dishes').select('sort_order').eq('menu_id', menuId)
    .order('sort_order', { ascending: false }).limit(1).single()

  const { data: dish, error } = await supabase
    .from('dishes')
    .insert({
      restaurant_id: restaurantId,
      menu_id:       menuId,
      name:          `${src.name} (copia)`,
      description:   src.description,
      price:         src.price,
      category:      src.category,
      image_url:     src.image_url,
      allergens:     src.allergens,
      pairing_dish_id: src.pairing_dish_id,
      is_active:     true,
      sort_order:    (last?.sort_order ?? -1) + 1,
    })
    .select(DISH_COLUMNS)
    .single()

  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
  return dish
}

/** Duplica un'intera categoria: copia tutti i piatti in "<categoria> (copia)". */
export async function duplicateCategory(restaurantId: string, menuId: string, category: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const isUncategorized = category === 'Senza categoria'
  let q = supabase
    .from('dishes')
    .select('name, description, price, category, image_url, allergens, pairing_dish_id, sort_order')
    .eq('menu_id', menuId)
    .order('sort_order', { ascending: true })
  q = isUncategorized ? q.is('category', null) : q.eq('category', category)

  const { data: src } = await q
  const newCat = isUncategorized ? 'Senza categoria (copia)' : `${category} (copia)`
  if (!src?.length) return { category: newCat, dishes: [] }

  const { data: last } = await supabase
    .from('dishes').select('sort_order').eq('menu_id', menuId)
    .order('sort_order', { ascending: false }).limit(1).single()
  const base = (last?.sort_order ?? -1) + 1

  const rows = src.map((d, i) => ({
    restaurant_id: restaurantId,
    menu_id:       menuId,
    name:          d.name,
    description:   d.description,
    price:         d.price,
    category:      newCat,
    image_url:     d.image_url,
    allergens:     d.allergens,
    pairing_dish_id: d.pairing_dish_id,
    is_active:     true,
    sort_order:    base + i,
  }))

  const { data: created, error } = await supabase.from('dishes').insert(rows).select(DISH_COLUMNS)
  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
  return { category: newCat, dishes: created ?? [] }
}

/** Sposta un piatto in un altro menu (in coda al menu di destinazione). */
export async function moveDishToMenu(
  restaurantId: string,
  fromMenuId: string,
  dishId: string,
  toMenuId: string
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: last } = await supabase
    .from('dishes').select('sort_order').eq('menu_id', toMenuId)
    .order('sort_order', { ascending: false }).limit(1).single()

  const { error } = await supabase
    .from('dishes')
    .update({ menu_id: toMenuId, sort_order: (last?.sort_order ?? -1) + 1 })
    .eq('id', dishId)
  if (error) throw new Error(error.message)

  revalidate(restaurantId, fromMenuId)
  revalidate(restaurantId, toMenuId)
}

// ── MODULO 5: sync banner per nome (rilevamento gemelli + propagazione) ──────────

export interface DishTwin {
  id: string
  menu_id: string
  menuName: string
  name: string
  description: string | null
  price: number | null
  image_url: string | null
  allergens: number[]
  category: string | null
}

/** Trova piatti con lo stesso nome (case-insensitive) in altri menu dello stesso ristorante. */
export async function findDishTwins(restaurantId: string, menuId: string, dishId: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: source } = await supabase
    .from('dishes')
    .select('id, menu_id, name, description, price, image_url, allergens, category')
    .eq('id', dishId).single()
  if (!source) return { source: null, twins: [] as DishTwin[] }

  const { data: twins } = await supabase
    .from('dishes')
    .select('id, menu_id, name, description, price, image_url, allergens, category')
    .eq('restaurant_id', restaurantId)
    .neq('id', dishId)
    .neq('menu_id', menuId)
    .ilike('name', source.name)

  const menuIds = Array.from(new Set((twins ?? []).map(t => t.menu_id)))
  let menuNames: Record<string, string> = {}
  if (menuIds.length) {
    const { data: menus } = await supabase.from('menus').select('id, name').in('id', menuIds)
    menuNames = Object.fromEntries((menus ?? []).map(m => [m.id, m.name]))
  }

  return {
    source,
    twins: (twins ?? []).map(t => ({ ...t, menuName: menuNames[t.menu_id] ?? 'Menu' })) as DishTwin[],
  }
}

/** Propaga i campi selezionati dal piatto sorgente ai gemelli indicati. */
export async function applyDishSync(
  restaurantId: string,
  sourceDishId: string,
  targetIds: string[],
  fields: string[]
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  if (!targetIds.length || !fields.length) return

  const { data: source } = await supabase
    .from('dishes')
    .select('description, price, image_url, allergens, category')
    .eq('id', sourceDishId).single()
  if (!source) throw new Error('Piatto non trovato')

  const patch: Record<string, any> = {}
  if (fields.includes('description')) patch.description = source.description
  if (fields.includes('price'))       patch.price       = source.price
  if (fields.includes('image_url'))   patch.image_url   = source.image_url
  if (fields.includes('allergens'))   patch.allergens   = source.allergens
  if (fields.includes('category'))    patch.category    = source.category
  if (Object.keys(patch).length === 0) return

  const { error } = await supabase.from('dishes').update(patch).in('id', targetIds)
  if (error) throw new Error(error.message)

  // I gemelli vivono in menu diversi: rivalidiamo l'intero template della pagina menu.
  revalidatePath('/admin/restaurants/[restaurantId]/menus/[menuId]', 'page')
}

// ── MODULO 3: soft-delete toggle (is_active) + sposta categoria ─────────────────

export async function toggleDishActive(
  restaurantId: string,
  menuId: string,
  dishId: string,
  active: boolean
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase
    .from('dishes').update({ is_active: active }).eq('id', dishId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
}

export async function toggleCategoryActive(
  restaurantId: string,
  menuId: string,
  category: string,
  active: boolean
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const isUncategorized = category === 'Senza categoria'
  const base = supabase.from('dishes').update({ is_active: active }).eq('menu_id', menuId)
  const { error } = await (isUncategorized ? base.is('category', null) : base.eq('category', category))
  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
}

/** Sposta tutti i piatti di una categoria in un altro menu. */
export async function moveCategoryToMenu(
  restaurantId: string,
  fromMenuId: string,
  category: string,
  toMenuId: string
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const isUncategorized = category === 'Senza categoria'
  const qSrc = supabase.from('dishes').select('id').eq('menu_id', fromMenuId)
  const { data: srcDishes } = await (isUncategorized ? qSrc.is('category', null) : qSrc.eq('category', category))
  if (!srcDishes?.length) return

  const { data: last } = await supabase
    .from('dishes').select('sort_order').eq('menu_id', toMenuId)
    .order('sort_order', { ascending: false }).limit(1).single()
  const base = (last?.sort_order ?? -1) + 1

  await Promise.all(
    srcDishes.map((d, i) =>
      supabase.from('dishes').update({ menu_id: toMenuId, sort_order: base + i }).eq('id', d.id)
    )
  )

  revalidate(restaurantId, fromMenuId)
  revalidate(restaurantId, toMenuId)
}

export async function syncDishToMasters(
  restaurantId: string,
  dishId: string,
  masterDishId: string,
  fields: string[]
) {
  const supabase = await createClient()
  const user = await verifyOwnership(supabase, restaurantId)

  const { data: source } = await supabase
    .from('dishes').select('name, description, price, image_url, allergens').eq('id', dishId).single()
  if (!source) throw new Error('Piatto non trovato')

  const { data: targets } = await supabase
    .from('dishes').select('id').eq('master_dish_id', masterDishId).neq('id', dishId)
  if (!targets?.length) return

  const patch: Record<string, any> = {}
  if (fields.includes('name'))        patch.name        = source.name
  if (fields.includes('description')) patch.description = source.description
  if (fields.includes('price'))       patch.price       = source.price
  if (fields.includes('image_url'))   patch.image_url   = source.image_url
  if (fields.includes('allergens'))   patch.allergens   = source.allergens

  if (Object.keys(patch).length === 0) return

  await supabase
    .from('dishes').update(patch)
    .in('id', targets.map(t => t.id))

  // Log sync
  await supabase.from('sync_logs').insert({
    restaurant_id: restaurantId,
    source_dish_id: dishId,
    target_dish_id: targets[0].id,
    synced_fields: fields,
    performed_by: user.id,
  })
}
