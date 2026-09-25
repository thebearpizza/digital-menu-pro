import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// Tracking eventi del menu pubblico (apertura menu, click su piatto).
//
// L'endpoint è per forza pubblico: lo chiama chi scansiona il QR, senza login.
// Scrive però con la SERVICE ROLE, quindi bypassa la RLS: prima accettava
// qualunque coppia di id senza verificarle e senza alcun limite di frequenza,
// permettendo a chiunque di gonfiare le statistiche di un ristorante o di far
// crescere la tabella all'infinito.
//
// Due difese, entrambe volutamente economiche (questo endpoint sta sul
// percorso critico dell'apertura del menu e non deve rallentarlo):
//  1. Coerenza: una sola query verifica che il menu appartenga davvero a quel
//     ristorante e che sia pubblicamente visibile. Gli id inventati vengono
//     scartati prima di toccare la tabella eventi.
//  2. Frequenza: finestra scorrevole in memoria per IP.
//     NB: su serverless la memoria è per-istanza e non condivisa, quindi il
//     limite è un argine agli abusi banali, non una garanzia distribuita. Per
//     una soglia rigorosa servirebbe uno store condiviso (es. Redis).
// ─────────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RATE_LIMIT_MAX    = 60          // eventi ammessi…
const RATE_LIMIT_WINDOW = 60_000      // …in questa finestra (ms)
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW)
  recent.push(now)
  hits.set(ip, recent)

  // Potatura opportunistica: evita che la mappa cresca indefinitamente
  // sull'istanza quando cambiano molti IP.
  // forEach anziché for...of: il target TypeScript del progetto non consente
  // di iterare direttamente una Map. Cancellare durante forEach è sicuro.
  if (hits.size > 5_000) {
    hits.forEach((times, key) => {
      if (!times.some(t => now - t < RATE_LIMIT_WINDOW)) hits.delete(key)
    })
  }
  return recent.length > RATE_LIMIT_MAX
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'sconosciuto'

    // Risposta 200 anche quando si supera la soglia: il client è un
    // "fire and forget" che ignora l'esito, e non conviene dare a chi abusa
    // un segnale preciso su dove sia il limite.
    if (rateLimited(ip)) return NextResponse.json({ ok: true })

    const { restaurant_id, menu_id, dish_id, event_type } = await req.json()

    if (
      typeof restaurant_id !== 'string' || !UUID_RE.test(restaurant_id) ||
      typeof menu_id      !== 'string' || !UUID_RE.test(menu_id) ||
      !['menu_open', 'dish_click'].includes(event_type)
    ) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    const dish = typeof dish_id === 'string' && UUID_RE.test(dish_id) ? dish_id : null

    const supabase = await createAdminClient()

    // Il menu deve esistere, appartenere a quel ristorante ed essere
    // pubblicamente visibile: sono le stesse condizioni con cui il menu
    // pubblico lo mostra, quindi ogni evento legittimo le soddisfa già.
    const { data: menu } = await supabase
      .from('menus')
      .select('id')
      .eq('id', menu_id)
      .eq('restaurant_id', restaurant_id)
      .eq('is_active', true)
      .eq('is_public', true)
      .maybeSingle()

    if (!menu) return NextResponse.json({ ok: false }, { status: 400 })

    await supabase.from('menu_events' as any).insert({
      restaurant_id,
      menu_id,
      dish_id: dish,
      event_type,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
