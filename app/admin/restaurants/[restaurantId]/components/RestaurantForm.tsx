'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImageFile } from '@/lib/imageCompress'
import { updateRestaurant } from '../actions'
import VisibilityToggle from '@/components/ui/VisibilityToggle'
import { Spinner } from '@/components/ui/Spinner'

interface Visibility {
  name:        boolean
  description: boolean
  logo:        boolean
  instagram:   boolean
  facebook:    boolean
  website:     boolean
  tripadvisor: boolean
  google_maps: boolean
}

interface Restaurant {
  id:              string
  name:            string
  description:     string | null
  logo_url:        string | null
  instagram_url:   string | null
  facebook_url:    string | null
  website_url:     string | null
  tripadvisor_url: string | null
  google_maps_url: string | null
  visibility:      Visibility | null
}

const DEFAULT_VISIBILITY: Visibility = {
  name: true, description: true, logo: true,
  instagram: true, facebook: true, website: true,
  tripadvisor: true, google_maps: true,
}

function parseVisibility(raw: any): Visibility {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_VISIBILITY }
  return { ...DEFAULT_VISIBILITY, ...raw }
}

interface Props {
  restaurant: Restaurant
}

export default function RestaurantForm({ restaurant }: Props) {
  const [name,       setName]       = useState(restaurant.name)
  const [desc,       setDesc]       = useState(restaurant.description ?? '')
  const [logoUrl,    setLogoUrl]    = useState(restaurant.logo_url ?? '')
  const [instagram,  setInstagram]  = useState(restaurant.instagram_url ?? '')
  const [facebook,   setFacebook]   = useState(restaurant.facebook_url ?? '')
  const [website,    setWebsite]    = useState(restaurant.website_url ?? '')
  const [tripadvisor, setTripadvisor] = useState(restaurant.tripadvisor_url ?? '')
  const [googlemaps, setGooglemaps] = useState(restaurant.google_maps_url ?? '')
  const [vis,        setVis]        = useState<Visibility>(parseVisibility(restaurant.visibility))
  const [uploading,  setUploading]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [saved,      setSaved]      = useState(false)

  function toggleVis(key: keyof Visibility) {
    setVis(v => ({ ...v, [key]: !v[key] }))
  }

  async function handleLogoUpload(rawFile: File) {
    setUploading(true)
    const file = await compressImageFile(rawFile)
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${restaurant.id}/logo.${ext}`
    const { data, error: err } = await supabase.storage
      .from('restaurant-assets')
      .upload(path, file, { upsert: true })
    if (!err && data) {
      const { data: pub } = supabase.storage.from('restaurant-assets').getPublicUrl(data.path)
      setLogoUrl(pub.publicUrl)
    } else if (err) {
      setError('Upload logo fallito: ' + err.message)
    }
    setUploading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Il nome è obbligatorio.'); return }
    setSaving(true); setError(null); setSaved(false)
    try {
      await updateRestaurant(restaurant.id, {
        name:            name.trim(),
        description:     desc || null,
        logo_url:        logoUrl || null,
        instagram_url:   instagram || null,
        facebook_url:    facebook  || null,
        website_url:     website   || null,
        tripadvisor_url: tripadvisor || null,
        google_maps_url: googlemaps  || null,
        visibility:      vis as unknown as Record<string, boolean>,
      })
      setSaved(true)
    } catch (err: any) {
      setError(err.message ?? 'Errore. Riprova.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 p-6 space-y-5">
      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs">{error}</div>
      )}
      {saved && (
        <div className="px-3 py-2 bg-green-50 border border-green-200 text-green-700 text-xs">Salvato.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1 mb-1">
            <label className="text-xs font-medium text-gray-600">Nome *</label>
            <VisibilityToggle isVisible={vis.name} onToggle={() => toggleVis('name')} />
          </div>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)} required
            className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <div className="flex items-center gap-1 mb-1">
            <label className="text-xs font-medium text-gray-600">Descrizione breve</label>
            <VisibilityToggle isVisible={vis.description} onToggle={() => toggleVis('description')} />
          </div>
          <input
            type="text" value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Es. Pizzeria romana"
            className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Logo */}
      <div>
        <div className="flex items-center gap-1 mb-1">
          <label className="text-xs font-medium text-gray-600">Logo</label>
          <VisibilityToggle isVisible={vis.logo} onToggle={() => toggleVis('logo')} />
        </div>
        {logoUrl && (
          <div className="relative inline-block mb-2">
            <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain border border-gray-200 bg-gray-50" />
            <button type="button" onClick={() => setLogoUrl('')}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              &times;
            </button>
          </div>
        )}
        <input
          type="file" accept="image/*"
          onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
          className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-300 file:text-xs file:bg-white file:text-gray-700 hover:file:bg-gray-50 cursor-pointer"
        />
        {uploading && <p className="text-xs text-gray-400 mt-1">Caricamento…</p>}
      </div>

      {/* Social Links */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Link Social & Recensioni</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { label: 'Instagram',   key: 'instagram'  as keyof Visibility, value: instagram,   set: setInstagram,   placeholder: 'https://instagram.com/…' },
            { label: 'Facebook',    key: 'facebook'   as keyof Visibility, value: facebook,    set: setFacebook,    placeholder: 'https://facebook.com/…' },
            { label: 'Sito web',    key: 'website'    as keyof Visibility, value: website,     set: setWebsite,     placeholder: 'https://…' },
            { label: 'TripAdvisor', key: 'tripadvisor'as keyof Visibility, value: tripadvisor, set: setTripadvisor, placeholder: 'https://tripadvisor.it/…' },
            { label: 'Google Maps', key: 'google_maps'as keyof Visibility, value: googlemaps,  set: setGooglemaps,  placeholder: 'https://maps.google.com/…' },
          ] as const).map(({ label, key, value, set, placeholder }) => (
            <div key={label}>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-xs text-gray-500">{label}</label>
                <VisibilityToggle isVisible={vis[key]} onToggle={() => toggleVis(key)} />
              </div>
              <input
                type="url" value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-300 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <button
          type="submit" disabled={saving || uploading}
          className="bg-blue-600 text-white text-sm font-medium px-5 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors min-w-[120px] flex items-center justify-center"
        >
          {saving ? <Spinner color="#fff" /> : 'Salva modifiche'}
        </button>
      </div>
    </form>
  )
}
