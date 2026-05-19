import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

const MenuBookClient = dynamic(() => import('./viewer/MenuBookClient'), { ssr: false })

export default async function MenuViewerPage({
  params,
}: {
  params: { token: string; menuId: string }
}) {
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id,name,qr_public_token')
    .eq('qr_public_token', params.token)
    .single()

  if (!restaurant) notFound()

  const { data: menu } = await supabase
    .from('menus')
    .select('id,name,description,restaurant_id')
    .eq('id', params.menuId)
    .eq('restaurant_id', restaurant.id)
    .single()

  if (!menu) notFound()

  const { data: dishes } = await supabase
    .from('dishes')
    .select('id,name,description,price,allergens,category,sort_order')
    .eq('menu_id', menu.id)
    .order('sort_order', { ascending: true })

  return (
    <div data-debug-route='MENU_ROUTE_OK' style={{ minHeight: '100vh' }}>
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 99999, background: '#111', color: '#fff', padding: '8px 12px', borderRadius: 12 }}>
        ROUTE FILE ATTIVA
      </div>
      <MenuBookClient
        token={params.token}
        menuId={params.menuId}
        menuData={{
          id: menu.id,
          name: menu.name,
          description: menu.description,
          dishes: dishes ?? [],
        }}
      />
    </div>
  )
}
