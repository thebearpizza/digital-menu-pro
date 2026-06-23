import { createClient } from '@/lib/supabase/server'
import RestaurantsTableBody from './RestaurantsTableBody'
import DownloadAllPDFButton from './DownloadAllPDFButton'
import RestaurantRowActions from './RestaurantRowActions'
import Link from 'next/link'

export default async function RestaurantsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, name, qr_public_token, is_active, created_at')
    .eq('owner_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ristoranti</h1>
          <p className="text-sm text-gray-500 mt-1">
            {restaurants?.length ?? 0} ristorante/i nel tuo account
          </p>
        </div>
        <Link
          href="/admin/restaurants/new"
          className="shrink-0 inline-flex items-center justify-center bg-blue-600 text-white text-sm font-medium px-4 py-2 min-h-[44px] hover:bg-blue-700 transition-colors"
        >
          + Nuovo ristorante
        </Link>
      </div>

      {!restaurants?.length ? (
        <div className="bg-white border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-500 mb-4">Nessun ristorante ancora.</p>
          <Link href="/admin/restaurants/new" className="text-sm text-blue-600 hover:underline">
            Crea il primo ristorante
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[420px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stato</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <RestaurantsTableBody>
              {restaurants.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/restaurants/${r.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 font-medium border ${
                      r.is_active
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      {r.is_active ? 'Attivo' : 'Inattivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <DownloadAllPDFButton
                        restaurantId={r.id}
                        restaurantName={r.name}
                      />
                      <RestaurantRowActions
                        restaurantId={r.id}
                        restaurantName={r.name}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </RestaurantsTableBody>
          </table>
        </div>
      )}
    </div>
  )
}
