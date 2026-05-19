'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

type Props = {
  token: string
  restaurantName: string
}

// IMPORTANTE: il pattern URL `/m/${token}` è il contratto pubblico del QR code.
// I QR vengono stampati e affissi nei ristoranti: questo path NON deve mai cambiare.
// Vedi CLAUDE.md → "URL del QR code stabile per sempre".
export function QRCodeCard({ token, restaurantName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)
  const [url, setUrl] = useState(`/m/${token}`)

  useEffect(() => {
    setUrl(`${window.location.origin}/m/${token}`)
  }, [token])

  useEffect(() => {
    if (!canvasRef.current || !url.startsWith('http')) return
    QRCode.toCanvas(canvasRef.current, url, {
      width: 200,
      margin: 2,
      color: {
        dark: '#1c1b19',
        light: '#ffffff',
      },
    })
  }, [url])

  function handleCopy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = `qr-${restaurantName.toLowerCase().replace(/\s+/g, '-')}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="space-y-4">

      {/* QR Code */}
      <div className="flex justify-center">
        <div className="bg-white rounded-2xl p-4 border border-stone-200 inline-block shadow-sm">
          <canvas ref={canvasRef} className="block" />
        </div>
      </div>

      {/* URL copiabile */}
      <div>
        <p className="text-xs text-slate-400 mb-1.5">URL pubblico</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-stone-50 rounded-xl px-3 py-2 text-xs text-slate-600 font-mono break-all border border-stone-200 min-w-0">
            {url}
          </div>
          <button
            onClick={handleCopy}
            className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              copied
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-stone-100 text-slate-600 border border-stone-200 hover:bg-stone-200'
            }`}
          >
            {copied ? 'Copiato' : 'Copia'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          Hai gia un QR stampato? Puntalo a questo URL
        </p>
      </div>

      {/* Azioni */}
      <div className="flex gap-2">
        <a
          href={`/m/${token}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-stone-900 text-white hover:bg-stone-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Apri
        </a>
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white text-slate-700 border border-stone-200 hover:bg-stone-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Scarica PNG
        </button>
      </div>

    </div>
  )
}
