import { redirect } from 'next/navigation'

// La vecchia Personalizzazione (vecchio menu) non c'è più: i collegamenti
// salvati portano a quella del menu.
export default function OldCustomization({ params }: { params: { restaurantId: string } }) {
  redirect(`/admin/restaurants/${params.restaurantId}/stile`)
}
