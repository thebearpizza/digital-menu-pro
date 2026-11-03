// ─────────────────────────────────────────────────────────────────────────────
// Dati di un menu per il motore delle pagine (typeset): piatti in ordine di
// categoria, abbinamenti, pagine di testo, foto/video, traduzioni. Usati dal
// menu sul telefono (NewMenuPage) e dal PDF del gestionale, che così è
// identico a quello che vede il cliente.
// ─────────────────────────────────────────────────────────────────────────────

import type { createClient } from '@/lib/supabase/server'
import { mediaViews, type Dish, type MenuData } from './typeset'
import { ALLERGENS, allergenName, allergenNumber, type AllergenCatalog } from '@/lib/allergens'
import { isCategoryOpenNow, isWindowOpenNow, type CategorySchedules } from '@/lib/menuSchedule'
import { parseRichText } from './richText'
import { parseStyle, type MenuStyle } from '@/lib/menuStyle'
import { parseFrame, parseRect } from '@/lib/photoFrame'
import { fromOldAds, parseMedia } from '@/lib/menuMedia'
import type { DishTranslations, MenuTranslations } from '@/lib/translations'
import type { I18nData } from './i18n'

export const DISH_COLS = 'id, name, description, price, category, allergens, sort_order, image_url, image_original_url, image_crop, photo_frame, pairing_dish_id, pairing_label, translations, schedule_enabled, schedule_from, schedule_until'
export const MENU_COLS = 'id, name, category_order, translations, schedule_enabled, schedule_from, schedule_until, category_schedules, text_content, menu_style, media_pages'
// Nome con cui il gestionale mostra (e programma) i piatti senza categoria.
const NO_CATEGORY = 'Senza categoria'

type TextPage = { enabled?: boolean; body?: string; position?: 'first' | 'last'; align?: 'left' | 'center' | 'right' }
type Row = Record<string, unknown>
type Supa = Awaited<ReturnType<typeof createClient>>

/** schedules: true = come sul telefono adesso (fuori orario piatti e categorie
 *  non compaiono); false = tutto il menu attivo (PDF). */
export async function buildMenuData(supabase: Supa, restaurant: Row, menu: Row, opts: { schedules: boolean }): Promise<{
  data: MenuData; i18n: I18nData; style: MenuStyle; catalog: AllergenCatalog
}> {

  // Programmazione oraria di piatti e categorie: fuori fascia non compaiono.
  const catSchedules = (menu.category_schedules ?? {}) as CategorySchedules
  const dishOpen = (d: Row) => !opts.schedules || isWindowOpenNow(d.schedule_enabled as boolean | null, d.schedule_from as string | null, d.schedule_until as string | null)
  const catOpen = (c: string) => !opts.schedules || isCategoryOpenNow(catSchedules[c])

  const [{ data: allDishes }, { data: overrides }] = await Promise.all([
    supabase
      .from('dishes').select(DISH_COLS)
      .eq('menu_id', menu.id).eq('is_active', true)
      .order('sort_order', { ascending: true }),
    // Nomi/numeri degli allergeni personalizzati dall'account del ristorante.
    supabase.from('allergen_overrides').select('items').eq('user_id', restaurant.owner_id).maybeSingle(),
  ])
  const catalog = (overrides?.items ?? null) as AllergenCatalog
  const dishes = (allDishes ?? []).filter(d => dishOpen(d as Row) && catOpen((d.category as string | null) || NO_CATEGORY))

  // Abbinamenti: il piatto consigliato può stare in un altro menu del ristorante.
  const pairIds = Array.from(new Set(dishes.map(d => d.pairing_dish_id as string | null).filter((x): x is string => !!x)))
  const { data: pairRows } = pairIds.length
    ? await supabase.from('dishes').select(`${DISH_COLS}, menus!inner(restaurant_id, translations)`)
        .in('id', pairIds).eq('is_active', true).eq('menus.restaurant_id', restaurant.id)
    : { data: [] as Row[] }

  const toDish = (d: Row, withPairing: boolean): Dish => {
    // Un abbinamento fuori orario non si propone.
    const pair = withPairing && d.pairing_dish_id ? (pairRows ?? []).find(p => p.id === d.pairing_dish_id && dishOpen(p as Row)) : null
    return {
      id: d.id as string,
      name: d.name as string,
      description: (d.description as string | null) || null,
      price: d.price === null ? null : Number(d.price),
      allergens: ((d.allergens as unknown[] | null) ?? []).map(Number).filter(id => id > 0)
        .map(id => ({ id, n: allergenNumber(id, catalog), name: allergenName(id, 'it', catalog) })),
      // L'originale intero: il riquadro del formato scelto lo inquadra.
      image: (d.image_original_url as string | null) || (d.image_url as string | null) || null,
      frame: parseFrame(d.photo_frame),
      focus: d.image_original_url ? parseRect(d.image_crop) : null,
      category: ((d.category as string | null) ?? '') || NO_CATEGORY,
      pairing: pair ? { label: (d.pairing_label as string | null) || null, dish: toDish(pair as Row, false) } : null,
    }
  }

  // Categorie: prima l'ordine salvato nel menu, poi le altre nell'ordine in cui
  // compaiono i piatti.
  const order: string[] = Array.isArray(menu.category_order) ? [...menu.category_order] : []
  for (const d of dishes) {
    const c = (d.category as string | null) ?? ''
    if (!order.includes(c)) order.push(c)
  }
  const data: MenuData = {
    restaurantName: restaurant.name as string,
    menuName: menu.name as string,
    categories: order.map(name => ({
      name: name || NO_CATEGORY,
      dishes: dishes
        .filter(d => ((d.category as string | null) ?? '') === name)
        .map(d => toDish(d, true)),
    })).filter(c => c.dishes.length > 0),
    info: infoPage(menu.text_content),
    allergenLegend: allergenLegendOf(menu.text_content, catalog),
    labels: { allergens: 'Allergeni', cont: 'segue', allergenNote: '' },
    media: mediaViews(menu.media_pages === null || menu.media_pages === undefined
      ? fromOldAds((restaurant as Row).theme_config, menu.id as string)
      : parseMedia(menu.media_pages), dishes.map(d => toDish(d as Row, true))),
  }

  // Traduzioni (generate dal gestionale): la lingua si sceglie sul telefono.
  const trOf = (r: Row) => (r.translations ?? {}) as DishTranslations
  const i18n: I18nData = {
    menu: (menu.translations ?? {}) as MenuTranslations,
    dishes: Object.fromEntries([...dishes, ...(pairRows ?? [])].map(d => [d.id as string, trOf(d as Row)])),
    pairMenus: Object.fromEntries((pairRows ?? []).map(d => {
      const m = (d as Row).menus as { translations?: MenuTranslations } | null
      return [d.id as string, (m?.translations ?? {}) as MenuTranslations]
    })),
    catalog,
  }

  // Stile del menu, se ne ha uno suo; altrimenti quello del ristorante.
  const style = parseStyle(menu.menu_style ?? restaurant.menu_style)
  return { data, i18n, style, catalog }
}

// ── Pagine di testo del menu ─────────────────────────────────────────────────

/** Pagina informativa del ristoratore (se attiva e non vuota). */
function infoPage(tc: unknown): MenuData['info'] {
  const info = (tc as { info?: TextPage } | null)?.info
  if (!info?.enabled) return null
  const blocks = parseRichText(info.body, info.align ?? 'left')
  return blocks.length ? { position: info.position === 'last' ? 'last' : 'first', blocks } : null
}

/** Legenda allergeni: se il ristoratore ha attivato la pagina allergeni, viene
 *  generata dal suo elenco (nomi e numeri personalizzati, tradotta); il testo
 *  scritto a mano nel gestionale non serve più. */
function allergenLegendOf(tc: unknown, catalog: AllergenCatalog): MenuData['allergenLegend'] {
  const page = (tc as { allergen?: TextPage } | null)?.allergen
  return page?.enabled ? fullLegend(catalog) : null
}

export function fullLegend(catalog: AllergenCatalog): NonNullable<MenuData['allergenLegend']> {
  return ALLERGENS
    .map(a => ({ id: a.id, n: allergenNumber(a.id, catalog), name: allergenName(a.id, 'it', catalog) }))
    .sort((a, b) => a.n - b.n)
}

