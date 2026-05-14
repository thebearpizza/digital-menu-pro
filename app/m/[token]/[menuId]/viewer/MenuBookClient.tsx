'use client'

import { Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { useAtom } from 'jotai'
import { Experience } from './Experience'
import { pageAtom, pages } from './menu-book-state'

function MenuPager() {
  const [page, setPage] = useAtom(pageAtom)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center p-4">
      <div className="pointer-events-auto flex max-w-full gap-2 overflow-x-auto rounded-full border border-[#8f6d43]/40 bg-black/30 px-3 py-3 backdrop-blur-md">
        {pages.map((_, index) => (
          <button
            key={index}
            onClick={() => setPage(index)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm transition ${
              index === page
                ? 'bg-[#e7d2b0] text-[#2a1d16]'
                : 'bg-[#4a3426]/50 text-[#f3e7d3]'
            }`}
          >
            {index === 0 ? 'Cover' : `Page ${index}`}
          </button>
        ))}
        <button
          onClick={() => setPage(pages.length)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm transition ${
            page === pages.length
              ? 'bg-[#e7d2b0] text-[#2a1d16]'
              : 'bg-[#4a3426]/50 text-[#f3e7d3]'
          }`}
        >
          Back
        </button>
      </div>
    </div>
  )
}

export default function MenuBookClient() {
  return (
    <>
      <MenuPager />
      <Loader />
      <div className="h-[100dvh] w-full bg-[#140b08]">
        <Canvas shadows camera={{ position: [-0.5, -1, 4], fov: 45 }}>
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
