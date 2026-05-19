'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import PdfFlipbookViewer from './PdfFlipbookViewer'

const Canvas3D = dynamic(() => import('./Canvas3D'), { ssr: false })

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

function groupCategories(dishes: Dish[]) {
  const map = new Map<string, Dish[]>()

  for (const dish of dishes) {
    const key = dish.category?.trim() || 'Menu'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(dish)
  }

  return Array.from(map.entries()).map(([label, items]) => ({
    id: label.toLowerCase().replace(/[^a-z0-9]+/gi, '-'),
    label,
    items: [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  }))
}

function CategoryTabs({ categories }: { categories: Array<{ id: string; label: string }> }) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? '')

  return (
    <div className='fixed inset-x-0 top-0 z-30 px-3 pt-3'>
      <div className='mx-auto flex w-full max-w-lg gap-2 overflow-x-auto rounded-full bg-[#faf8f3]/88 px-2 py-2 shadow-[0_10px_35px_rgba(0,0,0,0.12)] backdrop-blur-md'>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={
              category.id === activeCategory
                ? 'shrink-0 rounded-full bg-[#2a1d16] px-4 py-2 text-sm font-medium text-white'
                : 'shrink-0 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#5e4a38]'
            }
          >
            {category.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function MenuBookClient({ menuId, menuData }: Props) {
  const categories = useMemo(() => groupCategories(menuData.dishes), [menuData.dishes])
  const pdfUrl = `/api/menus/${menuId}/pdf`

  return (
    <div className='min-h-[100dvh] w-full bg-[#efe4d4] pt-20 pb-6'>
      <CategoryTabs categories={categories} />
      <div className='px-3'>
        <div className='mx-auto w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#dbcdb8] bg-white shadow-[0_24px_80px_rgba(74,53,31,0.14)]'>
          <div style={{ height: '78vh' }}>
            <Canvas3D />
          </div>
        </div>
      </div>
    </div>
  )
}
