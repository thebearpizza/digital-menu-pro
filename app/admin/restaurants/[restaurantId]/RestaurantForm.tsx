'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateRestaurant, deleteRestaurant } from './actions'

export function RestaurantForm({ restaurant }: { restaurant: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: restaurant.name || '',
    description: restaurant.description || '',
    instagram_url: restaurant.instagram_url || '',
    facebook_url: restaurant.facebook_url || '',
    website_url: restaurant.website_url || '',
    tripadvisor_url: restaurant.tripadvisor_url || '',
    google_maps_url: restaurant.google_maps_url || '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)
    const result = await updateRestaurant(restaurant.id, form)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const result = await deleteRestaurant(restaurant.id)
    if (result.error) {
      setError(result.error)
      setDeleting(false)
      setShowDeleteModal(false)
    } else {
      const encodedName = encodeURIComponent(restaurant.name)
      router.push(`/admin/restaurants?deleted=${encodedName}`)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">

        <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Informazioni principali
          </h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome ristorante</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrizione</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Link e social
          </h2>
          {[
            { name: 'instagram_url', label: 'Instagram', placeholder: 'https://instagram.com/...' },
            { name: 'facebook_url', label: 'Facebook', placeholder: 'https://facebook.com/...' },
            { name: 'website_url', label: 'Sito web', placeholder: 'https://...' },
            { name: 'tripadvisor_url', label: 'TripAdvisor', placeholder: 'https://tripadvisor.it/...' },
            { name: 'google_maps_url', label: 'Google Maps', placeholder: 'https://maps.google.com/...' },
          ].map(field => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
              <input
                type="url"
                name={field.name}
                value={form[field.name as keyof typeof form]}
                onChange={handleChange}
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder={field.placeholder}
              />
            </div>
          ))}
        </div>

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">
            Modifiche salvate con successo.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Salvataggio...' : 'Salva modifiche'}
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="text-sm text-red-500 hover:text-red-700 transition-colors"
          >
            Elimina ristorante
          </button>
        </div>

      </form>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowDeleteModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-md p-6 space-y-5">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-800">Elimina ristorante</h3>
              <p className="text-sm text-slate-500">
                Stai per eliminare <span className="font-medium text-slate-700">&ldquo;{restaurant.name}&rdquo;</span>.
                Tutti i menu e i piatti collegati verranno rimossi definitivamente.
                Questa operazione non può essere annullata.
              </p>
            </div>
            <div className="bg-stone-50 rounded-xl px-4 py-3 border border-stone-200">
              <p className="text-xs text-slate-500">Questa azione eliminerà:</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-slate-400 inline-block" />
                  Il ristorante e tutte le sue impostazioni
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-slate-400 inline-block" />
                  Tutti i menu associati
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-slate-400 inline-block" />
                  Tutti i piatti e le relative immagini
                </li>
              </ul>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Eliminazione in corso...' : 'Elimina definitivamente'}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 border border-stone-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors"
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
