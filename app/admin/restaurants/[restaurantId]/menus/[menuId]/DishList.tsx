'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  DndContext, closestCorners, DragEndEvent, DragStartEvent, DragOverlay,
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
import DishSyncBannerModal from './DishSyncBannerModal'
import MoveDishModal from './MoveDishModal'
import MoveCategoryModal from './MoveCategoryModal'
import ExcelImportExport from './ExcelImportExport'
import TranslationPanel, { LangBar } from './TranslationPanel'
import type { Lang } from '@/lib/translations'
import VisibilityToggle from '@/components/ui/VisibilityToggle'
import { Spinner } from '@/components/ui/Spinner'
import {
  deleteDish, reorderCategories, reorderDishes,
  duplicateDish, duplicateCategory, deleteCategory, renameCategory, bulkUpdateDishPrices, findDishTwins, DishTwin,
  toggleDishActive, toggleCategoryActive,
  moveDishesToCategory, bulkDeleteDishes, bulkMoveDishesToMenu, getMenuCategoriesForMove,
} from './actions'
import { useStaggerEntrance } from '@/lib/animations'

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

interface SimpleDish { id: string; name: string; category: string; menu_id: string }
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

// ── Helper: rilevamento differenze per il banner di sync ──────────────────────

function sameAllergens(a: number[] = [], b: number[] = []) {
  const x = [...a].sort((m, n) => m - n)
  const y = [...b].sort((m, n) => m - n)
  return x.length === y.length && x.every((v, i) => v === y[i])
}

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

// ── Sortable dish row ─────────────────────────────────────────────────────────

function SortableDish({
  dish,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onMove,
  onToggle,
  deletingId,
}: {
  dish: Dish
  selected: boolean
  onSelect: (dish: Dish, checked: boolean) => void
  onEdit: (dish: Dish) => void
  onDelete: (dish: Dish) => void
  onDuplicate: (dish: Dish) => void
  onMove: (dish: Dish) => void
  onToggle: (dish: Dish) => void
  deletingId: string | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: dish.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [kebabOpen, setKebabOpen] = useState(false)
  const kebabRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!kebabOpen) return
    function onOut(e: MouseEvent) {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) setKebabOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [kebabOpen])

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`px-3 py-2.5 hover:bg-gray-50 flex items-center gap-2 ${!dish.is_active ? 'opacity-40' : ''}`}
    >
      {/* Drag handle */}
      <button
        {...attributes} {...listeners}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none select-none text-base leading-none min-h-[44px] min-w-[28px] flex items-center justify-center"
        aria-label="Trascina per riordinare"
        title="Trascina per riordinare"
      >
        ⠿
      </button>

      <input
        type="checkbox"
        checked={selected}
        onChange={e => onSelect(dish, e.target.checked)}
        onClick={e => e.stopPropagation()}
        className="accent-blue-600 w-4 h-4 shrink-0 cursor-pointer"
        aria-label={`Seleziona ${dish.name}`}
      />

      <div
        className="flex-1 min-w-0 cursor-pointer hover:opacity-70 transition-opacity"
        onClick={() => onEdit(dish)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onEdit(dish)}
        aria-label={`Modifica ${dish.name}`}
      >
        <div className="text-sm font-medium text-gray-900 truncate">{dish.name}</div>
        {dish.description && (
          <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{dish.description}</div>
        )}
        {dish.allergens?.length > 0 && (
          <div className="text-[10px] text-orange-500 mt-0.5">Allergeni: {dish.allergens.join(', ')}</div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className="text-sm text-gray-600 tabular-nums whitespace-nowrap min-w-[52px] text-right">
          {dish.price != null ? `€ ${Number(dish.price).toFixed(2)}` : '—'}
        </span>

        <VisibilityToggle isVisible={dish.is_active} onToggle={() => onToggle(dish)} />

        <div className="relative" ref={kebabRef}>
          <button
            onClick={() => setKebabOpen(o => !o)}
            className="flex items-center justify-center w-[36px] h-[36px] text-gray-400 hover:text-gray-700 text-lg leading-none rounded transition-colors hover:bg-gray-100"
            aria-label="Azioni piatto"
          >
            ⋮
          </button>
          {kebabOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 shadow-lg min-w-[148px] py-1">
              <button
                onClick={() => { onEdit(dish); setKebabOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50"
              >
                Modifica
              </button>
              <button
                onClick={() => { onDuplicate(dish); setKebabOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Duplica
              </button>
              <button
                onClick={() => { onMove(dish); setKebabOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Sposta in
              </button>
              <div className="h-px bg-gray-100 my-1" />
              <button
                onClick={() => { onDelete(dish); setKebabOpen(false) }}
                disabled={deletingId === dish.id}
                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 disabled:opacity-40"
              >
                Elimina
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

// ── Sortable category block ───────────────────────────────────────────────────
// NOTE: no DndContext here — the single top-level DndContext handles both
// category reorder and dish reorder/cross-category moves.

function SortableCategory({
  cat,
  dishes,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onDuplicateDish,
  onMoveDish,
  onToggleDish,
  onDuplicateCategory,
  onDeleteCategory,
  onRenameCategory,
  onAddDish,
  onMoveCategory,
  onToggleCategory,
  deletingId,
  selectedIds,
  onSelectDish,
}: {
  cat: string
  dishes: Dish[]
  expanded: boolean
  onToggle: () => void
  onEdit: (dish: Dish) => void
  onDelete: (dish: Dish) => void
  onDuplicateDish: (dish: Dish) => void
  onMoveDish: (dish: Dish) => void
  onToggleDish: (dish: Dish) => void
  onDuplicateCategory: (cat: string) => void
  onDeleteCategory: (cat: string) => void
  onRenameCategory: (cat: string) => void
  onAddDish: (cat: string) => void
  onMoveCategory: (cat: string) => void
  onToggleCategory: (cat: string, active: boolean) => void
  deletingId: string | null
  selectedIds: Set<string>
  onSelectDish: (dish: Dish, checked: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cat })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [kebabOpen, setKebabOpen] = useState(false)
  const kebabRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!kebabOpen) return
    function onClickOutside(e: MouseEvent) {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setKebabOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [kebabOpen])

  const allActive   = dishes.length > 0 && dishes.every(d => d.is_active)
  const anyActive   = dishes.some(d => d.is_active)
  const toggleActive = allActive || anyActive

  return (
    <div ref={setNodeRef} style={style} className="bg-white border border-gray-200">
      {/* Category header */}
      <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        <button
          {...attributes} {...listeners}
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none select-none text-base leading-none min-h-[44px] min-w-[36px] flex items-center justify-center"
          aria-label="Trascina per riordinare la categoria"
          title="Trascina per riordinare"
        >
          ⠿
        </button>

        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 text-left min-w-0 min-h-[44px]"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 truncate">{cat}</span>
          <span className="text-xs text-gray-400 shrink-0">({dishes.length})</span>
        </button>

        <div className="flex items-center shrink-0" ref={kebabRef}>
          {dishes.length > 0 && (
            <VisibilityToggle
              isVisible={toggleActive}
              onToggle={() => onToggleCategory(cat, !toggleActive)}
            />
          )}
          <div className="relative">
            <button
              onClick={() => setKebabOpen(o => !o)}
              className="flex items-center justify-center w-[44px] h-[44px] text-gray-500 hover:text-gray-800 text-lg leading-none"
              aria-label="Azioni categoria"
            >
              ⋮
            </button>
            {kebabOpen && (
              <div className="absolute right-0 top-full mt-1 z-[100] bg-white border border-gray-200 shadow-lg min-w-[160px] py-1">
                {dishes.length > 0 && (
                  <button
                    onClick={() => { onMoveCategory(cat); setKebabOpen(false) }}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Sposta in
                  </button>
                )}
                <button
                  onClick={() => { onDuplicateCategory(cat); setKebabOpen(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Duplica
                </button>
                <button
                  onClick={() => { onRenameCategory(cat); setKebabOpen(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Rinomina
                </button>
                <button
                  onClick={() => { onDeleteCategory(cat); setKebabOpen(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50"
                >
                  Elimina
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onToggle}
          className="text-gray-400 text-[10px] px-1 min-h-[44px] min-w-[28px] flex items-center justify-center shrink-0"
          aria-label={expanded ? 'Comprimi' : 'Espandi'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Dish rows — inside a SortableContext (no nested DndContext needed) */}
      {expanded && (
        <div>
          {dishes.length === 0 ? (
            <p className="px-4 py-4 text-xs text-gray-400">
              Categoria vuota. Aggiungi un piatto con il pulsante qui sotto.
            </p>
          ) : (
            <SortableContext items={dishes.map(d => d.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-gray-50">
                {dishes.map(dish => (
                  <SortableDish
                    key={dish.id}
                    dish={dish}
                    selected={selectedIds.has(dish.id)}
                    onSelect={onSelectDish}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onDuplicate={onDuplicateDish}
                    onMove={onMoveDish}
                    onToggle={onToggleDish}
                    deletingId={deletingId}
                  />
                ))}
              </ul>
            </SortableContext>
          )}
          <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={() => onAddDish(cat)}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              + Aggiungi piatto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DishList({
  restaurantId, menuId, initialDishes, allDishes, allMenus, initialCategoryOrder,
}: Props) {
  const [dishes,       setDishes]       = useState(initialDishes)
  const [lang,         setLang]         = useState<Lang>('it')
  const [formOpen,     setFormOpen]     = useState(false)
  const [editingDish,  setEditingDish]  = useState<Dish | null>(null)
  const [formCat,      setFormCat]      = useState<string | null>(null)
  const [moveDish,     setMoveDish]     = useState<Dish | null>(null)
  const [moveCatName,  setMoveCatName]  = useState<string | null>(null)
  const [bannerSync,   setBannerSync]   = useState<{ source: SourceDish; twins: DishTwin[] } | null>(null)
  const [deletingId,   setDeletingId]   = useState<string | null>(null)

  const [addingCat,    setAddingCat]    = useState(false)
  const [newCatName,   setNewCatName]   = useState('')

  // Multi-select state
  const [selectedIds,       setSelectedIds]       = useState<Set<string>>(new Set())
  const [bulkPrice,         setBulkPrice]         = useState('')
  const [bulkSaving,        setBulkSaving]        = useState(false)
  const [bulkDeleting,      setBulkDeleting]      = useState(false)
  const [bulkMoveMenuId,    setBulkMoveMenuId]    = useState('')
  const [bulkMoving,        setBulkMoving]        = useState(false)
  const [bulkMoveCatOpen,   setBulkMoveCatOpen]   = useState(false)
  const [bulkMoveCats,      setBulkMoveCats]      = useState<string[]>([])
  const [bulkMoveCat,       setBulkMoveCat]       = useState('')
  const [bulkMoveCatLoading,setBulkMoveCatLoading]= useState(false)

  // Active drag id for DragOverlay preview
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const categoriesRef = useStaggerEntrance<HTMLDivElement>({ duration: 450, staggerMs: 70, translateY: 8 })

  function handleSelectDish(dish: Dish, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      checked ? next.add(dish.id) : next.delete(dish.id)
      return next
    })
  }

  async function handleBulkPrice() {
    const parsed = parseFloat(bulkPrice.replace(',', '.'))
    if (bulkPrice.trim() === '' || isNaN(parsed) || parsed < 0) {
      alert('Inserisci un prezzo valido.'); return
    }
    const ids = Array.from(selectedIds)
    setBulkSaving(true)
    try {
      await bulkUpdateDishPrices(restaurantId, menuId, ids, parsed)
      setDishes(prev => prev.map(d => selectedIds.has(d.id) ? { ...d, price: parsed } : d))
      setSelectedIds(new Set())
      setBulkPrice('')
    } catch { alert('Errore durante il cambio prezzo.') }
    finally { setBulkSaving(false) }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    if (!confirm(`Eliminare ${ids.length} ${ids.length === 1 ? 'piatto' : 'piatti'}? L'operazione non è reversibile.`)) return
    setBulkDeleting(true)
    try {
      await bulkDeleteDishes(restaurantId, menuId, ids)
      const next = dishes.filter(d => !selectedIds.has(d.id))
      setDishes(next)
      syncCategories(next)
      setSelectedIds(new Set())
    } catch { alert("Errore durante l'eliminazione.") }
    finally { setBulkDeleting(false) }
  }

  async function openBulkMoveCatModal() {
    if (!bulkMoveMenuId) return
    setBulkMoveCatLoading(true)
    try {
      const cats = await getMenuCategoriesForMove(restaurantId, bulkMoveMenuId)
      setBulkMoveCats(cats)
      setBulkMoveCat(cats[0] ?? '__none__')
      setBulkMoveCatOpen(true)
    } catch { alert('Errore nel caricamento delle categorie.') }
    finally { setBulkMoveCatLoading(false) }
  }

  async function handleBulkMoveToMenu(cat: string) {
    if (!bulkMoveMenuId) return
    const ids = Array.from(selectedIds)
    setBulkMoving(true)
    try {
      const resolved = cat === '__none__' ? null : cat
      await bulkMoveDishesToMenu(restaurantId, menuId, ids, bulkMoveMenuId, resolved)
      const next = dishes.filter(d => !selectedIds.has(d.id))
      setDishes(next)
      syncCategories(next)
      setSelectedIds(new Set())
      setBulkMoveMenuId('')
      setBulkMoveCatOpen(false)
    } catch { alert('Errore durante lo spostamento nel menu.') }
    finally { setBulkMoving(false) }
  }

  const derivedCategories = Array.from(new Set(dishes.map(d => d.category ?? 'Senza categoria')))
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = (initialCategoryOrder ?? []).slice()
    const extra = derivedCategories.filter(c => !saved.includes(c)).sort()
    return [...saved, ...extra]
  })

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const byCategory = Object.fromEntries(
    categories.map(cat => [cat, dishes.filter(d => (d.category ?? 'Senza categoria') === cat)])
  )

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  function syncCategories(newDishes: Dish[]) {
    const newCats = Array.from(new Set(newDishes.map(d => d.category ?? 'Senza categoria')))
    setCategories(prev => {
      const added = newCats.filter(c => !prev.includes(c))
      return added.length ? [...prev, ...added.sort()] : prev
    })
  }

  // ── Unified DnD handler: categories + same-category dish reorder + cross-category move ──

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id))
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveDragId(null)
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId   = String(over.id)

    // ── Category reorder ────────────────────────────────────────────────────
    if (categories.includes(activeId)) {
      if (!categories.includes(overId)) return
      const oldIdx = categories.indexOf(activeId)
      const newIdx = categories.indexOf(overId)
      const reordered = arrayMove(categories, oldIdx, newIdx)
      const prev = categories
      setCategories(reordered)
      try {
        await reorderCategories(restaurantId, menuId, reordered)
      } catch {
        setCategories(prev)
        alert('Errore nel riordino delle categorie.')
      }
      return
    }

    // ── Dish drag ───────────────────────────────────────────────────────────
    const sourceDish = dishes.find(d => d.id === activeId)
    if (!sourceDish) return
    const sourceCat = sourceDish.category ?? 'Senza categoria'

    // Determine target category
    let targetCat: string
    if (categories.includes(overId)) {
      // Dropped directly on a category header → move to that category
      targetCat = overId
    } else {
      const targetDish = dishes.find(d => d.id === overId)
      if (!targetDish) return
      targetCat = targetDish.category ?? 'Senza categoria'
    }

    if (sourceCat === targetCat) {
      // ── Same-category reorder ─────────────────────────────────────────────
      if (categories.includes(overId)) return  // dropped on own category header = noop
      const catDishes = byCategory[sourceCat] ?? []
      const oldIdx = catDishes.findIndex(d => d.id === activeId)
      const newIdx = catDishes.findIndex(d => d.id === overId)
      if (oldIdx === -1 || newIdx === -1) return
      const reordered = arrayMove(catDishes, oldIdx, newIdx)
      const newByCat  = { ...byCategory, [sourceCat]: reordered }
      const flat = categories.flatMap(c => newByCat[c] ?? [])
      const prev = dishes
      setDishes(flat)
      try {
        await reorderDishes(restaurantId, menuId, flat.map(d => d.id))
      } catch {
        setDishes(prev)
        alert('Errore nel riordino dei piatti.')
      }
    } else {
      // ── Cross-category move ───────────────────────────────────────────────
      // If the dragged dish is one of multiple selected, move all selected dishes.
      const idsToMove = selectedIds.size > 1 && selectedIds.has(activeId)
        ? Array.from(selectedIds)
        : [activeId]
      const idsSet = new Set(idsToMove)

      // Remove moved dishes from all current categories
      const newByCat: Record<string, Dish[]> = {}
      for (const c of categories) {
        newByCat[c] = (byCategory[c] ?? []).filter(d => !idsSet.has(d.id))
      }

      // Find insert position inside target category (after removal)
      const targetWithout = newByCat[targetCat] ?? []
      let insertIdx = targetWithout.length
      if (!categories.includes(overId)) {
        const idx = targetWithout.findIndex(d => d.id === overId)
        if (idx !== -1) insertIdx = idx
      }

      const movingDishes = idsToMove
        .map(id => dishes.find(d => d.id === id))
        .filter((d): d is Dish => !!d)
        .map(d => ({ ...d, category: targetCat }))

      newByCat[targetCat] = [
        ...targetWithout.slice(0, insertIdx),
        ...movingDishes,
        ...targetWithout.slice(insertIdx),
      ]

      const flat = categories.flatMap(c => newByCat[c] ?? [])
      const prev = dishes
      setDishes(flat)
      // Expand the target category so the user can see the moved dish(es).
      setExpanded(e => new Set(e).add(targetCat))
      if (idsToMove.length > 1) setSelectedIds(new Set())

      try {
        await moveDishesToCategory(restaurantId, menuId, idsToMove, targetCat, flat.map(d => d.id))
      } catch {
        setDishes(prev)
        alert('Errore nello spostamento del piatto.')
      }
    }
  }

  // ── Accordion ──────────────────────────────────────────────────────────────

  const toggleCategory = useCallback((cat: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }, [])

  // ── Category CRUD ───────────────────────────────────────────────────────────

  async function handleAddCategory() {
    const n = newCatName.trim()
    if (!n || categories.includes(n)) { setAddingCat(false); setNewCatName(''); return }
    const prev = categories
    const newCats = [...categories, n]
    setCategories(newCats)
    setExpanded(prevExp => new Set(prevExp).add(n))
    setAddingCat(false)
    setNewCatName('')
    try {
      await reorderCategories(restaurantId, menuId, newCats)
    } catch {
      setCategories(prev)
      alert("Errore nell'aggiunta della categoria.")
    }
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
    const count = byCategory[cat]?.length ?? 0
    const msg = count > 0
      ? `Eliminare la categoria "${cat}" e i ${count} piatti che contiene? L'operazione non è reversibile.`
      : `Eliminare la categoria vuota "${cat}"?`
    if (!confirm(msg)) return
    const newCats = categories.filter(c => c !== cat)
    setCategories(newCats)
    if (count > 0) setDishes(prev => prev.filter(d => (d.category ?? 'Senza categoria') !== cat))
    try {
      if (count > 0) await deleteCategory(restaurantId, menuId, cat)
      else await reorderCategories(restaurantId, menuId, newCats)
    } catch { alert("Errore durante l'eliminazione della categoria.") }
  }

  async function handleRenameCategory(cat: string) {
    const input = prompt(`Nuovo nome per la categoria "${cat}":`, cat === 'Senza categoria' ? '' : cat)
    if (input === null) return
    const newName = input.trim()
    if (!newName || newName === cat) return
    if (categories.includes(newName)) { alert(`Esiste già una categoria "${newName}".`); return }
    setCategories(prev => prev.map(c => (c === cat ? newName : c)))
    setDishes(prev => prev.map(d =>
      (d.category ?? 'Senza categoria') === cat ? { ...d, category: newName } : d
    ))
    setExpanded(prev => {
      if (!prev.has(cat)) return prev
      const next = new Set(prev); next.delete(cat); next.add(newName); return next
    })
    try {
      await renameCategory(restaurantId, menuId, cat, newName)
    } catch { alert('Errore durante la rinomina della categoria.') }
  }

  // ── Dish CRUD ───────────────────────────────────────────────────────────────

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

  async function handleToggleDish(dish: Dish) {
    const next = !dish.is_active
    setDishes(prev => prev.map(d => d.id === dish.id ? { ...d, is_active: next } : d))
    try {
      await toggleDishActive(restaurantId, menuId, dish.id, next)
    } catch {
      setDishes(prev => prev.map(d => d.id === dish.id ? { ...d, is_active: dish.is_active } : d))
      alert('Errore nel cambio stato piatto.')
    }
  }

  async function handleToggleCategory(cat: string, active: boolean) {
    const prevState = new Map(dishes.map(d => [d.id, d.is_active]))
    setDishes(prev => prev.map(d =>
      (d.category ?? 'Senza categoria') === cat ? { ...d, is_active: active } : d
    ))
    try {
      await toggleCategoryActive(restaurantId, menuId, cat, active)
    } catch {
      setDishes(prev => prev.map(d => ({ ...d, is_active: prevState.get(d.id) ?? d.is_active })))
      alert('Errore nel cambio stato categoria.')
    }
  }

  function handleMovedCategory(cat: string) {
    const next = dishes.filter(d => (d.category ?? 'Senza categoria') !== cat)
    setDishes(next)
    setCategories(prev => prev.filter(c => c !== cat))
    setMoveCatName(null)
  }

  function handleAddDish(cat: string) {
    setEditingDish(null)
    setFormCat(cat)
    setFormOpen(true)
  }

  async function handleSaved(saved: any, isNew: boolean, dirtyFields: Set<string>) {
    const next = isNew
      ? [...dishes, saved]
      : dishes.map(d => d.id === saved.id ? saved : d)
    setDishes(next)
    syncCategories(next)
    setFormOpen(false)
    setEditingDish(null)
    setFormCat(null)

    const syncFields = ['name', 'description', 'price', 'category', 'image_url', 'allergens', 'pairing_dish_id']
    const hasSyncDirty = !isNew && syncFields.some(f => dirtyFields.has(f))

    if (hasSyncDirty) {
      try {
        const { source, twins } = await findDishTwins(restaurantId, menuId, saved.id)
        if (source && twins.length && anyFieldDiffers(source, twins)) {
          setBannerSync({ source, twins })
        }
      } catch { /* non bloccare il salvataggio per un errore di lookup */ }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (lang !== 'it') {
    return (
      <div>
        <LangBar lang={lang} onChange={setLang} />
        <TranslationPanel restaurantId={restaurantId} menuId={menuId} lang={lang} />
      </div>
    )
  }

  const activeDishName = activeDragId && !categories.includes(activeDragId)
    ? dishes.find(d => d.id === activeDragId)?.name ?? ''
    : null
  const isDraggingMultiple = activeDragId !== null && selectedIds.size > 1 && selectedIds.has(activeDragId)

  return (
    <div>
      <LangBar lang={lang} onChange={setLang} />
      <div className="mb-5 grid grid-cols-2 gap-2 max-w-md">
        <button
          onClick={() => { setEditingDish(null); setFormOpen(true) }}
          className="w-full bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 transition-colors"
        >
          + Aggiungi piatto
        </button>

        {addingCat ? (
          <form
            onSubmit={e => { e.preventDefault(); handleAddCategory() }}
            className="flex items-center gap-1"
          >
            <input
              autoFocus
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onBlur={() => { if (!newCatName.trim()) { setAddingCat(false) } }}
              placeholder="Nome categoria"
              className="flex-1 min-w-0 px-3 py-2 border border-blue-400 text-base focus:outline-none"
            />
            <button type="submit"
              className="text-sm text-blue-600 font-medium hover:underline px-1.5 min-h-[44px]">
              OK
            </button>
            <button type="button" onClick={() => { setAddingCat(false); setNewCatName('') }}
              className="text-sm text-gray-400 hover:underline px-1.5 min-h-[44px]">
              ✕
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddingCat(true)}
            className="w-full border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            + Aggiungi categoria
          </button>
        )}

        <ExcelImportExport
          restaurantId={restaurantId}
          menuId={menuId}
          dishes={dishes}
          onImported={created => {
            const next = [...dishes, ...(created as Dish[])]
            setDishes(next)
            syncCategories(next)
          }}
        />
      </div>

      {(formOpen || editingDish) && (
        <DishForm
          key={editingDish?.id ?? `new-${formCat ?? ''}`}
          restaurantId={restaurantId}
          menuId={menuId}
          dish={editingDish}
          allDishes={allDishes}
          allMenus={allMenus}
          defaultCategory={formCat ?? undefined}
          onSaved={handleSaved}
          onClose={() => { setFormOpen(false); setEditingDish(null); setFormCat(null) }}
        />
      )}

      {moveDish && (
        <MoveDishModal
          restaurantId={restaurantId}
          fromMenuId={menuId}
          dishId={moveDish.id}
          dishName={moveDish.name}
          dishCategory={moveDish.category ?? null}
          menus={allMenus}
          onMoved={handleMoved}
          onClose={() => setMoveDish(null)}
        />
      )}

      {moveCatName && (
        <MoveCategoryModal
          restaurantId={restaurantId}
          fromMenuId={menuId}
          category={moveCatName}
          dishCount={(byCategory[moveCatName] ?? []).length}
          menus={allMenus}
          onMoved={handleMovedCategory}
          onClose={() => setMoveCatName(null)}
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={categories} strategy={verticalListSortingStrategy}>
            <div ref={categoriesRef} className="space-y-5">
              {categories.map(cat => (
                <SortableCategory
                  key={cat}
                  cat={cat}
                  dishes={byCategory[cat] ?? []}
                  expanded={expanded.has(cat)}
                  onToggle={() => toggleCategory(cat)}
                  onEdit={dish => { setEditingDish(dish); setFormCat(null); setFormOpen(false) }}
                  onDelete={handleDelete}
                  onDuplicateDish={handleDuplicateDish}
                  onMoveDish={setMoveDish}
                  onToggleDish={handleToggleDish}
                  onDuplicateCategory={handleDuplicateCategory}
                  onDeleteCategory={handleDeleteCategory}
                  onRenameCategory={handleRenameCategory}
                  onAddDish={handleAddDish}
                  onMoveCategory={setMoveCatName}
                  onToggleCategory={handleToggleCategory}
                  deletingId={deletingId}
                  selectedIds={selectedIds}
                  onSelectDish={handleSelectDish}
                />
              ))}
            </div>
          </SortableContext>

          {/* Drag preview overlay */}
          <DragOverlay dropAnimation={null}>
            {activeDishName !== null && (
              isDraggingMultiple ? (
                <div className="relative" style={{ width: 224 }}>
                  <div className="absolute inset-0 bg-blue-50 border border-blue-200 rounded-sm shadow"
                    style={{ transform: 'rotate(5deg) translate(6px, -3px)' }} />
                  <div className="absolute inset-0 bg-blue-100 border border-blue-300 rounded-sm shadow-md"
                    style={{ transform: 'rotate(2.5deg) translate(3px, -1.5px)' }} />
                  <div className="relative bg-white border-2 border-blue-500 shadow-2xl rounded-sm px-3 py-2.5 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate flex-1">{activeDishName}</span>
                    <span className="shrink-0 bg-blue-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      ×{selectedIds.size}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-blue-400 shadow-xl px-3 py-2 text-sm font-medium text-gray-900 rounded-sm opacity-95">
                  {activeDishName}
                </div>
              )
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Floating multi-select action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] bg-gray-900 text-white shadow-2xl rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap max-w-[calc(100vw-2rem)]">
          <span className="text-sm font-medium whitespace-nowrap">
            {selectedIds.size} {selectedIds.size === 1 ? 'piatto selezionato' : 'piatti selezionati'}
          </span>

          {/* Bulk price change */}
          <form
            onSubmit={e => { e.preventDefault(); handleBulkPrice() }}
            className="flex items-center gap-2"
          >
            <span className="text-sm text-gray-300">€</span>
            <input
              type="text"
              inputMode="decimal"
              value={bulkPrice}
              onChange={e => setBulkPrice(e.target.value)}
              placeholder="Nuovo prezzo"
              className="w-28 px-2 py-1.5 text-sm text-gray-900 rounded border-0 focus:outline-none"
            />
            <button type="submit" disabled={bulkSaving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium px-3 py-1.5 rounded transition-colors whitespace-nowrap min-w-[110px] flex items-center justify-center">
              {bulkSaving ? <Spinner color="#fff" size={4} /> : 'Applica prezzo'}
            </button>
          </form>

          {/* Bulk delete */}
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-sm font-medium px-3 py-1.5 rounded transition-colors whitespace-nowrap flex items-center gap-1"
          >
            {bulkDeleting ? <Spinner color="#fff" size={4} /> : 'Elimina'}
          </button>

          {/* Bulk move to another menu */}
          {allMenus.filter(m => m.id !== menuId).length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={bulkMoveMenuId}
                onChange={e => setBulkMoveMenuId(e.target.value)}
                className="text-sm text-gray-900 bg-white rounded px-2 py-1.5 border-0 focus:outline-none"
              >
                <option value="">Sposta in menu…</option>
                {allMenus.filter(m => m.id !== menuId).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {bulkMoveMenuId && (
                <button
                  type="button"
                  onClick={openBulkMoveCatModal}
                  disabled={bulkMoving || bulkMoveCatLoading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-sm font-medium px-3 py-1.5 rounded transition-colors whitespace-nowrap flex items-center gap-1"
                >
                  {bulkMoveCatLoading ? <Spinner color="#fff" size={4} /> : 'Sposta'}
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => { setSelectedIds(new Set()); setBulkPrice(''); setBulkMoveMenuId('') }}
            className="text-sm text-gray-400 hover:text-white whitespace-nowrap">
            Annulla
          </button>
        </div>
      )}

      {/* ── Bulk move category modal ─────────────────────────────────────── */}
      {bulkMoveCatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBulkMoveCatOpen(false)} />
          <div className="relative bg-white border border-gray-200 shadow-xl w-full max-w-sm z-10 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-gray-900">Sposta piatti — scegli categoria</h2>
              <button onClick={() => setBulkMoveCatOpen(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              In quale categoria inserire i {selectedIds.size} piatti selezionati?
            </p>
            <div className="space-y-2 mb-5 max-h-60 overflow-y-auto">
              {bulkMoveCats.map(cat => (
                <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="bulk-target-cat" value={cat}
                    checked={bulkMoveCat === cat} onChange={() => setBulkMoveCat(cat)}
                    className="accent-blue-600" />
                  {cat}
                </label>
              ))}
              <label className={`flex items-center gap-2 text-sm cursor-pointer ${bulkMoveCats.length > 0 ? 'border-t border-gray-100 pt-2 mt-1' : ''}`}>
                <input type="radio" name="bulk-target-cat" value="__none__"
                  checked={bulkMoveCat === '__none__'} onChange={() => setBulkMoveCat('__none__')}
                  className="accent-blue-600" />
                <span className="text-gray-500">Senza categoria</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleBulkMoveToMenu(bulkMoveCat)} disabled={bulkMoving || !bulkMoveCat}
                className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center">
                {bulkMoving ? <Spinner color="#fff" /> : 'Sposta'}
              </button>
              <button onClick={() => setBulkMoveCatOpen(false)} className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors">
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
