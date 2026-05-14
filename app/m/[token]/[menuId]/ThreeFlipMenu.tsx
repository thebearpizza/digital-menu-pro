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

const ITEMS_PER_PAGE = 6

export default function ThreeFlipMenu({ dishes, menuName, restaurantName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [pageIndex, setPageIndex] = useState(0)

  // Raggruppa i piatti in pagine logiche
  const pages = useMemo(() => {
    const result: Dish[][] = []
    for (let i = 0; i < dishes.length; i += ITEMS_PER_PAGE) {
      result.push(dishes.slice(i, i + ITEMS_PER_PAGE))
    }
    if (result.length === 0) {
      result.push([])
    }
    return result
  }, [dishes])

  const currentPageDishes = pages[pageIndex] ?? []

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x15100c)

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    )
    camera.position.z = 3.2

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    })
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.setSize(window.innerWidth, window.innerHeight, false)

    // Ombra sotto al volantino
    const shadowGeometry = new THREE.PlaneGeometry(2.5, 1.7)
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
    })
    const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial)
    shadowMesh.position.z = -0.03
    shadowMesh.rotation.x = -0.05
    scene.add(shadowMesh)

    // Pagina base: piano 2D color crema
    const pageGeometry = new THREE.PlaneGeometry(2.2, 1.4)
    const pageMaterial = new THREE.MeshBasicMaterial({ color: 0xf8f1e6 })
    const pageMesh = new THREE.Mesh(pageGeometry, pageMaterial)
    scene.add(pageMesh)

    pageMesh.rotation.x = -0.04

    // Stato del flip interno a Three.js
    let currentIndex = 0
    const totalPages = pages.length

    let isFlipping = false
    let flipDirection: 1 | -1 = 1
    let flipProgress = 0
    const flipDuration = 0.45
    const clock = new THREE.Clock()

    const updatePageMaterial = () => {
      const dishesForPage = pages[currentIndex]
      const firstDish = dishesForPage && dishesForPage[0]
      if (firstDish && firstDish.category) {
        const hash = Array.from(firstDish.category).reduce(
          (acc, c) => acc + c.charCodeAt(0),
          0
        )
        const tone = 0xf0e4d0 + (hash % 0x30)
        pageMaterial.color = new THREE.Color(tone)
      } else {
        pageMaterial.color = new THREE.Color(0xf8f1e6)
      }
      pageMaterial.needsUpdate = true
    }

    updatePageMaterial()

    const onResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    window.addEventListener('resize', onResize)

    const animate = () => {
      const delta = clock.getDelta()

      if (isFlipping) {
        flipProgress += delta / flipDuration
        const t = Math.min(flipProgress, 1)
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        const angle = eased * Math.PI * flipDirection
        pageMesh.rotation.y = angle
        shadowMesh.rotation.y = angle * 0.3
        const scale = 1 + 0.03 * Math.sin(t * Math.PI)
        pageMesh.scale.set(scale, scale, 1)

        if (flipProgress >= 1) {
          isFlipping = false
          pageMesh.rotation.y = 0
          shadowMesh.rotation.y = 0
          pageMesh.scale.set(1, 1, 1)
          updatePageMaterial()
          // aggiorna React con l'indice corrente
          setPageIndex(currentIndex)
        }
      }

      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }

    animate()

    let touchStartX: number | null = null

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      touchStartX = t.clientX
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartX == null || isFlipping) return
      const t = e.changedTouches[0]
      const dx = t.clientX - touchStartX
      touchStartX = null

      const threshold = 30
      if (Math.abs(dx) < threshold) return

      if (dx < 0 && currentIndex < totalPages - 1) {
        currentIndex += 1
        flipDirection = 1
        flipProgress = 0
        isFlipping = true
      } else if (dx > 0 && currentIndex > 0) {
        currentIndex -= 1
        flipDirection = -1
        flipProgress = 0
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
          {/* Overlay contenuto pagina */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-none max-w-[92%] max-h-[85%] rounded-3xl px-5 py-4 text-[#2b2018]">
              <div className="text-center mb-2">
                <p className="text-[0.75rem] tracking-[0.25em] uppercase text-[#c1b4a3]">
                  {restaurantName}
                </p>
                <p className="text-[0.9rem] font-semibold text-[#f5eee4]">
                  {menuName}
                </p>
              </div>
              <div className="space-y-2 text-[0.8rem]">
                {currentPageDishes.map((dish) => (
                  <div key={dish.id} className="border-b border-[#e0d4c3]/40 pb-1 last:border-b-0">
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
                      <p className="text-[0.7rem] text-[#7a6755] mt-0.5">
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
                    Nessun piatto in questa pagina.
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
