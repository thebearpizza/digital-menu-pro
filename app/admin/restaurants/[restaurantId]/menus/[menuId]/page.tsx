'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getMenu, updateMenu, deleteMenu } from './actions'
import { getDishes } from './dishes/actions'
import { DishList } from './DishList'

type Menu = {
  id: string
  name: string
  description: string | null
  banner_type: 'image' | 'video'
  banner_url: string | null
  is_active: boolean
}

type Dish = {
  id: string
  name: string
  description: string | null
  price: number | null
  image_url: string | null
  is_available: boolean
  allergens: string[]
  category: string | null
}

export default function MenuDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const restaurantId = params.restaurantId as string
  const menuId = params.menuId as string

  const [menu, setMenu] = useState<Menu | null>(null)
  const [dishes, setDishes] = useState<Dish[]>([])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    banner_type: 'image' as 'image' | 'video',
    banner_url: '',
    is_active: true,
  })

  const createdDish = searchParams.get('created_dish')
  const deletedDish = searchParams.get('deleted_dish')

  useEffect(() => {
    getMenu(menuId, restaurantId).then((data) => {
      if (!data) return router.push(`/admin/restaurants/${restaurantId}`)
      setMenu(data)
      setForm({
        name: data.name,
        description: data.description ?? '',
        banner_type: data.banner_type ?? 'image',
        banner_url: data.banner_url ?? '',
        is_active: data.is_active,
      })
    })
    getDishes(menuId).then(setDishes)
  }, [menuId, restaurantId])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const target = e.target as HTMLInputElement
    const value = target.type === 'checkbox' ? target.checked : target.value
    setForm(prev => ({ ...prev, [target.name]: value }))
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Il nome è obbligatorio'); return }
    setLoading(true)
    setError('')
    const result = await updateMenu(menuId, restaurantId, form)
    setLoading(false)
    if (result.error) { setError(result.error) }
    else { setMenu(prev => prev ? { ...prev, name: form.name } : prev); setSaved(true) }
  }

  async function handleDelete() {
    if (!confirm('Eliminare questo menu? Verranno eliminati anche tutti i piatti.')) return
    const result = await deleteMenu(menuId, restaurantId)
    if (result.error) { setError(result.error) }
    else { router.push(`/admin/restaurants/${restaurantId}?deleted_menu=true`) }
  }


  if (!menu) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
      {createdDish && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl px-4 py-3 mb-6">
          Piatto aggiunto con successo.
        </div>
      )}
      {deletedDish && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3 mb-6">
          Piatto <span className="font-medium">&quot;{decodeURIComponent(deletedDish)}&quot;</span> eliminato con successo.
        </div>
      )}

      <div className="flex items-center gap-3 mb-8">
        <Link href={`/admin/restaurants/${restaurantId}`} className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">{menu.name}</h1>
          <p className="text-slate-500 text-sm">Dettaglio menu</p>
        </div>
        <div className="ml-auto">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${form.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-slate-500'}`}>
            {form.is_active ? 'Attivo' : 'Inattivo'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Impostazioni menu</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome <span className="text-red-400">*</span></label>
                <input type="text" name="name" value={form.name} onChange={handleChange}
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrizione</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={2}
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" name="is_active" id="is_active" checked={form.is_active} onChange={handleChange}
                  className="w-4 h-4 rounded border-stone-300 accent-slate-900" />
                <label htmlFor="is_active" className="text-sm text-slate-700">Menu attivo</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo banner</label>
                <select name="banner_type" value={form.banner_type} onChange={handleChange}
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                  <option value="image">Immagine</option>
                  <option value="video">Video</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">URL banner</label>
                <input type="url" name="banner_url" value={form.banner_url} onChange={handleChange}
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="https://..." />
              </div>
              {form.banner_url && (
                <div className="rounded-xl overflow-hidden border border-stone-200 aspect-video bg-stone-50">
                  {form.banner_type === 'video'
                    ? <video src={form.banner_url} className="w-full h-full object-contain" muted autoPlay loop playsInline />
                    : <img src={form.banner_url} alt="Banner" className="w-full h-full object-contain" />
                  }
                </div>
              )}
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}
            {saved && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">Modifiche salvate.</div>}

            <div className="flex items-center justify-between">
              <button type="submit" disabled={loading}
                className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">
                {loading ? 'Salvataggio...' : 'Salva modifiche'}
              </button>
              <button type="button" onClick={handleDelete}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Elimina menu
              </button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Piatti</h2>
                <p className="text-xs text-slate-400 mt-0.5">{dishes.length} {dishes.length === 1 ? 'piatto' : 'piatti'}</p>
              </div>
              <Link
                href={`/admin/restaurants/${restaurantId}/menus/${menuId}/dishes/new`}
                className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                + Aggiungi piatto
              </Link>
            </div>

            {dishes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-sm mb-3">Nessun piatto ancora</p>
                <Link href={`/admin/restaurants/${restaurantId}/menus/${menuId}/dishes/new`}
                  className="text-xs text-slate-500 underline underline-offset-2">
                  Aggiungi il primo piatto
                </Link>
              </div>
            ) : (
              <DishList
                initialDishes={dishes}
                restaurantId={restaurantId}
                menuId={menuId}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
