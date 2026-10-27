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

export interface MenuChoice {
  id:           string
  name:         string
  translations: MenuTranslations
  /** Orario del menu programmato ("12:00–15:30"), se c'è. */
  hours?:       string | null
  /** Colore della carta del menu: la pagina d'apertura sfuma in questo. */
  paper?:       string
}

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
  swipeUp:     { it: 'Scorri in su: categorie, menu e lingua', en: 'Swipe up: categories, menus and language', fr: 'Glissez vers le haut : catégories, menus et langue', de: 'Nach oben wischen: Kategorien, Menüs und Sprache', es: 'Desliza hacia arriba: categorías, menús e idioma' },
  swipeSide:   { it: 'Scorri di lato per sfogliare', en: 'Swipe sideways to turn pages', fr: 'Glissez sur le côté pour tourner les pages', de: 'Zur Seite wischen zum Blättern', es: 'Desliza hacia un lado para pasar página' },
  allergenNote: {
    it: 'Allergeni secondo il Reg. UE 1169/2011. Per qualsiasi informazione il nostro staff è a vostra disposizione.',
    en: 'Allergens according to EU Regulation 1169/2011. Our staff will be happy to help with any question.',
    fr: 'Allergènes selon le règlement UE 1169/2011. Notre personnel est à votre disposition pour toute information.',
    de: 'Allergene gemäß EU-Verordnung 1169/2011. Für Fragen steht Ihnen unser Personal gerne zur Verfügung.',
    es: 'Alérgenos según el Reglamento UE 1169/2011. Nuestro personal está a su disposición para cualquier información.',
  },
  privacy:     { it: 'Informativa privacy',     en: 'Privacy policy',      fr: 'Confidentialité',    de: 'Datenschutz',            es: 'Privacidad' },
  vat:         { it: 'P.IVA',                   en: 'VAT',                 fr: 'TVA',                de: 'USt-IdNr.',              es: 'NIF-IVA' },
  cont:        { it: 'segue',                   en: 'continued',           fr: 'suite',              de: 'Fortsetzung',            es: 'continúa' },
} satisfies Record<string, Record<Lang, string>>

export type UIKey = keyof typeof UI
export const t = (key: UIKey, lang: Lang): string => UI[key][lang] ?? UI[key].it

/** Il menu nella lingua scelta (l'italiano è la base). */
export function localize(base: MenuData, i18n: I18nData, lang: Lang): MenuData {
  const labels = { allergens: t('allergens', lang), cont: t('cont', lang), allergenNote: t('allergenNote', lang) }
  // La legenda segue sempre la lingua (anche in italiano: nomi del catalogo).
  const allergenLegend = base.allergenLegend?.map(a => ({ ...a, name: allergenName(a.id, lang, i18n.catalog) })) ?? null
  if (lang === 'it') return { ...base, labels, allergenLegend }
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
    allergenLegend,
    menuName:   menuName(base.menuName, i18n.menu, lang),
    categories: base.categories.map(c => ({
      name:   categoryName(c.name, i18n.menu, lang),
      dishes: c.dishes.map(d => dish(d, i18n.menu)),
    })),
  }
}
