export const ALLERGENS = [
  { id: 1,  name: 'Cereali e glutine' },
  { id: 2,  name: 'Crostacei' },
  { id: 3,  name: 'Uova' },
  { id: 4,  name: 'Pesce' },
  { id: 5,  name: 'Arachidi' },
  { id: 6,  name: 'Soia' },
  { id: 7,  name: 'Latte e latticini' },
  { id: 8,  name: 'Frutta a guscio' },
  { id: 9,  name: 'Sedano' },
  { id: 10, name: 'Senape' },
  { id: 11, name: 'Semi di sesamo' },
  { id: 12, name: 'Anidride solforosa e solfiti' },
  { id: 13, name: 'Lupini' },
  { id: 14, name: 'Molluschi' },
] as const

export function allergenName(id: number): string {
  return ALLERGENS.find(a => a.id === id)?.name ?? `Allergene ${id}`
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
export function formatAllergensShort(allergens: unknown): string {
  return toIds(allergens).join(', ')
}

/** Vista dettaglio (modale) → nomi completi: "Cereali e glutine, Uova". */
export function formatAllergensFull(allergens: unknown): string {
  return toIds(allergens).map(allergenName).join(', ')
}
