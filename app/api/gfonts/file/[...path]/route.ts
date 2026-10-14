import { NextResponse } from 'next/server'

// File dei font Google serviti dal nostro dominio (vedi ../../css2/route.ts).
// Host fisso (fonts.gstatic.com) e percorso validato: niente richieste verso
// indirizzi arbitrari. I file sono immutabili (URL versionati) → cache 1 anno.

const SAFE = /^[A-Za-z0-9._\-/]+$/

export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/')
  if (!SAFE.test(path) || path.includes('..')) return new NextResponse('Bad request', { status: 400 })
  const res = await fetch(`https://fonts.gstatic.com/${path}`)
  if (!res.ok || !res.body) return new NextResponse('Not found', { status: res.status || 404 })
  return new NextResponse(res.body, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
