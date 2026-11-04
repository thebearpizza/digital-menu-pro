import type { Metadata } from 'next'
import NewMenuPage, { NEW_MENU_METADATA, type NewMenuSearch } from '@/app/prova/[token]/NewMenuPage'

// The /m/[token] URL pattern is the printed QR contract — this path must never change.
// See CLAUDE.md → "URL del QR code stabile per sempre"
// Pagina d'apertura e menu a tutto schermo (con ?menu=<id>): conta visite e aperture.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = NEW_MENU_METADATA

export default async function PublicMenuPage({ params, searchParams }: {
  params: { token: string }
  searchParams?: NewMenuSearch
}) {
  return NewMenuPage({ token: params.token, searchParams: searchParams ?? {}, base: '/m', live: true })
}
