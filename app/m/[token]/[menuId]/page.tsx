import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import MenuBookClient from './viewer/MenuBookClient'

type PageProps = {
  params: {
    token: string
    menuId: string
  }
}

export default async function PublicMenuPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, qr_public_token')
    .eq('qr_public_token', params.token)
    .single()

  if (!restaurant) notFound()

  const { data: menu } = await supabase
    .from('menus')
    .select('id, name, restaurant_id, is_active')
    .eq('id', params.menuId)
    .eq('restaurant_id', restaurant.id)
    .single()

  if (!menu) notFound()

  return <MenuBookClient pages={[]} />
}
