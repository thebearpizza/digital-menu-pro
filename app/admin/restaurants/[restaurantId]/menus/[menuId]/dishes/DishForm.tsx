'use client'

import { useState, useRef, useEffect } from 'react'
import { MediaUpload } from '@/components/MediaUpload'

const ALLERGENS_LIST = [
  'Glutine', 'Crostacei', 'Uova', 'Pesce', 'Arachidi',
  'Soia', 'Latte', 'Frutta a guscio', 'Sedano', 'Senape',
  'Sesamo', 'Anidride solforosa', 'Lupini', 'Molluschi'
]

export type DishFormData = {
  name: string
  description: string
  price: string
  image_url: string
  allergens: string[]
  is_available: boolean
  category: string
}

type Props = {
  initial?: Partial<DishFormData>
  existingCategories?: string[]
  loading: boolean
  error: string
  saved?: boolean
  onSubmit: (form: DishFormData) => void
  onDelete?: () => void
  submitLabel?: string
}

export function DishForm({ initial, existingCategories = [], loading, error, saved, onSubmit, onDelete, submitLabel = 'Salva' }: Props) {
  const [form, setForm] = useState<DishFormData>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    price: initial?.price ?? '',
    image_url: initial?.image_url ?? '',
    allergens: initial?.allergens ?? [],
    is_available: initial?.is_available ?? true,
    category: initial?.category ?? '',
  })

  const [showSuggestions, setShowSuggestions] = useState(false)
  const categoryRef = useRef<HTMLDivElement>(null)

  const suggestions = existingCategories.filter(c =>
    c.toLowerCase().includes(form.category.toLowerCase()) && c !== form.category
  )

  // Chiudi dropdown cliccando fuori
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const target = e.target as HTMLInputElement
    const value = target.type === 'checkbox' ? target.checked : target.value
    setForm(prev => ({ ...prev, [target.name]: value }))
  }

  function toggleAllergen(a: string) {
    setForm(prev => ({
      ...prev,
      allergens: prev.allergens.includes(a)
        ? prev.allergens.filter(x => x !== a)
        : [...prev.allergens, a]
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Informazioni piatto</h2>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome <span className="text-red-400">*</span></label>
          <input type="text" name="name" value={form.name} onChange={handleChange}
            className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
            placeholder="Es. Margherita, Tiramisù..." />
        </div>

        {/* Categoria con autocomplete */}
        <div ref={categoryRef} className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
          <input
            type="text"
            name="category"
            value={form.category}
            onChange={handleChange}
            onFocus={() => setShowSuggestions(true)}
            autoComplete="off"
            className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
            placeholder="Es. Antipasti, Primi, Pizze, Dessert..."
          />
          <p className="text-xs text-slate-400 mt-1">I piatti con la stessa categoria vengono raggruppati nel menu</p>

          {/* Dropdown suggerimenti */}
          {showSuggestions && existingCategories.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
              {/* Mostra tutte le categorie se campo vuoto, altrimenti filtra */}
              {(form.category === ''
                ? existingCategories
                : suggestions
              ).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onMouseDown={() => {
                    setForm(prev => ({ ...prev, category: cat }))
                    setShowSuggestions(false)
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-stone-50 transition-colors"
                >
                  {cat}
                </button>
              ))}
              {form.category !== '' && suggestions.length === 0 && (
                <div className="px-4 py-2.5 text-xs text-slate-400">
                  <div className="px-4 py-2.5 text-xs text-slate-400">Premi invio per creare &quot;{form.category}&quot;</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrizione</label>
          <textarea name="description" value={form.description} onChange={handleChange} rows={3}
            className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
            placeholder="Ingredienti, preparazione..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Prezzo (€)</label>
          <input type="number" name="price" value={form.price} onChange={handleChange}
            step="0.01" min="0"
            className="w-40 border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
            placeholder="Incluso" />
          <p className="text-xs text-slate-400 mt-1">Lascia vuoto se il piatto è incluso nel menu</p>
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" name="is_available" id="is_available" checked={form.is_available} onChange={handleChange}
            className="w-4 h-4 rounded border-stone-300 accent-slate-900" />
          <label htmlFor="is_available" className="text-sm text-slate-700">Disponibile</label>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <MediaUpload
          value={form.image_url}
          onChange={(url) => setForm(prev => ({ ...prev, image_url: url }))}
          accept="image/*,video/*"
          label="Immagine piatto"
          preview="image"
        />
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Allergeni</h2>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS_LIST.map(a => (
            <button key={a} type="button" onClick={() => toggleAllergen(a)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                form.allergens.includes(a)
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-stone-200 hover:border-slate-400'
              }`}>
              {a}
            </button>
          ))}
        </div>
        {form.allergens.length > 0 && (
          <p className="text-xs text-slate-400">Selezionati: {form.allergens.join(', ')}</p>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}
      {saved && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">Modifiche salvate.</div>}

      <div className="flex items-center justify-between">
        <button type="submit" disabled={loading}
          className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">
          {loading ? 'Salvataggio...' : submitLabel}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete}
            className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Elimina piatto
          </button>
        )}
      </div>
    </form>
  )
}
