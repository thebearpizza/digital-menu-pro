'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { translateItems, translateEnabled, type TranslatableItem } from '@/lib/translateEngine'
import { parseTheme } from '@/lib/theme'
import { TARGET_LANGS, type HintTranslations } from '@/lib/translations'

async function verifyOwnership(supabase: any, restaurantId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')
  const { data: r } = await supabase
    .from('restaurants').select('id').eq('id', restaurantId).eq('owner_id', user.id).single()
  if (!r) throw new Error('Non autorizzato')
}

function revalidate(restaurantId: string) {
  revalidatePath(`/admin/restaurants/${restaurantId}/customization`)
}

/**
 * Rigenera le traduzioni automatiche di titolo+testo del pop-up "come sfogliare
 * il menu" (en/fr/de/es/ru), preservando gli override manuali. Ritorna null se non
 * c'è nulla da fare (traduttore spento, pop-up disabilitato/vuoto, oppure le
 * traduzioni sono già fresche per il testo IT corrente) così da NON chiamare
 * Gemini a ogni salvataggio del tema (colori, font, layout…): solo quando il
 * testo del pop-up cambia davvero o mancano lingue. Best effort.
 */
async function autoHintTranslations(
  hint: { enabled: boolean; title: string; text: string },
  existing: HintTranslations | null,
): Promise<HintTranslations | null> {
  if (!translateEnabled() || !hint.enabled) return null
  const title = hint.title.trim()
  const text  = hint.text.trim()
  if (!title && !text) return null

  const tr: HintTranslations = JSON.parse(JSON.stringify(existing ?? {}))
  const fresh = (have?: string, manual?: boolean, src?: string, cur?: string) =>
    !!have && (manual === true || src === cur)
  const needTitle = !!title && TARGET_LANGS.some(l => !fresh(tr[l]?.title, tr[l]?.manual?.title, tr[l]?.srcTitle, hint.title))
  const needText  = !!text  && TARGET_LANGS.some(l => !fresh(tr[l]?.text,  tr[l]?.manual?.text,  tr[l]?.srcText,  hint.text))
  if (!needTitle && !needText) return null

  const items: TranslatableItem[] = []
  if (needTitle) items.push({ id: 'title', text: hint.title })
  if (needText)  items.push({ id: 'text',  text: hint.text })
  const res = await translateItems(items)

  let changed = false
  for (const lang of TARGET_LANGS) {
    const entry = tr[lang] ?? (tr[lang] = {})
    const t = res['title']?.[lang]
    if (t && !entry.manual?.title) { entry.title = t; entry.srcTitle = hint.title; changed = true }
    const x = res['text']?.[lang]
    if (x && !entry.manual?.text)  { entry.text = x; entry.srcText = hint.text; changed = true }
  }
  return changed ? tr : null
}

export async function saveTheme(restaurantId: string, themeConfig: object) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)

  const { data: rest } = await supabase
    .from('restaurants').select('hint_translations').eq('id', restaurantId).single()

  const { error } = await supabase
    .from('restaurants').update({ theme_config: themeConfig }).eq('id', restaurantId)
  if (error) throw new Error(error.message)

  // Pre-genera le traduzioni del pop-up — il menu pubblico non traduce mai al
  // volo. Mirror di autoDishTranslations: se fallisce, ensureMenuTranslations
  // recupera dopo. Va dopo l'update del tema così srcTitle/srcText combaciano
  // col testo appena salvato.
  try {
    const hint = parseTheme(themeConfig).menu.hintPopup
    const tr = await autoHintTranslations(
      { enabled: hint.enabled, title: hint.title, text: hint.text },
      (rest?.hint_translations ?? {}) as HintTranslations,
    )
    if (tr) await supabase.from('restaurants').update({ hint_translations: tr }).eq('id', restaurantId)
  } catch (e: any) { console.error('saveTheme hint translate failed', e?.message) }

  revalidate(restaurantId)
}

export async function createBanner(restaurantId: string, data: {
  media_url: string
  media_type: string
  title?: string
  subtitle?: string
  transition?: string
  sort_order: number
}) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { data: banner, error } = await supabase
    .from('restaurant_banners')
    .insert({ restaurant_id: restaurantId, ...data })
    .select('id, media_url, media_type, title, subtitle, transition, sort_order, is_active')
    .single()
  if (error) throw new Error(error.message)
  revalidate(restaurantId)
  return banner
}

export async function deleteBanner(restaurantId: string, bannerId: string) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase
    .from('restaurant_banners').delete().eq('id', bannerId).eq('restaurant_id', restaurantId)
  if (error) throw new Error(error.message)
  revalidate(restaurantId)
}

export async function saveInfo(restaurantId: string, data: {
  title: string
  content: string
  is_active: boolean
}) {
  const supabase = await createClient()
  await verifyOwnership(supabase, restaurantId)
  const { error } = await supabase
    .from('restaurant_info')
    .upsert({ restaurant_id: restaurantId, ...data, updated_at: new Date().toISOString() },
      { onConflict: 'restaurant_id' })
  if (error) throw new Error(error.message)
  revalidate(restaurantId)
}
