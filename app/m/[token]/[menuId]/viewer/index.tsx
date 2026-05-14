'use client'

import dynamic from 'next/dynamic'

const MenuBookClient = dynamic(() => import('./MenuBookClient'), {
  ssr: false,
})

export default function MenuViewerEntry() {
  return <MenuBookClient />
}
