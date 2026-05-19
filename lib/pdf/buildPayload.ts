import type { SupabaseClient } from '@supabase/supabase-js'
import type { PdfMenu, PdfPayload } from './types'

// Bumpa questa versione quando cambia la logica di generazione del PDF
// per invalidare la cache di tutti i ristoranti.
export const PDF_VERSION = 'v7'

// cache_key = max(updated_at) tra restaurants, menus, dishes per quel ristorante.
// Quando qualcosa cambia nel menu, l'updated_at sale, il path file cambia,
// la cache viene invalidata automaticamente.
function cacheKeyFromTimestamps(timestamps: Array<string | null | undefined>): string {
  const max = timestamps
    .filter((t): t is string => Boolean(t))
    .reduce((acc, t) => (t > acc ? t : acc), '0')
  return max.replace(/[^0-9]/g, '').slice(0, 14) || '0'
}

export function cacheKeyForMenu(timestamps: Array<string | null | undefined>): string {
  return `${PDF_VERSION}-${cacheKeyFromTimestamps(timestamps)}`
}

export type BuildPayloadResult =
  | {
      payload: PdfPayload
      restaurantId: string
      cacheKey: string
      dishesById: Record<string, {
        id: string
        name: string
        description: string | null
        price: number | null
        category: string | null
        image_url: string | null
        allergens: string[] | null
        menu_id: string
      }>
      menus: Array<{ id: string; name: string }>
      categoriesByMenu: Record<string, string[]>
    }
  | { error: string; status: number }

// Carica restaurant + menus + dishes da Supabase e costruisce payload PDF + cacheKey.
// Usato sia dall'API route che dal server component per evitare duplicazione.
export async function buildMenuPdfPayload(
  supabase: SupabaseClient,
  token: string
): Promise<BuildPayloadResult> {
  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, name, updated_at')
    .eq('qr_public_token', token)
    .single()

  if (restaurantError || !restaurant) {
    return { error: 'Restaurant not found', status: 404 }
  }

  const { data: menus, error: menusError } = await supabase
    .from('menus')
    .select('id, name, description, updated_at, sort_order')
    .eq('restaurant_id', restaurant.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (menusError) {
    console.error('[buildMenuPdfPayload] menus error:', menusError)
    return { error: 'Menus error', status: 500 }
  }

  if (!menus || menus.length === 0) {
    return { error: 'No active menus', status: 404 }
  }

  const menuIds = menus.map((m) => m.id)
  const { data: dishes, error: dishesError } = await supabase
    .from('dishes')
    .select('id, name, description, price, category, sort_order, menu_id, updated_at, image_url, allergens')
    .in('menu_id', menuIds)
    .order('sort_order', { ascending: true })

  if (dishesError) {
    console.error('[buildMenuPdfPayload] dishes error:', dishesError)
    return { error: 'Dishes error', status: 500 }
  }

  const allTimestamps: Array<string | null> = [
    restaurant.updated_at,
    ...menus.map((m) => m.updated_at),
    ...(dishes ?? []).map((d) => d.updated_at),
  ]
  const cacheKey = cacheKeyForMenu(allTimestamps)

  const pdfMenus: PdfMenu[] = menus.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    dishes: (dishes ?? [])
      .filter((d) => d.menu_id === m.id)
      .map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        price: d.price,
        category: d.category,
        sort_order: d.sort_order,
        image_url: d.image_url,
        allergens: d.allergens,
      })),
  }))

  const dishesById: Record<string, any> = {}
  for (const d of dishes ?? []) {
    dishesById[d.id] = d
  }

  const categoriesByMenu: Record<string, string[]> = {}
  for (const dish of dishes ?? []) {
    if (dish.category) {
      if (!categoriesByMenu[dish.menu_id]) categoriesByMenu[dish.menu_id] = []
      if (!categoriesByMenu[dish.menu_id].includes(dish.category)) {
        categoriesByMenu[dish.menu_id].push(dish.category)
      }
    }
  }

  return {
    payload: {
      restaurant: { id: restaurant.id, name: restaurant.name },
      menus: pdfMenus,
    },
    restaurantId: restaurant.id,
    cacheKey,
    dishesById,
    menus: menus.map((m) => ({ id: m.id, name: m.name })),
    categoriesByMenu,
  }
}
