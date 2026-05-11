'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BackButton({ token, menuName, restaurantName }: {
  token: string
  menuName: string
  restaurantName: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleBack = () => {
    setLoading(true)
    router.push(`/m/${token}`)
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-stone-950/80 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
      <button
        onClick={handleBack}
        disabled={loading}
        className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors cursor-pointer disabled:opacity-60 select-none"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {loading ? (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        )}
        <span className="text-white text-sm font-medium truncate">
          {loading ? 'Caricamento…' : menuName}
        </span>
      </button>
      <span className="text-stone-500 text-xs ml-auto">{restaurantName}</span>
    </div>
  )
}
