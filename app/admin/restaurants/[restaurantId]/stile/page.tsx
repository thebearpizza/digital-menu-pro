import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { parseStyle } from '@/lib/menuStyle'
import StyleEditor from './StyleEditor'
import QrSwitch from './QrSwitch'

// Personalizzazione del nuovo menu: anteprima vera del menu e comandi accanto.
// Ogni menu ha il suo stile; chi non ne ha uno usa quello del ristorante.
export default async function StylePage({ params }: { params: { restaurantId: string } }) {
  const supabase = await createClient()
  const [{ data: restaurant }, { data: menus }] = await Promise.all([
    supabase.from('restaurants').select('id, qr_public_token, menu_style, new_menu').eq('id', params.restaurantId).single(),
    supabase.from('menus').select('id, name, menu_style').eq('restaurant_id', params.restaurantId).eq('is_active', true).order('sort_order', { ascending: true }),
  ])
  if (!restaurant?.qr_public_token) notFound()

  return (<>
    <QrSwitch restaurantId={params.restaurantId} token={restaurant.qr_public_token as string} initial={restaurant.new_menu === true} />
    <StyleEditor
      restaurantId={params.restaurantId}
      token={restaurant.qr_public_token as string}
      menus={(menus ?? []).map(m => ({
        id: m.id as string, name: m.name as string,
        style: parseStyle(m.menu_style ?? restaurant.menu_style),
      }))}
    />
  </>)
}
