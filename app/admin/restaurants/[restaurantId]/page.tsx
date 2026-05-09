import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { RestaurantForm } from './RestaurantForm'

export default async function RestaurantDetailPage({
  params,
  searchParams,
}: {
  params: { restaurantId: string }
  searchParams: { created_menu?: string; deleted_menu?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', params.restaurantId)
    .eq('owner_id', user.id)
    .single()

  if (!restaurant) notFound()

  const { data: menus } = await supabase
    .from('menus')
    .select('*')
    .eq('restaurant_id', params.restaurantId)
    .order('sort_order', { ascending: true })

  return (
    <div>
      {searchParams.created_menu && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl px-4 py-3 mb-6">
          Menu creato con successo.
        </div>
      )}
      {searchParams.deleted_menu && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3 mb-6">
          Menu eliminato con successo.
        </div>
      )}

      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/restaurants" className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center overflow-hidden">
            {restaurant.logo_url
              ? <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" />
              : (
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              )
            }
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">{restaurant.name}</h1>
            <p className="text-slate-500 text-sm">Gestione ristorante</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RestaurantForm restaurant={restaurant} />
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</h2>
              <Link
                href={`/admin/restaurants/${params.restaurantId}/menus/new`}
                className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                + Nuovo
              </Link>
            </div>

            {(!menus || menus.length === 0) ? (
              <div className="text-center py-6">
                <p className="text-slate-400 text-sm mb-3">Nessun menu ancora</p>
                <Link
                  href={`/admin/restaurants/${params.restaurantId}/menus/new`}
                  className="text-xs text-slate-500 underline underline-offset-2"
                >
                  Crea il primo menu
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {menus.map((menu) => (
                  <Link
                    key={menu.id}
                    href={`/admin/restaurants/${params.restaurantId}/menus/${menu.id}`}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-1.5 h-1.5 rounded-full ${menu.is_active ? 'bg-emerald-400' : 'bg-stone-300'}`} />
                      <span className="text-sm text-slate-700">{menu.name}</span>
                    </div>
                    <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">QR Code</h2>
            <p className="text-xs text-slate-400 mb-3">Link pubblico del ristorante</p>
            <div className="bg-stone-50 rounded-xl px-3 py-2 text-xs text-slate-600 font-mono break-all border border-stone-200">
              /m/{restaurant.qr_public_token}
            </div>
            {restaurant.qr_public_token && (
              <a
                href={`/m/${restaurant.qr_public_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 transition-colors font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Apri menu pubblico
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
