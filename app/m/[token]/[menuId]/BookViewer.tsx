'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { Box, RoundedBox } from '@react-three/drei'

type Dish = {
  id: string
  name: string
  description: string | null
  price: number | null
  image_url: string | null
  allergens: string[]
  is_available: boolean
  category: string | null
}

type BookPage = {
  category: string
  dishes: Dish[]
}

type Props = {
  dishes: Dish[]
  menuName: string
  restaurantName: string
}

const MAX_ITEMS = 5

function buildPages(dishes: Dish[]): BookPage[] {
  const byCategory = new Map<string, Dish[]>()

  for (const dish of dishes) {
    const cat = dish.category || 'Varie'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(dish)
  }

  const result: BookPage[] = []
  byCategory.forEach((list, cat) => {
    if (list.length <= MAX_ITEMS) {
      result.push({ category: cat, dishes: list })
    } else {
      for (let i = 0; i < list.length; i += MAX_ITEMS) {
        const slice = list.slice(i, i + MAX_ITEMS)
        const label = i === 0 ? cat : `${cat} (${Math.floor(i / MAX_ITEMS) + 1})`
        result.push({ category: label, dishes: slice })
      }
    }
  })

  if (result.length === 0) {
    result.push({ category: 'Menu', dishes: [] })
  }

  result.sort((a, b) => a.category.localeCompare(b.category))
  return result
}

function PageOverlay({
  page,
  menuName,
  restaurantName,
  pageIndex,
  totalPages,
}: {
  page: BookPage
  menuName: string
  restaurantName: string
  pageIndex: number
  totalPages: number
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="w-[82vw] max-w-[520px] aspect-[0.76] rounded-[28px] bg-[#f5efe4]/92 shadow-2xl border border-[#d8c7ae] px-6 py-6 text-[#2b1d14] overflow-hidden">
        <div className="text-center mb-4">
          <p className="text-[11px] tracking-[0.28em] uppercase text-[#8c7458]">
            {restaurantName}
          </p>
          <h2 className="text-[20px] font-semibold text-[#2b1d14]">{menuName}</h2>
          <p className="text-[13px] tracking-[0.18em] uppercase mt-2 text-[#a27f52]">
            {page.category}
          </p>
        </div>

        <div className="space-y-3">
          {page.dishes.map((dish) => (
            <div key={dish.id} className="border-b border-[#dccfbd] pb-2 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-[15px]">{dish.name}</span>
                {dish.price != null && (
                  <span className="text-[14px] text-[#5e4733] whitespace-nowrap">
                    € {dish.price.toFixed(2)}
                  </span>
                )}
              </div>

              {dish.description && (
                <p className="text-[12px] leading-5 text-[#74614f] mt-1 line-clamp-3">
                  {dish.description}
                </p>
              )}

              {dish.allergens?.length > 0 && (
                <p className="text-[10px] uppercase tracking-[0.12em] text-[#9a7245] mt-1">
                  {dish.allergens.join(' • ')}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 text-center text-[11px] tracking-[0.18em] uppercase text-[#9a8367]">
          Pagina {pageIndex + 1} / {totalPages}
        </div>
      </div>
    </div>
  )
}

function MenuModel() {
  return (
    <group position={[0, 0, 0]}>
      {/* retro */}
      <RoundedBox args={[2.28, 3.02, 0.08]} radius={0.04} smoothness={4} position={[0, 0, -0.06]}>
        <meshStandardMaterial color="#2a1d16" roughness={0.82} metalness={0.02} />
      </RoundedBox>

      {/* blocco pagine */}
      <Box args={[2.18, 2.92, 0.10]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#f3eadc" roughness={0.96} metalness={0} />
      </Box>

      {/* copertina frontale */}
      <RoundedBox args={[2.28, 3.02, 0.08]} radius={0.04} smoothness={4} position={[0, 0, 0.08]}>
        <meshStandardMaterial color="#34241b" roughness={0.8} metalness={0.03} />
      </RoundedBox>

      {/* costa */}
      <Box args={[0.12, 3.03, 0.14]} position={[-1.08, 0, 0.01]}>
        <meshStandardMaterial color="#1d130e" roughness={0.88} metalness={0.02} />
      </Box>
    </group>
  )
}

type NavUIProps = {
  currentPage: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}

function NavUI({ currentPage, totalPages, onPrev, onNext }: NavUIProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={onPrev}
        disabled={currentPage <= 0}
        className="pointer-events-auto h-12 w-12 rounded-full bg-[#b08d57] text-[#1b120d] text-2xl shadow-lg disabled:opacity-30"
        aria-label="Pagina precedente"
      >
        ‹
      </button>

      <div className="rounded-full bg-[#1c140f]/85 border border-[#6f5432] px-4 py-2 text-sm text-[#e1c79b]">
        {currentPage + 1} / {totalPages}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={currentPage >= totalPages - 1}
        className="pointer-events-auto h-12 w-12 rounded-full bg-[#b08d57] text-[#1b120d] text-2xl shadow-lg disabled:opacity-30"
        aria-label="Pagina successiva"
      >
        ›
      </button>
    </div>
  )
}

export default function BookViewer({ dishes, menuName, restaurantName }: Props) {
  const [currentPage, setCurrentPage] = useState(0)

  const pages = useMemo(() => buildPages(dishes), [dishes])

  const handlePrev = useCallback(() => {
    setCurrentPage((p) => Math.max(0, p - 1))
  }, [])

  const handleNext = useCallback(() => {
    setCurrentPage((p) => Math.min(pages.length - 1, p + 1))
  }, [pages.length])

  useEffect(() => {
    let startX: number | null = null

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (startX == null) return
      const dx = e.changedTouches[0].clientX - startX
      startX = null
      if (Math.abs(dx) < 40) return
      if (dx < 0) handleNext()
      else handlePrev()
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [handleNext, handlePrev])

  const page = pages[currentPage] ?? pages[0]

  return (
    <div className="relative h-[100dvh] w-full bg-[#15100c] overflow-hidden">
      <Canvas camera={{ position: [0, 0, 6.6], fov: 22 }}>
        <color attach="background" args={['#15100c']} />
        <ambientLight intensity={1.35} color="#fff4e5" />
        <directionalLight position={[0, 0, 5]} intensity={1.1} color="#fff1db" />
        <directionalLight position={[0, 2, 4]} intensity={0.55} color="#f3d7b0" />
        <MenuModel />
      </Canvas>

      <PageOverlay
        page={page}
        menuName={menuName}
        restaurantName={restaurantName}
        pageIndex={currentPage}
        totalPages={pages.length}
      />

      <NavUI
        currentPage={currentPage}
        totalPages={pages.length}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </div>
  )
}
