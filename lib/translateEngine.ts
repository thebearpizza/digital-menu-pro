// ─────────────────────────────────────────────────────────────────────────────
// Motore di traduzione dei testi menu — Google Gemini (stessa API key del bot
// Telegram, GEMINI_API_KEY). SOLO lato server: importato dalle server actions.
//
// Traduce in blocco testi italiani (nomi piatto, descrizioni, categorie, nomi
// menu) verso en/fr/de/es/ru. I fallimenti non devono mai bloccare i salvataggi:
// chi chiama avvolge in try/catch e le traduzioni mancanti vengono rigenerate
// alla prossima occasione (ensureMenuTranslations).
// ─────────────────────────────────────────────────────────────────────────────

import { TARGET_LANGS, type TargetLang } from './translations'

const MODEL_CHAIN = Array.from(new Set([
  process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
]))

// Testi per chiamata: blocchi piccoli tengono il JSON di risposta affidabile.
const CHUNK_SIZE = 40

export function translateEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY
}

export interface TranslatableItem { id: string; text: string }
/** id → { en: '…', fr: '…', de: '…', es: '…', ru: '…' } (lingue mancanti = fallite) */
export type TranslationResult = Record<string, Partial<Record<TargetLang, string>>>

const SYSTEM = `Sei un traduttore professionale di menu di ristoranti italiani.
Traduci ogni testo dall'italiano verso inglese (en), francese (fr), tedesco (de), spagnolo (es) e russo (ru).

REGOLE:
- Tono naturale da menu di ristorante, non letterale parola per parola.
- I nomi propri di piatti italiani iconici restano riconoscibili (es. "Spaghetti alla carbonara" → en "Spaghetti alla Carbonara"), ma traduci gli ingredienti e le descrizioni.
- Il russo va scritto in alfabeto cirillico, mai traslitterato in caratteri latini.
- Mantieni maiuscole/minuscole coerenti con l'originale (un titolo resta un titolo).
- Non aggiungere note, virgolette o testo extra: solo la traduzione.
- Rispondi SOLO con un array JSON: [{"id": "...", "en": "...", "fr": "...", "de": "...", "es": "...", "ru": "..."}, ...] con un elemento per ogni testo ricevuto, stesso id.`

async function translateChunk(items: TranslatableItem[]): Promise<TranslationResult> {
  const apiKey = process.env.GEMINI_API_KEY!
  const payload = JSON.stringify(items.map(i => ({ id: i.id, it: i.text })))
  let lastErr: Error | null = null

  for (const model of MODEL_CHAIN) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: payload }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      },
    ).catch((e: any) => { lastErr = e; return null })
    if (!res) continue

    const body = await res.text().catch(() => '')
    if (!res.ok) {
      console.error('translateEngine error', model, res.status, body.slice(0, 300))
      lastErr = new Error(`Gemini HTTP ${res.status}`)
      if (res.status === 503 || res.status === 429 || res.status >= 500 || res.status === 404) continue
      throw lastErr // 400/403: configurazione, inutile insistere
    }

    try {
      const raw = JSON.parse(body)?.candidates?.[0]?.content?.parts?.[0]?.text
      const arr = JSON.parse(raw) as Array<Record<string, string>>
      const out: TranslationResult = {}
      for (const row of arr) {
        if (!row?.id) continue
        const entry: Partial<Record<TargetLang, string>> = {}
        for (const lang of TARGET_LANGS) {
          const v = row[lang]
          if (typeof v === 'string' && v.trim()) entry[lang] = v.trim()
        }
        out[row.id] = entry
      }
      return out
    } catch (e: any) {
      lastErr = new Error(`Gemini: JSON non valido (${e?.message})`)
      continue
    }
  }
  throw lastErr ?? new Error('Gemini non disponibile')
}

/**
 * Traduce tutti i testi in en/fr/de/es. I chunk falliti vengono semplicemente
 * omessi dal risultato (verranno ritentati alla prossima rigenerazione).
 */
export async function translateItems(items: TranslatableItem[]): Promise<TranslationResult> {
  const valid = items.filter(i => i.text.trim())
  const out: TranslationResult = {}
  for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
    try {
      Object.assign(out, await translateChunk(valid.slice(i, i + CHUNK_SIZE)))
    } catch (e: any) {
      console.error('translateItems chunk failed', e?.message)
    }
  }
  return out
}
