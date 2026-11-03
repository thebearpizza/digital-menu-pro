import type { Metadata } from 'next'
import NewPrivacy, { PRIVACY_METADATA } from '@/app/prova/[token]/privacy/NewPrivacy'

// Informativa privacy del menu digitale (art. 13 GDPR), raggiungibile dal menu.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = PRIVACY_METADATA

export default async function PrivacyPage({ params }: { params: { token: string } }) {
  return NewPrivacy({ token: params.token, base: '/m' })
}
