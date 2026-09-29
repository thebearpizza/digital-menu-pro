import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/superAdmin'
import { LogoutButton } from '@/components/admin/LogoutButton'
import AllergenSettings from './AllergenSettings'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const superAdmin = isSuperAdmin(user?.email)

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Impostazioni</h1>
        <p className="text-sm text-gray-500 mt-1">Account, integrazioni e allergeni.</p>
      </div>

      <section className="bg-white border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Account</h2>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-gray-600 truncate">{user?.email}</div>
          <div className="shrink-0 lito-raised-btn px-4 py-1.5 text-sm"><LogoutButton /></div>
        </div>
      </section>

      <section className="bg-white border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Integrazioni</h2>
        <div className="space-y-2">
          <Link href="/admin/telegram" className="lito-raised-btn flex items-center justify-between px-4 py-3 text-sm">
            <span>
              <span className="font-medium text-gray-900">Telegram</span>
              <span className="block text-xs text-gray-500">Gestisci menu e prezzi scrivendo al bot</span>
            </span>
            <span aria-hidden className="text-gray-400">›</span>
          </Link>
          {superAdmin && (
            <Link href="/admin/users" className="lito-raised-btn flex items-center justify-between px-4 py-3 text-sm">
              <span>
                <span className="font-medium text-gray-900">Utenti</span>
                <span className="block text-xs text-gray-500">Crea e gestisci gli account del gestionale</span>
              </span>
              <span aria-hidden className="text-gray-400">›</span>
            </Link>
          )}
        </div>
      </section>

      <section className="bg-white border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Allergeni</h2>
        <AllergenSettings />
      </section>
    </div>
  )
}
