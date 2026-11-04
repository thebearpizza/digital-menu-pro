'use client'

// Programmazione di un menu, di una categoria o di un piatto: giorni della
// settimana in cui è visibile e, se serve, una fascia oraria (ora italiana).
// Senza fascia vale tutto il giorno: es. togliendo il sabato, il sabato non
// si vede mai.

import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { cleanDays, daysLabel } from '@/lib/menuSchedule'

export interface ScheduleValue {
  enabled: boolean
  from:    string | null
  until:   string | null
  days:    number[] | null
}

const DAYS = [
  { d: 1, short: 'L', name: 'Lunedì' }, { d: 2, short: 'M', name: 'Martedì' }, { d: 3, short: 'M', name: 'Mercoledì' },
  { d: 4, short: 'G', name: 'Giovedì' }, { d: 5, short: 'V', name: 'Venerdì' }, { d: 6, short: 'S', name: 'Sabato' },
  { d: 7, short: 'D', name: 'Domenica' },
]
const ALL = [1, 2, 3, 4, 5, 6, 7]

export default function ScheduleModal({ subject, initial, onSave, onClose }: {
  subject: string
  initial: { enabled?: boolean | null; from?: string | null; until?: string | null; days?: number[] | null }
  onSave: (v: ScheduleValue) => Promise<void>
  onClose: () => void
}) {
  const [enabled, setEnabled] = useState(initial.enabled ?? false)
  const [days,    setDays]    = useState<number[]>(cleanDays(initial.days) ?? ALL)
  // Le programmazioni di prima avevano sempre la fascia: resta accesa.
  const [hoursOn, setHoursOn] = useState(!!(initial.from && initial.until))
  const [from,    setFrom]    = useState(initial.from?.slice(0, 5) ?? '08:00')
  const [until,   setUntil]   = useState(initial.until?.slice(0, 5) ?? '12:00')
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState<string | null>(null)

  const toggleDay = (d: number) => setDays(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b)))
  const everyDay = days.length === 7
  const hidden = ALL.filter(d => !days.includes(d))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (enabled) {
      if (!days.length) { setErr('Scegli almeno un giorno.'); return }
      if (hoursOn && (!from || !until)) { setErr('Indica orario di inizio e di fine.'); return }
      if (hoursOn && from === until) { setErr('Orario di inizio e di fine coincidono: scegli una fascia valida.'); return }
      if (everyDay && !hoursOn) { setErr('Togli almeno un giorno o scegli una fascia oraria.'); return }
    }
    setSaving(true); setErr(null)
    try {
      await onSave(enabled
        ? { enabled: true, from: hoursOn ? from : null, until: hoursOn ? until : null, days: cleanDays(days) }
        : { enabled: false, from: null, until: null, days: null })
      onClose()
    } catch (e: any) { setErr(e?.message ?? 'Errore nel salvataggio.') }
    finally { setSaving(false) }
  }

  const chip = (on: boolean) => `h-9 w-9 text-sm font-medium border transition-colors ${on ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-400 hover:border-gray-500'}`
  const quick = 'text-[11px] text-gray-500 hover:text-gray-800 underline underline-offset-2'

  return (
    <div className="fixed inset-0 z-[300] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
        className="bg-white w-full max-w-sm p-5 shadow-2xl space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Programmazione</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            &ldquo;{subject}&rdquo; sarà visibile ai clienti solo nei giorni e nella fascia scelti
            (ora italiana). Fuori programmazione sparisce in automatico dal menu.
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}
            className="accent-blue-600 w-4 h-4" />
          <span className="text-sm text-gray-700">Attiva programmazione</span>
        </label>

        {enabled && (<>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Giorni in cui è visibile</span>
              <span className="flex gap-2">
                <button type="button" className={quick} onClick={() => setDays(ALL)}>Tutti</button>
                <button type="button" className={quick} onClick={() => setDays([1, 2, 3, 4, 5])}>Lun–Ven</button>
                <button type="button" className={quick} onClick={() => setDays([6, 7])}>Weekend</button>
              </span>
            </div>
            <div className="flex justify-between">
              {DAYS.map(x => (
                <button key={x.d} type="button" title={x.name} aria-label={x.name} aria-pressed={days.includes(x.d)}
                  onClick={() => toggleDay(x.d)} className={chip(days.includes(x.d))} style={{ borderRadius: 999 }}>
                  {x.short}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={hoursOn} onChange={e => setHoursOn(e.target.checked)}
              className="accent-blue-600 w-4 h-4" />
            <span className="text-sm text-gray-700">Solo in una fascia oraria</span>
          </label>
          {hoursOn && (
            <div className="flex items-center gap-3">
              <label className="flex-1 text-xs text-gray-600">
                Dalle
                <input type="time" value={from} onChange={e => setFrom(e.target.value)} required
                  className="mt-1 w-full px-2 py-1.5 border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
              </label>
              <label className="flex-1 text-xs text-gray-600">
                Alle
                <input type="time" value={until} onChange={e => setUntil(e.target.value)} required
                  className="mt-1 w-full px-2 py-1.5 border border-gray-300 text-sm focus:outline-none focus:border-blue-500" />
              </label>
            </div>
          )}

          {/* Riassunto in parole semplici. */}
          {days.length > 0 && (
            <p className="text-[11px] text-gray-600 bg-gray-50 px-2.5 py-2" style={{ borderRadius: 8 }}>
              {everyDay ? 'Tutti i giorni' : daysLabel(days)}
              {hoursOn ? `, dalle ${from} alle ${until}${from > until ? ' del giorno dopo' : ''}` : ', tutto il giorno'}.
              {hidden.length > 0 && !hoursOn && <> Non si vede mai {hidden.length === 1 ? `di ${DAYS[hidden[0] - 1].name.toLowerCase()}` : `nei giorni: ${daysLabel(hidden)}`}.</>}
            </p>
          )}
        </>)}

        {err && <p className="text-xs text-red-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Annulla</button>
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors min-w-[64px] flex items-center justify-center">
            {saving ? <Spinner color="#fff" /> : 'Salva'}
          </button>
        </div>
      </form>
    </div>
  )
}
