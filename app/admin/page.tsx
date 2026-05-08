import { createClient } from '@/lib/supabase/server'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { count: restaurantCount } = await supabase
    .from('restaurants')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', user!.id)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Benvenuto nel pannello di gestione</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
            Ristoranti
          </p>
          <p className="text-3xl font-semibold text-slate-800">{restaurantCount ?? 0}</p>
          <p className="text-xs text-slate-400 mt-1">nel tuo account</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
            Menu attivi
          </p>
          <p className="text-3xl font-semibold text-slate-800">0</p>
          <p className="text-xs text-slate-400 mt-1">su tutti i ristoranti</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
            Piatti totali
          </p>
          <p className="text-3xl font-semibold text-slate-800">0</p>
          <p className="text-xs text-slate-400 mt-1">nel database</p>
        </div>
      </div>

      {/* Quick action */}
      {restaurantCount === 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
          <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-slate-800 font-medium mb-1">Nessun ristorante ancora</h3>
          <p className="text-slate-400 text-sm mb-4">Crea il tuo primo ristorante per iniziare</p>
          <a
            href="/admin/restaurants/new"
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            + Crea ristorante
          </a>
        </div>
      )}
    </div>
  )
}
