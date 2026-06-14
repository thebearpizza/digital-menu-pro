// ─────────────────────────────────────────────────────────────────────────────
// Traduzioni native del menu — tipi, helper di merge e dizionari statici.
//
// L'italiano è la lingua base (input del ristoratore). Le altre lingue vengono
// pre-generate dal gestionale (Gemini, vedi lib/translateEngine.ts) e salvate
// in dishes.translations / menus.translations (JSONB). Il ristoratore può
// correggere ogni traduzione automatica: i campi corretti vengono marcati in
// `manual` e non vengono mai sovrascritti dalla rigenerazione.
//
// Questo modulo è client-safe: niente API key, solo tipi e lookup.
// ─────────────────────────────────────────────────────────────────────────────

export const BASE_LANG = 'it' as const
export const TARGET_LANGS = ['en', 'fr', 'de', 'es'] as const
export const ALL_LANGS = [BASE_LANG, ...TARGET_LANGS] as const

export type Lang = (typeof ALL_LANGS)[number]
export type TargetLang = (typeof TARGET_LANGS)[number]

export const LANG_FLAGS: Record<Lang, string> = {
  it: 'IT', en: 'EN', fr: 'FR', de: 'DE', es: 'ES',
}
export const LANG_LABELS: Record<Lang, string> = {
  it: 'Italiano', en: 'English', fr: 'Français', de: 'Deutsch', es: 'Español',
}

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (ALL_LANGS as readonly string[]).includes(v)
}

// ── Shape dei JSONB ───────────────────────────────────────────────────────────

export interface DishLangEntry {
  name?:        string
  description?: string | null
  manual?:      { name?: boolean; description?: boolean }
}
export type DishTranslations = Partial<Record<TargetLang, DishLangEntry>>

export interface MenuLangEntry {
  name?:       string
  categories?: Record<string, string>          // chiave = nome categoria italiano
  manual?:     { name?: boolean; categories?: Record<string, boolean> }
}
export type MenuTranslations = Partial<Record<TargetLang, MenuLangEntry>>

export interface HintLangEntry {
  title?:    string
  text?:     string
  // Testo italiano sorgente della traduzione automatica: se non combacia più
  // col tema corrente la traduzione è stantia → fallback all'italiano.
  srcTitle?: string
  srcText?:  string
  manual?:   { title?: boolean; text?: boolean }
}
export type HintTranslations = Partial<Record<TargetLang, HintLangEntry>>

// ── Lookup con fallback all'italiano ─────────────────────────────────────────

export function dishName(name: string, tr: DishTranslations | null | undefined, lang: Lang): string {
  if (lang === 'it') return name
  return tr?.[lang]?.name?.trim() || name
}

export function dishDescription(
  description: string | null, tr: DishTranslations | null | undefined, lang: Lang,
): string | null {
  if (lang === 'it' || !description) return description
  const t = tr?.[lang]?.description
  return (typeof t === 'string' && t.trim()) ? t : description
}

export function categoryName(
  itName: string, tr: MenuTranslations | null | undefined, lang: Lang,
): string {
  if (lang === 'it') return itName
  return tr?.[lang]?.categories?.[itName]?.trim() || itName
}

export function menuName(name: string, tr: MenuTranslations | null | undefined, lang: Lang): string {
  if (lang === 'it') return name
  return tr?.[lang]?.name?.trim() || name
}

// Pop-up "come sfogliare il menu": testo libero. La traduzione vale solo se è
// stata generata dal testo italiano ATTUALE (srcTitle/srcText combaciano),
// altrimenti il ristoratore ha modificato il testo IT senza rigenerare → IT.
export function hintTitle(itTitle: string, tr: HintTranslations | null | undefined, lang: Lang): string {
  if (lang === 'it') return itTitle
  const e = tr?.[lang]
  if (e?.title?.trim() && (e.manual?.title || e.srcTitle === itTitle)) return e.title
  return itTitle
}

export function hintText(itText: string, tr: HintTranslations | null | undefined, lang: Lang): string {
  if (lang === 'it') return itText
  const e = tr?.[lang]
  if (e?.text?.trim() && (e.manual?.text || e.srcText === itText)) return e.text
  return itText
}

// ── Stringhe UI del menu pubblico ─────────────────────────────────────────────

const UI = {
  allergens:    { it: 'Allergeni',               en: 'Allergens',              fr: 'Allergènes',             de: 'Allergene',              es: 'Alérgenos' },
  pairing:      { it: 'Abbinamento consigliato', en: 'Recommended pairing',    fr: 'Accord conseillé',       de: 'Empfohlene Kombination', es: 'Maridaje recomendado' },
  loading:      { it: 'Caricamento…',            en: 'Loading…',               fr: 'Chargement…',            de: 'Wird geladen…',          es: 'Cargando…' },
  preparing:    { it: 'Preparazione menu…',      en: 'Preparing menu…',        fr: 'Préparation du menu…',   de: 'Menü wird vorbereitet…', es: 'Preparando el menú…' },
  backToMenu:   { it: '← Menù',                  en: '← Menu',                 fr: '← Menu',                 de: '← Menü',                 es: '← Menú' },
  browseMenu:   { it: 'Sfoglia il menu',         en: 'Browse the menu',        fr: 'Feuilleter le menu',     de: 'Menü durchblättern',     es: 'Hojear el menú' },
} satisfies Record<string, Record<Lang, string>>

export type UIKey = keyof typeof UI

export function uiText(key: UIKey, lang: Lang): string {
  return UI[key][lang] ?? UI[key].it
}
