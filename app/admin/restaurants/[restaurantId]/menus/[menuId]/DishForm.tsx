'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createDish, updateDish } from './actions'
import { ALLERGENS } from '@/lib/allergens'

interface Dish {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string | null
  image_url: string | null
  allergens: number[]
  pairing_dish_id: string | null
  pairing_label: string | null
  master_dish_id: string | null
}

interface SimpleDish { id: string; name: string; category: string }

interface Props {
  restaurantId: string
  menuId: string
  dish: Dish | null
  allDishes: SimpleDish[]
  onSaved: (dish: Dish, isNew: boolean) => void
  onClose: () => void
}

export default function DishForm({ restaurantId, menuId, dish, allDishes, onSaved, onClose }: Props) {
  const [name, setName]               = useState(dish?.name ?? '')
  const [description, setDescription] = useState(dish?.description ?? '')
  const [price, setPrice]             = useState(dish?.price?.toString() ?? '')
  const [category, setCategory]       = useState(dish?.category ?? '')
  const [imageUrl, setImageUrl]       = useState(dish?.image_url ?? '')
  const [allergens, setAllergens]     = useState<number[]>(dish?.allergens ?? [])
  const [pairingId, setPairingId]     = useState(dish?.pairing_dish_id ?? '')
  const [uploading, setUploading]     = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  async function handleUpload(file: File) {
    setUploading(true)
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${restaurantId}/${Date.now()}.${ext}`
    const { data, error: err } = await supabase.storage
      .from('dish-images').upload(path, file, { upsert: true })
    if (!err && data) {
      const { data: pub } = supabase.storage.from('dish-images').getPublicUrl(data.path)
      setImageUrl(pub.publicUrl)
    } else if (err) {
      setError('Upload fallito: ' + err.message)
    }
    setUploading(false)
  }

  function toggleAllergen(id: number) {
    setAllergens(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id].sort((a, b) => a - b)
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim())     { setError('Il nome è obbligatorio.'); return }
    if (!category.trim()) { setError('La categoria è obbligatoria.'); return }
    setSaving(true); setError(null)

    const payload = {
      name: name.trim(),
      description,
      price,
      category: category.trim(),
      image_url: imageUrl,
      allergens,
      pairing_dish_id: pairingId || null,
    }

    try {
      const saved = dish
        ? await updateDish(restaurantId, menuId, dish.id, payload)
        : await createDish(restaurantId, menuId, payload)
      onSaved(saved as unknown as Dish, !dish)
    } catch (err: any) {
      setError(err.message ?? 'Errore. Riprova.')
      setSaving(false)
    }
  }

  // Exclude current dish from pairing options
  const pairingOptions = allDishes.filter(d => d.id !== dish?.id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 shadow-xl w-full max-w-lg z-10 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            {dish ? 'Modifica piatto' : 'Nuovo piatto'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">
            &times;
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              placeholder="Es. Margherita"
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Category + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoria *</label>
              <input type="text" value={category} onChange={e => setCategory(e.target.value)} required
                placeholder="Es. Pizze"
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prezzo (€)</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                min="0" step="0.50" placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrizione</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={3} placeholder="Ingredienti, note…"
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Photo */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Foto</label>
            {imageUrl && (
              <div className="relative inline-block mb-2">
                <img src={imageUrl} alt="" className="w-20 h-20 object-cover border border-gray-200" />
                <button type="button" onClick={() => setImageUrl('')}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  &times;
                </button>
              </div>
            )}
            <input type="file" accept="image/*"
              onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
              className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-300 file:text-xs file:bg-white file:text-gray-700 hover:file:bg-gray-50 cursor-pointer"
            />
            {uploading && <p className="text-xs text-gray-400 mt-1">Caricamento…</p>}
          </div>

          {/* Allergens */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Allergeni</label>
            <div className="grid grid-cols-2 gap-1">
              {ALLERGENS.map(a => (
                <label key={a.id} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                  <input
                    type="checkbox"
                    checked={allergens.includes(a.id)}
                    onChange={() => toggleAllergen(a.id)}
                    className="accent-blue-600"
                  />
                  <span className="text-gray-600">
                    <span className="font-mono text-gray-400 mr-1">{a.id}.</span>
                    {a.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Pairing */}
          {pairingOptions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Abbinamento consigliato
              </label>
              <select
                value={pairingId}
                onChange={e => setPairingId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500 bg-white"
              >
                <option value="">— Nessuno —</option>
                {pairingOptions.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.category})</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving || uploading}
              className="bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
            <button type="button" onClick={onClose}
              className="text-sm text-gray-600 px-4 py-2 border border-gray-300 hover:bg-gray-50 transition-colors">
              Annulla
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
