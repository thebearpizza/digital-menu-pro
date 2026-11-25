'use client'

// Testi delle descrizioni delle categorie del menu scelto: per ognuna
// nessuna, breve (sotto il titolo) o a pagina intera. Si vedono subito
// nell'anteprima; toccandone una l'anteprima va alla sua pagina.

import { useRef, useState } from 'react'
import { MAX_CATEGORY_TEXT } from '@/lib/categoryText'
import { Segmented } from './controls'

export type CategoryTextValue = Record<string, { mode: 'short' | 'page'; body: string }>
type Mode = 'none' | 'short' | 'page'

export default function CategoryTextPanel({ categories, value, onChange, onFocus }: {
  categories: string[]
  value:      CategoryTextValue
  onChange:   (next: CategoryTextValue) => void
  onFocus:    (category: string) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  // Categorie messe su Breve/Pagina intera ancora senza testo.
  const [drafts, setDrafts] = useState<Set<string>>(new Set())
  // Testo di una categoria messa su "Nessuna": torna se la si riattiva.
  const kept = useRef(new Map<string, string>())
  if (!categories.length) return <p className="text-[11px] text-gray-400">Questo menu non ha ancora categorie con piatti attivi.</p>

  const modeOf = (cat: string): Mode => (value[cat]?.body || drafts.has(cat) ? value[cat]?.mode ?? 'short' : 'none')
  const setMode = (cat: string, m: Mode) => {
    const cur = value[cat]
    if (m === 'none') {
      if (cur?.body) kept.current.set(cat, cur.body)
      setDrafts(d => { const n = new Set(d); n.delete(cat); return n })
      onChange({ ...value, [cat]: { mode: cur?.mode ?? 'short', body: '' } })
      return
    }
    setDrafts(d => new Set(d).add(cat))
    onChange({ ...value, [cat]: { mode: m, body: cur?.body || kept.current.get(cat) || '' } })
    onFocus(cat)
  }
  const setBody = (cat: string, body: string) =>
    onChange({ ...value, [cat]: { mode: value[cat]?.mode ?? 'short', body } })

  return (
    <div className="space-y-2">
      {categories.map(cat => {
        const v = value[cat]
        const mode = modeOf(cat)
        const isOpen = open === cat
        return (
          <div key={cat} className="rounded-lg border border-gray-200 bg-white">
            <button type="button" onClick={() => { setOpen(isOpen ? null : cat); if (!isOpen) onFocus(cat) }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left">
              <span className="text-xs font-medium text-gray-800 truncate">{cat}</span>
              <span className="text-[11px] text-gray-400 shrink-0">
                {mode === 'page' ? 'Pagina intera' : mode === 'short' ? 'Breve' : 'Nessuna'}
              </span>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 space-y-2">
                <Segmented value={mode}
                  options={[{ value: 'none', label: 'Nessuna' }, { value: 'short', label: 'Breve' }, { value: 'page', label: 'Pagina intera' }]}
                  onChange={m => setMode(cat, m as Mode)} />
                {mode !== 'none' && (<>
                  <textarea value={v?.body ?? ''} maxLength={MAX_CATEGORY_TEXT} rows={mode === 'page' ? 6 : 3}
                    onChange={e => setBody(cat, e.target.value)} onFocus={() => onFocus(cat)}
                    placeholder={mode === 'page' ? 'La storia della categoria: impasti, materie prime, come nasce…' : 'Una o due frasi, es. Impasto a 72 ore, farine macinate a pietra.'}
                    className="w-full px-2.5 py-2 border border-gray-300 text-sm focus:outline-none focus:border-blue-500 resize-y" style={{ borderRadius: 8 }} />
                  <p className="text-[11px] text-gray-400">
                    *corsivo* · **grassetto** · riga vuota = nuovo paragrafo.
                    {mode === 'page' ? ' Se la categoria ha una foto o un video in "Foto e video", diventa lo sfondo di questa pagina.' : ''}
                  </p>
                </>)}
              </div>
            )}
          </div>
        )
      })}
      <p className="text-[11px] text-gray-400">Le descrizioni si traducono nelle altre lingue quando salvi. Si possono scrivere anche dalla pagina del menu (⋮ della categoria).</p>
    </div>
  )
}
