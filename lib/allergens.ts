// Lista degli allergeni in ordine UE standard.
// L'indice 1-based corrisponde al numero ufficiale dell'allergene.
// Mantenere allineato a DishForm.tsx (ALLERGENS_LIST).
export const ALLERGENS_EU = [
  'Glutine',
  'Crostacei',
  'Uova',
  'Pesce',
  'Arachidi',
  'Soia',
  'Latte',
  'Frutta a guscio',
  'Sedano',
  'Senape',
  'Sesamo',
  'Anidride solforosa',
  'Lupini',
  'Molluschi',
] as const

export function allergenNumber(name: string): number | null {
  const idx = ALLERGENS_EU.findIndex(
    (a) => a.toLowerCase() === name.trim().toLowerCase()
  )
  return idx >= 0 ? idx + 1 : null
}

export function allergenNumbers(names: string[] | null | undefined): number[] {
  if (!names || names.length === 0) return []
  return names
    .map(allergenNumber)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b)
}
