'use client'

import { Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo, useState } from 'react'
import { useAtom } from 'jotai'
import { Experience } from './Experience'
import {
  pageAtom,
  menus,
  selectedCategoryAtom,
  selectedDishAtom,
  selectedMenuAtom,
} from './menu-book-state'

function DishModal() {
  const [dish, setDish] = useAtom(selectedDishAtom)
  if (!dish) return null

  return (
    <div
      className='fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4'
      onClick={() => setDish(null)}
    >
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' />
      <div
        className='relative z-10 w-full max-w-md rounded-[24px] border border-[#d8ccb8] bg-[#faf8f3] p-5 shadow-2xl'
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setDish(null)}
          className='absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#2a1d16] text-white'
        >
          ✕
        </button>

        <div className='mb-3 pr-10'>
          <h3 className='text-xl font-bold text-[#2a1d16]'>{dish.name}</h3>
          <p className='mt-1 text-sm text-[#6f5a46]'>{dish.description}</p>
        </div>

        <div className='mb-3 flex items-center justify-between'>
          <span className='rounded-full bg-[#efe3cf] px-3 py-1 text-sm font-semibold text-[#8b5e34]'>
            € {dish.price.toFixed(2)}
          </span>
          <span className='text-xs text-[#8b7763]'>Pagina {dish.page}</span>
        </div>

        <div className='flex flex-wrap gap-2'>
          {dish.allergens.length > 0 ? (
            dish.allergens.map((a) => (
              <span
                key={a}
                className='rounded-full border border-[#dbcdb7] bg-white px-2.5 py-1 text-xs text-[#5e4a38]'
              >
                {a}
              </span>
            ))
          ) : (
            <span className='rounded-full border border-[#d7e6c7] bg-[#f4faee] px-2.5 py-1 text-xs text-[#4c6b35]'>
              Nessun allergene principale
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function ViewerOverlay() {
  const [page, setPage] = useAtom(pageAtom)
  const [selectedMenu, setSelectedMenu] = useAtom(selectedMenuAtom)
  const [selectedCategory, setSelectedCategory] = useAtom(selectedCategoryAtom)
  const [, setSelectedDish] = useAtom(selectedDishAtom)
  const [showMenuSelector, setShowMenuSelector] = useState(false)

  const activeMenu = useMemo(
    () => menus.find((menu) => menu.id === selectedMenu) ?? menus[0],
    [selectedMenu]
  )

  const activeCategory = useMemo(
    () => activeMenu.categories.find((category) => category.id === selectedCategory) ?? activeMenu.categories[0],
    [activeMenu, selectedCategory]
  )

  const changeMenu = (menuId: string) => {
    const menu = menus.find((m) => m.id === menuId) ?? menus[0]
    setSelectedMenu(menu.id)
    setSelectedCategory(menu.categories[0]?.id ?? '')
    setPage(0)
    setShowMenuSelector(false)
  }

  const goToCategory = (categoryId: string) => {
    const category = activeMenu.categories.find((c) => c.id === categoryId)
    if (!category) return
    setSelectedCategory(category.id)
    setPage(category.page)
  }

  return (
    <div className='pointer-events-none fixed inset-0 z-20 flex flex-col'>
      <div className='pointer-events-auto px-3 pt-3'>
        <div className='mx-auto w-full max-w-md rounded-[28px] border border-[#d9ccb7] bg-[#faf8f3]/92 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-md'>
          <div className='mb-3 flex items-center justify-between gap-2'>
            <button
              onClick={() => setShowMenuSelector((v) => !v)}
              className='rounded-full border border-[#dbcdb8] bg-white px-3 py-2 text-sm font-medium text-[#2a1d16]'
            >
              {showMenuSelector ? 'Chiudi menu' : `${activeMenu.emoji} ${activeMenu.label}`}
            </button>

            <div className='flex items-center gap-2'>
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                className='flex h-10 w-10 items-center justify-center rounded-full bg-[#2a1d16] text-white'
              >
                ←
              </button>
              <button
                onClick={() => setPage(0)}
                className='rounded-full border border-[#dbcdb8] bg-white px-3 py-2 text-sm text-[#5f4b39]'
              >
                Inizio
              </button>
            </div>
          </div>

          {showMenuSelector && (
            <div className='mb-3 grid grid-cols-1 gap-2'>
              {menus.map((menu) => (
                <button
                  key={menu.id}
                  onClick={() => changeMenu(menu.id)}
                  className={
                    menu.id === activeMenu.id
                      ? 'rounded-2xl bg-[#2a1d16] px-4 py-3 text-left text-sm text-white'
                      : 'rounded-2xl border border-[#dbcdb8] bg-white px-4 py-3 text-left text-sm text-[#2a1d16]'
                  }
                >
                  {menu.emoji} {menu.label}
                </button>
              ))}
            </div>
          )}

          <div className='mb-3 flex gap-2 overflow-x-auto pb-1'>
            {activeMenu.categories.map((category) => (
              <button
                key={category.id}
                onClick={() => goToCategory(category.id)}
                className={
                  category.id === activeCategory.id
                    ? 'shrink-0 rounded-full bg-[#2a1d16] px-3 py-2 text-sm text-white'
                    : 'shrink-0 rounded-full border border-[#dbcdb8] bg-white px-3 py-2 text-sm text-[#5e4a38]'
                }
              >
                {category.emoji} {category.label}
              </button>
            ))}
          </div>

          <div className='flex gap-2 overflow-x-auto pb-1'>
            {activeCategory.dishes.map((dish) => (
              <button
                key={dish.id}
                onClick={() => setSelectedDish(dish)}
                className='min-w-[150px] rounded-[20px] border border-[#dbcdb8] bg-white px-3 py-3 text-left shadow-sm'
              >
                <div className='mb-2 flex items-center justify-between gap-2'>
                  <span className='line-clamp-2 text-sm font-semibold text-[#2a1d16]'>
                    {dish.name}
                  </span>
                  <span className='rounded-full bg-[#f4eadb] px-2 py-1 text-xs font-semibold text-[#8b5e34]'>
                    € {dish.price.toFixed(2)}
                  </span>
                </div>
                <p className='line-clamp-2 text-xs text-[#7a6551]'>
                  {dish.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className='fixed left-3 top-24 z-[9999] rounded-xl bg-red-600 px-3 py-2 text-white shadow-2xl'>NUOVA UI ATTIVA</div>
      <DishModal />
    </div>
  )
}

export default function MenuBookClient() {
  return (
    <>
      <ViewerOverlay />
      <Loader />
      <div className='h-[100dvh] w-full bg-[#e9dfd0]'>
        <Canvas shadows camera={{ position: [-0.5, -1, 4], fov: 45 }}>
          <group position-y={0}>
            <Suspense fallback={null}>
              <Experience />
            </Suspense>
          </group>
        </Canvas>
      </div>
    </>
  )
}
