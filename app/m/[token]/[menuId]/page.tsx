import dynamic from 'next/dynamic'

const MenuBookClient = dynamic(() => import('./viewer/MenuBookClient'), {
  ssr: false,
})

export default function MenuViewerPage() {
  return <MenuBookClient />
}
