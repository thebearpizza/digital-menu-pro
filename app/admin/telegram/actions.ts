'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** Genera un codice di abbinamento monouso (valido 15 minuti) da inviare
 *  al bot Telegram con /collega CODICE. */
export async function generatePairingCode(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  // 6 caratteri alfanumerici, senza ambigui (0/O, 1/I)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')

  // Pulisce i codici scaduti dell'utente e inserisce il nuovo
  await supabase.from('telegram_pairing_codes').delete().eq('user_id', user.id)
  const { error } = await supabase.from('telegram_pairing_codes').insert({
    code,
    user_id: user.id,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/telegram')
  return code
}

export async function unlinkChat(chatId: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')
  const { error } = await supabase
    .from('telegram_links').delete().eq('chat_id', chatId).eq('user_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/telegram')
}
