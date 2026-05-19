'use client'

import PDFViewer from './PDFViewer'

type Props = {
  token: string
  menuId: string
  menuData: {
    id: string
    name: string
    description: string | null
    dishes: any[]
  }
}

export default function MenuBookClient({ token, menuId }: Props) {
  return (
    <div className='min-h-[100dvh] w-full bg-white'>
      <PDFViewer token={token} menuId={menuId} />
    </div>
  )
}
