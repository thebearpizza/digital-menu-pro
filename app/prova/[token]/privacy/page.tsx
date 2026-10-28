import NewPrivacy, { PRIVACY_METADATA } from './NewPrivacy'

export const dynamic = 'force-dynamic'
export const metadata = PRIVACY_METADATA

export default function PrivacyPage({ params }: { params: { token: string } }) {
  return NewPrivacy({ token: params.token, base: '/prova' })
}
