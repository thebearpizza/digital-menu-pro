'use client'

import { useEffect, useRef } from 'react'

type Props = {
  token: string
  menuId: string
}

export default function PDFViewer({ token, menuId }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    // Costruisci l'URL del PDF
    const pdfUrl = `/api/menu-pdf?menuId=${menuId}&token=${token}`

    // Carica il viewer con il PDF
    const viewerUrl = `/pdf-viewer/external/pdfjs-2.1.266-dist/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`

    if (iframeRef.current) {
      iframeRef.current.src = viewerUrl
    }
  }, [menuId, token])

  return (
    <iframe
      ref={iframeRef}
      style={{
        width: '100vw',
        height: '100vh',
        border: 'none',
        margin: 0,
        padding: 0,
      }}
      title='Menu PDF Viewer'
    />
  )
}
