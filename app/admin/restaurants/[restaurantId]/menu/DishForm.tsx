'use client'

import { useState } from 'react'
import { createDish, updateDish } from './actions'
import { createClient } from '@/lib/supabase/client'

interface Dish {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string | null
  image_url: string | null
  sort_order: number
  is_active: boolean
}

interface Props {
  restaurantId: string
  dish: Dish | null
  onSaved: (dish: Dish, isNew: boolean) => void
  onClose: () => void
}

export default function DishForm({ restaurantId, dish, onSaved, onClose }: Props) {
  const [name, setName]               = useState(dish?.name ?? '')
  const [description, setDescription] = useState(dish?.description ?? '')
  const [price, setPrice]             = useState(dish?.price?.toString() ?? '')
  const [category, setCategory]       = useState(dish?.category ?? '')
  const [imageUrl, setImageUrl]       = useState(dish?.image_url ?? '')
  const [uploading, setUploading]     = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  async function handleUpload(file: File) {
    setUploading(true)
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${restaurantId}/${Date.now()}.${ext}`

    const { data, error: err } = await supabase.storage
      .from('dish-images')
      .upload(path, file, { upsert: true })

    if (!err && data) {
      const { data: pub } = supabase.storage.from('dish-images').getPublicUrl(data.path)
      setImageUrl(pub.publicUrl)
    } else if (err) {
      setError('Upload immagine fallito: ' + err.message)
    }
    setUploading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim())     { setError('Il nome è obbligatorio.'); return }
    if (!category.trim()) { setError('La categoria è obbligatoria.'); return }
    setSaving(true)
    setError(null)

    const payload = {
      name: name.trim(),
      description,
      price,
      category: category.trim(),
      image_url: imageUrl,
    }

    try {
      const saved = dish
        ? await updateDish(restaurantId, dish.id, payload)
        : await createDish(restaurantId, payload)
      onSaved(saved as Dish, !dish)
    } catch (err: any) {
      setError(err.message ?? 'Errore. Riprova.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 shadow-xl w-full max-w-md z-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            {dish ? 'Modifica piatto' : 'Nuovo piatto'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
            aria-label="Chiudi"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Es. Bruschetta al pomodoro"
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoria *</label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                required
                placeholder="Es. Antipasti"
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prezzo (€)</label>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                min="0"
                step="0.50"
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrizione</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Ingredienti, allergeni, note…"
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Foto</label>
            {imageUrl && (
              <div className="relative inline-block mb-2">
                <img
                  src={imageUrl}
                  alt=""
                  className="w-20 h-20 object-cover border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center leading-none"
                >
                  &times;
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
              className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-300 file:text-xs file:bg-white file:text-gray-700 hover:file:bg-gray-50 cursor-pointer"
            />
            {uploading && (
              <p className="text-xs text-gray-400 mt-1">Caricamento in corso…</p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || uploading}
              className="bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-600 px-4 py-2 border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Annulla
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
