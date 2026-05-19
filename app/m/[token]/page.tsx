import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// L'endpoint pubblico /m/[token] è il contratto stampato sui QR.
// Vedi CLAUDE.md → "URL del QR code stabile per sempre".
// Questa pagina deve sempre rispondere all'URL /m/[token] esistente.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Menu',
  robots: { index: false, follow: false },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
}

export default async function PublicMenuPage({
  params,
}: {
  params: { token: string }
}) {
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('qr_public_token', params.token)
    .single()

  if (!restaurant) notFound()

  const pdfUrl = `/api/menu-pdf/${encodeURIComponent(params.token)}`
  const viewerUrl = `/pdf-viewer/external/pdfjs-2.1.266-dist/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#525659' }}>
      <iframe
        src={viewerUrl}
        title={`Menu ${restaurant.name}`}
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        allow="fullscreen"
      />
    </div>
  )
}
