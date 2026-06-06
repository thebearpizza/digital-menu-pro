import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import RestaurantForm from './components/RestaurantForm'
import { QRCodeCard } from './components/QRCodeCard'

export default async function RestaurantInfoPage({
  params,
}: {
  params: { restaurantId: string }
}) {
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, description, logo_url, qr_public_token, instagram_url, facebook_url, website_url, tripadvisor_url, google_maps_url, visibility')
    .eq('id', params.restaurantId)
    .single()

  if (!restaurant) notFound()

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Dati ristorante
        </h2>
        <RestaurantForm restaurant={restaurant} />
      </div>
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          QR Code
        </h2>
        <QRCodeCard token={restaurant.qr_public_token} restaurantName={restaurant.name} />
      </div>
    </div>
  )
}
