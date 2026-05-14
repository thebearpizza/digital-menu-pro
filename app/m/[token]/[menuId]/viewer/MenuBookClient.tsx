'use client'

import { Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useMemo } from 'react'
import { useAtom } from 'jotai'
import { Experience } from './Experience'
import { pageAtom, viewerPagesAtom } from './menu-book-state'
import type { ViewerPage } from './menu-to-pages'

type PagerEntry = {
  id: string
  label: string
  targetPage: number
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-4">
      <div className="pointer-events-auto flex max-w-full gap-2 overflow-x-auto rounded-full border border-[#8f6d43]/40 bg-black/35 px-3 py-3 backdrop-blur-md">
        {pagerEntries.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setPage(entry.targetPage)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm transition ${
              entry.id === activeTabId
                ? 'bg-[#e7d2b0] text-[#2a1d16]'
                : 'bg-[#4a3426]/50 text-[#f3e7d3]'
            }`}
          >
            {entry.label}
          </button>
        ))}
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
  return (
    <>
      <BootstrapPages pages={pages} />
      <MenuPager />
      <Loader />
      <div className="h-[100dvh] w-full bg-[#140b08]">
        <Canvas shadows camera={{ position: [0, 0, 4.2], fov: 35 }}>
          <group position-y={0}>
            <Suspense fallback={null}>
              <Experience />
            </Suspense>
          </group>
        </Canvas>
      </div>
    </>
  )
}
