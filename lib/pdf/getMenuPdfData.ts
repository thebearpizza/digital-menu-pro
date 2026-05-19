import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { generateMenuPdf, type DishPosition } from './generateMenuPdf'
import type { PdfPayload } from './types'

const BUCKET = 'menu-pdfs'

export type MenuPdfData = {
  pdfUrl: string
  dishPositions: DishPosition[]
  totalPages: number
}

export function hasStorageCredentials(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function adminClient() {
  if (!hasStorageCredentials()) {
    throw new Error('NO_SERVICE_ROLE_KEY')
  }
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function publicUrlFor(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`
}

// Cerca il PDF + JSON delle posizioni in cache. Se non esistono, li genera.
// Garantisce che alla prossima chiamata con la stessa cacheKey, nessuno dei due
// venga rigenerato (utile per evitare doppia generazione tra page.tsx e api route).
export async function ensureMenuPdfCached(
  payload: PdfPayload,
  restaurantId: string,
  cacheKey: string
): Promise<MenuPdfData> {
  const admin = adminClient()
  const pdfPath = `${restaurantId}/${cacheKey}.pdf`
  const positionsPath = `${restaurantId}/${cacheKey}.positions.json`

  // Verifica file esistenti
  const { data: existing } = await admin.storage
    .from(BUCKET)
    .list(restaurantId, { limit: 100, search: cacheKey })

  const pdfExists = existing?.some((f) => f.name === `${cacheKey}.pdf`)
  const positionsExist = existing?.some((f) => f.name === `${cacheKey}.positions.json`)

  if (pdfExists && positionsExist) {
    // Cache hit completa: scarica solo il JSON
    const { data: positionsBlob } = await admin.storage
      .from(BUCKET)
      .download(positionsPath)

    if (positionsBlob) {
      const text = await positionsBlob.text()
      const parsed = JSON.parse(text) as { dishPositions: DishPosition[]; totalPages: number }
      return {
        pdfUrl: publicUrlFor(pdfPath),
        dishPositions: parsed.dishPositions,
        totalPages: parsed.totalPages,
      }
    }
  }

  // Genera PDF + posizioni
  const { bytes, dishPositions, totalPages } = await generateMenuPdf(payload)
  const positionsJson = JSON.stringify({ dishPositions, totalPages })

  await Promise.all([
    admin.storage.from(BUCKET).upload(pdfPath, bytes, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '3600',
    }),
    admin.storage.from(BUCKET).upload(positionsPath, positionsJson, {
      contentType: 'application/json',
      upsert: true,
      cacheControl: '3600',
    }),
  ])

  return {
    pdfUrl: publicUrlFor(pdfPath),
    dishPositions,
    totalPages,
  }
}
