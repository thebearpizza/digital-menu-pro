'use client'

import { createContext, useContext } from 'react'
import type { AllergenCatalog } from '@/lib/allergens'

// Lista allergeni personalizzata dell'account (nomi/numeri), disponibile a tutti
// i componenti sotto il provider. Senza provider: allergeni UE standard.
const Ctx = createContext<AllergenCatalog>(null)

export function AllergenCatalogProvider({ catalog, children }: { catalog: AllergenCatalog; children: React.ReactNode }) {
  return <Ctx.Provider value={catalog}>{children}</Ctx.Provider>
}

export function useAllergenCatalog(): AllergenCatalog {
  return useContext(Ctx)
}
