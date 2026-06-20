import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { restaurant_id, menu_id, dish_id, event_type } = await req.json()

    if (
      typeof restaurant_id !== 'string' || !restaurant_id ||
      typeof menu_id      !== 'string' || !menu_id ||
      !['menu_open', 'dish_click'].includes(event_type)
    ) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const supabase = await createAdminClient()

    await supabase.from('menu_events' as any).insert({
      restaurant_id,
      menu_id,
      dish_id: typeof dish_id === 'string' ? dish_id : null,
      event_type,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
