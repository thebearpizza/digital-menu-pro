'use server'
// ─────────────────────────────────────────────────────────────────────────────
// Gestione account — riservata all'account padre (vedi lib/superAdmin.ts).
//
// Sicurezza: ogni azione ri-verifica il super admin lato server leggendo la
// sessione Supabase. Il controllo NON è mai delegato al client: nascondere la
// tab nella UI è solo cosmetico, la guardia vera è qui.
//
// Le operazioni sugli account richiedono la service role (Admin API di
// Supabase Auth), che bypassa la RLS: per questo la guardia precede sempre la
// creazione del client amministrativo.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { createClient as createSb } from '@supabase/supabase-js'
import { isSuperAdmin, SUPER_ADMIN_EMAIL } from '@/lib/superAdmin'
import { revalidatePath } from 'next/cache'

export interface ManagedUser {
  id:           string
  email:        string
  createdAt:    string
  lastSignInAt: string | null
  restaurants:  number
  isSuperAdmin: boolean
}

/** Verifica che chi chiama sia l'account padre. Lancia se non lo è. */
async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sessione scaduta. Rieffettua il login.')
  if (!isSuperAdmin(user.email)) throw new Error('Non autorizzato.')
  return user
}

/** Client con service role: necessario per l'Admin API di Supabase Auth. */
function adminClient() {
  return createSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/** Elenco account + numero di ristoranti posseduti da ciascuno. */
export async function listUsers(): Promise<ManagedUser[]> {
  await requireSuperAdmin()
  const sb = adminClient()

  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw new Error(error.message)

  const { data: rests } = await sb.from('restaurants').select('owner_id')
  const counts = new Map<string, number>()
  for (const r of rests ?? []) {
    const k = (r as any).owner_id as string
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }

  return data.users.map(u => ({
    id:           u.id,
    email:        u.email ?? '',
    createdAt:    u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
    restaurants:  counts.get(u.id) ?? 0,
    isSuperAdmin: isSuperAdmin(u.email),
  })).sort((a, b) => a.email.localeCompare(b.email))
}

/**
 * Crea un account già attivo (email_confirm: true): gli account vengono
 * consegnati a mano, non c'è un flusso di conferma via email da attendere.
 */
export async function createUserAccount(
  email: string, password: string,
): Promise<{ error?: string }> {
  await requireSuperAdmin()

  const mail = email.trim().toLowerCase()
  if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return { error: 'Email non valida.' }
  if (password.length < 8) return { error: 'La password deve avere almeno 8 caratteri.' }

  const sb = adminClient()
  const { data, error } = await sb.auth.admin.createUser({
    email: mail,
    password,
    email_confirm: true,
  })
  if (error) return { error: error.message }

  // Rete di sicurezza: il profilo è creato dal trigger on_auth_user_created,
  // ma restaurants.owner_id ha una FK verso profiles — senza quella riga
  // l'account non potrebbe creare ristoranti. Se il trigger fallisse, qui
  // ce ne accorgiamo subito invece che al primo salvataggio del ristoratore.
  if (data.user) {
    await sb.from('profiles')
      .upsert({ id: data.user.id, email: mail }, { onConflict: 'id' })
  }

  revalidatePath('/admin/users')
  return {}
}

/** Aggiorna email e/o password di un account. Campi vuoti = invariati. */
export async function updateUserAccount(
  userId: string, patch: { email?: string; password?: string },
): Promise<{ error?: string }> {
  await requireSuperAdmin()

  const body: { email?: string; password?: string } = {}

  if (patch.email !== undefined && patch.email.trim()) {
    const mail = patch.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return { error: 'Email non valida.' }
    body.email = mail
  }
  if (patch.password !== undefined && patch.password.trim()) {
    if (patch.password.length < 8) return { error: 'La password deve avere almeno 8 caratteri.' }
    body.password = patch.password
  }
  if (!body.email && !body.password) return { error: 'Nessuna modifica da salvare.' }

  const sb = adminClient()

  // L'account padre è identificato dall'email: cambiargliela lo taglierebbe
  // fuori dalla gestione utenti, lasciando il sistema senza amministratore.
  const { data: target } = await sb.auth.admin.getUserById(userId)
  if (target?.user && isSuperAdmin(target.user.email) && body.email) {
    return { error: `L'email dell'account padre (${SUPER_ADMIN_EMAIL}) non può essere modificata da qui: perderesti l'accesso alla gestione utenti.` }
  }

  const { error } = await sb.auth.admin.updateUserById(userId, body)
  if (error) return { error: error.message }

  if (body.email) {
    await sb.from('profiles').update({ email: body.email }).eq('id', userId)
  }

  revalidatePath('/admin/users')
  return {}
}

/**
 * Elimina un account.
 *
 * ATTENZIONE: la catena di vincoli è
 *   auth.users → profiles → restaurants → menus/dishes, tutta ON DELETE CASCADE.
 * Eliminare un account con ristoranti ne distruggerebbe in silenzio menu e
 * piatti, e i QR CODE GIÀ STAMPATI smetterebbero di funzionare per sempre.
 * Per questo l'eliminazione è bloccata finché l'account possiede ristoranti:
 * vanno prima eliminati (o trasferiti) esplicitamente.
 */
export async function deleteUserAccount(userId: string): Promise<{ error?: string }> {
  const me = await requireSuperAdmin()

  if (userId === me.id) return { error: 'Non puoi eliminare l\'account con cui sei collegato.' }

  const sb = adminClient()

  const { data: target } = await sb.auth.admin.getUserById(userId)
  if (target?.user && isSuperAdmin(target.user.email)) {
    return { error: 'L\'account padre non può essere eliminato.' }
  }

  const { count } = await sb
    .from('restaurants')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)

  if ((count ?? 0) > 0) {
    return {
      error: `Questo account possiede ${count} ristorante/i. Eliminarlo cancellerebbe a cascata i suoi menu e piatti, e i QR code già stampati smetterebbero di funzionare. Elimina o trasferisci prima i ristoranti.`,
    }
  }

  const { error } = await sb.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }

  revalidatePath('/admin/users')
  return {}
}
