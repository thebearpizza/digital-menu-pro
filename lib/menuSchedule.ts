// ── Programmazione dei menu, delle categorie e dei piatti ─────────────────────
// Un elemento con schedule_enabled è visibile al pubblico solo nei giorni
// scelti (schedule_days: 1 = lunedì … 7 = domenica; vuoto = tutti) e, se c'è,
// nella fascia schedule_from–schedule_until (ora italiana). Senza fascia vale
// tutto il giorno. Le fasce a cavallo di mezzanotte (es. 22:00–02:00) sono
// supportate: la parte dopo mezzanotte appartiene al giorno in cui la fascia
// è iniziata. is_active resta l'interruttore manuale: un elemento disattivato
// non appare mai.

export interface MenuScheduleFields {
  schedule_enabled: boolean | null
  schedule_from:    string | null // 'HH:MM' o 'HH:MM:SS' (colonna time)
  schedule_until:   string | null
  schedule_days?:   number[] | null
}

/** Ora corrente italiana in formato 'HH:MM' (confrontabile come stringa). */
export function romeTimeHHMM(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
/** Giorno della settimana italiano: 1 = lunedì … 7 = domenica. */
export function romeWeekday(date: Date = new Date()): number {
  return WEEKDAY[new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', weekday: 'short' }).format(date)] ?? 1
}

/** Adesso, in Italia: ora e giorno della settimana. */
export interface RomeNow { time: string; day: number }
export const romeNow = (date: Date = new Date()): RomeNow => ({ time: romeTimeHHMM(date), day: romeWeekday(date) })

const hhmm = (t: string) => t.slice(0, 5)

/** Giorni validi, ordinati e senza doppioni; null = tutti i giorni. */
export function cleanDays(days: unknown): number[] | null {
  if (!Array.isArray(days)) return null
  const out = Array.from(new Set(days.map(Number).filter(d => Number.isInteger(d) && d >= 1 && d <= 7))).sort((a, b) => a - b)
  return out.length && out.length < 7 ? out : null
}

// Nucleo condiviso: usato da menu, categorie e piatti. `now` può essere solo
// l'ora (come prima) o ora e giorno.
export function isWindowOpenNow(
  enabled: boolean | null | undefined,
  fromRaw: string | null | undefined,
  untilRaw: string | null | undefined,
  now: string | RomeNow = romeNow(),
  daysRaw?: number[] | null,
): boolean {
  if (!enabled) return true
  const at = typeof now === 'string' ? { time: now, day: romeWeekday() } : now
  const days = cleanDays(daysRaw)
  const onDay = (d: number) => !days || days.includes(d)
  const hours = !!fromRaw && !!untilRaw && hhmm(fromRaw) !== hhmm(untilRaw)
  if (!hours) return onDay(at.day)
  const from = hhmm(fromRaw!), until = hhmm(untilRaw!)
  if (from < until) return at.time >= from && at.time < until && onDay(at.day)
  // Fascia a cavallo di mezzanotte: prima di mezzanotte vale il giorno di
  // oggi, dopo quello di ieri (in cui la fascia è iniziata).
  if (at.time >= from) return onDay(at.day)
  if (at.time < until) return onDay(at.day === 1 ? 7 : at.day - 1)
  return false
}

export function isMenuOpenNow(m: MenuScheduleFields, now: string | RomeNow = romeNow()): boolean {
  return isWindowOpenNow(m.schedule_enabled, m.schedule_from, m.schedule_until, now, m.schedule_days)
}

/** Orario mostrato ai clienti sul pulsante del menu (solo la fascia: il
 *  menu è a vista, quindi oggi è uno dei suoi giorni). */
export function scheduleLabel(m: MenuScheduleFields): string | null {
  if (!m.schedule_enabled || !m.schedule_from || !m.schedule_until) return null
  return `${hhmm(m.schedule_from)}–${hhmm(m.schedule_until)}`
}

// ── CATEGORIE (per menu) e PIATTI ───────────────────────────────────────────
// Le categorie sono virtuali (stringa sul piatto): la loro programmazione vive
// in menus.category_schedules (JSONB { nome: { enabled, from, until, days } }).
// I piatti hanno le stesse colonne schedule_* dei menu.

export interface CategorySchedule {
  enabled?: boolean | null
  from?:    string | null
  until?:   string | null
  days?:    number[] | null
}
export type CategorySchedules = Record<string, CategorySchedule>

export function isCategoryOpenNow(
  cs: CategorySchedule | undefined | null,
  now: string | RomeNow = romeNow(),
): boolean {
  if (!cs) return true
  return isWindowOpenNow(cs.enabled, cs.from, cs.until, now, cs.days)
}

const DAY_SHORT = ['', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
/** "Lun–Ven", "Sab, Dom", "Lun, Mer–Ven": giorni consecutivi raggruppati. */
export function daysLabel(daysRaw: number[] | null | undefined): string | null {
  const days = cleanDays(daysRaw)
  if (!days) return null
  const parts: string[] = []
  for (let i = 0; i < days.length; i++) {
    let j = i
    while (j + 1 < days.length && days[j + 1] === days[j] + 1) j++
    parts.push(j - i >= 2 ? `${DAY_SHORT[days[i]]}–${DAY_SHORT[days[j]]}` : days.slice(i, j + 1).map(d => DAY_SHORT[d]).join(', '))
    i = j
  }
  return parts.join(', ')
}

/** Etichetta per i badge del gestionale ("Sab, Dom · 19:00–23:00",
 *  "12:00–15:00", "Lun–Ven"); null se programmazione spenta. */
export function windowLabel(
  enabled: boolean | null | undefined,
  from: string | null | undefined,
  until: string | null | undefined,
  days?: number[] | null,
): string | null {
  if (!enabled) return null
  const d = daysLabel(days)
  const h = from && until && hhmm(from) !== hhmm(until) ? `${hhmm(from)}–${hhmm(until)}` : null
  if (!d && !h) return null
  return [d, h].filter(Boolean).join(' · ')
}
