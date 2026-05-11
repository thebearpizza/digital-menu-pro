export default function Loading() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="w-full h-56 bg-stone-200 animate-pulse" />
      <div className="px-4 py-6 max-w-lg mx-auto space-y-3">
        <div className="h-3 w-24 bg-stone-200 rounded-full animate-pulse mb-4" />
        {[1,2,3].map(i => (
          <div key={i} className="bg-white rounded-2xl overflow-hidden border border-stone-200">
            <div className="w-full h-36 bg-stone-100 animate-pulse" />
            <div className="px-5 py-4 space-y-2">
              <div className="h-4 w-32 bg-stone-100 rounded animate-pulse" />
              <div className="h-3 w-48 bg-stone-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
