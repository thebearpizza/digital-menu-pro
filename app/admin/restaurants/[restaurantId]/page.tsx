import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { QRCodeCard } from './components/QRCodeCard'

export default async function RestaurantPage({
  params,
}: {
  params: { restaurantId: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, description, qr_public_token, is_active')
    .eq('id', params.restaurantId)
    .eq('owner_id', user!.id)
    .single()

  if (!restaurant) notFound()

  const { count: dishCount } = await supabase
    .from('dishes')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', params.restaurantId)
    .eq('is_active', true)

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/restaurants" className="text-xs text-blue-600 hover:underline">
          ← Ristoranti
        </Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{restaurant.name}</h1>
            {restaurant.description && (
              <p className="text-sm text-gray-500 mt-0.5">{restaurant.description}</p>
            )}
          </div>
          <span className={`text-xs px-2 py-0.5 font-medium border ${
            restaurant.is_active
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-gray-100 text-gray-500 border-gray-200'
          }`}>
            {restaurant.is_active ? 'Attivo' : 'Inattivo'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QR Code */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 p-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
              QR Code Menu
            </h2>
            {restaurant.qr_public_token && (
              <QRCodeCard
                token={restaurant.qr_public_token}
                restaurantName={restaurant.name}
              />
            )}
          </div>
        </div>

        {/* Menu management */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Piatti del menu</h2>
                <p className="text-xs text-gray-400 mt-0.5">{dishCount ?? 0} piatti attivi</p>
              </div>
              <Link
                href={`/admin/restaurants/${params.restaurantId}/menu`}
                className="bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 transition-colors"
              >
                Gestisci piatti →
              </Link>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              Aggiungi e modifica i piatti del menu. I clienti li vedranno nel menu sfogliabile
              accessibile tramite QR code.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
