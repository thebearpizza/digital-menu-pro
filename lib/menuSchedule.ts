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

export function isMenuOpenNow(m: MenuScheduleFields, now: string = romeTimeHHMM()): boolean {
  if (!m.schedule_enabled || !m.schedule_from || !m.schedule_until) return true
  const from  = hhmm(m.schedule_from)
  const until = hhmm(m.schedule_until)
  if (from === until) return true
  return from < until
    ? now >= from && now < until
    : now >= from || now < until // fascia a cavallo di mezzanotte
}

export function scheduleLabel(m: MenuScheduleFields): string | null {
  if (!m.schedule_enabled || !m.schedule_from || !m.schedule_until) return null
  return `${hhmm(m.schedule_from)}–${hhmm(m.schedule_until)}`
}
