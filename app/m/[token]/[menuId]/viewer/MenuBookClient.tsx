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
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <PDFViewer token={token} menuId={menuId} />
    </div>
  )
}
