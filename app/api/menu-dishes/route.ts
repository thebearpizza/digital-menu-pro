import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const menuId = searchParams.get('menuId')
    const token = searchParams.get('token')

    if (!menuId || !token) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 })
    }

    const supabase = await createClient()

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('qr_public_token', token)
      .single()

    if (!restaurant) {
      return new Response(JSON.stringify({ error: 'Restaurant not found' }), { status: 404 })
    }

    const { data: menu } = await supabase
      .from('menus')
      .select('id,name')
      .eq('id', menuId)
      .eq('restaurant_id', restaurant.id)
      .single()

    if (!menu) {
      return new Response(JSON.stringify({ error: 'Menu not found' }), { status: 404 })
    }

    const { data: dishes } = await supabase
      .from('dishes')
      .select('id,name,description,price,allergens,category')
      .eq('menu_id', menu.id)
      .order('sort_order', { ascending: true })

    return new Response(
      JSON.stringify({
        menuName: menu.name,
        dishes: dishes || [],
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching dishes:', error)
    return new Response(JSON.stringify({ error: 'Error fetching dishes' }), { status: 500 })
  }
}
