'use client'

import { useEffect } from 'react'
import { useAtom } from 'jotai'
import { externalMenuPayloadAtom, viewerPagesAtom } from './menu-book-state'
import PageViewer from './PageViewer'
import DishModal from './DishModal'
import { buildViewerPages, type MenuPayload } from './menu-to-pages'

type Dish = {
  id: string
  name: string
  description: string | null
  price: number | null
  allergens: string[] | null
  category: string | null
  sort_order?: number | null
}

type Props = {
  token: string
  menuId: string
  menuData: {
    id: string
    name: string
    description: string | null
    dishes: Dish[]
  }
}

function MenuViewerContent({ menuData }: { menuData: Props['menuData'] }) {
  const [, setExternalPayload] = useAtom(externalMenuPayloadAtom)
  const [pages] = useAtom(viewerPagesAtom)

  useEffect(() => {
    const payload: MenuPayload = {
      id: menuData.id,
      name: menuData.name,
      description: menuData.description,
      viewer_settings: {
        layout: {
          productsPerPage: 6,
          showCategoryCover: true,
          paginateByCategory: true,
          showCategoryName: true,
          showDescription: true,
          showPrice: true,
          showAllergens: true,
          showImage: false,
        },
        viewer: {
          fixedFrontal: false,
          showBottomTabs: false,
        },
      },
      restaurant: {
        id: 'default',
        name: 'Restaurant',
      },
      dishes: menuData.dishes.map((dish) => ({
        id: dish.id,
        name: dish.name,
        description: dish.description,
        price: dish.price,
        allergens: dish.allergens || [],
        category: dish.category || 'Menu',
        sort_order: dish.sort_order ?? null,
      })),
    }
    setExternalPayload(payload)
  }, [menuData, setExternalPayload])

  return (
    <>
      <PageViewer pages={pages} />
      <DishModal />
    </>
  )
}

export default function MenuBookClient({ menuData }: Props) {
  return (
    <div className='h-screen w-screen bg-[#efe4d4] flex flex-col overflow-hidden'>
      <div className='flex-1 flex flex-col'>
        <MenuViewerContent menuData={menuData} />
      </div>
    </div>
  )
}
