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

  return (
    <div className='relative w-full'>
      <div className='mx-auto w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#dbcdb8] bg-white shadow-[0_24px_80px_rgba(74,53,31,0.14)]'>
        <iframe
          src={pdfUrl}
          title='Menu PDF'
          className='h-[78vh] w-full bg-white'
        />
      </div>
    </div>
  )
}
