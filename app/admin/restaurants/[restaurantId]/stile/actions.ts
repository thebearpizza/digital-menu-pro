'use server'

import { createClient } from '@/lib/supabase/server'
import { parseStyle, type MenuStyle } from '@/lib/menuStyle'
import { parseLanding, type LandingStyle } from '@/lib/landingStyle'

/** Salva gli stili del nuovo menu, menu per menu. Solo il proprietario del
 *  ristorante; ogni stile viene ripulito (valori ammessi, colori validi).
 *  `restaurantDefault`: stile del ristorante (per i menu creati in futuro),
 *  aggiornato quando le modifiche valgono per tutti i menu. */
export async function saveMenuStyles(
  restaurantId: string,
  updates: { menuId: string; style: MenuStyle }[],
  restaurantDefault: MenuStyle | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sessione scaduta: accedi di nuovo.' }
  const { data: own } = await supabase.from('restaurants').select('id').eq('id', restaurantId).eq('owner_id', user.id).maybeSingle()
  if (!own) return { ok: false, error: 'Ristorante non trovato.' }

  for (const u of updates) {
    const { error } = await supabase.from('menus')
      .update({ menu_style: parseStyle(u.style) })
      .eq('id', u.menuId).eq('restaurant_id', restaurantId)
    if (error) return { ok: false, error: 'Salvataggio non riuscito, riprova.' }
  }
  if (restaurantDefault) {
    const { error } = await supabase.from('restaurants')
      .update({ menu_style: parseStyle(restaurantDefault) })
      .eq('id', restaurantId).eq('owner_id', user.id)
    if (error) return { ok: false, error: 'Salvataggio non riuscito, riprova.' }
  }
  return { ok: true }
}

/** Salva lo stile della pagina d'apertura (solo il proprietario; ripulito). */
export async function saveLandingStyle(restaurantId: string, style: LandingStyle): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sessione scaduta: accedi di nuovo.' }
  const { data, error } = await supabase.from('restaurants')
    .update({ landing_style: parseLanding(style) })
    .eq('id', restaurantId).eq('owner_id', user.id)
    .select('id')
  if (error || !data?.length) return { ok: false, error: 'Salvataggio non riuscito, riprova.' }
  return { ok: true }
}

/** Interruttore del QR: true = /m/<token> mostra il nuovo menu. Solo il
 *  proprietario. Effetto immediato per i clienti (nessun nuovo deploy). */
export async function setNewMenu(restaurantId: string, on: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sessione scaduta: accedi di nuovo.' }
  const { data, error } = await supabase.from('restaurants')
    .update({ new_menu: on })
    .eq('id', restaurantId).eq('owner_id', user.id)
    .select('id')
  if (error || !data?.length) return { ok: false, error: 'Modifica non riuscita, riprova.' }
  return { ok: true }
}
