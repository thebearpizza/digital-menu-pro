'use client'

// Descrizione di una categoria: breve (sotto il titolo) o a pagina intera.
// L'aspetto si regola nella Personalizzazione (Descrizioni delle categorie).

import { useState } from 'react'
import Link from 'next/link'
import { Spinner } from '@/components/ui/Spinner'
import { MAX_CATEGORY_TEXT, type CategoryTextMode } from '@/lib/categoryText'

export interface CategoryTextValue { mode: CategoryTextMode; body: string }

export default function CategoryTextModal({ category, initial, styleHref, onSave, onClose }: {
  category:  string
  initial:   CategoryTextValue | null
  styleHref: string
  onSave:    (v: CategoryTextValue | null) => Promise<void>
  onClose:   () => void
}) {
  const [mode, setMode] = useState<CategoryTextMode | 'none'>(initial?.body ? initial.mode : 'short')
  const [body, setBody] = useState(initial?.body ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr(null)
    try {
      await onSave(mode === 'none' || !body.trim() ? null : { mode, body: body.trim() })
      onClose()
    } catch (e: any) { setErr(e?.message ?? 'Errore nel salvataggio.') }
    finally { setSaving(false) }
  }

  const opt = (v: typeof mode, label: string) => (
    <button key={v} type="button" onClick={() => setMode(v)} aria-pressed={mode === v}
      className={`px-3 py-1.5 text-xs font-medium border transition-colors ${mode === v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-gray-500'}`}
      style={{ borderRadius: 999 }}>
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-[300] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-white w-full max-w-md p-5 shadow-2xl space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Descrizione della categoria</h3>
          <p className="text-xs text-gray-500 mt-0.5">&ldquo;{category}&rdquo;: un testo che i clienti leggono nel menu.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {opt('none', 'Nessuna')}{opt('short', 'Breve, sotto il titolo')}{opt('page', 'Pagina intera')}
        </div>
        {mode !== 'none' && (<>
          <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={MAX_CATEGORY_TEXT} rows={mode === 'page' ? 7 : 3} autoFocus
            placeholder={mode === 'page' ? 'La storia della categoria: impasti, materie prime, come nasce…' : 'Una o due frasi, es. Impasto a 72 ore, farine macinate a pietra.'}
            className="w-full px-2.5 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500 resize-y" style={{ borderRadius: 8 }} />
          <p className="text-[11px] text-gray-500">
            *corsivo* · **grassetto** · riga vuota = nuovo paragrafo.
            {mode === 'page'
              ? ' Una pagina tutta per lei prima dei piatti, con il titolo della categoria; se la categoria ha una foto o un video, le fa da sfondo.'
              : ' Sotto il titolo, prima dei piatti.'}
            {' '}Si traduce da sola nelle altre lingue. <Link href={styleHref} className="underline">Aspetto nella Personalizzazione</Link>.
          </p>
        </>)}
        {err && <p className="text-xs text-red-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Annulla</button>
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors min-w-[64px] flex items-center justify-center">
            {saving ? <Spinner color="#fff" /> : 'Salva'}
          </button>
        </div>
      </form>
    </div>
  )
}
