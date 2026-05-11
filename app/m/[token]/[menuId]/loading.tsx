export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center bg-stone-950" style={{ minHeight: '100dvh' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-stone-600 border-t-stone-300 rounded-full animate-spin" />
        <p className="text-stone-500 text-sm">Caricamento menu...</p>
      </div>
    </div>
  )
}
