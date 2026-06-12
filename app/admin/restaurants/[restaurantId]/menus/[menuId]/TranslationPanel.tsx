'use client'
// ─────────────────────────────────────────────────────────────────────────────
// TranslationPanel — editor delle traduzioni del menu (en/fr/de/es).
//
// All'apertura chiama ensureMenuTranslations: pre-genera in un colpo solo le
// traduzioni mancanti di TUTTE le lingue, così il cambio bandierina successivo
// è istantaneo. Ogni campo è modificabile: il salvataggio (blur o Invio) marca
// il campo come manuale e non verrà mai più sovrascritto dall'automatico.
// Svuotare un campo rimuove l'override e rigenera la traduzione automatica.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import {
  ALL_LANGS, LANG_FLAGS, LANG_LABELS, type Lang, type TargetLang,
} from '@/lib/translations'
import {
  ensureMenuTranslations, saveDishTranslation,
  saveCategoryTranslation, saveMenuNameTranslation,
  type TranslationSnapshot,
} from './translationActions'

// ── Barra bandierine (usata da DishList sopra l'editor) ───────────────────────

export function LangBar({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="mb-4 flex items-center gap-1.5 flex-wrap">
      {ALL_LANGS.map(l => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          title={LANG_LABELS[l]}
          aria-label={LANG_LABELS[l]}
          className={`px-2.5 py-1.5 text-lg leading-none rounded border transition-colors ${
            l === lang ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          {LANG_FLAGS[l]}
        </button>
      ))}
      {lang !== 'it' && (
        <span className="text-xs text-gray-500 ml-2">
          Traduzioni in {LANG_LABELS[lang]}: generate automaticamente, modificabili.
          Le correzioni manuali non vengono mai sovrascritte.
        </span>
      )}
    </div>
  )
}

// ── Campo traduzione con salvataggio al blur ──────────────────────────────────

function TrField({
  original, value, manual, multiline, placeholder, onSave,
}: {
  original:    string
  value:       string
  manual:      boolean
  multiline?:  boolean
  placeholder: string
  onSave:      (v: string) => Promise<void>
}) {
  const [draft, setDraft]   = useState(value)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash]   = useState(false)
  const lastSaved = useRef(value)

  // Il valore server cambia (rigenerazione dopo svuotamento, cambio lingua):
  // riallinea il draft solo se l'utente non sta scrivendo qualcosa di diverso.
  useEffect(() => {
    setDraft(value)
    lastSaved.current = value
  }, [value])

  async function commit() {
    if (draft.trim() === lastSaved.current.trim()) return
    setSaving(true)
    try {
      await onSave(draft)
      setFlash(true)
      setTimeout(() => setFlash(false), 1500)
    } catch (e: any) {
      alert(`Errore nel salvataggio della traduzione: ${e?.message ?? 'imprevisto'}`)
      setDraft(lastSaved.current)
    } finally {
      setSaving(false)
    }
  }

  const Cmp = multiline ? 'textarea' : 'input'
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-start gap-2">
        <Cmp
          value={draft}
          rows={multiline ? 2 : undefined}
          placeholder={placeholder}
          onChange={(e: any) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e: any) => { if (!multiline && e.key === 'Enter') e.currentTarget.blur() }}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400 text-gray-900"
        />
        <span className="w-5 h-9 flex items-center justify-center shrink-0">
          {saving ? <Spinner color="#9ca3af" size={3.5} /> : flash ? <span className="text-green-600 text-sm">✓</span> : null}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-gray-400 truncate">
        🇮🇹 {original}
        {manual && <span className="ml-2 text-amber-600">✎ modificata a mano</span>}
      </p>
    </div>
  )
}

// ── Pannello ──────────────────────────────────────────────────────────────────

export default function TranslationPanel({
  restaurantId, menuId, lang,
}: {
  restaurantId: string
  menuId:       string
  lang:         TargetLang
}) {
  const [snap, setSnap]   = useState<TranslationSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ensureMenuTranslations(restaurantId, menuId)
      .then(s => { if (!cancelled) setSnap(s) })
      .catch(e => { if (!cancelled) setError(e?.message ?? 'Errore nel caricamento delle traduzioni.') })
    return () => { cancelled = true }
  }, [restaurantId, menuId])

  if (error) {
    return <p className="text-sm text-red-600 py-6">{error}</p>
  }
  if (!snap) {
    return (
      <div className="flex items-center gap-3 py-10 justify-center text-sm text-gray-500">
        <Spinner color="#6b7280" /> Generazione traduzioni in corso…
      </div>
    )
  }

  const menuEntry = snap.menuTranslations[lang]
  const grouped = new Map<string, typeof snap.dishes>()
  for (const d of snap.dishes) {
    const key = d.category ?? 'Senza categoria'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(d)
  }
  // Ordine: categorie note prima, poi eventuali residue (es. Senza categoria)
  const orderedKeys = [
    ...snap.categories.filter(c => grouped.has(c)),
    ...Array.from(grouped.keys()).filter(k => !snap.categories.includes(k)),
  ]

  return (
    <div className="space-y-6">
      {!snap.engineEnabled && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Traduttore automatico non configurato (GEMINI_API_KEY): puoi comunque inserire le traduzioni a mano.
        </p>
      )}

      {/* Nome del menu */}
      <div className="bg-white border border-gray-200 rounded p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Nome del menu</p>
        <TrField
          original={snap.menuName}
          value={menuEntry?.name ?? ''}
          manual={!!menuEntry?.manual?.name}
          placeholder={`Nome in ${LANG_LABELS[lang]}`}
          onSave={async v => {
            const tr = await saveMenuNameTranslation(restaurantId, menuId, lang, v)
            setSnap(s => s ? { ...s, menuTranslations: tr } : s)
          }}
        />
      </div>

      {orderedKeys.map(cat => {
        const dishes = grouped.get(cat)!
        const isReal = snap.categories.includes(cat)
        return (
          <div key={cat} className="bg-white border border-gray-200 rounded">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              {isReal ? (
                <TrField
                  original={cat}
                  value={menuEntry?.categories?.[cat] ?? ''}
                  manual={!!menuEntry?.manual?.categories?.[cat]}
                  placeholder={`Categoria in ${LANG_LABELS[lang]}`}
                  onSave={async v => {
                    const tr = await saveCategoryTranslation(restaurantId, menuId, lang, cat, v)
                    setSnap(s => s ? { ...s, menuTranslations: tr } : s)
                  }}
                />
              ) : (
                <p className="text-sm font-medium text-gray-600">{cat}</p>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {dishes.map(d => {
                const entry = d.translations[lang]
                return (
                  <div key={d.id} className="px-4 py-3 space-y-2">
                    <TrField
                      original={d.name}
                      value={entry?.name ?? ''}
                      manual={!!entry?.manual?.name}
                      placeholder={`Nome piatto in ${LANG_LABELS[lang]}`}
                      onSave={async v => {
                        const tr = await saveDishTranslation(restaurantId, menuId, d.id, lang, { name: v })
                        setSnap(s => s ? {
                          ...s,
                          dishes: s.dishes.map(x => x.id === d.id ? { ...x, translations: tr } : x),
                        } : s)
                      }}
                    />
                    {d.description && (
                      <TrField
                        original={d.description}
                        value={entry?.description ?? ''}
                        manual={!!entry?.manual?.description}
                        multiline
                        placeholder={`Descrizione in ${LANG_LABELS[lang]}`}
                        onSave={async v => {
                          const tr = await saveDishTranslation(restaurantId, menuId, d.id, lang, { description: v })
                          setSnap(s => s ? {
                            ...s,
                            dishes: s.dishes.map(x => x.id === d.id ? { ...x, translations: tr } : x),
                          } : s)
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {snap.dishes.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">Nessun piatto in questo menu.</p>
      )}
    </div>
  )
}
