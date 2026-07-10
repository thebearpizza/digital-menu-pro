'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createDish, updateDish, detectAllergens } from './actions'
import { ALLERGENS } from '@/lib/allergens'
import { Spinner } from '@/components/ui/Spinner'

interface Dish {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string | null
  image_url: string | null
  image_original_url: string | null
  image_crop: CropRect | null
  allergens: number[]
  pairing_dish_id: string | null
  pairing_label: string | null
  master_dish_id: string | null
}

// Rettangolo di ritaglio in coordinate normalizzate 0..1 sull'immagine originale.
interface CropRect { x: number; y: number; w: number; h: number }

interface SimpleDish { id: string; name: string; category: string; menu_id: string }
interface SimpleMenu  { id: string; name: string }

interface Props {
  restaurantId: string
  menuId: string
  dish: Dish | null
  allDishes: SimpleDish[]
  allMenus: SimpleMenu[]
  defaultCategory?: string
  onSaved: (dish: Dish, isNew: boolean, dirtyFields: Set<string>) => void
  onClose: () => void
}

// ── AllergenGrid ─────────────────────────────────────────────────────────────────
// Isolated memo component so toggling a checkbox only re-renders this section,
// not the entire form. Parent reads the current selection via the ref it passes.

const AllergenGrid = React.memo(function AllergenGrid({
  initial,
  onChange,
}: {
  initial: number[]
  onChange: (ids: number[]) => void
}) {
  // Coerce to numbers defensively — Supabase may return JSON scalars.
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set((initial ?? []).map(Number))
  )

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      const sorted = Array.from(next).sort((a, b) => a - b)
      onChange(sorted)
      return next
    })
  }

  return (
    <div className="grid grid-cols-2 gap-1">
      {ALLERGENS.map(a => (
        <label key={a.id} className="flex items-center gap-2 text-xs cursor-pointer py-1 select-none">
          <input
            type="checkbox"
            checked={selected.has(a.id)}
            onChange={() => toggle(a.id)}
            className="accent-blue-600 shrink-0"
          />
          <span className="text-gray-600">
            <span className="font-mono text-gray-400 mr-1">{a.id}.</span>
            {a.name}
          </span>
        </label>
      ))}
    </div>
  )
})

// ── CategoryCombobox ─────────────────────────────────────────────────────────────
// Autocomplete: shows existing categories, filters on type, and offers an
// "Aggiungi nuova categoria" option when typed text has no exact match.

function CategoryCombobox({
  value,
  onChange,
  categories,
}: {
  value: string
  onChange: (v: string) => void
  categories: string[]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)

  useEffect(() => { setQuery(value) }, [value])

  const trimmed  = query.trim()
  const filtered = trimmed
    ? categories.filter(c => c.toLowerCase().includes(trimmed.toLowerCase()))
    : categories
  const exactMatch = categories.some(c => c.toLowerCase() === trimmed.toLowerCase())
  const showAdd    = !!trimmed && !exactMatch

  function select(cat: string) {
    onChange(cat)
    setQuery(cat)
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Es. Pizze"
        autoComplete="off"
        className="w-full px-3 py-2 border border-gray-300 text-base focus:outline-none focus:border-blue-500"
      />
      {open && (filtered.length > 0 || showAdd) && (
        <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-200 shadow-md max-h-48 overflow-y-auto">
          {filtered.map(c => (
            <button
              key={c}
              type="button"
              onPointerDown={() => select(c)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                c.toLowerCase() === trimmed.toLowerCase()
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-800'
              }`}
            >
              {c}
            </button>
          ))}
          {showAdd && (
            <button
              type="button"
              onPointerDown={() => select(trimmed)}
              className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100"
            >
              Aggiungi nuova categoria: <strong>{trimmed}</strong>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Ritaglio foto ─────────────────────────────────────────────────────────────────
// La card prodotto del frontend mostra la foto in 16:9 (aspect-video, object-cover):
// il riquadro di selezione ha lo stesso aspect ratio, quindi ciò che si inquadra
// qui è esattamente ciò che si vedrà nella card. Il ritaglio viene applicato al
// file (image_url = versione ritagliata), l'originale resta in image_original_url
// per poter riposizionare il riquadro in seguito.

const CROP_ASPECT = 16 / 9

/** Riquadro 16:9 massimo centrato nell'immagine (coordinate normalizzate). */
function defaultCropRect(imgAspect: number): CropRect {
  if (imgAspect >= CROP_ASPECT) {
    const w = CROP_ASPECT / imgAspect
    return { x: (1 - w) / 2, y: 0, w, h: 1 }
  }
  const h = imgAspect / CROP_ASPECT
  return { x: 0, y: (1 - h) / 2, w: 1, h }
}

/** Ritaglia l'immagine su canvas e restituisce un JPEG (max 1600px di larghezza). */
async function cropImageToBlob(src: string, rect: CropRect): Promise<Blob> {
  const img = new window.Image()
  img.crossOrigin = 'anonymous'
  // Cache-buster sugli URL remoti: se l'immagine è già in cache senza header
  // CORS (perché mostrata come <img> normale), la richiesta crossOrigin
  // riuserebbe quella risposta e il canvas risulterebbe "tainted".
  const loadSrc = src.startsWith('http')
    ? src + (src.includes('?') ? '&' : '?') + 'cb=' + Date.now()
    : src
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Immagine non caricabile'))
    img.src = loadSrc
  })
  const sx = Math.round(rect.x * img.naturalWidth)
  const sy = Math.round(rect.y * img.naturalHeight)
  const sw = Math.max(1, Math.round(rect.w * img.naturalWidth))
  const sh = Math.max(1, Math.round(rect.h * img.naturalHeight))
  const scale  = Math.min(1, 1600 / sw)
  const canvas = document.createElement('canvas')
  canvas.width  = Math.max(1, Math.round(sw * scale))
  canvas.height = Math.max(1, Math.round(sh * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas non disponibile')
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.9))
  if (!blob) throw new Error('Ritaglio fallito')
  return blob
}

function CropModal({
  src,
  initial,
  busy,
  onConfirm,
  onCancel,
}: {
  src: string
  initial: CropRect | null
  busy: boolean
  onConfirm: (rect: CropRect) => void
  onCancel: () => void
}) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [rect, setRect] = useState<CropRect | null>(initial)
  const [loadError, setLoadError] = useState(false)
  const imgRef  = useRef<HTMLImageElement>(null)
  // Stato del gesto in corso (drag o resize da un angolo).
  const gestureRef = useRef<{
    mode: 'move' | 'resize'
    sx: number; sy: number   // segni dell'angolo trascinato (resize)
    startX: number; startY: number
    startRect: CropRect
  } | null>(null)

  function measure() {
    const el = imgRef.current
    if (!el || !el.naturalWidth) return
    setDims({ w: el.clientWidth, h: el.clientHeight })
    setRect(prev => prev ?? initial ?? defaultCropRect(el.naturalWidth / el.naturalHeight))
  }

  useEffect(() => {
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startGesture(e: React.PointerEvent, mode: 'move' | 'resize', sx = 0, sy = 0) {
    if (!rect || busy) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    gestureRef.current = { mode, sx, sy, startX: e.clientX, startY: e.clientY, startRect: rect }
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gestureRef.current
    if (!g || !dims || !rect) return
    e.preventDefault()
    const W = dims.w, H = dims.h
    const s = g.startRect
    if (g.mode === 'move') {
      const dx = (e.clientX - g.startX) / W
      const dy = (e.clientY - g.startY) / H
      setRect({
        ...s,
        x: Math.min(Math.max(s.x + dx, 0), 1 - s.w),
        y: Math.min(Math.max(s.y + dy, 0), 1 - s.h),
      })
      return
    }
    // Resize: l'angolo opposto resta fermo, il riquadro mantiene il 16:9.
    // Lavoriamo in pixel visualizzati (l'aspect è preservato dalla scala uniforme).
    const A = CROP_ASPECT
    const ax = (g.sx > 0 ? s.x : s.x + s.w) * W
    const ay = (g.sy > 0 ? s.y : s.y + s.h) * H
    const px = e.clientX - (imgRef.current?.getBoundingClientRect().left ?? 0)
    const py = e.clientY - (imgRef.current?.getBoundingClientRect().top ?? 0)
    const wCand = g.sx > 0 ? px - ax : ax - px
    const hCand = g.sy > 0 ? py - ay : ay - py
    let w = Math.min(Math.max(wCand, 0), Math.max(hCand, 0) * A)
    const maxW = g.sx > 0 ? W - ax : ax
    const maxH = g.sy > 0 ? H - ay : ay
    w = Math.min(w, maxW, maxH * A)
    w = Math.max(w, 48) // dimensione minima
    w = Math.min(w, maxW, maxH * A) // ri-clamp dopo il minimo
    const h = w / A
    const nx = g.sx > 0 ? ax : ax - w
    const ny = g.sy > 0 ? ay : ay - h
    setRect({ x: nx / W, y: ny / H, w: w / W, h: h / H })
  }

  function endGesture() { gestureRef.current = null }

  const disp = dims && rect
    ? { x: rect.x * dims.w, y: rect.y * dims.h, w: rect.w * dims.w, h: rect.h * dims.h }
    : null

  const corners: Array<{ sx: number; sy: number; style: React.CSSProperties; cursor: string }> = disp ? [
    { sx: -1, sy: -1, style: { left: disp.x - 7,          top: disp.y - 7 },           cursor: 'nwse-resize' },
    { sx:  1, sy: -1, style: { left: disp.x + disp.w - 7, top: disp.y - 7 },           cursor: 'nesw-resize' },
    { sx: -1, sy:  1, style: { left: disp.x - 7,          top: disp.y + disp.h - 7 },  cursor: 'nesw-resize' },
    { sx:  1, sy:  1, style: { left: disp.x + disp.w - 7, top: disp.y + disp.h - 7 },  cursor: 'nwse-resize' },
  ] : []

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={busy ? undefined : onCancel} />
      <div className="relative bg-white border border-gray-200 shadow-xl w-full max-w-2xl z-10 max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Inquadra la foto</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Il riquadro è esattamente ciò che si vedrà nella card del prodotto.
            Trascinalo per spostarlo, usa gli angoli per ridimensionarlo.
          </p>
        </div>

        <div className="p-5 flex justify-center bg-gray-900/95">
          {loadError ? (
            <p className="text-xs text-red-300 py-10">
              Impossibile caricare l&apos;immagine. Riprova a caricarla di nuovo.
            </p>
          ) : (
            <div
              className="relative inline-block select-none"
              style={{ touchAction: 'none' }}
              onPointerMove={onPointerMove}
              onPointerUp={endGesture}
              onPointerCancel={endGesture}
            >
              <img
                ref={imgRef}
                src={src}
                alt=""
                draggable={false}
                onLoad={measure}
                onError={() => setLoadError(true)}
                className="block max-w-full"
                style={{ maxHeight: '58vh' }}
              />
              {disp && (
                <>
                  {/* Zone oscurate fuori dal riquadro */}
                  <div className="absolute bg-black/55 pointer-events-none" style={{ left: 0, top: 0, right: 0, height: disp.y }} />
                  <div className="absolute bg-black/55 pointer-events-none" style={{ left: 0, top: disp.y + disp.h, right: 0, bottom: 0 }} />
                  <div className="absolute bg-black/55 pointer-events-none" style={{ left: 0, top: disp.y, width: disp.x, height: disp.h }} />
                  <div className="absolute bg-black/55 pointer-events-none" style={{ left: disp.x + disp.w, top: disp.y, right: 0, height: disp.h }} />
                  {/* Riquadro trascinabile */}
                  <div
                    className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] cursor-move"
                    style={{ left: disp.x, top: disp.y, width: disp.w, height: disp.h }}
                    onPointerDown={e => startGesture(e, 'move')}
                  />
                  {corners.map(c => (
                    <div
                      key={`${c.sx}${c.sy}`}
                      className="absolute w-3.5 h-3.5 bg-white border border-gray-400 rounded-sm"
                      style={{ ...c.style, cursor: c.cursor }}
                      onPointerDown={e => startGesture(e, 'resize', c.sx, c.sy)}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-gray-200">
          <button
            type="button"
            disabled={busy || !rect || loadError}
            onClick={() => rect && onConfirm(rect)}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors min-w-[90px] flex items-center justify-center"
          >
            {busy ? <Spinner color="#fff" /> : 'Conferma'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="text-sm text-gray-600 px-4 py-2 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────────

export default function DishForm({
  restaurantId, menuId, dish, allDishes, allMenus, defaultCategory, onSaved, onClose,
}: Props) {
  const [name, setName]               = useState(dish?.name ?? '')
  const [description, setDescription] = useState(dish?.description ?? '')
  const [price, setPrice]             = useState(dish?.price?.toString() ?? '')
  const [category, setCategory]       = useState(dish?.category ?? defaultCategory ?? '')
  const [imageUrl, setImageUrl]       = useState(dish?.image_url ?? '')
  // Ritaglio foto: originale intero + rettangolo scelto. imageUrl è sempre la
  // versione ritagliata (ciò che la card mostra) — il frontend non cambia.
  const [origUrl, setOrigUrl]         = useState(dish?.image_original_url ?? '')
  const [imageCrop, setImageCrop]     = useState<CropRect | null>(dish?.image_crop ?? null)
  const [cropState, setCropState]     = useState<{ src: string; initial: CropRect | null } | null>(null)
  const [cropSaving, setCropSaving]   = useState(false)
  // Object URL del file appena caricato (sorgente locale per il ritaglio, niente CORS)
  const localSrcRef = useRef<string | null>(null)
  // ── Abbinamento consigliato: 3 tendine a cascata (menu → categoria → prodotto).
  // In modifica, menu e categoria vengono derivati dal piatto abbinato salvato.
  const savedPairing = dish?.pairing_dish_id
    ? allDishes.find(d => d.id === dish.pairing_dish_id) ?? null
    : null
  const [pairMenuId, setPairMenuId]     = useState(savedPairing?.menu_id ?? '')
  const [pairCategory, setPairCategory] = useState(savedPairing?.category ?? '')
  const [pairingId, setPairingId]       = useState(dish?.pairing_dish_id ?? '')
  const [uploading, setUploading]     = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [aiLoading, setAiLoading]     = useState(false)
  const [aiError, setAiError]         = useState<string | null>(null)
  // Bumped to force AllergenGrid remount with new AI-suggested values.
  const [allergenKey, setAllergenKey] = useState(() => dish?.id ?? 'new')
  const [allergenInit, setAllergenInit] = useState(() => (dish?.allergens ?? []).map(Number))

  // Extra menus to copy this dish into when creating
  const [extraMenuIds, setExtraMenuIds] = useState<Set<string>>(new Set())

  // Allergens kept in a ref so AllergenGrid can update without re-rendering this form
  const allergensRef = useRef<number[]>((dish?.allergens ?? []).map(Number))
  const handleAllergenChange = useCallback((ids: number[]) => {
    allergensRef.current = ids
    dirtyRef.current.add('allergens')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Dirty fields tracking — tracks which fields were actually changed in this session
  const dirtyRef = useRef<Set<string>>(new Set())

  async function handleAiAllergens() {
    if (!name.trim()) return
    setAiLoading(true)
    setAiError(null)
    try {
      const ids = await detectAllergens(name, description)
      allergensRef.current = ids
      dirtyRef.current.add('allergens')
      setAllergenInit(ids)
      setAllergenKey(`ai-${Date.now()}`)
    } catch (err: any) {
      setAiError(err.message ?? 'Errore AI.')
    } finally {
      setAiLoading(false)
    }
  }

  // Unique sorted categories from all dishes in this restaurant
  const existingCategories = Array.from(
    new Set(allDishes.map(d => d.category).filter(Boolean))
  ).sort() as string[]

  const otherMenus      = allMenus.filter(m => m.id !== menuId)
  const currentMenuName = allMenus.find(m => m.id === menuId)?.name ?? 'Questo menu'

  async function handleUpload(file: File) {
    setUploading(true)
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${restaurantId}/${Date.now()}.${ext}`
    const { data, error: err } = await supabase.storage
      .from('dish-images').upload(path, file, { upsert: true })
    if (!err && data) {
      const { data: pub } = supabase.storage.from('dish-images').getPublicUrl(data.path)
      // L'originale intero è salvato; se l'utente annulla il ritaglio la card
      // mostra la foto intera (comportamento precedente).
      setImageUrl(pub.publicUrl)
      setOrigUrl(pub.publicUrl)
      setImageCrop(null)
      dirtyRef.current.add('image_url')
      // Apri subito il selettore di ritaglio sul file locale (nessun round-trip).
      if (localSrcRef.current) URL.revokeObjectURL(localSrcRef.current)
      const local = URL.createObjectURL(file)
      localSrcRef.current = local
      setCropState({ src: local, initial: null })
    } else if (err) {
      setError('Upload fallito: ' + err.message)
    }
    setUploading(false)
  }

  function closeCropModal() {
    setCropState(null)
    if (localSrcRef.current) {
      URL.revokeObjectURL(localSrcRef.current)
      localSrcRef.current = null
    }
  }

  // "Riposiziona": riapre il selettore sull'originale (le foto caricate prima
  // di questa funzione non hanno originale separato → si usa image_url).
  function handleReposition() {
    const src = origUrl || imageUrl
    if (!src) return
    setCropState({ src, initial: imageCrop })
  }

  async function handleCropConfirm(rect: CropRect) {
    if (!cropState) return
    setCropSaving(true)
    try {
      const blob = await cropImageToBlob(cropState.src, rect)
      const supabase = createClient()
      const path = `${restaurantId}/${Date.now()}_crop.jpg`
      const { data, error: err } = await supabase.storage
        .from('dish-images').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (err || !data) throw new Error(err?.message ?? 'Upload fallito')
      const { data: pub } = supabase.storage.from('dish-images').getPublicUrl(data.path)
      // Per le foto caricate in passato l'originale è l'attuale image_url.
      setOrigUrl(prev => prev || imageUrl)
      setImageUrl(pub.publicUrl)
      setImageCrop(rect)
      dirtyRef.current.add('image_url')
      closeCropModal()
    } catch (err: any) {
      setError('Ritaglio fallito: ' + (err?.message ?? 'riprova.'))
      closeCropModal()
    } finally {
      setCropSaving(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim())     { setError('Il nome è obbligatorio.'); return }
    if (!category.trim()) { setError('La categoria è obbligatoria.'); return }
    setSaving(true); setError(null)

    const payload = {
      name:            name.trim(),
      description,
      price,
      category:        category.trim(),
      image_url:       imageUrl,
      image_original_url: origUrl || null,
      image_crop:      imageCrop,
      allergens:       allergensRef.current,
      pairing_dish_id: pairingId || null,
    }

    try {
      const saved = dish
        ? await updateDish(restaurantId, menuId, dish.id, payload)
        : await createDish(restaurantId, menuId, payload)

      // Copy into extra menus when creating (fire all in parallel)
      if (!dish && extraMenuIds.size > 0) {
        await Promise.all(
          Array.from(extraMenuIds).map(mId => createDish(restaurantId, mId, payload))
        )
      }

      onSaved(saved as unknown as Dish, !dish, new Set(dirtyRef.current))
    } catch (err: any) {
      setError(err.message ?? 'Errore. Riprova.')
      setSaving(false)
    }
  }

  // Cascata abbinamento: piatti candidati (tutti i piatti attivi del ristorante
  // tranne quello in modifica), menu che ne contengono almeno uno, categorie
  // del menu scelto, prodotti della categoria scelta.
  const pairingOptions = allDishes.filter(d => d.id !== dish?.id)
  const pairingMenus = allMenus.filter(m =>
    pairingOptions.some(d => d.menu_id === m.id)
  )
  const pairingCategories = pairMenuId
    ? Array.from(new Set(
        pairingOptions.filter(d => d.menu_id === pairMenuId).map(d => d.category).filter(Boolean)
      )).sort()
    : []
  const pairingProducts = pairMenuId && pairCategory
    ? pairingOptions.filter(d => d.menu_id === pairMenuId && d.category === pairCategory)
    : []

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
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); dirtyRef.current.add('name') }}
              required
              placeholder="Es. Margherita"
              className="w-full px-3 py-2 border border-gray-300 text-base focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Category + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoria *</label>
              <CategoryCombobox
                value={category}
                onChange={v => { setCategory(v); dirtyRef.current.add('category') }}
                categories={existingCategories}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prezzo (€)</label>
              <input
                type="number"
                value={price}
                onChange={e => { setPrice(e.target.value); dirtyRef.current.add('price') }}
                min="0"
                step="0.50"
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 text-base focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrizione</label>
            <textarea
              value={description}
              onChange={e => { setDescription(e.target.value); dirtyRef.current.add('description') }}
              rows={3}
              placeholder="Ingredienti, note…"
              className="w-full px-3 py-2 border border-gray-300 text-base focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Photo */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Foto</label>
            {imageUrl && (
              <div className="mb-2">
                {/* Anteprima 16:9 — stesso taglio della card prodotto nel frontend */}
                <div className="relative inline-block">
                  <img src={imageUrl} alt="" className="w-36 aspect-video object-cover border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => {
                      setImageUrl(''); setOrigUrl(''); setImageCrop(null)
                      dirtyRef.current.add('image_url')
                    }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"
                  >
                    &times;
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleReposition}
                  className="block mt-1.5 text-xs text-blue-600 hover:underline"
                >
                  Riposiziona inquadratura
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
              className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:border file:border-gray-300 file:text-xs file:bg-white file:text-gray-700 hover:file:bg-gray-50 cursor-pointer"
            />
            {uploading && <p className="text-xs text-gray-400 mt-1">Caricamento…</p>}
          </div>

          {/* Allergens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">Allergeni</label>
              <button
                type="button"
                onClick={handleAiAllergens}
                disabled={aiLoading || !name.trim()}
                className="text-xs text-gray-500 border border-gray-300 px-2.5 py-1 hover:bg-gray-50 disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                {aiLoading && <Spinner color="#6b7280" />}
                Allergeni AI
              </button>
            </div>
            {aiError && (
              <p className="text-xs text-red-500 mb-2">{aiError}</p>
            )}
            <AllergenGrid
              key={allergenKey}
              initial={allergenInit}
              onChange={handleAllergenChange}
            />
          </div>

          {/* Pairing — 3 tendine a cascata: menu → categoria → prodotto */}
          {pairingOptions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Abbinamento consigliato
              </label>
              <div className="space-y-2">
                <select
                  value={pairMenuId}
                  onChange={e => {
                    setPairMenuId(e.target.value)
                    setPairCategory('')
                    setPairingId('')
                    dirtyRef.current.add('pairing_dish_id')
                  }}
                  className="w-full px-3 py-2 border border-gray-300 text-base focus:outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">— Nessuno —</option>
                  {pairingMenus.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <select
                  value={pairCategory}
                  disabled={!pairMenuId}
                  onChange={e => {
                    setPairCategory(e.target.value)
                    setPairingId('')
                    dirtyRef.current.add('pairing_dish_id')
                  }}
                  className="w-full px-3 py-2 border border-gray-300 text-base focus:outline-none focus:border-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">— Categoria —</option>
                  {pairingCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={pairingId}
                  disabled={!pairCategory}
                  onChange={e => { setPairingId(e.target.value); dirtyRef.current.add('pairing_dish_id') }}
                  className="w-full px-3 py-2 border border-gray-300 text-base focus:outline-none focus:border-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">— Prodotto —</option>
                  {pairingProducts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Multi-menu selector — only when creating and other menus exist */}
          {!dish && otherMenus.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Aggiungi anche a
              </label>
              <div className="space-y-1.5 bg-gray-50 border border-gray-200 rounded px-3 py-2">
                <label className="flex items-center gap-2 text-xs opacity-60 cursor-not-allowed">
                  <input type="checkbox" checked readOnly className="accent-blue-600" />
                  <span className="text-gray-600">
                    {currentMenuName} <span className="text-gray-400">(corrente)</span>
                  </span>
                </label>
                {otherMenus.map(m => (
                  <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={extraMenuIds.has(m.id)}
                      onChange={() => setExtraMenuIds(prev => {
                        const next = new Set(prev)
                        next.has(m.id) ? next.delete(m.id) : next.add(m.id)
                        return next
                      })}
                      className="accent-blue-600"
                    />
                    <span className="text-gray-700">{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || uploading}
              className="bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors min-w-[64px] flex items-center justify-center"
            >
              {saving ? <Spinner color="#fff" /> : 'Salva'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-600 px-4 py-2 border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Annulla
            </button>
          </div>
        </form>
      </div>

      {cropState && (
        <CropModal
          src={cropState.src}
          initial={cropState.initial}
          busy={cropSaving}
          onConfirm={handleCropConfirm}
          onCancel={closeCropModal}
        />
      )}
    </div>
  )
}
