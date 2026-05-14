'use client'

import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useTexture, Environment } from '@react-three/drei'
import { easing } from 'maath'
import {
  Bone,
  BoxGeometry,
  Group,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Uint16BufferAttribute,
  Vector3,
} from 'three'
import { degToRad } from 'three/src/math/MathUtils.js'

// ─── Types ───────────────────────────────────────────────────────────────────

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

type BookPage = {
  category: string
  dishes: Dish[]
}

type Props = {
  dishes: Dish[]
  menuName: string
  restaurantName: string
}

// ─── Costanti pagina ──────────────────────────────────────────────────────────

const PAGE_WIDTH = 1.28
const PAGE_HEIGHT = 1.71
const PAGE_DEPTH = 0.003
const PAGE_SEGMENTS = 30
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS

const easingFactor = 0.5
const easingFactorFold = 0.3
const insideCurveStrength = 0.18
const outsideCurveStrength = 0.05
const turningCurveStrength = 0.09

const MAX_ITEMS = 5

// ─── Geometry + skinning (creati una volta sola fuori dal componente) ─────────

const pageGeometry = new BoxGeometry(
  PAGE_WIDTH,
  PAGE_HEIGHT,
  PAGE_DEPTH,
  PAGE_SEGMENTS,
  2
)
pageGeometry.translate(PAGE_WIDTH / 2, 0, 0)

const position = pageGeometry.attributes.position
const vertex = new Vector3()
const skinIndexes: number[] = []
const skinWeights: number[] = []

for (let i = 0; i < position.count; i++) {
  vertex.fromBufferAttribute(position as any, i)
  const x = vertex.x
  const skinIndex = Math.max(0, Math.floor(x / SEGMENT_WIDTH))
  const skinWeight = (x % SEGMENT_WIDTH) / SEGMENT_WIDTH
  skinIndexes.push(skinIndex, skinIndex + 1, 0, 0)
  skinWeights.push(1 - skinWeight, skinWeight, 0, 0)
}

pageGeometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndexes, 4))
pageGeometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4))

const whiteColor = new Color('white')
const emissiveColor = new Color('orange')

const pageMaterials = [
  new MeshStandardMaterial({ color: whiteColor }),
  new MeshStandardMaterial({ color: '#111' }),
  new MeshStandardMaterial({ color: whiteColor }),
  new MeshStandardMaterial({ color: whiteColor }),
]

// ─── Genera texture canvas per una pagina ────────────────────────────────────

function buildPageTexture(
  page: BookPage,
  menuName: string,
  restaurantName: string,
  isCover = false
): HTMLCanvasElement {
  const W = 512
  const H = 682
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // sfondo carta
  ctx.fillStyle = isCover ? '#1a0f0a' : '#f8f1e6'
  ctx.fillRect(0, 0, W, H)

  if (isCover) {
    // copertina
    ctx.fillStyle = '#c9a96e'
    ctx.font = 'bold 38px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText(restaurantName, W / 2, 200)
    ctx.fillStyle = '#e8d5b0'
    ctx.font = '24px Georgia, serif'
    ctx.fillText(menuName, W / 2, 260)
    ctx.strokeStyle = '#c9a96e'
    ctx.lineWidth = 2
    ctx.strokeRect(30, 30, W - 60, H - 60)
  } else {
    // intestazione categoria
    ctx.fillStyle = '#5b4634'
    ctx.font = 'bold 13px Arial, sans-serif'
    ctx.textAlign = 'center'
    const catText = page.category.toUpperCase()
    ctx.fillText(catText, W / 2, 38)

    // linea separatrice
    ctx.strokeStyle = '#c9a96e'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(40, 50)
    ctx.lineTo(W - 40, 50)
    ctx.stroke()

    // nome ristorante piccolo
    ctx.fillStyle = '#9a8070'
    ctx.font = '10px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(restaurantName, W / 2, 68)

    // elenco piatti
    let y = 100
    ctx.textAlign = 'left'

    page.dishes.forEach((dish) => {
      if (y > H - 60) return

      // nome + prezzo sulla stessa riga
      ctx.fillStyle = '#2b1f14'
      ctx.font = 'bold 15px Arial, sans-serif'
      const nameMaxW = dish.price != null ? W - 130 : W - 80
      let name = dish.name
      if (ctx.measureText(name).width > nameMaxW) {
        while (ctx.measureText(name + '…').width > nameMaxW && name.length > 0) {
          name = name.slice(0, -1)
        }
        name += '…'
      }
      ctx.fillText(name, 40, y)

      if (dish.price != null) {
        ctx.fillStyle = '#5b4634'
        ctx.font = '14px Arial, sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(`€ ${dish.price.toFixed(2)}`, W - 40, y)
        ctx.textAlign = 'left'
      }

      y += 22

      // descrizione
      if (dish.description) {
        ctx.fillStyle = '#7a6755'
        ctx.font = '11px Arial, sans-serif'
        const words = dish.description.split(' ')
        let line = ''
        const lineH = 15
        const maxW = W - 80

        for (const word of words) {
          const test = line + word + ' '
          if (ctx.measureText(test).width > maxW && line.length > 0) {
            ctx.fillText(line.trimEnd(), 40, y)
            line = word + ' '
            y += lineH
            if (y > H - 60) break
          } else {
            line = test
          }
        }
        if (line.trim() && y <= H - 60) {
          ctx.fillText(line.trimEnd(), 40, y)
          y += lineH
        }
      }

      // allergeni
      if (dish.allergens && dish.allergens.length > 0 && y <= H - 60) {
        ctx.fillStyle = '#a1784f'
        ctx.font = '10px Arial, sans-serif'
        ctx.fillText(dish.allergens.join(' • '), 40, y)
        y += 14
      }

      // divisore
      y += 6
      ctx.strokeStyle = '#e0d4c3'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(40, y)
      ctx.lineTo(W - 40, y)
      ctx.stroke()
      y += 12
    })

    // numero pagina
    ctx.fillStyle = '#c9a96e'
    ctx.font = '10px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(page.category, W / 2, H - 20)
  }

  return canvas
}

// ─── Componente Page 3D ───────────────────────────────────────────────────────

type PageProps = {
  number: number
  front: HTMLCanvasElement
  back: HTMLCanvasElement
  page: number
  opened: boolean
  bookClosed: boolean
}

function Page({ number, front, back, page, opened, bookClosed }: PageProps) {
  const group = useRef<Group>(null!)
  const skinnedMeshRef = useRef<SkinnedMesh>(null!)
  const turnedAt = useRef(0)
  const lastOpened = useRef(opened)

  const [highlighted, setHighlighted] = useState(false)

  const frontTexture = useMemo(() => {
    const t = new CanvasTexture(front)
    t.colorSpace = SRGBColorSpace
    return t
  }, [front])

  const backTexture = useMemo(() => {
    const t = new CanvasTexture(back)
    t.colorSpace = SRGBColorSpace
    return t
  }, [back])

  const manualSkinnedMesh = useMemo(() => {
    const bones: Bone[] = []
    for (let i = 0; i <= PAGE_SEGMENTS; i++) {
      const bone = new Bone()
      bones.push(bone)
      if (i === 0) {
        bone.position.x = 0
      } else {
        bone.position.x = SEGMENT_WIDTH
      }
      if (i > 0) {
        bones[i - 1].add(bone)
      }
    }
    const skeleton = new Skeleton(bones)

    const materials = [
      ...pageMaterials,
      new MeshStandardMaterial({
        color: whiteColor,
        map: frontTexture,
        ...(number === 0 ? { roughnessMap: undefined, roughness: 0.6 } : {}),
      }),
      new MeshStandardMaterial({
        color: whiteColor,
        map: backTexture,
        ...(number === 0 ? { roughnessMap: undefined, roughness: 0.6 } : {}),
      }),
    ]

    const mesh = new SkinnedMesh(pageGeometry, materials)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false

    mesh.add(bones[0])
    mesh.bind(skeleton)
    return mesh
  }, [frontTexture, backTexture, number])

  useFrame((_, delta) => {
    if (!skinnedMeshRef.current) return

    const emissiveIntensity = highlighted ? 0.22 : 0
    ;(skinnedMeshRef.current.material as MeshStandardMaterial[])[4].emissive =
      emissiveColor
    ;(skinnedMeshRef.current.material as MeshStandardMaterial[])[4].emissiveIntensity =
      emissiveIntensity
    ;(skinnedMeshRef.current.material as MeshStandardMaterial[])[5].emissive =
      emissiveColor
    ;(skinnedMeshRef.current.material as MeshStandardMaterial[])[5].emissiveIntensity =
      emissiveIntensity

    if (lastOpened.current !== opened) {
      turnedAt.current = +Date.now()
      lastOpened.current = opened
    }
    let turningTime = Math.min(400, Date.now() - turnedAt.current) / 400
    turningTime = Math.sin(turningTime * Math.PI)

    let targetRotation = opened ? -Math.PI / 2 : Math.PI / 2
    if (!bookClosed) targetRotation += degToRad(number * 0.8)

    const bones = skinnedMeshRef.current.skeleton.bones
    for (let i = 0; i < bones.length; i++) {
      const target = i === 0 ? group.current : bones[i]
      const insideCurveX = insideCurveStrength * (opened ? -1 : 1)

      const outsideCurveX = outsideCurveStrength * (opened ? -1 : 1)
      const turningCurveX =
        Math.cos(degToRad((i / PAGE_SEGMENTS) * 180 + 90)) *
        turningCurveStrength *
        turningTime *
        (opened ? -1 : 1)

      let rotationAngle =
        insideCurveStrength * (opened ? -1 : 1) +
        outsideCurveStrength * (opened ? -1 : 1) +
        turningCurveX

      let foldRotationAngle = degToRad(Math.sign(targetRotation) * 2)

      if (bookClosed) {
        foldRotationAngle = 0
        rotationAngle = 0
      }

      easing.dampAngle(
        target.rotation,
        'y',
        i === 0 ? targetRotation : rotationAngle,
        i === 0 ? easingFactor : easingFactorFold,
        delta
      )
    }
  })

  return (
    <group
      ref={group}
      onPointerEnter={() => setHighlighted(true)}
      onPointerLeave={() => setHighlighted(false)}
    >
      <primitive object={manualSkinnedMesh} ref={skinnedMeshRef} />
    </group>
  )
}

// ─── Componente Book 3D ───────────────────────────────────────────────────────

type BookProps = {
  pages: BookPage[]
  menuName: string
  restaurantName: string
  currentPage: number
}

function Book({ pages: bookPages, menuName, restaurantName, currentPage }: BookProps) {
  const canvasPages = useMemo(() => {
    // copertina anteriore
    const cover = buildPageTexture(
      { category: '', dishes: [] },
      menuName,
      restaurantName,
      true
    )
    // pagine contenuto
    const content = bookPages.map((p) =>
      buildPageTexture(p, menuName, restaurantName, false)
    )
    // copertina posteriore
    const backCover = buildPageTexture(
      { category: '', dishes: [] },
      menuName,
      restaurantName,
      true
    )
    return [cover, ...content, backCover]
  }, [bookPages, menuName, restaurantName])

  const totalPages = canvasPages.length - 1

  return (
    <group rotation-y={-Math.PI / 4}>
      {canvasPages.slice(0, -1).map((frontCanvas, i) => (
        <Page
          key={i}
          number={i}
          front={frontCanvas}
          back={canvasPages[i + 1]}
          page={currentPage}
          opened={currentPage > i}
          bookClosed={currentPage === 0 || currentPage === totalPages}
        />
      ))}
    </group>
  )
}

// ─── Componente UI (frecce navigazione) ──────────────────────────────────────

type UIProps = {
  currentPage: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}

function NavUI({ currentPage, totalPages, onPrev, onNext }: UIProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex items-end justify-center pb-8 gap-6">
      <button
        className="pointer-events-auto bg-[#c9a96e]/90 hover:bg-[#c9a96e] text-[#1a0f0a] font-bold w-12 h-12 rounded-full text-xl shadow-lg transition-all disabled:opacity-30"
        onClick={onPrev}
        disabled={currentPage <= 0}
        aria-label="Pagina precedente"
      >
        ‹
      </button>
      <span className="pointer-events-none text-[#c9a96e]/70 text-sm self-center">
        {currentPage} / {totalPages - 1}
      </span>
      <button
        className="pointer-events-auto bg-[#c9a96e]/90 hover:bg-[#c9a96e] text-[#1a0f0a] font-bold w-12 h-12 rounded-full text-xl shadow-lg transition-all disabled:opacity-30"
        onClick={onNext}
        disabled={currentPage >= totalPages - 1}
        aria-label="Pagina successiva"
      >
        ›
      </button>
    </div>
  )
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function BookViewer({ dishes, menuName, restaurantName }: Props) {
  const [currentPage, setCurrentPage] = useState(0)

  const bookPages = useMemo<BookPage[]>(() => {
    const byCategory = new Map<string, Dish[]>()
    for (const dish of dishes) {
      const cat = dish.category || 'Varie'
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push(dish)
    }
    const result: BookPage[] = []
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

  // totale pagine libro = cover + pagine contenuto + back cover
  const totalPages = bookPages.length + 2

  const handlePrev = () => setCurrentPage((p) => Math.max(0, p - 1))
  const handleNext = () => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))

  // swipe touch
  useEffect(() => {
    let startX: number | null = null
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX }
    const onTouchEnd = (e: TouchEvent) => {
      if (startX == null) return
      const dx = e.changedTouches[0].clientX - startX
      startX = null
      if (Math.abs(dx) < 40) return
      if (dx < 0) handleNext()
      else handlePrev()
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [totalPages])

  return (
    <div className="w-full h-[100dvh] bg-[#15100c] relative">
      <Canvas
        shadows
        camera={{ position: [-0.5, 1, 4], fov: 45 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#15100c']} />
        <fog attach="fog" args={['#15100c', 8, 18]} />
        <ambientLight intensity={0.3} color="#fff5e0" />
        <directionalLight
          position={[2, 4, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
          color="#fff5e0"
        />
        <directionalLight position={[-2, -1, 2]} intensity={0.4} color="#ffe0c0" />
        <Book
          pages={bookPages}
          menuName={menuName}
          restaurantName={restaurantName}
          currentPage={currentPage}
        />
      </Canvas>
      <NavUI
        currentPage={currentPage}
        totalPages={totalPages}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </div>
  )
}
