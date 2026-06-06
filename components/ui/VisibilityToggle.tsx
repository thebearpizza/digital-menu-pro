'use client'

// Icone Eye / EyeOff come SVG inline — zero dipendenze esterne.
// Stroke identico a Lucide React (viewBox 24, strokeWidth 1.75, round caps/joins).

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <path d="m14.12 14.12a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

/**
 * Toggle visibilità riutilizzabile per piatti, categorie e menu.
 * - Visibile  → occhio aperto blu
 * - Nascosto  → occhio barrato grigio
 */
export default function VisibilityToggle({
  isVisible,
  onToggle,
}: {
  isVisible: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      title={isVisible ? 'Nascondi dal menù' : 'Mostra nel menù'}
      className={`flex items-center justify-center w-[36px] h-[36px] rounded transition-colors ${
        isVisible
          ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
          : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
      }`}
    >
      {isVisible
        ? <EyeIcon className="w-[18px] h-[18px]" />
        : <EyeOffIcon className="w-[18px] h-[18px]" />
      }
    </button>
  )
}
