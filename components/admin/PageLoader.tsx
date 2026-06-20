export default function PageLoader({ fullHeight = false }: { fullHeight?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${fullHeight ? 'min-h-[60vh]' : 'py-24'}`}>
      <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )
}
