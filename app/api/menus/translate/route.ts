import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { translateItems, translateEnabled } from '@/lib/translateEngine'
import { TARGET_LANGS, type MenuTranslations } from '@/lib/translations'

// Traduzione del nome di un menu in sottofondo. Il gestionale chiama questa
// route SENZA aspettarla subito dopo aver creato o rinominato un menu: il
// salvataggio risponde immediatamente e Gemini (secondi) lavora qui.
// Auth: sessione Supabase del gestionale + RLS (solo menu del proprietario).

export const maxDuration = 60

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await req.json().catch(() => null) as { menuId?: unknown } | null
  const menuId = typeof body?.menuId === 'string' ? body.menuId : null
  if (!menuId) return NextResponse.json({ ok: false }, { status: 400 })
  if (!translateEnabled()) return NextResponse.json({ ok: true, count: 0 })

  // Solo i menu dei ristoranti di questo utente.
  const { data: menu } = await supabase
    .from('menus')
    .select('id, name, translations, restaurants!inner(owner_id)')
    .eq('id', menuId)
    .eq('restaurants.owner_id', user.id)
    .maybeSingle()
  if (!menu) return NextResponse.json({ ok: false }, { status: 404 })

  // Override manuali preservati.
  try {
    const tr = (menu.translations ?? {}) as MenuTranslations
    const res = await translateItems([{ id: 'name', text: menu.name }])
    let changed = false
    for (const lang of TARGET_LANGS) {
      const entry = tr[lang] ?? (tr[lang] = {})
      const t = res['name']?.[lang]
      if (t && !entry.manual?.name) { entry.name = t; changed = true }
    }
    if (changed) await supabase.from('menus').update({ translations: tr }).eq('id', menuId)
  } catch (e: any) { console.error('menu translate failed', menuId, e?.message) }

  return NextResponse.json({ ok: true, count: 1 })
}
