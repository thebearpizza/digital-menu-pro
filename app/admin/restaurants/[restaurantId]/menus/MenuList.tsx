'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createMenu, deleteMenu, duplicateMenu, reorderMenus, updateMenuName, toggleMenuActive } from './actions'

interface Menu {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

interface Props {
  restaurantId: string
  initialMenus: Menu[]
}

function SortableMenu({
  menu,
  restaurantId,
  onRename,
  onDelete,
  onDuplicate,
  onToggleActive,
}: {
  menu: Menu
  restaurantId: string
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onToggleActive: (id: string, active: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: menu.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [editing,   setEditing]   = useState(false)
  const [nameVal,   setNameVal]   = useState(menu.name)
  const [kebabOpen, setKebabOpen] = useState(false)
  const kebabRef = useRef<HTMLDivElement>(null)

  // Chiude il dropdown al click fuori
  useEffect(() => {
    if (!kebabOpen) return
    function onOut(e: MouseEvent) {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setKebabOpen(false)
      }
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [kebabOpen])

  async function submitRename() {
    if (!nameVal.trim()) return
    await onRename(menu.id, nameVal.trim())
    setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-3 bg-white border-b border-gray-100 last:border-0"
    >
      {/* Drag handle */}
      <button
        {...attributes} {...listeners}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none text-base min-h-[44px] min-w-[28px] flex items-center justify-center"
        aria-label="Sposta"
      >
        ⠿
      </button>

      {editing ? (
        /* ── Modalità rinomina — occupa tutta la riga ── */
        <form
          onSubmit={e => { e.preventDefault(); submitRename() }}
          className="flex-1 flex gap-2"
        >
          <input
            autoFocus
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            className="flex-1 px-2 py-1 border border-blue-400 text-sm focus:outline-none"
          />
          <button type="submit" className="text-xs text-blue-600 font-medium hover:underline">
            Salva
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setNameVal(menu.name) }}
            className="text-xs text-gray-400 hover:underline"
          >
            Annulla
          </button>
        </form>
      ) : (
        <>
          {/* Nome menu — flex-1 assorbe lo spazio, truncate previene overflow */}
          <Link
            href={`/admin/restaurants/${restaurantId}/menus/${menu.id}`}
            className="flex-1 min-w-0 text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline truncate"
          >
            {menu.name}
          </Link>

          {/* Azioni inline — visibili solo su md+ */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <button
              onClick={() => onToggleActive(menu.id, !menu.is_active)}
              className={`text-xs hover:underline ${menu.is_active ? 'text-orange-500' : 'text-green-600'}`}
            >
              {menu.is_active ? 'Disabilita' : 'Abilita'}
            </button>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-500 hover:text-gray-800 hover:underline"
            >
              Rinomina
            </button>
            <button
              onClick={() => onDuplicate(menu.id)}
              className="text-xs text-gray-500 hover:text-gray-800 hover:underline"
            >
              Duplica
            </button>
            <button
              onClick={() => onDelete(menu.id)}
              className="text-xs text-red-500 hover:underline"
            >
              Elimina
            </button>
          </div>

          {/* Kebab menu — visibile solo su mobile, z-50 + shadow-lg per sovrapposi agli elementi sottostanti */}
          <div className="md:hidden relative shrink-0" ref={kebabRef}>
            <button
              onClick={() => setKebabOpen(o => !o)}
              className="flex items-center justify-center w-[44px] h-[44px] text-gray-500 hover:text-gray-800 text-lg leading-none"
              aria-label="Azioni menu"
            >
              ⋮
            </button>
            {kebabOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 shadow-lg min-w-[160px] py-1">
                <button
                  onClick={() => { onToggleActive(menu.id, !menu.is_active); setKebabOpen(false) }}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 ${menu.is_active ? 'text-orange-500' : 'text-green-600'}`}
                >
                  {menu.is_active ? 'Disabilita' : 'Abilita'}
                </button>
                <button
                  onClick={() => { setEditing(true); setKebabOpen(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Rinomina
                </button>
                <button
                  onClick={() => { onDuplicate(menu.id); setKebabOpen(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Duplica
                </button>
                <button
                  onClick={() => { onDelete(menu.id); setKebabOpen(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50"
                >
                  Elimina
                </button>
              </div>
            )}
          </div>

          {/* CTA primario — sempre visibile, mai sacrificato */}
          <Link
            href={`/admin/restaurants/${restaurantId}/menus/${menu.id}`}
            className="shrink-0 text-xs bg-blue-600 text-white px-3 py-1.5 hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            Piatti →
          </Link>
        </>
      )}
    </div>
  )
}

export default function MenuList({ restaurantId, initialMenus }: Props) {
  const [menus,    setMenus]    = useState(initialMenus)
  const [newName,  setNewName]  = useState('')
  const [creating, setCreating] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor))

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const created = await createMenu(restaurantId, newName.trim())
      setMenus(prev => [...prev, created as Menu])
      setNewName('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleRename(id: string, name: string) {
    await updateMenuName(restaurantId, id, name)
    setMenus(prev => prev.map(m => m.id === id ? { ...m, name } : m))
  }

  async function handleDelete(id: string) {
    const menu = menus.find(m => m.id === id)
    if (!confirm(`Eliminare il menu "${menu?.name}"?\nTutti i piatti associati verranno eliminati.`)) return
    await deleteMenu(restaurantId, id)
    setMenus(prev => prev.filter(m => m.id !== id))
  }

  async function handleDuplicate(id: string) {
    try {
      const copy = await duplicateMenu(restaurantId, id)
      setMenus(prev => {
        const idx = prev.findIndex(m => m.id === id)
        const next = [...prev]
        next.splice(idx + 1, 0, copy as Menu)
        return next
      })
    } catch (err: any) {
      setError(err.message ?? 'Errore durante la duplicazione.')
    }
  }

  async function handleToggleActive(id: string, active: boolean) {
    setMenus(prev => prev.map(m => m.id === id ? { ...m, is_active: active } : m))
    try {
      await toggleMenuActive(restaurantId, id, active)
    } catch { setError('Errore nel cambio stato menu.') }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = menus.findIndex(m => m.id === active.id)
    const newIdx = menus.findIndex(m => m.id === over.id)
    const reordered = arrayMove(menus, oldIdx, newIdx)
    setMenus(reordered)
    await reorderMenus(restaurantId, reordered.map(m => m.id))
  }

  return (
    <div>
      {/* Create form */}
      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nome del nuovo menu (es. Pranzo, Cena, Cocktail…)"
          className="flex-1 px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="shrink-0 bg-blue-600 text-white text-sm font-medium px-4 py-2 min-h-[44px] hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {creating ? '…' : '+ Nuovo menu'}
        </button>
      </form>

      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs">{error}</div>
      )}

      {menus.length === 0 ? (
        <div className="bg-white border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-500">
            Nessun menu. Crea il primo menu dal campo sopra.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 overflow-visible">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Menu ({menus.length}) — trascina per riordinare
            </span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={menus.map(m => m.id)} strategy={verticalListSortingStrategy}>
              {menus.map(menu => (
                <SortableMenu
                  key={menu.id}
                  menu={menu}
                  restaurantId={restaurantId}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  )
}
