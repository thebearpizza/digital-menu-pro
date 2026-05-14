'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type Dish = {
  id: string
  name: string
  description: string | null
  price: number | null
  image_url: string | null
  allergens: string[]
  is_available: boolean
  category: string | null
}

type Props = {
  dishes: Dish[]
  menuName: string
  restaurantName: string
}

type Page = {
  category: string
  dishes: Dish[]
}

const MAX_ITEMS = 6
// Numero di segmenti verticali: più alto = piega più morbida
const N_SEGMENTS = 30

export default function ThreeFlipMenu({ dishes, menuName, restaurantName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [pageIndex, setPageIndex] = useState(0)

  const pages = useMemo<Page[]>(() => {
    const byCategory = new Map<string, Dish[]>()
    for (const dish of dishes) {
      const cat = dish.category || 'Varie'
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push(dish)
    }
    const result: Page[] = []
    byCategory.forEach((list, cat) => {
      if (list.length <= MAX_ITEMS) {
        result.push({ category: cat, dishes: list })
      } else {
        for (let i = 0; i < list.length; i += MAX_ITEMS) {
          const slice = list.slice(i, i + MAX_ITEMS)
          const label = i === 0 ? cat : `${cat} (${Math.floor(i / MAX_ITEMS) + 1})`
          result.push({ category: label, dishes: slice })
        }
      }
    })
    if (result.length === 0) result.push({ category: 'Menu', dishes: [] })
    result.sort((a, b) => a.category.localeCompare(b.category))
    return result
  }, [dishes])

  const currentPage = pages[pageIndex] ?? pages[0]
  const currentPageDishes = currentPage?.dishes ?? []

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x15100c)

    const camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    )
    camera.position.set(0, 0, 3.4)

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight, false)
    renderer.shadowMap.enabled = true

    // Luce ambientale calda
    scene.add(new THREE.AmbientLight(0xfff5e0, 0.6))

    // Luce direzionale principale (dall'alto sinistra)
    const dirLight = new THREE.DirectionalLight(0xfff5e0, 0.8)
    dirLight.position.set(-2, 3, 4)
    dirLight.castShadow = true
    scene.add(dirLight)

    // Luce di riempimento (destra bassa)
    const fillLight = new THREE.DirectionalLight(0xffe0c0, 0.3)
    fillLight.position.set(3, -1, 2)
    scene.add(fillLight)

    // Ombra sotto la pagina
    const shadowGeo = new THREE.PlaneGeometry(2.6, 1.8)
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.22,
    })
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat)
    shadowMesh.position.set(0.06, -0.06, -0.05)
    scene.add(shadowMesh)

    // Pagina con N_SEGMENTS segmenti verticali per la deformazione
    const pageW = 2.2
    const pageH = 1.4
    const pageGeo = new THREE.PlaneGeometry(pageW, pageH, N_SEGMENTS, 2)
    const pageMat = new THREE.MeshStandardMaterial({
      color: 0xf8f1e6,
      roughness: 0.7,
      metalness: 0.0,
      side: THREE.DoubleSide,
    })
    const pageMesh = new THREE.Mesh(pageGeo, pageMat)
    pageMesh.receiveShadow = true
    pageMesh.castShadow = true
    scene.add(pageMesh)

    // Salva le posizioni originali dei vertici (X)
    const posAttr = pageGeo.attributes.position as THREE.BufferAttribute
    const originalX = new Float32Array(posAttr.count)
    for (let i = 0; i < posAttr.count; i++) {
      originalX[i] = posAttr.getX(i)
    }

    let currentIndex = 0
    const totalPages = pages.length

    let isFlipping = false
    let flipDir: 1 | -1 = 1
    let flipT = 0
    const flipDuration = 0.7
    const clock = new THREE.Clock()

    const updateMaterial = () => {
      const page = pages[currentIndex]
      if (page && page.category) {
        const hash = Array.from(page.category).reduce(
          (acc, c) => acc + c.charCodeAt(0), 0
        )
        const tone = 0xf0e4d0 + (hash % 0x25)
        ;(pageMat as THREE.MeshStandardMaterial).color = new THREE.Color(tone)
      } else {
        ;(pageMat as THREE.MeshStandardMaterial).color = new THREE.Color(0xf8f1e6)
      }
      pageMat.needsUpdate = true
    }

    updateMaterial()

    /**
     * Deforma i vertici della pagina per simulare la piega della carta.
     * progress va da 0 (pagina ferma) a 1 (fine flip).
     * direction: 1 = sfoglia avanti, -1 = sfoglia indietro.
     *
     * Tecnica: ogni vertice viene spostato lungo X e Z
     * secondo una curva coseno che simula l'avvolgimento su un cilindro virtuale.
     */
    const deformPage = (progress: number, direction: 1 | -1) => {
      const eased =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2

      const angle = eased * Math.PI // 0 → π durante il flip

      for (let i = 0; i < posAttr.count; i++) {
        const ox = originalX[i] // posizione originale da -1.1 a +1.1

        // Normalizza tra -1 e +1
        const nx = (ox / (pageW * 0.5)) * direction

        // Mappa nx su una fase dell'angolo
        // nx = -1 → bordo sinistro (fisso), nx = +1 → bordo destro (fisso)
        // durante il flip: la parte destra inizia a piegarsi prima
        const phase = ((nx + 1) * 0.5) * angle // 0 → angle

        // Coordinata X deformata: cos(phase) scalato sulla mezza larghezza
        const deformedX = Math.cos(phase) * (pageW * 0.5) * direction

        // Coordinata Z: la pagina si alza mentre si piega
        const deformedZ = Math.sin(phase) * 0.35

        posAttr.setXYZ(
          i,
          deformedX,
          posAttr.getY(i),
          deformedZ
        )
      }

      posAttr.needsUpdate = true
      pageGeo.computeVertexNormals()

      // L'ombra segue la posizione media della pagina
      shadowMesh.rotation.y = (angle - Math.PI * 0.5) * direction * 0.15
      shadowMesh.position.x = Math.sin(angle * 0.5) * 0.08 * direction
    }

    const onResize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    const animate = () => {
      const delta = clock.getDelta()

      if (isFlipping) {
        flipT += delta / flipDuration
        const t = Math.min(flipT, 1)

        deformPage(t, flipDir)

        // Leggero respiro della camera durante il flip
        camera.position.z = 3.4 - Math.sin(t * Math.PI) * 0.2

        if (flipT >= 1) {
          isFlipping = false
          flipT = 0
          camera.position.z = 3.4

          // Ripristina i vertici alla posizione originale
          for (let i = 0; i < posAttr.count; i++) {
            posAttr.setXYZ(i, originalX[i], posAttr.getY(i), 0)
          }
          posAttr.needsUpdate = true
          pageGeo.computeVertexNormals()
          shadowMesh.rotation.y = 0
          shadowMesh.position.x = 0

          updateMaterial()
          setPageIndex(currentIndex)
        }
      }

      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }

    animate()

    let touchStartX: number | null = null

    const onTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartX == null || isFlipping) return
      const dx = e.changedTouches[0].clientX - touchStartX
      touchStartX = null
      if (Math.abs(dx) < 30) return

      if (dx < 0 && currentIndex < totalPages - 1) {
        currentIndex += 1
        flipDir = 1
        flipT = 0
        isFlipping = true
      } else if (dx > 0 && currentIndex > 0) {
        currentIndex -= 1
        flipDir = -1
        flipT = 0
        isFlipping = true
      }
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchend', onTouchEnd)
      renderer.dispose()
    }
  }, [pages.length])

  return (
    <div className="flex flex-col h-[100dvh] bg-[#15100c]">
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-full h-full">
          <canvas ref={canvasRef} className="w-full h-full" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-none max-w-[88%] max-h-[80%] overflow-hidden px-4 py-4">
              <div className="text-center mb-2">
                <p className="text-[0.65rem] tracking-[0.24em] uppercase text-[#c1b4a3]">
                  {restaurantName}
                </p>
                <p className="text-[0.9rem] font-semibold text-[#f5eee4]">
                  {menuName}
                </p>
                <p className="text-[0.8rem] font-semibold mt-1 text-[#f2e4d4] tracking-[0.18em] uppercase">
                  {currentPage?.category}
                </p>
              </div>
              <div className="space-y-2 text-[0.8rem]">
                {currentPageDishes.map((dish) => (
                  <div
                    key={dish.id}
                    className="border-b border-[#e0d4c3]/40 pb-1 last:border-b-0"
                  >
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="font-semibold text-[#2b2018]">
                        {dish.name}
                      </span>
                      {dish.price != null && (
                        <span className="text-[0.8rem] text-[#5b4634] whitespace-nowrap">
                          € {dish.price.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {dish.description && (
                      <p className="text-[0.7rem] text-[#7a6755] mt-0.5 leading-snug max-h-[2.6rem] overflow-hidden">
                        {dish.description}
                      </p>
                    )}
                    {dish.allergens && dish.allergens.length > 0 && (
                      <p className="text-[0.6rem] text-[#a1784f] mt-0.5 uppercase tracking-[0.12em]">
                        {dish.allergens.join(' • ')}
                      </p>
                    )}
                  </div>
                ))}
                {currentPageDishes.length === 0 && (
                  <p className="text-[0.75rem] text-[#7a6755] text-center mt-4">
                    Nessun piatto in questa categoria.
                  </p>
                )}
              </div>
              <div className="mt-3 text-[0.6rem] text-center text-[#8a7a68] tracking-[0.18em] uppercase">
                Pagina {pageIndex + 1} / {pages.length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
