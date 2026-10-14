import { NextRequest, NextResponse } from 'next/server'

// Proxy di Google Fonts: il browser del cliente chiede il CSS al NOSTRO dominio,
// noi lo prendiamo da Google e riscriviamo gli URL dei file font verso
// /api/gfonts/file/… — così l'IP del cliente non arriva mai a Google
// (privacy: niente trasferimento a terzi). Le risposte sono messe in cache
// dalla CDN di Vercel, quindi Google viene contattato raramente.

// UA moderno: Google sceglie il formato in base allo User-Agent → woff2.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export async function GET(req: NextRequest) {
  const search = req.nextUrl.search
  if (!search || search.length > 4000) return new NextResponse('Bad request', { status: 400 })
  const res = await fetch(`https://fonts.googleapis.com/css2${search}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) return new NextResponse('', { status: res.status, headers: { 'Content-Type': 'text/css' } })
  const css = (await res.text()).replaceAll('https://fonts.gstatic.com/', '/api/gfonts/file/')
  return new NextResponse(css, {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
    },
  })
}
