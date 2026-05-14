'use client'

type Props = {
  pdfUrl?: string
}

export default function PdfFlipbookViewer({ pdfUrl }: Props) {
  const demoUrl = 'https://raffaelemorganti.github.io/pdf-viewer/'
  const src = pdfUrl ? `${demoUrl}?file=${encodeURIComponent(pdfUrl)}` : demoUrl

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
