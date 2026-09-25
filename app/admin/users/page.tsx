// ─────────────────────────────────────────────────────────────────────────────
// Gestione account — visibile SOLO all'account padre.
//
// La guardia è qui (server) e in ogni server action: nascondere la voce di
// menu nella sidebar non è una protezione, è solo estetica. Chi arriva a mano
// su /admin/users senza esserne titolato viene rimandato alla dashboard.
// ─────────────────────────────────────────────────────────────────────────────

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/superAdmin'
import { listUsers } from './actions'
import UsersClient from './UsersClient'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isSuperAdmin(user.email)) redirect('/admin')

  const users = await listUsers()

  return <UsersClient users={users} currentUserId={user.id} />
}
