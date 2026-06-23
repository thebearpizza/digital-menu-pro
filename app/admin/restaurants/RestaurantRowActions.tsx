'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { deleteRestaurant, duplicateRestaurant } from './actions'
import { Spinner } from '@/components/ui/Spinner'

interface Props {
  restaurantId:   string
  restaurantName: string
}

export default function RestaurantRowActions({ restaurantId, restaurantName }: Props) {
  const router             = useRouter()
  const [open, setOpen]    = useState(false)
  const [modal, setModal]  = useState<'delete' | 'none'>('none')
  const [busy, setBusy]    = useState(false)
  const [error, setError]  = useState<string | null>(null)
  const menuRef            = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOut(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  async function handleDuplicate() {
    setOpen(false); setBusy(true); setError(null)
    try {
      const { id } = await duplicateRestaurant(restaurantId)
      router.push(`/admin/restaurants/${id}`)
    } catch (e: any) {
      setError(e.message ?? 'Errore duplicazione')
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true); setError(null)
    try {
      await deleteRestaurant(restaurantId)
    } catch (e: any) {
      setError(e.message ?? 'Errore eliminazione')
      setBusy(false)
    }
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        {busy ? (
          <Spinner size={4} />
        ) : (
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center justify-center w-9 h-9 text-gray-400 hover:text-gray-700 text-lg leading-none hover:bg-gray-100 rounded transition-colors"
            aria-label="Azioni ristorante"
          >
            ⋮
          </button>
        )}

        {open && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 shadow-lg min-w-[152px] py-1">
            <a
              href={`/admin/restaurants/${restaurantId}`}
              className="block px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50"
              onClick={() => setOpen(false)}
            >
              Gestisci
            </a>
            <button
              onClick={handleDuplicate}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Duplica
            </button>
            <div className="h-px bg-gray-100 my-1" />
            <button
              onClick={() => { setOpen(false); setModal('delete') }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
            >
              Elimina
            </button>
          </div>
        )}
      </div>

      {error && (
        <span className="text-xs text-red-500 block mt-1 max-w-[160px]">{error}</span>
      )}

      {modal === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !busy && setModal('none')} />
          <div className="relative bg-white border border-gray-200 shadow-xl w-full max-w-md z-10 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Elimina ristorante</h2>
            <p className="text-xs text-gray-500 mb-1">
              Stai per eliminare <strong>{restaurantName}</strong>.
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Questa azione è <strong>irreversibile</strong> e rimuoverà tutti i menu e i piatti associati.
            </p>
            {error && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs">{error}</div>
            )}
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={busy}
                className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center">
                {busy ? <Spinner color="#fff" /> : 'Sì, elimina'}
              </button>
              <button onClick={() => setModal('none')} disabled={busy}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors">
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
