// ─────────────────────────────────────────────────────────────────────────────
// Lingue del prototipo. I testi del ristoratore (piatti, categorie, nome del
// menu) usano le traduzioni già salvate dal gestionale (lib/translations, con
// ritorno all'italiano se manca qualcosa); le parole dell'interfaccia stanno
// qui sotto.
// ─────────────────────────────────────────────────────────────────────────────

import { allergenName, type AllergenCatalog } from '@/lib/allergens'
import {
  categoryName, dishDescription, dishName, menuName,
  type DishTranslations, type Lang, type MenuTranslations,
} from '@/lib/translations'
import type { Dish, MenuData } from './typeset'

export interface I18nData {
  /** Traduzioni del menu aperto (nome e categorie). */
  menu:      MenuTranslations
  /** Traduzioni dei piatti (anche quelli abbinati da altri menu), per id. */
  dishes:    Record<string, DishTranslations>
  /** Piatti abbinati da altri menu: traduzioni del LORO menu (categoria). */
  pairMenus: Record<string, MenuTranslations>
  catalog:   AllergenCatalog
}

export interface MenuChoice { id: string; name: string; translations: MenuTranslations }

const UI = {
  menu:        { it: 'Menu',                    en: 'Menu',                fr: 'Menu',               de: 'Menü',                   es: 'Menú' },
  chooseMenu:  { it: 'Scegli il menu',          en: 'Choose a menu',       fr: 'Choisir un menu',    de: 'Menü wählen',            es: 'Elige un menú' },
  language:    { it: 'Lingua',                  en: 'Language',            fr: 'Langue',             de: 'Sprache',                es: 'Idioma' },
  categories:  { it: 'Categorie',               en: 'Categories',          fr: 'Catégories',         de: 'Kategorien',             es: 'Categorías' },
  description: { it: 'Descrizione',             en: 'Description',         fr: 'Description',        de: 'Beschreibung',           es: 'Descripción' },
  allergens:   { it: 'Allergeni',               en: 'Allergens',           fr: 'Allergènes',         de: 'Allergene',              es: 'Alérgenos' },
  price:       { it: 'Prezzo',                  en: 'Price',               fr: 'Prix',               de: 'Preis',                  es: 'Precio' },
  pairing:     { it: 'Abbinamento consigliato', en: 'Recommended pairing', fr: 'Accord conseillé',   de: 'Empfohlene Kombination', es: 'Maridaje recomendado' },
  moreIn:      { it: 'Altro in',                en: 'More in',             fr: 'Aussi dans',         de: 'Mehr in',                es: 'Más en' },
  close:       { it: 'Chiudi',                  en: 'Close',               fr: 'Fermer',             de: 'Schließen',              es: 'Cerrar' },
  back:        { it: 'Indietro',                en: 'Back',                fr: 'Retour',             de: 'Zurück',                 es: 'Atrás' },
  cont:        { it: 'segue',                   en: 'continued',           fr: 'suite',              de: 'Fortsetzung',            es: 'continúa' },
} satisfies Record<string, Record<Lang, string>>

export type UIKey = keyof typeof UI
export const t = (key: UIKey, lang: Lang): string => UI[key][lang] ?? UI[key].it

/** Il menu nella lingua scelta (l'italiano è la base). */
export function localize(base: MenuData, i18n: I18nData, lang: Lang): MenuData {
  const labels = { allergens: t('allergens', lang), cont: t('cont', lang) }
  if (lang === 'it') return { ...base, labels }
  const dish = (d: Dish, menuTr: MenuTranslations | null): Dish => ({
    ...d,
    name:        dishName(d.name, i18n.dishes[d.id], lang),
    description: dishDescription(d.description, i18n.dishes[d.id], lang),
    category:    categoryName(d.category, menuTr, lang),
    allergens:   d.allergens.map(a => ({ ...a, name: allergenName(a.id, lang, i18n.catalog) })),
    // L'etichetta personalizzata dell'abbinamento è scritta in italiano: nelle
    // altre lingue vale quella standard.
    pairing:     d.pairing ? { label: null, dish: dish(d.pairing.dish, i18n.pairMenus[d.pairing.dish.id] ?? null) } : null,
  })
  return {
    ...base,
    labels,
    menuName:   menuName(base.menuName, i18n.menu, lang),
    categories: base.categories.map(c => ({
      name:   categoryName(c.name, i18n.menu, lang),
      dishes: c.dishes.map(d => dish(d, i18n.menu)),
    })),
  }
}
