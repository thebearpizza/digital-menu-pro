'use client'

import { useState, useTransition } from 'react'
import { ALLERGENS, allergenList } from '@/lib/allergens'
import { useAllergenCatalog } from '@/components/AllergenCatalog'
import { Spinner } from '@/components/ui/Spinner'
import { saveAllergenOverrides } from './actions'

export default function AllergenSettings() {
  const catalog = useAllergenCatalog()
  const [rows, setRows] = useState(() =>
    allergenList(catalog).map(a => ({ id: a.id, number: String(a.number), name: a.name, defaultName: a.defaultName })),
  )
  const [saving, startSave] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  function update(id: number, patch: Partial<{ number: string; name: string }>) {
    setMessage(null)
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  function resetAll() {
    setMessage(null)
    setRows(ALLERGENS.map(a => ({ id: a.id, number: String(a.id), name: a.name, defaultName: a.name })))
  }

  function save() {
    startSave(async () => {
      const res = await saveAllergenOverrides(rows.map(r => ({ id: r.id, number: Number(r.number), name: r.name })))
      setMessage(res.ok ? { ok: true, text: 'Allergeni salvati.' } : { ok: false, text: res.error })
    })
  }

  const numbers = rows.map(r => r.number.trim())
  const dup = (n: string) => n !== '' && numbers.filter(x => x === n).length > 1

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">
        Cambia il nome o il numero mostrato di ogni allergene. Le modifiche valgono per tutti i tuoi
        ristoranti: scheda piatto, menu del cliente, PDF ed Excel. I nomi modificati vengono tradotti
        in automatico nelle lingue del menu.
      </p>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className="flex items-center gap-2">
            <input
              type="number" inputMode="numeric" min={1} max={99}
              value={r.number}
              onChange={e => update(r.id, { number: e.target.value })}
              aria-label={`Numero di ${r.defaultName}`}
              className={`w-14 shrink-0 border px-2 py-2 text-sm text-center tabular-nums ${dup(r.number.trim()) ? 'border-red-400 text-red-600' : 'border-gray-300 text-gray-900'}`}
            />
            <input
              type="text"
              value={r.name}
              onChange={e => update(r.id, { name: e.target.value })}
              maxLength={60}
              aria-label={`Nome di ${r.defaultName}`}
              className="flex-1 min-w-0 border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
            {(r.name !== r.defaultName || r.number !== String(r.id)) && (
              <button
                type="button"
                onClick={() => update(r.id, { number: String(r.id), name: r.defaultName })}
                title={`Ripristina: ${r.id}. ${r.defaultName}`}
                className="shrink-0 w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                aria-label={`Ripristina ${r.defaultName}`}
              >
                ↺
              </button>
            )}
          </div>
        ))}
      </div>

      {message && (
        <p className={`mt-4 text-sm ${message.ok ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button" onClick={save} disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 disabled:opacity-50 flex items-center justify-center min-w-[110px]"
        >
          {saving ? <Spinner color="#fff" /> : 'Salva allergeni'}
        </button>
        <button
          type="button" onClick={resetAll} disabled={saving}
          className="border border-gray-300 bg-white text-gray-700 text-sm px-4 py-2 hover:bg-gray-50"
        >
          Ripristina standard UE
        </button>
      </div>
    </div>
  )
}
