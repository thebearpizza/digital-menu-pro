'use client'

import { Canvas } from '@react-three/fiber'
import { Experience } from './Experience'
import { Suspense } from 'react'
import DishModal from './DishModal'
import { useEffect } from 'react'
import { useAtom } from 'jotai'
import { externalMenuPayloadAtom } from './menu-book-state'
import { type MenuPayload } from './menu-to-pages'

type Props = {
  menuData?: {
    id: string
    name: string
    description: string | null
    dishes: Array<{
      id: string
      name: string
      description: string | null
      price: number | null
      allergens: string[] | null
      category: string | null
      sort_order?: number | null
    }>
  }
}

export default function Canvas3D({ menuData }: Props) {
  const [, setMenuPayload] = useAtom(externalMenuPayloadAtom)

  useEffect(() => {
    if (!menuData) return

    const payload: MenuPayload = {
      id: menuData.id,
      name: menuData.name,
      description: menuData.description,
      viewer_settings: null,
      restaurant: null,
      dishes: menuData.dishes.map((dish) => ({
        id: dish.id,
        name: dish.name,
        description: dish.description,
        price: dish.price,
        allergens: dish.allergens,
        category: dish.category,
        sort_order: dish.sort_order ?? null,
      })),
    }

    setMenuPayload(payload)
  }, [menuData, setMenuPayload])

  return (
    <>
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <Experience />
        </Suspense>
      </Canvas>
      <DishModal />
    </>
  )
}
