import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/admin/LogoutButton'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-52 bg-white border-r border-gray-200 flex flex-col fixed h-full z-10">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-blue-600">
            Digital Menu Pro
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5">
          <Link
            href="/admin"
            className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/restaurants"
            className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Ristoranti
          </Link>
        </nav>

        <div className="px-5 py-4 border-t border-gray-100">
          <div className="text-[11px] text-gray-400 truncate mb-1.5">{user.email}</div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-52 min-h-screen">
        <div className="max-w-6xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
