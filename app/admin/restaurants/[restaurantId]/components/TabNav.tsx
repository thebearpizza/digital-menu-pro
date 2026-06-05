'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props { restaurantId: string }

const TABS = [
  { label: 'Informazioni', suffix: '' },
  { label: 'Menu',         suffix: '/menus' },
  { label: 'Personalizzazione', suffix: '/customization' },
]

export default function TabNav({ restaurantId }: Props) {
  const pathname = usePathname()
  const base = `/admin/restaurants/${restaurantId}`

  return (
    <div className="flex border-b border-gray-200 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      {TABS.map(t => {
        const href = base + t.suffix
        const active = t.suffix === ''
          ? pathname === base
          : pathname.startsWith(href)
        return (
          <Link
            key={t.suffix}
            href={href}
            className={`px-4 sm:px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
              active
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
