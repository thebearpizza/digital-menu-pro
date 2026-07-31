// ─────────────────────────────────────────────────────────────────────────────
// Nome utente ↔ email interna.
//
// Supabase Auth richiede SEMPRE un'email per il login con password: non è
// possibile autenticarsi con un nome utente puro. Il nome utente viene quindi
// convertito in un'email di servizio (`mario` → `mario@<dominio interno>`),
// che l'utente non vede e non usa mai: digita solo il nome utente.
//
// COMPATIBILITÀ CON GLI ACCOUNT ESISTENTI — requisito inderogabile:
// chi è già registrato con una vera email (impresefc@gmail.com e gli altri)
// continua ad accedere ESATTAMENTE come prima. La regola è semplice: se
// l'utente digita qualcosa che contiene "@", viene usato tal quale come
// email; altrimenti è un nome utente e gli si applica il dominio interno.
// Nessun account esistente viene toccato o convertito.
//
// Il dominio è interno e non riceve posta: gli account creati così non
// possono usare il recupero password via email. È coerente con il flusso
// voluto — le credenziali le consegna a mano l'account padre, che può
// sempre reimpostare la password dalla tab "Utenti".
// ─────────────────────────────────────────────────────────────────────────────

export const USERNAME_DOMAIN = (
  process.env.NEXT_PUBLIC_USERNAME_DOMAIN ?? 'digitalmenupro.local'
).trim().toLowerCase()

/** Caratteri ammessi in un nome utente: lettere, cifre, punto, trattino, underscore. */
const USERNAME_RE = /^[a-z0-9._-]{2,64}$/

export function isValidUsername(value: string): boolean {
  return USERNAME_RE.test(value.trim().toLowerCase())
}

/**
 * Converte ciò che l'utente digita nell'email da passare a Supabase.
 * Con "@" → email reale, invariata (account storici). Senza → nome utente.
 */
export function toLoginEmail(input: string): string {
  const v = input.trim().toLowerCase()
  if (!v) return ''
  if (v.includes('@')) return v
  return `${v}@${USERNAME_DOMAIN}`
}

/**
 * Etichetta da mostrare nell'interfaccia: per gli account a nome utente
 * nasconde il dominio interno, per quelli storici mostra l'email vera.
 */
export function displayUsername(email: string | null | undefined): string {
  if (!email) return ''
  const v = email.trim()
  const suffix = `@${USERNAME_DOMAIN}`
  return v.toLowerCase().endsWith(suffix) ? v.slice(0, -suffix.length) : v
}

/** true se l'account usa un nome utente interno (non una email reale). */
export function isUsernameAccount(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith(`@${USERNAME_DOMAIN}`)
}
