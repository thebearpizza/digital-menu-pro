// ── Programmazione oraria dei menu ───────────────────────────────────────────
// Un menu con schedule_enabled è visibile al pubblico solo nella fascia
// schedule_from–schedule_until (ora italiana). Le fasce a cavallo di
// mezzanotte (es. 22:00–02:00) sono supportate. is_active resta
// l'interruttore manuale: un menu disattivato non appare mai.

export interface MenuScheduleFields {
  schedule_enabled: boolean | null
  schedule_from:    string | null // 'HH:MM' o 'HH:MM:SS' (colonna time)
  schedule_until:   string | null
}

/** Ora corrente italiana in formato 'HH:MM' (confrontabile come stringa). */
export function romeTimeHHMM(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

const hhmm = (t: string) => t.slice(0, 5)

// Nucleo condiviso della finestra oraria: usato da menu, categorie e piatti.
export function isWindowOpenNow(
  enabled: boolean | null | undefined,
  fromRaw: string | null | undefined,
  untilRaw: string | null | undefined,
  now: string = romeTimeHHMM(),
): boolean {
  if (!enabled || !fromRaw || !untilRaw) return true
  const from  = hhmm(fromRaw)
  const until = hhmm(untilRaw)
  if (from === until) return true
  return from < until
    ? now >= from && now < until
    : now >= from || now < until // fascia a cavallo di mezzanotte
}

export function isMenuOpenNow(m: MenuScheduleFields, now: string = romeTimeHHMM()): boolean {
  return isWindowOpenNow(m.schedule_enabled, m.schedule_from, m.schedule_until, now)
}

export function scheduleLabel(m: MenuScheduleFields): string | null {
  if (!m.schedule_enabled || !m.schedule_from || !m.schedule_until) return null
  return `${hhmm(m.schedule_from)}–${hhmm(m.schedule_until)}`
}

// ── Programmazione oraria di CATEGORIE (per menu) e PIATTI ───────────────────
// Le categorie sono virtuali (stringa sul piatto): la loro programmazione vive
// in menus.category_schedules (JSONB { nome: { enabled, from, until } }).
// I piatti hanno le stesse colonne schedule_* dei menu.

export interface CategorySchedule {
  enabled?: boolean | null
  from?:    string | null
  until?:   string | null
}
export type CategorySchedules = Record<string, CategorySchedule>

export function isCategoryOpenNow(
  cs: CategorySchedule | undefined | null,
  now: string = romeTimeHHMM(),
): boolean {
  if (!cs) return true
  return isWindowOpenNow(cs.enabled, cs.from, cs.until, now)
}

/** Etichetta "HH:MM–HH:MM" per badge admin; null se programmazione spenta. */
export function windowLabel(
  enabled: boolean | null | undefined,
  from: string | null | undefined,
  until: string | null | undefined,
): string | null {
  if (!enabled || !from || !until) return null
  return `${hhmm(from)}–${hhmm(until)}`
}
