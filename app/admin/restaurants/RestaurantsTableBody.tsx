'use client'

import { useStaggerEntrance } from '@/lib/animations'

export default function RestaurantsTableBody({ children }: { children: React.ReactNode }) {
  const ref = useStaggerEntrance<HTMLTableSectionElement>({ duration: 450, staggerMs: 60, translateY: 8 })
  return (
    <tbody ref={ref} className="divide-y divide-gray-100">
      {children}
    </tbody>
  )
}
