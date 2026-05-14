'use client'

import { Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useAtom } from 'jotai'
import { Experience } from './Experience'
import { pageAtom, viewerPagesAtom } from './menu-book-state'
import type { ViewerPage } from './menu-to-pages'

type PagerEntry = {
  id: string
  label: string
  targetPage: number
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return isMobile
}

function MenuPager() {
  const [page, setPage] = useAtom(pageAtom)
  const [viewerPages] = useAtom(viewerPagesAtom)

  const pagerEntries = useMemo<PagerEntry[]>(() => {
    const entries: PagerEntry[] = []
    const seen = new Set<string>()

    viewerPages.forEach((entry, index) => {
      const normalizedLabel = entry.label.trim().toLowerCase()

      if (entry.kind === 'cover') {
        entries.push({
          id: entry.id,
          label: entry.label,
          targetPage: index,
        })
        return
      }

      if (entry.kind === 'back') {
        entries.push({
          id: entry.id,
          label: entry.label,
          targetPage: index,
        })
        return
      }

      if (!seen.has(normalizedLabel)) {
        seen.add(normalizedLabel)
        entries.push({
          id: `tab-${normalizedLabel}`,
          label: entry.label,
          targetPage: index,
        })
      }
    })

    return entries
  }, [viewerPages])

  const activeTabId = useMemo(() => {
    const current = viewerPages[page]
    if (!current) return null

    if (current.kind === 'cover' || current.kind === 'back') {
      return current.id
    }

    const normalizedLabel = current.label.trim().toLowerCase()
    return `tab-${normalizedLabel}`
  }, [page, viewerPages])

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 px-3 pt-2"
      style={{
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
      }}
    >
      <div className="mx-auto flex max-w-full justify-center">
        <div className="flex max-w-full gap-2 overflow-x-auto rounded-full border border-[#8f6d43]/40 bg-black/40 px-2 py-2 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          {pagerEntries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setPage(entry.targetPage)}
              className={`min-h-[40px] shrink-0 rounded-full px-3 py-2 text-sm leading-none transition ${
                entry.id === activeTabId
                  ? 'bg-[#e7d2b0] text-[#2a1d16]'
                  : 'bg-[#4a3426]/55 text-[#f3e7d3]'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

type Props = {
  pages: ViewerPage[]
}

function BootstrapPages({ pages }: Props) {
  const [, setViewerPages] = useAtom(viewerPagesAtom)

  useEffect(() => {
    setViewerPages(pages)
  }, [pages, setViewerPages])

  return null
}

export default function MenuBookClient({ pages }: Props) {
  const isMobile = useIsMobile()

  return (
    <>
      <BootstrapPages pages={pages} />
      <Loader />
      <div className="relative h-[100dvh] w-full overflow-hidden bg-[#140b08]">
        <div
          className="absolute inset-0"
          style={{
            paddingBottom: 'calc(84px + env(safe-area-inset-bottom))',
          }}
        >
          <Canvas
            shadows
            camera={{
              position: isMobile ? [0, 0.0, 2.55] : [0, 0, 4.2],
              fov: isMobile ? 24 : 35,
            }}
          >
            <group position-y={isMobile ? -0.02 : 0}>
              <Suspense fallback={null}>
                <Experience />
              </Suspense>
            </group>
          </Canvas>
        </div>

        <MenuPager />
      </div>
    </>
  )
}
