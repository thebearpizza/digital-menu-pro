import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { generateMenuPdf } from '@/lib/pdf/generateMenuPdf'
import type { PdfMenu, PdfPayload } from '@/lib/pdf/types'

export const dynamic = 'force-dynamic'

const BUCKET = 'menu-pdfs'

function adminClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function publicClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
}

function publicUrlFor(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`
}

// cache_key = max(updated_at) tra restaurants, menus, dishes per quel ristorante.
// Quando qualcosa cambia nel menu, l'updated_at sale, il path file cambia,
// la cache viene invalidata automaticamente.
function cacheKeyFrom(timestamps: Array<string | null | undefined>): string {
  const max = timestamps
    .filter((t): t is string => Boolean(t))
    .reduce((acc, t) => (t > acc ? t : acc), '0')
  // Normalizziamo per usarlo come path file: solo cifre, ASCII-safe
  return max.replace(/[^0-9]/g, '').slice(0, 14) || '0'
}

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token
    if (!token) return new Response('Missing token', { status: 400 })

    const supabase = publicClient()

    // Ristorante
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name, updated_at')
      .eq('qr_public_token', token)
      .single()

    if (restaurantError || !restaurant) {
      return new Response('Restaurant not found', { status: 404 })
    }

    // Menu attivi del ristorante
    const { data: menus, error: menusError } = await supabase
      .from('menus')
      .select('id, name, description, updated_at, sort_order')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (menusError) {
      console.error('[menu-pdf] menus error:', menusError)
      return new Response('Menus error', { status: 500 })
    }

    if (!menus || menus.length === 0) {
      return new Response('No active menus', { status: 404 })
    }

    // Piatti di tutti i menu in una sola query
    const menuIds = menus.map((m) => m.id)
    const { data: dishes, error: dishesError } = await supabase
      .from('dishes')
      .select('id, name, description, price, category, sort_order, menu_id, updated_at')
      .in('menu_id', menuIds)
      .order('sort_order', { ascending: true })

    if (dishesError) {
      console.error('[menu-pdf] dishes error:', dishesError)
      return new Response('Dishes error', { status: 500 })
    }

    // Calcola cache key
    const allTimestamps: Array<string | null> = [
      restaurant.updated_at,
      ...menus.map((m) => m.updated_at),
      ...(dishes ?? []).map((d) => d.updated_at),
    ]
    const cacheKey = cacheKeyFrom(allTimestamps)
    const path = `${restaurant.id}/${cacheKey}.pdf`

    // Verifica se il file esiste già su Storage
    const admin = adminClient()
    const { data: existing } = await admin.storage
      .from(BUCKET)
      .list(restaurant.id, { limit: 100, search: `${cacheKey}.pdf` })

    const alreadyCached = existing?.some((f) => f.name === `${cacheKey}.pdf`)

    if (alreadyCached) {
      return Response.redirect(publicUrlFor(path), 302)
    }

    // Genera PDF
    const pdfMenus: PdfMenu[] = menus.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      dishes: (dishes ?? [])
        .filter((d) => d.menu_id === m.id)
        .map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description,
          price: d.price,
          category: d.category,
          sort_order: d.sort_order,
        })),
    }))

    const payload: PdfPayload = {
      restaurant: { id: restaurant.id, name: restaurant.name },
      menus: pdfMenus,
    }

    const pdfBytes = await generateMenuPdf(payload)

    // Upload con service role (bypassa RLS)
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
        cacheControl: '3600',
      })

    if (uploadError) {
      console.error('[menu-pdf] upload error:', uploadError)
      // Fallback: restituisci comunque il PDF inline
      return new Response(pdfBytes, {
        headers: { 'Content-Type': 'application/pdf' },
      })
    }

    return Response.redirect(publicUrlFor(path), 302)
  } catch (error) {
    console.error('[menu-pdf] error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
