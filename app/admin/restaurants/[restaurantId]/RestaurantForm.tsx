'use client'

import { useState } from 'react'
import { updateRestaurant } from './actions'

export function RestaurantForm({ restaurant }: { restaurant: any }) {
  const [loading, setLoading] = useState(false)
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
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
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
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
          ✅ Modifiche salvate con successo!
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
      >
        {loading ? 'Salvataggio...' : 'Salva modifiche'}
      </button>

    </form>
  )
}
