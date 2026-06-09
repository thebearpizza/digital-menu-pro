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

export function allergenName(id: number): string {
  return ALLERGENS.find(a => a.id === id)?.name ?? `Allergene ${id}`
}

export function allergenShort(id: number): string {
  return ALLERGENS.find(a => a.id === id)?.short ?? String(id)
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
): string {
  const ids = toIds(allergens)
  const render =
    display === 'number' ? (id: number) => String(id)
    : display === 'short' ? allergenShort
    : allergenName
  return ids.map(render).join(separator)
}
