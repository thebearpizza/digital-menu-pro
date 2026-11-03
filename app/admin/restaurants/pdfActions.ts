'use server'

import { createClient } from '@/lib/supabase/server'
import { MENU_COLS, buildMenuData } from '@/app/prova/[token]/menuData'
import type { MenuData } from '@/app/prova/[token]/typeset'
import type { MenuStyle } from '@/lib/menuStyle'

/** Dati dei menu attivi di un ristorante (o di uno solo) per il PDF: gli
 *  stessi del menu sul telefono, senza gli orari (nel PDF c'è tutto il menu). */
export async function menuPdfData(restaurantId: string, menuId?: string): Promise<{
  restaurantName: string
  menus: { id: string; name: string; data: MenuData; style: MenuStyle }[]
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')
  const { data: restaurant } = await supabase
    .from('restaurants').select('id, name, owner_id, theme_config, menu_style')
    .eq('id', restaurantId).eq('owner_id', user.id).single()
  if (!restaurant) throw new Error('Non autorizzato')

  let q = supabase.from('menus').select(MENU_COLS).eq('restaurant_id', restaurantId).eq('is_active', true)
  if (menuId) q = q.eq('id', menuId)
  const { data: menus } = await q.order('sort_order', { ascending: true })

  const out = []
  for (const m of menus ?? []) {
    const { data, style } = await buildMenuData(supabase, restaurant, m, { schedules: false })
    if (data.categories.length) out.push({ id: m.id as string, name: m.name as string, data, style })
  }
  return { restaurantName: restaurant.name as string, menus: out }
}
