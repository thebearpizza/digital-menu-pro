'use client'

import { useState } from 'react'
import WelcomeView from './WelcomeView'
import dynamic from 'next/dynamic'
import ReferenceViewer from './ReferenceViewer'

const MenuFlipbook = dynamic(() => import('./MenuFlipbook'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
      <p className="text-zinc-500 text-sm">Caricamento menu…</p>
    </div>
  ),
})

const PDFFlipBook = dynamic(() => import('./PDFFlipBook'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
      <p className="text-zinc-500 text-sm">Caricamento menu…</p>
    </div>
  ),
})

interface Dish {
  id: string
  name: string
  description: string | null
  price: number | null
  category: string
  image_url: string | null
  allergens: number[]
  pairing_dish_id: string | null
  pairing_label: string | null
}

interface Menu {
  id: string
  name: string
  dishes: Dish[]
}

interface Restaurant {
  name: string
  description: string | null
  logo_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  website_url: string | null
  tripadvisor_url: string | null
  google_maps_url: string | null
}

interface Banner {
  id: string
  media_url: string | null
  media_type: string
  title: string | null
  subtitle: string | null
}

interface Info {
  title: string | null
  content: string | null
}

interface Props {
  restaurant: Restaurant
  menus: Menu[]
  banners: Banner[]
  info: Info | null
  defaultMenuId?: string | null
  /** When provided, shows a PDF flipbook instead of (or in addition to) the HTML menu. */
  pdfUrl?: string | null
}

export default function PublicMenuView({ restaurant, menus, banners, info, defaultMenuId, pdfUrl }: Props) {
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(defaultMenuId ?? null)
  const [showPdf, setShowPdf] = useState(!!pdfUrl)

  const selectedMenu = selectedMenuId ? menus.find(m => m.id === selectedMenuId) : null

  // ── FASE 1: reference engine test ────────────────────────────────────────────
  // Renders the RaffaeleMorganti/pdf-viewer 1:1 clone.
  // When pdfUrl is provided it shows that PDF; otherwise it shows the built-in
  // pdfjs sample so the turn.js flip animation can be verified.
  // To restore the HTML flipbook, remove the line below.
  return <ReferenceViewer pdfUrl={pdfUrl} />
  // ─────────────────────────────────────────────────────────────────────────────

  /* eslint-disable no-unreachable */
  if (pdfUrl && showPdf) {
    return (
      <PDFFlipBook
        pdfUrl={pdfUrl!}
        restaurantName={restaurant.name}
        menuName={menus[0]?.name}
        onBack={() => setShowPdf(false)}
      />
    )
  }

  if (selectedMenu) {
    return (
      <MenuFlipbook
        menuName={selectedMenu!.name}
        restaurantName={restaurant.name}
        items={selectedMenu!.dishes}
        infoTitle={info?.title}
        infoContent={info?.content}
        onBack={() => setSelectedMenuId(null)}
      />
    )
  }

  return (
    <WelcomeView
      restaurant={restaurant}
      menus={menus.map(m => ({ id: m.id, name: m.name }))}
      banners={banners}
      onSelectMenu={id => setSelectedMenuId(id)}
    />
  )
  /* eslint-enable no-unreachable */
}
