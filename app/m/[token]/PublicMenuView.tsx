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

// ── Types ─────────────────────────────────────────────────────────────────────

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
  visibility:      Record<string, boolean> | null
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

// ── Visibility helper ─────────────────────────────────────────────────────────

type VisKey = 'name' | 'description' | 'logo' | 'instagram' | 'facebook' | 'website' | 'tripadvisor' | 'google_maps'

function isVis(visibility: Record<string, boolean> | null, key: VisKey): boolean {
  if (!visibility) return true
  return visibility[key] !== false
}

// ── Social icon SVGs (inline, zero deps) ─────────────────────────────────────

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  )
}

// ── Social bar ────────────────────────────────────────────────────────────────

function SocialBar({ restaurant }: { restaurant: Restaurant }) {
  const vis = restaurant.visibility

  const links = [
    { key: 'instagram'   as VisKey, url: restaurant.instagram_url,   Icon: InstagramIcon, label: 'Instagram'   },
    { key: 'facebook'    as VisKey, url: restaurant.facebook_url,    Icon: FacebookIcon,  label: 'Facebook'    },
    { key: 'website'     as VisKey, url: restaurant.website_url,     Icon: GlobeIcon,     label: 'Sito web'    },
    { key: 'tripadvisor' as VisKey, url: restaurant.tripadvisor_url, Icon: CompassIcon,   label: 'TripAdvisor' },
    { key: 'google_maps' as VisKey, url: restaurant.google_maps_url, Icon: MapPinIcon,    label: 'Google Maps' },
  ].filter(({ key, url }) => url && isVis(vis, key))

  if (links.length === 0) return null

  return (
    <div className="mt-10 flex items-center justify-center gap-5">
      {links.map(({ url, Icon, label }) => (
        <a
          key={label}
          href={url!}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="transition-opacity duration-200 hover:opacity-50"
          style={{ color: `${ACCENT}99` }}
        >
          <Icon />
        </a>
      ))}
    </div>
  )
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

  const vis = restaurant.visibility

  // ── 1. No menu selected → dark landing ────────────────────────────────────
  if (!selectedMenuId || !selectedMenu) {
    const showLogo = !!restaurant.logo_url && isVis(vis, 'logo')
    const showName = isVis(vis, 'name')
    const showDesc = !!restaurant.description && isVis(vis, 'description')

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

          {/* Brand: logo → name (or both, or neither) */}
          {showLogo && (
            <img
              src={restaurant.logo_url!}
              alt={restaurant.name}
              className="h-14 object-contain"
              style={{ opacity: 0.88, marginBottom: showName || showDesc ? '1.5rem' : '2.5rem' }}
            />
          )}

          {!showLogo && showName && (
            <div className="w-10 h-px mb-7" style={{ background: ACCENT }} />
          )}

          {showName && (
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
          )}

          {showDesc && (
            <p
              style={{
                color:         `${ACCENT}80`,
                fontFamily:    FONT_SANS,
                fontSize:      '0.6rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginTop:     '0.6rem',
              }}
            >
              {restaurant.description}
            </p>
          )}

          {/* Bottom decorative line (only when no logo) */}
          {!showLogo && (showName || showDesc) && (
            <div className="w-10 h-px mt-7" style={{ background: ACCENT }} />
          )}

          {/* Menu selection buttons */}
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

          {/* Social icons row */}
          <SocialBar restaurant={restaurant} />

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
