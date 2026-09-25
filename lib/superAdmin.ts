// ─────────────────────────────────────────────────────────────────────────────
// Account padre (super admin) — unico abilitato a creare/modificare/eliminare
// gli account del gestionale.
//
// La registrazione pubblica è stata rimossa dal login: gli account vengono
// forniti a mano dall'account padre tramite la tab "Utenti".
//
// L'identificazione avviene SEMPRE lato server sull'email della sessione
// Supabase (auth.getUser()), che è firmata e non falsificabile dal client.
// Non basarsi mai su un valore passato dal browser.
//
// L'email è sovrascrivibile via SUPER_ADMIN_EMAIL per non doverla modificare
// nel codice se un domani cambia il titolare.
// ─────────────────────────────────────────────────────────────────────────────

export const SUPER_ADMIN_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL ?? 'impresefc@gmail.com'
).trim().toLowerCase()

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL
}
