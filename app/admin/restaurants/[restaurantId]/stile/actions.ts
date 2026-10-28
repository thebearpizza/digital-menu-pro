'use server'

import { createClient } from '@/lib/supabase/server'
import { parseStyle, type MenuStyle } from '@/lib/menuStyle'
import { parseLanding, type LandingStyle } from '@/lib/landingStyle'
import { parseMedia, type MediaPage } from '@/lib/menuMedia'

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

/** Salva le pagine foto/video di un menu (solo il proprietario; ripulite). */
export async function saveMenuMedia(restaurantId: string, menuId: string, pages: MediaPage[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sessione scaduta: accedi di nuovo.' }
  const { data: own } = await supabase.from('restaurants').select('id').eq('id', restaurantId).eq('owner_id', user.id).maybeSingle()
  if (!own) return { ok: false, error: 'Ristorante non trovato.' }
  const { error } = await supabase.from('menus')
    .update({ media_pages: parseMedia(pages) })
    .eq('id', menuId).eq('restaurant_id', restaurantId)
  if (error) return { ok: false, error: 'Salvataggio non riuscito, riprova.' }
  return { ok: true }
}

/** Pagine di testo del nuovo menu (pagina informativa e allergeni) di un
 *  menu. Si aggiornano solo questi campi: il resto di menus.text_content
 *  (caratteri e testo del vecchio menu PDF) resta com'è. */
export interface MenuTextPages {
  info:     { enabled: boolean; position: 'first' | 'last'; body: string; align: 'left' | 'center' | 'right' }
  allergen: { enabled: boolean }
}

export async function saveMenuText(restaurantId: string, menuId: string, pages: MenuTextPages): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sessione scaduta: accedi di nuovo.' }
  const { data: own } = await supabase.from('restaurants').select('id').eq('id', restaurantId).eq('owner_id', user.id).maybeSingle()
  if (!own) return { ok: false, error: 'Ristorante non trovato.' }
  const { data: menu } = await supabase.from('menus').select('text_content').eq('id', menuId).eq('restaurant_id', restaurantId).maybeSingle()
  if (!menu) return { ok: false, error: 'Menu non trovato.' }
  const old = (menu.text_content ?? {}) as Record<string, Record<string, unknown> | undefined>
  const info = pages.info
  const next = {
    ...old,
    info: {
      ...defaultTextPage('first'), ...(old.info ?? {}),
      enabled: !!info.enabled,
      position: info.position === 'last' ? 'last' : 'first',
      body: typeof info.body === 'string' ? info.body.slice(0, 20000) : '',
      align: info.align === 'center' || info.align === 'right' ? info.align : 'left',
    },
    allergen: { ...defaultTextPage('last'), ...(old.allergen ?? {}), enabled: !!pages.allergen.enabled },
  }
  const { error } = await supabase.from('menus').update({ text_content: next }).eq('id', menuId).eq('restaurant_id', restaurantId)
  if (error) return { ok: false, error: 'Salvataggio non riuscito, riprova.' }
  return { ok: true }
}

/** Campi del vecchio menu PDF per una pagina mai salvata (stessi valori base). */
function defaultTextPage(position: 'first' | 'last') {
  return { enabled: false, position, body: '', font: 'Helvetica', fontSize: position === 'first' ? 12 : 11, align: 'left', color: '#1a1a1a', bold: false, italic: false, lineHeight: position === 'first' ? 1.6 : 1.5 }
}
