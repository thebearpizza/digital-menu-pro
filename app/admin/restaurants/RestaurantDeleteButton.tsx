'use client'

import { useState } from 'react'
import { deleteRestaurant } from './actions'
import { Spinner } from '@/components/ui/Spinner'

export default function RestaurantDeleteButton({
  restaurantId,
  restaurantName,
}: {
  restaurantId: string
  restaurantName: string
}) {
  const [open, setOpen]       = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await deleteRestaurant(restaurantId)
    } catch (err: any) {
      setError(err.message ?? 'Errore. Riprova.')
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-red-500 hover:underline whitespace-nowrap"
      >
        Elimina
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !deleting && setOpen(false)} />
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
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center"
              >
                {deleting ? <Spinner color="#fff" /> : 'Sì, elimina'}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={deleting}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
