// ─────────────────────────────────────────────────────────────────────────────
// Testo delle pagine informative scritto nel gestionale → blocchi del menu.
//
// Dal testo del ristoratore si tengono struttura (titoli h1–h3, paragrafi, a
// capo), grassetto, corsivo e allineamento. Caratteri, dimensioni, colori e le
// righe vuote usate per riempire la pagina del vecchio PDF non contano: le
// pagine nuove cambiano misura con lo schermo e hanno la loro tipografia.
// Le righe vuote consecutive diventano un solo spazio.
// ─────────────────────────────────────────────────────────────────────────────

import type { TextBlock, TextRun } from './typeset'

type Align = TextBlock['align']

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : all
    }
    return ENTITIES[code.toLowerCase()] ?? all
  })
}

/** Contenuto di un blocco HTML → pezzi di testo con grassetto/corsivo. */
function runsOf(html: string): TextRun[] {
  const runs: TextRun[] = []
  let bold = 0, italic = 0
  const re = /<(\/?)([a-z0-9]+)[^>]*>|([^<]+)/gi
  let mt: RegExpExecArray | null
  while ((mt = re.exec(html))) {
    if (mt[3] !== undefined) {
      const text = decode(mt[3])
      if (text) runs.push({ text, bold: bold > 0, italic: italic > 0 })
      continue
    }
    const closing = mt[1] === '/', tag = mt[2].toLowerCase()
    if (tag === 'br') { runs.push({ text: '\n' }); continue }
    const d = closing ? -1 : 1
    if (tag === 'strong' || tag === 'b') bold = Math.max(0, bold + d)
    else if (tag === 'em' || tag === 'i') italic = Math.max(0, italic + d)
  }
  return runs
}

function alignOf(attrs: string, fallback: Align): Align {
  const m = /text-align\s*:\s*(left|center|right|justify)/i.exec(attrs)
  if (!m) return fallback
  const a = m[1].toLowerCase()
  return a === 'center' || a === 'right' ? a : 'left'
}

function tidy(blocks: TextBlock[]): TextBlock[] {
  const out: TextBlock[] = []
  for (const b of blocks) {
    const empty = b.kind === 'gap' || !b.runs.some(r => r.text.trim())
    if (empty) {
      if (out.length && out[out.length - 1].kind !== 'gap') out.push({ kind: 'gap', align: 'left', runs: [] })
      continue
    }
    out.push(b)
  }
  while (out.length && out[out.length - 1].kind === 'gap') out.pop()
  return out
}

/** Corpo della pagina (HTML dell'editor o testo semplice) → blocchi. */
export function parseRichText(body: string | null | undefined, fallbackAlign: Align = 'left'): TextBlock[] {
  const src = (body ?? '').trim()
  if (!src) return []
  if (!/<[a-z][^>]*>/i.test(src)) {
    // Testo semplice: una riga = un paragrafo.
    return tidy(src.split(/\r?\n/).map(line => ({ kind: 'p' as const, align: fallbackAlign, runs: [{ text: line }] })))
  }
  const blocks: TextBlock[] = []
  const re = /<(h1|h2|h3|h4|h5|h6|p|li|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi
  let mt: RegExpExecArray | null
  while ((mt = re.exec(src))) {
    const tag = mt[1].toLowerCase()
    const kind: TextBlock['kind'] = tag === 'h1' ? 'h1' : tag === 'h2' ? 'h2' : tag === 'h3' || tag[0] === 'h' ? 'h3' : 'p'
    blocks.push({ kind, align: alignOf(mt[2], fallbackAlign), runs: runsOf(mt[3]) })
  }
  return tidy(blocks)
}
