// ─────────────────────────────────────────────────────────────────────────────
// Assistente AI dell'admin — stesso interprete Gemini del bot Telegram,
// ma autenticato con la sessione Supabase dell'utente loggato.
//
// POST { text }            → { reply, confirm? }   confirm = intent distruttivo
// POST { confirmedIntent } → { reply }             esegue dopo conferma in UI
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSb } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import {
  aiEnabled, loadContext, interpret, execute, describeIntent,
  CONFIRM_ACTIONS, Intent,
} from '@/app/api/telegram/ai'

export const dynamic = 'force-dynamic'

const UI_HELP = `Posso gestire tutto il menu: prezzi, piatti (creare, modificare, eliminare), categorie, menu, attivazioni e programmazione oraria. Dimmi cosa fare, ad esempio: "metti la carbonara a 12,50" o "aggiungi il tiramisù a 6 euro nei dolci".`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  if (!aiEnabled()) {
    return NextResponse.json({ reply: 'Assistente AI non configurato (manca GEMINI_API_KEY).' })
  }

  let body: any
  try { body = await req.json() } catch { body = {} }

  // Service role per le scritture; il perimetro è comunque l'owner loggato,
  // perché loadContext carica solo i suoi ristoranti e ogni azione risolve
  // i nomi dentro quel contesto.
  const sb = createSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const ctx = await loadContext(sb, user.id)

  try {
    // Esecuzione di un intent già confermato dall'utente nella UI
    if (body.confirmedIntent?.action) {
      const reply = await execute(sb, ctx, body.confirmedIntent as Intent)
      return NextResponse.json({ reply })
    }

    const text = String(body.text ?? '').trim()
    if (!text) return NextResponse.json({ reply: UI_HELP })

    const intent = await interpret(text, ctx)

    if (CONFIRM_ACTIONS.has(intent.action)) {
      return NextResponse.json({
        reply: `⚠️ Sto per ${describeIntent(ctx, intent)}. Confermi?`,
        confirm: intent,
      })
    }

    const reply = await execute(sb, ctx, intent)
    return NextResponse.json({ reply: reply || UI_HELP })
  } catch (e: any) {
    console.error('Assistant error', e?.message)
    return NextResponse.json({
      reply: 'L\'interprete AI è momentaneamente sovraccarico 🤯 Riprova tra qualche istante.',
    })
  }
}
