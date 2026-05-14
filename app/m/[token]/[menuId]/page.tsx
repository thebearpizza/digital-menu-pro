import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import MenuBookClient from './viewer/MenuBookClient'

type PageProps = {
  params: {
    token: string
    menuId: string
  }
}

type ViewerPage =
  | { id: string; label: string; kind: 'cover' }
  | { id: string; label: string; kind: 'section' }
  | { id: string; label: string; kind: 'back' }

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

  const { data: dishes } = await supabase
    .from('dishes')
    .select('id, name, category, is_available')
    .eq('menu_id', menu.id)
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  const activeDishes = (dishes ?? []).filter((dish) => dish.is_available !== false)

  const categories = Array.from(
    new Set(
      activeDishes
        .map((dish) => (dish.category || 'Senza categoria').trim())
        .filter(Boolean)
    )
  )

  const pages: ViewerPage[] = [
    { id: 'cover', label: menu.name || restaurant.name || 'Menu', kind: 'cover' },
    ...categories.map((category, index) => ({
      id: `section-${index}`,
      label: category,
      kind: 'section' as const,
    })),
    { id: 'back', label: 'Fine', kind: 'back' },
  ]

  return <MenuBookClient pages={pages as any} />
}
