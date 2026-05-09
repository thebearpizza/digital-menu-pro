import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import FlipBook from './FlipBook'

export default async function PublicMenuPage({
  params,
}: {
  params: { token: string; menuId: string }
}) {
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('qr_public_token', params.token)
    .single()

  if (!restaurant) notFound()

  const { data: menu } = await supabase
    .from('menus')
    .select('*')
    .eq('id', params.menuId)
    .eq('restaurant_id', restaurant.id)
    .eq('is_active', true)
    .single()

  if (!menu) notFound()

  const { data: dishes } = await supabase
    .from('dishes')
    .select('*')
    .eq('menu_id', params.menuId)
    .eq('is_available', true)
    .order('category', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true })

  return (
    <div>
      {/* Barra top con link back */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-stone-950/80 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
        <Link
          href={`/m/${params.token}`}
          className="text-stone-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <span className="text-white text-sm font-medium truncate">{menu.name}</span>
        <span className="text-stone-500 text-xs ml-auto">{restaurant.name}</span>
      </div>

      {/* Flipbook con padding top per la barra */}
      <div className="pt-12">
        <FlipBook
          dishes={dishes ?? []}
          menuName={menu.name}
          restaurantName={restaurant.name}
        />
      </div>
    </div>
  )
}
