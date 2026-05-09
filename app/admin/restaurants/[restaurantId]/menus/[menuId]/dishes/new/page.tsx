'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createDish, getDishes } from '../actions'
import { DishForm, DishFormData } from '../DishForm'

export default function NewDishPage() {
  const router = useRouter()
  const params = useParams()
  const restaurantId = params.restaurantId as string
  const menuId = params.menuId as string

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [existingCategories, setExistingCategories] = useState<string[]>([])

  useEffect(() => {
    getDishes(menuId).then(dishes => {
      const cats = dishes.map(d => d.category).filter(Boolean).filter((c, i, arr) => arr.indexOf(c) === i) as string[]
      setExistingCategories(cats)
    })
  }, [menuId])

  async function handleSubmit(form: DishFormData) {
    if (!form.name.trim()) { setError('Il nome è obbligatorio'); return }
    setLoading(true)
    setError('')
    const result = await createDish(menuId, restaurantId, form)
    setLoading(false)
    if (result.error) { setError(result.error) }
    else { router.push(`/admin/restaurants/${restaurantId}/menus/${menuId}?created_dish=true`) }
  }

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
          <h1 className="text-2xl font-semibold text-slate-800">Nuovo piatto</h1>
          <p className="text-slate-500 text-sm mt-0.5">Aggiungi un piatto al menu</p>
        </div>
      </div>
      <div className="max-w-2xl">
        <DishForm
          loading={loading}
          error={error}
          existingCategories={existingCategories}
          onSubmit={handleSubmit}
          submitLabel="Crea piatto"
        />
      </div>
    </div>
  )
}
