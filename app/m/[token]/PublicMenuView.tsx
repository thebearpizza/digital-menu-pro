'use client'
// ─────────────────────────────────────────────────────────────────────────────
// PublicMenuView — client wrapper for the public /m/[token] page.
//
// Flow:
//   1. No menu selected → dark landing with one button per menu.
//   2. Menu selected    → useMenuPDF generates a PDF blob in the background.
//   3. PDF ready        → FlipbookViewer with the blob URL + real category pages.
//
// The /m/[token] URL is permanent (printed QR codes). See CLAUDE.md.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import FlipbookViewer  from './FlipbookViewer'
import { useMenuPDF }  from './useMenuPDF'

const ACCENT     = '#c9a96e'
const FONT_SERIF = "'Cormorant Garamond', 'Georgia', 'Times New Roman', serif"
const FONT_SANS  = "'DM Sans', 'Inter', system-ui, sans-serif"

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

  // ── 1. No menu selected → dark landing with per-menu buttons ────────────
  if (!selectedMenuId || !selectedMenu) {
    return (
      <div
        className="fixed inset-0 h-[100dvh] flex flex-col items-center justify-center"
        style={{ background: 'linear-gradient(155deg, #0d0d0d 0%, #131313 60%, #0f0e0e 100%)' }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 inset-x-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}55, transparent)` }}
        />

        <div className="flex flex-col items-center text-center px-10 w-full max-w-xs">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="h-14 mb-10 object-contain"
              style={{ opacity: 0.88 }}
            />
          ) : (
            <>
              <div className="w-10 h-px mb-7" style={{ background: ACCENT }} />
              <h1
                className="font-light uppercase leading-none"
                style={{
                  color:         '#ede8e0',
                  fontFamily:    FONT_SERIF,
                  fontSize:      'clamp(1.6rem, 5vw, 2.4rem)',
                  letterSpacing: '0.22em',
                }}
              >
                {restaurant.name}
              </h1>
              <div className="w-10 h-px mt-7" style={{ background: ACCENT }} />
            </>
          )}

          {/* One button per menu */}
          <div className="mt-10 flex flex-col gap-3 w-full">
            {menus.length === 0 ? (
              <p
                className="text-[10px] uppercase tracking-[0.25em]"
                style={{ color: '#4f4f4f' }}
              >
                Menu in aggiornamento.
              </p>
            ) : (
              menus.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMenuId(m.id)}
                  className="group relative px-10 py-3 overflow-hidden"
                  style={{
                    color:         '#ede8e0',
                    border:        `1px solid ${ACCENT}50`,
                    fontFamily:    FONT_SANS,
                    fontSize:      '0.625rem',
                    letterSpacing: '0.28em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `${ACCENT}14` }}
                  />
                  <span className="relative">
                    {`Sfoglia il menu ${m.name}`}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <p
          className="absolute bottom-6 text-[8px] uppercase tracking-[0.35em]"
          style={{ color: '#4f4f4f' }}
        >
          menu digitale
        </p>

        {/* Bottom accent line */}
        <div
          className="absolute bottom-0 inset-x-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}55, transparent)` }}
        />
      </div>
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
      dishes={selectedMenu.dishes}
    />
  )
}
