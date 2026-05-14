'use client'

import { Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect } from 'react'
import { useAtom } from 'jotai'
import { Experience } from './Experience'
import { pageAtom, viewerPagesAtom } from './menu-book-state'
import type { ViewerPage } from './menu-to-pages'

function MenuPager() {
  const [page, setPage] = useAtom(pageAtom)
  const [viewerPages] = useAtom(viewerPagesAtom)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center p-4">
      <div className="pointer-events-auto flex max-w-full gap-2 overflow-x-auto rounded-full border border-[#8f6d43]/40 bg-black/30 px-3 py-3 backdrop-blur-md">
        {viewerPages.map((entry, index) => (
          <button
            key={entry.id}
            onClick={() => setPage(index)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm transition ${
              index === page
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
