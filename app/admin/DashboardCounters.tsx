'use client'

import { useStaggerEntrance, useCountUp } from '@/lib/animations'

export default function DashboardCounters({ restaurantCount, dishCount }: {
  restaurantCount: number
  dishCount: number
}) {
  const ref = useStaggerEntrance<HTMLDivElement>({ duration: 500, staggerMs: 80, translateY: 10 })
  const restRef = useCountUp(restaurantCount)
  const dishRef = useCountUp(dishCount)

  return (
    <div ref={ref} className="grid grid-cols-2 gap-4 max-w-sm mb-8">
      <div className="bg-white border border-gray-200 p-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
          Ristoranti
        </div>
        <div className="text-3xl font-semibold text-gray-900"><span ref={restRef}>0</span></div>
      </div>
      <div className="bg-white border border-gray-200 p-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
          Piatti attivi
        </div>
        <div className="text-3xl font-semibold text-gray-900"><span ref={dishRef}>0</span></div>
      </div>
    </div>
  )
}
