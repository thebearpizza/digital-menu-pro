'use client'

import { useEffect, useMemo } from 'react'
import { useAtom } from 'jotai'
import PdfFlipbookViewer from './PdfFlipbookViewer'
import {
  menus,
  selectedCategoryAtom,
  selectedMenuAtom,
} from './menu-book-state'

type Props = {
  token: string
  menuId: string
}

function CategoryTabs() {
  const [selectedMenu] = useAtom(selectedMenuAtom)
  const [selectedCategory, setSelectedCategory] = useAtom(selectedCategoryAtom)

  const activeMenu = useMemo(
    () => menus.find((menu) => menu.id === selectedMenu) ?? menus[0],
    [selectedMenu]
  )

  return (
    <div className='fixed inset-x-0 top-0 z-30 px-3 pt-3'>
      <div className='mx-auto flex w-full max-w-lg gap-2 overflow-x-auto rounded-full bg-[#faf8f3]/88 px-2 py-2 shadow-[0_10px_35px_rgba(0,0,0,0.12)] backdrop-blur-md'>
        {activeMenu.categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={
              category.id === selectedCategory
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

export default function MenuBookClient({ menuId }: Props) {
  const [selectedMenu, setSelectedMenu] = useAtom(selectedMenuAtom)
  const [, setSelectedCategory] = useAtom(selectedCategoryAtom)

  useEffect(() => {
    const matchedMenu = menus.find((menu) => menu.id === menuId) ?? menus[0]
    setSelectedMenu(matchedMenu.id)
    setSelectedCategory(matchedMenu.categories[0]?.id ?? '')
  }, [menuId, setSelectedMenu, setSelectedCategory])

  const activeMenu = useMemo(
    () => menus.find((menu) => menu.id === selectedMenu) ?? menus[0],
    [selectedMenu]
  )

  const pdfUrl = `/api/menus/${menuId}/pdf`

  return (
    <div className='min-h-[100dvh] w-full bg-[#efe4d4] pt-20 pb-6'>
      <CategoryTabs />
      <div className='px-3'>
        <PdfFlipbookViewer pdfUrl={pdfUrl} key={`${activeMenu.id}-${menuId}`} />
      </div>
    </div>
  )
}
