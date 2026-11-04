'use client'

import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { menuPdfData } from './pdfActions'

interface Props {
  restaurantId:   string
  restaurantName: string
}

/** Un solo PDF con tutti i menu attivi, con la grafica del menu sul telefono. */
export default function DownloadAllPDFButton({ restaurantId, restaurantName }: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleDownload() {
    setLoading(true)
    setError(null)
    try {
      const [{ menus }, { renderMenuPdf, saveFile }] = await Promise.all([
        menuPdfData(restaurantId),
        import('@/app/prova/[token]/menuPdf'),
      ])
      if (!menus.length) { setError('Nessun menu attivo trovato.'); return }
      saveFile(await renderMenuPdf(menus), `${restaurantName} - tutti i menu.pdf`)
    } catch (e: any) {
      setError(e?.message ?? 'Errore nella generazione del PDF.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-red-500 max-w-[160px] truncate" title={error}>
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        title="Scarica PDF unico con tutti i menu"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <Spinner size={4} />
        ) : (
          <svg width="13" height="15" viewBox="0 0 13 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 1v9M3 7l3.5 3.5L10 7"/>
            <path d="M1 12.5h11" strokeWidth="1.8"/>
          </svg>
        )}
        <span>PDF</span>
      </button>
    </div>
  )
}
