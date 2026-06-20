'use client'

import { useStaggerEntrance, useCountUp } from '@/lib/animations'

export default function DashboardCounters({
  restaurantCount,
  activeMenuCount,
  activeDishCount,
  inactiveDishCount,
}: {
  restaurantCount:   number
  activeMenuCount:   number
  activeDishCount:   number
  inactiveDishCount: number
}) {
  const ref        = useStaggerEntrance<HTMLDivElement>({ duration: 500, staggerMs: 80, translateY: 10 })
  const restRef    = useCountUp(restaurantCount)
  const menuRef    = useCountUp(activeMenuCount)
  const dishRef    = useCountUp(activeDishCount)
  const inactRef   = useCountUp(inactiveDishCount)

  return (
    <div ref={ref} className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
      <div className="bg-white border border-gray-200 p-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Ristoranti</div>
        <div className="text-3xl font-semibold text-gray-900"><span ref={restRef}>0</span></div>
      </div>
      <div className="bg-white border border-gray-200 p-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Menu attivi</div>
        <div className="text-3xl font-semibold text-gray-900"><span ref={menuRef}>0</span></div>
      </div>
      <div className="bg-white border border-gray-200 p-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Piatti attivi</div>
        <div className="text-3xl font-semibold text-gray-900"><span ref={dishRef}>0</span></div>
      </div>
      <div className="bg-white border border-gray-200 p-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Piatti disattivati</div>
        <div className="text-3xl font-semibold text-gray-900"><span ref={inactRef}>0</span></div>
      </div>
    </div>
  )
}
