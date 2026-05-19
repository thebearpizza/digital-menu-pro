'use client'

import { useAtom } from 'jotai'
import { useState, useEffect } from 'react'
import { pageAtom, selectedDishAtom } from './menu-book-state'
import { ViewerPage } from './menu-to-pages'

type Props = {
  pages: ViewerPage[]
}

const allergenEmoji: Record<string, string> = {
  glutine: '🌾',
  lattosio: '🥛',
  noci: '🥜',
  uova: '🥚',
  pesce: '🐟',
  soia: '🫘',
  sedano: '🥬',
  senape: '🌿',
}

function CoverPage({ page }: { page: ViewerPage }) {
  return (
    <div className='flex flex-col items-center justify-center h-full bg-gradient-to-b from-[#e8d5b7] to-[#d9c7a3] p-8 text-center'>
      <h1 className='text-4xl font-bold mb-4 text-[#2a1d16]' style={{ fontFamily: 'Georgia,serif' }}>
        {page.title}
      </h1>
      <p className='text-lg text-[#5c4a3a]'>{page.subtitle}</p>
    </div>
  )
}

function CategoryPage({ page }: { page: ViewerPage }) {
  return (
    <div className='flex flex-col items-center justify-center h-full bg-gradient-to-b from-[#f3e7d3] to-[#e8d5b7] p-8 text-center'>
      <h2 className='text-3xl font-bold mb-2 text-[#2a1d16]' style={{ fontFamily: 'Georgia,serif' }}>
        {page.title}
      </h2>
      <p className='text-sm text-[#5c4a3a]'>{page.subtitle}</p>
    </div>
  )
}

function ItemsPage({ page, onDishClick }: { page: ViewerPage; onDishClick: (item: any) => void }) {
  return (
    <div className='h-full overflow-y-auto bg-white p-6'>
      <h2 className='text-2xl font-bold mb-6 text-[#2a1d16] sticky top-0 bg-white py-2'>
        {page.title}
      </h2>
      <div className='space-y-4'>
        {page.items?.map((item) => (
          <button
            key={item.id}
            onClick={() => onDishClick(item)}
            className='w-full text-left p-4 rounded-lg hover:bg-[#f9f7f4] transition-colors border border-[#e8d5b7] cursor-pointer'
          >
            <div className='flex justify-between items-start gap-3 mb-2'>
              <h3 className='text-lg font-semibold text-[#2a1d16] flex-1'>{item.name}</h3>
              {item.price && item.price > 0 && (
                <span className='text-lg font-bold text-[#8b4513] shrink-0'>€ {item.price.toFixed(2)}</span>
              )}
            </div>
            {item.description && <p className='text-sm text-[#5c4a3a] mb-2'>{item.description}</p>}
            {item.allergens && item.allergens.length > 0 && (
              <div className='flex flex-wrap gap-1'>
                {item.allergens.map((allergen) => (
                  <span
                    key={allergen}
                    className='text-xs px-2 py-0.5 rounded bg-[#f0e8dc] text-[#6b4c2a]'
                    title={allergen}
                  >
                    {allergenEmoji[allergen] ?? '⚠️'}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function BackPage({ page }: { page: ViewerPage }) {
  return (
    <div className='flex flex-col items-center justify-center h-full bg-gradient-to-b from-[#e8d5b7] to-[#d9c7a3] p-8 text-center'>
      <h2 className='text-3xl font-bold mb-2 text-[#2a1d16]' style={{ fontFamily: 'Georgia,serif' }}>
        {page.title}
      </h2>
      <p className='text-lg text-[#5c4a3a]'>{page.subtitle}</p>
    </div>
  )
}

export default function PageViewer({ pages }: Props) {
  const [currentPage, setCurrentPage] = useAtom(pageAtom)
  const [, setSelectedDish] = useAtom(selectedDishAtom)
  const [touchStart, setTouchStart] = useState<number | null>(null)

  const page = pages[currentPage] || pages[0]
  const isFirstPage = currentPage === 0
  const isLastPage = currentPage === pages.length - 1

  const goToPrevious = () => {
    if (!isFirstPage) setCurrentPage(currentPage - 1)
  }

  const goToNext = () => {
    if (!isLastPage) setCurrentPage(currentPage + 1)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return
    const touchEnd = e.changedTouches[0].clientX
    const diff = touchStart - touchEnd

    if (Math.abs(diff) > 50) {
      if (diff > 0) goToNext()
      else goToPrevious()
    }
    setTouchStart(null)
  }

  const handleDishClick = (item: any) => {
    setSelectedDish({
      id: item.id,
      name: item.name,
      description: item.description || '',
      price: item.price || 0,
      allergens: item.allergens || [],
      image: undefined,
      tags: [],
    })
  }

  return (
    <div
      className='flex flex-col h-full w-full bg-[#efe4d4] p-4 sm:p-6 gap-4'
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className='flex-1 overflow-hidden rounded-2xl border-2 border-[#dbcdb8] bg-white shadow-lg'>
        <div className='h-full flex flex-col'>
          {page.kind === 'cover' && <CoverPage page={page} />}
          {page.kind === 'category' && <CategoryPage page={page} />}
          {page.kind === 'items' && <ItemsPage page={page} onDishClick={handleDishClick} />}
          {page.kind === 'back' && <BackPage page={page} />}
        </div>
      </div>

      <div className='flex items-center justify-between gap-4 px-4'>
        <button
          onClick={goToPrevious}
          disabled={isFirstPage}
          className='flex-1 py-3 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          style={{
            background: isFirstPage ? '#e8d5b7' : '#2a1d16',
            color: isFirstPage ? '#8b7355' : '#faf8f3',
          }}
        >
          ← Indietro
        </button>

        <div className='text-center px-4 py-2 rounded-lg bg-[#dbcdb8]/50'>
          <span className='text-sm font-semibold text-[#2a1d16]'>
            {currentPage + 1} / {pages.length}
          </span>
        </div>

        <button
          onClick={goToNext}
          disabled={isLastPage}
          className='flex-1 py-3 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          style={{
            background: isLastPage ? '#e8d5b7' : '#2a1d16',
            color: isLastPage ? '#8b7355' : '#faf8f3',
          }}
        >
          Avanti →
        </button>
      </div>
    </div>
  )
}
