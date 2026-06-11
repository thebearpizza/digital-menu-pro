import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminShell from '@/components/admin/AdminShell'
import VoiceAssistant from '@/components/admin/VoiceAssistant'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <AdminShell userEmail={user.email ?? ''}>
      {children}
      <VoiceAssistant />
    </AdminShell>
  )
}
