import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/** Il ristorante di questo QR usa il nuovo menu (restaurants.new_menu)?
 *  Una sola lettura per richiesta (metadati e pagina la condividono). */
export const usesNewMenu = cache(async (token: string): Promise<boolean> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('restaurants').select('new_menu')
    .eq('qr_public_token', token).eq('is_active', true)
    .maybeSingle()
  return (data as { new_menu?: boolean } | null)?.new_menu === true
})
