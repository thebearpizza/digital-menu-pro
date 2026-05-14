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

function ProductCard({
  item,
}: {
  item: NonNullable<ViewerPage['items']>[number]
}) {
  return (
    <article className="grid grid-cols-[1fr_auto] gap-3 border-b border-[#d9ccb8] pb-3">
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-semibold text-[#2a1d16]">
          {item.name}
        </h3>

        {item.description ? (
          <p
            className="mt-1 overflow-hidden text-[12px] leading-5 text-[#6b5b4b]"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {item.description}
          </p>
        ) : null}

        {item.allergens && item.allergens.length > 0 ? (
          <p className="mt-2 truncate text-[11px] uppercase tracking-[0.12em] text-[#9a7b55]">
            {item.allergens.join(' • ')}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 pl-2 text-right text-[14px] font-semibold text-[#2a1d16]">
        {typeof item.price === 'number' ? `€ ${item.price.toFixed(2)}` : ''}
      </div>
    </article>
  )
}

function PageOverlay() {
  const [page] = useAtom(pageAtom)
  const [viewerPages] = useAtom(viewerPagesAtom)

  const currentPage = viewerPages[page]

  if (!currentPage) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center px-6 pb-24 pt-8">
      <div className="w-full max-w-[760px]">
        <div className="mx-auto aspect-[1.45/1] w-full max-w-[720px] rounded-[28px] bg-[#f5efe4]/92 shadow-[0_24px_80px_rgba(0,0,0,0.38)] ring-1 ring-[#e8dcc8]">
          <div className="grid h-full grid-cols-2 overflow-hidden rounded-[28px]">
            <section className="flex min-h-0 flex-col border-r border-[#eadfce] px-8 py-7">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#9a7b55]">
                {currentPage.kind === 'cover'
                  ? 'Menu'
                  : currentPage.kind === 'category'
                  ? 'Categoria'
                  : currentPage.kind === 'items'
                  ? currentPage.category || 'Selezione'
                  : 'Finale'}
              </p>

              <h1 className="mt-3 text-[28px] font-semibold leading-tight text-[#2a1d16]">
                {currentPage.title}
              </h1>

              {currentPage.subtitle ? (
                <p className="mt-3 max-w-[28ch] text-[14px] leading-6 text-[#6b5b4b]">
                  {currentPage.subtitle}
                </p>
              ) : null}

              <div className="mt-auto pt-6 text-[12px] uppercase tracking-[0.18em] text-[#b18b62]">
                Volantino digitale
              </div>
            </section>

            <section className="min-h-0 px-7 py-7">
              {currentPage.kind === 'cover' ? (
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <div className="rounded-full bg-[#2a1d16] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-[#f5efe4] w-fit">
                      Esperienza menu
                    </div>
                    <p className="mt-6 max-w-[24ch] text-[15px] leading-7 text-[#5b4b3c]">
                      Sfoglia il menu, usa i tab in basso per saltare tra le categorie e tocca le pagine per una navigazione naturale.
                    </p>
                  </div>

                  <div className="rounded-[22px] border border-[#e2d6c5] bg-[#fffaf3] p-5">
                    <p className="text-[12px] uppercase tracking-[0.16em] text-[#9a7b55]">
                      Impostazione attuale
                    </p>
                    <p className="mt-3 text-[14px] leading-6 text-[#4f4236]">
                      Layout pulito, fondo scuro, pagina chiara e struttura guidata dalle categorie del gestionale.
                    </p>
                  </div>
                </div>
              ) : null}

              {currentPage.kind === 'category' ? (
                <div className="flex h-full flex-col justify-center">
                  <div className="rounded-[24px] border border-[#e2d6c5] bg-[#fffaf3] p-7 text-center">
                    <p className="text-[12px] uppercase tracking-[0.18em] text-[#9a7b55]">
                      Categoria
                    </p>
                    <h2 className="mt-4 text-[30px] font-semibold leading-tight text-[#2a1d16]">
                      {currentPage.title}
                    </h2>
                    {currentPage.subtitle ? (
                      <p className="mt-4 text-[14px] leading-6 text-[#6b5b4b]">
                        {currentPage.subtitle}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {currentPage.kind === 'items' ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="truncate text-[18px] font-semibold text-[#2a1d16]">
                      {currentPage.title}
                    </h2>
                    <span className="shrink-0 rounded-full bg-[#efe2cf] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#8b6c49]">
                      {currentPage.items?.length || 0} piatti
                    </span>
                  </div>

                  <div className="grid min-h-0 flex-1 content-start gap-3 overflow-hidden">
                    {(currentPage.items ?? []).map((item) => (
                      <ProductCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ) : null}

              {currentPage.kind === 'back' ? (
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <p className="text-[12px] uppercase tracking-[0.18em] text-[#9a7b55]">
                      Fine menu
                    </p>
                    <h2 className="mt-4 text-[28px] font-semibold text-[#2a1d16]">
                      {currentPage.title}
                    </h2>
                    <p className="mt-4 text-[15px] leading-7 text-[#5b4b3c]">
                      Grazie per aver sfogliato il menu digitale.
                    </p>
                  </div>

                  <div className="rounded-[22px] border border-[#e2d6c5] bg-[#fffaf3] p-5">
                    <p className="text-[12px] uppercase tracking-[0.16em] text-[#9a7b55]">
                      Esperienza
                    </p>
                    <p className="mt-3 text-[14px] leading-6 text-[#4f4236]">
                      Questo layout sarà la base per le future personalizzazioni dal gestionale.
                    </p>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
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
  return (
    <>
      <BootstrapPages pages={pages} />
      <PageOverlay />
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
