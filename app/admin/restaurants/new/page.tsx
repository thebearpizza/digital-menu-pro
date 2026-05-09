'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { createRestaurant } from './actions'

export default function NewRestaurantPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    instagram_url: '',
    facebook_url: '',
    website_url: '',
    tripadvisor_url: '',
    google_maps_url: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Il nome del ristorante è obbligatorio')
      return
    }
    setLoading(true)
    setError('')

    const result = await createRestaurant(form)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      // Torna alla lista ristoranti con messaggio di successo
      router.push('/admin/restaurants?created=true')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/restaurants" className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Nuovo ristorante</h1>
          <p className="text-slate-500 text-sm mt-0.5">Compila i dati del ristorante</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
            Informazioni principali
          </h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome ristorante <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="Es. Trattoria da Mario"
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
              placeholder="Una breve descrizione del ristorante..."
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

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Salvataggio...' : 'Crea ristorante'}
          </button>
          <Link
            href="/admin/restaurants"
            className="border border-stone-200 text-slate-600 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            Annulla
          </Link>
        </div>
      </form>
    </div>
  )
}
