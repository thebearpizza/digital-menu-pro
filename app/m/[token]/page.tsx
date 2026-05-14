import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

export default async function PublicLandingPage({
  params,
}: {
  params: { token: string }
}) {
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('qr_public_token', params.token)
    .single()

  if (!restaurant) notFound()

  const { data: menus } = await supabase
    .from('menus')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (menus && menus.length === 1) {
    redirect(`/m/${params.token}/${menus[0].id}`)
  }

  return (
    <div className="min-h-screen bg-stone-50" style={{ paddingTop: "env(safe-area-inset-top)" }}>

      {/* Header ristorante */}
      <div className="relative">
        {restaurant.banner_url ? (
          <div className="w-full h-56 bg-stone-900 overflow-hidden">
            <img
              src={restaurant.banner_url}
              alt={restaurant.name}
              className="w-full h-full object-cover opacity-80"
            />
          </div>
        ) : (
          <div className="w-full h-32 bg-gradient-to-br from-stone-800 to-stone-900" />
        )}

        <div className="absolute bottom-0 left-0 right-0 px-6 pb-4 pt-12 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-end gap-4">
            {restaurant.logo_url && (
              <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-lg flex-shrink-0">
                <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">{restaurant.name}</h1>
              {restaurant.description && (
                <p className="text-white/70 text-sm mt-0.5">{restaurant.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lista menu */}
      <div className="px-4 py-6 max-w-lg mx-auto">
        <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">
          I nostri menu
        </h2>

        {(!menus || menus.length === 0) ? (
          <div className="text-center py-16 text-stone-400">
            <p>Nessun menu disponibile al momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {menus.map((menu) => (
              <Link
                key={menu.id}
                href={`/m/${params.token}/${menu.id}`}
                className="block bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-200 hover:shadow-md transition-shadow"
              >
                {menu.banner_url && (
                  <div className="w-full h-36 bg-stone-100 overflow-hidden">
                    {menu.banner_type === 'video' ? (
                      <video
                        src={menu.banner_url}
                        className="w-full h-full object-contain"
                        muted autoPlay loop playsInline
                      />
                    ) : (
                      <img
                        src={menu.banner_url}
                        alt={menu.name}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                )}
                <div className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-stone-800">{menu.name}</h3>
                    {menu.description && (
                      <p className="text-stone-500 text-sm mt-0.5">{menu.description}</p>
                    )}
                  </div>
                  <svg className="w-5 h-5 text-stone-300 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
