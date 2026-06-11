'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createRestaurant } from './actions'
import { Spinner } from '@/components/ui/Spinner'

export default function NewRestaurantPage() {
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Il nome è obbligatorio.'); return }
    setLoading(true)
    setError(null)
    const result = await createRestaurant({
      name, description,
      instagram_url: '', facebook_url: '', website_url: '',
      tripadvisor_url: '', google_maps_url: '',
    })
    if (result?.error) { setError(result.error); setLoading(false) }
    else router.push('/admin/restaurants?created=true')
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/restaurants" className="text-xs text-blue-600 hover:underline">
          ← Ristoranti
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-2">Nuovo ristorante</h1>
      </div>

      <div className="bg-white border border-gray-200 p-6 max-w-lg">
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              required placeholder="Es. Ristorante Dazio"
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrizione</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              rows={3} placeholder="Breve descrizione del ristorante"
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="submit" disabled={loading}
              className="bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors min-w-[130px] flex items-center justify-center"
            >
              {loading ? <Spinner color="#fff" /> : 'Crea ristorante'}
            </button>
            <Link
              href="/admin/restaurants"
              className="text-sm text-gray-600 px-4 py-2 border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Annulla
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
