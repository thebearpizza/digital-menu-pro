'use client'

import { useEffect, useRef } from 'react'
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

export default function ThreeFlipMenu({ dishes, menuName, restaurantName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

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
    camera.position.z = 3

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    })
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.setSize(window.innerWidth, window.innerHeight, false)

    const ambient = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambient)

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(2, 4, 5)
    scene.add(dirLight)

    const geometry = new THREE.PlaneGeometry(2.2, 1.4)
    const frontMaterial = new THREE.MeshStandardMaterial({ color: 0xf8f1e6 })
    const backMaterial = new THREE.MeshStandardMaterial({ color: 0xe5dccb })

    // Mesh con due materiali (front/back)
    const pageMesh = new THREE.Mesh(geometry, [frontMaterial, backMaterial])
    scene.add(pageMesh)

    pageMesh.rotation.x = -0.04 // leggero tilt per dare profondità

    let currentIndex = 0
    const totalPages = Math.max(dishes.length, 1)

    let isFlipping = false
    let flipDirection: 1 | -1 = 1
    let flipProgress = 0
    const flipDuration = 0.5
    const clock = new THREE.Clock()

    const updatePage = () => {
      const dish = dishes[currentIndex]
      if (dish) {
        ;(frontMaterial as THREE.MeshStandardMaterial).color = new THREE.Color(0xf8f1e6)
      } else {
        ;(frontMaterial as THREE.MeshStandardMaterial).color = new THREE.Color(0xe2d4bd)
      }
      frontMaterial.needsUpdate = true
      backMaterial.needsUpdate = true
    }

    updatePage()

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
        const angle = t * Math.PI * flipDirection
        pageMesh.rotation.y = angle

        if (flipProgress >= 1) {
          isFlipping = false
          pageMesh.rotation.y = 0
          updatePage()
        }
      }

      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }

    animate()

    // Swipe touch per cambiare pagina
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
  }, [dishes, menuName, restaurantName])

  return (
    <div className="flex flex-col h-[100dvh] bg-[#15100c]">
      <div className="flex-1 flex items-center justify-center">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  )
}
