import { createClient } from '@/lib/supabase/server'
import TelegramClient from './TelegramClient'

export default async function TelegramPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: links } = await supabase
    .from('telegram_links')
    .select('chat_id, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: true })

  return (
    <TelegramClient
      links={(links ?? []).map(l => ({
        chat_id:    Number(l.chat_id),
        created_at: l.created_at as string,
      }))}
    />
  )
}
