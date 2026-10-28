'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Pannello "Foto e video" della Personalizzazione del nuovo menu: pagine intere
// con foto/video nel libro, per il menu scelto (menus.media_pages).
//  • Categorie: foto o video prima di una categoria.
//  • Promo: foto/video (o la foto del piatto collegato) con etichetta, titolo,
//    descrizione e prezzo promo; all'inizio, prima/dopo una categoria o alla
//    fine del menu. Collegata a un piatto, toccandola si apre la sua scheda.
// L'anteprima va sulla pagina che si sta modificando.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from 'react'
import { compressImageFile } from '@/lib/imageCompress'
import { canEncodeVideo, toH264, usefulFrame } from '@/lib/videoTools'
import { newMediaId, type MediaPage, type MediaWhere } from '@/lib/menuMedia'
import { Choice, FieldShell, Toggle, uploadAsset } from './controls'

export interface MediaDish { id: string; name: string; category: string; price: number | null; image: string | null }

const MAX_VIDEO_BYTES = 20 * 1024 * 1024
const INPUT = 'w-full text-sm border border-gray-200 px-2 py-1.5 outline-none focus:border-gray-400'
const WHERE_LABEL: Record<MediaWhere, string> = { start: 'All\'inizio del menu', before: 'Prima di una categoria', after: 'Dopo una categoria', end: 'Alla fine del menu' }

const blank = (kind: MediaPage['kind'], category: string | null): MediaPage => ({
  id: newMediaId(), kind, where: kind === 'category' ? 'before' : 'start', category,
  url: null, video: false, poster: null, dishId: null, title: null, description: null, badge: null,
  price: null, promoPrice: null, priceMode: 'solo', show: true,
})

const priceText = (v: number | null) => (v === null ? '' : String(v).replace('.', ','))
const parsePrice = (s: string): number | null => {
  const n = parseFloat(s.replace(/[^\d,.]/g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

export default function MediaPanel({ restaurantId, value, categories, dishes, openId, onOpen, onChange }: {
  restaurantId: string
  value:        MediaPage[]
  categories:   string[]
  dishes:       MediaDish[]
  /** Pagina aperta (l'anteprima la mostra). */
  openId:       string | null
  onOpen:       (id: string | null) => void
  onChange:     (v: MediaPage[]) => void
}) {
  const cats = value.filter(p => p.kind === 'category')
  const promos = value.filter(p => p.kind === 'promo')
  const free = categories.filter(c => !cats.some(p => p.category === c))
  const update = (id: string, patch: Partial<MediaPage>) => onChange(value.map(p => (p.id === id ? { ...p, ...patch } : p)))
  const remove = (id: string) => { onChange(value.filter(p => p.id !== id)); if (openId === id) onOpen(null) }
  const add = (p: MediaPage) => { onChange([...value, p]); onOpen(p.id) }
  /** Sposta tra le pagine dello stesso tipo (l'ordine conta nella stessa posizione). */
  const move = (id: string, d: -1 | 1) => {
    const i = value.findIndex(p => p.id === id)
    const same = value.map((p, k) => ({ p, k })).filter(x => x.p.kind === value[i].kind)
    const at = same.findIndex(x => x.k === i), to = same[at + d]
    if (!to) return
    const next = [...value]; [next[i], next[to.k]] = [next[to.k], next[i]]
    onChange(next)
  }

  const row = (p: MediaPage, list: MediaPage[]) => {
    const dish = p.dishId ? dishes.find(d => d.id === p.dishId) ?? null : null
    const thumb = p.video ? p.poster : p.url ?? dish?.image ?? null
    const name = p.kind === 'category' ? (p.title || p.category || 'Categoria') : (p.title || dish?.name || 'Promo')
    const where = p.kind === 'category' ? `Prima di "${p.category}"` : p.where === 'before' || p.where === 'after' ? `${p.where === 'before' ? 'Prima di' : 'Dopo'} "${p.category}"` : WHERE_LABEL[p.where]
    const open = openId === p.id
    const k = list.indexOf(p)
    return (
      <div key={p.id} className={`border ${open ? 'border-blue-600' : 'border-gray-200'}`} style={{ borderRadius: 12 }}>
        <div className="flex items-center gap-3 p-2">
          <button type="button" onClick={() => onOpen(open ? null : p.id)} className="flex flex-1 min-w-0 items-center gap-3 text-left" style={{ borderRadius: 8 }}>
            <span className="w-11 h-16 shrink-0 overflow-hidden bg-gray-800 flex items-center justify-center text-[10px] text-white/70" style={{ borderRadius: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : p.video ? 'Video' : '—'}
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-medium truncate ${p.show ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{name}</span>
              <span className="block text-[11px] text-gray-500 truncate">{p.video ? 'Video' : p.url ? 'Foto' : dish?.image ? 'Foto del piatto' : 'Manca la foto'} · {where}</span>
            </span>
          </button>
          <div className="flex items-center text-[11px] text-gray-500 shrink-0">
            <button type="button" aria-label="Sposta su" disabled={k === 0} onClick={() => move(p.id, -1)} className="px-1.5 py-1 disabled:opacity-30">↑</button>
            <button type="button" aria-label="Sposta giù" disabled={k === list.length - 1} onClick={() => move(p.id, 1)} className="px-1.5 py-1 disabled:opacity-30">↓</button>
            <button type="button" onClick={() => remove(p.id)} className="px-1.5 py-1 hover:text-red-600">Togli</button>
          </div>
        </div>
        {open && (
          <div className="border-t border-gray-100 p-3 space-y-4">
            <Toggle label="Mostra nel menu" value={p.show} onChange={v => update(p.id, { show: v })} />
            {p.kind === 'category' ? (
              <FieldShell label="Categoria">
                <select className={INPUT} value={p.category ?? ''} onChange={e => update(p.id, { category: e.target.value })}>
                  {categories.map(c => <option key={c} value={c} disabled={c !== p.category && cats.some(x => x.category === c)}>{c}</option>)}
                </select>
              </FieldShell>
            ) : (<>
              <Choice label="Dove" value={p.where} onChange={v => update(p.id, { where: v, category: v === 'before' || v === 'after' ? p.category ?? categories[0] ?? null : p.category })}
                options={(['start', 'before', 'after', 'end'] as const).map(w => ({ value: w, label: WHERE_LABEL[w] }))} />
              {(p.where === 'before' || p.where === 'after') && (
                <FieldShell label="Categoria">
                  <select className={INPUT} value={p.category ?? ''} onChange={e => update(p.id, { category: e.target.value })}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FieldShell>
              )}
              <FieldShell label="Piatto collegato" hint="Toccando la pagina si apre la scheda del piatto. Senza foto o video caricati si usa la sua foto.">
                <select className={INPUT} value={p.dishId ?? ''} onChange={e => update(p.id, { dishId: e.target.value || null })}>
                  <option value="">Nessuno</option>
                  {categories.map(c => (
                    <optgroup key={c} label={c}>
                      {dishes.filter(d => d.category === c).map(d => <option key={d.id} value={d.id}>{d.name}{d.image ? '' : ' (senza foto)'}</option>)}
                    </optgroup>
                  ))}
                </select>
              </FieldShell>
            </>)}

            <MediaField restaurantId={restaurantId} page={p} fallback={p.kind === 'promo' ? dish?.image ?? null : null}
              onChange={patch => update(p.id, patch)} />

            {p.kind === 'promo' && (
              <FieldShell label="Etichetta (facoltativa)">
                <input className={INPUT} value={p.badge ?? ''} maxLength={60} placeholder="es. Specialità della casa"
                  onChange={e => update(p.id, { badge: e.target.value || null })} />
              </FieldShell>
            )}
            <FieldShell label="Titolo (facoltativo)">
              <input className={INPUT} value={p.title ?? ''} maxLength={120}
                placeholder={p.kind === 'category' ? `Vuoto = "${p.category ?? ''}"` : dish ? `Vuoto = "${dish.name}"` : 'es. Happy hour'}
                onChange={e => update(p.id, { title: e.target.value || null })} />
            </FieldShell>
            <FieldShell label="Descrizione (facoltativa)">
              <textarea className={INPUT} rows={2} value={p.description ?? ''} maxLength={400}
                onChange={e => update(p.id, { description: e.target.value || null })} />
            </FieldShell>
            {p.kind === 'promo' && (<>
              <div className="grid grid-cols-2 gap-3">
                <FieldShell label="Prezzo">
                  <PriceInput value={p.price} placeholder={dish?.price !== null && dish?.price !== undefined ? `Vuoto = ${priceText(dish.price)}` : 'es. 18'}
                    onChange={v => update(p.id, { price: v })} />
                </FieldShell>
                <FieldShell label="Prezzo promo">
                  <PriceInput value={p.promoPrice} placeholder="es. 14" onChange={v => update(p.id, { promoPrice: v })} />
                </FieldShell>
              </div>
              {p.promoPrice !== null && (
                <Choice label="Come mostrare i prezzi" value={p.priceMode} onChange={v => update(p.id, { priceMode: v })}
                  options={[{ value: 'strikethrough', label: 'Prezzo barrato + promo' }, { value: 'solo', label: 'Solo il prezzo promo' }]} />
              )}
            </>)}
            <p className="text-[11px] text-gray-400">Titolo e descrizione si vedono così in tutte le lingue.</p>
          </div>
        )}
      </div>
    )
  }

  return (<>
    <p className="text-[11px] text-gray-400 -mt-1">Pagine intere con una foto o un video, che si sfogliano come le altre. Valgono per il menu scelto in alto.</p>
    <FieldShell label="Categorie" hint="Una foto o un video a pagina intera prima della categoria. Dalla barra delle categorie si arriva qui.">
      <div className="space-y-2">
        {cats.map(p => row(p, cats))}
        {free.length > 0 && (
          <button type="button" onClick={() => add(blank('category', free[0]))}
            className="border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-500" style={{ borderRadius: 10 }}>
            + Foto o video di una categoria
          </button>
        )}
        {!categories.length && <p className="text-[11px] text-gray-400">Questo menu non ha ancora categorie.</p>}
      </div>
    </FieldShell>
    <FieldShell label="Promo" hint="Una pagina che mette in vetrina un piatto o un'offerta.">
      <div className="space-y-2">
        {promos.map(p => row(p, promos))}
        <button type="button" onClick={() => add(blank('promo', null))}
          className="border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-500" style={{ borderRadius: 10 }}>
          + Promo
        </button>
      </div>
    </FieldShell>
  </>)
}

function PriceInput({ value, placeholder, onChange }: { value: number | null; placeholder?: string; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(priceText(value))
  return (
    <input className={INPUT} inputMode="decimal" value={text} placeholder={placeholder}
      onChange={e => { setText(e.target.value); onChange(e.target.value.trim() ? parsePrice(e.target.value) : null) }} />
  )
}

/** Foto o video della pagina. I video (anche .mov di iPhone) si preparano qui
 *  in MP4 H.264 leggero, con l'immagine d'attesa dal primo fotogramma utile. */
function MediaField({ restaurantId, page, fallback, onChange }: {
  restaurantId: string; page: MediaPage; fallback: string | null; onChange: (patch: Partial<MediaPage>) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const upload = async (raw: File) => {
    setErr(null); setBusy('Caricamento…')
    try {
      const video = raw.type.startsWith('video/') || /\.(mov|mp4|m4v|webm)$/i.test(raw.name)
      let file: File = raw
      if (video) {
        const r = canEncodeVideo()
          ? await toH264(raw, pr => setBusy(`Preparo il video per tutti i telefoni… ${Math.round(pr * 100)}%`))
          : { error: 'questo browser non sa convertire video.' }
        if ('blob' in r) file = new File([r.blob], 'video.mp4', { type: 'video/mp4' })
        else setErr(`${r.error} Caricato com'è: su alcuni telefoni potrebbe non vedersi.`)
        if (file.size > MAX_VIDEO_BYTES) { setErr('Video troppo grande anche dopo la conversione (massimo 20 MB): usane uno più corto.'); setBusy(null); return }
      } else file = await compressImageFile(raw)
      const ext = (file.name.split('.').pop() || (video ? 'mp4' : 'jpg')).toLowerCase()
      setBusy('Caricamento…')
      const url = await uploadAsset(restaurantId, 'menu-media', file, ext)
      let poster: string | null = null
      if (video) {
        const f = await usefulFrame(file)
        if (f.image) poster = await uploadAsset(restaurantId, 'menu-media', new File([f.image], 'poster.jpg', { type: 'image/jpeg' }), 'jpg')
      }
      onChange({ url, video, poster })
    } catch { setErr('Caricamento non riuscito, riprova.') }
    setBusy(null)
  }
  const shown = page.video ? page.poster : page.url
  return (
    <FieldShell label="Foto o video" hint={page.kind === 'promo' ? 'Facoltativo se c\'è un piatto collegato con la foto. Video senza audio, meglio brevi.' : 'Video senza audio, meglio brevi (massimo 30 secondi).'}>
      <div className="flex items-center gap-3">
        <span className="w-16 h-24 shrink-0 overflow-hidden bg-gray-800" style={{ borderRadius: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {shown ? <img src={shown} alt="" className="w-full h-full object-cover" />
            : page.video && page.url ? <video src={page.url} muted className="w-full h-full object-cover" />
            // eslint-disable-next-line @next/next/no-img-element
            : fallback ? <img src={fallback} alt="" className="w-full h-full object-cover opacity-70" /> : null}
        </span>
        <div className="space-y-1.5">
          <button type="button" disabled={!!busy} onClick={() => fileRef.current?.click()}
            className="block border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-500 disabled:opacity-50" style={{ borderRadius: 8 }}>
            {busy ?? (page.url ? 'Cambia foto o video' : 'Carica foto o video')}
          </button>
          {page.url && !busy && (
            <button type="button" onClick={() => onChange({ url: null, video: false, poster: null })} className="block text-xs text-gray-500 hover:text-red-600">
              Togli {page.video ? 'il video' : 'la foto'}
            </button>
          )}
          {err && <p className="text-[11px] text-red-600">{err}</p>}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }} />
    </FieldShell>
  )
}
