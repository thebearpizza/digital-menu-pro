'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'

const PROD_URL = 'https://digital-menu-pro-blush.vercel.app'

export function QRCodeCard({
  restaurantId,
  token,
  restaurantName,
}: {
  restaurantId: string
  token: string
  restaurantName: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)
  const menuUrl = `${PROD_URL}/m/${token}`

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, menuUrl, {
      width: 192,
      margin: 2,
      color: { dark: '#18181b', light: '#ffffff' },
    })
  }, [menuUrl])

  function handleCopy() {
    navigator.clipboard.writeText(menuUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
    if (!canvasRef.current) return
    const a = document.createElement('a')
    a.download = `qr-menu-${restaurantName.toLowerCase().replace(/\s+/g, '-')}.png`
    a.href = canvasRef.current.toDataURL('image/png')
    a.click()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <canvas ref={canvasRef} className="border border-gray-100" />
      </div>

      <div>
        <p className="text-[10px] text-gray-400 mb-1">URL pubblico (production)</p>
        <Link
          href={`/admin/restaurants/${restaurantId}/customization`}
          className="flex items-center gap-2 group"
        >
          <code className="flex-1 text-[10px] text-gray-600 bg-gray-50 px-2 py-1.5 border border-gray-200 break-all font-mono leading-snug min-w-0 group-hover:border-gray-400 group-hover:bg-gray-100 transition-colors cursor-pointer">
            {PROD_URL}
          </code>
          <button
            onClick={e => {
              e.preventDefault()
              handleCopy()
            }}
            type="button"
            className={`shrink-0 text-xs px-2.5 py-1.5 border transition-colors ${
              copied
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {copied ? '✓' : 'Copia'}
          </button>
        </Link>
      </div>

      <div className="flex gap-2">
        <a
          href={`/m/${token}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center text-xs font-medium py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Anteprima
        </a>
        <button
          onClick={handleDownload}
          type="button"
          className="flex-1 text-xs font-medium py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Scarica PNG
        </button>
      </div>

      <Link
        href={`/admin/restaurants/${restaurantId}/customization`}
        className="block w-full text-center text-xs font-medium py-2 bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 transition-colors"
      >
        Gestisci
      </Link>
    </div>
  )
}
