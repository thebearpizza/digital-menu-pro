// ─────────────────────────────────────────────────────────────────────────────
// Interprete AI dei comandi Telegram — Google Gemini (free tier).
//
// Il messaggio dell'utente (digitato o trascritto da un vocale) viene passato
// a Gemini insieme ai nomi REALI di ristoranti, menu, categorie e piatti
// dell'account. Il modello restituisce un intent strutturato (JSON schema)
// che viene eseguito qui con il service role Supabase.
//
// Le eliminazioni richiedono conferma: l'intent viene parcheggiato in
// telegram_pending e l'utente risponde "sì" per procedere.
//
// Env: GEMINI_API_KEY (chiave gratuita da aistudio.google.com/apikey),
// GEMINI_MODEL opzionale (default gemini-2.5-flash).
// ─────────────────────────────────────────────────────────────────────────────

import { SupabaseClient } from '@supabase/supabase-js'

// Catena di modelli: se il primo è sovraccarico (503) o a corto di quota (429)
// si passa al successivo. Tutti nel free tier di AI Studio.
const MODEL_CHAIN = Array.from(new Set([
  process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
]))

export function aiEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY
}

// ── Contesto account ──────────────────────────────────────────────────────────

interface Restaurant { id: string; name: string; is_active: boolean }
interface Menu {
  id: string; name: string; is_active: boolean; restaurant_id: string
  schedule_enabled: boolean | null; schedule_from: string | null
  schedule_until: string | null; category_order: string[] | null
  sort_order: number
}
interface Dish {
  id: string; name: string; price: number | null; category: string | null
  menu_id: string; is_active: boolean
}
export interface Ctx { restaurants: Restaurant[]; menus: Menu[]; dishes: Dish[] }

export async function loadContext(sb: SupabaseClient, userId: string): Promise<Ctx> {
  const { data: restaurants } = await sb
    .from('restaurants').select('id, name, is_active').eq('owner_id', userId)
  const rIds = (restaurants ?? []).map(r => r.id)
  if (!rIds.length) return { restaurants: [], menus: [], dishes: [] }
  const { data: menus } = await sb
    .from('menus')
    .select('id, name, is_active, restaurant_id, schedule_enabled, schedule_from, schedule_until, category_order, sort_order')
    .in('restaurant_id', rIds)
  const mIds = (menus ?? []).map(m => m.id)
  const { data: dishes } = mIds.length
    ? await sb.from('dishes').select('id, name, price, category, menu_id, is_active').in('menu_id', mIds)
    : { data: [] }
  return { restaurants: restaurants ?? [], menus: menus ?? [], dishes: dishes ?? [] }
}

// ── Matching elastico sui nomi reali ─────────────────────────────────────────

const norm = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Match esatto normalizzato, poi per inclusione (in entrambe le direzioni). */
function matchByName<T extends { name: string }>(items: T[], query: string): T[] {
  const q = norm(query)
  const exact = items.filter(i => norm(i.name) === q)
  if (exact.length) return exact
  return items.filter(i => norm(i.name).includes(q) || q.includes(norm(i.name)))
}

function catKey(c: string | null): string { return c ?? 'Senza categoria' }

/** Deduce attiva/disattiva dal testo. L'ordine conta: "disattiva" contiene "attiv". */
function inferActive(text: string): boolean | undefined {
  const t = norm(text)
  if (/(disattiv|spegn|disabilit|nascond|sospend|togli|rimuov)/.test(t)) return false
  if (/(attiv|riattiv|accend|abilit|mostra|riapri|rimett)/.test(t)) return true
  return undefined
}

// ── Intent ────────────────────────────────────────────────────────────────────

export interface Intent {
  action: string
  active?: boolean
  restaurant?: string
  menu?: string
  category?: string
  dish?: string
  new_name?: string
  price?: number
  description?: string
  schedule_from?: string
  schedule_until?: string
  reply?: string
}

const INTENT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    action: {
      type: 'STRING',
      enum: [
        'list', 'help', 'clarify',
        'set_price', 'toggle_dish', 'toggle_category', 'toggle_menu', 'toggle_restaurant',
        'create_dish', 'update_dish', 'delete_dish', 'duplicate_dish',
        'create_menu', 'rename_menu', 'duplicate_menu', 'delete_menu',
        'create_category', 'rename_category', 'duplicate_category', 'delete_category',
        'schedule_menu', 'unschedule_menu',
      ],
    },
    active: { type: 'BOOLEAN' },
    restaurant: { type: 'STRING' },
    menu: { type: 'STRING' },
    category: { type: 'STRING' },
    dish: { type: 'STRING' },
    new_name: { type: 'STRING' },
    price: { type: 'NUMBER' },
    description: { type: 'STRING' },
    schedule_from: { type: 'STRING' },
    schedule_until: { type: 'STRING' },
    reply: { type: 'STRING' },
  },
  required: ['action'],
}

function buildSystemPrompt(ctx: Ctx): string {
  const lines: string[] = []
  for (const r of ctx.restaurants) {
    lines.push(`RISTORANTE: "${r.name}" (${r.is_active ? 'attivo' : 'disattivo'})`)
    for (const m of ctx.menus.filter(m => m.restaurant_id === r.id)) {
      const sched = m.schedule_enabled && m.schedule_from && m.schedule_until
        ? `, programmato ${String(m.schedule_from).slice(0, 5)}-${String(m.schedule_until).slice(0, 5)}` : ''
      lines.push(`  MENU: "${m.name}" (${m.is_active ? 'attivo' : 'disattivo'}${sched})`)
      const byCat = new Map<string, Dish[]>()
      for (const d of ctx.dishes.filter(d => d.menu_id === m.id)) {
        const k = catKey(d.category)
        if (!byCat.has(k)) byCat.set(k, [])
        byCat.get(k)!.push(d)
      }
      byCat.forEach((ds, cat) => {
        lines.push(`    CATEGORIA "${cat}": ${ds.map(d =>
          `"${d.name}" (€${d.price ?? '?'}${d.is_active ? '' : ', disattivo'})`).join(', ')}`)
      })
    }
  }

  return `Sei l'interprete dei comandi di un bot Telegram per la gestione dei menu di un ristorante.
Il messaggio può arrivare da una trascrizione vocale, quindi con errori: "non limits" può voler dire "No Limits", "menù" è "menu", articoli e preposizioni vanno ignorati.

Devi restituire UN SOLO intent JSON con l'azione richiesta e i parametri.

REGOLE:
- Nei campi restaurant/menu/category/dish usa SEMPRE il nome ESATTO preso dai dati qui sotto (corretto da eventuali errori di trascrizione), non quello che ha scritto l'utente.
- Per le azioni toggle_* il campo active è OBBLIGATORIO: "attiva/riattiva/accendi/abilita/mostra/rimetti" → active=true; "disattiva/spegni/disabilita/nascondi/togli/sospendi" → active=false.
- Compila SEMPRE i campi dell'oggetto target dell'azione: toggle_dish richiede dish, toggle_category richiede category, set_price richiede dish e price, e così via. Non lasciare mai vuoto il campo principale.
- Se l'utente descrive un piatto con parole leggermente diverse (es. "i fiori di zucca fritti" per il piatto "Fiori di zucca" della categoria "Fritti"), scegli il piatto esistente più plausibile dai dati e usa il suo nome esatto. Se è davvero ambiguo tra piatto e categoria, preferisci il piatto se il nome combacia, altrimenti la categoria.
- "togli/rimuovi/cancella/elimina" un piatto/menu/categoria in modo definitivo → delete_*. Se l'utente dice solo "togli X" senza chiarire, preferisci toggle (disattivazione, reversibile).
- Prezzi: numeri con virgola o punto ("dodici e cinquanta" = 12.50). Campo price sempre numerico.
- Orari per schedule_menu in formato HH:MM ("dalle 8 alle 12" → 08:00 e 12:00).
- create_dish: serve almeno il nome; menu/categoria/prezzo/descrizione se indicati. Se l'account ha un solo menu non serve chiederlo.
- update_dish: per cambiare nome usa new_name; per prezzo/descrizione/categoria i rispettivi campi.
- Se il comando è ambiguo o incompleto (es. piatto presente in più menu senza indicazione), usa action="clarify" e in reply fai UNA domanda breve e specifica in italiano.
- Se l'utente chiede lo stato/elenco ("che menu ho?", "situazione", "lista") → action="list".
- Se chiede aiuto o saluta → action="help".
- Non inventare nomi che non esistono nei dati: se non trovi una corrispondenza plausibile, chiedi con clarify.

DATI ATTUALI DELL'ACCOUNT:
${lines.join('\n')}`
}

/** Campi indispensabili per azione: se mancano, l'intent è incompleto. */
const REQUIRED_FIELDS: Record<string, (keyof Intent)[]> = {
  set_price:        ['dish', 'price'],
  toggle_dish:      ['dish'],
  toggle_category:  ['category'],
  create_dish:      ['dish'],
  update_dish:      ['dish'],
  delete_dish:      ['dish'],
  duplicate_dish:   ['dish'],
  create_menu:      ['menu'],
  rename_menu:      ['new_name'],
  create_category:  ['category'],
  rename_category:  ['category', 'new_name'],
  delete_category:  ['category'],
  schedule_menu:    ['schedule_from', 'schedule_until'],
}

function missingFields(it: Intent): string[] {
  return (REQUIRED_FIELDS[it.action] ?? []).filter(f => {
    const v = it[f]
    return v == null || v === ''
  })
}

/**
 * Chiama Gemini e restituisce l'intent strutturato. Se l'intent arriva senza
 * i campi indispensabili, ritenta una volta segnalando al modello cosa manca.
 */
export async function interpret(text: string, ctx: Ctx): Promise<Intent> {
  const intent = await interpretRaw(text, ctx)
  const missing = missingFields(intent)
  if (!missing.length) return intent

  const retry = await interpretRaw(
    `${text}\n\n(NOTA DI SISTEMA: nella risposta precedente hai scelto action="${intent.action}" ma senza compilare: ${missing.join(', ')}. Rispondi di nuovo includendo tutti i campi necessari con i nomi esatti presi dai dati; se davvero non riesci a determinarli, usa action="clarify" con una domanda specifica.)`,
    ctx,
  )
  return missingFields(retry).length ? intent : retry
}

async function interpretRaw(text: string, ctx: Ctx): Promise<Intent> {
  const apiKey = process.env.GEMINI_API_KEY!
  const sys = buildSystemPrompt(ctx)
  let lastErr: Error | null = null

  for (const model of MODEL_CHAIN) {
    const attempts = model === MODEL_CHAIN[0] ? 2 : 1
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 600))
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: sys }] },
            contents: [{ role: 'user', parts: [{ text }] }],
            generationConfig: {
              temperature: 0,
              responseMimeType: 'application/json',
              responseSchema: INTENT_SCHEMA,
            },
          }),
        },
      )
      const body = await res.text().catch(() => '')
      if (res.ok) {
        const raw = (() => {
          try { return JSON.parse(body)?.candidates?.[0]?.content?.parts?.[0]?.text } catch { return null }
        })()
        if (!raw) { lastErr = new Error('Gemini: risposta vuota'); break }
        const intent = JSON.parse(raw) as Intent
        // Rete di sicurezza: se il modello omette active in un toggle,
        // lo deduciamo dalle parole dell'utente (mai default arbitrari).
        if (intent.action?.startsWith('toggle_') && intent.active == null) {
          intent.active = inferActive(text)
        }
        return intent
      }
      console.error('Gemini error', model, res.status, body.slice(0, 300))
      let msg: string | null = null
      try { msg = JSON.parse(body)?.error?.message ?? null } catch {}
      lastErr = new Error(`Gemini HTTP ${res.status}${msg ? ` — ${msg}` : ''}`)
      if (res.status === 503 || res.status === 429 || res.status >= 500) continue // ritenta / prossimo modello
      if (res.status === 404) break // modello inesistente → prossimo della catena
      throw lastErr // 400/403: errore di configurazione, inutile insistere
    }
  }
  throw lastErr ?? new Error('Gemini non disponibile')
}

// ── Esecuzione intent ─────────────────────────────────────────────────────────

export const CONFIRM_ACTIONS = new Set(['delete_dish', 'delete_menu', 'delete_category'])
const PENDING_TTL_MS = 5 * 60 * 1000

function statusText(ctx: Ctx): string {
  if (!ctx.restaurants.length) return 'Nessun ristorante trovato sul tuo account.'
  return ctx.restaurants.map(r => {
    const ms = ctx.menus.filter(m => m.restaurant_id === r.id)
      .sort((a, b) => a.sort_order - b.sort_order)
    const lines = ms.map(m => {
      const sched = m.schedule_enabled && m.schedule_from && m.schedule_until
        ? ` 🕐 ${String(m.schedule_from).slice(0, 5)}–${String(m.schedule_until).slice(0, 5)}` : ''
      const count = ctx.dishes.filter(d => d.menu_id === m.id).length
      return `   ${m.is_active ? '🟢' : '🔴'} ${m.name} (${count} piatti)${sched}`
    })
    return `${r.is_active ? '🟢' : '🔴'} ${r.name}\n${lines.join('\n') || '   (nessun menu)'}`
  }).join('\n\n')
}

/** Risolve un menu per nome; '' = errore con messaggio. */
function resolveMenu(ctx: Ctx, name: string | undefined): { menu?: Menu; err?: string } {
  if (!name) {
    if (ctx.menus.length === 1) return { menu: ctx.menus[0] }
    return { err: `Quale menu? (${ctx.menus.map(m => m.name).join(', ')})` }
  }
  const found = matchByName(ctx.menus, name)
  if (!found.length) return { err: `Menu "${name}" non trovato. I tuoi menu: ${ctx.menus.map(m => m.name).join(', ')}.` }
  if (found.length > 1) return { err: `Più menu corrispondono a "${name}": ${found.map(m => m.name).join(', ')}. Quale?` }
  return { menu: found[0] }
}

/** Risolve i piatti per nome, eventualmente nel solo menu indicato. */
function resolveDishes(ctx: Ctx, name: string, menuName?: string): { dishes?: Dish[]; err?: string } {
  let pool = ctx.dishes
  if (menuName) {
    const { menu, err } = resolveMenu(ctx, menuName)
    if (err) return { err }
    pool = pool.filter(d => d.menu_id === menu!.id)
  }
  const found = matchByName(pool, name)
  if (!found.length) return { err: `Nessun piatto "${name}" trovato.` }
  const menuIds = new Set(found.map(d => d.menu_id))
  if (menuIds.size > 1 && !menuName) {
    const list = found.map(d => `• ${d.name} (menu ${ctx.menus.find(m => m.id === d.menu_id)?.name ?? '?'})`).join('\n')
    return { err: `Il piatto è presente in più menu:\n${list}\n\nDimmi in quale menu.` }
  }
  return { dishes: found }
}

const menuName = (ctx: Ctx, id: string) => ctx.menus.find(m => m.id === id)?.name ?? '?'

export async function execute(sb: SupabaseClient, ctx: Ctx, it: Intent): Promise<string> {
  // Mai tirare a indovinare il verso di un toggle.
  if (it.action?.startsWith('toggle_') && it.active == null) {
    return 'Devo attivare o disattivare? Riprova specificandolo.'
  }
  switch (it.action) {
    case 'list': return statusText(ctx)
    case 'help': return ''  // il chiamante mostra l'HELP standard
    case 'clarify': return it.reply || 'Puoi ripetere in modo più specifico?'

    case 'set_price': {
      if (!it.dish || it.price == null) return 'Mi serve il piatto e il nuovo prezzo (es. "Carbonara a 12,50").'
      const { dishes, err } = resolveDishes(ctx, it.dish, it.menu)
      if (err) return err
      const { error } = await sb.from('dishes').update({ price: it.price }).in('id', dishes!.map(d => d.id))
      if (error) return `Errore: ${error.message}`
      return `✅ Prezzo di "${dishes![0].name}" aggiornato a € ${it.price.toFixed(2)}${dishes!.length > 1 ? ` (${dishes!.length} piatti)` : ''}.`
    }

    case 'toggle_dish': {
      if (!it.dish) return 'Quale piatto?'
      const active = it.active ?? true
      const { dishes, err } = resolveDishes(ctx, it.dish, it.menu)
      if (err) return err
      const { error } = await sb.from('dishes').update({ is_active: active }).in('id', dishes!.map(d => d.id))
      if (error) return `Errore: ${error.message}`
      return `✅ Piatto "${dishes![0].name}" ${active ? 'attivato 🟢' : 'disattivato 🔴'}.`
    }

    case 'toggle_category': {
      if (!it.category) return 'Quale categoria?'
      const active = it.active ?? true
      let scope = ctx.menus
      if (it.menu) {
        const { menu, err } = resolveMenu(ctx, it.menu)
        if (err) return err
        scope = [menu!]
      }
      const target = ctx.dishes.filter(d =>
        scope.some(m => m.id === d.menu_id) && norm(catKey(d.category)) === norm(it.category!))
      if (!target.length) return `Nessun piatto nella categoria "${it.category}".`
      const { error } = await sb.from('dishes').update({ is_active: active }).in('id', target.map(d => d.id))
      if (error) return `Errore: ${error.message}`
      return `✅ Categoria "${it.category}" ${active ? 'attivata 🟢' : 'disattivata 🔴'} (${target.length} piatti).`
    }

    case 'toggle_menu': {
      const { menu, err } = resolveMenu(ctx, it.menu)
      if (err) return err
      const active = it.active ?? true
      const { error } = await sb.from('menus').update({ is_active: active }).eq('id', menu!.id)
      if (error) return `Errore: ${error.message}`
      return `✅ Menu "${menu!.name}" ${active ? 'attivato 🟢' : 'disattivato 🔴'}.`
    }

    case 'toggle_restaurant': {
      if (!it.restaurant && ctx.restaurants.length > 1)
        return `Quale ristorante? (${ctx.restaurants.map(r => r.name).join(', ')})`
      const r = it.restaurant ? matchByName(ctx.restaurants, it.restaurant)[0] : ctx.restaurants[0]
      if (!r) return `Ristorante "${it.restaurant}" non trovato.`
      const active = it.active ?? true
      const { error } = await sb.from('restaurants').update({ is_active: active }).eq('id', r.id)
      if (error) return `Errore: ${error.message}`
      return `✅ Ristorante "${r.name}" ${active ? 'attivato 🟢' : 'disattivato 🔴'}.`
    }

    case 'create_dish': {
      if (!it.dish) return 'Come si chiama il piatto?'
      const { menu, err } = resolveMenu(ctx, it.menu)
      if (err) return err
      const { data: last } = await sb
        .from('dishes').select('sort_order').eq('menu_id', menu!.id)
        .order('sort_order', { ascending: false }).limit(1).maybeSingle()
      const { data: dish, error } = await sb.from('dishes').insert({
        restaurant_id: menu!.restaurant_id,
        menu_id:       menu!.id,
        name:          it.dish,
        description:   it.description || null,
        price:         it.price ?? null,
        category:      it.category || null,
        sort_order:    (last?.sort_order ?? -1) + 1,
      }).select('name').single()
      if (error) return `Errore: ${error.message}`
      const extra = [
        it.price != null ? `€ ${it.price.toFixed(2)}` : null,
        it.category ? `categoria ${it.category}` : null,
      ].filter(Boolean).join(', ')
      return `✅ Piatto "${dish!.name}" creato nel menu ${menu!.name}${extra ? ` (${extra})` : ''}.`
    }

    case 'update_dish': {
      if (!it.dish) return 'Quale piatto devo modificare?'
      const { dishes, err } = resolveDishes(ctx, it.dish, it.menu)
      if (err) return err
      const patch: Record<string, unknown> = {}
      if (it.new_name) patch.name = it.new_name
      if (it.price != null) patch.price = it.price
      if (it.description !== undefined) patch.description = it.description || null
      if (it.category !== undefined && it.category !== '') patch.category = it.category
      if (!Object.keys(patch).length) return 'Cosa devo modificare del piatto? (nome, prezzo, descrizione, categoria)'
      const { error } = await sb.from('dishes').update(patch).in('id', dishes!.map(d => d.id))
      if (error) return `Errore: ${error.message}`
      return `✅ Piatto "${it.new_name ?? dishes![0].name}" aggiornato.`
    }

    case 'duplicate_dish': {
      if (!it.dish) return 'Quale piatto devo duplicare?'
      const { dishes, err } = resolveDishes(ctx, it.dish, it.menu)
      if (err) return err
      const d = dishes![0]
      const { data: src } = await sb
        .from('dishes')
        .select('restaurant_id, menu_id, name, description, price, category, image_url, allergens, pairing_dish_id')
        .eq('id', d.id).single()
      if (!src) return 'Piatto non trovato.'
      const { data: last } = await sb
        .from('dishes').select('sort_order').eq('menu_id', src.menu_id)
        .order('sort_order', { ascending: false }).limit(1).maybeSingle()
      const { error } = await sb.from('dishes').insert({
        ...src, name: `${src.name} (copia)`, sort_order: (last?.sort_order ?? -1) + 1,
      })
      if (error) return `Errore: ${error.message}`
      return `✅ Piatto "${src.name}" duplicato.`
    }

    case 'delete_dish': {
      if (!it.dish) return 'Quale piatto devo eliminare?'
      const { dishes, err } = resolveDishes(ctx, it.dish, it.menu)
      if (err) return err
      const { error } = await sb.from('dishes').delete().in('id', dishes!.map(d => d.id))
      if (error) return `Errore: ${error.message}`
      return `🗑 Piatto "${dishes![0].name}" eliminato definitivamente.`
    }

    case 'create_menu': {
      if (!it.menu) return 'Come si chiama il nuovo menu?'
      if (!ctx.restaurants.length) return 'Nessun ristorante sul tuo account.'
      let r = ctx.restaurants[0]
      if (ctx.restaurants.length > 1) {
        if (!it.restaurant) return `Per quale ristorante? (${ctx.restaurants.map(x => x.name).join(', ')})`
        const found = matchByName(ctx.restaurants, it.restaurant)
        if (!found.length) return `Ristorante "${it.restaurant}" non trovato.`
        r = found[0]
      }
      const maxSort = Math.max(-1, ...ctx.menus.filter(m => m.restaurant_id === r.id).map(m => m.sort_order))
      const { error } = await sb.from('menus').insert({
        restaurant_id: r.id, name: it.menu, sort_order: maxSort + 1,
      })
      if (error) return `Errore: ${error.message}`
      return `✅ Menu "${it.menu}" creato nel ristorante ${r.name}.`
    }

    case 'rename_menu': {
      if (!it.new_name) return 'Qual è il nuovo nome del menu?'
      const { menu, err } = resolveMenu(ctx, it.menu)
      if (err) return err
      const { error } = await sb.from('menus').update({ name: it.new_name }).eq('id', menu!.id)
      if (error) return `Errore: ${error.message}`
      return `✅ Menu "${menu!.name}" rinominato in "${it.new_name}".`
    }

    case 'duplicate_menu': {
      const { menu, err } = resolveMenu(ctx, it.menu)
      if (err) return err
      const { data: newMenu, error: menuErr } = await sb.from('menus').insert({
        restaurant_id: menu!.restaurant_id,
        name: `${menu!.name} (Copia)`,
        sort_order: menu!.sort_order + 1,
      }).select('id, name').single()
      if (menuErr) return `Errore: ${menuErr.message}`
      const { data: dishes } = await sb
        .from('dishes')
        .select('name, description, price, category, image_url, allergens, sort_order, pairing_label')
        .eq('menu_id', menu!.id)
      if (dishes?.length) {
        await sb.from('dishes').insert(dishes.map(d => ({
          ...d, restaurant_id: menu!.restaurant_id, menu_id: newMenu!.id, master_dish_id: null,
        })))
      }
      return `✅ Menu "${menu!.name}" duplicato in "${newMenu!.name}" (${dishes?.length ?? 0} piatti).`
    }

    case 'delete_menu': {
      const { menu, err } = resolveMenu(ctx, it.menu)
      if (err) return err
      const count = ctx.dishes.filter(d => d.menu_id === menu!.id).length
      const { error } = await sb.from('menus').delete().eq('id', menu!.id)
      if (error) return `Errore: ${error.message}`
      return `🗑 Menu "${menu!.name}" eliminato definitivamente (${count} piatti).`
    }

    case 'create_category': {
      if (!it.category) return 'Come si chiama la categoria?'
      const { menu, err } = resolveMenu(ctx, it.menu)
      if (err) return err
      const order = (menu!.category_order ?? [])
      if (order.some(c => norm(c) === norm(it.category!)))
        return `La categoria "${it.category}" esiste già nel menu ${menu!.name}.`
      const { error } = await sb.from('menus')
        .update({ category_order: [...order, it.category] }).eq('id', menu!.id)
      if (error) return `Errore: ${error.message}`
      return `✅ Categoria "${it.category}" creata nel menu ${menu!.name}.`
    }

    case 'rename_category': {
      if (!it.category || !it.new_name) return 'Mi serve il nome attuale e quello nuovo della categoria.'
      let scope = ctx.menus
      if (it.menu) {
        const { menu, err } = resolveMenu(ctx, it.menu)
        if (err) return err
        scope = [menu!]
      } else {
        const containing = ctx.menus.filter(m =>
          (m.category_order ?? []).some(c => norm(c) === norm(it.category!)) ||
          ctx.dishes.some(d => d.menu_id === m.id && norm(catKey(d.category)) === norm(it.category!)))
        if (containing.length > 1)
          return `La categoria "${it.category}" è in più menu (${containing.map(m => m.name).join(', ')}). In quale?`
        if (containing.length === 1) scope = containing
      }
      const isUncat = norm(it.category) === norm('Senza categoria')
      for (const m of scope) {
        const base = sb.from('dishes').update({ category: it.new_name }).eq('menu_id', m.id)
        const { error } = await (isUncat ? base.is('category', null) : base.eq('category', it.category))
        if (error) return `Errore: ${error.message}`
        const order = (m.category_order ?? [])
        if (order.includes(it.category)) {
          await sb.from('menus')
            .update({ category_order: order.map(c => (c === it.category ? it.new_name! : c)) })
            .eq('id', m.id)
        }
      }
      return `✅ Categoria "${it.category}" rinominata in "${it.new_name}".`
    }

    case 'duplicate_category': {
      if (!it.category) return 'Quale categoria devo duplicare?'
      const { menu, err } = resolveMenu(ctx, it.menu)
      if (err) return err
      const isUncat = norm(it.category) === norm('Senza categoria')
      let q = sb.from('dishes')
        .select('restaurant_id, name, description, price, category, image_url, allergens, pairing_dish_id, sort_order')
        .eq('menu_id', menu!.id).order('sort_order', { ascending: true })
      const { data: src } = await (isUncat ? q.is('category', null) : q.eq('category', it.category))
      if (!src?.length) return `Nessun piatto nella categoria "${it.category}".`
      const newCat = `${isUncat ? 'Senza categoria' : it.category} (copia)`
      const { data: last } = await sb
        .from('dishes').select('sort_order').eq('menu_id', menu!.id)
        .order('sort_order', { ascending: false }).limit(1).maybeSingle()
      const base = (last?.sort_order ?? -1) + 1
      const { error } = await sb.from('dishes').insert(src.map((d, i) => ({
        ...d, menu_id: menu!.id, category: newCat, sort_order: base + i,
      })))
      if (error) return `Errore: ${error.message}`
      return `✅ Categoria "${it.category}" duplicata in "${newCat}" (${src.length} piatti).`
    }

    case 'delete_category': {
      if (!it.category) return 'Quale categoria devo eliminare?'
      const { menu, err } = resolveMenu(ctx, it.menu)
      if (err) return err
      const isUncat = norm(it.category) === norm('Senza categoria')
      const base = sb.from('dishes').delete().eq('menu_id', menu!.id)
      const { error } = await (isUncat ? base.is('category', null) : base.eq('category', it.category))
      if (error) return `Errore: ${error.message}`
      const order = (menu!.category_order ?? [])
      if (order.some(c => norm(c) === norm(it.category!))) {
        await sb.from('menus')
          .update({ category_order: order.filter(c => norm(c) !== norm(it.category!)) })
          .eq('id', menu!.id)
      }
      return `🗑 Categoria "${it.category}" eliminata dal menu ${menu!.name} con tutti i suoi piatti.`
    }

    case 'schedule_menu': {
      if (!it.schedule_from || !it.schedule_until) return 'Mi servono orario di inizio e fine (es. "dalle 8 alle 12").'
      const { menu, err } = resolveMenu(ctx, it.menu)
      if (err) return err
      const { error } = await sb.from('menus').update({
        schedule_enabled: true,
        schedule_from: it.schedule_from,
        schedule_until: it.schedule_until,
      }).eq('id', menu!.id)
      if (error) return `Errore: ${error.message}`
      return `✅ Menu "${menu!.name}" programmato: visibile dalle ${it.schedule_from} alle ${it.schedule_until}${it.schedule_from > it.schedule_until ? ' (del giorno dopo)' : ''}.`
    }

    case 'unschedule_menu': {
      const { menu, err } = resolveMenu(ctx, it.menu)
      if (err) return err
      const { error } = await sb.from('menus').update({ schedule_enabled: false }).eq('id', menu!.id)
      if (error) return `Errore: ${error.message}`
      return `✅ Programmazione rimossa dal menu "${menu!.name}": sempre visibile.`
    }

    default:
      return 'Non ho capito cosa devo fare 🤔 Prova a riformulare.'
  }
}

// ── Descrizione leggibile per la conferma ─────────────────────────────────────

export function describeIntent(ctx: Ctx, it: Intent): string {
  switch (it.action) {
    case 'delete_dish': return `eliminare definitivamente il piatto "${it.dish}"${it.menu ? ` dal menu ${it.menu}` : ''}`
    case 'delete_menu': {
      const { menu } = resolveMenu(ctx, it.menu)
      const count = menu ? ctx.dishes.filter(d => d.menu_id === menu.id).length : 0
      return `eliminare definitivamente il menu "${menu?.name ?? it.menu}" con i suoi ${count} piatti`
    }
    case 'delete_category': return `eliminare definitivamente la categoria "${it.category}"${it.menu ? ` dal menu ${it.menu}` : ''} con tutti i suoi piatti`
    default: return 'procedere'
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

const YES_RE = /^(s[iì]+|conferma|confermo|ok|okay|procedi|vai|certo)\s*[.!]*$/i
const NO_RE  = /^(no+|annulla|lascia stare|niente|stop)\s*[.!]*$/i

/**
 * Interpreta il messaggio con Gemini ed esegue l'azione.
 * Gestisce anche il flusso di conferma per le eliminazioni.
 * Ritorna '' se l'azione è "help" (il chiamante mostra la guida standard).
 */
export async function aiHandle(
  sb: SupabaseClient, chatId: number, userId: string, text: string,
): Promise<string> {
  const { data: pending } = await sb
    .from('telegram_pending').select('intent, created_at').eq('chat_id', chatId).maybeSingle()
  const pendingFresh = pending && Date.now() - new Date(pending.created_at).getTime() < PENDING_TTL_MS

  if (pending) await sb.from('telegram_pending').delete().eq('chat_id', chatId)

  if (pendingFresh && YES_RE.test(text.trim())) {
    const ctx = await loadContext(sb, userId)
    return execute(sb, ctx, pending!.intent as Intent)
  }
  if (pendingFresh && NO_RE.test(text.trim())) {
    return 'Ok, annullato 👍'
  }

  const ctx = await loadContext(sb, userId)
  const intent = await interpret(text, ctx)

  if (CONFIRM_ACTIONS.has(intent.action)) {
    await sb.from('telegram_pending').upsert({
      chat_id: chatId, intent: intent as any, created_at: new Date().toISOString(),
    })
    return `⚠️ Sto per ${describeIntent(ctx, intent)}.\nConfermi? Rispondi "sì" o "annulla".`
  }

  return execute(sb, ctx, intent)
}
