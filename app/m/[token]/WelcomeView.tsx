'use client'

import { useState, useEffect } from 'react'

interface Banner {
  id: string
  media_url: string | null
  media_type: string
  title: string | null
  subtitle: string | null
}

interface Menu {
  id: string
  name: string
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

interface Props {
  restaurant: Restaurant
  menus: Menu[]
  banners: Banner[]
  onSelectMenu: (menuId: string) => void
}

const SOCIAL_LINKS = [
  { key: 'instagram_url',   label: 'Instagram',   icon: '📸' },
  { key: 'facebook_url',    label: 'Facebook',    icon: '📘' },
  { key: 'website_url',     label: 'Sito web',    icon: '🌐' },
  { key: 'tripadvisor_url', label: 'TripAdvisor', icon: '🦉' },
  { key: 'google_maps_url', label: 'Google Maps', icon: '📍' },
]

function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (banners.length <= 1) return
    const t = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % banners.length)
        setVisible(true)
      }, 400)
    }, 5000)
    return () => clearInterval(t)
  }, [banners.length])

  if (!banners.length) return null
  const b = banners[idx]

  return (
    <div className="relative w-full overflow-hidden bg-black" style={{ maxHeight: 340 }}>
      <div className={visible ? 'banner-in' : 'banner-out'}>
        {b.media_type === 'video' && b.media_url ? (
          <video
            src={b.media_url}
            autoPlay muted loop playsInline
            className="w-full object-contain"
            style={{ maxHeight: 340 }}
          />
        ) : b.media_url ? (
          <img
            src={b.media_url}
            alt={b.title ?? ''}
            className="w-full object-contain"
            style={{ maxHeight: 340 }}
          />
        ) : null}
      </div>

      {(b.title || b.subtitle) && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-6 py-5">
          {b.title && <h2 className="text-white text-xl font-light">{b.title}</h2>}
          {b.subtitle && <p className="text-white/80 text-sm mt-1">{b.subtitle}</p>}
        </div>
      )}

      {banners.length > 1 && (
        <div className="absolute bottom-3 right-4 flex gap-1">
          {banners.map((_, i) => (
            <button key={i} onClick={() => { setIdx(i); setVisible(true) }}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function WelcomeView({ restaurant, menus, banners, onSelectMenu }: Props) {
  const socialLinks = SOCIAL_LINKS
    .map(s => ({ ...s, url: (restaurant as any)[s.key] as string | null }))
    .filter(s => s.url)

  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col">
      <BannerCarousel banners={banners} />

      <div className="flex-1 flex flex-col items-center px-6 py-10">
        {restaurant.logo_url && (
          <img src={restaurant.logo_url} alt={restaurant.name}
            className="w-20 h-20 object-contain mb-6 rounded" />
        )}

        <h1 className="text-2xl font-light tracking-wide text-center">{restaurant.name}</h1>
        {restaurant.description && (
          <p className="mt-2 text-sm text-zinc-400 text-center max-w-xs leading-relaxed">
            {restaurant.description}
          </p>
        )}

        {/* Social links */}
        {socialLinks.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-6 justify-center">
            {socialLinks.map(s => (
              <a key={s.key} href={s.url!} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-white transition-colors">
                <span>{s.icon}</span> {s.label}
              </a>
            ))}
          </div>
        )}

        {/* Menu selection */}
        <div className="w-full max-w-sm mt-10 space-y-3">
          {menus.length === 0 ? (
            <p className="text-center text-zinc-500 text-sm">Menu in aggiornamento.</p>
          ) : menus.length === 1 ? (
            <>
              <p className="text-center text-xs text-zinc-500 mb-2">
                {menus[0].name}
              </p>
              <button
                onClick={() => onSelectMenu(menus[0].id)}
                className="w-full py-3 text-sm font-medium bg-white text-zinc-900 hover:bg-zinc-100 transition-colors"
              >
                Sfoglia il menu →
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-zinc-500 text-center mb-1">Scegli un menu</p>
              {menus.map(m => (
                <button key={m.id} onClick={() => onSelectMenu(m.id)}
                  className="w-full py-3 text-sm font-medium border border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:text-white transition-colors">
                  {m.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
