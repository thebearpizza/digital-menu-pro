import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { autoDishTranslations } from '@/lib/dishTranslations'
import type { DishTranslations } from '@/lib/translations'

// Traduzioni dei piatti in sottofondo. Il gestionale chiama questa route SENZA
// aspettarla subito dopo aver salvato un piatto: il salvataggio risponde
// immediatamente e Gemini (secondi) lavora qui, in una richiesta separata.
// Auth: sessione Supabase del gestionale + RLS (solo piatti del proprietario).

export const maxDuration = 60

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await req.json().catch(() => null) as { dishIds?: unknown } | null
  const ids = Array.isArray(body?.dishIds) ? (body!.dishIds as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 20) : []
  if (!ids.length) return NextResponse.json({ ok: false }, { status: 400 })

  // Solo i piatti dei ristoranti di questo utente.
  const { data: dishes } = await supabase
    .from('dishes')
    .select('id, name, description, translations, restaurants!inner(owner_id)')
    .in('id', ids)
    .eq('restaurants.owner_id', user.id)

  await Promise.all((dishes ?? []).map(async (d: any) => {
    try {
      const tr = await autoDishTranslations(d.name, d.description ?? null, d.translations as DishTranslations | null)
      if (tr) await supabase.from('dishes').update({ translations: tr }).eq('id', d.id)
    } catch (e: any) { console.error('dish translate failed', d.id, e?.message) }
  }))

  return NextResponse.json({ ok: true, count: dishes?.length ?? 0 })
}
