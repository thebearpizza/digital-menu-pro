'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { reorderDishes } from './dishes/actions'

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

type Props = {
  initialDishes: Dish[]
  restaurantId: string
  menuId: string
}

function SortableDish({ dish, restaurantId, menuId }: { dish: Dish; restaurantId: string; menuId: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dish.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 group">
      {/* Handle drag */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-1.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Trascina per riordinare"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>

      {/* Card piatto */}
      <Link
        href={`/admin/restaurants/${restaurantId}/menus/${menuId}/dishes/${dish.id}`}
        className="flex-1 flex items-center gap-3 p-3 rounded-xl hover:bg-stone-50 transition-colors"
      >
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
          {dish.image_url ? (
            <img src={dish.image_url} alt={dish.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800 truncate">{dish.name}</span>
            {!dish.is_available && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-slate-400 flex-shrink-0">
                Non disponibile
              </span>
            )}
          </div>
          {dish.description && (
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">
              {dish.description}
            </p>
          )}
          {dish.allergens?.length > 0 && (
            <div className="flex items-center gap-1 mt-0.5 overflow-hidden">
              {dish.allergens.slice(0, 2).map(a => (
                <span key={a} className="text-xs bg-stone-100 text-slate-500 px-1.5 py-0.5 rounded-md flex-shrink-0">{a}</span>
              ))}
              {dish.allergens.length > 2 && (
                <span className="text-xs bg-stone-100 text-slate-400 px-1.5 py-0.5 rounded-md flex-shrink-0">
                  +{dish.allergens.length - 2}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 self-start mt-3">
          {dish.price != null && dish.price > 0 && (
            <span className="text-sm font-medium text-slate-700">
              €{Number(dish.price).toFixed(2)}
            </span>
          )}
          <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>
    </div>
  )
}

export function DishList({ initialDishes, restaurantId, menuId }: Props) {
  const [dishes, setDishes] = useState(initialDishes)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  // Raggruppa per categoria mantenendo l'ordine
  const grouped = dishes.reduce((acc, dish) => {
    const cat = dish.category?.trim() || 'Senza categoria'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(dish)
    return acc
  }, {} as Record<string, Dish[]>)

  const categories = Object.keys(grouped).sort((a, b) =>
    a === 'Senza categoria' ? 1 : b === 'Senza categoria' ? -1 : a.localeCompare(b)
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = dishes.findIndex(d => d.id === active.id)
    const newIndex = dishes.findIndex(d => d.id === over.id)
    const newDishes = arrayMove(dishes, oldIndex, newIndex)

    setDishes(newDishes)
    setSaving(true)
    await reorderDishes(newDishes.map(d => d.id), menuId)
    setSaving(false)
  }

  return (
    <div>
      {saving && (
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
          <div className="w-3 h-3 border border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          Salvataggio ordine...
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={dishes.map(d => d.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {categories.map(cat => (
              <div key={cat}>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 pl-8">
                  {cat}
                </h3>
                <div className="space-y-1">
                  {grouped[cat].map(dish => (
                    <SortableDish
                      key={dish.id}
                      dish={dish}
                      restaurantId={restaurantId}
                      menuId={menuId}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
