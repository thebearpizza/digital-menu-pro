import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminShell from '@/components/admin/AdminShell'
import VoiceAssistant from '@/components/admin/VoiceAssistant'
import LitoSplash from '@/components/LitoSplash'
import type { AllergenOverride } from '@/lib/allergens'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: overrides }, { data: restaurants }] = await Promise.all([
    supabase.from('allergen_overrides').select('items').eq('user_id', user.id).maybeSingle(),
    supabase.from('restaurants').select('name, qr_public_token').eq('owner_id', user.id).order('name'),
  ])

  return (
    <AdminShell
      dockAccessory={<VoiceAssistant />}
      allergenCatalog={(overrides?.items as AllergenOverride[] | undefined) ?? null}
      previewMenus={(restaurants ?? [])
        .filter(r => r.qr_public_token)
        .map(r => ({ name: r.name as string, token: r.qr_public_token as string }))}
    >
      {children}
      <LitoSplash variant="loop" />
    </AdminShell>
  )
}
