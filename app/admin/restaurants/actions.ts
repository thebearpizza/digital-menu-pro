'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function deleteRestaurant(restaurantId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  const { data: r } = await supabase
    .from('restaurants').select('id').eq('id', restaurantId).eq('owner_id', user.id).single()
  if (!r) throw new Error('Non autorizzato')

  const { error } = await supabase.from('restaurants').delete().eq('id', restaurantId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/restaurants')
  revalidatePath('/admin') // i contatori della dashboard includono questo ristorante
  redirect('/admin/restaurants')
}

export async function duplicateRestaurant(restaurantId: string): Promise<{ id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  const { data: src } = await supabase
    .from('restaurants').select('*').eq('id', restaurantId).eq('owner_id', user.id).single()
  if (!src) throw new Error('Ristorante non trovato')

  const { data: newR, error: rErr } = await supabase
    .from('restaurants')
    .insert({
      owner_id:         user.id,
      name:             `${src.name} (copia)`,
      slug:             `${(src.slug ?? src.name.toLowerCase().replace(/\s+/g, '-'))}-copia-${Math.random().toString(36).slice(2, 6)}`,
      qr_public_token:  crypto.randomUUID(),
      description:      src.description,
      instagram_url:    src.instagram_url,
      facebook_url:     src.facebook_url,
      website_url:      src.website_url,
      tripadvisor_url:  src.tripadvisor_url,
      google_maps_url:  src.google_maps_url,
      logo_url:         src.logo_url,
      is_active:        true,
      theme_config:     src.theme_config,
      visibility:       src.visibility,
    })
    .select('id').single()
  if (rErr || !newR) throw new Error(rErr?.message ?? 'Errore duplicazione ristorante')

  const { data: menus } = await supabase
    .from('menus').select('*').eq('restaurant_id', restaurantId).order('sort_order')

  for (const menu of menus ?? []) {
    const { data: newMenu } = await supabase
      .from('menus')
      .insert({
        restaurant_id:    newR.id,
        name:             menu.name,
        is_active:        menu.is_active,
        sort_order:       menu.sort_order,
        schedule_enabled: menu.schedule_enabled,
        schedule_from:    menu.schedule_from,
        schedule_until:   menu.schedule_until,
        text_content:     menu.text_content,
        translations:     menu.translations,
        category_order:   menu.category_order,
      })
      .select('id').single()
    if (!newMenu) continue

    const { data: dishes } = await supabase
      .from('dishes').select('*').eq('menu_id', menu.id).order('sort_order')
    if (dishes?.length) {
      await supabase.from('dishes').insert(
        dishes.map((d: any) => ({
          menu_id:      newMenu.id,
          name:         d.name,
          description:  d.description,
          price:        d.price,
          category:     d.category,
          is_active:    d.is_active,
          image_url:    d.image_url,
          allergens:    d.allergens,
          sort_order:   d.sort_order,
          translations: d.translations,
        }))
      )
    }
  }

  revalidatePath('/admin/restaurants')
  revalidatePath('/admin')
  return { id: newR.id }
}
