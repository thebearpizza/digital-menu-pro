import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminShell from '@/components/admin/AdminShell'
import VoiceAssistant from '@/components/admin/VoiceAssistant'
import LitoSplash from '@/components/LitoSplash'
import { isSuperAdmin } from '@/lib/superAdmin'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <AdminShell
      userEmail={user.email ?? ''}
      isSuperAdmin={isSuperAdmin(user.email)}
      dockAccessory={<VoiceAssistant />}
    >
      {children}
      <LitoSplash variant="loop" />
    </AdminShell>
  )
}
