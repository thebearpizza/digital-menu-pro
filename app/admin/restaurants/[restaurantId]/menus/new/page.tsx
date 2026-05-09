'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createMenu } from './actions'
import { MediaUpload } from '@/components/MediaUpload'

export default function NewMenuPage() {
  const router = useRouter()
  const params = useParams()
  const restaurantId = params.restaurantId as string

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    banner_type: 'image' as 'image' | 'video',
    banner_url: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Il nome del menu è obbligatorio'); return }
    setLoading(true)
    setError('')
    const result = await createMenu(restaurantId, form)
    if (result.error) { setError(result.error); setLoading(false) }
    else { router.push(`/admin/restaurants/${restaurantId}?created_menu=true`) }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/admin/restaurants/${restaurantId}`}
          className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Nuovo menu</h1>
          <p className="text-slate-500 text-sm mt-0.5">Aggiungi un menu al ristorante</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">

        <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Informazioni menu</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome menu <span className="text-red-400">*</span></label>
            <input type="text" name="name" value={form.name} onChange={handleChange}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="Es. Menu Pranzo, Menu Degustazione..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrizione</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={3}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
              placeholder="Una breve descrizione del menu..." />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Banner di copertina</h2>
          <p className="text-xs text-slate-400">Il banner viene mostrato nella landing pubblica quando il cliente scansiona il QR.</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo banner</label>
            <select name="banner_type" value={form.banner_type} onChange={handleChange}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
              <option value="image">Immagine</option>
              <option value="video">Video</option>
            </select>
          </div>
          <MediaUpload
            value={form.banner_url}
            onChange={(url) => setForm(prev => ({ ...prev, banner_url: url }))}
            accept="image/*,video/*,image/gif"
            label="Banner (immagine, video o GIF)"
            preview={form.banner_type}
          />
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">
            {loading ? 'Salvataggio...' : 'Crea menu'}
          </button>
          <Link href={`/admin/restaurants/${restaurantId}`}
            className="border border-stone-200 text-slate-600 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors">
            Annulla
          </Link>
        </div>
      </form>
    </div>
  )
}
