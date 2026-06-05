'use client'

import { useState, useCallback } from 'react'
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DishForm from './DishForm'
import DishSyncModal from './DishSyncModal'
import { deleteDish, reorderCategories } from './actions'
import { allergenName } from '@/lib/allergens'

interface Dish {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string | null
  image_url: string | null
  allergens: number[]
  sort_order: number
  is_active: boolean
  pairing_dish_id: string | null
  pairing_label: string | null
  master_dish_id: string | null
}

interface SimpleDish { id: string; name: string; category: string }
interface SimpleMenu  { id: string; name: string }

interface Props {
  restaurantId: string
  menuId: string
  initialDishes: Dish[]
  allDishes: SimpleDish[]
  allMenus: SimpleMenu[]
  initialCategoryOrder: string[] | null
}

// ── Sortable category row ──────────────────────────────────────────────────────

function SortableCategory({
  cat,
  dishes,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  deletingId,
}: {
  cat: string
  dishes: Dish[]
  expanded: boolean
  onToggle: () => void
  onEdit: (dish: Dish) => void
  onDelete: (dish: Dish) => void
  deletingId: string | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cat })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="bg-white border border-gray-200">
      {/* Category header */}
      <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        {/* Drag handle */}
        <button
          {...attributes} {...listeners}
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none select-none text-base leading-none min-h-[44px] min-w-[36px] flex items-center justify-center"
          aria-label="Trascina per riordinare"
          title="Trascina per riordinare"
        >
          ⠿
        </button>

        {/* Toggle expand */}
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 text-left min-w-0 min-h-[44px]"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 truncate">{cat}</span>
          <span className="text-xs text-gray-400 shrink-0">({dishes.length})</span>
          <span className="ml-auto shrink-0 text-gray-400 text-[10px]">
            {expanded ? '▲' : '▼'}
          </span>
        </button>
      </div>

      {/* Dish rows — visible only when expanded.
          Mobile: layout a card impilato (flex-col). md+: riga con prezzo
          e azioni allineati a destra. */}
      {expanded && (
        <ul className="divide-y divide-gray-50">
          {dishes.map(dish => (
            <li
              key={dish.id}
              className={`px-4 py-3 hover:bg-gray-50 flex flex-col md:flex-row md:items-start md:gap-4 ${!dish.is_active ? 'opacity-50' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{dish.name}</div>
                {dish.description && (
                  <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{dish.description}</div>
                )}
                {dish.allergens?.length > 0 && (
                  <div className="text-[10px] text-orange-500 mt-0.5">
                    {dish.allergens.map(a => `${a}. ${allergenName(a)}`).join(' · ')}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 mt-2 md:mt-0 md:justify-end shrink-0">
                <span className="text-sm text-gray-600 whitespace-nowrap md:order-1 md:min-w-[64px] md:text-right">
                  {dish.price != null ? `€ ${Number(dish.price).toFixed(2)}` : '—'}
                </span>
                <span className="flex items-center gap-1 md:order-2">
                  <button
                    onClick={() => onEdit(dish)}
                    className="text-xs text-blue-600 hover:underline px-2 min-h-[44px] md:min-h-0"
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => onDelete(dish)}
                    disabled={deletingId === dish.id}
                    className="text-xs text-red-500 hover:underline disabled:opacity-40 px-2 min-h-[44px] md:min-h-0"
                  >
                    Elimina
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DishList({
  restaurantId, menuId, initialDishes, allDishes, allMenus, initialCategoryOrder,
}: Props) {
  const [dishes,      setDishes]      = useState(initialDishes)
  const [formOpen,    setFormOpen]    = useState(false)
  const [editingDish, setEditingDish] = useState<Dish | null>(null)
  const [syncDish,    setSyncDish]    = useState<Dish | null>(null)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)

  // Categorie nell'ordine corretto: prima rispetta category_order salvato,
  // poi append di eventuali categorie nuove non ancora nell'elenco.
  const derivedCategories = Array.from(new Set(dishes.map(d => d.category ?? 'Senza categoria')))
  const [categories, setCategories] = useState<string[]>(() => {
    if (!initialCategoryOrder) return derivedCategories.sort()
    const saved = initialCategoryOrder.filter(c => derivedCategories.includes(c))
    const extra = derivedCategories.filter(c => !saved.includes(c)).sort()
    return [...saved, ...extra]
  })

  // Accordion: Set delle categorie espanse — tutte chiuse di default
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const byCategory = Object.fromEntries(
    categories.map(cat => [cat, dishes.filter(d => (d.category ?? 'Senza categoria') === cat)])
  )

  // TouchSensor con delay: su mobile un tocco breve scrolla la pagina,
  // tenere premuto 200ms avvia il drag della categoria (niente conflitto).
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  // Mantieni l'elenco categorie in sync quando arrivano nuovi piatti
  function syncCategories(newDishes: Dish[]) {
    const newCats = Array.from(new Set(newDishes.map(d => d.category ?? 'Senza categoria')))
    setCategories(prev => {
      const kept  = prev.filter(c => newCats.includes(c))
      const added = newCats.filter(c => !prev.includes(c)).sort()
      return [...kept, ...added]
    })
  }

  // ── DnD ───────────────────────────────────────────────────────────────────

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = categories.indexOf(active.id as string)
    const newIdx = categories.indexOf(over.id as string)
    const reordered = arrayMove(categories, oldIdx, newIdx)
    setCategories(reordered)                                  // ottimistico
    await reorderCategories(restaurantId, menuId, reordered)  // persiste
  }

  // ── Accordion ─────────────────────────────────────────────────────────────

  const toggleCategory = useCallback((cat: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }, [])

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function handleDelete(dish: Dish) {
    if (!confirm(`Eliminare "${dish.name}"?`)) return
    setDeletingId(dish.id)
    try {
      await deleteDish(restaurantId, menuId, dish.id)
      const next = dishes.filter(d => d.id !== dish.id)
      setDishes(next)
      syncCategories(next)
    } catch { alert("Errore durante l'eliminazione.") }
    finally { setDeletingId(null) }
  }

  function handleSaved(saved: any, isNew: boolean) {
    const next = isNew
      ? [...dishes, saved]
      : dishes.map(d => d.id === saved.id ? saved : d)
    setDishes(next)
    syncCategories(next)
    setFormOpen(false)
    setEditingDish(null)
    if (!isNew && saved.master_dish_id) setSyncDish(saved)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="mb-5">
        <button
          onClick={() => { setEditingDish(null); setFormOpen(true) }}
          className="bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 transition-colors"
        >
          + Aggiungi piatto
        </button>
      </div>

      {(formOpen || editingDish) && (
        <DishForm
          restaurantId={restaurantId}
          menuId={menuId}
          dish={editingDish}
          allDishes={allDishes}
          allMenus={allMenus}
          onSaved={handleSaved}
          onClose={() => { setFormOpen(false); setEditingDish(null) }}
        />
      )}

      {syncDish && (
        <DishSyncModal
          restaurantId={restaurantId}
          dish={syncDish}
          onClose={() => setSyncDish(null)}
        />
      )}

      {dishes.length === 0 ? (
        <div className="bg-white border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-500">Nessun piatto. Clicca &ldquo;Aggiungi piatto&rdquo; per iniziare.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categories} strategy={verticalListSortingStrategy}>
            <div className="space-y-5">
              {categories.map(cat => (
                <SortableCategory
                  key={cat}
                  cat={cat}
                  dishes={byCategory[cat] ?? []}
                  expanded={expanded.has(cat)}
                  onToggle={() => toggleCategory(cat)}
                  onEdit={dish => { setEditingDish(dish); setFormOpen(false) }}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
