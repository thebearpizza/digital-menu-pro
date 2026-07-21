'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { translateItems, translateEnabled } from '@/lib/translateEngine'
import { TARGET_LANGS, type DishTranslations } from '@/lib/translations'

// ── Allergen AI detection ─────────────────────────────────────────────────────

const ALLERGEN_PROMPT = `Sei un esperto di allergeni alimentari EU (Reg. 1169/2011).
Analizza nome e descrizione di un piatto e restituisci gli id degli allergeni CHIARAMENTE presenti.

Mappa id → allergene:
1 Cereali e glutine (grano, farina, pasta, pane, orzo, segale, avena, farro, cous cous, pangrattato)
2 Crostacei (gamberi, astice, granchio, scampi, mazzancolle)
3 Uova (uovo, maionese, pasta all'uovo, frittata)
4 Pesce (pesce, tonno, salmone, acciuga, baccalà, branzino, orata, merluzzo)
5 Arachidi
6 Soia (tofu, edamame, miso, salsa di soia, tempeh)
7 Latte e latticini (latte, burro, panna, formaggio, mozzarella, parmigiano, grana, pecorino, ricotta, yogurt, besciamella)
8 Frutta a guscio (noci, nocciole, mandorle, pistacchi, anacardi, pinoli, noci di macadamia, castagne — NON arachidi)
9 Sedano (sedano, sedano rapa, gambi di sedano)
10 Senape (senape, curry)
11 Semi di sesamo (sesamo, tahini, pasta di sesamo)
12 Solfiti (vino, aceto di vino, alcune carni lavorate, frutta secca, mosto)
13 Lupini (farina di lupini, biscotti con lupini)
14 Molluschi (cozze, vongole, seppie, polpo, calamari, ostrica)

REGOLE:
- Includi un id SOLO se l'allergene è un ingrediente esplicito o altamente probabile dal nome/descrizione.
- Sii conservativo: non aggiungere allergeni per semplici tracce o rischi di contaminazione.
- Se nome e descrizione non menzionano ingredienti chiari, restituisci lista vuota.`

const GEMINI_MODELS = () => Array.from(new Set([
  process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
]))

const ALLERGEN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    allergen_ids: { type: 'ARRAY', items: { type: 'INTEGER' } },
  },
  required: ['allergen_ids'],
}

export async function detectAllergens(name: string, description: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini non configurato (GEMINI_API_KEY mancante).')

  const userText = `Nome: ${name.trim()}${description.trim() ? `\nDescrizione: ${description.trim()}` : ''}`

  for (const model of GEMINI_MODELS()) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: ALLERGEN_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: ALLERGEN_SCHEMA },
        }),
      }
    )
    if (res.status === 404) continue
    if (!res.ok) {
      const b = await res.text().catch(() => '')
      if (res.status === 503 || res.status === 429 || res.status >= 500) continue
      throw new Error(`Gemini ${res.status}: ${b.slice(0, 200)}`)
    }
    const body = await res.json().catch(() => null)
    const raw = body?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) throw new Error('Risposta Gemini vuota.')
    const ids: number[] = (JSON.parse(raw)?.allergen_ids ?? [])
      .map(Number)
      .filter((n: number) => Number.isInteger(n) && n >= 1 && n <= 14)
      .sort((a: number, b: number) => a - b)
    return ids
  }
  throw new Error('Gemini non disponibile.')
}

/**
 * Rigenera le traduzioni automatiche di nome+descrizione di un piatto,
 * preservando gli override manuali. Ritorna null se il traduttore non è
 * configurato. Best effort: i chiamanti avvolgono in try/catch — un errore
 * di traduzione non deve mai bloccare il salvataggio del piatto.
 */
async function autoDishTranslations(
  name: string, description: string | null, existing?: DishTranslations | null,
): Promise<DishTranslations | null> {
  if (!translateEnabled()) return null
  const items = [{ id: 'name', text: name }]
  if (description?.trim()) items.push({ id: 'desc', text: description })
  const res = await translateItems(items)
  const tr: DishTranslations = JSON.parse(JSON.stringify(existing ?? {}))
  for (const lang of TARGET_LANGS) {
    const entry = tr[lang] ?? (tr[lang] = {})
    const n = res['name']?.[lang]
    if (n && !entry.manual?.name) entry.name = n
    if (!entry.manual?.description) {
      const d = res['desc']?.[lang]
      if (d) entry.description = d
      else if (!description?.trim()) delete entry.description
    }
  }
  return tr
}

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
    // Ritaglio foto: l'originale intero resta salvato per poter riposizionare
    // il riquadro in seguito; image_url punta sempre alla versione ritagliata.
    image_original_url?: string | null
    image_crop?: { x: number; y: number; w: number; h: number } | null
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
      image_original_url: data.image_original_url || null,
      image_crop:    data.image_crop ?? null,
      allergens:     data.allergens,
      pairing_dish_id: data.pairing_dish_id || null,
      is_active:     true,
      sort_order:    (last?.sort_order ?? -1) + 1,
    })
    .select('id, name, description, price, category, image_url, image_original_url, image_crop, allergens, sort_order, is_active, pairing_dish_id, pairing_label')
    .single()

  if (error) throw new Error(error.message)

  // Pre-genera le traduzioni (en/fr/de/es/ru) — il menu pubblico non traduce mai
  // al volo. Best effort: se fallisce, ensureMenuTranslations recupera dopo.
  try {
    const tr = await autoDishTranslations(data.name, data.description || null)
    if (tr) await supabase.from('dishes').update({ translations: tr }).eq('id', dish.id)
  } catch (e: any) { console.error('createDish translate failed', e?.message) }

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
    image_original_url?: string | null
    image_crop?: { x: number; y: number; w: number; h: number } | null
    allergens: number[]
    pairing_dish_id: string | null
  }
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const price = data.price ? parseFloat(data.price) : null

  // Stato precedente: serve per capire se rigenerare le traduzioni automatiche.
  const { data: old } = await supabase
    .from('dishes').select('name, description, translations').eq('id', dishId).single()

  const { data: dish, error } = await supabase
    .from('dishes')
    .update({
      name:          data.name,
      description:   data.description || null,
      price:         price !== null && !isNaN(price) ? price : null,
      category:      data.category || null,
      image_url:     data.image_url || null,
      image_original_url: data.image_original_url || null,
      image_crop:    data.image_crop ?? null,
      allergens:     data.allergens,
      pairing_dish_id: data.pairing_dish_id || null,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', dishId)
    .select('id, name, description, price, category, image_url, image_original_url, image_crop, allergens, sort_order, is_active, pairing_dish_id, pairing_label')
    .single()

  if (error) throw new Error(error.message)

  // Nome o descrizione cambiati → le traduzioni automatiche sono stantie:
  // rigenerale (gli override manuali restano). Best effort, mai bloccante.
  const baseChanged = old &&
    (old.name !== data.name || (old.description ?? '') !== (data.description || ''))
  if (baseChanged) {
    try {
      const tr = await autoDishTranslations(
        data.name, data.description || null, old.translations as DishTranslations | null)
      if (tr) await supabase.from('dishes').update({ translations: tr }).eq('id', dishId)
    } catch (e: any) { console.error('updateDish translate failed', e?.message) }
  }

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
    .from('menus').select('category_order, category_schedules').eq('id', menuId).single()
  const order = (menu?.category_order as string[] | null) ?? []
  const catSched = ((menu?.category_schedules ?? {}) as Record<string, unknown>)
  const hadSched = category in catSched
  if (hadSched) delete catSched[category]
  if (order.includes(category) || hadSched) {
    const { error: err2 } = await supabase
      .from('menus')
      .update({
        category_order: order.filter(c => c !== category),
        ...(hadSched ? { category_schedules: catSched } : {}),
      })
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
    .from('menus').select('category_order, translations, category_schedules').eq('id', menuId).single()
  const order = (menu?.category_order as string[] | null) ?? []

  // La programmazione oraria della categoria è indicizzata per nome: il
  // rename deve spostare la chiave, altrimenti la fascia va persa.
  const catSched = ((menu?.category_schedules ?? {}) as Record<string, unknown>)
  let schedChanged = false
  if (oldName in catSched) {
    catSched[newName] = catSched[oldName]; delete catSched[oldName]; schedChanged = true
  }

  // Le traduzioni delle categorie sono indicizzate per nome italiano: il
  // rename deve spostare la chiave, altrimenti la traduzione va persa.
  const menuTr = (menu?.translations ?? {}) as Record<string, any>
  let trChanged = false
  for (const lang of Object.keys(menuTr)) {
    const cats = menuTr[lang]?.categories
    if (cats && oldName in cats) {
      cats[newName] = cats[oldName]; delete cats[oldName]; trChanged = true
    }
    const manualCats = menuTr[lang]?.manual?.categories
    if (manualCats && oldName in manualCats) {
      manualCats[newName] = manualCats[oldName]; delete manualCats[oldName]; trChanged = true
    }
  }

  if (order.includes(oldName) || trChanged || schedChanged) {
    const { error: err2 } = await supabase
      .from('menus')
      .update({
        category_order: order.map(c => (c === oldName ? newName : c)),
        ...(trChanged ? { translations: menuTr } : {}),
        ...(schedChanged ? { category_schedules: catSched } : {}),
      })
      .eq('id', menuId)
    if (err2) throw new Error(err2.message)
  }
  revalidate(restaurantId, menuId)
}

// ── Programmazione oraria: piatti e categorie ─────────────────────────────────
// Stessa semantica dei menu: fuori dalla fascia (ora italiana, fasce a cavallo
// di mezzanotte supportate) l'elemento sparisce dal menu pubblico.

function validateSchedule(schedule: { enabled: boolean; from: string | null; until: string | null }) {
  if (schedule.enabled && (!schedule.from || !schedule.until)) {
    throw new Error('Indica orario di inizio e di fine.')
  }
  if (schedule.enabled && schedule.from === schedule.until) {
    throw new Error('Orario di inizio e di fine coincidono: scegli una fascia valida.')
  }
}

export async function updateDishSchedule(
  restaurantId: string,
  menuId: string,
  dishId: string,
  schedule: { enabled: boolean; from: string | null; until: string | null },
) {
  validateSchedule(schedule)
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase
    .from('dishes')
    .update({
      schedule_enabled: schedule.enabled,
      schedule_from:    schedule.enabled ? schedule.from : null,
      schedule_until:   schedule.enabled ? schedule.until : null,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', dishId)
    .eq('menu_id', menuId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
}

export async function updateCategorySchedule(
  restaurantId: string,
  menuId: string,
  category: string,
  schedule: { enabled: boolean; from: string | null; until: string | null },
) {
  validateSchedule(schedule)
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { data: menu, error: readErr } = await supabase
    .from('menus').select('category_schedules').eq('id', menuId).single()
  if (readErr) throw new Error(readErr.message)
  const schedules = ((menu?.category_schedules ?? {}) as Record<string, unknown>)
  if (schedule.enabled) {
    schedules[category] = { enabled: true, from: schedule.from, until: schedule.until }
  } else {
    delete schedules[category]  // spenta = nessuna voce: JSONB pulito
  }
  const { error } = await supabase
    .from('menus').update({ category_schedules: schedules }).eq('id', menuId)
  if (error) throw new Error(error.message)
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
        const { error: pairErr } = await supabase
          .from('dishes').update({ pairing_dish_id: targetId }).eq('id', dish!.id)
        if (!pairErr) (dish as any).pairing_dish_id = targetId
      }
    }
  }

  // Terza passata: pre-genera le traduzioni di piatti e nuove categorie in blocco.
  // TIME-BOX: su import massivi la traduzione (Gemini, a chunk sequenziali con
  // retry) può richiedere molti secondi e bloccare la risposta del server action
  // → il pulsante "Importa modulo" sembra non funzionare (spinner all'infinito o
  // timeout serverless). I piatti sono GIÀ salvati: cappiamo l'attesa e lasciamo
  // che ensureMenuTranslations (apertura pannello traduzioni) recuperi il resto.
  if (translateEnabled() && created?.length) {
    const translateWork = (async () => {
      try {
        const newCats = Array.from(new Set(created.map(d => d.category).filter(Boolean))) as string[]
        const items = [
          ...created.flatMap(d => [
            { id: `${d.id}:name`, text: d.name as string },
            ...(d.description ? [{ id: `${d.id}:desc`, text: d.description as string }] : []),
          ]),
          ...newCats.map(c => ({ id: `cat:${c}`, text: c })),
        ]
        const res = await translateItems(items)

        await Promise.all(created.map(d => {
          const tr: DishTranslations = {}
          for (const lang of TARGET_LANGS) {
            const entry: NonNullable<DishTranslations[typeof lang]> = {}
            const n = res[`${d.id}:name`]?.[lang]
            if (n) entry.name = n
            const ds = res[`${d.id}:desc`]?.[lang]
            if (ds) entry.description = ds
            if (Object.keys(entry).length) tr[lang] = entry
          }
          return Object.keys(tr).length
            ? supabase.from('dishes').update({ translations: tr }).eq('id', d.id)
            : Promise.resolve(null)
        }))

        if (newCats.length) {
          const { data: menu } = await supabase
            .from('menus').select('translations').eq('id', menuId).single()
          const menuTr = (menu?.translations ?? {}) as Record<string, any>
          let changed = false
          for (const lang of TARGET_LANGS) {
            const entry = menuTr[lang] ?? (menuTr[lang] = {})
            const cats = entry.categories ?? (entry.categories = {})
            for (const c of newCats) {
              const t = res[`cat:${c}`]?.[lang]
              if (t && !cats[c] && !entry.manual?.categories?.[c]) { cats[c] = t; changed = true }
            }
          }
          if (changed) await supabase.from('menus').update({ translations: menuTr }).eq('id', menuId)
        }
      } catch (e: any) { console.error('bulkCreateDishes translate failed', e?.message) }
    })()
    // Non bloccare l'import oltre 5s sulle traduzioni (best effort).
    await Promise.race([translateWork, new Promise<void>(resolve => setTimeout(resolve, 5000))])
  }

  revalidate(restaurantId, menuId)
  return created ?? []
}

// ── MODULO 4: riordino piatti, duplicazione, spostamento ────────────────────────

const DISH_COLUMNS =
  'id, name, description, price, category, image_url, image_original_url, image_crop, allergens, sort_order, is_active, pairing_dish_id, pairing_label, master_dish_id, schedule_enabled, schedule_from, schedule_until'

/** Riscrive sort_order = indice per ogni piatto, nell'ordine ricevuto. */
export async function reorderDishes(
  restaurantId: string,
  menuId: string,
  dishIds: string[]
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const results = await Promise.all(
    dishIds.map((id, i) =>
      supabase.from('dishes').update({ sort_order: i }).eq('id', id).eq('menu_id', menuId)
    )
  )
  const failed = results.find(r => r.error)
  if (failed?.error) throw new Error(failed.error.message)
  revalidate(restaurantId, menuId)
}

/** Duplica un singolo piatto nello stesso menu, in coda. */
export async function duplicateDish(restaurantId: string, menuId: string, dishId: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: src } = await supabase
    .from('dishes')
    .select('name, description, price, category, image_url, image_original_url, image_crop, allergens, pairing_dish_id, translations')
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
      image_original_url: src.image_original_url,
      image_crop:    src.image_crop,
      allergens:     src.allergens,
      pairing_dish_id: src.pairing_dish_id,
      translations:  src.translations ?? {},
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
    .select('name, description, price, category, image_url, image_original_url, image_crop, allergens, pairing_dish_id, sort_order, translations')
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
    image_original_url: d.image_original_url,
    image_crop:    d.image_crop,
    allergens:     d.allergens,
    pairing_dish_id: d.pairing_dish_id,
    translations:  d.translations ?? {},
    is_active:     true,
    sort_order:    base + i,
  }))

  const { data: created, error } = await supabase.from('dishes').insert(rows).select(DISH_COLUMNS)
  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
  return { category: newCat, dishes: created ?? [] }
}

/** Sposta un piatto in un altro menu (in coda al menu di destinazione). */
export async function getMenuCategoriesForMove(restaurantId: string, menuId: string): Promise<string[]> {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { data } = await supabase
    .from('dishes').select('category').eq('menu_id', menuId).not('category', 'is', null)
  const cats = Array.from(new Set((data ?? []).map(d => d.category as string))).sort()
  return cats
}

export async function moveDishToMenu(
  restaurantId: string,
  fromMenuId: string,
  dishId: string,
  toMenuId: string,
  targetCategory?: string | null,
) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: last } = await supabase
    .from('dishes').select('sort_order').eq('menu_id', toMenuId)
    .order('sort_order', { ascending: false }).limit(1).single()

  const update: Record<string, unknown> = { menu_id: toMenuId, sort_order: (last?.sort_order ?? -1) + 1 }
  if (targetCategory != null) update.category = targetCategory

  const { error } = await supabase.from('dishes').update(update).eq('id', dishId)
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
    .select('description, price, image_url, image_original_url, image_crop, allergens, category, translations')
    .eq('id', sourceDishId).single()
  if (!source) throw new Error('Piatto non trovato')

  const patch: Record<string, any> = {}
  if (fields.includes('description')) patch.description = source.description
  if (fields.includes('price'))       patch.price       = source.price
  if (fields.includes('image_url')) {
    patch.image_url = source.image_url
    // La foto sincronizzata resta riposizionabile anche sui gemelli.
    patch.image_original_url = source.image_original_url
    patch.image_crop = source.image_crop
  }
  if (fields.includes('allergens'))   patch.allergens   = source.allergens
  if (fields.includes('category'))    patch.category    = source.category
  if (Object.keys(patch).length === 0) return

  const { error } = await supabase.from('dishes').update(patch).in('id', targetIds)
  if (error) throw new Error(error.message)

  // Descrizione sincronizzata → le traduzioni dei gemelli sono stantie:
  // propaga quelle del piatto sorgente (riferite al nuovo testo). Gli override
  // manuali dei gemelli decadono perché descrivevano il testo precedente.
  if (fields.includes('description')) {
    try {
      const srcTr = (source.translations ?? {}) as DishTranslations
      const { data: twins } = await supabase
        .from('dishes').select('id, translations').in('id', targetIds)
      await Promise.all((twins ?? []).map(t => {
        const tr = JSON.parse(JSON.stringify(t.translations ?? {})) as DishTranslations
        for (const lang of TARGET_LANGS) {
          const entry = tr[lang] ?? (tr[lang] = {})
          const srcDesc = srcTr[lang]?.description
          if (srcDesc) entry.description = srcDesc
          else delete entry.description
          if (entry.manual) delete entry.manual.description
        }
        return supabase.from('dishes').update({ translations: tr }).eq('id', t.id)
      }))
    } catch (e: any) { console.error('applyDishSync translations failed', e?.message) }
  }

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

  const results = await Promise.all(
    srcDishes.map((d, i) =>
      supabase.from('dishes').update({ menu_id: toMenuId, sort_order: base + i }).eq('id', d.id)
    )
  )
  const failed = results.find(r => r.error)
  if (failed?.error) throw new Error(failed.error.message)

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
    .from('dishes').select('name, description, price, image_url, image_original_url, image_crop, allergens, translations').eq('id', dishId).single()
  if (!source) throw new Error('Piatto non trovato')

  const { data: targets } = await supabase
    .from('dishes').select('id').eq('master_dish_id', masterDishId).neq('id', dishId)
  if (!targets?.length) return

  const patch: Record<string, any> = {}
  if (fields.includes('name'))        patch.name        = source.name
  if (fields.includes('description')) patch.description = source.description
  if (fields.includes('price'))       patch.price       = source.price
  if (fields.includes('image_url')) {
    patch.image_url = source.image_url
    patch.image_original_url = source.image_original_url
    patch.image_crop = source.image_crop
  }
  if (fields.includes('allergens'))   patch.allergens   = source.allergens

  if (Object.keys(patch).length === 0) return

  // Nome/descrizione sincronizzati → i testi dei target diventano identici al
  // sorgente: propaga anche le sue traduzioni (quelle vecchie sarebbero stantie).
  if (fields.includes('name') || fields.includes('description')) {
    patch.translations = source.translations ?? {}
  }

  const { error } = await supabase
    .from('dishes').update(patch)
    .in('id', targets.map(t => t.id))
  if (error) throw new Error(error.message)

  // Log sync
  await supabase.from('sync_logs').insert({
    restaurant_id: restaurantId,
    source_dish_id: dishId,
    target_dish_id: targets[0].id,
    synced_fields: fields,
    performed_by: user.id,
  })
}

// ── MODULO 6: drag tra categorie + azioni multiple ──────────────────────────────

/**
 * Sposta uno o più piatti in un'altra categoria dello stesso menu (drag tra
 * categorie). Aggiorna la categoria dei piatti spostati e riscrive il sort_order
 * di tutti i piatti secondo `orderedIds` (ordine piatto piatto risultante, flat
 * su tutte le categorie). `category` null = "Senza categoria".
 */
export async function moveDishesToCategory(
  restaurantId: string,
  menuId: string,
  dishIds: string[],
  category: string | null,
  orderedIds: string[],
) {
  if (!dishIds.length) return
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { error: catErr } = await supabase
    .from('dishes').update({ category }).in('id', dishIds).eq('menu_id', menuId)
  if (catErr) throw new Error(catErr.message)

  if (orderedIds.length) {
    const results = await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from('dishes').update({ sort_order: i }).eq('id', id).eq('menu_id', menuId)
      )
    )
    const failed = results.find(r => r.error)
    if (failed?.error) throw new Error(failed.error.message)
  }
  revalidate(restaurantId, menuId)
}

/** Elimina più piatti in un colpo solo (selezione multipla). */
export async function bulkDeleteDishes(
  restaurantId: string,
  menuId: string,
  dishIds: string[],
) {
  if (!dishIds.length) return
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase.from('dishes').delete().in('id', dishIds).eq('menu_id', menuId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
}

/** Duplica più piatti in un colpo solo (selezione multipla): copie "(copia)"
 *  accodate al menu, ognuna nella categoria del rispettivo originale. */
export async function bulkDuplicateDishes(
  restaurantId: string,
  menuId: string,
  dishIds: string[],
) {
  if (!dishIds.length) return []
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: srcs, error: readErr } = await supabase
    .from('dishes')
    .select('id, name, description, price, category, image_url, image_original_url, image_crop, allergens, pairing_dish_id, translations, schedule_enabled, schedule_from, schedule_until, sort_order')
    .in('id', dishIds)
    .eq('menu_id', menuId)
  if (readErr) throw new Error(readErr.message)
  if (!srcs?.length) return []

  const { data: last } = await supabase
    .from('dishes').select('sort_order').eq('menu_id', menuId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()
  let nextOrder = (last?.sort_order ?? -1) + 1

  // Copie nell'ordine originale dei piatti, accodate al menu.
  const rows = [...srcs]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(src => ({
      restaurant_id:    restaurantId,
      menu_id:          menuId,
      name:             `${src.name} (copia)`,
      description:      src.description,
      price:            src.price,
      category:         src.category,
      image_url:        src.image_url,
      image_original_url: src.image_original_url,
      image_crop:       src.image_crop,
      allergens:        src.allergens,
      pairing_dish_id:  src.pairing_dish_id,
      translations:     src.translations ?? {},
      schedule_enabled: src.schedule_enabled ?? false,
      schedule_from:    src.schedule_from,
      schedule_until:   src.schedule_until,
      is_active:        true,
      sort_order:       nextOrder++,
    }))

  const { data: created, error } = await supabase.from('dishes').insert(rows).select(DISH_COLUMNS)
  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
  return created ?? []
}

/** Programmazione oraria su più piatti in un colpo solo (selezione multipla). */
export async function bulkUpdateDishSchedules(
  restaurantId: string,
  menuId: string,
  dishIds: string[],
  schedule: { enabled: boolean; from: string | null; until: string | null },
) {
  if (!dishIds.length) return
  validateSchedule(schedule)
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase
    .from('dishes')
    .update({
      schedule_enabled: schedule.enabled,
      schedule_from:    schedule.enabled ? schedule.from : null,
      schedule_until:   schedule.enabled ? schedule.until : null,
      updated_at:       new Date().toISOString(),
    })
    .in('id', dishIds)
    .eq('menu_id', menuId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId, menuId)
}

/** Sposta più piatti in un altro menu (selezione multipla), in coda. */
export async function bulkMoveDishesToMenu(
  restaurantId: string,
  fromMenuId: string,
  dishIds: string[],
  toMenuId: string,
  targetCategory?: string | null,
) {
  if (!dishIds.length || fromMenuId === toMenuId) return
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: last } = await supabase
    .from('dishes').select('sort_order').eq('menu_id', toMenuId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const base = (last?.sort_order ?? -1) + 1

  const results = await Promise.all(
    dishIds.map((id, i) => {
      const update: Record<string, unknown> = { menu_id: toMenuId, sort_order: base + i }
      if (targetCategory != null) update.category = targetCategory
      return supabase.from('dishes').update(update).eq('id', id).eq('menu_id', fromMenuId)
    })
  )
  const failed = results.find(r => r.error)
  if (failed?.error) throw new Error(failed.error.message)

  revalidate(restaurantId, fromMenuId)
  revalidate(restaurantId, toMenuId)
}
