import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogoutButton } from '@/components/admin/LogoutButton'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-stone-50 flex">

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col fixed h-full z-10">

        {/* Logo */}
        <div className="px-6 py-5 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">DM</span>
            </div>
            <span className="font-semibold text-slate-800 text-sm">Digital Menu Pro</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-3 mb-2">
            Gestione
          </p>

          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-stone-50 hover:text-slate-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>

          <Link
            href="/admin/restaurants"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-stone-50 hover:text-slate-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Ristoranti
          </Link>
        </nav>

        {/* User info + logout */}
        <div className="px-3 py-4 border-t border-stone-100">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
          <LogoutButton />
        </div>

      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>

    </div>
  )
}
