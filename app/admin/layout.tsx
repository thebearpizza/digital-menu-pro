import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminShell from '@/components/admin/AdminShell'
import VoiceAssistant from '@/components/admin/VoiceAssistant'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('owner_id', user.id)
    .order('name')

  return (
    <AdminShell
      userEmail={user.email ?? ''}
      restaurants={(restaurants ?? []).map(r => ({ id: r.id as string, name: r.name as string }))}
    >
      {children}
      <VoiceAssistant />
    </AdminShell>
  )
}
