'use client'

import { Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import { useAtom } from 'jotai'
import { Experience } from './Experience'
import { pageAtom, menus, selectedMenuAtom, selectedCategoryAtom, selectedDishAtom } from './menu-book-state'
import DishModal from './DishModal'

function MenuSelector() {
  const [selectedMenu, setSelectedMenu] = useAtom(selectedMenuAtom)
  const [, setSelectedCategory] = useAtom(selectedCategoryAtom)
  const handleSelect = (menuId: string) => {
    setSelectedMenu(menuId)
    const menu = menus.find(m => m.id === menuId)
    if (menu?.categories[0]) setSelectedCategory(menu.categories[0].id)
  }
  return (
    <div className="flex gap-2 justify-center flex-wrap">
      {menus.map(m => (
        <button key={m.id} onClick={() => handleSelect(m.id)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200"
          style={selectedMenu === m.id
            ? { background: '#8b4513', color: '#faf8f3', boxShadow: '0 2px 12px rgba(139,69,19,0.4)' }
            : { background: 'rgba(250,248,243,0.14)', color: '#f3e7d3', border: '1px solid rgba(243,231,211,0.25)' }}>
          <span>{m.emoji}</span><span>{m.label}</span>
        </button>
      ))}
    </div>
  )
}

function CategoryTabs() {
  const [selectedMenu] = useAtom(selectedMenuAtom)
  const [selectedCategory, setSelectedCategory] = useAtom(selectedCategoryAtom)
  const [, setPage] = useAtom(pageAtom)
  const scrollRef = useRef<HTMLDivElement>(null)
  const menu = menus.find(m => m.id === selectedMenu)
  if (!menu) return null
  const handleCategoryClick = (catId: string, catPage: number) => {
    setSelectedCategory(catId)
    setPage(catPage)
    const el = scrollRef.current?.querySelector('[data-cat="' + catId + '"]') as HTMLElement
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }
  return (
    <div ref={scrollRef} className="flex gap-2 overflow-x-auto px-1" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
      {menu.categories.map(cat => (
        <button key={cat.id} data-cat={cat.id} onClick={() => handleCategoryClick(cat.id, cat.page)}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm transition-all duration-200"
          style={selectedCategory === cat.id
            ? { background: 'rgba(250,248,243,0.88)', color: '#2a1d16', fontWeight: 700 }
            : { background: 'rgba(250,248,243,0.11)', color: '#e8d5b7', border: '1px solid rgba(243,231,211,0.18)' }}>
          <span>{cat.emoji}</span><span>{cat.label}</span>
        </button>
      ))}
    </div>
  )
}

function DishList() {
  const [selectedMenu] = useAtom(selectedMenuAtom)
  const [selectedCategory] = useAtom(selectedCategoryAtom)
  const [, setSelectedDish] = useAtom(selectedDishAtom)
  const menu = menus.find(m => m.id === selectedMenu)
  const category = menu?.categories.find(c => c.id === selectedCategory)
  if (!category) return null
  return (
    <div className="flex gap-3 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: 'none' } as React.CSSProperties}>
      {category.dishes.map(dish => (
        <button key={dish.id} onClick={() => setSelectedDish(dish)}
          className="shrink-0 flex flex-col gap-1 text-left rounded-xl p-3 transition-all duration-150 active:scale-95"
          style={{ background: 'rgba(250,248,243,0.13)', border: '1px solid rgba(243,231,211,0.22)', backdropFilter: 'blur(8px)', width: '150px', minWidth: '150px' }}>
          <div className="w-full h-12 rounded-lg flex items-center justify-center text-2xl mb-1" style={{ background: 'rgba(250,248,243,0.1)' }}>
            {dish.image ? <img src={dish.image} alt={dish.name} className="w-full h-full object-cover rounded-lg" /> : '\U0001f37d\ufe0f'}
          </div>
          <span className="text-sm font-semibold leading-tight line-clamp-2" style={{ color: '#f3e7d3' }}>{dish.name}</span>
          {dish.price > 0 && <span className="text-xs font-bold" style={{ color: '#e8b87d' }}>€ {dish.price.toFixed(2)}</span>}
          {dish.tags?.includes('chef') && <span className="text-xs" style={{ color: '#c4956a' }}>Chef</span>}
        </button>
      ))}
    </div>
  )
}

function PageDots() {
  const [page, setPage] = useAtom(pageAtom)
  const total = 5
  return (
    <div className="flex items-center gap-2 justify-center">
      <button onClick={() => setPage(Math.max(0, page - 1))} className="w-8 h-8 rounded-full flex items-center justify-center text-lg" style={{ background: 'rgba(250,248,243,0.15)', color: '#f3e7d3' }} aria-label="Precedente">{'<'}</button>
      {Array.from({ length: total }).map((_, i) => (
        <button key={i} onClick={() => setPage(i)} className="rounded-full transition-all duration-300"
          style={{ width: i === page ? '22px' : '8px', height: '8px', background: i === page ? '#e8b87d' : 'rgba(250,248,243,0.28)' }}
          aria-label={i === 0 ? 'Copertina' : 'Pagina ' + i} />
      ))}
      <button onClick={() => setPage(Math.min(total - 1, page + 1))} className="w-8 h-8 rounded-full flex items-center justify-center text-lg" style={{ background: 'rgba(250,248,243,0.15)', color: '#f3e7d3' }} aria-label="Successiva">{'>'}</button>
    </div>
  )
}

export default function MenuBookClient() {
  return (
    <>
      <Loader />
      <div className="fixed inset-0" style={{ background: '#140b08' }}>
        <Canvas shadows camera={{ position: [-0.5, -1, 4], fov: 45 }}>
          <group position-y={0}>
            <Suspense fallback={null}><Experience /></Suspense>
          </group>
        </Canvas>
      </div>
      <div className="fixed inset-0 z-10 pointer-events-none flex flex-col">
        <div className="pointer-events-auto flex flex-col gap-2.5 px-4 pt-4 pb-3"
          style={{ background: 'linear-gradient(to bottom,rgba(20,11,8,0.92) 0%,rgba(20,11,8,0.55) 80%,transparent 100%)' }}>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold tracking-wide" style={{ color: '#f3e7d3', fontFamily: 'Georgia,serif' }}>The Bear Pizza</span>
            <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(139,69,19,0.35)', color: '#e8b87d', border: '1px solid rgba(232,184,125,0.28)' }}>Menu Digitale</span>
          </div>
          <MenuSelector />
          <CategoryTabs />
        </div>
        <div className="flex-1" />
        <div className="pointer-events-auto flex flex-col gap-3 px-4 pb-6 pt-4"
          style={{ background: 'linear-gradient(to top,rgba(20,11,8,0.95) 0%,rgba(20,11,8,0.65) 70%,transparent 100%)' }}>
          <DishList />
          <PageDots />
        </div>
      </div>
      <DishModal />
    </>
  )
}
