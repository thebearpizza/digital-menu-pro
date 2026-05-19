import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { ensureMenuPdfCached } from '@/lib/pdf/getMenuPdfData'
import { buildMenuPdfPayload } from '@/lib/pdf/buildPayload'

export const dynamic = 'force-dynamic'

function publicClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token
    if (!token) return new Response('Missing token', { status: 400 })

    const supabase = publicClient()
    const result = await buildMenuPdfPayload(supabase, token)
    if ('error' in result) {
      return new Response(result.error, { status: result.status })
    }

    const { payload, restaurantId, cacheKey } = result
    const { pdfUrl } = await ensureMenuPdfCached(payload, restaurantId, cacheKey)

    return Response.redirect(pdfUrl, 302)
  } catch (error) {
    console.error('[menu-pdf] error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
