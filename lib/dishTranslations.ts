// Traduzioni automatiche di nome+descrizione di un piatto (en/fr/de/es).
// Condiviso da server actions e dalla route /api/dishes/translate.
import { translateItems, translateEnabled } from './translateEngine'
import { TARGET_LANGS, type DishTranslations } from './translations'

/**
 * Rigenera le traduzioni automatiche di nome+descrizione di un piatto,
 * preservando gli override manuali. Ritorna null se il traduttore non è
 * configurato. Best effort: i chiamanti avvolgono in try/catch — un errore
 * di traduzione non deve mai bloccare il salvataggio del piatto.
 */
export async function autoDishTranslations(
  name: string, description: string | null, existing?: DishTranslations | null,
): Promise<DishTranslations | null> {
  if (!translateEnabled()) return null
  const items = [{ id: 'name', text: name }]
  if (description?.trim()) items.push({ id: 'desc', text: description })
  const res = await translateItems(items)
  const tr: DishTranslations = JSON.parse(JSON.stringify(existing ?? {}))
  for (const lang of TARGET_LANGS) {
    const entry = tr[lang] ?? (tr[lang] = {})
    const n = res['name']?.[lang]
    if (n && !entry.manual?.name) entry.name = n
    if (!entry.manual?.description) {
      const d = res['desc']?.[lang]
      if (d) entry.description = d
      else if (!description?.trim()) delete entry.description
    }
  }
  return tr
}

