import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import TextMenuEditorClient from './TextMenuEditorClient'

export default async function TextMenuEditorPage({
  params,
}: {
  params: { restaurantId: string; menuId: string }
}) {
  const supabase = await createClient()

  const { data: menu } = await supabase
    .from('menus')
    .select('id, name, menu_type, text_content, restaurant_id')
    .eq('id', params.menuId)
    .eq('restaurant_id', params.restaurantId)
    .single()

  if (!menu) notFound()

  // Redirect dish menus to the dish list
  if (!menu.menu_type || menu.menu_type === 'dishes') {
    redirect(`/admin/restaurants/${params.restaurantId}/menus/${params.menuId}`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Link href={`/admin/restaurants/${params.restaurantId}/menus`}
              className="hover:text-gray-600">← Menu</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">{menu.name}</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">{menu.name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">Pagina di testo — appare nel flipbook e nel PDF</p>
        </div>
      </div>

      <TextMenuEditorClient
        restaurantId={params.restaurantId}
        menuId={params.menuId}
        menuName={menu.name as string}
        initialContent={(menu.text_content as any) ?? null}
      />
    </div>
  )
}
