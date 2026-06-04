'use client'
// ─────────────────────────────────────────────────────────────────────────────
// PublicMenuView — client wrapper for the public /m/[token] page.
//
// Flow:
//   1. No menu selected → WelcomeView (restaurant intro + menu picker).
//   2. Menu selected    → useMenuPDF generates a PDF blob in the background.
//   3. PDF ready        → FlipbookViewer with the blob URL + real category pages.
//
// The /m/[token] URL is permanent (printed QR codes). See CLAUDE.md.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import WelcomeView     from './WelcomeView'
import FlipbookViewer  from './FlipbookViewer'
import { useMenuPDF }  from './useMenuPDF'

// ── Types (mirror the shape returned by page.tsx) ─────────────────────────────

export interface Dish {
  id:              string
  name:            string
  description:     string | null
  price:           number | null
  category:        string
  image_url:       string | null
  allergens:       number[]
  pairing_dish_id: string | null
  pairing_label:   string | null
}

export interface Menu {
  id:     string
  name:   string
  dishes: Dish[]
}

export interface Restaurant {
  name:            string
  description:     string | null
  logo_url:        string | null
  instagram_url:   string | null
  facebook_url:    string | null
  website_url:     string | null
  tripadvisor_url: string | null
  google_maps_url: string | null
}

export interface Banner {
  id:         string
  media_url:  string | null
  media_type: string
  title:      string | null
  subtitle:   string | null
}

export interface Info {
  title:   string | null
  content: string | null
}

interface Props {
  restaurant:     Restaurant
  menus:          Menu[]
  banners:        Banner[]
  info:           Info | null
  defaultMenuId?: string | null
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PublicMenuView({
  restaurant,
  menus,
  banners,
  defaultMenuId,
}: Props) {
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(
    defaultMenuId ?? null
  )

  const selectedMenu = selectedMenuId
    ? menus.find(m => m.id === selectedMenuId) ?? null
    : null

  // Generate the PDF blob whenever the selected menu changes.
  // Dishes are mapped to PDFDish shape (category defaults to 'Menu' if blank).
  const { pdfUrl, categories, isGenerating, error } = useMenuPDF(
    { name: restaurant.name },
    selectedMenu
      ? {
          id:     selectedMenu.id,
          name:   selectedMenu.name,
          dishes: selectedMenu.dishes.map(d => ({
            id:          d.id,
            name:        d.name,
            description: d.description,
            price:       d.price,
            category:    d.category || 'Menu',
            allergens:   d.allergens,
          })),
        }
      : null
  )

  // ── 1. No menu selected → welcome / selection screen ─────────────────────
  if (!selectedMenuId || !selectedMenu) {
    return (
      <WelcomeView
        restaurant={restaurant}
        menus={menus.map(m => ({ id: m.id, name: m.name }))}
        banners={banners}
        onSelectMenu={id => setSelectedMenuId(id)}
      />
    )
  }

  // ── 2. PDF is being generated → full-screen dark holding state ───────────
  if (isGenerating || !pdfUrl) {
    return (
      <div
        className="fixed inset-0 h-[100dvh] flex flex-col items-center justify-center"
        style={{ background: '#0c0c0c' }}
      >
        {error ? (
          <div className="text-center px-8 flex flex-col items-center gap-4">
            <p className="text-xs text-red-400">
              Impossibile generare il menu.
            </p>
            <button
              onClick={() => setSelectedMenuId(null)}
              className="text-[10px] uppercase tracking-[0.25em] underline underline-offset-4"
              style={{ color: '#4f4f4f' }}
            >
              ← torna
            </button>
          </div>
        ) : (
          <p
            className="text-[10px] uppercase tracking-[0.3em]"
            style={{ color: '#4f4f4f' }}
          >
            Preparazione menu…
          </p>
        )}
      </div>
    )
  }

  // ── 3. PDF ready → flipbook ───────────────────────────────────────────────
  return (
    <FlipbookViewer
      pdfUrl={pdfUrl}
      restaurantName={restaurant.name}
      restaurantLogo={restaurant.logo_url}
      onBack={() => setSelectedMenuId(null)}
      categories={categories.length > 0 ? categories : undefined}
    />
  )
}
