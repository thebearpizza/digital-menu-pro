import LitoMark from '@/components/LitoMark'

export default function PageLoader({ fullHeight = false }: { fullHeight?: boolean }) {
  return (
    <div data-app-loading className={`flex items-center justify-center ${fullHeight ? 'min-h-[60vh]' : 'py-24'}`} role="status" aria-label="Caricamento">
      <LitoMark loop className="w-16 h-16" />
    </div>
  )
}
