'use server'

import { createClient } from '@/lib/supabase/server'
import { parseStyle, type MenuStyle } from '@/lib/menuStyle'

/** Salva lo stile del nuovo menu. Solo il proprietario del ristorante; lo
 *  stile viene ripulito (valori ammessi, colori validi) prima di salvarlo. */
export async function saveMenuStyle(restaurantId: string, style: MenuStyle): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sessione scaduta: accedi di nuovo.' }
  const { error } = await supabase
    .from('restaurants')
    .update({ menu_style: parseStyle(style) })
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
  return error ? { ok: false, error: 'Salvataggio non riuscito, riprova.' } : { ok: true }
}
