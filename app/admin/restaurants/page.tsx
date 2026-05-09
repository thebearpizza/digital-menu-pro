import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function RestaurantsPage({
  searchParams,
}: {
  searchParams: { created?: string; deleted?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', user!.id)
    .order('created_at', { ascending: false })

  const deletedName = searchParams.deleted
    ? decodeURIComponent(searchParams.deleted)
    : null

  return (
    <div>
      {searchParams.created && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl px-4 py-3 mb-6">
          Ristorante creato con successo.
        </div>
      )}

      {deletedName && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3 mb-6">
          Il ristorante <span className="font-medium text-red-800">&ldquo;{deletedName}&rdquo;</span> è stato eliminato.
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Ristoranti</h1>
          <p className="text-slate-500 text-sm mt-1">
            {restaurants?.length ?? 0} ristoranti nel tuo account
          </p>
        </div>
        <Link
          href="/admin/restaurants/new"
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuovo ristorante
        </Link>
      </div>

      {(!restaurants || restaurants.length === 0) && (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-slate-800 font-medium mb-1">Nessun ristorante</h3>
          <p className="text-slate-400 text-sm mb-6">Crea il primo ristorante per iniziare a gestire i menu</p>
          <Link
            href="/admin/restaurants/new"
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Crea ristorante
          </Link>
        </div>
      )}

      {restaurants && restaurants.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {restaurants.map((r) => (
            <Link
              key={r.id}
              href={`/admin/restaurants/${r.id}`}
              className="bg-white rounded-2xl border border-stone-200 p-6 hover:border-slate-300 hover:shadow-sm transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mb-4 overflow-hidden">
                {r.logo_url ? (
                  <img src={r.logo_url} alt={r.name} className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                )}
              </div>
              <h3 className="font-semibold text-slate-800 group-hover:text-slate-900 mb-1">{r.name}</h3>
              <p className="text-sm text-slate-400 line-clamp-2 mb-4">{r.description || 'Nessuna descrizione'}</p>
              <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  r.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-slate-500'
                }`}>
                  {r.is_active ? 'Attivo' : 'Inattivo'}
                </span>
                <span className="text-xs text-slate-400 group-hover:text-slate-600 transition-colors">Gestisci</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
