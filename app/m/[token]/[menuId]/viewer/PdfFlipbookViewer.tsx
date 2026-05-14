'use client'

type Props = {
  pdfUrl?: string
}

export default function PdfFlipbookViewer({ pdfUrl }: Props) {
  if (!pdfUrl) {
    return (
      <div className='mx-auto flex h-[72vh] w-full max-w-5xl items-center justify-center rounded-[28px] border border-[#dbcdb8] bg-white text-sm text-[#6f5a46] shadow-[0_24px_80px_rgba(74,53,31,0.14)]'>
        PDF non disponibile
      </div>
    )
  }

  const viewerBase = 'https://raffaelemorganti.github.io/pdf-viewer/'
  const src = `${viewerBase}?file=${encodeURIComponent(pdfUrl)}`

  return (
    <div className='relative w-full'>
      <div className='mx-auto w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#dbcdb8] bg-white shadow-[0_24px_80px_rgba(74,53,31,0.14)]'>
        <iframe
          src={src}
          title='PDF Flipbook Viewer'
          className='h-[72vh] w-full bg-white'
          allow='fullscreen'
        />
      </div>
    </div>
  )
}
