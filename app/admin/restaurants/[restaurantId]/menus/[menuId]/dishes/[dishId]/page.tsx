'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { getDishes, updateDish, deleteDish } from '../actions'
import { DishForm, DishFormData } from '../DishForm'

export default function EditDishPage() {
  const router = useRouter()
  const params = useParams()
  const restaurantId = params.restaurantId as string
  const menuId = params.menuId as string
  const dishId = params.dishId as string

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [dishName, setDishName] = useState('')
  const [initial, setInitial] = useState<Partial<DishFormData> | null>(null)
  const [existingCategories, setExistingCategories] = useState<string[]>([])

  useEffect(() => {
    getDishes(menuId).then((dishes) => {
      const dish = dishes.find(d => d.id === dishId)
      if (!dish) return router.push(`/admin/restaurants/${restaurantId}/menus/${menuId}`)
      setDishName(dish.name)
      setInitial({
        name: dish.name,
        description: dish.description ?? '',
        price: dish.price != null ? String(dish.price) : '',
        image_url: dish.image_url ?? '',
        allergens: dish.allergens ?? [],
        is_available: dish.is_available,
        category: dish.category ?? '',
      })
      const cats = [...new Set(dishes.map(d => d.category).filter(Boolean))] as string[]
      setExistingCategories(cats)
    })
  }, [dishId, menuId])

  async function handleSubmit(form: DishFormData) {
    if (!form.name.trim()) { setError('Il nome è obbligatorio'); return }
    setLoading(true)
    setError('')
    const result = await updateDish(dishId, menuId, restaurantId, form)
    setLoading(false)
    if (result.error) { setError(result.error) }
    else { setDishName(form.name); setSaved(true) }
  }

  async function handleDelete() {
    if (!confirm(`Eliminare il piatto "${dishName}"?`)) return
    const result = await deleteDish(dishId, menuId, restaurantId)
    if (result.error) { setError(result.error) }
    else { router.push(`/admin/restaurants/${restaurantId}/menus/${menuId}?deleted_dish=${encodeURIComponent(dishName)}`) }
  }

  if (!initial) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/admin/restaurants/${restaurantId}/menus/${menuId}`}
          className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">{dishName}</h1>
          <p className="text-slate-500 text-sm mt-0.5">Modifica piatto</p>
        </div>
      </div>
      <div className="max-w-2xl">
        <DishForm
          initial={initial}
          existingCategories={existingCategories}
          loading={loading}
          error={error}
          saved={saved}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          submitLabel="Salva modifiche"
        />
      </div>
    </div>
  )
}
