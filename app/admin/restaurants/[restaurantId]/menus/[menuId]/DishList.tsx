'use client'

import { useState, useCallback } from 'react'
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, TouchSensor, useSensor, useSensors,
  SensorDescriptor, SensorOptions,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DishForm from './DishForm'
import DishSyncBannerModal from './DishSyncBannerModal'
import MoveDishModal from './MoveDishModal'
import {
  deleteDish, reorderCategories, reorderDishes,
  duplicateDish, duplicateCategory, findDishTwins, DishTwin,
} from './actions'
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

interface SourceDish {
  id: string
  name: string
  description: string | null
  price: number | null
  image_url: string | null
  allergens: number[]
  category: string | null
}

// ── Helper: rilevamento differenze per il banner di sync (MODULO 5) ──────────────

function sameAllergens(a: number[] = [], b: number[] = []) {
  const x = [...a].sort((m, n) => m - n)
  const y = [...b].sort((m, n) => m - n)
  return x.length === y.length && x.every((v, i) => v === y[i])
}

// Solo i campi "contenuto" innescano il banner; la categoria resta opzionale nel modale.
function anyFieldDiffers(s: SourceDish, twins: DishTwin[]): boolean {
  return twins.some(t => {
    const priceDiff =
      !(s.price == null && t.price == null) && Number(s.price ?? NaN) !== Number(t.price ?? NaN)
    return (
      (s.description ?? '') !== (t.description ?? '') ||
      priceDiff ||
      (s.image_url ?? '') !== (t.image_url ?? '') ||
      !sameAllergens(s.allergens, t.allergens)
    )
  })
}

// ── Sortable dish row (MODULO 4: DnD piatti) ─────────────────────────────────────

function SortableDish({
  dish,
  onEdit,
  onDelete,
  onDuplicate,
  onMove,
  deletingId,
}: {
  dish: Dish
  onEdit: (dish: Dish) => void
  onDelete: (dish: Dish) => void
  onDuplicate: (dish: Dish) => void
  onMove: (dish: Dish) => void
  deletingId: string | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: dish.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`px-3 py-3 hover:bg-gray-50 flex flex-col md:flex-row md:items-start md:gap-3 ${!dish.is_active ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <button
          {...attributes} {...listeners}
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none select-none text-base leading-none min-h-[44px] min-w-[28px] flex items-center justify-center"
          aria-label="Trascina per riordinare il piatto"
          title="Trascina per riordinare"
        >
          ⠿
        </button>
        <div className="flex-1 min-w-0 pt-2.5 md:pt-0">
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
      </div>

      <div className="flex items-center justify-between gap-3 mt-2 md:mt-0 md:justify-end shrink-0 flex-wrap pl-7 md:pl-0">
        <span className="text-sm text-gray-600 whitespace-nowrap md:order-1 md:min-w-[64px] md:text-right">
          {dish.price != null ? `€ ${Number(dish.price).toFixed(2)}` : '—'}
        </span>
        <span className="flex items-center gap-0.5 md:order-2 flex-wrap">
          <button
            onClick={() => onEdit(dish)}
            className="text-xs text-blue-600 hover:underline px-2 min-h-[44px] md:min-h-0"
          >
            Modifica
          </button>
          <button
            onClick={() => onDuplicate(dish)}
            className="text-xs text-gray-500 hover:text-gray-800 hover:underline px-2 min-h-[44px] md:min-h-0"
          >
            Duplica
          </button>
          <button
            onClick={() => onMove(dish)}
            className="text-xs text-gray-500 hover:text-gray-800 hover:underline px-2 min-h-[44px] md:min-h-0"
          >
            Sposta
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
  )
}

// ── Sortable category row ──────────────────────────────────────────────────────

function SortableCategory({
  cat,
  dishes,
  expanded,
  sensors,
  onToggle,
  onEdit,
  onDelete,
  onDuplicateDish,
  onMoveDish,
  onReorderDishes,
  onDuplicateCategory,
  onDeleteCategory,
  deletingId,
}: {
  cat: string
  dishes: Dish[]
  expanded: boolean
  sensors: SensorDescriptor<SensorOptions>[]
  onToggle: () => void
  onEdit: (dish: Dish) => void
  onDelete: (dish: Dish) => void
  onDuplicateDish: (dish: Dish) => void
  onMoveDish: (dish: Dish) => void
  onReorderDishes: (cat: string, dishIds: string[]) => void
  onDuplicateCategory: (cat: string) => void
  onDeleteCategory: (cat: string) => void
  deletingId: string | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cat })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  function handleDishDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = dishes.map(d => d.id)
    const oldIdx = ids.indexOf(active.id as string)
    const newIdx = ids.indexOf(over.id as string)
    if (oldIdx < 0 || newIdx < 0) return
    onReorderDishes(cat, arrayMove(ids, oldIdx, newIdx))
  }

  return (
    <div ref={setNodeRef} style={style} className="bg-white border border-gray-200">
      {/* Category header */}
      <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        {/* Drag handle categoria */}
        <button
          {...attributes} {...listeners}
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none select-none text-base leading-none min-h-[44px] min-w-[36px] flex items-center justify-center"
          aria-label="Trascina per riordinare la categoria"
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
        </button>

        {/* Azioni categoria */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onDuplicateCategory(cat)}
            className="text-xs text-gray-500 hover:text-gray-800 hover:underline px-2 min-h-[44px] md:min-h-0"
          >
            Duplica
          </button>
          {dishes.length === 0 && (
            <button
              onClick={() => onDeleteCategory(cat)}
              className="text-xs text-red-500 hover:underline px-2 min-h-[44px] md:min-h-0"
            >
              Elimina
            </button>
          )}
          <button
            onClick={onToggle}
            className="text-gray-400 text-[10px] px-1 min-h-[44px] min-w-[28px] flex items-center justify-center"
            aria-label={expanded ? 'Comprimi' : 'Espandi'}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Dish rows — visibili solo quando espanso, con DnD interno per i piatti. */}
      {expanded && (
        dishes.length === 0 ? (
          <p className="px-4 py-4 text-xs text-gray-400">
            Categoria vuota. Aggiungi un piatto scegliendo questa categoria.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDishDragEnd}>
            <SortableContext items={dishes.map(d => d.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-gray-50">
                {dishes.map(dish => (
                  <SortableDish
                    key={dish.id}
                    dish={dish}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onDuplicate={onDuplicateDish}
                    onMove={onMoveDish}
                    deletingId={deletingId}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )
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
  const [moveDish,    setMoveDish]    = useState<Dish | null>(null)
  const [bannerSync,  setBannerSync]  = useState<{ source: SourceDish; twins: DishTwin[] } | null>(null)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)

  // Aggiunta categoria (MODULO 3)
  const [addingCat, setAddingCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  // Categorie nell'ordine corretto: rispetta category_order salvato (incluse le
  // categorie vuote create a mano), poi append delle categorie nuove dai piatti.
  const derivedCategories = Array.from(new Set(dishes.map(d => d.category ?? 'Senza categoria')))
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = (initialCategoryOrder ?? []).slice()
    const extra = derivedCategories.filter(c => !saved.includes(c)).sort()
    return [...saved, ...extra]
  })

  // Accordion: Set delle categorie espanse — tutte chiuse di default
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const byCategory = Object.fromEntries(
    categories.map(cat => [cat, dishes.filter(d => (d.category ?? 'Senza categoria') === cat)])
  )

  // TouchSensor con delay: su mobile un tocco breve scrolla la pagina,
  // tenere premuto 200ms avvia il drag (niente conflitto con lo scroll).
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  // Sincronizza l'elenco categorie quando arrivano nuovi piatti: solo aggiunte,
  // mai rimozioni (così le categorie svuotate restano finché non le elimini).
  function syncCategories(newDishes: Dish[]) {
    const newCats = Array.from(new Set(newDishes.map(d => d.category ?? 'Senza categoria')))
    setCategories(prev => {
      const added = newCats.filter(c => !prev.includes(c))
      return added.length ? [...prev, ...added.sort()] : prev
    })
  }

  // ── DnD categorie ──────────────────────────────────────────────────────────

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = categories.indexOf(active.id as string)
    const newIdx = categories.indexOf(over.id as string)
    const reordered = arrayMove(categories, oldIdx, newIdx)
    setCategories(reordered)                                  // ottimistico
    await reorderCategories(restaurantId, menuId, reordered)  // persiste
  }

  // ── DnD piatti dentro la categoria ─────────────────────────────────────────

  async function handleReorderDishes(cat: string, newIds: string[]) {
    const catDishes = byCategory[cat] ?? []
    const reordered = newIds
      .map(id => catDishes.find(d => d.id === id))
      .filter((d): d is Dish => !!d)
    const newByCat: Record<string, Dish[]> = { ...byCategory, [cat]: reordered }
    const flat = categories.flatMap(c => newByCat[c] ?? [])
    setDishes(flat)                                              // ottimistico
    await reorderDishes(restaurantId, menuId, flat.map(d => d.id))
  }

  // ── Accordion ──────────────────────────────────────────────────────────────

  const toggleCategory = useCallback((cat: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }, [])

  // ── Categorie: aggiunta / duplicazione / eliminazione vuota ─────────────────

  async function handleAddCategory() {
    const n = newCatName.trim()
    if (!n || categories.includes(n)) { setAddingCat(false); setNewCatName(''); return }
    const newCats = [...categories, n]
    setCategories(newCats)
    setExpanded(prev => new Set(prev).add(n))
    setAddingCat(false)
    setNewCatName('')
    await reorderCategories(restaurantId, menuId, newCats)
  }

  async function handleDuplicateCategory(cat: string) {
    try {
      const { category: newCat, dishes: created } = await duplicateCategory(restaurantId, menuId, cat)
      const next = [...dishes, ...(created as Dish[])]
      setDishes(next)
      const newCats = categories.includes(newCat)
        ? categories
        : (() => {
            const idx = categories.indexOf(cat)
            const copy = [...categories]
            copy.splice(idx + 1, 0, newCat)
            return copy
          })()
      setCategories(newCats)
      await reorderCategories(restaurantId, menuId, newCats)
    } catch {
      alert('Errore durante la duplicazione della categoria.')
    }
  }

  async function handleDeleteCategory(cat: string) {
    if ((byCategory[cat]?.length ?? 0) > 0) return
    if (!confirm(`Eliminare la categoria vuota "${cat}"?`)) return
    const newCats = categories.filter(c => c !== cat)
    setCategories(newCats)
    await reorderCategories(restaurantId, menuId, newCats)
  }

  // ── Piatti: CRUD / duplica / sposta ─────────────────────────────────────────

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

  async function handleDuplicateDish(dish: Dish) {
    try {
      const copy = await duplicateDish(restaurantId, menuId, dish.id)
      const next = [...dishes, copy as Dish]
      setDishes(next)
      syncCategories(next)
    } catch { alert('Errore durante la duplicazione.') }
  }

  function handleMoved(dishId: string) {
    const next = dishes.filter(d => d.id !== dishId)
    setDishes(next)
    setMoveDish(null)
  }

  async function handleSaved(saved: any, isNew: boolean) {
    const next = isNew
      ? [...dishes, saved]
      : dishes.map(d => d.id === saved.id ? saved : d)
    setDishes(next)
    syncCategories(next)
    setFormOpen(false)
    setEditingDish(null)

    // MODULO 5 — dopo una modifica, cerca gemelli (stesso nome) in altri menu
    if (!isNew) {
      try {
        const { source, twins } = await findDishTwins(restaurantId, menuId, saved.id)
        if (source && twins.length && anyFieldDiffers(source, twins)) {
          setBannerSync({ source, twins })
        }
      } catch { /* non bloccare il salvataggio per un errore di lookup */ }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setEditingDish(null); setFormOpen(true) }}
          className="bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 transition-colors"
        >
          + Aggiungi piatto
        </button>

        {addingCat ? (
          <form
            onSubmit={e => { e.preventDefault(); handleAddCategory() }}
            className="flex items-center gap-2"
          >
            <input
              autoFocus
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onBlur={() => { if (!newCatName.trim()) { setAddingCat(false) } }}
              placeholder="Nome categoria"
              className="px-3 py-2 border border-blue-400 text-base focus:outline-none w-44"
            />
            <button type="submit"
              className="text-sm text-blue-600 font-medium hover:underline px-2 min-h-[44px]">
              Aggiungi
            </button>
            <button type="button" onClick={() => { setAddingCat(false); setNewCatName('') }}
              className="text-sm text-gray-400 hover:underline px-2 min-h-[44px]">
              Annulla
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddingCat(true)}
            className="border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            + Aggiungi categoria
          </button>
        )}
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

      {moveDish && (
        <MoveDishModal
          restaurantId={restaurantId}
          fromMenuId={menuId}
          dishId={moveDish.id}
          dishName={moveDish.name}
          menus={allMenus}
          onMoved={handleMoved}
          onClose={() => setMoveDish(null)}
        />
      )}

      {bannerSync && (
        <DishSyncBannerModal
          restaurantId={restaurantId}
          source={bannerSync.source}
          twins={bannerSync.twins}
          onClose={() => setBannerSync(null)}
        />
      )}

      {dishes.length === 0 && categories.length === 0 ? (
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
                  sensors={sensors}
                  onToggle={() => toggleCategory(cat)}
                  onEdit={dish => { setEditingDish(dish); setFormOpen(false) }}
                  onDelete={handleDelete}
                  onDuplicateDish={handleDuplicateDish}
                  onMoveDish={setMoveDish}
                  onReorderDishes={handleReorderDishes}
                  onDuplicateCategory={handleDuplicateCategory}
                  onDeleteCategory={handleDeleteCategory}
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
