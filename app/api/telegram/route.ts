// ─────────────────────────────────────────────────────────────────────────────
// Webhook del bot Telegram — gestione menu via chat.
//
// Comandi (testo, italiano, case-insensitive):
//   /start, /help                          → guida
//   /collega CODICE                        → abbina la chat all'account admin
//   /scollega                              → rimuove l'abbinamento
//   /lista                                 → ristoranti, menu e stato
//   prezzo <piatto> <valore> [menu <m>]    → cambia prezzo
//   attiva|disattiva piatto <nome> [menu <m>]
//   attiva|disattiva categoria <nome> [menu <m>]
//   attiva|disattiva menu <nome>
//   attiva|disattiva ristorante <nome>
//   programma menu <nome> dalle <HH[:MM]> alle <HH[:MM]>
//   rimuovi programmazione menu <nome>
//
// Messaggi vocali: trascritti con Google Speech-to-Text (REST, API key in
// GOOGLE_SPEECH_API_KEY) e poi processati come comandi testuali. L'uso è
// tracciato in voice_usage con tetto mensile sotto il free tier Google.
//
// Sicurezza: header x-telegram-bot-api-secret-token verificato contro
// TELEGRAM_WEBHOOK_SECRET; ogni chat opera solo sui dati dell'account a cui
// è stata abbinata con /collega (codice generato dall'admin loggato).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSb, SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const HELP = `Comandi disponibili:

/collega CODICE — abbina questa chat (genera il codice da Admin → Telegram)
/lista — ristoranti e menu con stato
/scollega — rimuovi abbinamento

prezzo Carbonara 12,50
prezzo Carbonara 12,50 menu Pranzo
attiva piatto Carbonara
disattiva categoria Antipasti
disattiva categoria Antipasti menu Cena
attiva menu Bar
disattiva ristorante Da Mario
programma menu Bar dalle 8 alle 12
rimuovi programmazione menu Bar

🎙 Puoi anche inviare un messaggio vocale con il comando.`

function admin(): SupabaseClient {
  return createSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function reply(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {})
}

// ── Messaggi vocali: Google Speech-to-Text con tetto mensile ─────────────────

// La sync recognize di Google accetta max ~60s di audio; i comandi sono brevi.
const VOICE_MAX_SECONDS = 59
// Free tier Google: 60 min/mese. Blocchiamo a 55 per margine di sicurezza.
const VOICE_MONTHLY_CAP_SECONDS = 55 * 60

/** Secondi di audio già trascritti dal primo del mese corrente (globale). */
async function monthlyVoiceSeconds(sb: SupabaseClient): Promise<number> {
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const { data } = await sb
    .from('voice_usage')
    .select('duration_seconds')
    .gte('created_at', monthStart.toISOString())
  return (data ?? []).reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0)
}

/**
 * Scarica il vocale da Telegram e lo trascrive con Google STT.
 * Ritorna '' se l'audio non contiene parlato riconoscibile; lancia un errore
 * con i dettagli (visibili in chat e nei log Vercel) se un servizio fallisce.
 */
async function transcribeVoice(fileId: string): Promise<string> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const apiKey = process.env.GOOGLE_SPEECH_API_KEY
  if (!botToken || !apiKey) throw new Error('configurazione mancante')

  // 1. file_id → file_path
  const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`)
  const fileJson = await fileRes.json().catch(() => null)
  const filePath: string | undefined = fileJson?.result?.file_path
  if (!filePath) throw new Error(`Telegram getFile fallito: ${fileJson?.description ?? 'risposta vuota'}`)

  // 2. Download dell'audio (i vocali Telegram sono OGG/Opus a 48 kHz)
  const audioRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`)
  if (!audioRes.ok) throw new Error(`download audio fallito (HTTP ${audioRes.status})`)
  const audioBase64 = Buffer.from(await audioRes.arrayBuffer()).toString('base64')

  // 3. Trascrizione
  const sttRes = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      config: {
        encoding: 'OGG_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'it-IT',
      },
      audio: { content: audioBase64 },
    }),
  })
  const sttBody = await sttRes.text().catch(() => '')
  if (!sttRes.ok) {
    console.error('Google STT error', sttRes.status, sttBody)
    let googleMsg: string | null = null
    try { googleMsg = JSON.parse(sttBody)?.error?.message ?? null } catch {}
    throw new Error(`Google STT HTTP ${sttRes.status}${googleMsg ? ` — ${googleMsg}` : ''}`)
  }
  let stt: any = null
  try { stt = JSON.parse(sttBody) } catch {}
  return (stt?.results ?? [])
    .map((r: any) => r?.alternatives?.[0]?.transcript ?? '')
    .join(' ')
    .trim()
}

// ── Lookup helpers (scoped all'owner abbinato) ────────────────────────────────

async function ownerRestaurants(sb: SupabaseClient, userId: string) {
  const { data } = await sb
    .from('restaurants')
    .select('id, name, is_active')
    .eq('owner_id', userId)
  return data ?? []
}

async function ownerMenus(sb: SupabaseClient, restaurantIds: string[]) {
  if (!restaurantIds.length) return []
  const { data } = await sb
    .from('menus')
    .select('id, name, is_active, restaurant_id, schedule_enabled, schedule_from, schedule_until')
    .in('restaurant_id', restaurantIds)
  return data ?? []
}

const norm = (s: string) => s.trim().toLowerCase()

/** Rimuove articoli, preposizioni e parole comuni per parsing elastico */
function stripClutter(text: string): string {
  return text
    .replace(/\b(il|la|lo|i|le|gli|un|una|uno|un'|l'|l|a|di|da|per|dal|della|dello|del|dallo|dalle|dai)\b\s+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Parsa "8", "8.30", "8:30", "08,30" → "HH:MM" oppure null. */
function parseTime(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})(?:[:.,](\d{2}))?$/)
  if (!m) return null
  const h = parseInt(m[1], 10), min = m[2] ? parseInt(m[2], 10) : 0
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function parsePrice(raw: string): number | null {
  const p = parseFloat(raw.replace(',', '.').replace('€', '').trim())
  return isNaN(p) || p < 0 ? null : p
}

// ── Comandi ───────────────────────────────────────────────────────────────────

async function handleCommand(sb: SupabaseClient, chatId: number, userId: string | null, text: string): Promise<string> {
  const t = text.trim()
  const clean = stripClutter(t)

  // /start, /help
  if (/^\/(start|help)\b/i.test(t)) {
    return userId
      ? `Chat collegata. ${HELP}`
      : `Benvenuto! Questa chat non è ancora collegata a un account.\n\nVai su Admin → Telegram, genera un codice e invialo qui con:\n/collega CODICE`
  }

  // /collega CODICE
  const mPair = t.match(/^\/collega\s+(\S+)/i)
  if (mPair) {
    const code = mPair[1].toUpperCase()
    const { data: pc } = await sb
      .from('telegram_pairing_codes')
      .select('user_id, expires_at')
      .eq('code', code)
      .maybeSingle()
    if (!pc || new Date(pc.expires_at) < new Date()) {
      return 'Codice non valido o scaduto. Generane uno nuovo da Admin → Telegram.'
    }
    await sb.from('telegram_links').upsert({ chat_id: chatId, user_id: pc.user_id })
    await sb.from('telegram_pairing_codes').delete().eq('code', code)
    return `Chat collegata con successo ✅\n\n${HELP}`
  }

  if (!userId) {
    return 'Questa chat non è collegata. Genera un codice da Admin → Telegram e invia:\n/collega CODICE'
  }

  // /scollega
  if (/^\/scollega\b/i.test(t)) {
    await sb.from('telegram_links').delete().eq('chat_id', chatId)
    return 'Chat scollegata. Usa /collega CODICE per ricollegarla.'
  }

  const restaurants = await ownerRestaurants(sb, userId)
  if (!restaurants.length) return 'Nessun ristorante trovato sul tuo account.'
  const rIds = restaurants.map(r => r.id)
  const menus = await ownerMenus(sb, rIds)

  // /lista
  if (/^\/lista\b/i.test(t)) {
    return restaurants.map(r => {
      const ms = menus.filter(m => m.restaurant_id === r.id)
      const lines = ms.map(m => {
        const sched = m.schedule_enabled && m.schedule_from && m.schedule_until
          ? ` 🕐 ${String(m.schedule_from).slice(0, 5)}–${String(m.schedule_until).slice(0, 5)}` : ''
        return `   ${m.is_active ? '🟢' : '🔴'} ${m.name}${sched}`
      })
      return `${r.is_active ? '🟢' : '🔴'} ${r.name}\n${lines.join('\n') || '   (nessun menu)'}`
    }).join('\n\n')
  }

  // prezzo <piatto> <valore> [menu <m>]
  const mPrice = clean.match(/^prezzo\s+(.+?)\s+([\d.,]+\s*€?)(?:\s+menu\s+(.+))?$/i)
  if (mPrice) {
    const [, dishName, rawPrice, menuName] = mPrice
    const price = parsePrice(rawPrice)
    if (price === null) return `Prezzo non valido: "${rawPrice}".`
    let scope = menus
    if (menuName) {
      scope = menus.filter(m => norm(m.name) === norm(menuName))
      if (!scope.length) return `Menu "${menuName}" non trovato. Usa /lista per i nomi esatti.`
    }
    const { data: matches } = await sb
      .from('dishes')
      .select('id, name, price, menu_id')
      .in('menu_id', scope.map(m => m.id))
      .ilike('name', dishName.trim())
    if (!matches?.length) return `Nessun piatto "${dishName}" trovato.`
    if (matches.length > 1 && !menuName) {
      const list = matches.map(d => {
        const menu = menus.find(m => m.id === d.menu_id)
        return `• ${d.name} (menu ${menu?.name ?? '?'}) — € ${Number(d.price ?? 0).toFixed(2)}`
      }).join('\n')
      return `Trovati ${matches.length} piatti:\n${list}\n\nSpecifica il menu:\nprezzo ${dishName} ${rawPrice.trim()} menu <nome menu>`
    }
    const ids = matches.map(d => d.id)
    const { error } = await sb.from('dishes').update({ price }).in('id', ids)
    if (error) return `Errore: ${error.message}`
    return `✅ Prezzo di "${matches[0].name}" aggiornato a € ${price.toFixed(2)}${matches.length > 1 ? ` (${matches.length} piatti)` : ''}.`
  }

  // attiva/disattiva <piatto|categoria|menu|ristorante> <nome> [menu <m>]
  const mTog = clean.match(/^(attiva|disattiva)\s+(piatto|categoria|menu|ristorante)\s+(.+?)(?:\s+menu\s+(.+))?$/i)
  if (mTog) {
    const [, verb, kind, name, menuName] = mTog
    const active = norm(verb) === 'attiva'
    const stato = active ? 'attivato 🟢' : 'disattivato 🔴'

    if (norm(kind) === 'ristorante') {
      const r = restaurants.find(x => norm(x.name) === norm(name))
      if (!r) return `Ristorante "${name}" non trovato. Usa /lista.`
      const { error } = await sb.from('restaurants').update({ is_active: active }).eq('id', r.id)
      return error ? `Errore: ${error.message}` : `✅ Ristorante "${r.name}" ${stato}.`
    }

    if (norm(kind) === 'menu') {
      const found = menus.filter(m => norm(m.name) === norm(name))
      if (!found.length) return `Menu "${name}" non trovato. Usa /lista.`
      const { error } = await sb.from('menus').update({ is_active: active }).in('id', found.map(m => m.id))
      return error ? `Errore: ${error.message}` : `✅ Menu "${found[0].name}" ${stato}.`
    }

    let scope = menus
    if (menuName) {
      scope = menus.filter(m => norm(m.name) === norm(menuName))
      if (!scope.length) return `Menu "${menuName}" non trovato. Usa /lista.`
    }

    if (norm(kind) === 'categoria') {
      const { data: upd, error } = await sb
        .from('dishes').update({ is_active: active })
        .in('menu_id', scope.map(m => m.id))
        .ilike('category', name.trim())
        .select('id')
      if (error) return `Errore: ${error.message}`
      if (!upd?.length) return `Nessun piatto nella categoria "${name}".`
      return `✅ Categoria "${name}" ${stato} (${upd.length} piatti).`
    }

    // piatto
    const { data: matches } = await sb
      .from('dishes').select('id, name, menu_id')
      .in('menu_id', scope.map(m => m.id))
      .ilike('name', name.trim())
    if (!matches?.length) return `Nessun piatto "${name}" trovato.`
    if (matches.length > 1 && !menuName) {
      const list = matches.map(d => `• ${d.name} (menu ${menus.find(m => m.id === d.menu_id)?.name ?? '?'})`).join('\n')
      return `Trovati ${matches.length} piatti:\n${list}\n\nSpecifica il menu:\n${verb} piatto ${name} menu <nome menu>`
    }
    const { error } = await sb.from('dishes').update({ is_active: active }).in('id', matches.map(d => d.id))
    return error ? `Errore: ${error.message}` : `✅ Piatto "${matches[0].name}" ${stato}.`
  }

  // programma menu <nome> dalle X alle Y
  const mSched = clean.match(/^programma\s+menu\s+(.+?)\s+dalle\s+(\S+)\s+alle\s+(\S+)$/i)
  if (mSched) {
    const [, name, rawFrom, rawUntil] = mSched
    const from = parseTime(rawFrom), until = parseTime(rawUntil)
    if (!from || !until) return 'Orari non validi. Esempio: programma menu Bar dalle 8 alle 12'
    const found = menus.filter(m => norm(m.name) === norm(name))
    if (!found.length) return `Menu "${name}" non trovato. Usa /lista.`
    const { error } = await sb.from('menus')
      .update({ schedule_enabled: true, schedule_from: from, schedule_until: until })
      .in('id', found.map(m => m.id))
    if (error) return `Errore: ${error.message}`
    return `✅ Menu "${found[0].name}" programmato: visibile dalle ${from} alle ${until}${from > until ? ' (del giorno dopo)' : ''}.`
  }

  // rimuovi programmazione menu <nome>
  const mUnsched = clean.match(/^rimuovi\s+programmazione\s+menu\s+(.+)$/i)
  if (mUnsched) {
    const name = mUnsched[1]
    const found = menus.filter(m => norm(m.name) === norm(name))
    if (!found.length) return `Menu "${name}" non trovato. Usa /lista.`
    const { error } = await sb.from('menus')
      .update({ schedule_enabled: false })
      .in('id', found.map(m => m.id))
    return error ? `Errore: ${error.message}` : `✅ Programmazione rimossa dal menu "${found[0].name}": sempre visibile.`
  }

  return `Non ho capito 🤔\n\n${HELP}`
}

// ── Webhook ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let update: any
  try { update = await req.json() } catch { return NextResponse.json({ ok: true }) }
  const msg = update?.message
  const chatId: number | undefined = msg?.chat?.id
  if (!chatId) return NextResponse.json({ ok: true })

  const sb = admin()
  const { data: link } = await sb
    .from('telegram_links').select('user_id').eq('chat_id', chatId).maybeSingle()
  const userId = link?.user_id ?? null

  // Messaggi vocali → trascrizione → stesso parser dei comandi testuali.
  if (msg.voice) {
    if (!process.env.GOOGLE_SPEECH_API_KEY) {
      await reply(chatId, 'I messaggi vocali non sono configurati: scrivimi il comando in testo (es. "prezzo Carbonara 12,50").')
      return NextResponse.json({ ok: true })
    }
    if (!userId) {
      // Niente trascrizione (e quota) per chat non abbinate.
      await reply(chatId, 'Questa chat non è collegata. Genera un codice da Admin → Telegram e invia:\n/collega CODICE')
      return NextResponse.json({ ok: true })
    }
    const duration: number = msg.voice.duration ?? 0
    if (duration > VOICE_MAX_SECONDS) {
      await reply(chatId, `Vocale troppo lungo (${duration}s): massimo ${VOICE_MAX_SECONDS} secondi. I comandi sono brevi, riprova 🙂`)
      return NextResponse.json({ ok: true })
    }
    const used = await monthlyVoiceSeconds(sb)
    if (used + duration > VOICE_MONTHLY_CAP_SECONDS) {
      await reply(chatId, '⚠️ Limite mensile di trascrizione vocale raggiunto. Usa i comandi testuali (es. "prezzo Carbonara 12,50") fino al mese prossimo.')
      return NextResponse.json({ ok: true })
    }

    try {
      const transcript = await transcribeVoice(msg.voice.file_id)
      // Registra l'uso anche se la trascrizione è vuota: l'audio è stato processato.
      await sb.from('voice_usage').insert({
        chat_id: chatId,
        user_id: userId,
        duration_seconds: Math.max(duration, 1),
      })
      if (!transcript) {
        await reply(chatId, 'Non sono riuscito a capire il vocale 🎙 Riprova parlando chiaramente, o scrivi il comando in testo.')
        return NextResponse.json({ ok: true })
      }
      const answer = await handleCommand(sb, chatId, userId, transcript)
      await reply(chatId, `🎙 Ho capito: «${transcript}»\n\n${answer}`)
    } catch (e: any) {
      await reply(chatId, `Errore nella trascrizione: ${e?.message ?? 'imprevisto'}`)
    }
    return NextResponse.json({ ok: true })
  }

  const text: string | undefined = msg.text
  if (!text) return NextResponse.json({ ok: true })

  try {
    const answer = await handleCommand(sb, chatId, userId, text)
    await reply(chatId, answer)
  } catch (e: any) {
    await reply(chatId, `Errore: ${e?.message ?? 'imprevisto'}`)
  }
  return NextResponse.json({ ok: true })
}
