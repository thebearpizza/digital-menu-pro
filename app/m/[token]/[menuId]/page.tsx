import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

type PageProps = {
  params: {
    token: string
    menuId: string
  }
}

export default async function PublicMenuPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, qr_public_token')
    .eq('qr_public_token', params.token)
    .single()

  if (!restaurant) notFound()

  const { data: menu } = await supabase
    .from('menus')
    .select('id, restaurant_id, is_active')
    .eq('id', params.menuId)
    .eq('restaurant_id', restaurant.id)
    .single()

  if (!menu) notFound()

  const pdfUrl = `/api/menus/${menu.id}/pdf`

  return (
    <main style={{ width: '100%', height: '100dvh', margin: 0, background: '#111' }}>
      <iframe
        src={`/flipbook/index.html?pdf=${encodeURIComponent(pdfUrl)}`}
        title="Menu Flipbook"
        style={{ width: '100%', height: '100%', border: '0', display: 'block', background: '#111' }}
      />
    </main>
  )
}
