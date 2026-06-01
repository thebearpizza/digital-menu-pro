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
