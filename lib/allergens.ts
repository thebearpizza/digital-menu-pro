export const ALLERGENS = [
  { id: 1,  name: 'Cereali e glutine',            short: 'Glutine'   },
  { id: 2,  name: 'Crostacei',                    short: 'Crostacei' },
  { id: 3,  name: 'Uova',                         short: 'Uova'      },
  { id: 4,  name: 'Pesce',                        short: 'Pesce'     },
  { id: 5,  name: 'Arachidi',                     short: 'Arachidi'  },
  { id: 6,  name: 'Soia',                         short: 'Soia'      },
  { id: 7,  name: 'Latte e latticini',           short: 'Latte'     },
  { id: 8,  name: 'Frutta a guscio',             short: 'Frutta secca' },
  { id: 9,  name: 'Sedano',                       short: 'Sedano'    },
  { id: 10, name: 'Senape',                       short: 'Senape'    },
  { id: 11, name: 'Semi di sesamo',              short: 'Sesamo'    },
  { id: 12, name: 'Anidride solforosa e solfiti', short: 'Solfiti'  },
  { id: 13, name: 'Lupini',                       short: 'Lupini'    },
  { id: 14, name: 'Molluschi',                    short: 'Molluschi' },
] as const

// Nomi ufficiali dei 14 allergeni UE (Reg. 1169/2011) nelle lingue del menu
// pubblico. Indice = id - 1. L'italiano resta in ALLERGENS (lingua base).
type AllergenLang = 'en' | 'fr' | 'de' | 'es'
const ALLERGEN_I18N: Record<AllergenLang, { name: string; short: string }[]> = {
  en: [
    { name: 'Cereals containing gluten',     short: 'Gluten' },
    { name: 'Crustaceans',                   short: 'Crustaceans' },
    { name: 'Eggs',                          short: 'Eggs' },
    { name: 'Fish',                          short: 'Fish' },
    { name: 'Peanuts',                       short: 'Peanuts' },
    { name: 'Soybeans',                      short: 'Soy' },
    { name: 'Milk and dairy',                short: 'Milk' },
    { name: 'Tree nuts',                     short: 'Nuts' },
    { name: 'Celery',                        short: 'Celery' },
    { name: 'Mustard',                       short: 'Mustard' },
    { name: 'Sesame seeds',                  short: 'Sesame' },
    { name: 'Sulphur dioxide and sulphites', short: 'Sulphites' },
    { name: 'Lupin',                         short: 'Lupin' },
    { name: 'Molluscs',                      short: 'Molluscs' },
  ],
  fr: [
    { name: 'Céréales contenant du gluten',   short: 'Gluten' },
    { name: 'Crustacés',                      short: 'Crustacés' },
    { name: 'Œufs',                           short: 'Œufs' },
    { name: 'Poisson',                        short: 'Poisson' },
    { name: 'Arachides',                      short: 'Arachides' },
    { name: 'Soja',                           short: 'Soja' },
    { name: 'Lait et produits laitiers',      short: 'Lait' },
    { name: 'Fruits à coque',                 short: 'Fruits à coque' },
    { name: 'Céleri',                         short: 'Céleri' },
    { name: 'Moutarde',                       short: 'Moutarde' },
    { name: 'Graines de sésame',              short: 'Sésame' },
    { name: 'Anhydride sulfureux et sulfites', short: 'Sulfites' },
    { name: 'Lupin',                          short: 'Lupin' },
    { name: 'Mollusques',                     short: 'Mollusques' },
  ],
  de: [
    { name: 'Glutenhaltiges Getreide',        short: 'Gluten' },
    { name: 'Krebstiere',                     short: 'Krebstiere' },
    { name: 'Eier',                           short: 'Eier' },
    { name: 'Fisch',                          short: 'Fisch' },
    { name: 'Erdnüsse',                       short: 'Erdnüsse' },
    { name: 'Soja',                           short: 'Soja' },
    { name: 'Milch und Milcherzeugnisse',     short: 'Milch' },
    { name: 'Schalenfrüchte',                 short: 'Nüsse' },
    { name: 'Sellerie',                       short: 'Sellerie' },
    { name: 'Senf',                           short: 'Senf' },
    { name: 'Sesamsamen',                     short: 'Sesam' },
    { name: 'Schwefeldioxid und Sulfite',     short: 'Sulfite' },
    { name: 'Lupinen',                        short: 'Lupinen' },
    { name: 'Weichtiere',                     short: 'Weichtiere' },
  ],
  es: [
    { name: 'Cereales con gluten',            short: 'Gluten' },
    { name: 'Crustáceos',                     short: 'Crustáceos' },
    { name: 'Huevos',                         short: 'Huevos' },
    { name: 'Pescado',                        short: 'Pescado' },
    { name: 'Cacahuetes',                     short: 'Cacahuetes' },
    { name: 'Soja',                           short: 'Soja' },
    { name: 'Leche y lácteos',                short: 'Leche' },
    { name: 'Frutos de cáscara',              short: 'Frutos secos' },
    { name: 'Apio',                           short: 'Apio' },
    { name: 'Mostaza',                        short: 'Mostaza' },
    { name: 'Granos de sésamo',               short: 'Sésamo' },
    { name: 'Dióxido de azufre y sulfitos',   short: 'Sulfitos' },
    { name: 'Altramuces',                     short: 'Altramuces' },
    { name: 'Moluscos',                       short: 'Moluscos' },
  ],
}

// ── Personalizzazione per account ─────────────────────────────────────────────
// Ogni account può rinominare gli allergeni e cambiarne il numero mostrato.
// Negli array dei piatti resta sempre l'id ufficiale (1–14): cambia solo come
// viene presentato. Senza personalizzazione tutto resta come da normativa UE.
export type AllergenOverride = {
  id: number
  number?: number
  name?: string
  i18n?: Partial<Record<AllergenLang, string>>
}
export type AllergenCatalog = AllergenOverride[] | null | undefined

function override(id: number, catalog: AllergenCatalog): AllergenOverride | undefined {
  return catalog?.find(o => o.id === id)
}

/** Numero mostrato per l'allergene (default: id ufficiale). */
export function allergenNumber(id: number, catalog?: AllergenCatalog): number {
  const n = override(id, catalog)?.number
  return typeof n === 'number' && Number.isFinite(n) ? n : id
}

export function allergenName(id: number, lang: string = 'it', catalog?: AllergenCatalog): string {
  const o = override(id, catalog)
  if (o?.name) {
    if (lang !== 'it') return o.i18n?.[lang as AllergenLang] || o.name
    return o.name
  }
  if (lang !== 'it') {
    const entry = ALLERGEN_I18N[lang as AllergenLang]?.[id - 1]
    if (entry) return entry.name
  }
  return ALLERGENS.find(a => a.id === id)?.name ?? `Allergene ${id}`
}

export function allergenShort(id: number, lang: string = 'it', catalog?: AllergenCatalog): string {
  if (override(id, catalog)?.name) return allergenName(id, lang, catalog)
  if (lang !== 'it') {
    const entry = ALLERGEN_I18N[lang as AllergenLang]?.[id - 1]
    if (entry) return entry.short
  }
  return ALLERGENS.find(a => a.id === id)?.short ?? String(id)
}

/** Elenco completo (per form, legende, Excel) ordinato per numero mostrato. */
export function allergenList(catalog?: AllergenCatalog): { id: number; number: number; name: string; defaultName: string }[] {
  return ALLERGENS
    .map(a => ({ id: a.id, number: allergenNumber(a.id, catalog), name: allergenName(a.id, 'it', catalog), defaultName: a.name }))
    .sort((x, y) => x.number - y.number)
}

/** Da numero mostrato a id ufficiale (import Excel). null se non esiste. */
export function allergenIdFromNumber(n: number, catalog?: AllergenCatalog): number | null {
  return ALLERGENS.find(a => allergenNumber(a.id, catalog) === n)?.id ?? null
}

// ── Parsing difensivo ───────────────────────────────────────────────────────────
// Gli allergeni possono arrivare come numeri (number[]), stringhe ("Allergene 1",
// "1") o oggetti ({ id, name }). Normalizziamo sempre a un id numerico.

type AllergenInput = number | string | { id?: number | string; name?: string } | null | undefined

function toAllergenId(a: AllergenInput): number | null {
  if (a == null) return null
  if (typeof a === 'number') return Number.isFinite(a) ? a : null
  if (typeof a === 'string') {
    const m = a.match(/\d+/)            // estrae il primo numero ("Allergene 1" → 1)
    return m ? parseInt(m[0], 10) : null
  }
  if (typeof a === 'object' && a.id != null) return toAllergenId(a.id)
  return null
}

function toIds(allergens: unknown): number[] {
  if (!Array.isArray(allergens)) return []
  return allergens
    .map(a => toAllergenId(a as AllergenInput))
    .filter((n): n is number => n != null)
}

/** Vista sintetica (testo sopra il PDF / lista) → solo numeri: "1, 3, 5". */
export function formatAllergensShort(allergens: unknown, catalog?: AllergenCatalog): string {
  return toIds(allergens).map(id => allergenNumber(id, catalog)).sort((a, b) => a - b).join(', ')
}

/** Vista dettaglio (modale) → nomi completi: "Cereali e glutine, Uova". */
export function formatAllergensFull(allergens: unknown, catalog?: AllergenCatalog): string {
  return toIds(allergens).map(id => allergenName(id, 'it', catalog)).join(', ')
}

export type AllergenDisplay = 'full' | 'short' | 'number'

/**
 * Configurable formatter used by the menu/card allergens controls.
 *   full   → "Cereali e glutine, Uova"
 *   short  → "Glutine, Uova"
 *   number → "1, 3"
 * `separator` is inserted between entries (default ", ").
 */
export function formatAllergens(
  allergens: unknown,
  display: AllergenDisplay = 'full',
  separator = ', ',
  lang: string = 'it',
  catalog?: AllergenCatalog,
): string {
  const ids = toIds(allergens).sort((a, b) => allergenNumber(a, catalog) - allergenNumber(b, catalog))
  const render =
    display === 'number' ? (id: number) => String(allergenNumber(id, catalog))
    : display === 'short' ? (id: number) => allergenShort(id, lang, catalog)
    : (id: number) => allergenName(id, lang, catalog)
  return ids.map(render).join(separator)
}
