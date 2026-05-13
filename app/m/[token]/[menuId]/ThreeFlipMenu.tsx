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

    const geometry = new THREE.PlaneGeometry(2.2, 1.4)
    const material = new THREE.MeshBasicMaterial({ color: 0xf8f1e6 })
    const pageMesh = new THREE.Mesh(geometry, material)
    scene.add(pageMesh)

    const onResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    window.addEventListener('resize', onResize)

    const animate = () => {
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', onResize)
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
